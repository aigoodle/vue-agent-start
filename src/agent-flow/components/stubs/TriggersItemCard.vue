<script setup lang="ts">
import { computed } from 'vue';

import {
  ApiOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue';

/**
 * 触发器基础实现：只提供开关 + 类型选择。
 * 具体每种触发器的详细配置（HTTP 端点、cron 表达式、webhook 密钥等）应由宿主
 * 组件替换本 stub 实现。
 */

const formState: any = defineModel();

const TRIGGERS = [
  { key: 'http', label: 'HTTP 请求', icon: ApiOutlined, color: '#06b6d4' },
  { key: 'schedule', label: '定时', icon: ClockCircleOutlined, color: '#f59e0b' },
  { key: 'webhook', label: 'Webhook', icon: ThunderboltOutlined, color: '#8b5cf6' },
];

const enabled = computed({
  get: () => formState.value?.triggersEnabled ?? false,
  set: (v: boolean) => (formState.value.triggersEnabled = v),
});

const currentType = computed({
  get: () => formState.value?.triggers?.type ?? 'http',
  set: (v: string) => {
    if (!formState.value.triggers) formState.value.triggers = { type: v };
    else formState.value.triggers.type = v;
  },
});
</script>

<template>
  <div class="wf-triggers">
    <div class="wf-triggers-toggle">
      <span>启用触发器</span>
      <a-switch v-model:checked="enabled" size="small" />
    </div>

    <div v-if="enabled" class="wf-triggers-types">
      <div
        v-for="t in TRIGGERS"
        :key="t.key"
        class="wf-triggers-type"
        :class="{ 'is-active': currentType === t.key }"
        :style="{ '--tc': t.color }"
        @click="currentType = t.key"
      >
        <component :is="t.icon" class="wf-triggers-type-icon" />
        <span>{{ t.label }}</span>
      </div>
    </div>

    <div v-if="enabled" class="wf-triggers-hint">
      触发器详细配置由宿主项目提供。
    </div>
  </div>
</template>

<style scoped>
.wf-triggers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wf-triggers-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 12px;
  color: #4b5563;
}

.wf-triggers-types {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.wf-triggers-type {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  color: #4b5563;
  font-size: 11px;
}

.wf-triggers-type:hover {
  border-color: var(--tc);
}

.wf-triggers-type.is-active {
  background: color-mix(in srgb, var(--tc) 10%, transparent);
  border-color: var(--tc);
  color: var(--tc);
}

.wf-triggers-type-icon {
  font-size: 18px;
  color: var(--tc);
}

.wf-triggers-hint {
  padding: 6px 10px;
  font-size: 11px;
  color: #92400e;
  background: #fef3c7;
  border-radius: 4px;
}
</style>
