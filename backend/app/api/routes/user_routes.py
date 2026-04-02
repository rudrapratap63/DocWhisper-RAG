from fastapi import APIRouter, Depends

from app.db.models import User
from app.schemas.user_schema import UserResponse
from app.api.deps import get_current_user


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)
@router.get("/me", response_model=UserResponse)
async def check_me(current_user: User = Depends(get_current_user)):
    return current_user