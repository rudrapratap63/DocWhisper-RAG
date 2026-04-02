from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy import select

from app.db.database import AsyncSessionLocal, AsyncSession
from typing import AsyncGenerator

from app.core.config import settings
from app.db import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

async def get_db() -> AsyncGenerator[AsyncSession, None] :
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        email = payload.get("email")

        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    stmt = select(models.User).where(models.User.email == email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if user is None:
        raise credentials_exception
    
    return user