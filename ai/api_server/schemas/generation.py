from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GenerateTattooRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "prompt": "a koi fish and cherry blossoms",
                    "style": ["japanese"],
                    "seed": 42,
                    "steps": 30,
                    "guidance": 7.5,
                    "size": 1024,
                }
            ]
        }
    )

    prompt: str = Field(
        min_length=1,
        max_length=500,
        description=(
            "생성할 대상. lettering 스타일에서는 출력할 문구로 사용됩니다."
        ),
        examples=["a koi fish and cherry blossoms"],
    )
    style: list[str] | None = Field(
        default=None,
        max_length=2,
        description="GET /api/v1/generate/styles에 있는 스타일을 최대 2개 선택",
        examples=[["japanese"]],
    )
    seed: int | None = Field(
        default=None,
        ge=0,
        le=4_294_967_295,
        description="같은 결과를 재현할 난수 시드. 생략하면 서버가 생성합니다.",
        examples=[42],
    )
    steps: int = Field(
        default=30,
        ge=1,
        le=100,
        description="생성 반복 횟수. 기본값은 30입니다.",
    )
    guidance: float = Field(default=7.5, ge=0, le=30)
    size: Literal[512, 768, 1024] = Field(
        default=1024,
        description="정사각형 PNG 크기. 기본값은 1024×1024입니다.",
    )

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        prompt = value.strip()
        if not prompt:
            raise ValueError("prompt는 공백일 수 없습니다.")
        return prompt


class TattooStylesResponse(BaseModel):
    styles: list[str]
    max_styles: int
