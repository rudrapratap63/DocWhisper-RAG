from fastapi import APIRouter, Depends, HTTPException
from fastapi.datastructures import FormData
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from app.schemas.user_schema import LoginValidation, Token, UserCreate, UserResponse
from app.api.deps import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.db import models

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)

async def check_user_exist(db: AsyncSession, email: str):
    stmt = select(models.User).where(models.User.email == email)
    result = await db.execute(stmt)
    users = result.scalars().first()
    return users

async def create_user(db: AsyncSession, user: UserCreate):
    hash_pwd = hash_password(user.password)
    new_user = models.User(
        name = user.name,
        email = user.email,
        password = hash_pwd
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return new_user

@router.post("/signup", response_model=UserResponse)
async def signup(user: UserCreate, db: AsyncSession = Depends(get_db)):
    is_user_exist = await check_user_exist(db, email=user.email)
    if is_user_exist:
        raise HTTPException(409, detail="Email already exist")
    return await create_user(db, user)

@router.post("/signin", response_model=Token)
async def signin(
        user: LoginValidation, 
        db: AsyncSession = Depends(get_db)
    ):
    user_exist = await check_user_exist(db, email=user.email)
    if not user_exist:
        raise HTTPException(404, detail="User not found")
    if not verify_password(user.password, hashed_password=user_exist.password):
        raise HTTPException(401, detail="Incorrect Password")
    
    access_token = create_access_token(
        data={
            "id": user_exist.id,
            "email": user_exist.email,
        }
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/token", response_model=Token)
async def authenticate(
        form_data: OAuth2PasswordRequestForm = Depends(), 
        db: AsyncSession = Depends(get_db)
    ):
    
    try:
        valid_data = LoginValidation(
            email=form_data.username, 
            password=form_data.password
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    user_exist = await check_user_exist(db, email=valid_data.email)
    if not user_exist:
        raise HTTPException(404, detail="User not found")
    if not verify_password(form_data.password, hashed_password=user_exist.password):
        raise HTTPException(401, detail="Incorrect Password")
    
    access_token = create_access_token(
        data={
            "id": user_exist.id,
            "email": user_exist.email,
        }
    )
    return {"access_token": access_token, "token_type": "bearer"}
