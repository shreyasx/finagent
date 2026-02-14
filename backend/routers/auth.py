import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import resend
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.middleware.auth import get_current_user
from backend.models.database import User, get_db
from backend.models.schemas import (
    AuthResponse,
    LoginRequest,
    SignupRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    pw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    pw = password.encode("utf-8")[:72]
    return bcrypt.checkpw(pw, hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def send_verification_email(email: str, token: str) -> None:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping verification email for %s", email)
        return

    resend.api_key = settings.resend_api_key
    verification_link = f"{settings.verification_url_base}?token={token}"

    resend.Emails.send({
        "from": "FinAgent <onboarding@resend.dev>",
        "to": [email],
        "subject": "Verify your FinAgent account",
        "html": (
            f"<h2>Welcome to FinAgent</h2>"
            f"<p>Click the link below to verify your email address:</p>"
            f'<p><a href="{verification_link}">{verification_link}</a></p>'
            f"<p>This link will remain valid until used.</p>"
        ),
    })


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check if email already registered
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    verification_token = secrets.token_urlsafe(32)

    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        is_verified=False,
        verification_token=verification_token,
        interaction_count=0,
        max_interactions=settings.max_interactions,
    )
    db.add(user)
    await db.commit()

    try:
        send_verification_email(request.email, verification_token)
    except Exception as e:
        logger.error("Failed to send verification email: %s", e)

    return {"message": "Account created. Check your email to verify."}


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in",
        )

    token = create_access_token(str(user.id))
    return AuthResponse(token=token, email=user.email)


@router.get("/verify")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.verification_token == token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    user.is_verified = True
    user.verification_token = None
    await db.commit()

    return {"message": "Email verified successfully. You can now log in."}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
