import os
import tempfile
from typing import Sequence

from openai import OpenAI
from qdrant_client import models
from langchain_qdrant import QdrantVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from app.core.supabase import supabase
from app.db.models import ChatMessage, Document, Status
from app.api.deps import get_db
from app.services.document_parser import load_and_chunk_document
from app.core.config import settings
from openai.types.chat import ChatCompletionMessageParam

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-l6-v2")
client = OpenAI(
    api_key=settings.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
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
                collection_name="user_documents",
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
            if "tmp_file_path" in locals() and os.path.exists(tmp_file_path):  # type: ignore
                os.remove(tmp_file_path)  # type: ignore


async def process_chat(
    query: str,
    current_user_id: int,
    target_doc_id: int,
    chat_history: Sequence[dict],
    conversation_id: int,
):
    vector_store = QdrantVectorStore.from_existing_collection(
        collection_name="user_documents", embedding=embeddings, url=settings.QDRANT_URL
    )

    print("searching chunks for query: ", query)
    search_results = vector_store.similarity_search(
        query=query,
        filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="metadata.user_id",
                    match=models.MatchValue(value=current_user_id),
                ),
                models.FieldCondition(
                    key="metadata.document_id",
                    match=models.MatchValue(value=target_doc_id),
                ),
            ]
        ),
    )
    print("search_results: ", search_results)
    context = "\n\n\n".join(
        [
            f"Page Content: {result.page_content}\nPage Number: {result.metadata['page_label']}\nFile Location: {result.metadata['source']}"
            for result in search_results
        ]
    )
    print("\n\n\n\n\ncontext: ", context)
    SYSTEM_PROMPT = f"""
        You are a highly skilled Document Intelligence Assistant. Your goal is to provide comprehensive, professional, and insightful answers based solely on the provided context.

        ### Your Operational Rules:
        1. **Analyze & Expand:** Do not just provide one-sentence answers. If the context allows, explain the 'how' and 'why'. Provide a thorough synthesis of the information.
        2. **Structure for Clarity:** Use Markdown (bullet points, bold text, and numbered lists) to make your response easy to read. 
        3. **Strict Adherence:** Your knowledge is limited to the provided Context. If the context doesn't contain the answer, explicitly state: "Based on the provided documents, I cannot find specific information regarding [User's Query]."
        4. **Contextual Citations:** You must integrate citations naturally into your prose. 
            - Format: "The quarterly revenue increased by 20% **[Source: Page 4]**."
            - If multiple pages discuss a topic, cite them all: **[Source: Page 4, 12]**.
        5. **No Hallucinations:** Never use outside knowledge. If the context says the sky is green, then the sky is green.

        ### Formatting Instructions:
        - Start with a clear summary sentence.
        - Use subheadings if the answer covers multiple distinct points.
        - End with a "Sources Summary" list if more than two pages were referenced.

        ### Context Provided:
        ---------------------
        {context}
        ---------------------
        """

    formatted_messages: list[ChatCompletionMessageParam] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in chat_history:
        role_name = "assistant" if msg["role"] == "ai" else msg["role"]
        formatted_messages.append({"role": role_name, "content": msg["content"]})

    formatted_messages.append({"role": "user", "content": query})
    print("\n\n\n\n\n\nformatted_messages: ", formatted_messages)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=formatted_messages,
    )

    ai_content = response.choices[0].message.content
    print(f"🤖: {ai_content}")

    from app.db.models import Role

    async for db in get_db():
        ai_msg = ChatMessage(
            conversation_id=conversation_id, content=ai_content, role=Role.AI
        )
        db.add(ai_msg)
        await db.commit()

    return ai_content
