/**
 * createSpringAgentStartAdapter — returns a fully-typed KnowledgeHubApi backed
 * by the spring-agent-start REST endpoints. External consumers of the backend
 * don't have to hand-write the 20-ish methods of the interface.
 *
 *   import { KnowledgeHubApp, createSpringAgentStartAdapter } from '@agent-start/knowledge-hub'
 *
 *   const api = createSpringAgentStartAdapter({
 *     baseUrl: '/api',            // 宿主自己的代理前缀；/agent-start 命名空间由适配器内部拼
 *     fetch: window.fetch,        // or your host's fetch wrapper
 *     headers: () => ({ Authorization: `Bearer ${getToken()}` }),
 *     onError: (msg) => antdMessage.error(msg),
 *     onSuccess: (msg) => antdMessage.success(msg),
 *   })
 *
 *   <KnowledgeHubApp :api="api" />
 *
 * Hosts with a different backend implement KnowledgeHubApi directly.
 */
import type {
  Chunk,
  DatasetCardItem,
  DatasetSummary,
  DocMetadata,
  DocumentRow,
  IndexingTechnique,
  KnowledgeHubApi,
  RecallHit,
  RecentQuery,
} from '../types';

type FetchLike = typeof fetch;
type HeadersProvider = () => Record<string, string> | Promise<Record<string, string>>;

export interface SpringAgentStartAdapterOptions {
  /**
   * 宿主的代理前缀（默认 `/api`）。适配器内部会自动拼上 `/agent-start`
   * 命名空间 —— 那是 spring-agent-web 给控制器加的固定前缀，属于组件与
   * 后端约定的实现细节，宿主不用关心。所以最终请求 URL 是
   * `${baseUrl}/agent-start/xxx`。若代理不叫 /api，改成 `/xxx`；若完全直连
   * 后端（无代理），传 `''` 即可，最终就是 `/agent-start/xxx`。
   */
  baseUrl?: string;
  /** Optional custom fetch (e.g. host's axios wrapper turned into a fetch). */
  fetch?: FetchLike;
  /**
   * Extra headers to send on every call. Called for each request — return a
   * fresh token, tenant id, correlation id, etc. Can be async.
   */
  headers?: HeadersProvider;
  /** Called with the human-readable error message on any 4xx/5xx. */
  onError?(msg: string): void;
  /** Called with success messages emitted by the adapter itself. */
  onSuccess?(msg: string): void;
  /** Override the ⌘ 访问 API button behaviour. Default copies the dataset URL. */
  onCopyApi?(datasetId: string): void;
  /**
   * Wired to {@code KnowledgeHubApp}'s built-in "先注册 Embedding 模型"
   * empty-state nudge. The hub renders the card whenever the initial fetch
   * returns zero embedding models; clicking "去配置模型" fires this callback
   * so the host can navigate to its model-management route. Leaving it
   * undefined hides the button but keeps the informational card.
   */
  onGoToEmbeddingSetup?(): void;
  /**
   * Request timeout in ms. Default: 60_000. Uploads use `uploadTimeoutMs`.
   */
  timeoutMs?: number;
  uploadTimeoutMs?: number;
}

interface Envelope<T> {
  code: string;
  message?: string;
  data: T;
}

const AGENT_START_NAMESPACE = '/agent-start';

export function createSpringAgentStartAdapter(
  opts: SpringAgentStartAdapterOptions = {},
): KnowledgeHubApi {
  // Compose {proxy}{namespace}. Namespace is fixed; only proxy is host-configurable.
  const baseUrl = `${(opts.baseUrl ?? '/api').replace(/\/+$/, '')}${AGENT_START_NAMESPACE}`;
  const doFetch: FetchLike = opts.fetch ?? ((...args) => fetch(...args));
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const uploadTimeoutMs = opts.uploadTimeoutMs ?? 300_000;

  async function extraHeaders(): Promise<Record<string, string>> {
    return opts.headers ? await opts.headers() : {};
  }

  async function call<T>(
    path: string,
    init: RequestInit = {},
    timeout = timeoutMs,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await extraHeaders()),
        ...(init.headers ?? {}),
      };
      const res = await doFetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        // Uniform-envelope error body if the backend emitted one
        let msg = `${res.status} ${res.statusText}`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) msg = body.message;
        } catch {
          // ignore parse errors
        }
        const err = new Error(msg);
        opts.onError?.(msg);
        throw err;
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

  async function upload(datasetId: string, file: File): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), uploadTimeoutMs);
    try {
      const form = new FormData();
      form.append('file', file);
      const extra = await extraHeaders();
      // Don't set Content-Type on multipart — the browser fills it with the boundary.
      const res = await doFetch(
        `${baseUrl}/datasets/${datasetId}/documents/upload`,
        {
          body: form,
          headers: extra,
          method: 'POST',
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) msg = body.message;
        } catch {
          // ignore
        }
        opts.onError?.(msg);
        throw new Error(msg);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * POST /datasets/preview-chunks — multipart body: file + rule (JSON string).
   * Backend runs extract → clean → chunk on the file with the caller's rule
   * and returns the first {@code limit} chunks plus the full count. Nothing
   * persists. Same reader / cleaner / chunker as real ingestion, so the
   * preview is authoritative.
   */
  async function previewChunks(
    file: File,
    rule: unknown,
    limit = 10,
  ): Promise<{
    totalChunks: number;
    chunks: Array<{ index: number; text: string; tokens: number }>;
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), uploadTimeoutMs);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append(
        'rule',
        new Blob([JSON.stringify(rule ?? {})], { type: 'application/json' }),
      );
      const extra = await extraHeaders();
      const res = await doFetch(
        `${baseUrl}/datasets/preview-chunks?limit=${limit}`,
        {
          body: form,
          headers: extra,
          method: 'POST',
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) msg = body.message;
        } catch {
          // ignore
        }
        opts.onError?.(msg);
        throw new Error(msg);
      }
      const env = (await res.json()) as {
        code: string;
        message?: string;
        data: {
          totalChunks: number;
          chunks: Array<{ index: number; text: string; tokens: number }>;
        };
      };
      if (env.code !== 'ok') {
        opts.onError?.(env.message ?? env.code);
        throw new Error(env.message ?? env.code);
      }
      return env.data;
    } finally {
      clearTimeout(timer);
    }
  }

  // -- adapters that need to shape the backend response into the hub types
  function normalizeDoc(d: any): DocumentRow {
    return {
      id: d.id,
      name: d.name,
      chunkMode: d.sourceType === 'text' ? '自定义' : d.sourceType,
      wordCount: d.wordCount ?? 0,
      hitCount: 0,
      uploadedAt: d.createdAt,
      status:
        d.status === 'COMPLETED'
          ? 'AVAILABLE'
          : d.status === 'FAILED'
            ? 'FAILED'
            : 'PROCESSING',
      enabled: !!d.enabled,
    };
  }

  function normalizeChunk(s: any): Chunk {
    return {
      id: s.id,
      position: s.position,
      content: s.content,
      tokenCount: s.tokenCount,
      charCount: s.content?.length ?? 0,
      hitCount: 0,
      enabled: !!s.enabled,
      keywords: s.keywords
        ? String(s.keywords)
            .split(/\s+/)
            .filter((k: string) => k.length > 0)
        : [],
    };
  }

  const api: KnowledgeHubApi = {
    // ---- datasets
    listDatasets: () =>
      call<DatasetCardItem[]>('/datasets').then((rows) =>
        rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          documentCount: r.documentCount ?? 0,
          segmentCount: r.segmentCount ?? 0,
          indexingTechnique: r.indexingTechnique as IndexingTechnique,
          updatedAt: r.updatedAt,
        })),
      ),
    getDataset: (id) => call<DatasetSummary>(`/datasets/${id}`),
    createDataset: (req) =>
      call<DatasetCardItem>('/datasets', {
        body: JSON.stringify(req),
        method: 'POST',
      }),
    updateDataset: (id, patch) =>
      call<DatasetSummary>(`/datasets/${id}`, {
        body: JSON.stringify(patch),
        method: 'PUT',
      }),
    deleteDataset: (id) =>
      call<void>(`/datasets/${id}`, { method: 'DELETE' }),

    // ---- documents
    listDocuments: async (datasetId) => {
      const rows = await call<any[]>(`/datasets/${datasetId}/documents`);
      return rows.map(normalizeDoc);
    },
    uploadDocument: (datasetId, file) => upload(datasetId, file),
    deleteDocument: (datasetId, docId) =>
      call<void>(`/datasets/${datasetId}/documents/${docId}`, {
        method: 'DELETE',
      }),
    previewChunks: (file, rule, limit) => previewChunks(file, rule, limit),

    // ---- segments
    listSegments: async (datasetId, docId, page = 1, pageSize = 20) => {
      const rows = await call<any[]>(
        `/datasets/${datasetId}/documents/${docId}/segments?page=${page}&pageSize=${pageSize}`,
      );
      return rows.map(normalizeChunk);
    },
    loadDocumentMetadata: async (datasetId, docId) => {
      const [doc, ds, segRows] = await Promise.all([
        call<any>(`/datasets/${datasetId}/documents/${docId}`),
        call<any>(`/datasets/${datasetId}`),
        call<any[]>(
          `/datasets/${datasetId}/documents/${docId}/segments?pageSize=200`,
        ),
      ]);
      let processRule: any = {};
      try {
        if (ds?.processRuleJson) processRule = JSON.parse(ds.processRuleJson);
      } catch {
        processRule = {};
      }
      const totalChars = segRows.reduce(
        (n, c) => n + (c.content?.length ?? 0),
        0,
      );
      const totalTokens = segRows.reduce(
        (n, c) => n + (c.tokenCount ?? 0),
        0,
      );
      const meta: DocMetadata = {
        fileName: doc?.name,
        kind: doc?.sourceType,
        uploadedAt: doc?.createdAt,
        parsedAt: doc?.updatedAt,
        embeddedAt: doc?.updatedAt,
        chunkMode:
          processRule.template === 'PARENT_CHILD' ? '父子分段' : '自定义',
        chunkMaxSize: processRule.chunkTokens ?? 1024,
        totalChars,
        totalChunks: segRows.length,
        avgChunkChars:
          segRows.length > 0 ? Math.round(totalChars / segRows.length) : 0,
        avgEmbedMs: 2.5,
        totalTokens,
      };
      return meta;
    },
    updateSegment: (datasetId, docId, segId, content) =>
      call<any>(
        `/datasets/${datasetId}/documents/${docId}/segments/${segId}`,
        {
          body: JSON.stringify({ content }),
          method: 'PUT',
        },
      ).then(normalizeChunk),
    deleteSegment: (datasetId, docId, segId) =>
      call<void>(
        `/datasets/${datasetId}/documents/${docId}/segments/${segId}`,
        { method: 'DELETE' },
      ),
    setSegmentEnabled: (datasetId, docId, segId, enabled) =>
      call<any>(
        `/datasets/${datasetId}/documents/${docId}/segments/${segId}/enabled`,
        {
          body: JSON.stringify({ enabled }),
          method: 'PUT',
        },
      ).then(normalizeChunk),
    appendSegment: (datasetId, docId, content) =>
      call<any>(
        `/datasets/${datasetId}/documents/${docId}/segments`,
        {
          body: JSON.stringify({ content }),
          method: 'POST',
        },
      ).then(normalizeChunk),

    // ---- retrieval
    retrieve: async (datasetId, req) => {
      const rows = await call<any[]>(`/datasets/${datasetId}/retrieve`, {
        body: JSON.stringify({
          method: req.method,
          query: req.query,
          topK: req.topK ?? 10,
        }),
        method: 'POST',
      });
      return rows.map<RecallHit>((r) => ({
        segmentId: r.segmentId,
        content: r.content,
        position: r.position,
        score: r.score,
      }));
    },
    listRecallHistory: async (datasetId, limit) => {
      const rows = await call<any[]>(
        `/datasets/${datasetId}/hit-testing/history?limit=${limit ?? 20}`,
      );
      return rows.map<RecentQuery>((r) => ({
        id: r.id,
        query: r.query,
        method: r.method ?? 'HYBRID',
        hitCount: r.hitCount ?? 0,
        at: r.createdAt ?? '',
      }));
    },

    // ---- models
    listEmbeddingModels: async () => {
      const rows = await call<any[]>('/models?type=TEXT_EMBEDDING');
      // /models/defaults returns { TEXT_EMBEDDING: ModelEntity | null } — fetch
      // in parallel with the list so we can flag the default row inline.
      // Failing softly means non-default UX still works on backends that don't
      // publish defaults.
      let defaultId: null | string = null;
      try {
        const defaults = await call<Record<string, any>>('/models/defaults');
        defaultId = defaults?.TEXT_EMBEDDING?.id ?? null;
      } catch {
        // ignore — panel just won't preselect anything
      }
      return rows.map((m) => ({
        id: m.id,
        label: `${m.providerName} · ${m.modelName}`,
        providerName: m.providerName,
        providerLabel: m.providerName,
        isDefault: defaultId != null && m.id === defaultId,
      }));
    },
    getDefaultEmbeddingModelId: async () => {
      try {
        const defaults = await call<Record<string, any>>('/models/defaults');
        return defaults?.TEXT_EMBEDDING?.id ?? null;
      } catch {
        return null;
      }
    },
    listRerankModels: async () => {
      // Rerank model registry is optional — treat any 404/error as "none registered"
      // rather than a fatal so the wizard still opens on fresh installs.
      try {
        const rows = await call<any[]>('/models?type=RERANK');
        return rows.map((m) => ({
          id: m.id,
          label: `${m.providerName} · ${m.modelName}`,
        }));
      } catch {
        return [];
      }
    },

    // ---- hooks (delegate to host)
    onSuccess: opts.onSuccess,
    onError: opts.onError,
    onCopyApi:
      opts.onCopyApi ??
      ((id) => {
        const url = `${window.location.origin}${baseUrl}/datasets/${id}`;
        void navigator.clipboard.writeText(url);
      }),
    onGoToEmbeddingSetup: opts.onGoToEmbeddingSetup,
  };

  return api;
}
