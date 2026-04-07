from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Role, User
from app.api.deps import get_current_user, get_db
from app.db.models import Conversation, ChatMessage

from app.core.queue import queue
from app.worker.tasks import process_chat
from app.schemas.chat_schema import ChatRequest

router = APIRouter(prefix="/chats", tags=["Chats"])


@router.post("/send")
async def send_message(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if request.conversation_id is None:
        # for first message we have to create conversation_id
        if not request.document_id:
            raise HTTPException(400, "document_id required for new chats")

        new_conv = Conversation(
            user_id=current_user.id,
            document_id=request.document_id,
            title=request.message[:30] + "...",
        )
        db.add(new_conv)
        await db.commit()
        await db.refresh(new_conv)

        active_conversation_id = new_conv.id
        target_doc_id = new_conv.document_id
    else:
        active_conversation_id = request.conversation_id
        stmt = select(Conversation).where(Conversation.id == active_conversation_id)
        result = await db.execute(stmt)
        user_conversation = result.scalars().first()
        if not user_conversation:
            raise HTTPException(502, "server error")
        if user_conversation.user_id != current_user.id:
            raise HTTPException(403, "user not have access to this conversation")
        
        target_doc_id = user_conversation.document_id

    user_msg = ChatMessage(
        conversation_id=active_conversation_id, content=request.message, role=Role.USER
    )
    db.add(user_msg)
    await db.commit()

    # Fetch history
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.conversation_id == active_conversation_id)
        .order_by(desc(ChatMessage.created_at))
        .limit(6)
    )
    result = await db.execute(stmt)
    chat_history_db = result.scalars().all()
    
    chat_history = [{"role": msg.role.value, "content": msg.content} for msg in reversed(chat_history_db)]

    queue.enqueue(
        process_chat,
        query=request.message,
        current_user_id=current_user.id,
        target_doc_id=target_doc_id,
        chat_history=chat_history,
        conversation_id=active_conversation_id,
    )
    return {
        "status": "processing",
        "conversation_id": active_conversation_id, 
        "message": "AI is thinking...",
    }