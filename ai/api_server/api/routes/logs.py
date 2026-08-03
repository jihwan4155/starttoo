from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from api_server.api.dependencies import get_event_log
from api_server.core.event_log import EventLog

router = APIRouter(prefix="/logs", tags=["system"])


@router.get(
    "",
    summary="최근 AI 서버 이벤트 로그",
)
async def recent_logs(
    limit: int = Query(default=50, ge=1, le=300),
    event_log: EventLog = Depends(get_event_log),
) -> dict[str, Any]:
    events = event_log.recent(limit)
    return {
        "count": len(events),
        "events": events,
    }
