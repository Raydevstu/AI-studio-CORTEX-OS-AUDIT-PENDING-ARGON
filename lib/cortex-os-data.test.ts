import test from "node:test";
import assert from "node:assert/strict";
import {
  sha256Hex,
  validateClaimCreate,
  validateRelationshipCreate,
  validateWikiPage,
  isWikiPageVisibleToAgents,
  validateArtifact,
  createDeterministicEvent,
  validateExtractionResult,
  findGraphNeighbors,
  canTransitionLifecyclePhase,
  WikiPage,
  Artifact,
  Relationship,
} from "./cortex-os-data";

const NOW = new Date().toISOString();
const H = sha256Hex("hello");

test("sha256Hex produces a 64-character lowercase hex digest", () => {
  assert.equal(H.length, 64);
  assert.match(H, /^[0-9a-f]{64}$/);
});

test("validateClaimCreate enforces source_id or artifact_id evidence", () => {
  assert.throws(
    () =>
      validateClaimCreate({
        wiki_page_id: "wiki-1",
        claim_text: "FastAPI uses Pydantic",
      }),
    /a claim needs a source_id or an artifact_id/
  );

  const valid = validateClaimCreate({
    wiki_page_id: "wiki-1",
    claim_text: "FastAPI uses Pydantic",
    source_id: "src-1",
  });
  assert.equal(valid.confidence, 1.0);
});

test("validateRelationshipCreate rejects self-loops", () => {
  assert.throws(
    () =>
      validateRelationshipCreate({
        from_id: "node-1",
        to_id: "node-1",
        edge_type: "uses",
      }),
    /a relationship cannot point at itself/
  );
});

test("validateWikiPage enforces doctrine requires_approval and agent visibility gate", () => {
  const basePage: WikiPage = {
    id: "wiki-doc-1",
    page_type: "doctrine",
    path: "doctrines/auth.md",
    title: "Auth Doctrine",
    summary: "Zero trust auth rules",
    markdown_body: "# Auth Doctrine",
    current_version: 1,
    body_hash: H,
    review_state: "unreviewed",
    requires_approval: false,
    created_at: NOW,
    updated_at: NOW,
  };

  assert.throws(() => validateWikiPage(basePage), /doctrine pages always require approval/);

  const gatedDoctrine = validateWikiPage({ ...basePage, requires_approval: true });
  assert.equal(isWikiPageVisibleToAgents(gatedDoctrine), false);

  const approvedDoctrine: WikiPage = { ...gatedDoctrine, review_state: "approved" };
  assert.equal(isWikiPageVisibleToAgents(approvedDoctrine), true);
});

test("validateArtifact enforces approved_by and approved_at when status is approved", () => {
  const baseArtifact: Artifact = {
    id: "art-1",
    project_id: "proj-1",
    studio_id: "studio-product",
    artifact_type: "PRD",
    schema_version: "1",
    title: "Technical PRD",
    summary: "Summary",
    status: "approved",
    version: 1,
    storage_path: "artifacts/prd.md",
    content_hash: H,
    body: {},
    markdown_content: "# PRD",
    created_at: NOW,
    updated_at: NOW,
  };

  assert.throws(
    () => validateArtifact(baseArtifact),
    /an approved artifact needs approved_by and approved_at/
  );

  const valid = validateArtifact({
    ...baseArtifact,
    approved_by: "owner",
    approved_at: NOW,
  });
  assert.equal(valid.status, "approved");
});

test("createDeterministicEvent generates identical idempotency keys for same event and object", () => {
  const a = createDeterministicEvent("source_created", "source", "src-123");
  const b = createDeterministicEvent("source_created", "source", "src-123");
  assert.equal(a.idempotency_key, b.idempotency_key);
  assert.equal(a.idempotency_key, "source_created:src-123");
});

test("validateExtractionResult rejects relationships referencing unknown entity/concept names", () => {
  assert.throws(
    () =>
      validateExtractionResult({
        source_id: "src-1",
        summary: "Test extraction",
        entities: [
          {
            name: "FastAPI",
            entity_type: "technology",
            description: "API framework",
            evidence: "uses FastAPI",
            confidence: 0.9,
          },
        ],
        concepts: [],
        relationships: [
          {
            from_name: "FastAPI",
            to_name: "Postgres",
            edge_type: "uses",
            evidence: "FastAPI with Postgres",
            confidence: 0.8,
          },
        ],
      }),
    /relationship refers to unknown name: 'Postgres'/
  );
});

test("findGraphNeighbors performs cycle-safe bidirectional walk and ignores rejected edges", () => {
  const edges: Relationship[] = [
    {
      id: "r1",
      from_id: "A",
      to_id: "B",
      edge_type: "contains",
      confidence: 1,
      review_state: "approved",
      created_at: NOW,
    },
    {
      id: "r2",
      from_id: "B",
      to_id: "C",
      edge_type: "references",
      confidence: 1,
      review_state: "approved",
      created_at: NOW,
    },
    {
      id: "r3",
      from_id: "C",
      to_id: "A",
      edge_type: "influences",
      confidence: 1,
      review_state: "approved",
      created_at: NOW,
    },
    {
      id: "r4",
      from_id: "B",
      to_id: "D",
      edge_type: "uses",
      confidence: 1,
      review_state: "rejected",
      created_at: NOW,
    },
  ];

  const neighbors = findGraphNeighbors("A", edges, 2);
  const byId = Object.fromEntries(neighbors.map((n) => [n.object_id, n.depth]));
  assert.equal(byId["B"], 1);
  assert.equal(byId["C"], 1); // C->A is 1 hop undirected
  assert.equal(byId["D"], undefined); // rejected edge ignored
});

test("canTransitionLifecyclePhase enforces Jarvis quality gates on forward transitions and allows feedback edges", () => {
  const blocked = canTransitionLifecyclePhase("design", "architecture", ["PRD"]);
  assert.equal(blocked.allowed, false);

  const passed = canTransitionLifecyclePhase("design", "architecture", ["PRD", "Wireframe"]);
  assert.equal(passed.allowed, true);

  const feedback = canTransitionLifecyclePhase("qa", "development", []);
  assert.equal(feedback.allowed, true);
});
