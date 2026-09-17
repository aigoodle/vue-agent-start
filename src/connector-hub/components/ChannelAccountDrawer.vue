<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { AgentStartClient } from '../../client';
import type { ChannelConnection, ChannelDefinition } from '../types';
import ChannelIcon from './ChannelIcon.vue';
import JsonSchemaForm from './JsonSchemaForm.vue';
import NativeChannelSetupGuide from './NativeChannelSetupGuide.vue';

const props = defineProps<{
    open: boolean;
    channel?: ChannelDefinition;
    /** 当前通道下已配置的账号（父级已按通道过滤） */
    connections: ChannelConnection[];
    client: AgentStartClient;
    tenantId?: string;
  }>();

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'saved'): void;
}>();

const form = ref({
  ownerId: '',
  name: '',
  enabled: true,
});
const credentials = ref<Record<string, unknown>>({});
const channelConfig = ref<Record<string, unknown>>({});
const editingId = ref<string>();
const formOpen = ref(false);
const saving = ref(false);
const installing = ref(false);
const error = ref('');
const notice = ref('');

const platformKey = computed(() =>
  String(props.channel?.metadata?.platformId ?? props.channel?.channelId ?? '').toLowerCase(),
);

function linkOf(field: 'homepageUrl' | 'sourceUrl') {
  const value = props.channel?.metadata?.[field];
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : '';
}

function blankForm() {
  form.value = { ownerId: '', name: '', enabled: true };
  credentials.value = {};
  channelConfig.value = {};
  editingId.value = undefined;
}

function openCreate() {
  blankForm();
  error.value = '';
  notice.value = '';
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
  blankForm();
}

async function fillFrom(row: ChannelConnection) {
  formOpen.value = true;
  editingId.value = row.id;
  form.value = {
    ownerId: row.ownerId,
    name: row.name,
    enabled: row.desiredStatus === 'ACTIVE',
  };
  credentials.value = {};
  channelConfig.value = {};
}

// 打开抽屉 / 切换通道时重置表单
watch(
  () => [props.open, props.channel],
  ([open]) => {
    if (!open) return;
    error.value = '';
    notice.value = '';
    blankForm();
    formOpen.value = false;
  },
  { immediate: true },
);

async function save() {
  const channel = props.channel;
  if (!channel) return;
  saving.value = true;
  error.value = '';
  try {
    await props.client.connectors.saveChannelConnection({
      id: editingId.value,
      tenantId: props.tenantId,
      ownerType: 'USER',
      ownerId: form.value.ownerId,
      provider: channel.provider,
      channelId: channel.channelId,
      name: form.value.name,
      credentials: Object.keys(credentials.value).length ? credentials.value : undefined,
      config: Object.keys(channelConfig.value).length ? channelConfig.value : undefined,
      enabled: form.value.enabled,
    });
    emit('saved');
    formOpen.value = false;
  } catch (e: any) {
    error.value = e?.message ?? '保存失败';
  } finally {
    saving.value = false;
  }
}

async function test(row: ChannelConnection) {
  error.value = '';
  try {
    await props.client.connectors.testChannelConnection(row.id, props.tenantId);
    notice.value = `账号「${row.name}」连通性测试通过`;
    emit('saved');
  } catch (e: any) {
    error.value = e?.message ?? '测试失败';
  }
}

async function remove(row: ChannelConnection) {
  if (!window.confirm(`删除 ${row.name}？`)) return;
  await props.client.connectors.deleteChannelConnection(row.id, props.tenantId);
  emit('saved');
}

async function install() {
  const channel = props.channel;
  if (!channel) return;
  error.value = `请在后端引入 ${channel.channelId} 原生 Connector Starter 后重启服务`;
}

const callbackIssueOf = (row: ChannelConnection) =>
  row.runtimeMetadata?.callbackWorkerRunning === false;
const callbackBacklogOf = (row: ChannelConnection) => {
  const value = Number(row.runtimeMetadata?.pendingInboundCallbacks ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
};
const rowNeedsCallback = (row: ChannelConnection) =>
  ['wecom', 'webhook'].includes(props.channel?.channelId ?? '')
  || String(row.runtimeMetadata?.transport ?? '').toLowerCase() === 'webhook';
const webhookReady = (row: ChannelConnection) =>
  rowNeedsCallback(row)
  && row.desiredStatus === 'ACTIVE'
  && ['RUNNING', 'ONLINE'].includes(row.runtimeStatus)
  && !callbackIssueOf(row);
const operationalStatusOf = (row: ChannelConnection) =>
  callbackIssueOf(row)
    ? `${row.runtimeStatus} · 入站回调异常`
    : row.lastError
      ? `${row.runtimeStatus} · ${row.lastError}`
      : webhookReady(row)
        ? '已就绪 · 等待平台回调'
        : row.runtimeStatus;
const accountOnline = (row: ChannelConnection) =>
  (row.runtimeStatus === 'ONLINE' || webhookReady(row)) && !callbackIssueOf(row);
const callbackPathOf = (row: ChannelConnection) =>
  `${props.client.rootUrl}/channel-events/native/${props.channel?.channelId}/${row.runtimeAccountId || row.id}`;

async function copyCallbackPath(row: ChannelConnection) {
  const path = callbackPathOf(row);
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    notice.value = `已复制账号「${row.name}」的完整回调地址`;
  } catch {
    notice.value = `回调路径：${path}`;
  }
}
</script>

<template>
  <Transition name="cad">
    <div v-if="open" class="cad-mask" @click.self="emit('update:open', false)">
      <aside class="cad-drawer" @click.stop>
        <header class="cad-header">
          <div class="cad-header-info">
            <ChannelIcon
              class="cad-icon"
              :platform-id="platformKey"
              :channel-id="channel?.channelId"
              :metadata="channel?.metadata"
              :name="channel?.name"
              :size="40"
              :radius="10"
            />
            <div class="cad-header-text">
              <b>{{ channel?.name }} 账号接入</b>
              <small>{{ channel?.provider }} · {{ channel?.version || '-' }}</small>
            </div>
          </div>
          <button class="cad-close" @click="emit('update:open', false)">✕</button>
        </header>

        <main class="cad-main">
          <div v-if="error" class="cad-alert">{{ error }}</div>
          <div v-else-if="notice" class="cad-note">{{ notice }}</div>

          <!-- 未安装：引导安装 -->
          <template v-if="!channel?.installed">
            <p class="cad-desc">{{ channel?.description }}</p>
            <div class="cad-install">
              <p>该原生通道 Starter 尚未启用，引入后即可在此配置账号并接收消息。</p>
              <button
                class="cad-btn cad-btn-primary"
                :disabled="installing"
                @click="install"
              >
                {{ installing ? '检查中…' : '查看启用方式' }}
              </button>
              <div class="cad-links">
                <a
                  v-if="linkOf('homepageUrl')"
                  :href="linkOf('homepageUrl')"
                  target="_blank"
                  rel="noopener"
                >
                  官方详情 ↗
                </a>
                <a
                  v-if="linkOf('sourceUrl')"
                  :href="linkOf('sourceUrl')"
                  target="_blank"
                  rel="noopener"
                >
                  源码 ↗
                </a>
              </div>
            </div>
          </template>

          <!-- 已安装：账号列表 + 表单 -->
          <template v-else>
            <section class="cad-section">
              <div class="cad-section-head">
                <h3>已配置账号</h3>
                <span class="cad-count">{{ connections.length }}</span>
                <button class="cad-btn cad-btn-primary cad-add" @click="openCreate">+ 添加账号</button>
              </div>
              <div v-if="!connections.length" class="cad-empty">尚未配置账号</div>
              <div v-for="row in connections" :key="row.id" class="cad-row">
                <div class="cad-row-main">
                  <b>{{ row.name }}</b>
                  <small>
                    {{ row.ownerId }} · {{ row.runtimeAccountId || '无运行账号' }}
                  </small>
                </div>
                <span
                  :class="['cad-status', accountOnline(row) ? 'is-online' : 'is-off']"
                  :title="String(row.runtimeMetadata?.callbackWorkerError ?? row.lastError ?? '')"
                >
                  <i :class="['cad-dot', accountOnline(row) ? 'is-on' : 'is-off']"></i>
                  {{ operationalStatusOf(row) }}
                </span>
                <span v-if="callbackBacklogOf(row)" class="cad-tag is-warn">
                  待回调 {{ callbackBacklogOf(row) }}
                </span>
                <span class="cad-tag">员工账号</span>
                <span :class="['cad-tag', { 'is-warn': !row.credentialsConfigured }]">
                  {{ row.credentialsConfigured ? '凭证已配置' : '缺少凭证' }}
                </span>
                <code v-if="rowNeedsCallback(row)" class="cad-callback">
                  {{ callbackPathOf(row) }}
                </code>
                <div class="cad-row-actions">
                  <button v-if="rowNeedsCallback(row)" class="cad-link" @click="copyCallbackPath(row)">复制回调地址</button>
                  <button class="cad-link" @click="fillFrom(row)">编辑</button>
                  <button class="cad-link" @click="test(row)">测试</button>
                  <button class="cad-link is-danger" @click="remove(row)">删除</button>
                </div>
              </div>
            </section>

            <Teleport to="body">
              <div v-if="formOpen" class="cad-form-mask" @click.self="closeForm">
                <section class="cad-form-dialog" role="dialog" aria-modal="true">
                  <header class="cad-form-header">
                    <div><h3>{{ editingId ? '编辑账号' : '添加账号' }}</h3><p>{{ channel?.name }} · {{ channel?.provider }}</p></div>
                    <button class="cad-close" @click="closeForm">✕</button>
                  </header>
                  <div class="cad-form-body">
                    <div v-if="error" class="cad-alert">{{ error }}</div>
                    <NativeChannelSetupGuide
                      :channel-id="channel?.channelId"
                      :account-id="editingId"
                    />
                    <div class="cad-fields">
                <label>
                  员工 / 所有者 ID
                  <input v-model.trim="form.ownerId" required placeholder="例如 employee-001" />
                </label>
                <label>
                  连接名称
                  <input
                    v-model.trim="form.name"
                    required
                    :placeholder="`例如 ${channel?.name} 工作账号`"
                  />
                </label>
                    </div>

                    <fieldset>
                <legend>账号凭证</legend>
                <p>凭证会加密保存且不会回显，编辑时留空表示不修改。</p>
                <JsonSchemaForm
                  v-model="credentials"
                  :schema="channel?.credentialSchema"
                />
                    </fieldset>

                    <fieldset>
                <legend>通道配置</legend>
                <JsonSchemaForm v-model="channelConfig" :schema="channel?.configurationSchema" />
                    </fieldset>
                  </div>
                  <footer class="cad-footer">
                    <label class="cad-enable"><input v-model="form.enabled" type="checkbox" />启用消息接收</label>
                    <div class="cad-footer-actions">
                      <button class="cad-btn" @click="closeForm">取消</button>
                      <button class="cad-btn cad-btn-primary" :disabled="saving || !form.ownerId || !form.name" @click="save">
                        {{ saving ? '保存中…' : editingId ? '保存修改' : '创建连接' }}
                      </button>
                    </div>
                  </footer>
                </section>
              </div>
            </Teleport>
          </template>
        </main>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
/* -------- 遮罩与左侧抽屉容器 -------- */
.cad-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 1100;
}
.cad-drawer {
  position: absolute;
  left: 0;
  top: 0;
  width: min(600px, 94vw);
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: #fff;
  box-shadow: 6px 0 22px rgba(15, 23, 42, 0.14);
}
:global(.dark) .cad-drawer {
  background: #1f1f1f;
}

/* 进出场动画（从左滑入） */
.cad-enter-active,
.cad-leave-active {
  transition: opacity 0.18s ease;
}
.cad-enter-active .cad-drawer,
.cad-leave-active .cad-drawer {
  transition: transform 0.18s ease;
}
.cad-enter-from,
.cad-leave-to {
  opacity: 0;
}
.cad-enter-from .cad-drawer,
.cad-leave-to .cad-drawer {
  transform: translateX(-48px);
}

/* -------- 头部 -------- */
.cad-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}
.cad-header-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.cad-icon {
  flex-shrink: 0;
}
.cad-header-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.cad-header-text b {
  font-size: 15px;
  color: #111827;
}
.cad-header-text small {
  font-size: 12px;
  color: #9ca3af;
}
.cad-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: none;
  font-size: 14px;
  color: #9ca3af;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.cad-close:hover {
  background: #f3f4f6;
  color: #111827;
}
:global(.dark) .cad-header {
  border-bottom-color: #2d2d2d;
}
:global(.dark) .cad-header-text b {
  color: #f3f4f6;
}
:global(.dark) .cad-close:hover {
  background: #2d2d2d;
  color: #f3f4f6;
}

/* -------- 主体 -------- */
.cad-main {
  padding: 20px;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 18px;
}
.cad-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
}
:global(.dark) .cad-desc {
  color: #9ca3af;
}

/* 提示条 */
.cad-alert {
  padding: 10px 14px;
  font-size: 13px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
}
.cad-note {
  padding: 10px 14px;
  font-size: 13px;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
}
:global(.dark) .cad-alert {
  color: #fca5a5;
  background: rgba(220, 38, 38, 0.15);
  border-color: rgba(220, 38, 38, 0.35);
}
:global(.dark) .cad-note {
  color: #34d399;
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.35);
}

/* 未安装引导 */
.cad-install {
  display: grid;
  gap: 12px;
  justify-items: start;
  padding: 16px;
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  font-size: 13px;
  color: #6b7280;
}
.cad-install p {
  margin: 0;
}
.cad-hint {
  color: #6b7280;
}
.cad-links {
  display: flex;
  gap: 14px;
}
.cad-links a {
  font-size: 13px;
  color: #2563eb;
  text-decoration: none;
}
.cad-links a:hover {
  text-decoration: underline;
}
:global(.dark) .cad-install {
  border-color: #3d3d3d;
  color: #9ca3af;
}
:global(.dark) .cad-hint {
  color: #9ca3af;
}
:global(.dark) .cad-links a {
  color: #818cf8;
}

/* -------- 区块 -------- */
.cad-section {
  display: grid;
  gap: 10px;
}
.cad-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cad-add { margin-left: auto; }
.cad-section h3,
.cad-section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.cad-count {
  padding: 1px 8px;
  font-size: 11px;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 10px;
}
:global(.dark) .cad-section h3,
:global(.dark) .cad-section-title {
  color: #d1d5db;
}
:global(.dark) .cad-count {
  background: #2d2d2d;
  color: #9ca3af;
}

/* 账号行 */
.cad-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
}
.cad-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.cad-row-main {
  flex: 1;
  display: grid;
  gap: 2px;
  min-width: 0;
}
.cad-row-main b {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}
.cad-row-main small {
  font-size: 12px;
  color: #9ca3af;
}
.cad-callback {
  flex-basis: 100%;
  padding: 5px 8px;
  overflow-wrap: anywhere;
  font-size: 11px;
  color: #475569;
  background: #f8fafc;
  border-radius: 5px;
}
.cad-row-actions {
  margin-left: auto;
  display: flex;
  gap: 10px;
}
.cad-link {
  border: 0;
  background: none;
  padding: 0;
  font-size: 12px;
  color: #4f46e5;
  cursor: pointer;
}
.cad-link:hover {
  text-decoration: underline;
}
.cad-link.is-danger {
  color: #dc2626;
}
:global(.dark) .cad-empty {
  border-color: #3d3d3d;
}
:global(.dark) .cad-row {
  background: #2d2d2d;
  border-color: #3d3d3d;
}
:global(.dark) .cad-row-main b {
  color: #f3f4f6;
}
:global(.dark) .cad-callback {
  color: #cbd5e1;
  background: #242424;
}
:global(.dark) .cad-link {
  color: #818cf8;
}
:global(.dark) .cad-link.is-danger {
  color: #f87171;
}

/* 账号运行状态 */
.cad-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #92400e;
  white-space: nowrap;
}
.cad-status.is-online {
  color: #047857;
}
.cad-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cad-dot.is-on {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}
.cad-dot.is-off {
  background: #d1d5db;
}

/* 账号标签：路由 / 凭证 / 回调积压 */
.cad-tag {
  padding: 3px 9px;
  font-size: 11px;
  color: #374151;
  background: #f3f4f6;
  border-radius: 10px;
  white-space: nowrap;
}
.cad-tag.is-warn {
  color: #b45309;
  background: #fffbeb;
}
:global(.dark) .cad-status {
  color: #fbbf24;
}
:global(.dark) .cad-status.is-online {
  color: #34d399;
}
:global(.dark) .cad-dot.is-off {
  background: #4b5563;
}
:global(.dark) .cad-tag {
  background: #2d2d2d;
  color: #d1d5db;
}
:global(.dark) .cad-tag.is-warn {
  color: #fbbf24;
  background: rgba(180, 83, 9, 0.15);
}

/* -------- 表单 -------- */
.cad-form-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.5);
}
.cad-form-dialog {
  width: min(720px, 96vw);
  max-height: min(820px, 92vh);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
}
.cad-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #e5e7eb;
}
.cad-form-header h3 { margin: 0; font-size: 16px; color: #111827; }
.cad-form-header p { margin: 4px 0 0; font-size: 12px; color: #9ca3af; }
.cad-form-body { display: grid; gap: 18px; padding: 20px; overflow: auto; }
:global(.dark) .cad-form-dialog { background: #1f1f1f; }
:global(.dark) .cad-form-header { border-color: #2d2d2d; }
:global(.dark) .cad-form-header h3 { color: #f3f4f6; }
.cad-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.cad-fields label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: #374151;
}
.cad-fields input,
.cad-fields select {
  box-sizing: border-box;
  width: 100%;
  padding: 9px 11px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  background: #fff;
  color: #111827;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.cad-fields input:focus,
.cad-fields select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
fieldset {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
}
legend {
  padding: 0 7px;
  font-weight: 600;
  font-size: 13px;
}
fieldset > p {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
:global(.dark) .cad-fields label {
  color: #d1d5db;
}
:global(.dark) .cad-fields input,
:global(.dark) .cad-fields select {
  background: #2d2d2d;
  border-color: #3d3d3d;
  color: #f3f4f6;
}
:global(.dark) fieldset {
  border-color: #3d3d3d;
}
:global(.dark) fieldset > p {
  color: #9ca3af;
}
@media (max-width: 640px) {
  .cad-fields {
    grid-template-columns: 1fr;
  }
}

/* -------- 底部 -------- */
.cad-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid #e5e7eb;
}
.cad-enable {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
}
.cad-enable input {
  accent-color: #6366f1;
}
.cad-footer-actions {
  display: flex;
  gap: 8px;
}
:global(.dark) .cad-footer {
  border-top-color: #2d2d2d;
}
:global(.dark) .cad-enable {
  color: #d1d5db;
}

/* -------- 按钮 -------- */
.cad-btn {
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.cad-btn:hover {
  background: #f3f4f6;
}
.cad-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cad-btn-primary {
  color: #fff;
  background: #6366f1;
  border-color: #6366f1;
}
.cad-btn-primary:hover {
  background: #4f46e5;
}
:global(.dark) .cad-btn {
  background: #2d2d2d;
  border-color: #3d3d3d;
  color: #f3f4f6;
}
:global(.dark) .cad-btn:hover {
  background: #3d3d3d;
}
:global(.dark) .cad-btn-primary {
  background: #6366f1;
  border-color: #6366f1;
}
:global(.dark) .cad-btn-primary:hover {
  background: #818cf8;
}
</style>
