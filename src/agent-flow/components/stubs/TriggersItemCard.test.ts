import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import { AgentStartClientKey } from '../../../client/vue';
import TriggersItemCard from './TriggersItemCard.vue';

const SelectStub = defineComponent({
  props: ['value'],
  emits: ['change', 'update:value'],
  setup(props, { emit, slots, attrs }) {
    return () => h('select', {
      ...attrs,
      value: props.value,
      onChange: (event: Event) => {
        const value = (event.target as HTMLSelectElement).value;
        emit('change', value);
        emit('update:value', value);
      },
    }, slots.default?.());
  },
});

describe('TriggersItemCard', () => {
  it('loads message connectors and persists the selected channel trigger', async () => {
    const connectors = {
      listChannels: vi.fn().mockResolvedValue([
        { provider: 'openclaw', channelId: 'wechat', name: '企业微信', enabled: true },
        { provider: 'openclaw', channelId: 'telegram', name: 'Telegram', enabled: true },
        { provider: 'openclaw', channelId: 'disabled', name: '已停用渠道', enabled: true },
      ]),
      listChannelConnections: vi.fn().mockResolvedValue([
        { id: 'conn-1', provider: 'openclaw', channelId: 'wechat', name: '客服号', runtimeStatus: 'ONLINE' },
        { id: 'conn-2', provider: 'openclaw', channelId: 'disabled', name: '停用账号', desiredStatus: 'DISABLED', runtimeStatus: 'OFFLINE' },
      ]),
    };
    const model = { triggersEnabled: true, triggers: { type: 'connector' } };
    const wrapper = mount(TriggersItemCard, {
      props: { modelValue: model, 'onUpdate:modelValue': () => undefined },
      global: {
        provide: { [AgentStartClientKey as symbol]: { connectors } },
        stubs: {
          'a-select': SelectStub,
          'a-select-option': defineComponent({
            props: ['value'],
            setup(props, { slots }) { return () => h('option', { value: props.value }, slots.default?.()); },
          }),
          'a-switch': true,
          'a-button': true,
          'a-input': true,
          'a-input-number': true,
          'a-textarea': true,
        },
      },
    });

    await flushPromises();
    expect(connectors.listChannels).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('企业微信');
    expect(wrapper.text()).not.toContain('Telegram');
    expect(wrapper.text()).not.toContain('已停用渠道');

    await wrapper.findAll('select')[0].setValue('openclaw:wechat');
    await flushPromises();
    expect(model.triggers).toMatchObject({
      type: 'connector',
      provider: 'openclaw',
      channelId: 'wechat',
      channelName: '企业微信',
    });
  });
});
