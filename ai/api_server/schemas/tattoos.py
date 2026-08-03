from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class TattooImageRequest(BaseModel):
    image_url: HttpUrl = Field(alias="imageUrl")


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
