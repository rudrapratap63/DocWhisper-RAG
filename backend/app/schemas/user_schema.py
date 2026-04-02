from pydantic import BaseModel, ConfigDict, EmailStr, Field

class LoginValidation(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(..., min_length=8)

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str