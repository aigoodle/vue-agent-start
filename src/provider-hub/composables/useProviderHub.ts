/**
 * Tiny fetch-based client — mirrors knowledge-hub. Doesn't take a hard dep on
 * axios so the module can be pulled into any Vue 3 app.
 */
import type {
  CatalogRow,
  GroupedProviderView,
  ModelEntity,
  ModelParameters,
  ModelRegistration,
  ModelTestResult,
  ModelType,
  ProviderCredentialInfo,
  ProviderDefinition,
  ProviderView,
  RemoteModel,
} from '../types';

// `/agent-start` 是 spring-agent-web 给每个控制器加的固定命名空间前缀，属于
// 组件与后端约定的实现细节，宿主不用关心 —— 组件内部自己拼上就行。宿主
// 只需要告诉我们它转发到后端的代理前缀（默认 `/api`）。若代理不叫 /api,
// 传自定义 apiBase 或调 setProviderHubApiBase() 覆盖。
const AGENT_START_NAMESPACE = '/agent-start';
let apiBase = '/api';

/**
 * 追加到每个请求的 header。传函数会在每次请求前重新求值，方便宿主接入
 * pinia store 里的 access-token —— 登录/退出时不用重挂 composable。
 */
export type HeadersLike =
  | Record<string, string>
  | (() => Promise<Record<string, string>> | Record<string, string>);

let headersProvider: () => Promise<Record<string, string>> | Record<string, string> = () => ({});

export function setProviderHubApiBase(base: string) {
  apiBase = base.replace(/\/+$/, '');
}

/**
 * 设置每次请求都会拼上的 header（如 Authorization）。示例：
 *   setProviderHubHeaders(() => ({
 *     Authorization: `Bearer ${useAccessStore().accessToken}`,
 *   }));
 */
export function setProviderHubHeaders(headers: HeadersLike) {
  headersProvider = typeof headers === 'function' ? headers : () => headers;
}

function buildUrl(path: string): string {
  return `${apiBase}${AGENT_START_NAMESPACE}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function resolveHeaders(): Promise<Record<string, string>> {
  return (await headersProvider()) ?? {};
}

interface Envelope<T> {
  code: string;
  message?: string;
  data: T;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const injected = await resolveHeaders();
  const res = await fetch(buildUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...injected,
      ...(init.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    // Try to unwrap a JSON error body — the backend returns {code, message}
    // even for 4xx/5xx via GlobalExceptionHandler, and the human-readable
    // message is worth surfacing (e.g. "Invalid API key" from OpenAI itself).
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) msg = body.message;
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }
  const env = (await res.json()) as Envelope<T>;
  if (env.code !== 'ok') {
    throw new Error(env.message ?? env.code);
  }
  return env.data;
}

function qs(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function useProviderHub() {
  return {
    // ------- providers (tenant-aware — pass tenantId to get "configured" flags)
    listProviders: (tenantId?: string) =>
      call<ProviderView[]>(`/model-providers${qs({ tenantId })}`),
    getProvider: (name: string, tenantId?: string) =>
      call<ProviderView>(
        `/model-providers/${encodeURIComponent(name)}${qs({ tenantId })}`,
      ),

    // ------- provider-level credential (Dify-parity "one key per provider")
    getProviderCredential: (name: string, tenantId?: string) =>
      call<ProviderCredentialInfo>(
        `/model-providers/${encodeURIComponent(name)}/credential${qs({ tenantId })}`,
      ),
    saveProviderCredential: (
      name: string,
      credentials: Record<string, unknown>,
      tenantId?: string,
    ) =>
      call<ProviderCredentialInfo>(
        `/model-providers/${encodeURIComponent(name)}/credential`,
        {
          method: 'PUT',
          body: JSON.stringify({ tenantId, credentials }),
        },
      ),
    deleteProviderCredential: (name: string, tenantId?: string) =>
      call<void>(
        `/model-providers/${encodeURIComponent(name)}/credential${qs({ tenantId })}`,
        { method: 'DELETE' },
      ),

    // ------- remote-model discovery (non-destructive peek at the vendor catalog)
    listRemoteModels: (name: string, tenantId?: string) =>
      call<RemoteModel[]>(
        `/model-providers/${encodeURIComponent(name)}/remote-models${qs({ tenantId })}`,
      ),

    /**
     * "重新拉取": ask the backend to re-hit the vendor and return the raw list —
     * <em>transient</em>, no DB writes. The caller merges the returned entries
     * with its cached catalog; only user-enabled models get persisted as
     * settings. This matches the user's requested design:
     *     "读取到的模型太多了 我只想存启用的到 DB，全部就直接掉接口获取"
     */
    refreshCatalog: (name: string, tenantId?: string) =>
      call<RemoteModel[]>(
        `/model-providers/${encodeURIComponent(name)}/refresh-catalog${qs({ tenantId })}`,
        { method: 'POST' },
      ),

    // ------- installed-model CRUD
    listModels: (tenantId?: string, type?: ModelType) =>
      call<ModelEntity[]>(`/models${qs({ tenantId, type })}`),
    registerModel: (req: ModelRegistration) =>
      call<ModelEntity>('/models', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    updateCredentials: (id: string, patch: Record<string, unknown>) =>
      call<ModelEntity>(`/models/${id}/credentials`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    setDefault: (id: string) =>
      call<void>(`/models/${id}/default`, { method: 'PUT' }),
    /** Flip the {@code enabled} switch on a single row. Off rows stay in the catalog. */
    setModelEnabled: (id: string, enabled: boolean) =>
      call<ModelEntity>(`/models/${id}/enabled`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    deleteModel: (id: string) =>
      call<void>(`/models/${id}`, { method: 'DELETE' }),
    validateModel: (req: ModelRegistration) =>
      call<void>('/models/validate', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    testModel: (id: string) =>
      call<ModelTestResult>(`/models/${id}/test`, { method: 'POST' }),

    // ------- per-model parameters (Dify-parity parameter drawer)
    /** Read current parameter values + the rules the UI should render. */
    getModelParameters: (id: string) =>
      call<ModelParameters>(`/models/${id}/parameters`),
    /**
     * Save a partial parameter patch. `null` values remove the override so the
     * provider falls back to its own default.
     */
    saveModelParameters: (
      id: string,
      parameters: Record<string, boolean | null | number | string>,
    ) =>
      call<ModelParameters>(`/models/${id}/parameters`, {
        method: 'PUT',
        body: JSON.stringify(parameters),
      }),

    /** Tenant's default model per {@link ModelType}. Feeds the "系统默认模型" panel. */
    listDefaults: (tenantId?: string) =>
      call<Record<string, ModelEntity>>(`/models/defaults${qs({ tenantId })}`),

    /**
     * Enabled models grouped by ModelType → Provider → modelList. Feeds the
     * "系统默认模型" panel's per-type &lt;a-select&gt; with opt-groups. Only
     * providers with a saved credential + enabled models appear.
     */
    listModelsGroupedByType: (tenantId?: string) =>
      call<Record<string, GroupedProviderView[]>>(
        `/models/grouped-by-type${qs({ tenantId })}`,
      ),

    // ------- Dify-parity DB-driven metadata (new endpoints)
    /**
     * Unified catalog view for a provider: predefined DB rows + custom rows,
     * each annotated with the tenant's enable / default state pulled from the
     * new settings tables.
     */
    getProviderCatalog: (name: string, tenantId?: string) =>
      call<CatalogRow[]>(
        `/model-providers/${encodeURIComponent(name)}/catalog${qs({ tenantId })}`,
      ),

    /**
     * Toggle a predefined model's enabled state by (provider, model, type).
     * Writes to agent_provider_model_setting; missing row = enabled (Dify
     * convention), so we only persist "off" flips.
     */
    setModelEnabledByName: (
      providerName: string,
      modelName: string,
      modelType: ModelType,
      enabled: boolean,
      tenantId?: string,
    ) =>
      call<boolean>(
        `/model-providers/${encodeURIComponent(providerName)}/models/${encodeURIComponent(modelName)}/enabled${qs({ modelType, tenantId })}`,
        { method: 'PUT', body: JSON.stringify({ enabled }) },
      ),

    /** Set the tenant default model per model type (Dify-parity path). */
    setModelDefaultByName: (
      providerName: string,
      modelName: string,
      modelType: ModelType,
      tenantId?: string,
    ) =>
      call<void>(
        `/model-providers/${encodeURIComponent(providerName)}/models/${encodeURIComponent(modelName)}/default${qs({ modelType, tenantId })}`,
        { method: 'PUT' },
      ),

    // ------- provider definition CRUD (extend supported providers via DB)
    /** Available Java implementation bean keys — the pool a definition can point at. */
    listImplementationKeys: () =>
      call<string[]>('/model-provider-impls'),

    createProviderDefinition: (payload: ProviderDefinition) =>
      call<ProviderDefinition>('/model-provider-definitions', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    updateProviderDefinition: (id: string, patch: Partial<ProviderDefinition>) =>
      call<void>(`/model-provider-definitions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),

    deleteProviderDefinition: (id: string) =>
      call<void>(`/model-provider-definitions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),

    /**
     * Extend a provider's predefined catalog — POST adds one row, keyed
     * uniquely by (provider, model, model_type). Idempotent upsert.
     */
    addPredefinedModel: (
      providerName: string,
      payload: {
        model: string;
        label?: string;
        modelType: ModelType;
        contextLength?: number;
        dimensions?: number;
        features?: string[];
        parameterRules?: Array<Record<string, unknown>>;
        sortOrder?: number;
      },
    ) =>
      call<Record<string, unknown>>(
        `/model-providers/${encodeURIComponent(providerName)}/predefined-models`,
        { method: 'POST', body: JSON.stringify(payload) },
      ),

    deletePredefinedModel: (providerName: string, id: string) =>
      call<void>(
        `/model-providers/${encodeURIComponent(providerName)}/predefined-models/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      ),
  };
}

// Visual helpers — provider iconography lifted straight from the Dify default set
// so cards look right at first glance.
const PROVIDER_ICONS: Record<string, string> = {
  deepseek: '🐳',
  moonshot: '🌘',
  ollama: '🦙',
  openai: '🅾',
  qwen: '🐫',
  siliconflow: '🧪',
  volcengine: '🌋',
  zhipu: '🧠',
};

const PROVIDER_BGS: Record<string, string> = {
  deepseek: '#EFF6FF',
  moonshot: '#F1F5F9',
  ollama: '#F5F3FF',
  openai: '#F0FDF4',
  qwen: '#FEF3C7',
  siliconflow: '#FEF2F2',
  volcengine: '#FEF3C7',
  zhipu: '#EEF2FF',
};

export function providerIcon(name: string): string {
  return PROVIDER_ICONS[name.toLowerCase()] ?? '🤖';
}

export function providerBg(name: string): string {
  return PROVIDER_BGS[name.toLowerCase()] ?? '#F1F5F9';
}

export function modelTypeLabel(t: ModelType | string): string {
  if (t === 'LLM') return 'LLM';
  if (t === 'TEXT_EMBEDDING') return 'TEXT EMBEDDING';
  if (t === 'RERANK') return 'RERANK';
  if (t === 'SPEECH2TEXT') return 'SPEECH2TEXT';
  if (t === 'TTS') return 'TTS';
  if (t === 'MODERATION') return 'MODERATION';
  if (t === 'IMAGE') return 'IMAGE';
  return String(t);
}

export function modelTypeColor(t: ModelType | string): string {
  if (t === 'LLM') return 'blue';
  if (t === 'TEXT_EMBEDDING') return 'green';
  if (t === 'RERANK') return 'orange';
  if (t === 'SPEECH2TEXT' || t === 'TTS') return 'purple';
  return 'default';
}
