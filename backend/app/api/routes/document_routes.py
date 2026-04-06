import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.datastructures import FormData
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Status, User
from app.schemas.user_schema import LoginValidation, Token, UserCreate, UserResponse
from app.api.deps import get_current_user, get_db
from app.db import models
from fastapi import File, UploadFile
from supabase import create_client, Client

from app.core.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])

supabase: Client = create_client(
    supabase_url=settings.SUPABASE_URL, 
    supabase_key=settings.SUPABASE_KEY
)

@router.post("/upload")
async def upload_document(
    current_user: User = Depends(get_current_user),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if file.content_type and file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDFs allowed")
    
    # 10 MB file limit
    if file.size and file.size > 10485760:
        raise HTTPException(status_code=403, detail="Content too large, should be under 10MB")
        
    try:
        file_content = await file.read()
        filename = file.filename or "uploaded.pdf"
        file_ext = filename.split(".")[-1] if "." in filename else "pdf"
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        supabase_path = f"user_{current_user.id}/{unique_filename}"
        
        # Upload to Supabase Storage
        upload_response = supabase.storage.from_("pdf_files").upload(
            file=file_content,
            path=supabase_path,
            file_options={"content-type": file.content_type or "application/pdf"}
        )
        
        # Get the public URL for the stored file
        public_url = supabase.storage.from_("pdf_files").get_public_url(supabase_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {str(e)}")

    new_doc = models.Document(
        user_id = current_user.id,
        file_name = file.filename,
        file_path = public_url,
        status = Status.PROCESSING
    )
    
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    
    return {"message": "Upload successful, processing started", "id": new_doc.id, "file_url": public_url}