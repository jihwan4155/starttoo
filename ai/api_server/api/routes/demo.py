from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter(tags=["demo"])
DEMO_PAGE = Path(__file__).resolve().parents[2] / "web" / "demo.html"


@router.get(
    "/demo",
    response_class=FileResponse,
    include_in_schema=False,
)
async def demo() -> FileResponse:
    return FileResponse(DEMO_PAGE, media_type="text/html; charset=utf-8")
