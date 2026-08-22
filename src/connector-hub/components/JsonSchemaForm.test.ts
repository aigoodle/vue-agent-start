import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import JsonSchemaForm from './JsonSchemaForm.vue';

describe('JsonSchemaForm', () => {
  it('renders schema fields and emits typed values', async () => {
    const wrapper = mount(JsonSchemaForm, { props: { schema: JSON.stringify({ type: 'object', properties: { retries: { type: 'integer', title: '重试次数' } } }) } });
    expect(wrapper.text()).toContain('重试次数');
    await wrapper.get('input[type="number"]').setValue('3');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({ retries: 3 });
  });

  it('does not force workflow users to edit raw JSON when no fields are declared', () => {
    const wrapper = mount(JsonSchemaForm, {
      props: {
        schema: JSON.stringify({ type: 'object', additionalProperties: true }),
        allowAdvanced: false,
        emptyText: '连接器未声明字段',
      },
    });
    expect(wrapper.text()).toContain('连接器未声明字段');
    expect(wrapper.find('textarea').exists()).toBe(false);
  });
});
