"""
0_Login.py — Login & Register page.
This is page 0 in the Streamlit sidebar so it always appears first.
"""
import streamlit as st
from components.api_client import login, register, APIError

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Tutor Bot — Login",
    page_icon="🎓",
    layout="centered",
)

# ── Custom CSS (Light theme) ─────────────────────────────────────────────────
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    html, body, [class*="css"] {
        font-family: 'Inter', system-ui, sans-serif;
    }

    .auth-card {
        background: #E8F0FE;
        border: 1px solid #C7D7F9;
        border-radius: 14px;
        padding: 2.5rem 2rem 2rem 2rem;
        max-width: 420px;
        margin: 3rem auto 0 auto;
    }
    .auth-title {
        font-size: 1.8rem;
        font-weight: 700;
        color: #1F2937;
        text-align: center;
        margin-bottom: 0.25rem;
    }
    .auth-sub {
        font-size: 0.9rem;
        color: #6B7280;
        text-align: center;
        margin-bottom: 1.8rem;
    }

    div[data-testid="stTextInput"] input {
        background: #F7F9FC !important;
        border: 1px solid #C7D7F9 !important;
        border-radius: 8px !important;
        color: #1F2937 !important;
    }
    div[data-testid="stTextInput"] label { color: #374151 !important; }

    div.stButton > button {
        background: #4F8BF9;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 0.55rem 1.2rem;
        font-weight: 600;
        width: 100%;
        transition: background 0.2s;
    }
    div.stButton > button:hover { background: #3B72E0; }

    .stTabs [data-baseweb="tab"] {
        color: #6B7280;
        font-weight: 500;
    }
    .stTabs [aria-selected="true"] {
        color: #4F8BF9 !important;
        border-bottom: 2px solid #4F8BF9 !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── Redirect if already logged in ────────────────────────────────────────────
if st.session_state.get("access_token"):
    st.success("You are already logged in.")
    st.page_link("Home.py", label="Go to Dashboard →")
    st.stop()

# ── Auth card ─────────────────────────────────────────────────────────────────
st.markdown(
    '<div class="auth-card">'
    '<div class="auth-title">🎓 Tutor Bot</div>'
    '<div class="auth-sub">Your personal AI study workspace</div>',
    unsafe_allow_html=True,
)

tab_login, tab_register = st.tabs(["Sign In", "Create Account"])

# ── LOGIN ─────────────────────────────────────────────────────────────────────
with tab_login:
    with st.form("login_form"):
        email = st.text_input("Email", placeholder="you@example.com")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Sign In")

    if submitted:
        if not email or not password:
            st.error("Please fill in both fields.")
        else:
            try:
                data = login(email.strip().lower(), password)
                st.session_state["access_token"] = data["access_token"]
                st.session_state["refresh_token"] = data["refresh_token"]
                st.session_state["user"] = data["user"]
                st.success(f"Welcome back, {data['user'].get('username') or data['user']['email']}!")
                st.rerun()
            except APIError as e:
                st.error(str(e))

# ── REGISTER ──────────────────────────────────────────────────────────────────
with tab_register:
    with st.form("register_form"):
        r_email = st.text_input("Email", placeholder="you@example.com", key="r_email")
        r_username = st.text_input("Username (optional)", placeholder="study_hero", key="r_username")
        r_password = st.text_input("Password (min 8 chars)", type="password", key="r_pass")
        r_confirm = st.text_input("Confirm Password", type="password", key="r_confirm")
        r_submitted = st.form_submit_button("Create Account")

    if r_submitted:
        if not r_email or not r_password:
            st.error("Email and password are required.")
        elif r_password != r_confirm:
            st.error("Passwords do not match.")
        elif len(r_password) < 8:
            st.error("Password must be at least 8 characters.")
        else:
            try:
                data = register(
                    r_email.strip().lower(),
                    r_password,
                    r_username.strip() or None,
                )
                st.session_state["access_token"] = data["access_token"]
                st.session_state["refresh_token"] = data["refresh_token"]
                st.session_state["user"] = data["user"]
                st.success("Account created! Redirecting…")
                st.rerun()
            except APIError as e:
                st.error(str(e))

st.markdown("</div>", unsafe_allow_html=True)
