import { inject, type InjectionKey } from 'vue';

import type { MaybePromise } from './client';
import { AgentStartUi } from './ui';

export type AgentStartHeaders =
  | Record<string, string>
  | (() => MaybePromise<Record<string, string>>);

export interface AgentStartPluginOptions {
  /** Default backend proxy prefix inherited by all top-level components. */
  apiBase?: string;
  /** Global headers. Functions are evaluated before every request. */
  headers?: AgentStartHeaders;
}

const AgentStartConfigKey: InjectionKey<AgentStartPluginOptions> = Symbol(
  'agent-start.Config',
);

/** Global Vue plugin used with `app.use(AgentStartPlugin, options)`. */
export const AgentStartPlugin = {
  install(
    app: import('vue').App,
    options: AgentStartPluginOptions = {},
  ) {
    app.use(AgentStartUi);
    app.provide(AgentStartConfigKey, options);
  },
};

export function useAgentStartConfig(): AgentStartPluginOptions {
  return inject(AgentStartConfigKey, {});
}

async function evaluateHeaders(
  value?: AgentStartHeaders,
): Promise<Record<string, string>> {
  if (!value) return {};
  return (typeof value === 'function' ? await value() : value) ?? {};
}

/** Global headers are applied first; component-local headers override them. */
export async function mergeAgentStartHeaders(
  globalHeaders?: AgentStartHeaders,
  localHeaders?: AgentStartHeaders,
): Promise<Record<string, string>> {
  return {
    ...(await evaluateHeaders(globalHeaders)),
    ...(await evaluateHeaders(localHeaders)),
  };
}
