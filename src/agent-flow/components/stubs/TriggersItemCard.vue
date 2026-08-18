<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { ApiOutlined, ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons-vue';

const formState: any = defineModel();

const TRIGGERS = [
  { key: 'http', label: 'HTTP 请求', icon: ApiOutlined, color: '#06b6d4' },
  { key: 'schedule', label: '定时', icon: ClockCircleOutlined, color: '#f59e0b' },
  { key: 'webhook', label: 'Webhook', icon: ThunderboltOutlined, color: '#8b5cf6' },
];

const enabled = computed({
  get: () => formState.value?.triggersEnabled ?? false,
  set: (value: boolean) => (formState.value.triggersEnabled = value),
});

function ensureTrigger() {
  if (!formState.value.triggers) formState.value.triggers = {};
  const trigger = formState.value.triggers;
  trigger.type ??= 'http';
  trigger.name ??= '工作流定时任务';
  trigger.targetWorkflowId ??= '';
  trigger.scheduleType ??= 'CRON';
  trigger.recurrence ??= 'DAILY';
  trigger.time ??= '08:00';
  trigger.weekDay ??= 1;
  trigger.dayOfMonth ??= 1;
  trigger.timeZone ??= 'Asia/Shanghai';
  trigger.payloadJson ??= '{}';
  return trigger;
}

const currentType = computed({
  get: () => ensureTrigger().type,
  set: (value: string) => (ensureTrigger().type = value),
});

function generatedCron(): string {
  const trigger = ensureTrigger();
  const [hour = '8', minute = '0'] = String(trigger.time || '08:00').split(':');
  if (trigger.recurrence === 'WEEKLY') return `0 ${Number(minute)} ${Number(hour)} * * ${trigger.weekDay}`;
  if (trigger.recurrence === 'MONTHLY') return `0 ${Number(minute)} ${Number(hour)} ${trigger.dayOfMonth} * *`;
  if (trigger.recurrence === 'CUSTOM') return trigger.expression || '';
  return `0 ${Number(minute)} ${Number(hour)} * * *`;
}

watchEffect(() => {
  const trigger = ensureTrigger();
  if (trigger.type === 'schedule' && trigger.scheduleType === 'CRON') {
    trigger.expression = generatedCron();
  }
});

const schedulePreview = computed(() => {
  const trigger = ensureTrigger();
  if (trigger.scheduleType === 'ONCE') return trigger.runAt ? `一次：${trigger.runAt}` : '请选择执行时间';
  return `Cron：${generatedCron()}（${trigger.timeZone}）`;
});
</script>

<template>
  <div class="wf-triggers">
    <div class="wf-triggers-toggle">
      <span>启用触发器</span>
      <a-switch v-model:checked="enabled" size="small" />
    </div>

    <div v-if="enabled" class="wf-triggers-types">
      <button
        v-for="item in TRIGGERS"
        :key="item.key"
        type="button"
        class="wf-triggers-type"
        :class="{ 'is-active': currentType === item.key }"
        :style="{ '--tc': item.color }"
        @click="currentType = item.key"
      >
        <component :is="item.icon" class="wf-triggers-type-icon" />
        <span>{{ item.label }}</span>
      </button>
    </div>

    <div v-if="enabled && currentType === 'schedule'" class="wf-schedule-form">
      <label>任务名称<a-input v-model:value="formState.triggers.name" /></label>
      <label>执行工作流 ID<a-input v-model:value="formState.triggers.targetWorkflowId" placeholder="可选择当前或另一个已发布工作流" /></label>
      <label>计划类型
        <a-select v-model:value="formState.triggers.scheduleType">
          <a-select-option value="CRON">周期任务</a-select-option>
          <a-select-option value="ONCE">一次性任务</a-select-option>
        </a-select>
      </label>

      <template v-if="formState.triggers.scheduleType === 'CRON'">
        <label>周期
          <a-select v-model:value="formState.triggers.recurrence">
            <a-select-option value="DAILY">每天</a-select-option>
            <a-select-option value="WEEKLY">每周</a-select-option>
            <a-select-option value="MONTHLY">每月</a-select-option>
            <a-select-option value="CUSTOM">自定义 Cron</a-select-option>
          </a-select>
        </label>
        <label v-if="formState.triggers.recurrence !== 'CUSTOM'">执行时间
          <a-input v-model:value="formState.triggers.time" type="time" />
        </label>
        <label v-if="formState.triggers.recurrence === 'WEEKLY'">星期
          <a-select v-model:value="formState.triggers.weekDay">
            <a-select-option v-for="(name, index) in ['周日','周一','周二','周三','周四','周五','周六']" :key="index" :value="index">{{ name }}</a-select-option>
          </a-select>
        </label>
        <label v-if="formState.triggers.recurrence === 'MONTHLY'">每月日期
          <a-input-number v-model:value="formState.triggers.dayOfMonth" :min="1" :max="31" />
        </label>
        <label v-if="formState.triggers.recurrence === 'CUSTOM'">Cron 表达式
          <a-input v-model:value="formState.triggers.expression" placeholder="0 0 8 * * *" />
        </label>
      </template>
      <label v-else>执行时间
        <a-input v-model:value="formState.triggers.runAt" type="datetime-local" />
      </label>

      <label>时区<a-input v-model:value="formState.triggers.timeZone" placeholder="Asia/Shanghai" /></label>
      <label>继续会话 ID（可选）<a-input v-model:value="formState.triggers.conversationId" placeholder="定时执行时继续原多轮会话" /></label>
      <label>工作流输入 JSON<a-textarea v-model:value="formState.triggers.payloadJson" :rows="3" placeholder='{"schoolId":"001"}' /></label>
      <div class="wf-schedule-preview">{{ schedulePreview }}</div>
      <div class="wf-schedule-note">保存/发布后由后端持久化调度；集群部署时同一周期只会被一个节点抢占执行。</div>
    </div>

    <div v-else-if="enabled" class="wf-triggers-hint">
      {{ currentType === 'webhook' ? 'Webhook 的路径和密钥由发布接口生成。' : 'HTTP 触发后会把请求体作为开始节点输入。' }}
    </div>
  </div>
</template>

<style scoped>
.wf-triggers { display: flex; flex-direction: column; gap: 8px; }
.wf-triggers-toggle { display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:#f9fafb; border-radius:6px; font-size:12px; color:#4b5563; }
.wf-triggers-types { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.wf-triggers-type { display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 6px; background:#fff; border:1px solid #e5e7eb; border-radius:6px; cursor:pointer; color:#4b5563; font-size:11px; }
.wf-triggers-type:hover,.wf-triggers-type.is-active { border-color:var(--tc); color:var(--tc); }
.wf-triggers-type.is-active { background:color-mix(in srgb,var(--tc) 10%,transparent); }
.wf-triggers-type-icon { font-size:18px; color:var(--tc); }
.wf-schedule-form { display:grid; gap:9px; padding:10px; border:1px solid #fde68a; border-radius:7px; background:#fffbeb; }
.wf-schedule-form label { display:grid; gap:4px; font-size:11px; color:#4b5563; }
.wf-schedule-form :deep(.ant-select),.wf-schedule-form :deep(.ant-input-number) { width:100%; }
.wf-schedule-preview { padding:7px 9px; border-radius:5px; background:#fff; color:#92400e; font:11px ui-monospace,monospace; overflow-wrap:anywhere; }
.wf-schedule-note,.wf-triggers-hint { padding:6px 10px; font-size:11px; color:#92400e; background:#fef3c7; border-radius:4px; }
</style>
