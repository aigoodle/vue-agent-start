import { qs, type HttpCore } from './core';
import type {
  ConnectorConnection, ConnectorConnectionTestResult, ConnectorDefinition, ConnectorExecutionRecord, ChannelAuditRecord, ChannelDeadLetterReplayResult,
  ChannelAccount, ChannelAttachment, ChannelConnection, ChannelConversation, ChannelConversationPage, ChannelConversationSummary, ChannelDefinition, ChannelEvent, ChannelEventPage, ChannelIdentity, ChannelRuntimeNodes, EmployeeAgentBinding, TenantAgentBinding, ConnectorInstallation, ConnectorResult, InstallOpenClawPluginRequest,
  OpenClawPlugin, OpenClawRuntime, OpenClawTool, OpenClawPluginInstallProgress, SaveConnectorConnection,
  SaveChannelConnection,
} from '../connector-hub/types';
import { readSseEvents } from './sse';

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
  listChannelAudits(params?: { action?: string; resourceType?: string; resourceId?: string; actorId?: string; outcome?: string; limit?: number }): Promise<ChannelAuditRecord[]>;
  listChannelDeadLetters(limit?: number): Promise<ChannelEvent[]>;
  replayChannelDeadLetters(eventIds: string[]): Promise<ChannelDeadLetterReplayResult>;
  runtime(): Promise<OpenClawRuntime>;
  plugins(): Promise<OpenClawPlugin[]>;
  openClawTools(): Promise<OpenClawTool[]>;
  installPlugin(request: InstallOpenClawPluginRequest): Promise<OpenClawPlugin>;
  installPluginStream(request: InstallOpenClawPluginRequest,
    onProgress: (progress: OpenClawPluginInstallProgress) => void): Promise<OpenClawPlugin>;
  configurePlugin(pluginId: string, config: Record<string, unknown>): Promise<OpenClawPlugin>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
  uninstallPlugin(pluginId: string): Promise<void>;
  listChannels(refresh?: boolean, runtimeNodeId?: string): Promise<ChannelDefinition[]>;
  listChannelRuntimeNodes(): Promise<ChannelRuntimeNodes>;
  /** Deployment-scoped diagnostics. Requires PLATFORM_ADMIN/SYSTEM_ADMIN/DEPLOYMENT_ADMIN by default. */
  listChannelAccounts(provider: string, channelId: string): Promise<ChannelAccount[]>;
  listChannelConnections(tenantId?: string, ownerId?: string): Promise<ChannelConnection[]>;
  saveChannelConnection(request: SaveChannelConnection): Promise<ChannelConnection>;
  testChannelConnection(id: string, tenantId?: string): Promise<ChannelConnection>;
  deleteChannelConnection(id: string, tenantId?: string): Promise<void>;
  listChannelEvents(params?: { tenantId?: string; connectionId?: string; limit?: number }): Promise<ChannelEvent[]>;
  pageChannelEvents(params?: { connectionId?: string; conversationId?: string; cursor?: string; limit?: number }): Promise<ChannelEventPage>;
  retryChannelEvent(id: string, tenantId?: string): Promise<ChannelEvent>;
  handoffChannelEvent(id: string, note?: string, tenantId?: string, assignmentGroup?: string): Promise<ChannelEvent>;
  replyChannelEvent(id: string, request: { content?: string; messageType?: string; attachments?: ChannelAttachment[]; contentPayload?: Record<string, unknown>; idempotencyKey?: string }, tenantId?: string): Promise<ChannelEvent>;
  listChannelConversations(params?: { status?: string; assigneeId?: string; slaBreached?: boolean; limit?: number }): Promise<ChannelConversation[]>;
  pageChannelConversations(params?: { status?: string; assigneeId?: string; slaBreached?: boolean; provider?: string; channelId?: string; cursor?: string; limit?: number }): Promise<ChannelConversationPage>;
  getChannelConversation(id: string): Promise<ChannelConversation>;
  getChannelConversationSummary(): Promise<ChannelConversationSummary>;
  claimChannelConversation(id: string, expectedVersion: number, assignmentGroup?: string): Promise<ChannelConversation>;
  resumeChannelConversationBot(id: string, expectedVersion: number): Promise<ChannelConversation>;
  closeChannelConversation(id: string, expectedVersion: number): Promise<ChannelConversation>;
  addChannelConversationNote(id: string, content: string): Promise<ChannelEvent>;
  getTenantAgentBinding(tenantId?: string): Promise<TenantAgentBinding | null>;
  saveTenantAgentBinding(tenantId: string | undefined, request: { defaultAgentId: string; defaultAgentVersionId?: string; fallbackAgentId?: string; fallbackAgentVersionId?: string; enabled?: boolean }): Promise<TenantAgentBinding>;
  getEmployeeAgentBinding(employeeId: string, tenantId?: string): Promise<EmployeeAgentBinding | null>;
  saveEmployeeAgentBinding(employeeId: string, agentId: string, tenantId?: string, agentVersionId?: string): Promise<EmployeeAgentBinding>;
  listChannelIdentities(tenantId?: string): Promise<ChannelIdentity[]>;
  saveChannelIdentity(request: Omit<ChannelIdentity, 'id' | 'tenantId'>, tenantId?: string): Promise<ChannelIdentity>;
}

export function createConnectorsNamespace(core: HttpCore): ConnectorsNamespace {
  return {
    list: () => core.request('/connectors'),
    get: (provider, id) => core.request(`/connectors/${enc(provider)}/${enc(id)}`),
    refresh: () => core.request('/connectors/refresh', { method: 'POST' }),
    execute: (provider, id, action, args = {}) => core.request(
      `/connectors/${enc(provider)}/${enc(id)}/actions/${enc(action)}/execute`,
      { method: 'POST', body: JSON.stringify(args) },
    ),
    listInstallations: () => core.request('/connector-installations'),
    synchronize: () => core.request('/connector-installations/synchronize', { method: 'POST' }),
    setInstallationEnabled: (id, enabled) => core.request(
      `/connector-installations/${enc(id)}/${enabled ? 'enable' : 'disable'}`,
      { method: 'POST' },
    ),
    listConnections: () => core.request('/connector-connections'),
    saveConnection: (request) => core.request('/connector-connections', { method: 'POST', body: JSON.stringify(request) }),
    deleteConnection: (id) => core.request(`/connector-connections/${enc(id)}`, { method: 'DELETE' }),
    testConnection: (id) => core.request(`/connector-connections/${enc(id)}/test`, { method: 'POST' }),
    listExecutions: (params = {}) => {
      const { tenantId: _ignored, ...trustedParams } = params;
      return core.request(`/connector-executions${qs(trustedParams)}`);
    },
    listChannelAudits: (params = {}) => core.request(`/channel-audits${qs(params)}`),
    listChannelDeadLetters: (limit = 100) => core.request(`/channel-dead-letters${qs({ limit })}`),
    replayChannelDeadLetters: (eventIds) => core.request('/channel-dead-letters/replay', {
      method: 'POST', body: JSON.stringify({ eventIds }),
    }),
    runtime: () => core.request('/openclaw/runtime'),
    plugins: () => core.request('/openclaw/plugins'),
    openClawTools: () => core.request('/openclaw/tools'),
    installPlugin: (request) => core.request('/openclaw/plugins/install', { method: 'POST', body: JSON.stringify(request) }),
    installPluginStream: async (request, onProgress) => {
      const response = await core.raw('/openclaw/plugins/install/stream', {
        method: 'POST', headers: { Accept: 'text/event-stream' }, body: JSON.stringify(request),
      }, { timeoutMs: 300_000 });
      let installed: OpenClawPlugin | undefined;
      for await (const event of readSseEvents(response)) {
        const data = event.data ? JSON.parse(event.data) : {};
        if (event.event === 'progress') onProgress(data as OpenClawPluginInstallProgress);
        else if (event.event === 'result') installed = data as OpenClawPlugin;
        else if (event.event === 'error') throw new Error(String(data?.message ?? '插件安装失败'));
      }
      if (!installed) throw new Error('安装流程已结束，但未收到插件信息');
      return installed;
    },
    configurePlugin: (id, config) => core.request(`/openclaw/plugins/${enc(id)}/config`, { method: 'PUT', body: JSON.stringify(config) }),
    setPluginEnabled: (id, enabled) => core.request(`/openclaw/plugins/${enc(id)}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' }),
    uninstallPlugin: (id) => core.request(`/openclaw/plugins/${enc(id)}`, { method: 'DELETE' }),
    listChannels: (refresh = false, runtimeNodeId) => core.request(`/channels${qs({ refresh: refresh ? 'true' : undefined, runtimeNodeId })}`),
    listChannelRuntimeNodes: () => core.request('/channels/runtime-nodes'),
    listChannelAccounts: (provider, channelId) => core.request(`/channels/${enc(provider)}/${enc(channelId)}/accounts`),
    listChannelConnections: (_tenantId, ownerId) => core.request(`/channel-connections${qs({ ownerId })}`),
    saveChannelConnection: (request) => core.request('/channel-connections', { method: 'POST', body: JSON.stringify(request) }),
    testChannelConnection: (id) => core.request(`/channel-connections/${enc(id)}/test`, { method: 'POST' }),
    deleteChannelConnection: (id) => core.request(`/channel-connections/${enc(id)}`, { method: 'DELETE' }),
    listChannelEvents: (params = {}) => {
      const { tenantId: _ignored, ...trustedParams } = params;
      return core.request(`/channel-events${qs(trustedParams)}`);
    },
    pageChannelEvents: (params = {}) => core.request(`/channel-events/page${qs(params)}`),
    retryChannelEvent: (id) => core.request(`/channel-events/${enc(id)}/retry`, { method: 'POST' }),
    handoffChannelEvent: (id, note, _tenantId, assignmentGroup) => core.request(`/channel-events/${enc(id)}/handoff`, { method: 'POST', body: JSON.stringify({ note, assignmentGroup }) }),
    replyChannelEvent: (id, request) => core.request(`/channel-events/${enc(id)}/reply`, { method: 'POST', body: JSON.stringify(request) }),
    listChannelConversations: (params = {}) => core.request(`/channel-conversations${qs({
      ...params, slaBreached: params.slaBreached == null ? undefined : String(params.slaBreached),
    })}`),
    pageChannelConversations: (params = {}) => core.request(`/channel-conversations/page${qs({
      ...params, slaBreached: params.slaBreached == null ? undefined : String(params.slaBreached),
    })}`),
    getChannelConversation: (id) => core.request(`/channel-conversations/${enc(id)}`),
    getChannelConversationSummary: () => core.request('/channel-conversations/summary'),
    claimChannelConversation: (id, expectedVersion, assignmentGroup) => core.request(`/channel-conversations/${enc(id)}/claim`, { method: 'POST', body: JSON.stringify({ expectedVersion, assignmentGroup }) }),
    resumeChannelConversationBot: (id, expectedVersion) => core.request(`/channel-conversations/${enc(id)}/resume-bot`, { method: 'POST', body: JSON.stringify({ expectedVersion }) }),
    closeChannelConversation: (id, expectedVersion) => core.request(`/channel-conversations/${enc(id)}/close`, { method: 'POST', body: JSON.stringify({ expectedVersion }) }),
    addChannelConversationNote: (id, content) => core.request(`/channel-conversations/${enc(id)}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
    getTenantAgentBinding: () => core.request('/tenant-agent-bindings/current'),
    saveTenantAgentBinding: (_tenantId, request) => core.request('/tenant-agent-bindings/current', { method: 'PUT', body: JSON.stringify(request) }),
    getEmployeeAgentBinding: (employeeId) => core.request(`/employee-agent-bindings/${enc(employeeId)}`),
    saveEmployeeAgentBinding: (employeeId, agentId, _tenantId, agentVersionId) => core.request(`/employee-agent-bindings/${enc(employeeId)}`, { method: 'PUT', body: JSON.stringify({ agentId, agentVersionId, enabled: true }) }),
    listChannelIdentities: () => core.request('/channel-identities'),
    saveChannelIdentity: (request) => core.request('/channel-identities', { method: 'PUT', body: JSON.stringify(request) }),
  };
}
