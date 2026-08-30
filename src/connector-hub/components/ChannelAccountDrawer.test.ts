import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChannelAccountDrawer from './ChannelAccountDrawer.vue';

afterEach(() => {
  document.body.innerHTML = '';
});

function mountDrawer() {
  const client = {
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
        provider: 'openclaw', channelId: 'qqbot', name: 'QQBot', version: '1',
        installed: true, enabled: true, runtimeStatus: 'ONLINE',
      },
    },
  });
  return { client, wrapper };
}

describe('ChannelAccountDrawer Agent version binding', () => {
  it('persists a pinned version on an employee Agent binding', async () => {
    const { client, wrapper } = mountDrawer();
    await wrapper.find('.cad-add').trigger('click');
    await flushPromises();
    const dialog = document.body.querySelector('.cad-form-dialog')!;
    const inputs = dialog.querySelectorAll('input');
    await (inputs[0] as HTMLInputElement).focus();
    await wrapper.findComponent({ name: 'AgentVersionSelect' });

    const textInputs = Array.from(inputs).filter((input) => input.type === 'text');
    textInputs[0].value = 'employee-1';
    textInputs[0].dispatchEvent(new Event('input'));
    textInputs[1].value = '员工 QQ';
    textInputs[1].dispatchEvent(new Event('input'));
    const selects = dialog.querySelectorAll('select');
    selects[1].value = 'agent-1';
    selects[1].dispatchEvent(new Event('change'));
    await flushPromises();
    selects[2].value = 'version-2';
    selects[2].dispatchEvent(new Event('change'));
    await flushPromises();
    (dialog.querySelector('.cad-btn-primary') as HTMLButtonElement).click();
    await flushPromises();

    expect(client.connectors.saveEmployeeAgentBinding)
      .toHaveBeenCalledWith('employee-1', 'agent-1', 'tenant-1', 'version-2');
  });
});
