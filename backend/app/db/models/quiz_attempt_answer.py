from app.extensions import db


class QuizAttemptAnswer(db.Model):
    __tablename__ = "quiz_attempt_answers"
    __table_args__ = (
        db.UniqueConstraint(
            "attempt_id",
            "question_id",
            name="uq_quiz_attempt_answers_attempt_question",
        ),
        db.CheckConstraint(
            "marks_awarded IS NULL OR marks_awarded >= 0",
            name="ck_quiz_attempt_answers_marks_awarded_non_negative",
        ),
    )

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    attempt_id = db.Column(
        db.String(36),
        db.ForeignKey("quiz_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id = db.Column(
        db.String(36),
        db.ForeignKey("quiz_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chosen_json = db.Column(db.JSON, nullable=True)
    is_correct = db.Column(db.Boolean, nullable=True)
    marks_awarded = db.Column(db.Float, nullable=True)

    attempt = db.relationship("QuizAttempt", back_populates="answers")
    question = db.relationship("QuizQuestion", back_populates="attempt_answers")

    def __repr__(self):
        return f"<QuizAttemptAnswer attempt={self.attempt_id} question={self.question_id}>"
