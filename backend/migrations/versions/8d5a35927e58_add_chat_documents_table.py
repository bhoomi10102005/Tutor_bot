"""add_chat_documents_table

Revision ID: 8d5a35927e58
Revises: b68382d50595
Create Date: 2026-03-03 21:26:03.440818

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8d5a35927e58'
down_revision = 'b68382d50595'
branch_labels = None
depends_on = None


def upgrade():
    # Create the chat_documents association table.
    # NOTE: The ix_chunks_embedding index drop detected by autogenerate is a
    # false positive — Alembic does not natively understand pgvector ivfflat
    # indexes.  That block has been intentionally removed to preserve the index.
    op.create_table(
        'chat_documents',
        sa.Column('chat_id', sa.String(length=36), nullable=False),
        sa.Column('document_id', sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('chat_id', 'document_id'),
    )


def downgrade():
    op.drop_table('chat_documents')
