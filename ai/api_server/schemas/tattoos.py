from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

# 배치 항목의 판별 결과. 백엔드가 재시도 여부를 판단하는 근거이므로
# "타투 아님"(종료)과 "처리 실패"(재시도 대상)를 반드시 구분해서 내려준다.
TattooBatchStatus = Literal["TATTOO", "NOT_TATTOO", "FAILED"]


class TattooImageRequest(BaseModel):
    image_url: HttpUrl = Field(alias="imageUrl")


class TattooBatchImageRequest(BaseModel):
    image_urls: list[HttpUrl] = Field(alias="imageUrls", min_length=1, max_length=10)


class TattooDetectionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    is_tattoo: bool = Field(serialization_alias="isTattoo")


class TattooAnalysisResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    primary_style_code: str = Field(serialization_alias="primaryStyleCode")
    secondary_style_codes: list[str] = Field(serialization_alias="secondaryStyleCodes")
    rendering_style_codes: list[str] = Field(serialization_alias="renderingStyleCodes")
    color_code: str | None = Field(default=None, serialization_alias="colorCode")
    subjects: list[str]


class TattooBatchAnalysisResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: TattooBatchStatus
    analysis: TattooAnalysisResponse | None = None


class TattooBatchAnalysisResponse(BaseModel):
    results: list[TattooBatchAnalysisResult]
