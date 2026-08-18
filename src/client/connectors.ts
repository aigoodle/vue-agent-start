import { qs, type HttpCore } from './core';
import type {
  ConnectorConnection, ConnectorConnectionTestResult, ConnectorDefinition, ConnectorExecutionRecord,
  ConnectorInstallation, ConnectorResult, InstallOpenClawPluginRequest,
  OpenClawPlugin, OpenClawRuntime, OpenClawTool, SaveConnectorConnection,
} from '../connector-hub/types';

const enc = encodeURIComponent;
export interface ConnectorsNamespace {
  list(): Promise<ConnectorDefinition[]>;
  get(provider: string, connectorId: string): Promise<ConnectorDefinition>;
  refresh(): Promise<ConnectorDefinition[]>;
  execute(provider: string, connectorId: string, actionId: string,
    args?: Record<string, unknown>, tenantId?: string): Promise<ConnectorResult>;
  listInstallations(tenantId?: string): Promise<ConnectorInstallation[]>;
  synchronize(tenantId?: string): Promise<ConnectorInstallation[]>;
  setInstallationEnabled(id: string, enabled: boolean, tenantId?: string): Promise<ConnectorInstallation>;
  listConnections(tenantId?: string): Promise<ConnectorConnection[]>;
  saveConnection(request: SaveConnectorConnection): Promise<ConnectorConnection>;
  deleteConnection(id: string, tenantId?: string): Promise<void>;
  testConnection(id: string, tenantId?: string): Promise<ConnectorConnectionTestResult>;
  listExecutions(params?: { tenantId?: string; provider?: string; connectorId?: string; status?: string; limit?: number }): Promise<ConnectorExecutionRecord[]>;
  runtime(): Promise<OpenClawRuntime>;
  plugins(): Promise<OpenClawPlugin[]>;
  openClawTools(): Promise<OpenClawTool[]>;
  installPlugin(request: InstallOpenClawPluginRequest): Promise<OpenClawPlugin>;
  configurePlugin(pluginId: string, config: Record<string, unknown>): Promise<OpenClawPlugin>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
  uninstallPlugin(pluginId: string): Promise<void>;
}

export function createConnectorsNamespace(core: HttpCore): ConnectorsNamespace {
  return {
    list: () => core.request('/connectors'),
    get: (provider, id) => core.request(`/connectors/${enc(provider)}/${enc(id)}`),
    refresh: () => core.request('/connectors/refresh', { method: 'POST' }),
    execute: (provider, id, action, args = {}, tenantId) => core.request(
      `/connectors/${enc(provider)}/${enc(id)}/actions/${enc(action)}/execute${qs({ tenantId })}`,
      { method: 'POST', body: JSON.stringify(args) },
    ),
    listInstallations: (tenantId) => core.request(`/connector-installations${qs({ tenantId })}`),
    synchronize: (tenantId) => core.request(`/connector-installations/synchronize${qs({ tenantId })}`, { method: 'POST' }),
    setInstallationEnabled: (id, enabled, tenantId) => core.request(
      `/connector-installations/${enc(id)}/${enabled ? 'enable' : 'disable'}${qs({ tenantId })}`,
      { method: 'POST' },
    ),
    listConnections: (tenantId) => core.request(`/connector-connections${qs({ tenantId })}`),
    saveConnection: (request) => core.request('/connector-connections', { method: 'POST', body: JSON.stringify(request) }),
    deleteConnection: (id, tenantId) => core.request(`/connector-connections/${enc(id)}${qs({ tenantId })}`, { method: 'DELETE' }),
    testConnection: (id, tenantId) => core.request(`/connector-connections/${enc(id)}/test${qs({ tenantId })}`, { method: 'POST' }),
    listExecutions: (params = {}) => core.request(`/connector-executions${qs(params)}`),
    runtime: () => core.request('/openclaw/runtime'),
    plugins: () => core.request('/openclaw/plugins'),
    openClawTools: () => core.request('/openclaw/tools'),
    installPlugin: (request) => core.request('/openclaw/plugins/install', { method: 'POST', body: JSON.stringify(request) }),
    configurePlugin: (id, config) => core.request(`/openclaw/plugins/${enc(id)}/config`, { method: 'PUT', body: JSON.stringify(config) }),
    setPluginEnabled: (id, enabled) => core.request(`/openclaw/plugins/${enc(id)}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' }),
    uninstallPlugin: (id) => core.request(`/openclaw/plugins/${enc(id)}`, { method: 'DELETE' }),
  };
}
