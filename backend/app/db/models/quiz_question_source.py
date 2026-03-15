from app.extensions import db


class QuizQuestionSource(db.Model):
    __tablename__ = "quiz_question_sources"
    __table_args__ = (
        db.UniqueConstraint(
            "question_id",
            "chunk_id",
            name="uq_quiz_question_sources_question_chunk",
        ),
    )

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    question_id = db.Column(
        db.String(36),
        db.ForeignKey("quiz_questions.id", ondelete="CASCADE"),
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

    question = db.relationship("QuizQuestion", back_populates="sources")

    def __repr__(self):
        return f"<QuizQuestionSource question={self.question_id} chunk={self.chunk_id}>"
