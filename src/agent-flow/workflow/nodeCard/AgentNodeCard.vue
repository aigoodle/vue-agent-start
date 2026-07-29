<script setup lang="ts">
import { getCurrentModel } from '@/adapter/backend';
import MemoryWindow from '@/components/MemoryWindow.vue';
import PromptEditor from '@/components/PromptEditor.vue';
import ToolItemCard from '@/components/ToolItemCard.vue';
import ModelPickerPopover from '../../../provider-hub/components/ModelPickerPopover.vue';
import WfField from '@/workflow/WfField.vue';
import workflow_utils from '@/workflow/utils/workflow_utils';

defineProps<{ nodeId?: string }>();

const formState: any = defineModel();

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

const OUTPUT_DEFAULTS = [
  { name: 'text', type: 'String', label: '生成内容' },
  { name: 'files', type: 'Array[File]', label: 'Agent 生成的文件' },
  { name: 'json', type: 'Array[Object]', label: 'Agent 生成的 JSON' },
];
</script>

<template>
  <div class="wf-config-section">
    <WfField title="Agent 策略" required>
      <template #tooltip>
        推理循环的实现方式。ReAct 用观察-思考-行动多轮；FunctionCalling 由模型直接触发工具。
      </template>
      <a-select
        v-model:value="formState.agentStrategy"
        :options="workflow_utils.agentStrategy"
        style="width: 100%"
      />
    </WfField>

    <WfField title="模型" required>
      <template #operations>
        <a-button type="link" size="small" @click="loadDefaultModel">
          使用默认
        </a-button>
      </template>
      <ModelPickerPopover
        v-model="formState.model"
        model-type="LLM"
        placeholder="点击选择 Agent 模型"
        :width="440"
      />
    </WfField>
  </div>

  <div class="wf-config-section">
    <WfField title="工具">
      <template #tooltip>
        Agent 可调用的工具集合，运行时按模型返回决定调用哪个。
      </template>
      <ToolItemCard v-model="formState" />
    </WfField>

    <WfField title="MCP Server" is-subtitle>
      <template #tooltip>
        追加 MCP Server 配置（JSON），会自动融合入工具集。
      </template>
      <a-textarea
        v-model:value="formState.agentParameters.mcpServersConfig"
        placeholder='{"servers": [...]}'
        :auto-size="{ minRows: 3, maxRows: 8 }"
      />
    </WfField>
  </div>

  <PromptEditor
    class="wf-config-prompt"
    title="SYSTEM"
    :node-id="nodeId"
    v-model="formState.systemPrompt.text"
  />

  <PromptEditor
    class="wf-config-prompt"
    title="USER"
    :node-id="nodeId"
    v-model="formState.userPrompt.text"
  />

  <div class="wf-config-section">
    <WfField title="对话记忆">
      <MemoryWindow v-model="formState.memory" />
    </WfField>

    <WfField title="最大迭代次数" is-subtitle>
      <template #tooltip>
        单次运行内 Agent 最多进行多少轮 think/act。防止死循环。
      </template>
      <div class="agent-slider-row">
        <a-slider
          v-model:value="formState.memory.windows"
          :step="1"
          :min="1"
          :max="20"
          style="flex: 1"
        />
        <a-input-number
          v-model:value="formState.memory.windows"
          :min="1"
          :max="20"
          size="small"
          style="width: 88px"
        />
      </div>
    </WfField>
  </div>

  <div class="wf-config-section">
    <WfField title="输出变量" foldable default-fold>
      <div class="agent-output-list">
        <div
          v-for="it in OUTPUT_DEFAULTS"
          :key="it.name"
          class="agent-output-item"
        >
          <div class="agent-output-row">
            <span class="agent-output-name">{{ it.name }}</span>
            <a-tag>{{ it.type }}</a-tag>
          </div>
          <div class="agent-output-desc">{{ it.label }}</div>
        </div>
      </div>
    </WfField>
  </div>
</template>

<style scoped>
.agent-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-output-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agent-output-item {
  padding: 6px 10px;
  background: #f9fafb;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.agent-output-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.agent-output-name {
  font-size: 12px;
  font-weight: 500;
  color: #1f2937;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.agent-output-desc {
  margin-top: 2px;
  font-size: 11px;
  color: #6b7280;
}
</style>
