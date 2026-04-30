from fastapi import APIRouter

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)

# Authentication is now handled by Clerk.
# Placeholder for future webhooks or auth sync endpoints.

