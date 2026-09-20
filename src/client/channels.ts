import type { HttpCore } from './core';
import { createConnectorsNamespace, type ConnectorsNamespace } from './connectors';

/** Channel gateway API, separated from callable business connectors. */
export type ChannelsNamespace = Pick<ConnectorsNamespace,
  | 'listChannelAudits'
  | 'listChannelDeadLetters'
  | 'replayChannelDeadLetters'
  | 'listChannels'
  | 'listChannelRuntimeNodes'
  | 'listChannelAccounts'
  | 'listChannelConnections'
  | 'getChannelConnectionConfiguration'
  | 'saveChannelConnection'
  | 'testChannelConnection'
  | 'deleteChannelConnection'
  | 'listChannelEvents'
  | 'pageChannelEvents'
  | 'retryChannelEvent'
  | 'handoffChannelEvent'
  | 'replyChannelEvent'
  | 'listChannelConversations'
  | 'pageChannelConversations'
  | 'getChannelConversation'
  | 'getChannelConversationSummary'
  | 'claimChannelConversation'
  | 'resumeChannelConversationBot'
  | 'closeChannelConversation'
  | 'addChannelConversationNote'
  | 'getTenantAgentBinding'
  | 'saveTenantAgentBinding'
  | 'getEmployeeAgentBinding'
  | 'saveEmployeeAgentBinding'
  | 'listChannelIdentities'
  | 'saveChannelIdentity'
>;

export function createChannelsNamespace(core: HttpCore): ChannelsNamespace {
  // Reuse the stable transport implementation while presenting a bounded,
  // channel-only public namespace. The legacy client.connectors methods remain.
  return createConnectorsNamespace(core);
}
