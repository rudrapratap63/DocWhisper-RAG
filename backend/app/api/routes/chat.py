import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Role, Status, User
from app.api.deps import get_current_user, get_db
from app.db import models

from app.core.queue import queue
from app.worker.tasks import index_document
from app.schemas.chat_schema import ChatRequest

router = APIRouter(prefix="/chats", tags=["Chats"])

@router.post("/send")
async def send_message(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if request.conversation_id is None:
        # for first message we have to create conversation_id
        if not request.document_id:
            raise HTTPException(400, "document_id required for new chats")
            
        new_conv = models.Conversation(
            user_id=current_user.id,
            document_id=request.document_id,
            title=request.message[:30] + "..." 
        )
        db.add(new_conv)
        await db.commit()
        await db.refresh(new_conv)
        
        active_conversation_id = new_conv.id
    else:
        # Existing chat. Just verify the user owns it.
        active_conversation_id = request.conversation_id
        # (Security check logic here to ensure current_user.id == conversation.user_id)

    # --- STEP 2: PROCEED WITH RAG ---

    # 1. Save the User Message
    user_msg = models.ChatMessage(
        conversation_id=active_conversation_id,
        content=request.message,
        role=Role.USER
    )
    db.add(user_msg)
    await db.commit()

    # 2. Fetch history (which will be empty or 1 message now)
    # ... logic to fetch history and enqueue the worker ...

    # 3. RETURN the ID to the frontend
    return {
        "status": "processing",
        "conversation_id": active_conversation_id, # Frontend saves this for message #2
        "message": "AI is thinking..."
    }