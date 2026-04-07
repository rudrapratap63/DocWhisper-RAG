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
        score_threshold=0.65,
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
    
    if not search_results:
        ai_content = "I'm sorry, but I couldn't find any information about that in the uploaded document."
        citations_data = []
        print(f"🤖: {ai_content}")
    else:
        context = "\n\n\n".join(
            [
                f"Page Content: {result.page_content}\nPage Number: {result.metadata['page_label']}\nFile Location: {result.metadata['source']}"
                for result in search_results
            ]
        )
        print("\n\ncontext: ", context)
        SYSTEM_PROMPT = f"""
            You are a strictly context-bound Document Intelligence Assistant. Your task is to synthesize answers based ONLY on the information provided in the "Context Provided" section.

            ### THE GOLDEN RULE (MANDATORY):
            - **If the "Context Provided" section below is EMPTY, or if it does not contain the specific answer, you must state: "I'm sorry, but I couldn't find any information about that in the uploaded document."**
            - **DO NOT** use your internal knowledge.
            - **DO NOT** explain what a term is (like Kafka) if it is not defined in the context.

            ### Operational Instructions:
            1. **Analyze & Expand:** If information exists, provide a detailed response explaining the 'how' and 'why' based on the text.
            2. **Strict Structure:** Use Markdown (subheadings, bolding, bullet points) for readability.
            3. **Natural Citations:** Every factual claim must be followed by a source tag: **[Source: Page X]**.
            4. **No Hallucinations:** You are a mirror of the document. If the document is silent on a topic, you are silent on that topic.

            ### Context Provided:
            ---------------------
            {context if context.strip() else "NO RELEVANT CONTEXT FOUND IN DOCUMENT."}
            ---------------------
            """

        formatted_messages: list[ChatCompletionMessageParam] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in chat_history:
            role_name = "assistant" if msg["role"] == "ai" else msg["role"]
            formatted_messages.append({"role": role_name, "content": msg["content"]})

        formatted_messages.append({"role": "user", "content": query})
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=formatted_messages,
        )

        ai_content = response.choices[0].message.content
        print(f"🤖: {ai_content}")

        citations_data = [
            {"page_number": result.metadata.get("page_label"), "source": result.metadata.get("source")}
            for result in search_results
        ]

    from app.db.models import Role

    async for db in get_db():
        ai_msg = ChatMessage(
            conversation_id=conversation_id, content=ai_content, role=Role.AI, citations=citations_data
        )
        db.add(ai_msg)
        await db.commit()

    return ai_content
