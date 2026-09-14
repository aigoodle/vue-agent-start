export type ConnectorRiskLevel = 'READ' | 'WRITE' | 'DESTRUCTIVE' | string;
export type ConnectorCapability = 'CHANNEL_INBOUND' | 'CHANNEL_OUTBOUND' | 'ACTION' | 'EVENT';

export interface ConnectorKey { provider: string; connectorId: string }
export interface ConnectorAction {
  id: string; name: string; description?: string; inputSchema: string;
  outputSchema?: string; idempotent?: boolean; timeout?: string;
  riskLevel?: ConnectorRiskLevel; metadata?: Record<string, unknown>;
  capabilities?: ConnectorCapability[];
}
export interface ConnectorDefinition {
  key: ConnectorKey; name: string; description?: string; version?: string;
  source?: string; icon?: string; category?: string; configurationSchema?: string;
  actions: ConnectorAction[]; trustLevel?: string; license?: string;
  capabilities?: ConnectorCapability[];
  metadata?: Record<string, unknown>;
}
export interface ConnectorInstallation {
  id: string; tenantId: string; provider: string; connectorId: string;
  version?: string; source?: string; enabled: boolean; trustLevel?: string;
}
export interface ConnectorConnection {
  id: string; tenantId: string; installationId: string; name: string;
  status: string; credentialsConfigured: boolean;
}
export interface SaveConnectorConnection {
  id?: string; tenantId?: string; installationId: string; name: string;
  credentials?: Record<string, unknown>; config?: Record<string, unknown>;
}
export interface ConnectorError { code: string; message: string; retryable?: boolean }
export interface ConnectorResult {
  success: boolean; data?: unknown; content?: unknown[]; error?: ConnectorError;
  metadata?: Record<string, unknown>;
}
export interface ConnectorConnectionTestResult { success: boolean; code: string; message: string }
export interface OpenClawRuntime {
  status: string; version?: string; bridgeVersion?: string; startedAt?: string;
  inbound?: {
    observed?: number; callbackAttempts?: number; callbackSucceeded?: number; callbackFailed?: number;
    lastObservedAt?: string; lastCallbackSucceededAt?: string; lastCallbackFailedAt?: string;
    lastCallbackError?: string;
  };
  capabilities?: string[];
}
export interface OpenClawPlugin {
  id: string; name: string; version?: string; description?: string; enabled: boolean;
  license?: string; configSchema?: string; metadata?: Record<string, unknown>;
}
export interface OpenClawTool {
  pluginId: string; name: string; label?: string; description?: string;
  inputSchema?: string; risk?: string; tags?: string[]; metadata?: Record<string, unknown>;
}
export interface ChannelDefinition {
  provider: string; channelId: string; name: string; description?: string; version?: string;
  installed: boolean; enabled: boolean; runtimeStatus: string;
  credentialSchema?: string; configurationSchema?: string;
  uiSchema?: Record<string, unknown>; capabilities?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
export interface ChannelAccount {
  channelId: string; accountId: string; name: string; enabled: boolean;
  configured: boolean; running: boolean; connected: boolean;
  lastConnectedAt?: string; lastError?: string; metadata?: Record<string, unknown>;
}
export type ChannelRuntimeNodes = Record<string, string[]>;
export interface ChannelConnection {
  id: string; tenantId: string; ownerType: string; ownerId: string;
  provider: string; channelId: string; name: string; desiredStatus: string;
  runtimeStatus: string; runtimeAccountId: string; runtimeNodeId?: string; agentId?: string; agentVersionId?: string;
  runtimeMetadata?: Record<string, unknown>;
  credentialsConfigured: boolean; lastError?: string; lastTestedAt?: string;
  configVersion: number;
}
export interface SaveChannelConnection {
  id?: string; tenantId?: string; ownerType?: string; ownerId: string;
  provider: string; channelId: string; name: string;
  credentials?: Record<string, unknown>; config?: Record<string, unknown>;
  enabled?: boolean; agentId?: string; agentVersionId?: string; runtimeNodeId?: string;
}
export interface ChannelEvent {
  id: string; tenantId: string; connectionId?: string; runtimeNodeId?: string; ownerId?: string;
  provider: string; channelId: string; accountId: string; messageId?: string;
  senderId?: string; replyTargetId?: string; conversationId?: string; direction: string; content?: string;
  messageType?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE' | 'RICH_TEXT' | string;
  attachments?: ChannelAttachment[]; contentPayload?: Record<string, unknown>;
  replyToEventId?: string;
  handled: boolean; status: string; replyContent?: string; durationMs?: number;
  errorMessage?: string; idempotencyKey?: string; platformMessageId?: string;
  senderType?: 'AGENT' | 'EMPLOYEE' | 'ADMIN' | 'SYSTEM'; senderActorId?: string;
  attempts?: number; nextAttemptAt?: string; sentAt?: string; deliveredAt?: string;
  eventTime?: string; createdAt?: string;
}
export interface ChannelAttachment {
  type: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE' | string;
  url?: string; name?: string; mimeType?: string; size?: number;
  metadata?: Record<string, unknown>;
}
export interface ChannelEventPage { items: ChannelEvent[]; nextCursor?: string; hasMore: boolean }
export interface ChannelConversation {
  id: string; tenantId: string; connectionId: string; ownerId?: string;
  provider: string; channelId: string; accountId: string; conversationId: string;
  agentId?: string; agentVersionId?: string; agentRouteReason?: string; routingPolicyVersion: number;
  status: 'BOT_ACTIVE' | 'WAITING_HUMAN' | 'HUMAN_ACTIVE' | 'CLOSED';
  agentPaused: boolean; assigneeId?: string; assigneeName?: string; assignmentGroup?: string;
  handoffRequestedAt?: string; claimedAt?: string; closedAt?: string; lastMessageAt?: string;
  lastEventId?: string; lastMessagePreview?: string; unreadCount: number; slaDueAt?: string;
  slaBreached: boolean; lockVersion: number;
}
export interface ChannelConversationPage {
  items: ChannelConversation[]; nextCursor?: string; hasMore: boolean;
}
export interface ChannelConversationSummary {
  total: number; waitingHuman: number; humanActive: number; slaBreached: number; unread: number;
}
export interface TenantAgentBinding { id: string; tenantId: string; defaultAgentId: string; defaultAgentVersionId?: string; fallbackAgentId?: string; fallbackAgentVersionId?: string; routingPolicyVersion: number; enabled: boolean }
export interface EmployeeAgentBinding { id: string; tenantId: string; employeeId: string; agentId: string; agentVersionId?: string; routingPolicyVersion: number; enabled: boolean }
export interface ChannelIdentity {
  id: string; tenantId: string; provider: string; channelId: string; accountId: string;
  externalUserId: string; enterpriseUserId: string; verificationStatus: string; enabled: boolean;
}
export interface InstallOpenClawPluginRequest {
  sourceType: string; source: string; version?: string;
}
export interface OpenClawPluginInstallProgress {
  percent: number; stage: string; message: string;
}
export interface ConnectorExecutionRecord {
  id: string; tenantId: string; provider: string; connectorId: string; actionId: string;
  installationId?: string; connectionId?: string; agentId?: string; workflowId?: string;
  runId?: string; nodeId?: string; status: string; durationMs?: number;
  errorCode?: string; errorMessage?: string; createdAt?: string;
}
export interface ChannelAuditRecord {
  id: string; tenantId: string; actorId?: string; actorName?: string; principalType?: string;
  action: string; resourceType: string; resourceId: string; outcome: string;
  details?: Record<string, unknown>; createdAt?: string;
}
export interface ChannelDeadLetterReplayResult { requested: number; eligible: number; requeued: number }

/**
 * 宿主业务系统注入的当前人员信息。组件模块不产生人员数据 —— 由宿主
 * (如 vben 的 useUserStore)在页面上通过 prop 传入。`userId` 必填,
 * 其余字段按宿主提供的粒度按需使用。
 */
export interface RobotUser {
  userId: string;
  username?: string;
  realName?: string;
  avatar?: string;
  [key: string]: unknown;
}

/** Channel connection projected as a user-facing robot card; optional fields are presentation metadata. */
export interface MyRobot extends ChannelConnection {
  icon?: string;
  iconBackground?: string;
  description?: string;
  welcomeMessage?: string;
  agentName?: string;
  createdByName?: string;
  updatedAt?: string;
}

export interface JsonSchema {
  writeOnly?: boolean;
  type?: string; title?: string; description?: string; format?: string;
  properties?: Record<string, JsonSchema>; required?: string[]; enum?: unknown[];
  default?: unknown; items?: JsonSchema; additionalProperties?: boolean | JsonSchema;
  minimum?: number; maximum?: number;
}

export function parseJsonSchema(value?: string | JsonSchema): JsonSchema {
  if (!value) return { type: 'object', properties: {}, additionalProperties: true };
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as JsonSchema; }
  catch { return { type: 'object', properties: {}, additionalProperties: true }; }
}
