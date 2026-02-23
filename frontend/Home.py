"""
Home.py — Entry point of the Tutor Bot Streamlit app.
Checks for a valid JWT; redirects to login if missing.
Shows a welcome dashboard when authenticated.
"""
import streamlit as st

st.set_page_config(
    page_title="Tutor Bot",
    page_icon="🎓",
    layout="wide",
)

# ── Custom CSS (Calm Tutor palette) ────────────────────────────────────────
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    html, body, [class*="css"] {
        font-family: 'Inter', system-ui, sans-serif;
        background-color: #0B1220;
        color: #E6EAF2;
    }
    .stApp { background-color: #0B1220; }

    .dash-card {
        background: #111B2E;
        border: 1px solid #22304A;
        border-radius: 12px;
        padding: 1.4rem 1.6rem;
    }
    .dash-card h3 { color: #E6EAF2; margin-bottom: 0.4rem; }
    .dash-card p  { color: #A7B0C0; margin: 0; font-size: 0.9rem; }

    .badge {
        display: inline-block;
        background: #6D5EF7;
        color: #E6EAF2;
        border-radius: 6px;
        padding: 0.15rem 0.6rem;
        font-size: 0.75rem;
        font-weight: 600;
        margin-left: 0.5rem;
    }
    div.stButton > button {
        background: #6D5EF7;
        color: #E6EAF2;
        border: none;
        border-radius: 8px;
        padding: 0.45rem 1.1rem;
        font-weight: 600;
        transition: background 0.2s;
    }
    div.stButton > button:hover { background: #5a4dd6; }

    /* danger button */
    div[data-testid="logout-btn"] > button {
        background: #1e2a3a !important;
        border: 1px solid #22304A !important;
        color: #A7B0C0 !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# ── Auth guard ─────────────────────────────────────────────────────────────────
def _require_auth():
    if not st.session_state.get("access_token"):
        st.warning("Please sign in to access your workspace.")
        st.page_link("pages/0_Login.py", label="👉 Go to Login")
        st.stop()


_require_auth()

user = st.session_state["user"]
display_name = user.get("username") or user["email"]

# ── Sidebar ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        f"<div style='color:#A7B0C0;font-size:0.8rem;margin-bottom:0.3rem'>Signed in as</div>"
        f"<div style='color:#E6EAF2;font-weight:600'>{display_name}</div>"
        f"<div style='color:#A7B0C0;font-size:0.75rem'>{user['email']}</div>",
        unsafe_allow_html=True,
    )
    st.divider()
    if st.button("Sign Out", key="sidebar-logout"):
        for k in ["access_token", "refresh_token", "user"]:
            st.session_state.pop(k, None)
        st.rerun()

# ── Dashboard header ──────────────────────────────────────────────────────────
st.markdown(f"## 👋 Welcome back, **{display_name}**")
st.markdown(
    "<p style='color:#A7B0C0;margin-top:-0.5rem'>Your private study workspace is ready.</p>",
    unsafe_allow_html=True,
)
st.divider()

# ── Feature cards ─────────────────────────────────────────────────────────────
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.markdown(
        """
        <div class="dash-card">
          <h3>💬 Chat Tutor</h3>
          <p>Ask questions about your uploaded documents.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.page_link("pages/1_Chat_Tutor.py", label="Open Chat →")

with col2:
    st.markdown(
        """
        <div class="dash-card">
          <h3>📄 Documents</h3>
          <p>Upload PDFs and notes to power your tutor.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.page_link("pages/2_Upload_Documents.py", label="Upload →")

with col3:
    st.markdown(
        """
        <div class="dash-card">
          <h3>🧠 Quizzes</h3>
          <p>Auto-generate and take quizzes on any topic.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.page_link("pages/3_Create_Quiz.py", label="Create Quiz →")

with col4:
    st.markdown(
        """
        <div class="dash-card">
          <h3>📊 Analytics</h3>
          <p>Track your learning progress over time.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.page_link("pages/5_Analytics.py", label="View Analytics →")
