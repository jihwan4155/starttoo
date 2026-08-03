from __future__ import annotations

from fastapi import Request

from api_server.core.event_log import EventLog
from api_server.services.tattoo_extractor import TattooExtractorService
from api_server.services.tattoo_generator import TattooGeneratorService
from api_server.services.tattoo_classifier import TattooClassifierService


def get_extractor_service(request: Request) -> TattooExtractorService:
    return request.app.state.extractor_service


def get_generator_service(request: Request) -> TattooGeneratorService:
    return request.app.state.generator_service


def get_classifier_service(request: Request) -> TattooClassifierService:
    return request.app.state.classifier_service


def get_event_log(request: Request) -> EventLog:
    return request.app.state.event_log
