from fastapi import FastAPI
from app.db.database import Base, engine

app = FastAPI()

@app.on_event("startup")
async def init_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
def home():
    return {"message": "good"}  