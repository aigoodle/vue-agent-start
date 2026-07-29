<script setup lang="ts">
/**
 * AgentAppsPage — 一站式「应用列表」页面组件。
 *
 * 目标：宿主只需要 `<AgentAppsPage />` 就能获得完整的 Dify 风格应用管理页 ——
 * 列表 / 过滤 / 创建（类型选择器）/ 编辑（设计抽屉）/ 分享嵌入 / 发布 / 删除，
 * 全部内置。api-base 默认 `/api`（宿主代理前缀），/agent-start 命名空间由组件
 * 内部自动拼上。带鉴权的宿主用 :headers 注入 Authorization。
 *
 * 设计约束：
 *   - 组件只依赖 vue / vue-router / ant-design-vue / @ant-design/icons-vue，
 *     以及本模块内的 AppDesignDrawer / CreateAppModal，绝不依赖 Vben 生态
 *     （@vben/*）；
 *   - 所有后端调用都是通过 props.apiBase 拼出的 fetch，共用一个 {code, data}
 *     信封的解包器 —— 与 useAgentStudio / useKnowledge / useProviderHub 一致；
 *   - 导航（独立对话、去配置模型）通过 useRouter() 内部完成，捕获异常防止
 *     宿主没配对应路由时报错。
 */
import { computed, onDeactivated, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  Button,
  Card,
  Dropdown,
  Empty,
  Form,
  FormItem,
  Input,
  Menu,
  MenuItem,
  message,
  Modal,
  Select,
  Skeleton,
  Spin,
  Tag,
  Textarea,
} from 'ant-design-vue';

import type { ChatIframeConfig } from '../../agent-flow/components/chat-iframe-types';

import type { AppStudioApi } from '../api';
import type {
  AgentEntity,
  AgentStrategy,
  AppType,
} from '../types';

import AppDesignDrawer from './AppDesignDrawer.vue';
import CreateAppModal from './CreateAppModal.vue';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
/**
 * Header 值可以是静态对象，也可以是同步/异步函数 —— 每次请求前都会重新
 * 求值，方便宿主接入自家 access-token store（token 轮换时无须重挂组件）。
 */
type HeadersLike =
  | Record<string, string>
  | (() => Promise<Record<string, string>> | Record<string, string>);

interface Props {
  /**
   * 宿主的代理前缀。默认 `/api`：与宿主 vite `/api` 代理约定一致，代理
   * 剥掉 `/api` 后剩下的路径就是后端。组件内部会自动拼上 spring-agent-web
   * 给控制器加的固定 `/agent-start` 命名空间 —— 那是本组件与后端的约定，
   * 宿主不用关心。所以最终请求 URL 是 `${apiBase}/agent-start/xxx`。
   *
   * 若宿主没走 `/api` 代理而是同源直连后端，传 `''`（空字符串），最终
   * 就是 `/agent-start/xxx`。
   */
  apiBase?: string;
  /**
   * 追加到每个请求上的 header。宿主用 vben 等业务框架时，把
   * `Authorization: Bearer xxx` 通过这里注入即可，不用改组件内部代码。
   *
   * 传函数就每次请求前重新求值 —— 推荐用于依赖 pinia store 的 token
   * （登录/退出时不用重挂组件）：
   *   :headers="() => ({ Authorization: `Bearer ${accessStore.accessToken}` })"
   *
   * 传对象就是静态 header —— 适合固定 API-key：
   *   :headers="{ 'X-Api-Key': 'xxx' }"
   */
  headers?: HeadersLike;
}

const props = withDefaults(defineProps<Props>(), {
  apiBase: '/api',
  headers: () => ({}),
});

// ---------------------------------------------------------------------------
// Backend client — small fetch wrapper that unwraps {code, message, data}.
// Kept local (not exported to useAgentStudio) so this component stays a true
// drop-in with zero shared state.
// ---------------------------------------------------------------------------
const AGENT_START_NAMESPACE = '/agent-start';

interface Envelope<T> {
  code: string;
  message?: string;
  data: T;
}

function apiUrl(path: string): string {
  const base = props.apiBase.replace(/\/+$/, '');
  return `${base}${AGENT_START_NAMESPACE}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function resolveHeaders(): Promise<Record<string, string>> {
  const h = props.headers;
  const out = typeof h === 'function' ? await h() : h;
  return out ?? {};
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const injected = await resolveHeaders();
  const res = await fetch(apiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...injected,
      ...(init.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const env = (await res.json()) as Envelope<T>;
  if (env.code !== 'ok') {
    throw new Error(env.message ?? env.code);
  }
  return env.data;
}

// ---- CreateAgent / UpdateAgent request shape (mirrors #/api/agent) ----
interface CreateAgentRequestFull {
  tenantId?: string;
  name: string;
  description?: string;
  icon?: string;
  iconBackground?: string;
  mode?: string;
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

// ---- Agent CRUD ----
const listAgents = () => call<AgentEntity[]>('/agents');
const createAgentReq = (req: CreateAgentRequestFull) =>
  call<AgentEntity>('/agents', { method: 'POST', body: JSON.stringify(req) });
const updateAgentReq = (id: string, req: CreateAgentRequestFull) =>
  call<AgentEntity>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(req) });
const deleteAgentReq = (id: string) =>
  call<void>(`/agents/${id}`, { method: 'DELETE' });

// ---- Chat stream (raw fetch — SSE) ----
async function chatStreamReq(id: string, body: { query: string }) {
  const injected = await resolveHeaders();
  return fetch(apiUrl(`/agents/${id}/chat/stream`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...injected,
    },
    body: JSON.stringify(body),
  });
}

// ---- Conversations + history (called by AppStudioApi bag) ----
interface ConversationSummary {
  conversationId: string;
  name?: string;
  userId?: null | string;
  firstMessage?: string;
  updatedAt?: string;
  pinned?: boolean;
}
interface HistoryMessage {
  role: 'ASSISTANT' | 'SYSTEM' | 'USER';
  content: string;
}
const listConversationsReq = (appId: string, limit = 100) =>
  call<ConversationSummary[]>(`/chat/conversations/${appId}`, {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
const fetchHistoryReq = (appId: string, conversationId: string, limit = 500) =>
  call<HistoryMessage[]>(
    `/chat/conversations/${appId}/${conversationId}/messages`,
    { method: 'POST', body: JSON.stringify({ limit }) },
  );

// ---- Annotations ----
interface AppAnnotation {
  id: string;
  appId: string;
  question?: string;
  content?: string;
  enabled?: boolean;
  hitCount?: number;
  createdAt?: string;
  updatedAt?: string;
}
interface AppAnnotationRequest {
  question: string;
  content: string;
  enabled?: boolean;
}
const listAnnotationsReq = (appId: string) =>
  call<AppAnnotation[]>(`/apps/${appId}/annotations`);
const createAnnotationReq = (appId: string, req: AppAnnotationRequest) =>
  call<AppAnnotation>(`/apps/${appId}/annotations`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
const updateAnnotationReq = (
  appId: string,
  id: string,
  req: AppAnnotationRequest,
) =>
  call<AppAnnotation>(`/apps/${appId}/annotations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  });
const deleteAnnotationReq = (appId: string, id: string) =>
  call<void>(`/apps/${appId}/annotations/${id}`, { method: 'DELETE' });

// ---- API keys ----
interface AppApiKey {
  id: string;
  appId: string;
  name?: string;
  type?: string;
  token: string;
  createdAt?: string;
  lastUsedAt?: string;
}
const listApiKeysReq = (appId: string) =>
  call<AppApiKey[]>(`/apps/${appId}/api-tokens`);
const createApiKeyReq = (appId: string, name?: string) =>
  call<AppApiKey>(`/apps/${appId}/api-tokens`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
const renameApiKeyReq = (appId: string, id: string, name: string) =>
  call<AppApiKey>(`/apps/${appId}/api-tokens/${id}/rename`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
const deleteApiKeyReq = (appId: string, id: string) =>
  call<void>(`/apps/${appId}/api-tokens/${id}`, { method: 'DELETE' });

// ---- Metrics / LLM Ops ----
interface AppMetrics {
  appId: string;
  totalConversations: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  avgInteractionsPerConversation: number;
  lastActivityAt?: string;
}
interface LlmUsageStats {
  model?: string;
  calls: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costMicros: number;
  avgLatencyMs: number;
}
interface LlmCallRecord {
  id: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costMicros?: number;
  latencyMs?: number;
  success: boolean;
  errorType?: string;
  createdAt?: string;
}
const fetchAppMetricsReq = (appId: string) =>
  call<AppMetrics>(`/apps/${appId}/metrics`);
const fetchTotalReq = () => call<LlmUsageStats>('/llmops/total');
const fetchRecentReq = (limit = 50) =>
  call<LlmCallRecord[]>(`/llmops/recent?limit=${limit}`);

// ---- Models / Tools / Datasets ----
interface ModelEntity {
  id: string;
  tenantId?: string;
  providerName: string;
  modelName: string;
  modelType: string;
  enabled: boolean;
  isDefault: boolean;
}
interface ToolView {
  name: string;
  description: string;
  inputSchema?: string;
}
interface DatasetEntity {
  id: string;
  name: string;
  description?: string;
}
const listModelsReq = (type?: string) =>
  call<ModelEntity[]>(`/models${type ? `?type=${encodeURIComponent(type)}` : ''}`);
const listToolsReq = () => call<ToolView[]>('/tools');
const listDatasetsReq = () => call<DatasetEntity[]>('/datasets');

// ---- Workflow draft ----
interface WorkflowEntity {
  id: string;
  appId?: string;
  graph?: unknown;
  version?: string;
  published?: boolean;
}
const getWorkflowDraftReq = (appId: string) =>
  call<WorkflowEntity>(`/apps/${appId}/workflow/draft`);
const saveWorkflowDraftReq = (appId: string, graph: unknown) =>
  call<WorkflowEntity>(`/apps/${appId}/workflow/draft`, {
    method: 'PUT',
    body: JSON.stringify({ graph }),
  });
const publishWorkflowDraftReq = (appId: string) =>
  call<WorkflowEntity>(`/apps/${appId}/workflow/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

// ---------------------------------------------------------------------------
// AppStudioApi callback bag — the drawer's built-in panels call these.
// ---------------------------------------------------------------------------
const studioApi: AppStudioApi = {
  listConversations: (appId: string, limit?: number) =>
    listConversationsReq(appId, limit),
  fetchHistory: (appId: string, conversationId: string, limit?: number) =>
    fetchHistoryReq(appId, conversationId, limit),
  listAnnotations: (appId: string) => listAnnotationsReq(appId),
  createAnnotation: (appId: string, req: any) =>
    createAnnotationReq(appId, req),
  updateAnnotation: (appId: string, id: string, req: any) =>
    updateAnnotationReq(appId, id, req),
  deleteAnnotation: (appId: string, id: string) =>
    deleteAnnotationReq(appId, id),
  fetchAppMetrics: (appId: string) => fetchAppMetricsReq(appId),
  fetchLlmUsage: () => fetchTotalReq() as any,
  fetchRecentLlmCalls: (limit?: number) => fetchRecentReq(limit) as any,
  listApiKeys: (appId: string) => listApiKeysReq(appId) as any,
  createApiKey: (appId: string, name?: string) =>
    createApiKeyReq(appId, name) as any,
  renameApiKey: (appId: string, id: string, name: string) =>
    renameApiKeyReq(appId, id, name) as any,
  deleteApiKey: (appId: string, id: string) => deleteApiKeyReq(appId, id),
};

// ---------------------------------------------------------------------------
// Navigation helpers — routed via useRouter(); wrapped in try/catch so hosts
// that lack the expected routes (AgentChat, ModelList) don't blow up.
// ---------------------------------------------------------------------------
const router = useRouter();

function goToModel() {
  try {
    router?.push({ name: 'ModelList' });
  } catch {
    // Host doesn't have a ModelList route — silently no-op.
  }
}
function openChat(a: AgentEntity) {
  try {
    router?.push({ name: 'AgentChat', params: { id: a.id } });
  } catch {
    // Host doesn't have an AgentChat route — silently no-op.
  }
}

// ---------------------------------------------------------------------------
// Chat iframe config — minimal port of #/adapter/chat-iframe-config.ts, sans
// any @vben/preferences / @vben/stores dependency. `context.user` stays null
// (hosts can wrap the iframe in their own theme provider if needed).
// ---------------------------------------------------------------------------
interface AgentLike {
  id?: string;
  name?: string;
  mode?: string;
  workflowId?: string;
  difyApiKey?: string;
}

function resolveIframeBase(): string {
  const raw = (import.meta.env.VITE_CHAT_IFRAME_BASE as string | undefined)?.trim();
  const base = raw && raw.length > 0 ? raw : '/chat/';
  return base.endsWith('/') ? base : `${base}/`;
}

function resolveApiKey(agent?: AgentLike | null): string | undefined {
  const fromAgent = agent?.difyApiKey?.trim();
  if (fromAgent) return fromAgent;
  const fromEnv = (
    import.meta.env.VITE_DIFY_APP_KEY as string | undefined
  )?.trim();
  if (fromEnv) return fromEnv;
  return agent?.id?.trim() || undefined;
}

function buildChatIframeConfig(
  agent: AgentLike | null,
  options: { debug?: boolean } = {},
): ChatIframeConfig {
  const src = resolveIframeBase();
  const difyApiKey = resolveApiKey(agent);
  const label = agent?.name || agent?.id || 'spring-agent';
  const workflowId = agent?.workflowId;
  return {
    src,
    title: agent?.name ? `调试：${agent.name}` : '调试与预览',
    sessionKey: `${agent?.mode ?? 'agent'}-${agent?.id ?? 'draft'}`,
    params: {
      mode: 'Copilot',
      difyApiKey,
      label,
      appId: agent?.id,
      workflowId,
      debug: options.debug ? 'true' : undefined,
    },
    context: {
      appId: agent?.id,
      appMode: agent?.mode,
      appName: agent?.name,
      // Vben-specific user store lookup removed — hosts that want to plumb
      // theme/user info through can post-message it themselves after mount.
      user: null,
      theme: 'light',
    },
  };
}

// ---------------------------------------------------------------------------
// Reactive state — direct port of the original list.vue.
// ---------------------------------------------------------------------------
const agents = ref<AgentEntity[]>([]);
const llmModels = ref<ModelEntity[]>([]);
const tools = ref<ToolView[]>([]);
const datasets = ref<DatasetEntity[]>([]);
const loading = ref(false);
const llmLoaded = ref(false);

const keyword = ref('');
const filterStrategy = ref<'ALL' | AgentStrategy>('ALL');
/** Draft vs published filter — Dify's "只看已发布 / 只看草稿" toggle. */
const filterPublished = ref<'all' | 'draft' | 'published'>('all');

const showCreate = ref(false);
const submitting = ref(false);
/**
 * Dify-style two-step create: first pick an "app type" from CreateAppModal,
 * then land in the config form with defaults seeded from that choice.
 */
const showTypePicker = ref(false);
const editingId = ref<null | string>(null);
/**
 * Basic-info edit form — the "编辑基本信息" surface intentionally only carries
 * the four presentation fields (name / icon / iconBackground / description).
 */
const form = reactive({
  name: '',
  description: '',
  icon: '',
  iconBackground: '',
});

// Dify's app-card mode icons — colored square with an emoji
const ICONS = ['🤖', '💬', '🧠', '🎯', '🛠', '📊', '💡', '⚡', '🔎', '📎'];
const BGS = [
  '#FEF3F2',
  '#EEF4FF',
  '#EFFDF4',
  '#FFF4ED',
  '#F0F9FF',
  '#FEF6EE',
  '#FDF2FA',
  '#F0FDF9',
];
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.trunc((h << 5) - h + s.charCodeAt(i));
  }
  return Math.abs(h);
}
function iconOf(a: AgentEntity) {
  return a.icon || ICONS[hashCode(a.id || a.name) % ICONS.length];
}
function bgOf(a: AgentEntity) {
  return (
    a.iconBackground || BGS[hashCode((a.id || a.name) + '.bg') % BGS.length]
  );
}
function modeLabel(m?: string): string {
  if (m === 'chat') return 'Chat';
  if (m === 'chatflow') return 'Chatflow';
  if (m === 'workflow') return 'Workflow';
  if (m === 'completion') return 'Completion';
  return 'Agent';
}
function modeColor(m?: string): string {
  if (m === 'chat') return 'blue';
  if (m === 'chatflow') return 'cyan';
  if (m === 'workflow') return 'purple';
  if (m === 'completion') return 'orange';
  return 'geekblue';
}

function fromNow(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86_400 * 30) return `${Math.floor(diff / 86_400)} 天前`;
  return new Date(iso).toLocaleDateString();
}

function strategyLabel(s?: string): string {
  if (s === 'REACT') return 'ReAct';
  if (s === 'FUNCTION_CALLING') return 'Function Calling';
  if (s === 'PLAN_EXECUTE') return 'Plan & Execute';
  return s ?? '';
}
function strategyColor(s?: string): string {
  if (s === 'FUNCTION_CALLING') return 'green';
  if (s === 'PLAN_EXECUTE') return 'purple';
  return 'blue';
}

function modelLabel(a: AgentEntity): string {
  if (a.modelProvider && a.modelName) {
    return `${a.modelProvider} · ${a.modelName}`;
  }
  if (a.modelName) return a.modelName;
  return '未选择模型';
}

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return agents.value.filter((a) => {
    if (
      filterStrategy.value !== 'ALL' &&
      a.strategy !== filterStrategy.value
    ) {
      return false;
    }
    if (filterPublished.value === 'published' && a.published === false)
      return false;
    if (filterPublished.value === 'draft' && a.published !== false)
      return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      (a.description ?? '').toLowerCase().includes(q) ||
      (a.instructions ?? '').toLowerCase().includes(q)
    );
  });
});

/** Convenience count helpers for the filter tabs. */
const publishedCount = computed(
  () => agents.value.filter((a) => a.published !== false).length,
);
const draftCount = computed(
  () => agents.value.filter((a) => a.published === false).length,
);

async function refresh() {
  loading.value = true;
  try {
    agents.value = await listAgents();
  } catch (e: any) {
    // 后端 401/404/网络断开等都在这里兜住 —— 不能让异常冒到
    // onMounted 里变成 unhandledrejection,那会触发 vite 错误覆盖层,
    // 视觉上像 <KeepAlive> 里的路由切换全部白屏。
    agents.value = [];
    message.error(`加载应用列表失败：${e?.message ?? e}`);
  } finally {
    loading.value = false;
  }
}

async function loadDeps() {
  try {
    llmModels.value = await listModelsReq('LLM');
  } catch {
    llmModels.value = [];
  } finally {
    llmLoaded.value = true;
  }
  try {
    tools.value = await listToolsReq();
  } catch {
    tools.value = [];
  }
  try {
    datasets.value = await listDatasetsReq();
  } catch {
    datasets.value = [];
  }
}

function openTypePicker() {
  showTypePicker.value = true;
}

/**
 * Dify-parity create flow — always creates an `apps` row and refreshes the list
 * in place. Creating an app must never be gated on model availability.
 *
 * The 4 app types map to Dify's `mode` field on the `apps` row so a single
 * table backs the whole family:
 *   chatbot        → mode='chat'         · REACT
 *   agent          → mode='agent'        · FUNCTION_CALLING
 *   workflow       → mode='workflow'     · FUNCTION_CALLING + empty graph seed
 *   text-generator → mode='completion'   · PLAN_EXECUTE, memory off
 */
async function onCreateApp(payload: {
  appType: AppType;
  name: string;
  description: string;
  icon: { emoji: string; background: string };
}) {
  if (!llmLoaded.value) {
    await loadDeps();
  }
  const defaultModel =
    llmModels.value.find((m) => m.isDefault) ?? llmModels.value[0];

  const modeByType: Record<string, string> = {
    agent: 'agent',
    chatbot: 'chat',
    chatflow: 'chatflow',
    'text-generator': 'completion',
    workflow: 'workflow',
  };
  const strategyByType: Record<string, AgentStrategy> = {
    agent: 'FUNCTION_CALLING',
    chatbot: 'REACT',
    chatflow: 'REACT',
    'text-generator': 'PLAN_EXECUTE',
    workflow: 'FUNCTION_CALLING',
  };
  const mode = modeByType[payload.appType] ?? 'agent';
  const strategy = strategyByType[payload.appType] ?? 'REACT';
  const maxIterations = payload.appType === 'text-generator' ? 3 : 6;
  const memoryWindow = payload.appType === 'text-generator' ? 0 : 20;

  submitting.value = true;
  try {
    await createAgentReq({
      name: payload.name,
      description: payload.description || undefined,
      icon: payload.icon.emoji,
      iconBackground: payload.icon.background,
      mode,
      instructions: payload.description || undefined,
      modelName: defaultModel?.modelName ?? undefined,
      modelProvider: defaultModel?.providerName ?? undefined,
      strategy,
      toolNames: [],
      maxIterations,
      memoryEnabled: memoryWindow > 0,
      memoryWindow,
    });
    message.success(`已创建「${payload.name}」`);
    await refresh();
  } catch (e: any) {
    message.error(e?.message ?? '创建失败');
  } finally {
    submitting.value = false;
  }
}

// ---------------------------------------------------------------------------
// Design drawer — click a card to open a Dify-style drawer where the user can
// design the app. Workflow-mode apps see the DAG canvas; others see the
// orchestrate/preview two-pane. Persisted via updateAgent().
// ---------------------------------------------------------------------------
const drawerOpen = ref(false);
const drawerApp = ref<AgentEntity | null>(null);
/**
 * Draft-workflow graph JSON prefetched for the currently open drawer. Only
 * populated for workflow / chatflow apps.
 */
const drawerGraphJson = ref<string>('');

/**
 * 抽屉里挂 ChatIframePanel / FlowDesigner 的调试 iframe 配置。每次打开抽屉时
 * 按当前 app 重新构造 —— session key 走 mode+id，切换 app 不会串会话。
 */
const drawerChatConfig = computed<ChatIframeConfig | null>(() =>
  drawerApp.value
    ? buildChatIframeConfig(drawerApp.value as AgentLike, { debug: true })
    : null,
);

async function openDesigner(a: AgentEntity) {
  drawerApp.value = a;
  drawerGraphJson.value = '';
  // Prefetch the draft BEFORE opening the drawer for flow-mode apps so
  // FlowDesigner mounts with the real payload already on `props` (avoids a
  // race with initGraph()'s setTimeout(10) seed).
  if (a.mode === 'workflow' || a.mode === 'chatflow') {
    try {
      const draft = await getWorkflowDraftReq(a.id);
      if (draft?.graph) drawerGraphJson.value = JSON.stringify(draft.graph);
    } catch {
      drawerGraphJson.value = '';
    }
  }
  drawerOpen.value = true;
  if (!llmLoaded.value) loadDeps();
}

/**
 * Safely parse the drawer's serialised retrieval config so we can hand the
 * backend a plain object. Empty / malformed input returns undefined.
 */
function parseRetrievalConfig(
  json?: string,
): Record<string, unknown> | undefined {
  if (!json) return undefined;
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

async function onDrawerSave(payload: {
  appId: string;
  mode: string;
  graphJson?: string;
  name?: string;
  instructions?: string;
  openingStatement?: string;
  modelName?: string;
  modelProvider?: string;
  modelSettings?: Record<string, unknown>;
  toolNames?: string[];
  datasetIds?: string[];
  retrievalConfigJson?: string;
}) {
  const existing = agents.value.find((x) => x.id === payload.appId);
  submitting.value = true;
  try {
    await updateAgentReq(payload.appId, {
      name: payload.name ?? existing?.name ?? '',
      mode: payload.mode,
      instructions: payload.instructions,
      openingStatement: payload.openingStatement,
      modelName: payload.modelName ?? existing?.modelName,
      modelProvider: payload.modelProvider ?? existing?.modelProvider,
      modelSettings: payload.modelSettings,
      strategy: (existing?.strategy as AgentStrategy) ?? 'REACT',
      toolNames: payload.toolNames ?? [],
      datasetIds: payload.datasetIds ?? [],
      retrievalConfig: parseRetrievalConfig(payload.retrievalConfigJson),
      maxIterations: existing?.maxIterations,
      memoryEnabled: existing?.memoryEnabled,
      memoryWindow: existing?.memoryWindow,
      published: existing?.published,
    });
    if (
      (payload.mode === 'workflow' || payload.mode === 'chatflow') &&
      payload.graphJson
    ) {
      try {
        const parsed = JSON.parse(payload.graphJson);
        await saveWorkflowDraftReq(payload.appId, parsed);
      } catch {
        message.warning('画布数据无法解析，草稿未保存');
      }
    }
    message.success('已保存');
    await refresh();
    const fresh = agents.value.find((x) => x.id === payload.appId);
    if (fresh) drawerApp.value = fresh;
  } catch (e: any) {
    message.error(e?.message ?? '保存失败');
  } finally {
    submitting.value = false;
  }
}

/**
 * Brand popover → 编辑信息 shortcut. Reuses the same basic-info modal the
 * card ⋯ menu opens; the drawer stays open so the user can drop back into
 * design after saving.
 */
function onDrawerEditInfo(payload: { appId: string }) {
  const a = agents.value.find((x) => x.id === payload.appId);
  if (a) openEdit(a);
}
function onDrawerExportDsl(_payload: { appId: string }) {
  message.info('导出 DSL 功能开发中');
}
function onDrawerDuplicate(_payload: { appId: string }) {
  message.info('复制应用功能开发中');
}

async function onDrawerPublish(payload: { appId: string }) {
  try {
    await publishWorkflowDraftReq(payload.appId);
    message.success('已发布新版本');
    await refresh();
  } catch (e: any) {
    message.error(e?.message ?? '发布失败');
  }
}

/**
 * Handle the drawer's `preview` event — pipe the SSE chat stream into the
 * preview pane. Only used for non-workflow modes.
 */
async function onDrawerPreview(payload: {
  appId: string;
  query: string;
  onChunk: (t: string) => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  try {
    const res = await chatStreamReq(payload.appId, { query: payload.query });
    if (!res.ok || !res.body) {
      payload.onError(`预览失败：${res.status}`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let eventName = 'message';
        let dataStr = '';
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (eventName === 'result' && dataStr) {
          try {
            const r = JSON.parse(dataStr);
            if (r.text) payload.onChunk(String(r.text));
          } catch {
            // ignore malformed frame
          }
        }
        idx = buffer.indexOf('\n\n');
      }
    }
    payload.onDone();
  } catch (e: any) {
    payload.onError(String(e?.message ?? e));
  }
}

function openEdit(a: AgentEntity) {
  editingId.value = a.id;
  form.name = a.name;
  form.description = a.description ?? '';
  form.icon = a.icon ?? '';
  form.iconBackground = a.iconBackground ?? '';
  showCreate.value = true;
}

/**
 * Save the trimmed basic-info form. Carries over every other field from the
 * existing entity so the PUT doesn't clobber model / strategy / tools /
 * instructions / memory / published state — those live in the design drawer.
 */
async function submitCreate() {
  if (!form.name) {
    message.warning('请填写名称');
    return;
  }
  if (!editingId.value) return;
  const existing = agents.value.find((x) => x.id === editingId.value);
  if (!existing) {
    message.error('未找到应用');
    return;
  }
  submitting.value = true;
  try {
    const body: CreateAgentRequestFull = {
      name: form.name,
      description: form.description || undefined,
      icon: form.icon || undefined,
      iconBackground: form.iconBackground || undefined,
      mode: existing.mode,
      instructions: existing.instructions,
      openingStatement: existing.openingStatement,
      modelName: existing.modelName,
      modelProvider: existing.modelProvider,
      strategy: (existing.strategy as AgentStrategy) ?? 'REACT',
      toolNames: existing.toolNamesJson
        ? safeParseArray(existing.toolNamesJson)
        : [],
      datasetIds: existing.datasetIdsJson
        ? safeParseArray(existing.datasetIdsJson)
        : [],
      maxIterations: existing.maxIterations,
      memoryEnabled: existing.memoryEnabled,
      memoryWindow: existing.memoryWindow,
      published: existing.published,
    };
    await updateAgentReq(editingId.value, body);
    message.success('已更新');
    showCreate.value = false;
    editingId.value = null;
    await refresh();
  } finally {
    submitting.value = false;
  }
}

function safeParseArray(json?: string): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function remove(a: AgentEntity) {
  Modal.confirm({
    title: '删除智能体',
    content: `确认删除「${a.name}」？相关对话历史仍会保留在数据库中。`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      await deleteAgentReq(a.id);
      message.success('已删除');
      await refresh();
    },
  });
}

// ---- share embed modal ----
const showShare = ref(false);
const shareAgent = ref<AgentEntity | null>(null);

function openShare(a: AgentEntity) {
  shareAgent.value = a;
  showShare.value = true;
}

const shareUrl = computed(() => {
  if (!shareAgent.value) return '';
  return `${window.location.origin}/embed/agent/${shareAgent.value.id}`;
});

const iframeSnippet = computed(() =>
  shareUrl.value
    ? `<iframe src="${shareUrl.value}" width="420" height="620" style="border:1px solid #eee;border-radius:8px" allow="microphone"></iframe>`
    : '',
);

async function copyText(txt: string) {
  try {
    await navigator.clipboard.writeText(txt);
    message.success('已复制');
  } catch {
    message.error('复制失败，请手动选中');
  }
}

onMounted(() => {
  // 两个都是 async fn,但不 await —— 显式 .catch 兜住 unhandledrejection,
  // 避免任何一次网络失败把 <KeepAlive> 缓存里的组件挂坏。
  refresh().catch(() => {});
  loadDeps().catch(() => {});
});

// 路由切走时(<KeepAlive> 挂起本组件),强制把抽屉状态关掉。抽屉用
// <Teleport to="body"> 挂全屏白色遮罩,若切走时 drawerOpen 还是 true,
// 遮罩会漏在 body 上盖住后续路由,表现为「切页面就空白,只能 F5 」。
// 配合 AppDesignDrawer 里的 :disabled="!open" 是双保险。
onDeactivated(() => {
  drawerOpen.value = false;
});
</script>

<template>
  <div class="agent-apps-page">
    <div class="agent-apps-header">
      <div class="agent-apps-title">应用</div>
      <div class="agent-apps-subtitle">
        应用列表：对话 · 智能体 · 工作流 · 文本生成
      </div>
    </div>

    <!-- Soft nudge only — creating an app never requires a model configured
         upfront. Real gating happens when the user tries to *run* the app. -->
    <Card
      v-if="llmLoaded && llmModels.length === 0"
      class="mb-4"
      :body-style="{ padding: '12px 16px' }"
    >
      <div class="flex items-center gap-3">
        <div class="text-xl">💡</div>
        <div class="flex-1 text-sm text-gray-600">
          还没有配置 LLM 模型。你可以先创建应用占位，等到想跑起来的时候再去
          <a class="text-indigo-600 cursor-pointer" @click="goToModel">
            配置模型
          </a>
          即可。
        </div>
      </div>
    </Card>

    <!-- 顶部搜索 + 过滤 -->
    <div
      class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 shadow-sm dark:bg-neutral-900"
    >
      <div class="flex flex-wrap items-center gap-2">
        <Input
          v-model:value="keyword"
          placeholder="搜索智能体..."
          allow-clear
          style="width: 240px"
        />
        <Select
          v-model:value="filterStrategy"
          :options="[
            { label: '全部策略', value: 'ALL' },
            { label: 'ReAct', value: 'REACT' },
            { label: 'Function Calling', value: 'FUNCTION_CALLING' },
            { label: 'Plan & Execute', value: 'PLAN_EXECUTE' },
          ]"
          style="width: 180px"
        />
        <div class="dify-pub-tabs">
          <button
            class="dify-pub-tab"
            :class="{ 'dify-pub-tab--on': filterPublished === 'all' }"
            @click="filterPublished = 'all'"
          >
            全部 <span class="dify-pub-count">{{ agents.length }}</span>
          </button>
          <button
            class="dify-pub-tab"
            :class="{ 'dify-pub-tab--on': filterPublished === 'published' }"
            @click="filterPublished = 'published'"
          >
            已发布
            <span class="dify-pub-count">{{ publishedCount }}</span>
          </button>
          <button
            class="dify-pub-tab"
            :class="{ 'dify-pub-tab--on': filterPublished === 'draft' }"
            @click="filterPublished = 'draft'"
          >
            草稿 <span class="dify-pub-count">{{ draftCount }}</span>
          </button>
        </div>
      </div>
      <div class="text-xs text-gray-500">
        共 {{ filtered.length }} / {{ agents.length }} 个
      </div>
    </div>

    <div v-if="loading && agents.length === 0" class="dify-grid">
      <div v-for="n in 6" :key="n" class="dify-card">
        <Skeleton :active="true" :paragraph="{ rows: 3 }" />
      </div>
    </div>

    <Spin :spinning="loading && agents.length > 0">
      <div v-if="!loading || agents.length > 0" class="dify-grid">
        <!-- "新建" 占位卡 —— 点开走 Dify 风格的 CreateAppModal 选类型。
             Never disabled: apps can be created without a model configured. -->
        <div class="dify-card dify-card-new" @click="openTypePicker">
          <div class="dify-new-inner">
            <div class="dify-new-plus">+</div>
            <div class="dify-new-text">新建应用</div>
            <div class="dify-new-sub">
              对话 / Agent / 工作流 / Chatflow / 文本生成
            </div>
          </div>
        </div>

        <!-- 智能体卡 -->
        <div
          v-for="a in filtered"
          :key="a.id"
          class="dify-card"
          @click="openDesigner(a)"
        >
          <div class="dify-header">
            <div class="dify-icon" :style="{ background: bgOf(a) }">
              {{ iconOf(a) }}
            </div>
            <div class="dify-title-wrap">
              <div class="dify-title" :title="a.name">
                {{ a.name }}
                <Tag
                  v-if="a.published === false"
                  color="orange"
                  size="small"
                  style="margin-left: 4px; font-size: 10px"
                >
                  草稿
                </Tag>
              </div>
              <div class="dify-meta">
                <Tag :color="modeColor(a.mode)" style="margin-right: 4px">
                  {{ modeLabel(a.mode) }}
                </Tag>
                <Tag :color="strategyColor(a.strategy)" style="margin-right: 4px">
                  {{ strategyLabel(a.strategy) }}
                </Tag>
                <span>· {{ fromNow(a.updatedAt) || '刚刚' }}</span>
              </div>
            </div>
          </div>

          <div
            class="dify-desc"
            :title="a.description || a.instructions || ''"
          >
            {{ a.description || a.instructions || '暂无描述' }}
          </div>

          <div class="dify-spacer" />

          <div class="dify-footer">
            <span class="dify-footer-item" :title="modelLabel(a)">
              🧠 {{ modelLabel(a) }}
            </span>
            <span
              v-if="a.maxIterations"
              class="dify-footer-item"
              :title="`最多 ${a.maxIterations} 轮`"
            >
              🔁 {{ a.maxIterations }}
            </span>
          </div>

          <div class="dify-more" @click.stop>
            <Dropdown :trigger="['click']" placement="bottomRight">
              <Button type="text" size="small" class="dify-more-btn">
                ⋯
              </Button>
              <template #overlay>
                <Menu>
                  <MenuItem key="design" @click="openDesigner(a)">
                    设计
                  </MenuItem>
                  <MenuItem key="chat" @click="openChat(a)">
                    独立对话
                  </MenuItem>
                  <MenuItem key="edit" @click="openEdit(a)">
                    编辑基本信息
                  </MenuItem>
                  <MenuItem key="share" @click="openShare(a)">
                    分享嵌入
                  </MenuItem>
                  <MenuItem key="delete" danger @click="remove(a)">
                    删除
                  </MenuItem>
                </Menu>
              </template>
            </Dropdown>
          </div>
        </div>
      </div>

      <Empty
        v-if="!loading && filtered.length === 0"
        class="mt-8"
        :description="
          keyword
            ? '没有找到匹配的智能体'
            : '还没有智能体，点上面的“新建智能体”开始吧'
        "
      />
    </Spin>

    <Modal
      v-model:open="showCreate"
      title="编辑基本信息"
      width="520px"
      :confirm-loading="submitting"
      ok-text="保存"
      @ok="submitCreate"
    >
      <Form :model="form" layout="vertical">
        <FormItem label="图标">
          <div class="flex flex-wrap gap-1">
            <button
              v-for="ic in ICONS"
              :key="ic"
              type="button"
              class="dify-emoji-btn"
              :class="{ 'dify-emoji-btn--on': form.icon === ic }"
              :style="{ background: form.iconBackground || '#F3F4F6' }"
              @click="form.icon = ic"
            >
              {{ ic }}
            </button>
          </div>
        </FormItem>
        <FormItem label="背景颜色">
          <div class="flex flex-wrap gap-1">
            <button
              v-for="bg in BGS"
              :key="bg"
              type="button"
              class="dify-bg-btn"
              :class="{ 'dify-bg-btn--on': form.iconBackground === bg }"
              :style="{ background: bg }"
              @click="form.iconBackground = bg"
            />
          </div>
        </FormItem>
        <FormItem label="名称" required>
          <Input v-model:value="form.name" placeholder="例如 report-writer" />
        </FormItem>
        <FormItem label="描述">
          <Textarea
            v-model:value="form.description"
            :rows="3"
            placeholder="一句话说明这个智能体在做什么 —— 显示在卡片上"
          />
        </FormItem>
      </Form>
    </Modal>

    <Modal
      v-model:open="showShare"
      :title="shareAgent ? `分享 · ${shareAgent.name}` : '分享'"
      width="640px"
      :footer="null"
    >
      <div class="mb-2 text-xs text-gray-500">
        无登录嵌入。iframe 到你的站点即可用，会话会自动保存到浏览器 localStorage。
      </div>
      <div class="mb-1 text-xs font-medium">直链</div>
      <div class="mb-3 flex gap-2">
        <Input :value="shareUrl" readonly class="flex-1" />
        <Button @click="copyText(shareUrl)">复制</Button>
      </div>
      <div class="mb-1 text-xs font-medium">iframe 嵌入代码</div>
      <div class="flex gap-2">
        <Textarea
          :value="iframeSnippet"
          :rows="4"
          readonly
          class="flex-1"
          style="font-family: monospace; font-size: 12px"
        />
        <Button @click="copyText(iframeSnippet)">复制</Button>
      </div>
      <div class="mt-3 text-xs text-gray-400">
        提示：URL 支持 <code>?title=xxx</code> 覆盖标题、
        <code>?conversation=xxx</code> 恢复到指定会话。
      </div>
    </Modal>

    <!-- Dify-style app-type picker. Single-page: type tiles + form on the
         left, big preview on the right. Chatflow is a first-class primary
         tile alongside workflow — same DAG canvas, but the runtime keeps
         per-conversation memory + streams via ANSWER nodes. -->
    <CreateAppModal
      v-model:open="showTypePicker"
      :allow="['chatbot', 'agent', 'workflow', 'chatflow', 'text-generator']"
      @create="onCreateApp"
    />

    <!-- Click-a-card design drawer. Drawer's built-in DrawerFlowDesigner /
         LogAnnotationPanel / MonitorPanel handle everything internally now —
         we just wire them via :api to the local fetch bag. -->
    <AppDesignDrawer
      v-model:open="drawerOpen"
      :app="drawerApp"
      :initial-graph-json="drawerGraphJson"
      :api="studioApi"
      :api-base="apiBase"
      :chat-config="drawerChatConfig"
      :models="
        llmModels.map((m) => ({
          id: m.id,
          label: `${m.providerName} · ${m.modelName}`,
          provider: m.providerName,
        }))
      "
      :tools="tools.map((t) => ({ name: t.name, description: t.description }))"
      :knowledge-bases="datasets.map((d) => ({ id: d.id, name: d.name }))"
      @save="onDrawerSave"
      @preview="onDrawerPreview"
      @publish="onDrawerPublish"
      @edit-info="onDrawerEditInfo"
      @export-dsl="onDrawerExportDsl"
      @duplicate="onDrawerDuplicate"
    />
  </div>
</template>

<style scoped>
.agent-apps-page {
  padding: 16px;
}
.agent-apps-header {
  margin-bottom: 16px;
}
.agent-apps-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}
.agent-apps-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}
:global(.dark) .agent-apps-title {
  color: #f3f4f6;
}
:global(.dark) .agent-apps-subtitle {
  color: #9ca3af;
}

.dify-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.dify-card {
  position: relative;
  height: 200px;
  padding: 14px 16px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease,
    background 0.15s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
:global(.dark) .dify-card {
  background: #1f1f1f;
  border-color: #2d2d2d;
}
.dify-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}
.dify-card-new {
  border: 1.5px dashed #c7d2fe;
  background: linear-gradient(135deg, #f5f9ff 0%, #f0f5ff 100%);
}
.dify-card-new:hover {
  border-color: #6366f1;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
}
.dify-card-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.dify-new-inner {
  margin: auto 0;
  text-align: center;
  color: #6366f1;
}
.dify-new-plus {
  font-size: 42px;
  line-height: 1;
  font-weight: 200;
}
.dify-new-text {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 500;
}
.dify-new-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}
.dify-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.dify-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 22px;
}
.dify-title-wrap {
  min-width: 0;
  flex: 1;
}
.dify-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global(.dark) .dify-title {
  color: #f3f4f6;
}
.dify-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
}
.dify-desc {
  margin-top: 10px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
:global(.dark) .dify-desc {
  color: #9ca3af;
}
.dify-spacer {
  flex: 1;
}
.dify-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
  border-top: 1px solid #f3f4f6;
  padding-top: 8px;
  overflow: hidden;
  white-space: nowrap;
}
:global(.dark) .dify-footer {
  border-top-color: #2d2d2d;
}
.dify-footer-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
.dify-more {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.dify-card:hover .dify-more {
  opacity: 1;
}
.dify-more-btn {
  font-size: 18px;
  line-height: 1;
  padding: 0 6px;
  height: 26px;
}

/* Emoji picker for the agent icon */
.dify-emoji-btn {
  width: 32px;
  height: 32px;
  font-size: 18px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.15s,
    transform 0.1s;
}
.dify-emoji-btn:hover {
  border-color: #a5b4fc;
  transform: scale(1.05);
}
.dify-emoji-btn--on {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

/* Published filter tabs */
.dify-pub-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: #f3f4f6;
  border-radius: 6px;
}
.dify-pub-tab {
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.dify-pub-tab:hover {
  color: #111827;
}
.dify-pub-tab--on {
  background: #fff;
  color: #111827;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.dify-pub-count {
  padding: 0 4px;
  font-size: 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.05);
  min-width: 16px;
  text-align: center;
}
.dify-pub-tab--on .dify-pub-count {
  background: #eef2ff;
  color: #4338ca;
}

/* Background color picker */
.dify-bg-btn {
  width: 28px;
  height: 28px;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.dify-bg-btn:hover {
  border-color: #9ca3af;
}
.dify-bg-btn--on {
  border-color: #6366f1;
}
</style>
