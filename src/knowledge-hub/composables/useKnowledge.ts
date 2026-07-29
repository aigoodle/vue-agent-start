/**
 * Tiny fetch-based client. Doesn't take a hard dep on axios / the host app's
 * request layer so the module can be pulled into any Vue 3 app.
 *
 * Consumers can either set the base URL once via {@link setKnowledgeApiBase} or
 * pass it per-call. Failing responses throw so callers can catch/ toast as they
 * see fit.
 */
import type { Dataset, RetrieveRequest, RetrievedSegment } from '../types';

// `/agent-start` 是 spring-agent-web 给每个控制器加的固定命名空间前缀，属于
// 组件与后端约定的实现细节，宿主不用关心 —— 组件内部自己拼上就行。宿主
// 只需要告诉我们它转发到后端的代理前缀（默认 `/api`）。若代理不叫 /api,
// 传自定义 apiBase 或调 setKnowledgeApiBase() 覆盖。
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

export function setKnowledgeApiBase(base: string) {
  apiBase = base.replace(/\/+$/, '');
}

/**
 * 设置每次请求都会拼上的 header（如 Authorization）。示例：
 *   setKnowledgeHeaders(() => ({
 *     Authorization: `Bearer ${useAccessStore().accessToken}`,
 *   }));
 */
export function setKnowledgeHeaders(headers: HeadersLike) {
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
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const env = (await res.json()) as Envelope<T>;
  if (env.code !== 'ok') {
    throw new Error(env.message ?? env.code);
  }
  return env.data;
}

export function useKnowledge() {
  return {
    listDatasets: (tenantId?: string) =>
      call<Dataset[]>(
        `/datasets${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`,
      ),
    getDataset: (id: string) => call<Dataset>(`/datasets/${id}`),
    retrieve: (datasetId: string, req: RetrieveRequest) =>
      call<RetrievedSegment[]>(`/datasets/${datasetId}/retrieve`, {
        method: 'POST',
        body: JSON.stringify(req),
      }),
  };
}
