import { createAgentStartClient, type AgentStartClientOptions } from '../../client';
export function useConnectorHub(options: AgentStartClientOptions = {}) {
  return createAgentStartClient(options).connectors;
}
