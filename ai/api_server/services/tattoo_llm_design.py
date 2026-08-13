from __future__ import annotations

import asyncio
import io
import logging
import re
import time
from dataclasses import dataclass

from PIL import Image

from api_server.core.exceptions import (
    LlmGenerationFailedError,
    LlmNotConfiguredError,
)
from api_server.services.tattoo_generator import STYLE_EXTRAS

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class LlmGenerationResult:
    content: bytes
    width: int
    height: int
    processing_seconds: float


# Long-form style descriptions for the GMS/Gemini prompts (NOT the SD1.5 LoRA
# trigger phrases in tattoo_generator.STYLE_PHRASES -- an LLM benefits from a
# detailed description where the LoRA just needs its trained trigger word).
# Built from the actual secondary_style distribution in
# tattoo-generator-model's data/extracted/manifest.csv, so each description
# reflects the real range of the training data instead of one stereotype
# (e.g. 'japanese' is not just waves -- neo_japanese outnumbers
# traditional_irezumi there, and both cover far more than water motifs).
STYLE_DESCRIPTIONS: dict[str, str] = {
    "realism": (
        "realism tattoo style: highly detailed, lifelike rendering with "
        "photographic depth and smooth gradients. Spans micro-realism (small, "
        "extremely fine detail), photorealism, illustrative realism, chicano "
        "black-and-grey realism, portrait realism, and surreal realism (realistic "
        "rendering with a dreamlike or impossible twist)."
    ),
    "minimal": (
        "minimalist fine line tattoo style: a single thin continuous black "
        "line, no shading, no fill, no crosshatching, no heavy detail. Simple, "
        "delicate linework with generous negative space -- reads as small and "
        "subtle even at large canvas size."
    ),
    "geometric_ornamental": (
        "geometric and ornamental tattoo style: spans precise mandalas and "
        "sacred-geometry patterns, low-poly polygonal faceted shapes, "
        "filigree/lace-like ornamental linework, dense repeating geometric "
        "patterns, and floral ornamental motifs -- sometimes the subject itself "
        "is faceted into geometric shapes rather than just framed by them."
    ),
    "graphic_illustrative": (
        "graphic illustrative tattoo style: bold, clean illustrative linework "
        "with selective shading -- closer to naturalist scientific illustration, "
        "editorial/magazine illustration, folk or naive art, or dark gothic "
        "illustrative art than to a photograph. Strong confident outlines, "
        "picture-book rendering rather than painterly realism."
    ),
    "new_school": (
        "new school tattoo style: exaggerated cartoonish proportions, bold "
        "thick black outlines, vibrant saturated full color. Ranges from "
        "classic pop-art-energy new school and comic-style cartoon rendering to "
        "cute kawaii/anime-manga character styling."
    ),
    "tribal_indigenous": (
        "tribal tattoo style: bold solid black high-contrast shapes with no "
        "shading. Spans modern neo-tribal abstract curving forms, Polynesian "
        "tribal patterns (thick flowing black linework), and Celtic knotwork / "
        "interlace patterns."
    ),
    "western_traditional": (
        "western (American) traditional tattoo style: bold thick black "
        "outlines, a classic limited color palette (red, green, yellow, blue, "
        "black), flat bold color fills with little gradient. Ranges from bold "
        "simple American traditional (Sailor Jerry-era) to more detailed, "
        "shaded neo-traditional rendering of the same iconography."
    ),
    "japanese": (
        "japanese irezumi tattoo style, rooted in traditional Japanese ink "
        "painting and ukiyo-e woodblock print aesthetics -- this is NOT limited "
        "to water/wave motifs. It spans traditional irezumi (bold black "
        "outlines, flowing color washes, classic motifs such as dragons, koi, "
        "tigers, snakes, samurai, geisha, oni demons, cherry blossoms, "
        "chrysanthemums, peonies) and neo-japanese (a cleaner, more "
        "contemporary illustrative take on the same imagery). Whatever the "
        "subject is, render it WITH the decorative flowing background "
        "elements characteristic of Japanese woodblock art (clouds, wind bars, "
        "florals, or waves are options among many, not a requirement)."
    ),
    "abstract_experimental": (
        "abstract experimental tattoo style: non-representational or loosely "
        "representational forms. Spans gestural brushstroke-like abstract "
        "marks, geometric abstraction, fluid organic flowing shapes, "
        "surrealist dreamlike distortion, and futuristic glyph/sigil-like "
        "symbols. Artistic freeform interpretation rather than a literal "
        "depiction of the subject."
    ),
}


def _style_description(item: str) -> str | None:
    return STYLE_DESCRIPTIONS.get(item)


_HANGUL_RE = re.compile(r"[가-힣]")


def _build_lettering_prompt(styles: list[str], text: str) -> str:
    # Without an explicit stylistic anchor, Gemini defaults to a plain,
    # maximally-legible sans-serif block font -- "bold, clearly legible" is
    # true of ordinary typography too, so it never actually asks for a
    # TATTOO-specific lettering look. Latin-script "tattoo lettering" fonts
    # (cursive script, gothic/blackletter, chicano) don't carry over to
    # Hangul (no cursive-joining convention), so Korean text gets a brush
    # calligraphy description instead of "joined cursive letters".
    if _HANGUL_RE.search(text):
        default_look = (
            "a bold hand-brushed calligraphic tattoo lettering style -- thick "
            "expressive ink-brush strokes with natural taper and texture, like "
            "traditional East Asian brush calligraphy reinterpreted for a "
            "tattoo (NOT a plain digital font, NOT a generic sans-serif block "
            "typeface)"
        )
    else:
        default_look = (
            "a stylized tattoo script lettering font -- flowing cursive with "
            "joined/connected letters, elegant thick-and-thin brush-like "
            "strokes, and subtle decorative flourishes on the ascenders/"
            "descenders (NOT a plain digital font, NOT a generic sans-serif "
            "block typeface)"
        )
    others = [item for item in styles if item != "lettering"]
    other_desc = _style_description(others[0]) if others else None
    style_hint = f" Blend that lettering look with this style: {other_desc}" if other_desc else ""
    return (
        f'Create a tattoo design of the text "{text}" rendered in {default_look}.'
        f"{style_hint} The lettering must stay clearly legible. Black ink on a "
        "plain solid white background, no border, no frame, no mockup, no "
        "skin, centered composition."
    )


def _build_reference_prompt(styles: list[str], user_prompt: str) -> str:
    """The reference photo supplies the SUBJECT (e.g. a photo of a dog) --
    this is not 'redraw this existing tattoo', it's 'turn this subject into a
    tattoo design in the chosen style', mirroring build_prompt()'s text+style
    flow in tattoo_generator.py. 'lettering' has no meaning for a photo
    subject, so it's excluded (normalize_styles still governs validity; the
    route only reaches here for non-lettering styles or no style at all)."""
    descriptions = [d for d in (_style_description(item) for item in styles) if d]
    style_text = (
        " combined with ".join(descriptions) if descriptions else "clean black ink tattoo"
    )
    extras = [STYLE_EXTRAS[item] for item in styles if item in STYLE_EXTRAS]
    direction = user_prompt.strip()

    instructions = (
        "Look at the main subject in the attached reference photo. Create an "
        f"original tattoo design of that exact subject, reinterpreted in this "
        f"style -- {style_text} -- as a finished tattoo design on a plain "
        "solid white background. Do not reproduce the photo itself or trace "
        "its lines -- redraw the subject as tattoo artwork in the requested "
        "style, with linework/shading/color appropriate to that style. No "
        "skin, no photograph, no background scenery, no frame, no mockup, "
        "centered composition."
    )
    if extras:
        instructions += " " + ", ".join(extras) + "."
    if direction:
        instructions += f" Additional direction: {direction}"
    return instructions


class TattooLlmDesignService:
    """Routes lettering and reference-image requests to SSAFY GMS (a Gemini
    image model behind a proxy) instead of the local SD1.5 LoRA. SD1.5 can't
    render legible text, and as of the v4 LoRA 'lettering' is dropped from
    training entirely (see tattoo-generator-model's scripts/build_style_captions.py),
    so those requests -- and reference-image variation, which the local LoRA
    never supported -- go through this service instead."""

    def __init__(self, api_key: str | None, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model = model
        self._client = None

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    def ensure_configured(self) -> None:
        if not self.configured:
            raise LlmNotConfiguredError(
                "GMS_API_KEY가 설정되지 않아 lettering/참조이미지 생성을 사용할 수 없습니다."
            )

    def _client_instance(self):
        if self._client is None:
            from google import genai

            self._client = genai.Client(
                api_key=self._api_key,
                http_options={"base_url": self._base_url},
            )
        return self._client

    async def generate_lettering(
        self, *, prompt: str, style: list[str]
    ) -> LlmGenerationResult:
        self.ensure_configured()
        text_prompt = _build_lettering_prompt(style, prompt)
        return await asyncio.to_thread(self._generate_sync, text_prompt, None)

    async def generate_from_reference(
        self, *, prompt: str, style: list[str], reference_image: bytes
    ) -> LlmGenerationResult:
        self.ensure_configured()
        text_prompt = _build_reference_prompt(style, prompt)
        return await asyncio.to_thread(
            self._generate_sync, text_prompt, reference_image
        )

    def _generate_sync(
        self, text_prompt: str, reference_image: bytes | None
    ) -> LlmGenerationResult:
        started = time.perf_counter()
        try:
            from google.genai import types

            contents: list = []
            if reference_image is not None:
                contents.append(
                    types.Part.from_bytes(
                        data=reference_image, mime_type="image/png"
                    )
                )
            contents.append(text_prompt)

            response = self._client_instance().models.generate_content(
                model=self._model,
                contents=contents,
            )
            image_bytes = self._extract_image(response)
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            output = io.BytesIO()
            image.save(output, format="PNG", optimize=True)
            return LlmGenerationResult(
                content=output.getvalue(),
                width=image.width,
                height=image.height,
                processing_seconds=time.perf_counter() - started,
            )
        except LlmNotConfiguredError:
            raise
        except Exception as exc:
            logger.exception("GMS image generation failed")
            raise LlmGenerationFailedError(
                f"GMS 이미지 생성 중 오류가 발생했습니다: {exc}"
            ) from exc

    @staticmethod
    def _extract_image(response) -> bytes:
        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                inline = getattr(part, "inline_data", None)
                data = getattr(inline, "data", None)
                if data:
                    return data
        raise LlmGenerationFailedError("GMS 응답에서 이미지 데이터를 찾을 수 없습니다.")
