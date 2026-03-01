from app.extensions import db


class ChatMessageSource(db.Model):
    """
    Stores chunk-level citations for each assistant chat message.
    Enables traceability: which chunks were used to generate a given answer.
    """
    __tablename__ = "chat_message_sources"
    __table_args__ = (
        db.UniqueConstraint(
            "message_id", "chunk_id", name="uq_chat_message_sources_message_chunk"
        ),
    )

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    message_id = db.Column(
        db.String(36),
        db.ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id = db.Column(
        db.BigInteger,
        db.ForeignKey("chunks.id", ondelete="CASCADE"),
        nullable=False,
    )
    document_id = db.Column(
        db.String(36),
        db.ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    similarity_score = db.Column(db.Float, nullable=False)
    snippet = db.Column(db.Text, nullable=True)

    # Relationships
    message = db.relationship("ChatMessage", back_populates="sources")

    def __repr__(self):
        return f"<ChatMessageSource msg={self.message_id} chunk={self.chunk_id}>"
