"""1_Chat_Tutor.py — Chat with your AI tutor."""
import streamlit as st

st.set_page_config(page_title="Chat Tutor", page_icon="💬", layout="wide")

# ── Auth guard ─────────────────────────────────────────────────────────────
if not st.session_state.get("access_token"):
    st.warning("Please sign in first.")
    st.page_link("pages/0_Login.py", label="👉 Go to Login")
    st.stop()

# ── Page content (Phase 3: RAG chat) ──────────────────────────────────────
st.title("💬 Chat Tutor")
st.info("Chat implementation coming in Phase 3.", icon="🚧")
