"""CortexOS Brain Data Model v1: Pydantic v2 models.

Mirrors brain_schema_v1.sql one to one. Status: draft, written against
Pydantic 2.x and Python 3.10+; not yet run against a live database.

Conventions
  * `Row` models describe a database row (what the API returns).
  * `Create` models describe what a caller supplies; the database fills ids,
    timestamps and defaults.
  * Validators repeat the SQL CHECK constraints so bad data fails early,
    before it reaches the database.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from enum import Enum
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

# ---------------------------------------------------------------------
# Shared types
# ---------------------------------------------------------------------
Sha256Hex = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
Confidence = Annotated[float, Field(ge=0.0, le=1.0)]


def sha256_hex(data: bytes) -> str:
    """Content address used for sources, artifacts and wiki bodies."""
    return hashlib.sha256(data).hexdigest()


class BrainModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


# ---------------------------------------------------------------------
# Enumerations (values match the SQL enums exactly)
# ---------------------------------------------------------------------
class ObjectType(str, Enum):
    project = "project"
    source = "source"
    artifact = "artifact"
    entity = "entity"
    concept = "concept"
    decision = "decision"
    meeting = "meeting"
    task = "task"
    agent = "agent"
    studio = "studio"
    wiki_page = "wiki_page"


class EdgeType(str, Enum):
    created_by = "created_by"
    contains = "contains"
    part_of = "part_of"
    depends_on = "depends_on"
    references = "references"
    implements = "implements"
    influences = "influences"
    derived_from = "derived_from"
    owned_by = "owned_by"
    uses = "uses"
    supersedes = "supersedes"
    blocks = "blocks"
    mentions = "mentions"


class ReviewState(str, Enum):
    unreviewed = "unreviewed"
    needs_review = "needs_review"
    approved = "approved"
    rejected = "rejected"


class SourceKind(str, Enum):
    markdown = "markdown"
    url = "url"
    pdf = "pdf"
    docx = "docx"
    transcript = "transcript"
    repo = "repo"
    agent_output = "agent_output"
    other = "other"


class TrustLevel(str, Enum):
    trusted = "trusted"
    untrusted = "untrusted"


class IngestStatus(str, Enum):
    received = "received"
    processing = "processing"
    processed = "processed"
    failed = "failed"


class ProjectStatus(str, Enum):
    active = "active"
    paused = "paused"
    archived = "archived"


class ArtifactStatus(str, Enum):
    draft = "draft"
    in_review = "in_review"
    approved = "approved"
    superseded = "superseded"
    rejected = "rejected"


class DecisionStatus(str, Enum):
    proposed = "proposed"
    accepted = "accepted"
    superseded = "superseded"
    rejected = "rejected"


class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    blocked = "blocked"
    done = "done"
    cancelled = "cancelled"


class WorkStatus(str, Enum):
    queued = "queued"
    running = "running"
    awaiting_approval = "awaiting_approval"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


class WikiPageType(str, Enum):
    entity = "entity"
    concept = "concept"
    decision = "decision"
    doctrine = "doctrine"
    pattern = "pattern"
    playbook = "playbook"
    summary = "summary"
    project = "project"


class EventStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"
    dead = "dead"


class ActorType(str, Enum):
    user = "user"
    agent = "agent"
    system = "system"


class FindingType(str, Enum):
    duplicate_concept = "duplicate_concept"
    conflicting_architecture = "conflicting_architecture"
    orphan_page = "orphan_page"
    broken_reference = "broken_reference"
    stale_document = "stale_document"
    missing_summary = "missing_summary"
    contradiction = "contradiction"


class FindingStatus(str, Enum):
    open = "open"
    resolved = "resolved"
    dismissed = "dismissed"


class EventType(str, Enum):
    """Event names used on the outbox (the planning docs' CamelCase, snake-cased)."""

    source_created = "source_created"
    artifact_created = "artifact_created"
    project_created = "project_created"
    decision_created = "decision_created"
    meeting_created = "meeting_created"
    task_created = "task_created"
    relationship_created = "relationship_created"
    work_request_created = "work_request_created"
    work_request_completed = "work_request_completed"
    wiki_page_updated = "wiki_page_updated"


# ---------------------------------------------------------------------
# Projects, studios, agents, work requests
# ---------------------------------------------------------------------
class ProjectCreate(BrainModel):
    slug: str = Field(min_length=1, pattern=r"^[a-z0-9][a-z0-9-]*$")
    name: str = Field(min_length=1)
    description: str = ""


class Project(ProjectCreate):
    id: UUID
    status: ProjectStatus = ProjectStatus.active
    created_at: datetime
    updated_at: datetime


class Studio(BrainModel):
    id: UUID
    slug: str
    name: str
    mission: str = ""
    status: str = Field(default="active", pattern=r"^(active|disabled)$")
    manifest_path: str | None = None
    manifest_version: str | None = None
    manifest_hash: Sha256Hex | None = None
    created_at: datetime
    updated_at: datetime


class Agent(BrainModel):
    id: UUID
    studio_id: UUID
    name: str
    role: str = ""
    model: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    active: bool = True
    created_at: datetime
    updated_at: datetime


class WorkRequestCreate(BrainModel):
    """Jarvis -> studio contract."""

    project_id: UUID
    studio_id: UUID
    objective: str = Field(min_length=1)
    context_ids: list[UUID] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    requested_by: str = "jarvis"


class WorkRequest(WorkRequestCreate):
    id: UUID
    status: WorkStatus = WorkStatus.queued
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


# ---------------------------------------------------------------------
# Sources and artifacts
# ---------------------------------------------------------------------
class SourceCreate(BrainModel):
    project_id: UUID | None = None
    kind: SourceKind
    title: str = Field(min_length=1)
    uri: str | None = None
    storage_path: str = Field(min_length=1)
    content_hash: Sha256Hex
    mime_type: str | None = None
    byte_size: int | None = Field(default=None, ge=0)
    trust: TrustLevel = TrustLevel.untrusted
    metadata: dict[str, Any] = Field(default_factory=dict)


class Source(SourceCreate):
    id: UUID
    ingest_status: IngestStatus = IngestStatus.received
    ingest_error: str | None = None
    ingested_at: datetime


class ArtifactCreate(BrainModel):
    project_id: UUID
    studio_id: UUID | None = None
    work_request_id: UUID | None = None
    artifact_type: str = Field(min_length=1)
    schema_version: str = "1"
    title: str = Field(min_length=1)
    summary: str = ""
    version: int = Field(default=1, ge=1)
    supersedes_id: UUID | None = None
    storage_path: str = Field(min_length=1)
    content_hash: Sha256Hex
    body: dict[str, Any] | None = None
    created_by_agent_id: UUID | None = None


class Artifact(ArtifactCreate):
    id: UUID
    status: ArtifactStatus = ArtifactStatus.draft
    approved_by: str | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def approved_needs_approver(self) -> "Artifact":
        if self.status == ArtifactStatus.approved and not (self.approved_by and self.approved_at):
            raise ValueError("an approved artifact needs approved_by and approved_at")
        return self


# ---------------------------------------------------------------------
# Knowledge objects
# ---------------------------------------------------------------------
class Entity(BrainModel):
    id: UUID
    canonical_name: str = Field(min_length=1)
    entity_type: str = Field(min_length=1)
    description: str = ""
    aliases: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    review_state: ReviewState = ReviewState.unreviewed
    confidence: Confidence = 1.0
    merged_into_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def not_merged_into_self(self) -> "Entity":
        if self.merged_into_id == self.id:
            raise ValueError("an entity cannot be merged into itself")
        return self


class Concept(BrainModel):
    id: UUID
    name: str = Field(min_length=1)
    summary: str = ""
    domain: str | None = None
    aliases: list[str] = Field(default_factory=list)
    review_state: ReviewState = ReviewState.unreviewed
    confidence: Confidence = 1.0
    merged_into_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def not_merged_into_self(self) -> "Concept":
        if self.merged_into_id == self.id:
            raise ValueError("a concept cannot be merged into itself")
        return self


class Decision(BrainModel):
    id: UUID
    project_id: UUID
    title: str = Field(min_length=1)
    decision: str = Field(min_length=1)
    reasoning: str = ""
    status: DecisionStatus = DecisionStatus.proposed
    supersedes_id: UUID | None = None
    decided_by: str | None = None
    decided_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def accepted_needs_date(self) -> "Decision":
        if self.status == DecisionStatus.accepted and self.decided_at is None:
            raise ValueError("an accepted decision needs decided_at")
        return self


class Meeting(BrainModel):
    id: UUID
    project_id: UUID | None = None
    title: str = Field(min_length=1)
    occurred_at: datetime | None = None
    summary: str = ""
    source_id: UUID | None = None
    created_at: datetime


class Task(BrainModel):
    id: UUID
    project_id: UUID
    title: str = Field(min_length=1)
    description: str = ""
    status: TaskStatus = TaskStatus.todo
    assignee_agent_id: UUID | None = None
    artifact_id: UUID | None = None
    due_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------
# Wiki and provenance
# ---------------------------------------------------------------------
class WikiPage(BrainModel):
    id: UUID
    page_type: WikiPageType
    path: str = Field(min_length=1, pattern=r"^[a-z0-9][a-z0-9/_-]*\.md$")
    title: str = Field(min_length=1)
    summary: str = ""
    project_id: UUID | None = None
    current_version: int = Field(default=0, ge=0)
    body_hash: Sha256Hex | None = None
    review_state: ReviewState = ReviewState.unreviewed
    requires_approval: bool = False
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def doctrine_needs_approval(self) -> "WikiPage":
        if self.page_type == WikiPageType.doctrine and not self.requires_approval:
            raise ValueError("doctrine pages always require approval")
        return self

    @property
    def visible_to_agents(self) -> bool:
        """Mirrors the agent_visible_wiki_pages view."""
        if self.review_state == ReviewState.rejected:
            return False
        return (not self.requires_approval) or self.review_state == ReviewState.approved


class WikiPageVersion(BrainModel):
    page_id: UUID
    version: int = Field(ge=1)
    body_hash: Sha256Hex
    commit_ref: str | None = None
    change_summary: str = ""
    actor_type: ActorType
    actor_id: str
    created_at: datetime


class ClaimCreate(BrainModel):
    wiki_page_id: UUID
    page_version: int | None = Field(default=None, ge=1)
    claim_text: str = Field(min_length=1)
    source_id: UUID | None = None
    artifact_id: UUID | None = None
    locator: str | None = None
    confidence: Confidence = 1.0

    @model_validator(mode="after")
    def needs_evidence(self) -> "ClaimCreate":
        if self.source_id is None and self.artifact_id is None:
            raise ValueError("a claim needs a source_id or an artifact_id")
        return self


class Claim(ClaimCreate):
    id: UUID
    review_state: ReviewState = ReviewState.unreviewed
    created_at: datetime


# ---------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------
class RelationshipCreate(BrainModel):
    from_id: UUID
    to_id: UUID
    edge_type: EdgeType
    confidence: Confidence = 1.0
    source_id: UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def no_self_loop(self) -> "RelationshipCreate":
        if self.from_id == self.to_id:
            raise ValueError("a relationship cannot point at itself")
        return self


class Relationship(RelationshipCreate):
    id: UUID
    review_state: ReviewState = ReviewState.unreviewed
    created_at: datetime
    superseded_at: datetime | None = None


# ---------------------------------------------------------------------
# Events, audit
# ---------------------------------------------------------------------
class EventCreate(BrainModel):
    event_type: EventType
    aggregate_type: ObjectType | None = None
    aggregate_id: UUID | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field(min_length=1)

    @classmethod
    def for_object(cls, event_type: EventType, object_type: ObjectType, object_id: UUID,
                   payload: dict[str, Any] | None = None) -> "EventCreate":
        """Deterministic key: re-emitting the same fact never creates a second event."""
        return cls(
            event_type=event_type,
            aggregate_type=object_type,
            aggregate_id=object_id,
            payload=payload or {},
            idempotency_key=f"{event_type.value}:{object_id}",
        )


class Event(EventCreate):
    id: int
    status: EventStatus = EventStatus.pending
    attempts: int = 0
    max_attempts: int = 5
    available_at: datetime
    locked_by: str | None = None
    locked_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime
    processed_at: datetime | None = None


class AuditLogEntry(BrainModel):
    id: int
    occurred_at: datetime
    actor_type: ActorType
    actor_id: str
    action: str
    object_id: UUID | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class AuditFinding(BrainModel):
    id: UUID
    finding_type: FindingType
    object_id: UUID | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    status: FindingStatus = FindingStatus.open
    created_at: datetime
    resolved_at: datetime | None = None
    resolved_by: str | None = None


# ---------------------------------------------------------------------
# Librarian extraction contract
# The structured output the LLM must return for one source. Every item
# carries an evidence quote and locator so the Librarian can write claims.
# ---------------------------------------------------------------------
class ExtractedEntity(BrainModel):
    name: str = Field(min_length=1)
    entity_type: str = Field(min_length=1)
    aliases: list[str] = Field(default_factory=list)
    description: str = ""
    evidence: str = Field(min_length=1, description="Verbatim quote from the source")
    locator: str | None = None
    confidence: Confidence


class ExtractedConcept(BrainModel):
    name: str = Field(min_length=1)
    summary: str = ""
    domain: str | None = None
    evidence: str = Field(min_length=1)
    locator: str | None = None
    confidence: Confidence


class ExtractedRelationship(BrainModel):
    from_name: str = Field(min_length=1)
    to_name: str = Field(min_length=1)
    edge_type: EdgeType
    evidence: str = Field(min_length=1)
    locator: str | None = None
    confidence: Confidence


class ExtractionResult(BrainModel):
    """One source in, one validated result out. Reject the whole result if it fails validation."""

    source_id: UUID
    summary: str = Field(min_length=1)
    entities: list[ExtractedEntity] = Field(default_factory=list)
    concepts: list[ExtractedConcept] = Field(default_factory=list)
    relationships: list[ExtractedRelationship] = Field(default_factory=list)

    @model_validator(mode="after")
    def relationships_reference_known_names(self) -> "ExtractionResult":
        known = {e.name.lower() for e in self.entities} | {c.name.lower() for c in self.concepts}
        for r in self.relationships:
            for name in (r.from_name, r.to_name):
                if name.lower() not in known:
                    raise ValueError(f"relationship refers to unknown name: {name!r}")
        return self
