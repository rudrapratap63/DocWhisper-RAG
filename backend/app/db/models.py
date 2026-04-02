import enum
from typing import List, Optional

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import JSON, Enum, ForeignKey, String, UniqueConstraint, func
from app.db.database import Base
from datetime import datetime

class Role(enum.Enum):
    USER = "user"
    AI = "ai"
class Status(enum.Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed" 

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), 
        onupdate=func.now()
    )

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True, unique=True)
    password: Mapped[str] = mapped_column()

    documents: Mapped[List["Document"]] = relationship(back_populates="owner")
    conversations: Mapped[List["Conversation"]] = relationship(back_populates="user")

class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    file_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String)
    status: Mapped[Status] = mapped_column(
        Enum(Status, name="upload_status_type"),
        default=Status.PROCESSING
    )
    owner: Mapped["User"] = relationship(back_populates="documents")
    conversations: Mapped[List["Conversation"]] = relationship(back_populates="document")

class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    
    user: Mapped["User"] = relationship(back_populates="conversations")
    document: Mapped["Document"] = relationship(back_populates="conversations")
    messages: Mapped[List["ChatMessage"]] = relationship(back_populates="conversation")
    
class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    content: Mapped[str] = mapped_column(String)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="user_role_type"),
        default=Role.USER
    )
    citations: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")