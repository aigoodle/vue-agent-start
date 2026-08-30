<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  CodeOutlined,
  DownloadOutlined,
  EyeOutlined,
  GlobalOutlined,
  MessageOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue';
import { Card, Tag } from 'ant-design-vue';

import type { AgentStartClient } from '../../client';
import type { AgentEntity } from '../../agent-studio/adapters/types';
import type {
  ChannelConnection,
  ChannelDefinition,
  ChannelEvent,
} from '../types';
import ChannelAccountDrawer from './ChannelAccountDrawer.vue';
import AgentVersionSelect from './AgentVersionSelect.vue';
import ChannelIcon from './ChannelIcon.vue';
import ChannelMonitorDrawer from './ChannelMonitorDrawer.vue';

const props = defineProps<{ client: AgentStartClient; tenantId?: string }>();

// -------- state
const catalog = ref<ChannelDefinition[]>([]);
const rows = ref<ChannelConnection[]>([]);
const agents = ref<AgentEntity[]>([]);
const events = ref<ChannelEvent[]>([]);
const loading = ref(false);
const error = ref('');
const installing = ref('');
const autoRefresh = ref(true);
const tenantDefaults = ref({
  defaultAgentId: '',
  defaultAgentVersionId: '',
  fallbackAgentId: '',
  fallbackAgentVersionId: '',
  enabled: true,
});

// 抽屉状态：账号接入（左）与消息观察（右）各自记住对应通道
const accountOpen = ref(false);
const selectedKey = ref('');
const monitorOpen = ref(false);
const monitorKey = ref('');

let refreshTimer: ReturnType<typeof setInterval> | undefined;

// -------- helpers
const keyOf = (channel: ChannelDefinition) => `${channel.provider}:${channel.channelId}`;
const platformOf = (channel: ChannelDefinition) =>
  String(channel.metadata?.platformId ?? channel.channelId).toLowerCase();
const linkOf = (channel: ChannelDefinition, field: 'homepageUrl' | 'sourceUrl') => {
  const value = channel.metadata?.[field];
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : '';
};
// 查看详情：优先官方插件详情页（metadata.detailUrl），其次官网主页
const detailUrlOf = (channel: ChannelDefinition) => {
  const detail = channel.metadata?.detailUrl;
  return typeof detail === 'string' && /^https?:\/\//.test(detail)
    ? detail
    : linkOf(channel, 'homepageUrl');
};
// 官网链接与详情链接相同时不再单独展示
const homepageLinkOf = (channel: ChannelDefinition) => {
  const home = linkOf(channel, 'homepageUrl');
  return home && home !== detailUrlOf(channel) ? home : '';
};
// -------- computed
const platformGroups = computed(() => {
  const groups = new Map<
    string,
    { id: string; name: string; description?: string; adapters: ChannelDefinition[] }
  >();
  for (const channel of catalog.value) {
    const id = platformOf(channel);
    const current = groups.get(id);
    if (current) current.adapters.push(channel);
    else groups.set(id, { id, name: channel.name, description: channel.description, adapters: [channel] });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
});
const channelSections = computed(() => [
  {
    key: 'installed',
    title: '已接入渠道',
    description: 'OpenClaw 插件已安装，或 Hermes 平台已完成配置并启用。',
    groups: platformGroups.value.filter(groupInstalled),
    compact: false,
  },
  {
    key: 'available',
    title: '可接入渠道',
    description: 'OpenClaw 渠道可安装插件；Hermes 渠道可直接配置对应平台。',
    groups: platformGroups.value.filter((group) => !groupInstalled(group)),
    compact: true,
  },
].filter((section) => section.groups.length));
const selectedChannel = computed(() =>
  catalog.value.find((channel) => keyOf(channel) === selectedKey.value),
);
const monitorChannel = computed(() =>
  catalog.value.find((channel) => keyOf(channel) === monitorKey.value),
);
const channelAccounts = computed(() =>
  selectedChannel.value
    ? rows.value.filter(
        (row) =>
          row.provider === selectedChannel.value?.provider &&
          row.channelId === selectedChannel.value?.channelId,
      )
    : [],
);
const monitorConnections = computed(() =>
  monitorChannel.value
    ? rows.value.filter(
        (row) =>
          row.provider === monitorChannel.value?.provider &&
          row.channelId === monitorChannel.value?.channelId,
      )
    : [],
);

function primaryOf(group: { adapters: ChannelDefinition[] }) {
  return group.adapters.find(adapterReady)
    ?? group.adapters.find((channel) => channel.provider === 'openclaw')
    ?? group.adapters[0];
}
function adapterReady(channel: ChannelDefinition) {
  if (channel.provider === 'openclaw') return channel.installed;
  if (channel.provider === 'hermes') {
    return channel.enabled || ['ONLINE', 'RUNNING', 'OFFLINE'].includes(channel.runtimeStatus);
  }
  return channel.installed && channel.runtimeStatus !== 'DISABLED';
}
function groupInstalled(group: { adapters: ChannelDefinition[] }) {
  return group.adapters.some(adapterReady);
}
function accountCountOf(channel: ChannelDefinition) {
  return rows.value.filter(
    (row) => row.provider === channel.provider && row.channelId === channel.channelId,
  ).length;
}
function messageCountOf(channel: ChannelDefinition) {
  return events.value.filter(
    (event) => event.provider === channel.provider && event.channelId === channel.channelId,
  ).length;
}
function groupAccountCount(group: { adapters: ChannelDefinition[] }) {
  return group.adapters.reduce((sum, channel) => sum + accountCountOf(channel), 0);
}
function groupMessageCount(group: { adapters: ChannelDefinition[] }) {
  return group.adapters.reduce((sum, channel) => sum + messageCountOf(channel), 0);
}

// -------- drawer actions
function openAccount(channel: ChannelDefinition) {
  selectedKey.value = keyOf(channel);
  accountOpen.value = true;
}
function openMonitor(channel: ChannelDefinition) {
  monitorKey.value = keyOf(channel);
  monitorOpen.value = true;
}

// -------- data loading
async function load(forceRefresh = false) {
  loading.value = true;
  error.value = '';
  try {
    const [channels, connections, agentList, tenantBinding] = await Promise.all([
      props.client.connectors.listChannels(forceRefresh),
      props.client.connectors.listChannelConnections(props.tenantId),
      props.client.agents.list(),
      props.client.connectors.getTenantAgentBinding(props.tenantId),
    ]);
    catalog.value = channels;
    rows.value = connections;
    agents.value = agentList;
    tenantDefaults.value = {
      defaultAgentId: tenantBinding?.defaultAgentId ?? '',
      defaultAgentVersionId: tenantBinding?.defaultAgentVersionId ?? '',
      fallbackAgentId: tenantBinding?.fallbackAgentId ?? '',
      fallbackAgentVersionId: tenantBinding?.fallbackAgentVersionId ?? '',
      enabled: tenantBinding?.enabled ?? true,
    };
  } catch (e: any) {
    error.value = e?.message ?? '加载消息通道失败';
  } finally {
    loading.value = false;
  }
}
async function loadEvents() {
  try {
    events.value = await props.client.connectors.listChannelEvents({
      tenantId: props.tenantId,
      limit: 100,
    });
  } catch (e: any) {
    error.value = e?.message ?? '加载消息记录失败';
  }
}

// -------- row / form actions
async function saveTenantDefaults() {
  if (!tenantDefaults.value.defaultAgentId) {
    error.value = '请选择租户默认 Agent';
    return;
  }
  await props.client.connectors.saveTenantAgentBinding(props.tenantId, tenantDefaults.value);
  await load();
}
async function installChannel(channel: ChannelDefinition) {
  if (installing.value) return;
  if (channel.provider !== 'openclaw') {
    error.value = `${channel.provider} 适配器由对应运行时管理，无需在 OpenClaw 中安装`;
    return;
  }
  const packageSpec = String(channel.metadata?.packageSpec ?? '');
  if (!packageSpec) {
    error.value = `通道 ${channel.name} 未声明安装包`;
    return;
  }
  installing.value = keyOf(channel);
  error.value = '';
  try {
    await props.client.connectors.installPlugin({ sourceType: 'npm', source: packageSpec });
    await load(true);
    const installed = catalog.value.find((item) => keyOf(item) === keyOf(channel));
    if (installed?.installed) openAccount(installed);
  } catch (e: any) {
    error.value = e?.message ?? `安装 ${channel.name} 失败`;
  } finally {
    installing.value = '';
  }
}

// -------- drawer events
async function handleAccountSaved() {
  await load(true);
}
async function handleEventsChanged() {
  await loadEvents();
}

onMounted(async () => {
  await load();
  await loadEvents();
  refreshTimer = setInterval(() => {
    if (autoRefresh.value) loadEvents();
  }, 3000);
});
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<template>
  <section class="cc-panel">
    <!-- 头部介绍 -->
    <header class="cc-intro">
      <div>
        <h3>消息渠道</h3>
        <p>统一接入 OpenClaw、Hermes 等运行时适配器；账号归属于租户和员工，并路由到指定 Agent。</p>
      </div>
      <button class="cc-btn" @click="load(true)">强制刷新目录</button>
    </header>

    <div v-if="error" class="cc-alert">{{ error }}</div>

    <!-- 租户默认 Agent -->
    <section class="cc-tenant">
      <div class="cc-tenant-text">
        <h3>租户默认 Agent</h3>
        <p>员工没有专属 Agent 时使用，绝不回退到 OpenClaw 默认模型。</p>
      </div>
      <div class="cc-tenant-fields">
        <select v-model="tenantDefaults.defaultAgentId">
          <option value="">请选择默认 Agent</option>
          <option v-for="agent in agents" :key="agent.id" :value="agent.id">
            {{ agent.name }}
          </option>
        </select>
        <AgentVersionSelect
          v-model="tenantDefaults.defaultAgentVersionId"
          :client="client"
          :agent-id="tenantDefaults.defaultAgentId"
          follow-label="默认 Agent 跟随当前发布版本"
        />
        <select v-model="tenantDefaults.fallbackAgentId">
          <option value="">无备用 Agent</option>
          <option v-for="agent in agents" :key="agent.id" :value="agent.id">
            {{ agent.name }}
          </option>
        </select>
        <AgentVersionSelect
          v-model="tenantDefaults.fallbackAgentVersionId"
          :client="client"
          :agent-id="tenantDefaults.fallbackAgentId"
          follow-label="备用 Agent 跟随当前发布版本"
        />
        <button class="cc-btn cc-btn-primary" @click="saveTenantDefaults">保存</button>
      </div>
    </section>

    <!-- 通道目录卡片 -->
    <div v-if="loading && !catalog.length" class="cc-state">加载中…</div>
    <div v-else-if="!platformGroups.length" class="cc-state">暂无可用通道适配器</div>
    <div v-else class="cc-catalog">
      <section v-for="section in channelSections" :key="section.key" class="cc-channel-group">
        <header class="cc-group-head">
          <div><h3>{{ section.title }}</h3><p>{{ section.description }}</p></div>
          <span>{{ section.groups.length }}</span>
        </header>
        <div :class="['cc-cards', { 'is-compact': section.compact }]">
          <Card
            v-for="group in section.groups"
            :key="group.id"
            hoverable
            :class="['cc-card', { 'is-compact': section.compact }]"
            :body-style="{ padding: section.compact ? '12px 14px' : '16px 16px 14px' }"
            @click="openAccount(primaryOf(group))"
          >
            <header class="cc-card-head">
              <ChannelIcon
                :platform-id="group.id"
                :channel-id="primaryOf(group).channelId"
                :metadata="primaryOf(group).metadata"
                :name="group.name"
                :size="section.compact ? 36 : 44"
                :radius="section.compact ? 9 : 12"
              />
              <div class="cc-card-title">
                <b>{{ group.name }}</b>
                <small>
                  <template v-if="group.adapters.length === 1">
                    {{ group.adapters[0].provider }} · {{ group.adapters[0].version || '-' }}
                  </template>
                  <template v-else>{{ group.adapters.length }} 个适配器</template>
                </small>
              </div>
              <Tag v-if="groupInstalled(group)" class="cc-pill" color="success">已接入</Tag>
              <Tag v-else class="cc-pill">未接入</Tag>
            </header>

            <p class="cc-desc">{{ group.description || '暂无描述' }}</p>

            <div v-if="!section.compact" class="cc-stats">
              <span
                class="cc-stat is-link"
                title="查看该渠道已配置账号"
                @click.stop="openAccount(primaryOf(group))"
              >
                <b>{{ groupAccountCount(group) }}</b>账号
              </span>
              <span
                class="cc-stat is-link"
                title="查看该渠道消息"
                @click.stop="openMonitor(primaryOf(group))"
              >
                <b>{{ groupMessageCount(group) }}</b>消息
              </span>
              <span class="cc-runtime">
                <i
                  :class="[
                    'cc-dot',
                    primaryOf(group).runtimeStatus === 'ONLINE' ? 'is-on' : 'is-off',
                  ]"
                ></i>
                {{ primaryOf(group).runtimeStatus }}
              </span>
            </div>

            <!-- 多适配器平台：列出每个 provider，可单独打开抽屉 -->
            <div v-if="!section.compact && group.adapters.length > 1" class="cc-adapters">
              <div
                v-for="channel in group.adapters"
                :key="keyOf(channel)"
                class="cc-adapter"
                @click.stop="openAccount(channel)"
              >
                <i
                  :class="[
                    'cc-dot',
                    channel.runtimeStatus === 'ONLINE' ? 'is-on' : 'is-off',
                  ]"
                ></i>
                <b>{{ channel.provider }}</b>
                <small>{{ channel.runtimeStatus }}</small>
                <span class="cc-adapter-ops">
                  <button class="cc-mini" @click.stop="openMonitor(channel)">消息</button>
                  <button
                    v-if="!channel.installed && channel.provider === 'openclaw'"
                    class="cc-mini is-primary"
                    :disabled="!!installing"
                    @click.stop="installChannel(channel)"
                  >
                    {{ installing === keyOf(channel) ? '安装中…' : '安装' }}
                  </button>
                </span>
              </div>
            </div>

            <!-- 底部操作：antd Card #actions 插槽，图标 + 文字小按钮 -->
            <template #actions>
              <span
                v-if="adapterReady(primaryOf(group))"
                class="cc-act"
                @click.stop="openAccount(primaryOf(group))"
              >
                <SettingOutlined />账号接入
              </span>
              <span
                v-else-if="primaryOf(group).provider === 'openclaw'"
                :class="['cc-act', 'is-primary', { 'is-disabled': !!installing }]"
                @click.stop="installChannel(primaryOf(group))"
              >
                <DownloadOutlined />{{ installing === keyOf(primaryOf(group)) ? '安装中…' : '安装' }}
              </span>
              <span v-else class="cc-act" @click.stop="openAccount(primaryOf(group))">
                <SettingOutlined />配置接入
              </span>

              <span
                v-if="adapterReady(primaryOf(group))"
                class="cc-act cc-act-monitor"
                @click.stop="openMonitor(primaryOf(group))"
              >
                <MessageOutlined />消息
              </span>
              <a
                v-else-if="detailUrlOf(primaryOf(group))"
                class="cc-act"
                :href="detailUrlOf(primaryOf(group))"
                target="_blank"
                rel="noopener"
                @click.stop
              >
                <EyeOutlined />查看详情
              </a>
              <span v-else class="cc-act" @click.stop="openAccount(primaryOf(group))">
                <EyeOutlined />查看详情
              </span>

              <a
                v-if="homepageLinkOf(primaryOf(group))"
                class="cc-act-link"
                :href="homepageLinkOf(primaryOf(group))"
                target="_blank"
                rel="noopener"
                @click.stop
              >
                <GlobalOutlined />官网
              </a>
              <a
                v-if="linkOf(primaryOf(group), 'sourceUrl')"
                class="cc-act-link"
                :href="linkOf(primaryOf(group), 'sourceUrl')"
                target="_blank"
                rel="noopener"
                @click.stop
              >
                <CodeOutlined />源码
              </a>
            </template>
          </Card>
        </div>
      </section>
    </div>

    <!-- 左侧抽屉：账号接入（已配置账号在「账号」统计点击后于抽屉内展示） -->
    <ChannelAccountDrawer
      v-model:open="accountOpen"
      :channel="selectedChannel"
      :connections="channelAccounts"
      :agents="agents"
      :client="client"
      :tenant-id="tenantId"
      @saved="handleAccountSaved"
    />

    <!-- 右侧抽屉：消息观察 -->
    <ChannelMonitorDrawer
      v-model:open="monitorOpen"
      v-model:auto-refresh="autoRefresh"
      :channel="monitorChannel"
      :connections="monitorConnections"
      :events="events"
      :client="client"
      :tenant-id="tenantId"
      @refresh="loadEvents"
      @events-changed="handleEventsChanged"
    />
  </section>
</template>

<style scoped>
/* -------- 面板骨架 -------- */
.cc-panel {
  display: grid;
  gap: 18px;
}

/* -------- 头部介绍卡片 -------- */
.cc-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 20px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.cc-intro h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: #111827;
}
.cc-intro p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
:global(.dark) .cc-intro {
  background: #1f1f1f;
  border-color: #2d2d2d;
}
:global(.dark) .cc-intro h3 {
  color: #f3f4f6;
}
:global(.dark) .cc-intro p {
  color: #9ca3af;
}

/* -------- 错误提示 -------- */
.cc-alert {
  padding: 10px 14px;
  font-size: 13px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
}
:global(.dark) .cc-alert {
  color: #fca5a5;
  background: rgba(220, 38, 38, 0.15);
  border-color: rgba(220, 38, 38, 0.35);
}

/* -------- 租户默认 Agent -------- */
.cc-tenant {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 16px 18px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 12px;
}
.cc-tenant h3 {
  margin: 0 0 4px;
  font-size: 14px;
  color: #111827;
}
.cc-tenant p {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
.cc-tenant-fields {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cc-tenant-fields select {
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid #bfdbfe;
  border-radius: 7px;
  background: #fff;
  color: #111827;
  cursor: pointer;
}
:global(.dark) .cc-tenant {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}
:global(.dark) .cc-tenant h3 {
  color: #f3f4f6;
}
:global(.dark) .cc-tenant p {
  color: #9ca3af;
}
:global(.dark) .cc-tenant-fields select {
  background: #2d2d2d;
  border-color: #3d3d3d;
  color: #f3f4f6;
}

/* -------- 空 / 加载状态 -------- */
.cc-state {
  padding: 48px 0;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
}

/* -------- 通道卡片网格 -------- */
.cc-catalog,
.cc-channel-group {
  display: grid;
  gap: 12px;
}
.cc-catalog { gap: 22px; }
.cc-group-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px;
}
.cc-group-head h3 { margin: 0 0 4px; font-size: 15px; color: #111827; }
.cc-group-head p { margin: 0; font-size: 12px; color: #9ca3af; }
.cc-group-head > span {
  min-width: 24px;
  padding: 2px 8px;
  text-align: center;
  font-size: 11px;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 999px;
}
:global(.dark) .cc-group-head h3 { color: #f3f4f6; }
:global(.dark) .cc-group-head > span { color: #9ca3af; background: #2d2d2d; }
.cc-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
/* 可接入渠道一行 6 张，窄屏逐级递减 */
.cc-cards.is-compact {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 1520px) {
  .cc-cards.is-compact {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 1100px) {
  .cc-cards.is-compact {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 780px) {
  .cc-cards.is-compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .cc-cards.is-compact {
    grid-template-columns: 1fr;
  }
}
/* 卡片基于 antd Card，仅覆写圆角、边框、悬浮与内部节奏 */
.cc-card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  border-color: #e5e7eb;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease,
    border-color 0.15s ease;
}
.cc-card:hover {
  transform: translateY(-2px);
  border-color: #a5b4fc;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
}
.cc-card :deep(.ant-card-body) {
  flex: 1;
  display: grid;
  align-content: start;
  gap: 10px;
}
.cc-card.is-compact {
  border-radius: 10px;
}
.cc-card.is-compact:hover { transform: translateY(-1px); }
.cc-card.is-compact :deep(.ant-card-body) {
  gap: 7px;
}
.cc-card.is-compact .cc-desc {
  min-height: 0;
  -webkit-line-clamp: 1;
  font-size: 12px;
}
:global(.dark) .cc-card {
  background: #1f1f1f;
  border-color: #2d2d2d;
}
:global(.dark) .cc-card:hover {
  border-color: #6366f1;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}

/* 卡片头部 */
.cc-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cc-card-title {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}
.cc-card-title b {
  font-size: 15px;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-card-title small {
  font-size: 12px;
  color: #9ca3af;
}
:global(.dark) .cc-card-title b {
  color: #f3f4f6;
}

/* 描述：两行截断 */
.cc-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  min-height: 39px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
:global(.dark) .cc-desc {
  color: #9ca3af;
}

/* 统计行：更紧凑的数字胶囊 */
.cc-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cc-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 2px 8px;
  font-size: 11px;
  color: #6b7280;
  background: #f8fafc;
  border: 1px solid #eef2f6;
  border-radius: 999px;
  white-space: nowrap;
}
.cc-stat b {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
}
.cc-stat.is-link {
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}
.cc-stat.is-link:hover {
  color: #4f46e5;
  border-color: #c7d2fe;
  background: #eef2ff;
}
.cc-stat.is-link:hover b {
  color: #4f46e5;
}
.cc-runtime {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
}
:global(.dark) .cc-stat {
  color: #9ca3af;
  background: #232323;
  border-color: #2d2d2d;
}
:global(.dark) .cc-stat b {
  color: #f3f4f6;
}
:global(.dark) .cc-stat.is-link:hover {
  color: #818cf8;
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.12);
}
:global(.dark) .cc-stat.is-link:hover b {
  color: #818cf8;
}

/* 状态圆点 */
.cc-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cc-dot.is-on {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}
.cc-dot.is-off {
  background: #d1d5db;
}
:global(.dark) .cc-dot.is-off {
  background: #4b5563;
}

/* 状态徽章：复用 antd Tag，这里只做定位并去掉默认右间距 */
.cc-pill {
  margin: 0 0 0 auto;
  flex-shrink: 0;
  line-height: 18px;
}

/* 多适配器列表 */
.cc-adapters {
  display: grid;
  gap: 6px;
}
.cc-adapter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  font-size: 12px;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.cc-adapter:hover {
  border-color: #a5b4fc;
  background: #eef2ff;
}
.cc-adapter b {
  font-size: 12px;
  color: #111827;
}
.cc-adapter small {
  color: #9ca3af;
}
.cc-adapter-ops {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
:global(.dark) .cc-adapter {
  background: #191919;
  border-color: #2d2d2d;
}
:global(.dark) .cc-adapter:hover {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.12);
}
:global(.dark) .cc-adapter b {
  color: #f3f4f6;
}

/* 卡片底部操作：antd Card #actions 插槽（图标 + 文字小按钮） */
.cc-card :deep(.ant-card-actions) {
  border-top: 1px solid #f3f4f6;
  background: transparent;
}
.cc-card :deep(.ant-card-actions > li) {
  margin: 6px 0;
}
.cc-card :deep(.ant-card-actions > li > span) {
  color: inherit;
}
/* actions 内的图标 + 文字 / 链接统一成小号可点样式 */
.cc-act,
.cc-act-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  white-space: nowrap;
  color: #6b7280;
  cursor: pointer;
  transition:
    color 0.15s ease,
    transform 0.15s ease;
}
/* 图标略大于文字，保持原先图标按钮的视觉分量 */
.cc-act :deep(svg),
.cc-act-link :deep(svg) {
  font-size: 13px;
}
a.cc-act,
a.cc-act-link {
  color: #6b7280;
  text-decoration: none;
}
.cc-act:hover,
.cc-act-link:hover {
  color: #4f46e5;
  transform: translateY(-1px);
}
.cc-act.is-primary {
  color: #4f46e5;
}
.cc-act.is-disabled {
  color: #c7d2fe;
  cursor: not-allowed;
}
.cc-act.is-disabled:hover {
  transform: none;
}
:global(.dark) .cc-card :deep(.ant-card-actions) {
  border-top-color: #2d2d2d;
}
:global(.dark) .cc-act,
:global(.dark) .cc-act-link,
:global(.dark) a.cc-act,
:global(.dark) a.cc-act-link {
  color: #9ca3af;
}
:global(.dark) .cc-act:hover,
:global(.dark) .cc-act-link:hover {
  color: #818cf8;
}
:global(.dark) .cc-act.is-primary {
  color: #818cf8;
}
:global(.dark) .cc-act.is-disabled {
  color: #4b5563;
}

/* -------- 按钮 -------- */
.cc-btn {
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.cc-btn:hover {
  background: #f3f4f6;
}
.cc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cc-btn-primary {
  color: #fff;
  background: #6366f1;
  border-color: #6366f1;
}
.cc-btn-primary:hover {
  background: #4f46e5;
}
.cc-btn.is-danger {
  color: #dc2626;
  border-color: #fecaca;
}
.cc-btn.is-danger:hover {
  background: #fef2f2;
}
:global(.dark) .cc-btn {
  background: #2d2d2d;
  border-color: #3d3d3d;
  color: #f3f4f6;
}
:global(.dark) .cc-btn:hover {
  background: #3d3d3d;
}
:global(.dark) .cc-btn-primary {
  background: #6366f1;
  border-color: #6366f1;
}
:global(.dark) .cc-btn-primary:hover {
  background: #818cf8;
}
:global(.dark) .cc-btn.is-danger {
  color: #f87171;
  border-color: rgba(220, 38, 38, 0.4);
}
:global(.dark) .cc-btn.is-danger:hover {
  background: rgba(220, 38, 38, 0.15);
}

/* 卡片内小按钮（适配器行） */
.cc-mini {
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 500;
  color: #4f46e5;
  background: #fff;
  border: 1px solid #e0e7ff;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.cc-mini:hover {
  background: #eef2ff;
  border-color: #a5b4fc;
}
.cc-mini.is-primary {
  color: #fff;
  background: #6366f1;
  border-color: #6366f1;
}
.cc-mini.is-primary:hover {
  background: #4f46e5;
}
.cc-mini:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
:global(.dark) .cc-mini {
  background: #2d2d2d;
  border-color: #3d3d3d;
  color: #a5b4fc;
}
:global(.dark) .cc-mini:hover {
  background: #3d3d3d;
}
:global(.dark) .cc-mini.is-primary {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}

/* -------- 响应式 -------- */
@media (max-width: 900px) {
  .cc-tenant {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
