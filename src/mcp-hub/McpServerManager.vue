<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Alert, Button, Empty, Form, FormItem, Input, Modal, Select, Spin, Switch, message } from '../ui';
import { createAgentStartClient } from '../client';
import { useAgentStartClient } from '../client/vue';
import { mergeAgentStartHeaders, useAgentStartConfig } from '../config';
import type { McpServerConfig, SaveMcpServerConfig } from './types';

const global = useAgentStartConfig();
const client = useAgentStartClient() ?? createAgentStartClient({
  baseUrl: global.apiBase ?? '/api', headers: () => mergeAgentStartHeaders(global.headers),
});
const servers = ref<McpServerConfig[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const editing = ref(false);
const form = ref<SaveMcpServerConfig>(emptyForm());
const argsText = ref('');
const envText = ref('{}');

function emptyForm(): SaveMcpServerConfig {
  return { name: '', transport: 'HTTP', enabled: true, url: '', command: '', args: [], env: {} };
}

async function load() {
  loading.value = true; error.value = '';
  try { servers.value = await client.request('/mcp-servers'); }
  catch (exception: any) { error.value = exception?.message ?? 'MCP 配置加载失败'; }
  finally { loading.value = false; }
}

function open(row?: McpServerConfig) {
  form.value = row ? { ...row, args: row.args ?? [], env: {} } : emptyForm();
  argsText.value = (row?.args ?? []).join('\n');
  envText.value = '{}'; error.value = ''; editing.value = true;
}

function closeEditor() { if (!saving.value) editing.value = false; }

async function save() {
  const name = form.value.name.trim();
  if (!name) return void message.warning('请输入 MCP 服务名称');
  if (form.value.transport === 'HTTP' && !form.value.url?.trim()) return void message.warning('请输入 MCP 服务地址');
  if (form.value.transport === 'STDIO' && !form.value.command?.trim()) return void message.warning('请输入启动命令');
  let env: Record<string, string> = {};
  try {
    const parsed = JSON.parse(envText.value || '{}');
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    env = parsed;
  } catch { return void message.error('环境变量必须是合法的 JSON 对象'); }
  saving.value = true; error.value = '';
  try {
    const payload: SaveMcpServerConfig = {
      ...form.value, name, url: form.value.url?.trim(), command: form.value.command?.trim(),
      args: argsText.value.split('\n').map(value => value.trim()).filter(Boolean), env,
    };
    await client.request('/mcp-servers', { method: 'POST', body: JSON.stringify(payload) });
    editing.value = false;
    message.success(form.value.id ? 'MCP 服务已更新' : 'MCP 服务已创建');
    await load();
  } catch (exception: any) {
    error.value = exception?.message ?? '保存失败'; message.error(error.value);
  } finally { saving.value = false; }
}

function remove(row: McpServerConfig) {
  Modal.confirm({
    title: '删除 MCP 服务', content: `确定删除“${row.name}”吗？此操作无法撤销。`,
    okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
    async onOk() {
      try {
        await client.request(`/mcp-servers/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
        message.success('MCP 服务已删除'); await load();
      } catch (exception: any) {
        error.value = exception?.message ?? '删除失败'; message.error(error.value); throw exception;
      }
    },
  });
}

async function test(row: McpServerConfig) {
  try {
    await client.request(`/mcp-servers/${encodeURIComponent(row.id)}/test`, { method: 'POST' });
    message.success('连接测试成功'); await load();
  } catch (exception: any) { error.value = exception?.message ?? '连接测试失败'; message.error(error.value); }
}
onMounted(load);
</script>

<template>
  <div class="mcp">
    <header class="mcp-page-header">
      <div><h2>MCP 服务</h2><p>配置 STDIO 或 HTTP MCP Server；发现的工具会自动进入工具列表和 Agent/工作流工具选择器。</p></div>
      <Button type="primary" @click="open()">新增 MCP 服务</Button>
    </header>
    <Alert v-if="error" class="mcp-alert" type="error" show-icon closable :message="error" @close="error = ''" />
    <Spin :spinning="loading">
      <Empty v-if="!loading && !servers.length" class="mcp-empty" description="尚未配置 MCP 服务" />
      <div v-else class="mcp-list">
        <article v-for="server in servers" :key="server.id">
          <div class="mcp-summary">
            <h3>{{ server.name }} <span>{{ server.transport }}</span></h3>
            <code>{{ server.transport === 'HTTP' ? server.url : [server.command, ...(server.args || [])].join(' ') }}</code>
            <p v-if="server.lastError" class="mcp-bad">{{ server.lastError }}</p>
          </div>
          <div class="mcp-status"><b>{{ server.status || 'UNKNOWN' }}</b><small>{{ server.toolCount || 0 }} 个工具</small></div>
          <div class="mcp-actions"><Button @click="test(server)">测试</Button><Button @click="open(server)">编辑</Button><Button danger @click="remove(server)">删除</Button></div>
        </article>
      </div>
    </Spin>

    <Modal v-model:open="editing" :width="640" :mask-closable="false" :keyboard="!saving"
      :closable="!saving" :destroy-on-close="true" @cancel="closeEditor">
      <template #title>
        <div class="mcp-modal-heading">
          <div class="mcp-modal-title">{{ form.id ? '编辑 MCP 服务' : '新增 MCP 服务' }}</div>
          <div class="mcp-modal-subtitle">配置连接方式和运行参数，保存后即可在 Agent 与工作流中使用。</div>
        </div>
      </template>
      <Form layout="vertical" class="mcp-form" @submit.prevent="save">
        <FormItem label="服务名称" required><Input v-model:value="form.name" placeholder="例如 GitHub MCP" :maxlength="80" /></FormItem>
        <FormItem label="传输方式" required><Select v-model:value="form.transport" :options="[
          { label: 'HTTP / SSE', value: 'HTTP' }, { label: 'STDIO 本地进程', value: 'STDIO' },
        ]" /></FormItem>
        <FormItem v-if="form.transport === 'HTTP'" label="服务地址" required><Input v-model:value="form.url" placeholder="https://example.com/mcp" /></FormItem>
        <template v-else>
          <FormItem label="启动命令" required><Input v-model:value="form.command" placeholder="npx" /></FormItem>
          <FormItem label="命令参数" extra="每行填写一个参数"><Input.TextArea v-model:value="argsText" :rows="4" placeholder="-y&#10;@modelcontextprotocol/server-filesystem" /></FormItem>
          <FormItem label="环境变量 JSON" extra="环境变量仅传递给 MCP 子进程，列表接口不会返回其内容。"><Input.TextArea v-model:value="envText" class="mcp-code-input" :rows="5" placeholder='{"API_KEY":"..."}' /></FormItem>
        </template>
        <FormItem label="启用状态"><div class="mcp-switch-row"><Switch v-model:checked="form.enabled" /><span>{{ form.enabled ? '已启用' : '已停用' }}</span></div></FormItem>
      </Form>
      <template #footer><Button :disabled="saving" @click="closeEditor">取消</Button><Button type="primary" :loading="saving" @click="save">保存</Button></template>
    </Modal>
  </div>
</template>

<style scoped>
.mcp { padding: 24px; color: #1f2937; }
.mcp-page-header, .mcp-list article, .mcp-actions, .mcp-status { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2, h3, p { margin: 0; }
.mcp-page-header p { margin-top: 6px; color: #6b7280; }
.mcp-alert { margin-top: 20px; }
.mcp-empty { margin-top: 24px; padding: 48px 16px; border-radius: 10px; background: #fff; }
.mcp-list { display: grid; gap: 12px; margin-top: 22px; }
.mcp-list article { padding: 16px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
.mcp-summary { flex: 1; min-width: 0; }
.mcp-summary h3 span { padding: 2px 6px; border-radius: 4px; background: #eef2ff; color: #4338ca; font-size: 11px; }
.mcp-summary code { color: #6b7280; overflow-wrap: anywhere; }
.mcp-status { flex-direction: column; align-items: flex-start; }
.mcp-status small { color: #6b7280; }
.mcp-bad { margin-top: 5px; color: #b91c1c; }
.mcp-modal-heading { padding: 1px 0; }
.mcp-modal-title { color: #0f172a; font-size: 18px; font-weight: 600; line-height: 26px; }
.mcp-modal-subtitle { margin-top: 3px; color: #94a3b8; font-size: 12px; font-weight: 400; line-height: 18px; }
.mcp-form { padding-top: 8px; }
.mcp-code-input :deep(textarea) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.mcp-switch-row { display: flex; align-items: center; gap: 10px; color: #64748b; }
@media (max-width: 760px) { .mcp-page-header, .mcp-list article { align-items: flex-start; flex-direction: column; } }
</style>
