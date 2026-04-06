import os
from redis import Redis
from rq import Queue
from app.core.config import settings 

redis_host = settings.REDIS_HOST

queue = Queue(connection=Redis(
    host=redis_host,
    port="6379" # type: ignore
))