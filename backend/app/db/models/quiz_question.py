import uuid
from app.extensions import db


class QuizQuestion(db.Model):
    __tablename__ = "quiz_questions"
    __table_args__ = (
        db.UniqueConstraint(
            "quiz_id",
            "question_index",
            name="uq_quiz_questions_quiz_question_index",
        ),
        db.CheckConstraint(
            "question_index >= 0",
            name="ck_quiz_questions_question_index_non_negative",
        ),
        db.CheckConstraint(
            "marks >= 0",
            name="ck_quiz_questions_marks_non_negative",
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
    question_index = db.Column(db.Integer, nullable=False)
    type = db.Column(db.String(50), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    options_json = db.Column(db.JSON, nullable=True)
    correct_json = db.Column(db.JSON, nullable=False)
    marks = db.Column(db.Float, nullable=False, default=0.0)
    explanation = db.Column(db.Text, nullable=True)

    quiz = db.relationship("Quiz", back_populates="questions")
    sources = db.relationship(
        "QuizQuestionSource",
        back_populates="question",
        lazy="select",
        cascade="all, delete-orphan",
    )
    attempt_answers = db.relationship(
        "QuizAttemptAnswer",
        back_populates="question",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<QuizQuestion id={self.id} quiz={self.quiz_id} index={self.question_index}>"
