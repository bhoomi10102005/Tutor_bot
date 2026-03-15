import uuid
from datetime import datetime, timezone
from app.extensions import db


class Quiz(db.Model):
    __tablename__ = "quizzes"
    __table_args__ = (
        db.CheckConstraint("total_marks >= 0", name="ck_quizzes_total_marks_non_negative"),
        db.CheckConstraint(
            "time_limit_sec IS NULL OR time_limit_sec > 0",
            name="ck_quizzes_time_limit_sec_positive",
        ),
    )

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
    title = db.Column(db.String(255), nullable=False)
    instructions = db.Column(db.Text, nullable=True)
    spec_json = db.Column(db.JSON, nullable=False)
    total_marks = db.Column(db.Float, nullable=False, default=0.0)
    time_limit_sec = db.Column(db.Integer, nullable=True)
    model_used = db.Column(db.String(100), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    questions = db.relationship(
        "QuizQuestion",
        back_populates="quiz",
        lazy="dynamic",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.question_index",
    )
    attempts = db.relationship(
        "QuizAttempt",
        back_populates="quiz",
        lazy="dynamic",
        cascade="all, delete-orphan",
        order_by="QuizAttempt.started_at",
    )

    def __repr__(self):
        return f"<Quiz id={self.id} user={self.user_id}>"
