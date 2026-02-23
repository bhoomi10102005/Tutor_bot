"""4_Take_Quiz.py — Take an existing quiz."""
import streamlit as st

st.set_page_config(page_title="Take Quiz", page_icon="📝", layout="wide")

# ── Auth guard ─────────────────────────────────────────────────────────────
if not st.session_state.get("access_token"):
    st.warning("Please sign in first.")
    st.page_link("pages/0_Login.py", label="👉 Go to Login")
    st.stop()

# ── Page content ──────────────────────────────────────────────────────────
st.title("📝 Take Quiz")
st.info("Quiz taking implementation coming in Phase 4.", icon="🚧")
