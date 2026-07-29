<script setup lang="ts">
import { ref } from 'vue';

import { ToolOutlined } from '@ant-design/icons-vue';

const emit = defineEmits<{ (e: 'formSubmit', v: any): void }>();

const open = ref(false);
const form = ref({ name: '', description: '' });

function showModal() {
  form.value = { name: '', description: '' };
  open.value = true;
}

function hideModal() {
  open.value = false;
}

function submit() {
  emit('formSubmit', { ...form.value, id: Date.now() });
  open.value = false;
}

defineExpose({ showModal, hideModal });
</script>

<template>
  <a-modal
    v-model:open="open"
    title="添加工具"
    width="480px"
    ok-text="添加"
    cancel-text="取消"
    @ok="submit"
  >
    <div class="wf-tool-chooser">
      <div class="wf-tool-chooser-hint">
        当前是基础实现。真实场景下应对接后端 ToolService，展示 tool 分类
        列表并支持授权配置。
      </div>

      <a-form layout="vertical" :model="form">
        <a-form-item label="工具名" required>
          <a-input
            v-model:value="form.name"
            placeholder="例如 get_weather"
          />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea
            v-model:value="form.description"
            placeholder="给模型看的描述，告诉它这个工具能干什么"
            :auto-size="{ minRows: 3, maxRows: 6 }"
          />
        </a-form-item>
      </a-form>

      <div class="wf-tool-chooser-preview">
        <ToolOutlined style="color: #7c3aed; font-size: 24px" />
        <div>
          <div style="font-weight: 500">{{ form.name || '未命名工具' }}</div>
          <div style="font-size: 11px; color: #6b7280">
            {{ form.description || '尚未填写描述' }}
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.wf-tool-chooser {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
}

.wf-tool-chooser-hint {
  padding: 8px 12px;
  font-size: 12px;
  color: #92400e;
  background: #fef3c7;
  border-radius: 6px;
}

.wf-tool-chooser-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f3e8ff;
  border-radius: 6px;
}
</style>
