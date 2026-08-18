<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { JsonSchema } from '../types';
import { parseJsonSchema } from '../types';

const props = withDefaults(defineProps<{ modelValue?: Record<string, unknown>; schema?: string | JsonSchema; secretFields?: string[] }>(), { modelValue: () => ({}), secretFields: () => [] });
const emit = defineEmits<{ (e: 'update:modelValue', value: Record<string, unknown>): void }>();
const value = ref<Record<string, unknown>>({ ...props.modelValue });
const advanced = ref(false);
const jsonText = ref('{}');
const jsonError = ref('');
const parsed = computed(() => parseJsonSchema(props.schema));
const fields = computed(() => Object.entries(parsed.value.properties ?? {}));
const isOpen = computed(() => fields.value.length === 0 && parsed.value.additionalProperties !== false);
watch(() => props.modelValue, v => { value.value = { ...(v ?? {}) }; jsonText.value = JSON.stringify(value.value, null, 2); }, { deep: true, immediate: true });
function setField(name: string, schema: JsonSchema, raw: unknown) {
  let next = raw;
  if (schema.type === 'number' || schema.type === 'integer') next = raw === '' ? undefined : Number(raw);
  if (schema.type === 'boolean') next = Boolean(raw);
  value.value = { ...value.value, [name]: next };
  emit('update:modelValue', value.value);
  jsonText.value = JSON.stringify(value.value, null, 2);
}
function applyJson() {
  try { const next = JSON.parse(jsonText.value); if (!next || Array.isArray(next) || typeof next !== 'object') throw new Error('必须是 JSON 对象'); value.value = next; emit('update:modelValue', next); jsonError.value = ''; }
  catch (e: any) { jsonError.value = e?.message ?? 'JSON 格式错误'; }
}
function inputType(name: string, schema: JsonSchema) {
  return props.secretFields.includes(name) || schema.format === 'password' ? 'password' : schema.type === 'number' || schema.type === 'integer' ? 'number' : 'text';
}
</script>
<template>
  <div class="jsf">
    <div v-if="!advanced && !isOpen" class="jsf-fields">
      <label v-for="[name, field] in fields" :key="name" class="jsf-field">
        <span>{{ field.title || name }} <b v-if="parsed.required?.includes(name)">*</b></span>
        <small v-if="field.description">{{ field.description }}</small>
        <select v-if="field.enum" :value="value[name]" @change="setField(name, field, ($event.target as HTMLSelectElement).value)">
          <option value="">请选择</option><option v-for="item in field.enum" :key="String(item)" :value="item">{{ item }}</option>
        </select>
        <input v-else-if="field.type === 'boolean'" type="checkbox" :checked="Boolean(value[name])" @change="setField(name, field, ($event.target as HTMLInputElement).checked)" />
        <textarea v-else-if="field.format === 'textarea' || field.type === 'object' || field.type === 'array'" :value="typeof value[name] === 'string' ? value[name] : JSON.stringify(value[name] ?? (field.type === 'array' ? [] : {}), null, 2)" @change="setField(name, field, ($event.target as HTMLTextAreaElement).value)" />
        <input v-else :type="inputType(name, field)" :min="field.minimum" :max="field.maximum" :value="value[name] as any" @input="setField(name, field, ($event.target as HTMLInputElement).value)" />
      </label>
    </div>
    <div v-else>
      <textarea v-model="jsonText" class="jsf-json" spellcheck="false" @blur="applyJson" />
      <div v-if="jsonError" class="jsf-error">{{ jsonError }}</div>
    </div>
    <button v-if="!isOpen" type="button" class="jsf-mode" @click="advanced = !advanced">{{ advanced ? '返回表单模式' : 'JSON 高级模式' }}</button>
  </div>
</template>
<style scoped>
.jsf-fields{display:grid;gap:14px}.jsf-field{display:grid;gap:6px;color:#1f2937;font-size:13px}.jsf-field small{color:#6b7280}.jsf-field b{color:#ef4444}.jsf-field input:not([type=checkbox]),.jsf-field select,.jsf-field textarea,.jsf-json{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:7px;padding:8px 10px;background:var(--connector-bg,#fff);color:inherit}.jsf-field textarea,.jsf-json{min-height:110px;font-family:ui-monospace,monospace}.jsf-json{min-height:220px}.jsf-mode{border:0;background:none;color:#4f46e5;padding:8px 0;cursor:pointer}.jsf-error{color:#dc2626;font-size:12px;margin-top:4px}:global(.dark) .jsf-field{color:#e5e7eb}
</style>
