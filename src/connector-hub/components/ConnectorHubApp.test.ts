import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ConnectorHubApp from './ConnectorHubApp.vue';

describe('ConnectorHubApp', () => {
  it('loads and renders the provider-neutral connector catalog', async () => {
    const connectors = {
      list: vi.fn().mockResolvedValue([{ key: { provider: 'openclaw', connectorId: 'mail' }, name: '邮件', description: '发送邮件', version: '1.0', actions: [{ id: 'send', name: '发送', inputSchema: '{"type":"object"}', riskLevel: 'WRITE' }] }]),
      listInstallations: vi.fn().mockResolvedValue([{ id: 'i1', tenantId: 'default', provider: 'openclaw', connectorId: 'mail', enabled: true }]),
      listConnections: vi.fn().mockResolvedValue([]),
    };
    const wrapper = mount(ConnectorHubApp, { props: { client: { connectors } as any }, global: { stubs: { ConnectorActionTestDrawer: true, ConnectorConnectionModal: true, ConnectorDetailDrawer: true, OpenClawPluginPanel: true } } });
    await flushPromises();
    expect(wrapper.text()).toContain('邮件');
    expect(wrapper.text()).toContain('发送邮件');
    expect(wrapper.text()).toContain('已启用');
  });
});
