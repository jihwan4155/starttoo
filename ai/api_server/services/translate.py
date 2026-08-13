"""Korean -> English translation for user prompts, SD1.5 path only.

Why this exists: CLIP's tokenizer (SD1.5's text encoder) has no meaningful
Korean vocabulary, so a Korean subject prompt like "늑대" is effectively noise
to the model. This translates it to "wolf" before it reaches build_prompt().

Where this must NOT be applied:
  - 'lettering' requests: `prompt` is literal text to render on the design,
    not a subject -- translating it would change what the user wants
    tattooed. (lettering never reaches TattooGeneratorService anyway --
    routes/generation.py sends it to TattooLlmDesignService instead -- but
    keep the guard here too in case this service is ever called directly.)
  - GMS/Gemini requests (lettering, reference-image): Gemini already
    understands Korean natively and better than this small local model would
    translate it, so tattoo_llm_design.py intentionally does NOT call this.

Model: Helsinki-NLP/opus-mt-ko-en (~300MB, downloaded once via
huggingface_hub cache on first use). Loaded lazily so importing this module
has no cost until a Korean prompt actually shows up. Uses the tokenizer/model
directly rather than transformers' high-level pipeline() -- newer transformers
versions dropped the "translation" task alias from the pipeline registry.
"""

from __future__ import annotations

import re

_MODEL_NAME = "Helsinki-NLP/opus-mt-ko-en"
_tokenizer = None
_model = None
_HANGUL_RE = re.compile(r"[가-힣]")


def is_korean(text: str) -> bool:
    return bool(_HANGUL_RE.search(text))


def _load() -> None:
    global _tokenizer, _model
    if _model is None:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        _tokenizer = AutoTokenizer.from_pretrained(_MODEL_NAME)
        _model = AutoModelForSeq2SeqLM.from_pretrained(_MODEL_NAME)


def translate_ko_to_en(text: str) -> str:
    """No-op if `text` has no Hangul (avoids loading the model for the
    common English-prompt case)."""
    if not text or not is_korean(text):
        return text

    _load()
    batch = _tokenizer([text], return_tensors="pt", padding=True, truncation=True)
    generated = _model.generate(**batch, max_length=512)
    return _tokenizer.decode(generated[0], skip_special_tokens=True).strip()
