<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AgentStartClient } from '../../client';
import type { ConnectorAction, ConnectorDefinition, ConnectorResult } from '../types';
import JsonSchemaForm from './JsonSchemaForm.vue';
const props = defineProps<{ open: boolean; client: AgentStartClient; connector?: ConnectorDefinition; action?: ConnectorAction; tenantId?: string }>();
const emit = defineEmits<{ (e:'update:open', value:boolean):void }>();
const args = ref<Record<string, unknown>>({}); const running = ref(false); const result = ref<ConnectorResult>();
watch(() => props.action?.id, () => { args.value = {}; result.value = undefined; });
async function run(){ if(!props.connector || !props.action)return; running.value=true; try{result.value=await props.client.connectors.execute(props.connector.key.provider,props.connector.key.connectorId,props.action.id,args.value,props.tenantId)}catch(e:any){result.value={success:false,error:{code:'request_failed',message:e?.message??'调用失败'}}}finally{running.value=false} }
</script>
<template><div v-if="open" class="drawer-mask" @click.self="emit('update:open',false)"><aside class="drawer"><header><div><b>测试 · {{ action?.name }}</b><small>{{ connector?.name }}</small></div><button @click="emit('update:open',false)">×</button></header><main><JsonSchemaForm v-model="args" :schema="action?.inputSchema"/><button class="primary" :disabled="running" @click="run">{{ running?'执行中…':'执行 Action' }}</button><pre v-if="result" :class="{bad:!result.success}">{{ JSON.stringify(result,null,2) }}</pre></main></aside></div></template>
<style scoped>.drawer-mask{position:fixed;inset:0;background:#0006;z-index:1100}.drawer{position:absolute;right:0;top:0;height:100%;width:min(520px,92vw);background:#fff;box-shadow:-8px 0 30px #0002}.drawer header{display:flex;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #eee}.drawer header div{display:grid;gap:3px}.drawer header small{color:#6b7280}.drawer header button{border:0;background:none;font-size:25px}.drawer main{padding:20px;display:grid;gap:18px}.primary{border:0;border-radius:7px;background:#4f46e5;color:white;padding:10px;cursor:pointer}.primary:disabled{opacity:.6}pre{white-space:pre-wrap;background:#f0fdf4;border:1px solid #bbf7d0;padding:12px;border-radius:8px;max-height:340px;overflow:auto}.bad{background:#fef2f2;border-color:#fecaca}:global(.dark) .drawer{background:#18181b;color:#eee}</style>
