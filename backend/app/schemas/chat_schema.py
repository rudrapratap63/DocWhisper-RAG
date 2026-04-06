from pydantic import BaseModel
from typing import List, Optional, Dict

class ChatRequest(BaseModel):
    conversation_id: Optional[int] = None 
    document_id: Optional[int] = None     
    message: str

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    citations: Optional[List[Dict]] = None
    
class ChatHistoryResponse(BaseModel):
    messages: List[MessageResponse]