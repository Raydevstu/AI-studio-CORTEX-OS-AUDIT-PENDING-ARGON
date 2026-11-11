-- =====================================================================
-- CortexOS Brain Schema v1
-- Target: PostgreSQL 15+ with pgvector and pg_trgm
-- Status: DRAFT, not yet run against a live database. Run it on a scratch
--         database first and fix anything the server rejects.
--
-- Design rules
--   1. Postgres is the only datastore in v1. Graph = relationships table.
--      Vectors = pgvector. Events = outbox table. No Neo4j/Qdrant/Redis yet.
--   2. Raw sources are immutable. Content is addressed by SHA-256.
--   3. Every derived claim carries provenance (claims table).
--   4. Wiki text lives in git-versioned markdown files; this DB holds
--      metadata, versions, provenance and review state.
--   5. Rules and constraints of a studio are files owned by humans. This
--      schema never stores them, and the Librarian has no write path to them.
--
-- Reconciled vocabulary (the planning documents disagreed)
--   Object types (11): project, source, artifact, entity, concept, decision,
--     meeting, task, agent, studio, wiki_page.
--   Doctrine / pattern / playbook / summary are wiki_page_type values, not
--     object types. People are entities with entity_type = 'person'.
--   Edge types (13): LINKS_TO from the planning docs is folded into
--     'references'; 'mentions' and 'blocks' are added.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy entity matching

-- ---------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------
CREATE TYPE object_type AS ENUM (
  'project', 'source', 'artifact', 'entity', 'concept', 'decision',
  'meeting', 'task', 'agent', 'studio', 'wiki_page'
);

CREATE TYPE edge_type AS ENUM (
  'created_by', 'contains', 'part_of', 'depends_on', 'references',
  'implements', 'influences', 'derived_from', 'owned_by', 'uses',
  'supersedes', 'blocks', 'mentions'
);

CREATE TYPE review_state    AS ENUM ('unreviewed', 'needs_review', 'approved', 'rejected');
CREATE TYPE source_kind     AS ENUM ('markdown', 'url', 'pdf', 'docx', 'transcript', 'repo', 'agent_output', 'other');
CREATE TYPE trust_level     AS ENUM ('trusted', 'untrusted');
CREATE TYPE ingest_status   AS ENUM ('received', 'processing', 'processed', 'failed');
CREATE TYPE project_status  AS ENUM ('active', 'paused', 'archived');
CREATE TYPE artifact_status AS ENUM ('draft', 'in_review', 'approved', 'superseded', 'rejected');
CREATE TYPE decision_status AS ENUM ('proposed', 'accepted', 'superseded', 'rejected');
CREATE TYPE task_status     AS ENUM ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
CREATE TYPE work_status     AS ENUM ('queued', 'running', 'awaiting_approval', 'done', 'failed', 'cancelled');
CREATE TYPE wiki_page_type  AS ENUM ('entity', 'concept', 'decision', 'doctrine', 'pattern', 'playbook', 'summary', 'project');
CREATE TYPE event_status    AS ENUM ('pending', 'processing', 'done', 'failed', 'dead');
CREATE TYPE actor_type      AS ENUM ('user', 'agent', 'system');
CREATE TYPE finding_type    AS ENUM (
  'duplicate_concept', 'conflicting_architecture', 'orphan_page',
  'broken_reference', 'stale_document', 'missing_summary', 'contradiction'
);
CREATE TYPE finding_status  AS ENUM ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE FUNCTION forbid_modification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: table is append-only', TG_OP, TG_TABLE_NAME;
END $$;

-- ---------------------------------------------------------------------
-- Universal object registry
-- Every first-class thing has a row here, so relationships can use real
-- foreign keys instead of a polymorphic (type, id) pair.
-- Insert pattern:
--   INSERT INTO projects (id, slug, name) VALUES (new_object('project'), 'crm', 'AI CRM');
-- ---------------------------------------------------------------------
CREATE TABLE brain_objects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type object_type NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, object_type)
);

CREATE FUNCTION new_object(t object_type) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO brain_objects (object_type) VALUES (t) RETURNING id
$$;

-- ---------------------------------------------------------------------
-- Projects, studios, agents, work requests
-- ---------------------------------------------------------------------
CREATE TABLE projects (
  id          uuid           PRIMARY KEY,
  object_type object_type    NOT NULL DEFAULT 'project' CHECK (object_type = 'project'),
  slug        text           NOT NULL UNIQUE,
  name        text           NOT NULL,
  description text           NOT NULL DEFAULT '',
  status      project_status NOT NULL DEFAULT 'active',
  created_at  timestamptz    NOT NULL DEFAULT now(),
  updated_at  timestamptz    NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE
);

CREATE TABLE studios (
  id               uuid        PRIMARY KEY,
  object_type      object_type NOT NULL DEFAULT 'studio' CHECK (object_type = 'studio'),
  slug             text        NOT NULL UNIQUE,            -- 'design', 'architecture', ...
  name             text        NOT NULL,
  mission          text        NOT NULL DEFAULT '',
  status           text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  manifest_path    text,                                   -- studios/<slug>/studio.yaml
  manifest_version text,
  manifest_hash    char(64)    CHECK (manifest_hash IS NULL OR manifest_hash ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE
);

CREATE TABLE agents (
  id          uuid        PRIMARY KEY,
  object_type object_type NOT NULL DEFAULT 'agent' CHECK (object_type = 'agent'),
  studio_id   uuid        NOT NULL REFERENCES studios (id),
  name        text        NOT NULL,
  role        text        NOT NULL DEFAULT '',
  model       text,                                        -- model identifier, decided per agent
  config      jsonb       NOT NULL DEFAULT '{}',
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE
);
CREATE INDEX agents_studio_idx ON agents (studio_id);

-- Jarvis -> studio contract. context_ids are brain_objects ids (not FK-enforced:
-- arrays cannot carry foreign keys; the service layer validates them).
CREATE TABLE work_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects (id),
  studio_id    uuid        NOT NULL REFERENCES studios (id),
  objective    text        NOT NULL,
  context_ids  uuid[]      NOT NULL DEFAULT '{}',
  constraints  text[]      NOT NULL DEFAULT '{}',
  status       work_status NOT NULL DEFAULT 'queued',
  requested_by text        NOT NULL DEFAULT 'jarvis',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX work_requests_project_idx ON work_requests (project_id, status);

-- ---------------------------------------------------------------------
-- Sources: immutable raw evidence (Layer 1)
-- trust = 'untrusted' by default: ingested content is data, never instructions.
-- ---------------------------------------------------------------------
CREATE TABLE sources (
  id            uuid          PRIMARY KEY,
  object_type   object_type   NOT NULL DEFAULT 'source' CHECK (object_type = 'source'),
  project_id    uuid          REFERENCES projects (id),     -- NULL = global source
  kind          source_kind   NOT NULL,
  title         text          NOT NULL,
  uri           text,
  storage_path  text          NOT NULL,                     -- where the raw copy lives
  content_hash  char(64)      NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  mime_type     text,
  byte_size     bigint        CHECK (byte_size IS NULL OR byte_size >= 0),
  trust         trust_level   NOT NULL DEFAULT 'untrusted',
  ingest_status ingest_status NOT NULL DEFAULT 'received',
  ingest_error  text,
  metadata      jsonb         NOT NULL DEFAULT '{}',
  ingested_at   timestamptz   NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE
);
-- Deduplicate by content within a project, and among global sources.
CREATE UNIQUE INDEX sources_project_hash_uq ON sources (project_id, content_hash) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX sources_global_hash_uq  ON sources (content_hash)             WHERE project_id IS NULL;
CREATE INDEX sources_ingest_idx ON sources (ingest_status);

CREATE FUNCTION sources_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.uri          IS DISTINCT FROM OLD.uri
     OR NEW.kind         IS DISTINCT FROM OLD.kind
     OR NEW.byte_size    IS DISTINCT FROM OLD.byte_size
     OR NEW.project_id   IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'sources are immutable; only ingest_status, ingest_error, metadata, trust and title may change';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sources_immutable_trg BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION sources_immutable();

-- ---------------------------------------------------------------------
-- Artifacts: typed, versioned agent outputs (Layer 2)
-- body holds the structured payload, validated by the service against the
-- JSON schema registered for (artifact_type, schema_version).
-- ---------------------------------------------------------------------
CREATE TABLE artifacts (
  id                  uuid            PRIMARY KEY,
  object_type         object_type     NOT NULL DEFAULT 'artifact' CHECK (object_type = 'artifact'),
  project_id          uuid            NOT NULL REFERENCES projects (id),
  studio_id           uuid            REFERENCES studios (id),
  work_request_id     uuid            REFERENCES work_requests (id),
  artifact_type       text            NOT NULL,              -- 'prd', 'openapi_spec', 'wireframe', ...
  schema_version      text            NOT NULL DEFAULT '1',
  title               text            NOT NULL,
  summary             text            NOT NULL DEFAULT '',
  status              artifact_status NOT NULL DEFAULT 'draft',
  version             integer         NOT NULL DEFAULT 1 CHECK (version >= 1),
  supersedes_id       uuid            REFERENCES artifacts (id),
  storage_path        text            NOT NULL,
  content_hash        char(64)        NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  body                jsonb,
  created_by_agent_id uuid            REFERENCES agents (id),
  approved_by         text,
  approved_at         timestamptz,
  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE,
  CHECK (status <> 'approved' OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)),
  UNIQUE (project_id, artifact_type, title, version)
);
CREATE INDEX artifacts_project_idx ON artifacts (project_id, artifact_type, status);

-- ---------------------------------------------------------------------
-- Knowledge objects extracted by the Librarian
-- merged_into_id makes entity resolution non-destructive: a duplicate is
-- pointed at its survivor instead of being deleted.
-- ---------------------------------------------------------------------
CREATE TABLE entities (
  id             uuid         PRIMARY KEY,
  object_type    object_type  NOT NULL DEFAULT 'entity' CHECK (object_type = 'entity'),
  canonical_name text         NOT NULL,
  entity_type    text         NOT NULL,                      -- 'organization', 'technology', 'person', 'service', ...
  description    text         NOT NULL DEFAULT '',
  aliases        text[]       NOT NULL DEFAULT '{}',
  metadata       jsonb        NOT NULL DEFAULT '{}',
  review_state   review_state NOT NULL DEFAULT 'unreviewed',
  confidence     real         NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  merged_into_id uuid         REFERENCES entities (id),
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE,
  CHECK (merged_into_id IS NULL OR merged_into_id <> id)
);
CREATE UNIQUE INDEX entities_name_uq ON entities (entity_type, lower(canonical_name)) WHERE merged_into_id IS NULL;
CREATE INDEX entities_name_trgm ON entities USING gin (canonical_name gin_trgm_ops);
CREATE INDEX entities_aliases_gin ON entities USING gin (aliases);

CREATE TABLE concepts (
  id             uuid         PRIMARY KEY,
  object_type    object_type  NOT NULL DEFAULT 'concept' CHECK (object_type = 'concept'),
  name           text         NOT NULL,
  summary        text         NOT NULL DEFAULT '',
  domain         text,
  aliases        text[]       NOT NULL DEFAULT '{}',
  review_state   review_state NOT NULL DEFAULT 'unreviewed',
  confidence     real         NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  merged_into_id uuid         REFERENCES concepts (id),
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE,
  CHECK (merged_into_id IS NULL OR merged_into_id <> id)
);
CREATE UNIQUE INDEX concepts_name_uq ON concepts (lower(name)) WHERE merged_into_id IS NULL;
CREATE INDEX concepts_name_trgm ON concepts USING gin (name gin_trgm_ops);

CREATE TABLE decisions (
  id            uuid            PRIMARY KEY,
  object_type   object_type     NOT NULL DEFAULT 'decision' CHECK (object_type = 'decision'),
  project_id    uuid            NOT NULL REFERENCES projects (id),
  title         text            NOT NULL,
  decision      text            NOT NULL,
  reasoning     text            NOT NULL DEFAULT '',
  status        decision_status NOT NULL DEFAULT 'proposed',
  supersedes_id uuid            REFERENCES decisions (id),
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz     NOT NULL DEFAULT now(),
  updated_at    timestamptz     NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE,
  CHECK (status <> 'accepted' OR decided_at IS NOT NULL)
);
CREATE INDEX decisions_project_idx ON decisions (project_id, status);

CREATE TABLE meetings (
  id          uuid        PRIMARY KEY,
  object_type object_type NOT NULL DEFAULT 'meeting' CHECK (object_type = 'meeting'),
  project_id  uuid        REFERENCES projects (id),
  title       text        NOT NULL,
  occurred_at timestamptz,
  summary     text        NOT NULL DEFAULT '',
  source_id   uuid        REFERENCES sources (id),        -- the transcript
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE
);

CREATE TABLE tasks (
  id                uuid        PRIMARY KEY,
  object_type       object_type NOT NULL DEFAULT 'task' CHECK (object_type = 'task'),
  project_id        uuid        NOT NULL REFERENCES projects (id),
  title             text        NOT NULL,
  description       text        NOT NULL DEFAULT '',
  status            task_status NOT NULL DEFAULT 'todo',
  assignee_agent_id uuid        REFERENCES agents (id),
  artifact_id       uuid        REFERENCES artifacts (id),
  due_at            timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE
);
CREATE INDEX tasks_project_idx ON tasks (project_id, status);

-- ---------------------------------------------------------------------
-- Wiki (Layer 3): metadata here, markdown body in git under wiki/<path>
-- ---------------------------------------------------------------------
CREATE TABLE wiki_pages (
  id                uuid           PRIMARY KEY,
  object_type       object_type    NOT NULL DEFAULT 'wiki_page' CHECK (object_type = 'wiki_page'),
  page_type         wiki_page_type NOT NULL,
  path              text           NOT NULL UNIQUE,         -- e.g. 'concepts/rag.md'
  title             text           NOT NULL,
  summary           text           NOT NULL DEFAULT '',
  project_id        uuid           REFERENCES projects (id),
  current_version   integer        NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  body_hash         char(64)       CHECK (body_hash IS NULL OR body_hash ~ '^[0-9a-f]{64}$'),
  review_state      review_state   NOT NULL DEFAULT 'unreviewed',
  requires_approval boolean        NOT NULL DEFAULT false,
  created_at        timestamptz    NOT NULL DEFAULT now(),
  updated_at        timestamptz    NOT NULL DEFAULT now(),
  FOREIGN KEY (id, object_type) REFERENCES brain_objects (id, object_type) ON DELETE CASCADE,
  CHECK (page_type <> 'doctrine' OR requires_approval)      -- doctrine always needs a human
);
CREATE INDEX wiki_pages_type_idx ON wiki_pages (page_type, review_state);

CREATE TABLE wiki_page_versions (
  page_id        uuid        NOT NULL REFERENCES wiki_pages (id) ON DELETE CASCADE,
  version        integer     NOT NULL CHECK (version >= 1),
  body_hash      char(64)    NOT NULL CHECK (body_hash ~ '^[0-9a-f]{64}$'),
  commit_ref     text,                                       -- git commit of the markdown file
  change_summary text        NOT NULL DEFAULT '',
  actor_type     actor_type  NOT NULL,
  actor_id       text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_id, version)
);

-- What agents may read: pages that need approval are hidden until approved.
CREATE VIEW agent_visible_wiki_pages AS
  SELECT * FROM wiki_pages
  WHERE review_state <> 'rejected'
    AND (NOT requires_approval OR review_state = 'approved');

-- ---------------------------------------------------------------------
-- Provenance: every wiki claim points to evidence
-- ---------------------------------------------------------------------
CREATE TABLE claims (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_page_id uuid         NOT NULL REFERENCES wiki_pages (id) ON DELETE CASCADE,
  page_version integer,
  claim_text   text         NOT NULL,
  source_id    uuid         REFERENCES sources (id),
  artifact_id  uuid         REFERENCES artifacts (id),
  locator      text,                                         -- line range, URL fragment, timestamp
  confidence   real         NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  review_state review_state NOT NULL DEFAULT 'unreviewed',
  created_at   timestamptz  NOT NULL DEFAULT now(),
  CHECK (source_id IS NOT NULL OR artifact_id IS NOT NULL)   -- no evidence, no claim
);
CREATE INDEX claims_page_idx   ON claims (wiki_page_id);
CREATE INDEX claims_source_idx ON claims (source_id);

-- ---------------------------------------------------------------------
-- Graph (Layer 4): relationships between any two objects
-- ---------------------------------------------------------------------
CREATE TABLE relationships (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id       uuid         NOT NULL REFERENCES brain_objects (id) ON DELETE CASCADE,
  to_id         uuid         NOT NULL REFERENCES brain_objects (id) ON DELETE CASCADE,
  edge_type     edge_type    NOT NULL,
  confidence    real         NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  review_state  review_state NOT NULL DEFAULT 'unreviewed',
  source_id     uuid         REFERENCES sources (id),        -- evidence for this edge
  metadata      jsonb        NOT NULL DEFAULT '{}',
  created_at    timestamptz  NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  CHECK (from_id <> to_id)
);
CREATE UNIQUE INDEX relationships_active_uq ON relationships (from_id, to_id, edge_type) WHERE superseded_at IS NULL;
CREATE INDEX relationships_from_idx ON relationships (from_id) WHERE superseded_at IS NULL;
CREATE INDEX relationships_to_idx   ON relationships (to_id)   WHERE superseded_at IS NULL;

-- Neighbourhood walk in both directions, cycle-safe. Replaces a graph
-- database for v1: graph_neighbors('<uuid>', 2).
CREATE FUNCTION graph_neighbors(start_id uuid, max_depth integer DEFAULT 2)
RETURNS TABLE (object_id uuid, depth integer) LANGUAGE sql STABLE AS $$
  WITH RECURSIVE walk (object_id, depth, path) AS (
    SELECT start_id, 0, ARRAY[start_id]
    UNION ALL
    SELECT n.next_id, w.depth + 1, w.path || n.next_id
    FROM walk w
    CROSS JOIN LATERAL (
      SELECT CASE WHEN r.from_id = w.object_id THEN r.to_id ELSE r.from_id END AS next_id
      FROM relationships r
      WHERE (r.from_id = w.object_id OR r.to_id = w.object_id)
        AND r.superseded_at IS NULL
        AND r.review_state <> 'rejected'
    ) n
    WHERE w.depth < max_depth
      AND NOT (n.next_id = ANY (w.path))
  )
  SELECT walk.object_id, min(walk.depth) AS depth
  FROM walk
  WHERE walk.depth > 0
  GROUP BY walk.object_id
$$;

-- ---------------------------------------------------------------------
-- Search: chunks with a vector and a keyword index (hybrid search)
-- vector(1536) must match the embedding model chosen. Change it before the
-- first migration if the model differs; changing later needs a re-embed.
-- ---------------------------------------------------------------------
CREATE TABLE embeddings (
  object_id    uuid         NOT NULL REFERENCES brain_objects (id) ON DELETE CASCADE,
  chunk_index  integer      NOT NULL DEFAULT 0,
  model        text         NOT NULL,
  content_hash char(64)     NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  chunk_text   text         NOT NULL,
  embedding    vector(1536) NOT NULL,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (object_id, chunk_index, model)
);
CREATE INDEX embeddings_vec_idx ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX embeddings_fts_idx ON embeddings USING gin (to_tsvector('english', chunk_text));

-- ---------------------------------------------------------------------
-- Events: transactional outbox. Write the domain row and its event in the
-- same transaction, so a crash cannot lose the event.
-- ---------------------------------------------------------------------
CREATE TABLE events (
  id              bigserial    PRIMARY KEY,
  event_type      text         NOT NULL,       -- source_created, artifact_created, ...
  aggregate_type  object_type,
  aggregate_id    uuid,
  payload         jsonb        NOT NULL DEFAULT '{}',
  idempotency_key text         NOT NULL UNIQUE,
  status          event_status NOT NULL DEFAULT 'pending',
  attempts        integer      NOT NULL DEFAULT 0,
  max_attempts    integer      NOT NULL DEFAULT 5,
  available_at    timestamptz  NOT NULL DEFAULT now(),
  locked_by       text,
  locked_at       timestamptz,
  last_error      text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  processed_at    timestamptz
);
CREATE INDEX events_ready_idx ON events (available_at, id) WHERE status IN ('pending', 'failed');

-- Workers call: SELECT * FROM claim_events('worker-1', 10);
-- then mark each row done, or failed (with last_error and a later available_at).
CREATE FUNCTION claim_events(worker text, batch integer DEFAULT 10)
RETURNS SETOF events LANGUAGE sql AS $$
  UPDATE events
     SET status = 'processing', locked_by = worker, locked_at = now(), attempts = attempts + 1
   WHERE id IN (
     SELECT id FROM events
      WHERE status IN ('pending', 'failed')
        AND available_at <= now()
        AND attempts < max_attempts
      ORDER BY id
      FOR UPDATE SKIP LOCKED
      LIMIT batch)
  RETURNING *
$$;

-- Recover events whose worker died mid-flight.
CREATE FUNCTION requeue_stale_events(older_than interval DEFAULT interval '10 minutes')
RETURNS integer LANGUAGE sql AS $$
  WITH r AS (
    UPDATE events
       SET status = CASE WHEN attempts >= max_attempts THEN 'dead'::event_status ELSE 'pending'::event_status END,
           locked_by = NULL, locked_at = NULL
     WHERE status = 'processing' AND locked_at < now() - older_than
    RETURNING 1)
  SELECT count(*)::integer FROM r
$$;

-- ---------------------------------------------------------------------
-- Audit log (append-only) and Librarian audit findings
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id          bigserial   PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type  actor_type  NOT NULL,
  actor_id    text        NOT NULL,
  action      text        NOT NULL,                -- 'wiki.update', 'artifact.approve', 'tool.call', ...
  object_id   uuid,
  details     jsonb       NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_log_object_idx ON audit_log (object_id, occurred_at);
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_modification();

CREATE TABLE audit_findings (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_type finding_type   NOT NULL,
  object_id    uuid           REFERENCES brain_objects (id) ON DELETE CASCADE,
  details      jsonb          NOT NULL DEFAULT '{}',
  status       finding_status NOT NULL DEFAULT 'open',
  created_at   timestamptz    NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  text
);
CREATE INDEX audit_findings_open_idx ON audit_findings (finding_type) WHERE status = 'open';

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'projects', 'studios', 'agents', 'work_requests', 'artifacts',
    'entities', 'concepts', 'decisions', 'tasks', 'wiki_pages'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_set_updated_at', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Seed: the seven studios (agents are registered from studio manifests)
-- ---------------------------------------------------------------------
INSERT INTO studios (id, slug, name, mission)
SELECT new_object('studio'), s.slug, s.name, s.mission
FROM (VALUES
  ('discovery',    'Discovery Studio',    'Validate the problem, the market and the users.'),
  ('product',      'Product Studio',      'Turn validated opportunities into a buildable plan.'),
  ('design',       'Design Studio',       'Own everything user-facing: UX, UI, flows and design systems.'),
  ('architecture', 'Architecture Studio', 'Own system, data, API, infrastructure and security design.'),
  ('development',  'Development Studio',  'Build the product: frontend, backend, integrations.'),
  ('qa',           'QA Studio',           'Prove the product works and is safe.'),
  ('release',      'Release Studio',      'Ship, monitor, measure and feed results back.')
) AS s (slug, name, mission);

-- ---------------------------------------------------------------------
-- Deployment note (not enforced here): run the Librarian under a database
-- role with no UPDATE or DELETE on audit_log and no access outside brain
-- tables. Rules and constraints of studios are files, never rows.
-- ---------------------------------------------------------------------
