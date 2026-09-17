import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ConnectorHubApp from './ConnectorHubApp.vue';

describe('ConnectorHubApp', () => {
  it('loads and renders the provider-neutral connector catalog', async () => {
    const connectors = {
      list: vi.fn().mockResolvedValue([{ key: { provider: 'native', connectorId: 'email' }, name: '邮件', description: '发送邮件', version: '1.0', actions: [{ id: 'send', name: '发送', inputSchema: '{"type":"object"}', riskLevel: 'WRITE' }] }]),
      listInstallations: vi.fn().mockResolvedValue([{ id: 'i1', tenantId: 'default', provider: 'native', connectorId: 'email', enabled: true }]),
      listConnections: vi.fn().mockResolvedValue([]),
    };
    const wrapper = mount(ConnectorHubApp, { props: { client: { connectors } as any }, global: { stubs: { ConnectorActionTestDrawer: true, ConnectorConnectionModal: true, ConnectorDetailDrawer: true } } });
    await flushPromises();
    expect(wrapper.text()).toContain('邮件');
    expect(wrapper.text()).toContain('发送邮件');
    expect(wrapper.text()).toContain('已启用');
  });

  it('loads tenant-scoped channel audits and exposes operator details', async () => {
    const connectors = {
      list: vi.fn().mockResolvedValue([]), listInstallations: vi.fn().mockResolvedValue([]),
      listConnections: vi.fn().mockResolvedValue([]),
      listChannelAudits: vi.fn().mockResolvedValue([{
        id: 'audit-1', action: 'CHANNEL_MESSAGE_REPLY', resourceType: 'CHANNEL_EVENT',
        resourceId: 'event-1', actorId: 'employee-7', actorName: '张三', principalType: 'USER',
        outcome: 'SUCCESS', details: { provider: 'native', channelId: 'qqbot' },
        createdAt: '2026-08-20T10:00:00',
      }]),
    };
    const wrapper = mount(ConnectorHubApp, { props: { client: { connectors } as any }, global: { stubs: { ConnectorActionTestDrawer: true, ConnectorConnectionModal: true, ConnectorDetailDrawer: true } } });
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '执行审计')!.trigger('click');
    await flushPromises();

    expect(connectors.listChannelAudits).toHaveBeenCalledWith({
      action: '', resourceType: '', resourceId: '', actorId: '', outcome: '', limit: 100,
    });
    expect(wrapper.text()).toContain('CHANNEL_MESSAGE_REPLY');
    expect(wrapper.text()).toContain('张三');
    expect(wrapper.text()).toContain('provider: native');
    expect(wrapper.text()).not.toContain('tenantId');
  });

  it('lists and replays selected message dead letters', async () => {
    const connectors = {
      list: vi.fn().mockResolvedValue([]), listInstallations: vi.fn().mockResolvedValue([]),
      listConnections: vi.fn().mockResolvedValue([]), listChannelAudits: vi.fn().mockResolvedValue([]),
      listChannelDeadLetters: vi.fn().mockResolvedValueOnce([{
        id: 'dead-1', provider: 'native', channelId: 'qqbot', conversationId: 'c2c:user',
        senderType: 'AGENT', senderActorId: 'agent-1', attempts: 8, status: 'FAILED',
        errorMessage: 'runtime unavailable', createdAt: '2026-08-20T10:00:00',
      }]).mockResolvedValueOnce([]),
      replayChannelDeadLetters: vi.fn().mockResolvedValue({ requested: 1, eligible: 1, requeued: 1 }),
    };
    const wrapper = mount(ConnectorHubApp, { props: { client: { connectors } as any }, global: { stubs: { ConnectorActionTestDrawer: true, ConnectorConnectionModal: true, ConnectorDetailDrawer: true } } });
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '执行审计')!.trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '消息死信')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('runtime unavailable');
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.findAll('button').find((button) => button.text() === '重放所选')!.trigger('click');
    await flushPromises();
    expect(connectors.replayChannelDeadLetters).toHaveBeenCalledWith(['dead-1']);
    expect(wrapper.text()).toContain('暂无消息死信');
  });
});
