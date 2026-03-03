import uuid
from datetime import datetime, timezone
from app.extensions import db
from app.db.models.chat_document import chat_documents


class Chat(db.Model):
    __tablename__ = "chats"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = db.Column(db.String(255), nullable=False, default="New Chat")
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    messages = db.relationship(
        "ChatMessage",
        back_populates="chat",
        lazy="dynamic",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )

    # Documents pinned to this chat for RAG context.
    # Empty → search all user documents.  Non-empty → restrict to these docs.
    selected_documents = db.relationship(
        "Document",
        secondary=chat_documents,
        lazy="dynamic",
    )

    def __repr__(self):
        return f"<Chat id={self.id} user={self.user_id}>"
