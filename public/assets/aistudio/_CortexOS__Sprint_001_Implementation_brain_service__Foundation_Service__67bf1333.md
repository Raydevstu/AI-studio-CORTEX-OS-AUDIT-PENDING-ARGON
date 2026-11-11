Sprint 001 Implementation
brain-service (Foundation Service)
This will be the first production service in CortexOS.
Purpose:
Plain Text
Store
Retrieve
Link
Search
Classify
Synchronize
Everything eventually interacts with brain-service.
Repository Structure
Plain Text
services/
 
brain-service/
 
├── app/
│
├── api/
│
├── core/
│
├── models/
│
├── schemas/
│
├── services/
│
├── repositories/
│
├── graph/
│
├── wiki/
│
├── search/
│
├── events/
│
├── workers/
│
└── tests/
Service Boundaries
brain-service owns:
Plain Text
Projects
 
Artifacts
 
Entities
 
Concepts
 
Decisions
 
Sources
 
Relationships
 
Search
 
Wiki
 
Graph
brain-service does NOT own:
Plain Text
UI
 
War Room
 
Studios
 
Jarvis
 
Agent Execution
Those are downstream consumers.
Domain Model
TypeScript
Project
Artifact
Source
Entity
Concept
Decision
Meeting
Task
Studio
Agent
Doctrine
Pattern
Playbook
Core Database Tables
SQL
projects
artifacts
sources
entities
concepts
decisions
meetings
tasks
relationships
studios
agents
CortexOS Canonical Artifact
Most systems treat files as blobs.
CortexOS should treat them as first-class intelligence.
Python
Artifact
 
id
title
type
project_id
 
summary
 
source_refs
 
entity_refs
 
concept_refs
 
relationships
 
created_by
 
created_at
updated_at
Examples:
Plain Text
PRD
 
Architecture Diagram
 
OpenAPI Spec
 
Wireframe
 
User Story
 
Database Schema
 
Deployment Guide
All become Artifacts.
Event Model
Every action becomes an event.
Python
SourceCreated
 
ArtifactCreated
 
ProjectCreated
 
DecisionCreated
 
MeetingCreated
 
TaskCreated
 
RelationshipCreated
Event flow:
Plain Text
Input
│
▼
 
Event Bus
 
│
▼
 
Librarian Workers
 
│
▼
 
Wiki
 
Graph
 
Search
 
Audit
First FastAPI Routes
Projects
Plain Text
POST /projects
GET /projects
GET /projects/{id}
PATCH /projects/{id}
Artifacts
Plain Text
POST /artifacts
GET /artifacts
GET /artifacts/{id}
Sources
Plain Text
POST /sources
GET /sources
GET /sources/{id}
Search
Plain Text
GET /search?q=
Graph
Plain Text
GET /graph/node/{id}
 
GET /graph/project/{id}
 
GET /graph/subgraph/{id}
Chief Librarian MVP
First implementation capabilities:
Source Ingestion
Plain Text
PDF
 
Markdown
 
Docx
 
GitHub Repository
 
URL
 
Transcript
Entity Extraction
Example:
Plain Text
OpenAI
 
Stripe
 
FastAPI
 
CortexOS
 
Postgres
become:
Plain Text
Entities
Concept Extraction
Example:
Plain Text
Agent Routing
 
Multi Agent Systems
 
RAG
 
Knowledge Graph
 
Event Driven Architecture
become:
Plain Text
Concepts
Relationship Extraction
Plain Text
FastAPI
 
USES
 
Postgres
Plain Text
Project Alpha
 
CONTAINS
 
PRD
Plain Text
Architecture Studio
 
CREATED
 
OpenAPI Spec
Studio Architecture
Every studio follows the same contract:
Plain Text
studio/
 
mission.md
 
agent.md
 
rules.md
 
constraints.md
 
skills/
 
templates/
 
playbooks/
 
tools/
 
memory/
First Studio
Build only one.
Plain Text
Design Studio
Why?
Because it exercises the entire system:
Plain Text
Research
 
Patterns
 
Templates
 
Assets
 
Memory
 
Outputs
without the complexity of code execution.
Design Studio Artifacts
Plain Text
Wireframes
 
Design Systems
 
User Flows
 
Screen Maps
 
UI Components
 
Accessibility Checklists
Automatically sent to:
Plain Text
Chief Librarian
for ingestion.
Jarvis Interface Contract
Even before Jarvis exists, define the API.
Python
class WorkRequest:
 
project_id: UUID
 
objective: str
 
studio: str
 
context_ids: list[str]
 
constraints: list[str]
Future flow:
Plain Text
User
 
↓
 
Jarvis
 
↓
 
Studio
 
↓
 
Artifacts
 
↓
 
Chief Librarian
 
↓
 
Brain
Knowledge Graph V1
Nodes:
Plain Text
Project
 
Artifact
 
Entity
 
Concept
 
Decision
 
Studio
 
Agent
 
Task
 
Meeting
Edges:
Plain Text
CONTAINS
 
CREATED_BY
 
OWNED_BY
 
DEPENDS_ON
 
REFERENCES
 
IMPLEMENTS
 
LINKS_TO
 
SUPERSEDES
First Implementation Sprint Backlog
Epic 1
Brain Foundation
Plain Text
Create FastAPI service
 
Create Postgres schema
 
Create SQLAlchemy models
 
Create Alembic migrations
Epic 2
Librarian Core
Plain Text
Source ingestion
 
Entity extraction
 
Concept extraction
 
Relationship extraction
Epic 3
Knowledge Layer
Plain Text
Wiki generation
 
Graph synchronization
 
Search indexing
Epic 4
Design Studio
Plain Text
Studio framework
 
Studio memory
 
Templates
 
Output contracts
Recommendation
At this point the very next concrete engineering deliverable is:
Plain Text
brain-service/
├── FastAPI application
├── SQLAlchemy models
├── Alembic migration set
├── Pydantic schemas
├── Artifact ingestion pipeline
└── Chief Librarian worker
This becomes the first real CortexOS production service and the foundation that every future component, including Jarvis, Studios, the LLM Wiki, the Second Brain and the War Room, will depend on.