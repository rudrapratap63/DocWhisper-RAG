FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Ensure you have your dependencies in requirements.txt
# (fastapi, uvicorn, rq, redis)
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system -r requirements.txt

COPY . .
