/**
 * createAgentStudioSpringBackend — returns the full callback bag the two
 * top-level agent pages (AgentAppsPage / AgentChatPage) need, backed by the
 * spring-agent-web-starter REST endpoints under {@code baseUrl}.
 *
 *   import {
 *     AgentAppsPage,
 *     createAgentStudioSpringBackend,
 *   } from 'vue-agent-start';
 *
 *   <AgentAppsPage :api="createAgentStudioSpringBackend({ baseUrl: '/api' })" />
 *
 * The bag is a superset of {@link AppStudioApi} (drawer / annotation / monitor
 * / api-key panels) with the extra CRUD + streaming methods the list page uses.
 * Hosts that want a totally custom backend can implement {@link AgentStudioApi}
 * directly instead.
 */
import type { AppStudioApi } from '../api';

// ---------------------------------------------------------------------------
// Types — mirror the shapes emitted by spring-agent-web-starter. Copies of
// what used to live under `#/api/agent-start/*` in the host app. Kept flat here
// so the whole adapter is one drop-in file.
// ---------------------------------------------------------------------------

export type AgentStrategy = 'FUNCTION_CALLING' | 'PLAN_EXECUTE' | 'REACT';

export type AppMode =
  | 'agent'
  | 'chat'
  | 'chatflow'
  | 'completion'
  | 'workflow';

export interface AgentEntity {
  id: string;
  tenantId?: string;
  name: string;
  description?: string;
  icon?: string;
  iconBackground?: string;
  mode?: AppMode;
  instructions?: string;
  openingStatement?: string;
  suggestedQuestionsJson?: string;
  datasetIdsJson?: string;
  retrievalConfigJson?: string;
  workflowId?: string;
  modelName?: string;
  modelProvider?: string;
  modelSettingsJson?: string;
  strategy?: AgentStrategy;
  toolNamesJson?: string;
  approvalToolsJson?: string;
  delegateAgentIdsJson?: string;
  maxIterations?: number;
  memoryEnabled?: boolean;
  memoryWindow?: number;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAgentRequest {
  tenantId?: string;
  name: string;
  description?: string;
  icon?: string;
  iconBackground?: string;
  mode?: AppMode;
  instructions?: string;
  openingStatement?: string;
  suggestedQuestions?: string[];
  datasetIds?: string[];
  retrievalConfig?: Record<string, unknown>;
  modelName?: string;
  modelProvider?: string;
  strategy?: AgentStrategy;
  toolNames?: string[];
  approvalRequiredTools?: string[];
  delegateAgentIds?: string[];
  maxIterations?: number;
  memoryEnabled?: boolean;
  memoryWindow?: number;
  published?: boolean;
  modelSettings?: Record<string, unknown>;
}

export interface AgentToolView {
  name: string;
  description: string;
  inputSchema?: string;
}

export interface AgentHistoryMessage {
  role: 'ASSISTANT' | 'SYSTEM' | 'USER';
  content: string;
}

export interface ConversationSummary {
  conversationId: string;
  name?: string;
  userId?: null | string;
  firstMessage?: string;
  updatedAt?: string;
  pinned?: boolean;
}

export interface ChatRequest {
  query: string;
  conversationId?: string;
  variables?: Record<string, unknown>;
}

export interface DatasetLite {
  id: string;
  name: string;
  description?: string;
}

export interface ModelLite {
  id: string;
  providerName: string;
  modelName: string;
  modelType?: string;
  enabled?: boolean;
  isDefault?: boolean;
}

export interface ToolLite {
  name: string;
  description: string;
}

export interface WorkflowGraphLike {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

export interface WorkflowEntityLite {
  id: string;
  appId?: string;
  name?: string;
  mode?: string;
  graph?: WorkflowGraphLike | Record<string, unknown> | null;
  version?: string;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Full API bag consumed by AgentAppsPage / AgentChatPage. Extends
 * {@link AppStudioApi} so an instance passed to the page also drives the
 * drawer's built-in panels.
 */
export interface AgentStudioApi extends AppStudioApi {
  // agent CRUD
  listAgents(): Promise<AgentEntity[]>;
  getAgent(id: string): Promise<AgentEntity>;
  createAgent(req: CreateAgentRequest): Promise<AgentEntity>;
  updateAgent(id: string, req: CreateAgentRequest): Promise<AgentEntity>;
  deleteAgent(id: string): Promise<void>;

  // chat runtime
  fetchAgentTools(id: string): Promise<AgentToolView[]>;
  chatStream(id: string, req: ChatRequest): Promise<Response>;
  fetchConversations(agentId: string, limit?: number): Promise<ConversationSummary[]>;
  fetchHistoryMessages(
    agentId: string,
    conversationId: string,
    limit?: number,
  ): Promise<AgentHistoryMessage[]>;

  // drawer dropdown data
  listDatasets(): Promise<DatasetLite[]>;
  listModels(type?: string): Promise<ModelLite[]>;
  listTools(): Promise<ToolLite[]>;

  // workflow draft/publish (chatflow / workflow modes)
  getWorkflowDraft(appId: string): Promise<WorkflowEntityLite>;
  saveWorkflowDraft(appId: string, graph: WorkflowGraphLike): Promise<WorkflowEntityLite>;
  publishWorkflowDraft(appId: string): Promise<WorkflowEntityLite>;

  /** Raw base URL — components may append their own paths (e.g. copy-curl). */
  baseUrl: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

type FetchLike = typeof fetch;
type HeadersProvider = () =>
  | Record<string, string>
  | Promise<Record<string, string>>;

export interface AgentStudioAdapterOptions {
  /** Backend base URL. Default: `/api`. */
  baseUrl?: string;
  fetch?: FetchLike;
  headers?: HeadersProvider;
  onError?(msg: string): void;
  onSuccess?(msg: string): void;
  timeoutMs?: number;
}

interface Envelope<T> {
  code: string;
  message?: string;
  data: T;
}

export function createAgentStudioSpringBackend(
  opts: AgentStudioAdapterOptions = {},
): AgentStudioApi {
  const baseUrl = (opts.baseUrl ?? '/api').replace(/\/+$/, '');
  const doFetch: FetchLike = opts.fetch ?? ((...args) => fetch(...args));
  const timeoutMs = opts.timeoutMs ?? 60_000;

  async function extraHeaders(): Promise<Record<string, string>> {
    return opts.headers ? await opts.headers() : {};
  }

  function qs(params?: Record<string, unknown>): string {
    if (!params) return '';
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v == null) continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }

  async function call<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(await extraHeaders()),
        ...((init.headers as Record<string, string>) ?? {}),
      };
      const res = await doFetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) msg = body.message;
        } catch {
          // ignore body-parse errors
        }
        opts.onError?.(msg);
        throw new Error(msg);
      }
      const env = (await res.json()) as Envelope<T>;
      if (env.code !== 'ok') {
        const msg = env.message ?? env.code;
        opts.onError?.(msg);
        throw new Error(msg);
      }
      return env.data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    baseUrl,

    // ---- agent CRUD --------------------------------------------------------
    listAgents: () => call<AgentEntity[]>('/agents'),
    getAgent: (id) => call<AgentEntity>(`/agents/${id}`),
    createAgent: (req) =>
      call<AgentEntity>('/agents', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    updateAgent: (id, req) =>
      call<AgentEntity>(`/agents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(req),
      }),
    deleteAgent: (id) =>
      call<void>(`/agents/${id}`, { method: 'DELETE' }),

    // ---- chat runtime ------------------------------------------------------
    fetchAgentTools: (id) => call<AgentToolView[]>(`/agents/${id}/tools`),
    chatStream: async (id, req) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(await extraHeaders()),
      };
      return doFetch(`${baseUrl}/agents/${id}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
      });
    },
    fetchConversations: (agentId, limit = 100) =>
      call<ConversationSummary[]>(`/chat/conversations/${agentId}`, {
        method: 'POST',
        body: JSON.stringify({ limit }),
      }),
    fetchHistoryMessages: (agentId, conversationId, limit = 500) =>
      call<AgentHistoryMessage[]>(
        `/chat/conversations/${agentId}/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ limit }),
        },
      ),

    // ---- drawer dropdown data ---------------------------------------------
    listDatasets: () =>
      call<DatasetLite[]>('/datasets').catch(() => []),
    listModels: (type = 'LLM') =>
      call<ModelLite[]>(`/models${qs({ type })}`).catch(() => []),
    listTools: () =>
      call<ToolLite[]>('/tools').catch(() => []),

    // ---- workflow draft/publish -------------------------------------------
    getWorkflowDraft: (appId) =>
      call<WorkflowEntityLite>(`/apps/${appId}/workflow/draft`),
    saveWorkflowDraft: (appId, graph) =>
      call<WorkflowEntityLite>(`/apps/${appId}/workflow/draft`, {
        method: 'PUT',
        body: JSON.stringify({ graph }),
      }),
    publishWorkflowDraft: (appId) =>
      call<WorkflowEntityLite>(`/apps/${appId}/workflow/publish`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),

    // ---- AppStudioApi bag (drawer panels) ---------------------------------
    listConversations: (appId, limit = 100) =>
      call('/chat/conversations/' + appId, {
        method: 'POST',
        body: JSON.stringify({ limit }),
      }),
    fetchHistory: (appId, conversationId, limit = 500) =>
      call(`/chat/conversations/${appId}/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ limit }),
      }),

    listAnnotations: (appId) => call(`/apps/${appId}/annotations`),
    createAnnotation: (appId, req) =>
      call(`/apps/${appId}/annotations`, {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    updateAnnotation: (appId, id, req) =>
      call(`/apps/${appId}/annotations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(req),
      }),
    deleteAnnotation: (appId, id) =>
      call<void>(`/apps/${appId}/annotations/${id}`, { method: 'DELETE' }),

    fetchAppMetrics: (appId) => call(`/apps/${appId}/metrics`),
    fetchLlmUsage: () => call('/llmops/total'),
    fetchRecentLlmCalls: (limit = 50) =>
      call(`/llmops/recent${qs({ limit })}`),

    listApiKeys: (appId) => call(`/apps/${appId}/api-tokens`),
    createApiKey: (appId, name) =>
      call(`/apps/${appId}/api-tokens`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    renameApiKey: (appId, id, name) =>
      call(`/apps/${appId}/api-tokens/${id}/rename`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    deleteApiKey: (appId, id) =>
      call<void>(`/apps/${appId}/api-tokens/${id}`, { method: 'DELETE' }),
  };
}
