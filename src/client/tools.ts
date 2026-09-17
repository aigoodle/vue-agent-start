import type { HttpCore } from './core';

export interface ToolCatalogItem {
  name: string;
  label?: string;
  description?: string;
  inputSchema?: string | Record<string, unknown>;
  source?: string;
  category?: string;
  provider?: string;
  mcpServerId?: string;
}

export interface McpServerCatalogItem {
  id: string;
  name: string;
  transport: 'HTTP' | 'STDIO';
  enabled: boolean;
  status?: string;
  toolCount?: number;
  lastError?: string;
}

export interface ToolsNamespace {
  list(): Promise<ToolCatalogItem[]>;
  listMcpServers(): Promise<McpServerCatalogItem[]>;
}

export function createToolsNamespace(core: HttpCore): ToolsNamespace {
  return {
    list: () => core.request<ToolCatalogItem[]>('/tools'),
    listMcpServers: () =>
      core.request<McpServerCatalogItem[]>('/mcp-servers'),
  };
}
