import type { HttpCore } from './core';

export type TriggerType = 'WEBHOOK' | 'CRON' | 'EVENT' | 'MANUAL';

export interface TriggerScheduleConfig {
  scheduleType: 'CRON' | 'ONE' | 'ONCE';
  expression?: string;
  runAt?: string;
  timeZone?: string;
  conversationId?: string;
  data?: Record<string, unknown>;
  /** @deprecated Use data. */
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreateTriggerRequest {
  name: string;
  type: TriggerType;
  targetType?: string;
  targetId: string;
  config: TriggerScheduleConfig | Record<string, unknown>;
  enabled?: boolean;
}

export interface TriggerWire extends CreateTriggerRequest {
  id: string;
  nextFireAt?: string | null;
  lastFireAt?: string | null;
  fireCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TriggerInvocationWire {
  id: string;
  triggerId: string;
  source: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  conversationId?: string;
  runId?: string;
  error?: string;
  createdAt?: string;
}

export interface TriggersNamespace {
  list(): Promise<TriggerWire[]>;
  get(id: string): Promise<TriggerWire>;
  create(request: CreateTriggerRequest): Promise<TriggerWire>;
  createFromJson(json: string): Promise<TriggerWire>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  fire(id: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>>;
  invocations(id: string): Promise<TriggerInvocationWire[]>;
}

export function createTriggersNamespace(core: HttpCore): TriggersNamespace {
  return {
    list: () => core.request<TriggerWire[]>('/triggers'),
    get: (id) => core.request<TriggerWire>(`/triggers/${encodeURIComponent(id)}`),
    create: (request) => core.request<TriggerWire>('/triggers', {
      method: 'POST', body: JSON.stringify(request),
    }),
    createFromJson: (json) => core.request<TriggerWire>('/triggers/from-json', {
      method: 'POST', body: json, headers: { 'Content-Type': 'text/plain' },
    }, { json: false }),
    setEnabled: (id, enabled) => core.request<void>(
      `/triggers/${encodeURIComponent(id)}/enabled?enabled=${enabled}`, { method: 'PUT' },
    ),
    remove: (id) => core.request<void>(`/triggers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    fire: (id, payload = {}) => core.request<Record<string, unknown>>(
      `/triggers/${encodeURIComponent(id)}/fire`, { method: 'POST', body: JSON.stringify(payload) },
    ),
    invocations: (id) => core.request<TriggerInvocationWire[]>(
      `/triggers/${encodeURIComponent(id)}/invocations`,
    ),
  };
}
