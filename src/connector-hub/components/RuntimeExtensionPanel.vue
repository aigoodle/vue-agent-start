<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { AgentStartClient } from '../../client';
import type { ChannelDefinition, ChannelRuntimeNodes } from '../types';
import OpenClawPluginPanel from './OpenClawPluginPanel.vue';

const props = defineProps<{ client: AgentStartClient }>();
const emit = defineEmits<{ changed: [] }>();
const channels = ref<ChannelDefinition[]>([]);
const nodes = ref<ChannelRuntimeNodes>({});
const loading = ref(false);
const error = ref('');
const selectedProvider = ref('');

const runtimes = computed(() => {
  const providers = new Map<string, ChannelDefinition[]>();
  for (const channel of channels.value) {
    const list = providers.get(channel.provider) ?? [];
    list.push(channel); providers.set(channel.provider, list);
  }
  return [...providers.entries()].map(([provider, adapters]) => ({
    provider,
    label: provider === 'openclaw' ? 'OpenClaw' : provider === 'hermes' ? 'Hermes Agent' : provider,
    adapters,
    nodes: nodes.value[provider] ?? [],
    // A discovered adapter proves that the provider management API responded.
    // Adapter ONLINE means a messaging account is running, which is a different state.
    connected: adapters.length > 0 && (nodes.value[provider]?.length ?? 0) > 0,
    onlineAdapters: adapters.filter((item) => item.runtimeStatus === 'ONLINE').length,
  }));
});
const selectedRuntime = computed(() => runtimes.value.find((item) => item.provider === selectedProvider.value));

async function load(force = false) {
  loading.value = true; error.value = '';
  try {
    [channels.value, nodes.value] = await Promise.all([
      props.client.connectors.listChannels(force),
      props.client.connectors.listChannelRuntimeNodes(),
    ]);
    if (!selectedProvider.value || !runtimes.value.some((item) => item.provider === selectedProvider.value))
      selectedProvider.value = runtimes.value[0]?.provider ?? '';
  } catch (e: any) { error.value = e?.message ?? '加载运行时失败'; }
  finally { loading.value = false; }
}
onMounted(() => load());
</script>

<template>
  <section class="runtime-panel">
    <header class="runtime-head"><div><h3>运行时接入商</h3><p>OpenClaw、Hermes 是平级运行时接入商，分别承载自己的消息适配器、连接节点和扩展生态。</p></div><button class="ch-btn" @click="load(true)">刷新状态</button></header>
    <div v-if="error" class="ch-alert">{{ error }}</div>
    <div v-if="loading" class="runtime-empty">加载中…</div>
    <div v-else class="runtime-grid">
      <article v-for="runtime in runtimes" :key="runtime.provider" :class="['runtime-card', { selected: selectedProvider === runtime.provider }]" @click="selectedProvider = runtime.provider">
        <div class="runtime-title"><span class="runtime-logo">{{ runtime.provider === 'hermes' ? 'H' : 'O' }}</span><div><b>{{ runtime.label }}</b><small>{{ runtime.provider }}</small></div><em :class="{ online: runtime.connected }">{{ runtime.connected ? '已连接' : '不可用' }}</em></div>
        <dl><div><dt>运行节点</dt><dd>{{ runtime.nodes.join(', ') || 'default' }}</dd></div><div><dt>消息适配器</dt><dd>{{ runtime.adapters.length }}</dd></div><div><dt>在线适配器</dt><dd>{{ runtime.onlineAdapters }}</dd></div></dl>
        <p v-if="runtime.provider === 'hermes'">Hermes 通过 Profile 隔离员工或服务账号。当前管理平台配置；Agent Start 消息桥能力会独立标识。</p>
        <p v-else-if="runtime.provider === 'openclaw'">OpenClaw 提供插件安装、工具发现以及 Agent Start 消息桥。</p>
        <footer><button class="ch-btn" @click.stop="selectedProvider = runtime.provider">管理 {{ runtime.label }}</button><span>{{ selectedProvider === runtime.provider ? '当前接入商' : '查看详情' }}</span></footer>
      </article>
    </div>
    <div v-if="!loading && !runtimes.length" class="runtime-empty">当前后端没有发现运行时，请确认 Hermes/OpenClaw 已启用并重启后端。</div>
    <section v-if="selectedRuntime" class="provider-detail">
      <header><div><h3>{{ selectedRuntime.label }} 管理</h3><p>当前接入商：{{ selectedRuntime.provider }} · 节点 {{ selectedRuntime.nodes.join(', ') || 'default' }}</p></div><a v-if="selectedRuntime.provider === 'hermes'" class="ch-btn" href="http://127.0.0.1:9119" target="_blank" rel="noopener">打开 Hermes Dashboard</a></header>
      <OpenClawPluginPanel v-if="selectedRuntime.provider === 'openclaw'" :client="client" @changed="emit('changed')" />
      <div v-else-if="selectedRuntime.provider === 'hermes'" class="hermes-detail"><div><b>Profile 与账号隔离</b><p>每个员工或服务账号使用独立 Hermes Profile。</p></div><div><b>消息适配器</b><p>已发现 {{ selectedRuntime.adapters.length }} 个适配器，请在“消息渠道”中配置。</p></div><div><b>路由边界</b><p>Hermes 原生路由与 Agent Start Bridge 能力分别标识，避免消息误投。</p></div></div>
    </section>
  </section>
</template>

<style scoped>
.runtime-panel{display:grid;gap:18px}.runtime-head{display:flex;align-items:center;justify-content:space-between;padding:18px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}.runtime-head h3,.provider-detail h3{margin:0 0 5px}.runtime-head p,.provider-detail p,.runtime-card p{margin:0;color:#6b7280}.runtime-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}.runtime-card{display:grid;gap:16px;padding:18px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer}.runtime-card.selected{border-color:#4f46e5;box-shadow:0 0 0 1px #4f46e5}.runtime-title{display:flex;align-items:center;gap:10px}.runtime-title>div{display:grid}.runtime-title small{color:#6b7280}.runtime-title em{margin-left:auto;padding:4px 9px;border-radius:999px;background:#fef2f2;color:#b91c1c;font-size:12px;font-style:normal}.runtime-title em.online{background:#ecfdf5;color:#047857}.runtime-logo{display:grid;width:40px;height:40px;place-items:center;border-radius:10px;background:#eef2ff;color:#4338ca;font-weight:700}.runtime-card dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0}.runtime-card dl div{padding:9px;border-radius:8px;background:#f8fafc}.runtime-card dt{color:#6b7280;font-size:12px}.runtime-card dd{margin:4px 0 0;font-weight:600}.runtime-card footer{display:flex;align-items:center;gap:12px;color:#6b7280;font-size:12px}.provider-detail{display:grid;gap:14px;padding:18px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}.provider-detail>header{display:flex;align-items:center;justify-content:space-between}.provider-detail a{text-decoration:none}.hermes-detail{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.hermes-detail>div{padding:14px;border-radius:9px;background:#f8fafc}.hermes-detail p{margin-top:6px}.runtime-empty{padding:32px;text-align:center;color:#6b7280}
</style>
