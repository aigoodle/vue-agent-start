<script setup lang="ts">
import { onMounted, ref } from 'vue';

import type { AgentStartClient } from '../../client';
import type { OpenClawPlugin, OpenClawPluginInstallProgress, OpenClawRuntime } from '../types';
import JsonSchemaForm from './JsonSchemaForm.vue';

const props = defineProps<{ client: AgentStartClient }>();
const emit = defineEmits<{ (e: 'changed'): void }>();

const runtime = ref<OpenClawRuntime>();
const plugins = ref<OpenClawPlugin[]>([]);
const loading = ref(false);
const error = ref('');
const showInstall = ref(false);
const sourceType = ref('npm');
const source = ref('');
const version = ref('');
const installing = ref(false);
const installProgress = ref<OpenClawPluginInstallProgress>();
const installError = ref('');
const configuring = ref<OpenClawPlugin>();
const config = ref<Record<string, unknown>>({});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    [runtime.value, plugins.value] = await Promise.all([
      props.client.connectors.runtime(),
      props.client.connectors.plugins(),
    ]);
  } catch (e: any) {
    error.value = e?.message ?? 'OpenClaw 不可用';
  } finally {
    loading.value = false;
  }
}

async function install() {
  installing.value = true;
  installError.value = '';
  installProgress.value = { percent: 0, stage: 'QUEUED', message: '准备开始安装' };
  try {
    await props.client.connectors.installPluginStream({
      sourceType: sourceType.value,
      source: source.value,
      version: version.value || undefined,
    }, (progress) => { installProgress.value = progress; });
    source.value = '';
    await load();
    emit('changed');
  } catch (e: any) {
    installError.value = e?.message ?? '插件安装失败';
  } finally {
    installing.value = false;
  }
}

async function toggle(p: OpenClawPlugin) {
  await props.client.connectors.setPluginEnabled(p.id, !p.enabled);
  await load();
  emit('changed');
}

async function saveConfig() {
  if (!configuring.value) return;
  await props.client.connectors.configurePlugin(configuring.value.id, config.value);
  configuring.value = undefined;
  config.value = {};
  await load();
  emit('changed');
}

async function uninstall(p: OpenClawPlugin) {
  if (!confirm(`卸载「${p.name}」？引用其工具的 Agent 和工作流将无法执行。`)) {
    return;
  }
  await props.client.connectors.uninstallPlugin(p.id);
  await load();
  emit('changed');
}

onMounted(load);
defineExpose({ load });
</script>

<template>
  <div class="ocp-root">
    <!-- 运行时状态条 -->
    <div class="ocp-runtime">
      <span
        class="ocp-dot"
        :class="runtime?.status === 'UP' ? 'is-up' : 'is-down'"
      ></span>
      <div class="ocp-runtime-text">
        <b>OpenClaw {{ runtime?.status === 'UP' ? '已连接' : '未连接' }}</b>
        <small>
          {{ runtime?.version || '未知版本' }} · Bridge
          {{ runtime?.bridgeVersion || '-' }}
        </small>
        <small v-if="runtime?.inbound" :title="runtime.inbound.lastCallbackError || ''">
          入站观察 {{ runtime.inbound.observed || 0 }} · 回调成功
          {{ runtime.inbound.callbackSucceeded || 0 }} · 失败
          {{ runtime.inbound.callbackFailed || 0 }}
        </small>
      </div>
      <button class="ocp-btn" @click="load">刷新</button>
      <button class="ocp-btn ocp-btn-primary" @click="showInstall = true">
        安装插件
      </button>
    </div>

    <div v-if="error" class="ocp-alert">{{ error }}</div>

    <!-- 插件列表 -->
    <div v-if="loading" class="ocp-state">加载中…</div>
    <div v-else-if="plugins.length" class="ocp-plugins">
      <article v-for="p in plugins" :key="p.id" class="ocp-plugin">
        <div class="ocp-plugin-info">
          <b>{{ p.name }}</b>
          <small>{{ p.id }} · {{ p.version || '-' }}</small>
          <p>{{ p.description }}</p>
        </div>
        <span class="ocp-pill" :class="p.enabled ? 'is-on' : 'is-off'">
          {{ p.enabled ? '已启用' : '已禁用' }}
        </span>
        <div class="ocp-plugin-actions">
          <button class="ocp-btn" @click="configuring = p">配置</button>
          <button class="ocp-btn" @click="toggle(p)">
            {{ p.enabled ? '禁用' : '启用' }}
          </button>
          <button class="ocp-btn ocp-btn-danger" @click="uninstall(p)">
            卸载
          </button>
        </div>
      </article>
    </div>
    <div v-else class="ocp-state">尚未安装插件</div>

    <!-- 安装弹窗 -->
    <Transition name="ocp-modal">
      <div
        v-if="showInstall"
        class="ocp-mask"
        @click.self="!installing && (showInstall = false)"
      >
        <section class="ocp-modal">
          <h3>安装 OpenClaw 插件</h3>
          <label class="ocp-field">
            <span>来源</span>
            <select v-model="sourceType" class="ocp-input">
              <option value="npm">npm</option>
              <option value="clawhub">ClawHub</option>
            </select>
          </label>
          <label class="ocp-field">
            <span>包名或来源</span>
            <input
              v-model="source"
              class="ocp-input"
              placeholder="@openclaw/example-plugin"
            />
          </label>
          <label class="ocp-field">
            <span>版本</span>
            <input
              v-model="version"
              class="ocp-input"
              placeholder="建议固定明确版本"
            />
          </label>
          <p class="ocp-hint">
            插件将在 OpenClaw 容器内运行第三方代码，仅限部署管理员操作。
          </p>
          <div v-if="installProgress" class="ocp-install-progress" :class="{ 'is-error': installError }">
            <div class="ocp-progress-head">
              <span>{{ installError || installProgress.message }}</span>
              <b>{{ installProgress.percent }}%</b>
            </div>
            <div class="ocp-progress-track"><i :style="{ width: `${installProgress.percent}%` }"></i></div>
            <small>{{ installError ? '安装失败' : installProgress.stage }}</small>
          </div>
          <footer class="ocp-modal-footer">
            <button class="ocp-btn" :disabled="installing" @click="showInstall = false">{{ installProgress?.percent === 100 ? '关闭' : '取消' }}</button>
            <button
              class="ocp-btn ocp-btn-primary"
              :disabled="!source || installing"
              @click="install"
            >
              {{ installing ? '安装中…' : installProgress?.percent === 100 ? '重新安装' : '安装' }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>

    <!-- 插件配置弹窗 -->
    <Transition name="ocp-modal">
      <div
        v-if="configuring"
        class="ocp-mask"
        @click.self="configuring = undefined"
      >
        <section class="ocp-modal">
          <h3>配置 {{ configuring.name }}</h3>
          <JsonSchemaForm v-model="config" :schema="configuring.configSchema" />
          <footer class="ocp-modal-footer">
            <button class="ocp-btn" @click="configuring = undefined">
              取消
            </button>
            <button class="ocp-btn ocp-btn-primary" @click="saveConfig">
              保存
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ocp-root {
  display: grid;
  gap: 16px;
}

/* -------- 运行时状态条 -------- */
.ocp-runtime {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.ocp-runtime-text {
  display: grid;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.ocp-runtime-text b {
  font-size: 13px;
  color: #111827;
}
.ocp-runtime-text small {
  font-size: 12px;
  color: #9ca3af;
}
.ocp-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
}
.ocp-dot.is-up {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}
.ocp-dot.is-down {
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}
:global(.dark) .ocp-runtime {
  background: #1f1f1f;
  border-color: #2d2d2d;
}
:global(.dark) .ocp-runtime-text b {
  color: #f3f4f6;
}

/* -------- 警告 / 状态 -------- */
.ocp-alert {
  padding: 10px 14px;
  font-size: 13px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
}
.ocp-state {
  padding: 48px 0;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
}
:global(.dark) .ocp-alert {
  color: #fca5a5;
  background: rgba(220, 38, 38, 0.15);
  border-color: rgba(220, 38, 38, 0.35);
}

/* -------- 插件列表 -------- */
.ocp-plugins {
  display: grid;
  gap: 10px;
}
.ocp-plugin {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  align-items: center;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}
.ocp-plugin:hover {
  border-color: #a5b4fc;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}
.ocp-plugin-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.ocp-plugin-info b {
  font-size: 13px;
  color: #111827;
}
.ocp-plugin-info small {
  font-size: 12px;
  color: #9ca3af;
}
.ocp-plugin-info p {
  margin: 3px 0 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
.ocp-plugin-actions {
  display: flex;
  gap: 8px;
}
:global(.dark) .ocp-plugin {
  background: #1f1f1f;
  border-color: #2d2d2d;
}
:global(.dark) .ocp-plugin:hover {
  border-color: #6366f1;
}
:global(.dark) .ocp-plugin-info b {
  color: #f3f4f6;
}
:global(.dark) .ocp-plugin-info p {
  color: #9ca3af;
}
@media (max-width: 640px) {
  .ocp-plugin {
    grid-template-columns: 1fr;
  }
  .ocp-plugin-actions {
    justify-content: flex-end;
  }
}

/* -------- 状态徽章 -------- */
.ocp-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 10px;
  white-space: nowrap;
}
.ocp-pill.is-on {
  color: #059669;
  background: #ecfdf5;
}
.ocp-pill.is-off {
  color: #6b7280;
  background: #f3f4f6;
}
:global(.dark) .ocp-pill.is-on {
  color: #34d399;
  background: rgba(16, 185, 129, 0.15);
}
:global(.dark) .ocp-pill.is-off {
  color: #9ca3af;
  background: #2d2d2d;
}

/* -------- 按钮 -------- */
.ocp-btn {
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
.ocp-btn:hover {
  background: #f3f4f6;
}
.ocp-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ocp-btn-primary {
  color: #fff;
  background: #6366f1;
  border-color: #6366f1;
}
.ocp-btn-primary:hover {
  background: #4f46e5;
}
.ocp-btn-danger {
  color: #dc2626;
  border-color: #fecaca;
}
.ocp-btn-danger:hover {
  background: #fef2f2;
}
:global(.dark) .ocp-btn {
  background: #2d2d2d;
  border-color: #3d3d3d;
  color: #f3f4f6;
}
:global(.dark) .ocp-btn:hover {
  background: #3d3d3d;
}
:global(.dark) .ocp-btn-primary {
  background: #6366f1;
  border-color: #6366f1;
}
:global(.dark) .ocp-btn-primary:hover {
  background: #818cf8;
}
:global(.dark) .ocp-btn-danger {
  color: #f87171;
  border-color: rgba(220, 38, 38, 0.4);
}
:global(.dark) .ocp-btn-danger:hover {
  background: rgba(220, 38, 38, 0.15);
}

/* -------- 弹窗 -------- */
.ocp-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}
.ocp-modal {
  width: 520px;
  max-width: 92vw;
  max-height: 88vh;
  overflow: auto;
  display: grid;
  gap: 14px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.25);
}
.ocp-modal h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}
.ocp-field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}
.ocp-input {
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.ocp-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
.ocp-hint {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
.ocp-install-progress { display:grid; gap:8px; padding:12px; border:1px solid #c7d2fe; border-radius:8px; background:#eef2ff; color:#3730a3; }
.ocp-progress-head { display:flex; justify-content:space-between; gap:12px; font-size:12px; }
.ocp-progress-track { height:7px; overflow:hidden; border-radius:99px; background:#c7d2fe; }
.ocp-progress-track i { display:block; height:100%; border-radius:inherit; background:#6366f1; transition:width .25s ease; }
.ocp-install-progress small { font-size:11px; opacity:.75; }
.ocp-install-progress.is-error { color:#b91c1c; border-color:#fecaca; background:#fef2f2; }
.ocp-install-progress.is-error .ocp-progress-track { background:#fecaca; }
.ocp-install-progress.is-error .ocp-progress-track i { background:#ef4444; }
.ocp-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
:global(.dark) .ocp-modal {
  background: #1f1f1f;
}
:global(.dark) .ocp-modal h3 {
  color: #f3f4f6;
}
:global(.dark) .ocp-field {
  color: #d1d5db;
}
:global(.dark) .ocp-input {
  background: #2d2d2d;
  border-color: #3d3d3d;
  color: #f3f4f6;
}
:global(.dark) .ocp-hint {
  color: #9ca3af;
}

/* 弹窗进出场动画 */
.ocp-modal-enter-active,
.ocp-modal-leave-active {
  transition: opacity 0.18s ease;
}
.ocp-modal-enter-active .ocp-modal,
.ocp-modal-leave-active .ocp-modal {
  transition: transform 0.18s ease;
}
.ocp-modal-enter-from,
.ocp-modal-leave-to {
  opacity: 0;
}
.ocp-modal-enter-from .ocp-modal,
.ocp-modal-leave-to .ocp-modal {
  transform: translateY(12px) scale(0.98);
}
</style>
