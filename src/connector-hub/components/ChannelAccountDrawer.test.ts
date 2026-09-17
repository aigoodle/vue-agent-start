import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChannelAccountDrawer from './ChannelAccountDrawer.vue';

afterEach(() => {
  document.body.innerHTML = '';
});

function mountDrawer() {
  const client = {
    proxyBase: '/api',
    namespace: '/agent-start',
    rootUrl: '/api/agent-start',
    agents: {
      listVersions: vi.fn().mockResolvedValue([{
        id: 'version-2', tenantId: 'tenant-1', appId: 'agent-1', versionNumber: 2,
        status: 'ACTIVE', publishedAt: '2026-08-20T00:00:00Z',
      }]),
    },
    connectors: {
      saveChannelConnection: vi.fn().mockResolvedValue({}),
      saveEmployeeAgentBinding: vi.fn().mockResolvedValue({}),
    },
  } as any;
  const wrapper = mount(ChannelAccountDrawer, {
    attachTo: document.body,
    props: {
      open: true,
      client,
      tenantId: 'tenant-1',
      agents: [{ id: 'agent-1', name: '客服 Agent' }],
      connections: [],
      channel: {
        provider: 'native', channelId: 'qqbot', name: 'QQBot', version: '1',
        installed: true, enabled: true, runtimeStatus: 'ONLINE',
      },
    },
  });
  return { client, wrapper };
}

describe('ChannelAccountDrawer employee-owned account', () => {
  it('shows the exact native callback path for a saved webhook account', async () => {
    const { wrapper } = mountDrawer();
    await wrapper.setProps({
      connections: [{
        id: 'connection-7', tenantId: 'tenant-1', ownerId: 'employee-1', ownerType: 'USER',
        provider: 'native', channelId: 'qqbot', name: 'QQ 客服', desiredStatus: 'ACTIVE',
        runtimeStatus: 'ONLINE', runtimeAccountId: 'runtime-account-7', credentialsConfigured: true,
        configVersion: 1, runtimeMetadata: { transport: 'webhook' },
      }],
    });

    expect(wrapper.find('.cad-callback').text()).toBe(
      '/api/agent-start/channel-events/native/qqbot/runtime-account-7',
    );
    expect(wrapper.text()).toContain('复制回调地址');
    expect(wrapper.text()).toContain('已就绪 · 等待平台回调');
  });

  it('saves employee credentials without binding an Agent or application', async () => {
    const { client, wrapper } = mountDrawer();
    await wrapper.find('.cad-add').trigger('click');
    await flushPromises();
    const dialog = document.body.querySelector('.cad-form-dialog')!;
    const inputs = dialog.querySelectorAll('input');
    const textInputs = Array.from(inputs).filter((input) => input.type === 'text');
    textInputs[0].value = 'employee-1';
    textInputs[0].dispatchEvent(new Event('input'));
    textInputs[1].value = '员工 QQ';
    textInputs[1].dispatchEvent(new Event('input'));
    await flushPromises();
    (dialog.querySelector('.cad-btn-primary') as HTMLButtonElement).click();
    await flushPromises();

    expect(client.connectors.saveChannelConnection).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'employee-1', name: '员工 QQ' }),
    );
    const request = client.connectors.saveChannelConnection.mock.calls[0][0];
    expect(request).not.toHaveProperty('agentId');
    expect(request).not.toHaveProperty('agentVersionId');
    expect(client.connectors.saveEmployeeAgentBinding).not.toHaveBeenCalled();
  });
});
