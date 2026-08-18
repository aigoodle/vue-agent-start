/**
 * `client.workflows` — workflow draft/publish for apps plus the standalone
 * workflow endpoints the visual designer's host glue used to hand-roll
 * (`/workflows`, `/workflows/run-graph`, `/node-types`, `/workflow-examples`).
 */
import type {
  WorkflowEntityLite,
  WorkflowGraphLike,
} from '../agent-studio/adapters/types';
import { qs, type ExtraRequestOptions, type HttpCore } from './core';

/** Wire shape of a standalone workflow row (list/create). */
export interface WorkflowEntityWire {
  id: string;
  appId?: string;
  name?: string;
  mode?: string;
  graph?: WorkflowGraphLike | Record<string, unknown> | null;
  version?: string;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: unknown;
}

/** POST /workflows body. */
export interface CreateWorkflowRequest {
  appId: string;
  name?: string;
  mode?: string;
  graph?: WorkflowGraphLike | Record<string, unknown>;
  [k: string]: unknown;
}

/** POST /workflows/run-graph body. */
export interface RunGraphRequest {
  graph: WorkflowGraphLike | Record<string, unknown>;
  /** Workflow START-node input values. */
  data?: Record<string, unknown>;
  /** @deprecated Use data. Retained for older callers. */
  inputs?: Record<string, unknown>;
  [k: string]: unknown;
}

/** Wire shape returned by /workflows/run-graph. */
export interface RunGraphResultWire {
  success?: boolean;
  error?: string;
  outputs?: Record<string, unknown>;
  steps?: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

/** Node-type metadata row from /node-types. */
export interface NodeTypeMetaWire {
  type: string;
  [k: string]: unknown;
}

/** Example workflow row from /workflow-examples. */
export interface WorkflowExampleWire {
  id?: string;
  name?: string;
  graph?: WorkflowGraphLike | Record<string, unknown>;
  [k: string]: unknown;
}

export interface WorkflowsNamespace {
  // ---- app-scoped draft/publish (agent-studio drawer)
  /** GET /apps/{appId}/workflow/draft. */
  getDraft(appId: string): Promise<WorkflowEntityLite>;
  /** PUT /apps/{appId}/workflow/draft. */
  saveDraft(appId: string, graph: WorkflowGraphLike): Promise<WorkflowEntityLite>;
  /** POST /apps/{appId}/workflow/publish. */
  publishDraft(appId: string): Promise<WorkflowEntityLite>;
  /** GET /apps/{appId}/workflows — draft plus immutable published snapshots. */
  listByApp(appId: string): Promise<WorkflowEntityWire[]>;
  /** POST /apps/{appId}/workflow/restore/{snapshotId}. */
  restoreSnapshot(appId: string, snapshotId: string): Promise<WorkflowEntityLite>;

  // ---- standalone workflow registry (visual designer)
  /** GET /workflows. */
  list(query?: Record<string, string | number | undefined>): Promise<WorkflowEntityWire[]>;
  /** POST /workflows — save/upsert (backend requires appId). */
  create(req: CreateWorkflowRequest): Promise<WorkflowEntityWire>;
  /** POST /workflows/run-graph — dry-run a graph without persisting. */
  runGraph(req: RunGraphRequest): Promise<RunGraphResultWire>;
  /**
   * POST /workflows/run-graph/stream — dry-run a graph and stream each node's
   * result as it completes. Resolves the raw SSE `Response`; the caller owns
   * body streaming (iterate with `readSseEvents`). Pass `opts.signal` to abort
   * mid-run — once the headers arrive no timeout covers the body, so
   * cancellation is only possible through the signal.
   */
  runGraphStream(req: RunGraphRequest, opts?: ExtraRequestOptions): Promise<Response>;
  /** GET /node-types — engine node metadata. */
  listNodeTypes(): Promise<NodeTypeMetaWire[]>;
  /** GET /workflow-examples. */
  listExamples(): Promise<WorkflowExampleWire[]>;
}

export function createWorkflowsNamespace(core: HttpCore): WorkflowsNamespace {
  return {
    getDraft: (appId) =>
      core.request<WorkflowEntityLite>(
        `/apps/${encodeURIComponent(appId)}/workflow/draft`,
      ),
    saveDraft: (appId, graph) =>
      core.request<WorkflowEntityLite>(
        `/apps/${encodeURIComponent(appId)}/workflow/draft`,
        { method: 'PUT', body: JSON.stringify({ graph }) },
      ),
    publishDraft: (appId) =>
      core.request<WorkflowEntityLite>(
        `/apps/${encodeURIComponent(appId)}/workflow/publish`,
        { method: 'POST', body: JSON.stringify({}) },
      ),
    listByApp: (appId) =>
      core.request<WorkflowEntityWire[]>(
        `/apps/${encodeURIComponent(appId)}/workflows`,
      ),
    restoreSnapshot: (appId, snapshotId) =>
      core.request<WorkflowEntityLite>(
        `/apps/${encodeURIComponent(appId)}/workflow/restore/${encodeURIComponent(snapshotId)}`,
        { method: 'POST' },
      ),

    list: (query) => core.request<WorkflowEntityWire[]>(`/workflows${qs(query ?? {})}`),
    create: (req) =>
      core.request<WorkflowEntityWire>('/workflows', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    runGraph: (req) =>
      core.request<RunGraphResultWire>('/workflows/run-graph', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    runGraphStream: (req, opts) =>
      core.raw(
        '/workflows/run-graph/stream',
        {
          method: 'POST',
          headers: { Accept: 'text/event-stream' },
          body: JSON.stringify(req),
        },
        opts,
      ),
    listNodeTypes: () => core.request<NodeTypeMetaWire[]>('/node-types'),
    listExamples: () => core.request<WorkflowExampleWire[]>('/workflow-examples'),
  };
}
