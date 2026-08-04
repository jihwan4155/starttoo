from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


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

    is_tattoo: bool = Field(serialization_alias="isTattoo")
    analysis: TattooAnalysisResponse | None = None
    error_code: str | None = Field(default=None, serialization_alias="errorCode")
    error_message: str | None = Field(default=None, serialization_alias="errorMessage")


class TattooBatchAnalysisResponse(BaseModel):
    results: list[TattooBatchAnalysisResult]
