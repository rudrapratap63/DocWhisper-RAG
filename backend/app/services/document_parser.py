from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

def load_and_chunk_document(file_path: str):
    loader = PyPDFLoader(file_path=file_path)
    docs = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200 # Standard overlap to keep context
    )
    chunks = text_splitter.split_documents(documents=docs)
    return chunks