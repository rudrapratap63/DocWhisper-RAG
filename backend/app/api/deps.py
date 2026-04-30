from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient
from sqlalchemy import select

from app.db.database import AsyncSessionLocal, AsyncSession
from typing import AsyncGenerator

from app.core.config import settings
from app.db import models

security = HTTPBearer()

async def get_db() -> AsyncGenerator[AsyncSession, None] :
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = credentials.credentials
    
    try:
        # Clean up the URL in case it has https:// prefixed
        frontend_api = settings.CLERK_FRONTEND_API.replace("https://", "").replace("http://", "")
        jwks_url = f"https://{frontend_api}/.well-known/jwks.json" 
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        payload = jwt.decode(
            token, 
            signing_key.key, 
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        clerk_id = payload.get("sub")
        if clerk_id is None:
            raise credentials_exception
    except jwt.PyJWTError as e:
        print("JWT Decode Error:", e)
        raise credentials_exception
    except Exception as e:
        print("Unexpected Error:", e)
        raise credentials_exception

    
    stmt = select(models.User).where(models.User.clerk_id == clerk_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    # Just-in-time user creation
    if user is None:
        user = models.User(
            clerk_id=clerk_id,
            email=payload.get("email", f"{clerk_id}@placeholder.com"), # Assuming email might be in token or we use placeholder
            name=payload.get("name", "Clerk User")
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    return user