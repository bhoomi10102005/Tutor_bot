"""
api_client.py — single HTTP client for all frontend → Flask communication.
Reads API_BASE_URL from .env (falls back to localhost:5000).
Always attaches the JWT access token stored in st.session_state.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5000")


class APIError(Exception):
    def __init__(self, message: str, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


def _headers(token: str | None = None) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _raise(resp: requests.Response) -> None:
    if not resp.ok:
        try:
            msg = resp.json().get("error", resp.text)
        except Exception:
            msg = resp.text
        raise APIError(msg, resp.status_code)


# ── Auth ─────────────────────────────────────────────────────────────────────

def register(email: str, password: str, username: str | None = None) -> dict:
    resp = requests.post(
        f"{API_BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "username": username},
        headers=_headers(),
        timeout=10,
    )
    _raise(resp)
    return resp.json()


def login(email: str, password: str) -> dict:
    resp = requests.post(
        f"{API_BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        headers=_headers(),
        timeout=10,
    )
    _raise(resp)
    return resp.json()


def refresh_token(refresh_tok: str) -> str:
    resp = requests.post(
        f"{API_BASE_URL}/api/auth/refresh",
        headers=_headers(refresh_tok),
        timeout=10,
    )
    _raise(resp)
    return resp.json()["access_token"]


def get_me(access_token: str) -> dict:
    resp = requests.get(
        f"{API_BASE_URL}/api/auth/me",
        headers=_headers(access_token),
        timeout=10,
    )
    _raise(resp)
    return resp.json()["user"]


# ── Generic authenticated helpers ────────────────────────────────────────────

def authed_get(path: str, access_token: str, params: dict | None = None) -> dict:
    resp = requests.get(
        f"{API_BASE_URL}{path}",
        headers=_headers(access_token),
        params=params,
        timeout=30,
    )
    _raise(resp)
    return resp.json()


def authed_post(path: str, access_token: str, payload: dict) -> dict:
    resp = requests.post(
        f"{API_BASE_URL}{path}",
        json=payload,
        headers=_headers(access_token),
        timeout=30,
    )
    _raise(resp)
    return resp.json()


def authed_delete(path: str, access_token: str) -> dict:
    resp = requests.delete(
        f"{API_BASE_URL}{path}",
        headers=_headers(access_token),
        timeout=10,
    )
    _raise(resp)
    return resp.json()
