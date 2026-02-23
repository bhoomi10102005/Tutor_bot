"""2_Upload_Documents.py — Upload documents for RAG ingestion."""
import streamlit as st

st.set_page_config(page_title="Upload Documents", page_icon="📄", layout="wide")

# ── Auth guard ─────────────────────────────────────────────────────────────
if not st.session_state.get("access_token"):
    st.warning("Please sign in first.")
    st.page_link("pages/0_Login.py", label="👉 Go to Login")
    st.stop()

# ── Page content (Phase 3: document ingestion) ────────────────────────────
st.title("📄 Upload Documents")
st.info("Document upload implementation coming in Phase 3.", icon="🚧")
