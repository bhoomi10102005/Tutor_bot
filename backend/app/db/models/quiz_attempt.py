import uuid
from datetime import datetime, timezone
from app.extensions import db


class QuizAttempt(db.Model):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        db.CheckConstraint(
            "time_spent_sec IS NULL OR time_spent_sec >= 0",
            name="ck_quiz_attempts_time_spent_sec_non_negative",
        ),
        db.CheckConstraint(
            "score IS NULL OR score >= 0",
            name="ck_quiz_attempts_score_non_negative",
        ),
        db.CheckConstraint(
            "total_marks >= 0",
            name="ck_quiz_attempts_total_marks_non_negative",
        ),
        db.CheckConstraint(
            "score IS NULL OR score <= total_marks",
            name="ck_quiz_attempts_score_lte_total_marks",
        ),
    )

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    quiz_id = db.Column(
        db.String(36),
        db.ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    time_spent_sec = db.Column(db.Integer, nullable=True)
    score = db.Column(db.Float, nullable=True)
    total_marks = db.Column(db.Float, nullable=False, default=0.0)
    summary_json = db.Column(db.JSON, nullable=True)

    quiz = db.relationship("Quiz", back_populates="attempts")
    answers = db.relationship(
        "QuizAttemptAnswer",
        back_populates="attempt",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<QuizAttempt id={self.id} quiz={self.quiz_id} user={self.user_id}>"
