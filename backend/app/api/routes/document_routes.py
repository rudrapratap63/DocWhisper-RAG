import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Status, User
from app.api.deps import get_current_user, get_db
from app.db import models
from fastapi import File, UploadFile
from app.core.supabase import supabase

from app.core.queue import queue
from app.worker.tasks import index_document

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload")
async def upload_document(
    current_user: User = Depends(get_current_user),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if file.content_type and file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDFs allowed")
    
    # 10 MB file limit
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Content too large, should be under 10MB")
        
    try:
        file_content = await file.read()
        unique_id = str(uuid.uuid4())
        supabase_path = f"user_{current_user.id}/{unique_id}.pdf"
        
        # Upload to Supabase Storage
        upload_response = supabase.storage.from_("pdf_files").upload(
            file=file_content,
            path=supabase_path,
            file_options={"content-type": file.content_type or "application/pdf"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {str(e)}")

    new_doc = models.Document(
        user_id = current_user.id,
        file_name = file.filename,
        file_path = supabase_path,
        status = Status.PROCESSING
    )
    
    try:
        db.add(new_doc)
        await db.commit()
        await db.refresh(new_doc)
    except Exception:
        supabase.storage.from_("pdf_files").remove([supabase_path])
        raise HTTPException(status_code=500, detail="Database error, cleaned up storage.")
    
    queue.enqueue(index_document, new_doc.id)
    
    return {
        "message": "Upload successful", 
        "doc_id": new_doc.id,
        "status": new_doc.status
    }