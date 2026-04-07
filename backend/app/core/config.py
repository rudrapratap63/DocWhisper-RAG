from pydantic import Field
from pydantic_settings import SettingsConfigDict, BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = Field(default=...)

    SECRET_KEY: str = Field(default=...)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"
    SUPABASE_URL: str = Field(default=...)
    SUPABASE_KEY: str = Field(default=...)
    REDIS_HOST: str = "localhost"
    QDRANT_URL: str = Field(default=...)
    GROQ_API_KEY: str = Field(default=...)
    # POSTMAN_API_KEY: str = Field(default=...)
    # POSTMAN_COLLECTION_ID: str = Field(default=...)

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()