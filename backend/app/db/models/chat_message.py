import uuid
from datetime import datetime, timezone
from app.extensions import db


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    chat_id = db.Column(
        db.String(36),
        db.ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # "user" | "assistant"
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    # populated for assistant messages only
    model_used = db.Column(db.String(100), nullable=True)
    # JSON blob containing router decision details
    router_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    chat = db.relationship("Chat", back_populates="messages")
    sources = db.relationship(
        "ChatMessageSource",
        back_populates="message",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self):
        return f"<ChatMessage id={self.id} role={self.role} chat={self.chat_id}>"
