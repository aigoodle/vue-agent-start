/**
 * Public channel/gateway model types.
 *
 * The canonical declarations temporarily remain in connector-hub/types so
 * existing consumers keep compiling. New code should import from channel-hub.
 */
export type {
  ChannelAccount,
  ChannelAccountModel,
  ChannelAccountScope,
  ChannelAttachment,
  ChannelAuditRecord,
  ChannelConnection,
  ChannelConnectionEditConfiguration,
  ChannelConversation,
  ChannelConversationPage,
  ChannelConversationSummary,
  ChannelDeadLetterReplayResult,
  ChannelDefinition,
  ChannelEvent,
  ChannelEventPage,
  ChannelIdentity,
  ChannelIdentityBridgeDefinition,
  ChannelInstancePolicy,
  ChannelRuntimeNodes,
  EmployeeAgentBinding,
  MyRobot,
  RobotUser,
  SaveChannelConnection,
  TenantAgentBinding,
} from '../connector-hub/types';
