import os
import tempfile

from langchain_qdrant import QdrantVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from app.core.supabase import supabase
from app.db.models import Document, Status
from app.api.deps import get_db
from backend.app.services.document_parser import load_and_chunk_document

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-l6-v2"
)

async def index_document(document_id: int):
    async for db in get_db():
        doc = await db.get(Document, document_id)
        if not doc:
            return

        try:
            file_bytes = supabase.storage.from_("pdf_files").download(doc.file_path)
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                tmp_file.write(file_bytes)
                tmp_file_path = tmp_file.name

            chunks = load_and_chunk_document(file_path=tmp_file_path)

            for chunk in chunks:
                chunk.metadata["user_id"] = doc.user_id
                chunk.metadata["document_id"] = doc.id

            QdrantVectorStore.from_documents(
                documents=chunks,
                embedding=embeddings,
                url="http://qdrant:6333", 
                collection_name="user_documents"
            )
            
            doc.status = Status.READY
            await db.commit()
            print(f"Document {document_id} indexed successfully.")

        except Exception as e:
            # Error Handling: Update Status to FAILED
            print(f"Error indexing document {document_id}: {str(e)}")
            doc.status = Status.FAILED
            await db.commit()

        finally:
            # Cleanup temp file
            if 'tmp_file_path' in locals() and os.path.exists(tmp_file_path): # type: ignore
                os.remove(tmp_file_path) # type: ignore