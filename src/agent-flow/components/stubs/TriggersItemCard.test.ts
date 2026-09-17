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
        { provider: 'native', channelId: 'wecom', name: '企业微信', enabled: true },
        { provider: 'native', channelId: 'qqbot', name: 'QQBot', enabled: true },
        { provider: 'native', channelId: 'disabled', name: '已停用渠道', enabled: true, runtimeStatus: 'DISABLED' },
      ]),
    };
    const model = { triggersEnabled: true, triggers: {
      type: 'connector', connectionId: 'legacy-employee-account', connectionName: '旧员工账号',
    } };
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

    await wrapper.findAll('select')[0].setValue('native:wecom');
    await flushPromises();
    expect(model.triggers).toMatchObject({
      type: 'connector',
      provider: 'native',
      channelId: 'wecom',
      channelName: '企业微信',
    });
    expect(model.triggers).not.toHaveProperty('connectionId');
  });
});
