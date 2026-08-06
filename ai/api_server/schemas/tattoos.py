from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

# 배치 항목의 판별 결과. 백엔드가 재시도 여부를 판단하는 근거이므로
# "타투 아님"(종료)과 "처리 실패"(재시도 대상)를 반드시 구분해서 내려준다.
TattooBatchStatus = Literal["TATTOO", "NOT_TATTOO", "FAILED"]


class TattooImageRequest(BaseModel):
    image_url: HttpUrl = Field(alias="imageUrl")


class TattooBatchImageItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    image_seq: int | None = Field(default=None, alias="imageSeq", gt=0)
    image_url: HttpUrl = Field(alias="imageUrl")
    design_object_key: str | None = Field(
        default=None,
        alias="designObjectKey",
        min_length=1,
        max_length=512,
    )
    design_upload_url: HttpUrl | None = Field(default=None, alias="designUploadUrl")

    @model_validator(mode="after")
    def validate_design_upload_target(self) -> "TattooBatchImageItem":
        has_object_key = self.design_object_key is not None
        has_upload_url = self.design_upload_url is not None
        if has_object_key != has_upload_url:
            raise ValueError(
                "designObjectKey and designUploadUrl must be provided together."
            )
        if has_object_key and self.image_seq is None:
            raise ValueError("imageSeq is required when a design upload target is provided.")
        return self


class TattooBatchImageRequest(BaseModel):
    items: list[TattooBatchImageItem] = Field(min_length=1, max_length=10)


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


class TattooDesignResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    object_key: str = Field(serialization_alias="objectKey")


class TattooBatchAnalysisResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    image_seq: int | None = Field(default=None, serialization_alias="imageSeq")
    status: TattooBatchStatus
    analysis: TattooAnalysisResponse | None = None
    design: TattooDesignResponse | None = None


class TattooBatchAnalysisResponse(BaseModel):
    results: list[TattooBatchAnalysisResult]
