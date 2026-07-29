<script setup lang="ts">
import { h } from 'vue';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';

import PromptEditor from '@/components/PromptEditor.vue';
import WfField from '@/workflow/WfField.vue';

defineProps<{ nodeId?: string }>();

const formState: any = defineModel();

const APPROVAL_TYPES = [
  { value: 'approve', label: '审批（是/否）' },
  { value: 'form', label: '表单填写' },
  { value: 'text', label: '文本回复' },
];

const FIELD_TYPES = ['string', 'number', 'boolean', 'select'];

const addField = () => {
  if (!Array.isArray(formState.value.formFields)) formState.value.formFields = [];
  formState.value.formFields.push({
    name: '',
    label: '',
    type: 'string',
    required: false,
  });
};

const removeField = (index: number) => {
  formState.value.formFields.splice(index, 1);
};
</script>

<template>
  <div class="wf-config-section">
    <WfField title="介入类型" required>
      <template #tooltip>
        选择需要人工做的事：审批只有是/否，表单可自定义字段，文本回复要求一段文字。
      </template>
      <a-select
        v-model:value="formState.approvalType"
        :options="APPROVAL_TYPES"
        style="width: 100%"
      />
    </WfField>
  </div>

  <PromptEditor
    class="wf-config-prompt"
    title="提示信息"
    :node-id="nodeId"
    v-model="formState.prompt"
  />

  <div v-if="formState.approvalType === 'form'" class="wf-config-section">
    <WfField title="表单字段">
      <template #operations>
        <a-button
          :icon="h(PlusOutlined)"
          size="small"
          type="primary"
          @click="addField"
        />
      </template>

      <div
        v-if="!formState.formFields || formState.formFields.length === 0"
        class="human-empty"
      >
        点击右上角 + 添加字段
      </div>

      <div class="human-field-list">
        <div
          v-for="(f, index) in formState.formFields"
          :key="index"
          class="human-field-row"
        >
          <a-input
            v-model:value="f.name"
            placeholder="字段名"
            size="small"
            style="width: 100px"
          />
          <a-input
            v-model:value="f.label"
            placeholder="显示名"
            size="small"
            style="flex: 1"
          />
          <a-select
            v-model:value="f.type"
            :options="FIELD_TYPES.map((t) => ({ value: t, label: t }))"
            size="small"
            style="width: 88px"
          />
          <a-checkbox v-model:checked="f.required">必填</a-checkbox>
          <a-button
            :icon="h(DeleteOutlined)"
            size="small"
            type="text"
            danger
            @click="removeField(index)"
          />
        </div>
      </div>
    </WfField>
  </div>

  <div class="wf-config-section">
    <WfField title="超时（秒）" is-subtitle>
      <template #tooltip>
        超过时间无响应时工作流会走超时分支或直接失败。
      </template>
      <a-input-number
        v-model:value="formState.timeout"
        :min="0"
        :step="60"
        style="width: 100%"
      />
    </WfField>
  </div>
</template>

<style scoped>
.human-empty {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 6px;
}

.human-field-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.human-field-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: #f9fafb;
  border-radius: 6px;
}
</style>
