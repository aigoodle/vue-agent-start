<script setup lang="ts">
import { ref } from 'vue';

import { getCurrentModel } from '@/adapter/backend';
import MemoryWindow from '@/components/MemoryWindow.vue';
import PromptEditor from '@/components/PromptEditor.vue';
import PromptEditorTagPanel from '@/components/PromptEditorTagPanel.vue';
import ModelPickerPopover from '../../../provider-hub/components/ModelPickerPopover.vue';
import OutputItemCard from '@/workflow/OutputItemCard.vue';
import WfField from '@/workflow/WfField.vue';
import workflow_utils from '@/workflow/utils/workflow_utils';

defineProps({
  attrListGroup: {
    type: Array,
    default: () => [],
  },
  /** 当前节点 id —— 变量插入面板需要，由 NodeConfigCard 从 selectNode.id 传下来。 */
  nodeId: {
    type: String,
    default: '',
  },
});

const formState: any = defineModel();

const targetElement = ref<HTMLElement | null>(null);
const showAttr = ref<boolean>(false);
const attrTargetKey = ref<'apiKey' | null>(null);

const loadDefaultModel = async () => {
  const res: any = await getCurrentModel('LLM');
  const data = res?.data ?? {};
  if (!formState.value.model) formState.value.model = {};
  formState.value.model.modelName = data.modelName;
  formState.value.model.provider = data.provider ?? data.providerName;
  formState.value.model.providerName = data.provider ?? data.providerName;
  formState.value.model.modelProvider = data.provider ?? data.providerName;
  formState.value.model.modelType = data.modelType ?? 'LLM';
};

const checkApiKey = (event: any) => {
  targetElement.value = event.currentTarget;
  attrTargetKey.value = 'apiKey';
  showAttr.value = true;
};

const closeAttrPanel = () => {
  showAttr.value = false;
  attrTargetKey.value = null;
};

const selectAttr = (variableSelector: any[]) => {
  if (attrTargetKey.value === 'apiKey') {
    if (!formState.value.apiKeySelector) {
      formState.value.apiKeySelector = { variableSelector: [] };
    }
    formState.value.apiKeySelector.variableSelector = variableSelector;
  }
  closeAttrPanel();
};

const stopSequenceTags = ref<string[]>(
  Array.isArray(formState.value?.stop) ? formState.value.stop : [],
);
const onStopChange = (val: string[]) => {
  formState.value.stop = val;
};

const RESPONSE_FORMATS = [
  { value: 'text', label: '文本 (text)' },
  { value: 'json_object', label: 'JSON 对象' },
  { value: 'json_schema', label: 'JSON Schema' },
];
</script>

<template>
  <PromptEditorTagPanel
    :show="showAttr"
    :target-element="targetElement"
    :node-id="nodeId"
    @close="closeAttrPanel"
    @select="selectAttr"
  />

  <div class="wf-config-section">
    <WfField title="模型" required>
      <template #operations>
        <a-button type="link" size="small" @click="loadDefaultModel">
          使用默认
        </a-button>
      </template>
      <ModelPickerPopover
        v-model="formState.model"
        model-type="LLM"
        placeholder="点击选择 LLM 模型"
        :width="440"
      />
    </WfField>

    <WfField title="API Key 变量" is-subtitle>
      <template #tooltip>
        按用户/租户维度切换密钥时使用；未设置时走后端默认凭据。
      </template>
      <div class="llm-varselect" @click="checkApiKey">
        <a-tag class="llm-varselect-tag">
          {{
            workflow_utils.getVariableLabel(
              formState.apiKeySelector?.variableSelector,
            ) || '点击选择变量'
          }}
        </a-tag>
      </div>
    </WfField>
  </div>

  <!-- SYSTEM 提示词 -->
  <PromptEditor
    class="wf-config-prompt"
    title="SYSTEM"
    :node-id="nodeId"
    v-model="formState.systemPrompt.text"
  />

  <!-- USER 提示词 -->
  <PromptEditor
    class="wf-config-prompt"
    title="USER"
    :node-id="nodeId"
    v-model="formState.userPrompt.text"
  />

  <div class="wf-config-section">
    <WfField title="对话记忆">
      <template #tooltip>
        控制注入到 prompt 的历史消息条数。开启后按最近 N 轮追加。
      </template>
      <MemoryWindow v-model="formState.memory" />
    </WfField>
  </div>

  <div class="wf-config-section">
    <WfField title="高级参数" foldable default-fold>
      <WfField title="停止序列" is-subtitle>
        <template #tooltip>
          LLM 生成过程中遇到任意一个字符串会立刻停止输出。
        </template>
        <a-select
          v-model:value="stopSequenceTags"
          mode="tags"
          :token-separators="[',']"
          placeholder="回车或逗号分隔，最多 4 个"
          style="width: 100%"
          @change="onStopChange"
        />
      </WfField>

      <WfField title="响应格式" is-subtitle>
        <template #tooltip>
          选择 JSON 会指示模型返回可解析的 JSON。需要模型本身支持该模式。
        </template>
        <a-select
          v-model:value="formState.responseFormat"
          :options="RESPONSE_FORMATS"
          style="width: 100%"
          placeholder="默认文本"
          allow-clear
        />
      </WfField>

      <WfField title="视觉输入" is-subtitle inline>
        <template #operations>
          <a-switch v-model:checked="formState.vision" size="small" />
        </template>
      </WfField>
    </WfField>
  </div>

  <div class="wf-config-section">
    <WfField title="输出">
      <OutputItemCard v-model="formState" />
    </WfField>
  </div>
</template>

<style scoped>
.llm-varselect {
  padding: 4px 8px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
  min-height: 28px;
  display: flex;
  align-items: center;
}

.llm-varselect:hover {
  border-color: #6366f1;
}

.llm-varselect-tag {
  margin: 0;
}
</style>
