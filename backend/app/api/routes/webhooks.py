from fastapi import APIRouter, Request, HTTPException, Depends
from svix.webhooks import Webhook, WebhookVerificationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.db.models import User
from app.core.config import settings
import json

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/clerk")
async def clerk_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    if not settings.CLERK_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Clerk webhook secret not configured")

    # Get headers
    svix_id = request.headers.get("svix-id")
    svix_timestamp = request.headers.get("svix-timestamp")
    svix_signature = request.headers.get("svix-signature")

    if not svix_id or not svix_timestamp or not svix_signature:
        raise HTTPException(status_code=400, detail="Missing svix headers")

    payload = await request.body()
    wh = Webhook(settings.CLERK_WEBHOOK_SECRET)

    try:
        event = wh.verify(payload, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature
        })
    except WebhookVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.get("type")
    data = event.get("data", {})

    if event_type == "user.created" or event_type == "user.updated":
        clerk_id = data.get("id")
        email_addresses = data.get("email_addresses", [])
        email = email_addresses[0].get("email_address") if email_addresses else ""
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")
        name = f"{first_name} {last_name}".strip() if first_name or last_name else email

        stmt = select(User).where(User.clerk_id == clerk_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            # user.updated
            user.name = name
            user.email = email
        else:
            # user.created
            new_user = User(
                clerk_id=clerk_id,
                name=name,
                email=email
            )
            db.add(new_user)
        
        await db.commit()

    elif event_type == "user.deleted":
        clerk_id = data.get("id")
        stmt = select(User).where(User.clerk_id == clerk_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            await db.delete(user)
            await db.commit()

    return {"message": "Webhook processed successfully"}
