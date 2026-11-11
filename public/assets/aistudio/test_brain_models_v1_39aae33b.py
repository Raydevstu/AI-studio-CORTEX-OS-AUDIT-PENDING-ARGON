"""Smoke tests for brain_models_v1. Run with: pytest test_brain_models_v1.py
Not yet run (pytest and pydantic were not available when this was written)."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from brain_models_v1 import (
    Artifact, ClaimCreate, EdgeType, EventCreate, EventType, ExtractionResult,
    ObjectType, RelationshipCreate, WikiPage, WikiPageType, sha256_hex,
)

NOW = datetime.now(timezone.utc)
H = sha256_hex(b"hello")


def test_sha256_is_64_hex():
    assert len(H) == 64


def test_claim_needs_evidence():
    with pytest.raises(ValidationError):
        ClaimCreate(wiki_page_id=uuid4(), claim_text="FastAPI uses Pydantic")
    ClaimCreate(wiki_page_id=uuid4(), claim_text="FastAPI uses Pydantic", source_id=uuid4())


def test_relationship_rejects_self_loop():
    x = uuid4()
    with pytest.raises(ValidationError):
        RelationshipCreate(from_id=x, to_id=x, edge_type=EdgeType.uses)


def test_doctrine_requires_approval():
    base = dict(id=uuid4(), page_type=WikiPageType.doctrine, path="doctrines/auth.md",
                title="Auth doctrine", created_at=NOW, updated_at=NOW)
    with pytest.raises(ValidationError):
        WikiPage(**base)
    page = WikiPage(**base, requires_approval=True)
    assert page.visible_to_agents is False  # hidden until approved


def test_approved_artifact_needs_approver():
    base = dict(id=uuid4(), project_id=uuid4(), artifact_type="prd", title="PRD",
                storage_path="artifacts/prd.md", content_hash=H, created_at=NOW,
                updated_at=NOW, status="approved")
    with pytest.raises(ValidationError):
        Artifact(**base)
    Artifact(**base, approved_by="owner", approved_at=NOW)


def test_event_key_is_deterministic():
    oid = uuid4()
    a = EventCreate.for_object(EventType.source_created, ObjectType.source, oid)
    b = EventCreate.for_object(EventType.source_created, ObjectType.source, oid)
    assert a.idempotency_key == b.idempotency_key


def test_extraction_rejects_unknown_relationship_names():
    ent = dict(name="FastAPI", entity_type="technology", evidence="uses FastAPI", confidence=0.9)
    rel = dict(from_name="FastAPI", to_name="Postgres", edge_type="uses",
               evidence="FastAPI with Postgres", confidence=0.8)
    with pytest.raises(ValidationError):
        ExtractionResult(source_id=uuid4(), summary="s", entities=[ent], relationships=[rel])
