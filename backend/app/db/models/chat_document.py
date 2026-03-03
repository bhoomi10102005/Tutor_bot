"""
Association table: chat_documents

Maps which documents are pinned to a specific chat session for RAG context.

When no rows exist for a chat, the answering engine searches ALL the user's
documents.  When rows exist, only the listed documents are searched.

This is a plain SQLAlchemy association table (db.Table) with no extra
columns — just the composite primary key of (chat_id, document_id).
"""

from app.extensions import db

chat_documents = db.Table(
    "chat_documents",
    db.Column(
        "chat_id",
        db.String(36),
        db.ForeignKey("chats.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
    db.Column(
        "document_id",
        db.String(36),
        db.ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
)
