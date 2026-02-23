"""5_Analytics.py — View your learning analytics."""
import streamlit as st

st.set_page_config(page_title="Analytics", page_icon="📊", layout="wide")

# ── Auth guard ─────────────────────────────────────────────────────────────
if not st.session_state.get("access_token"):
    st.warning("Please sign in first.")
    st.page_link("pages/0_Login.py", label="👉 Go to Login")
    st.stop()

# ── Page content ──────────────────────────────────────────────────────────
st.title("📊 Analytics")
st.info("Analytics implementation coming in Phase 5.", icon="🚧")
