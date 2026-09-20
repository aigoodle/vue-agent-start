<script setup lang="ts">
import { createAgentStartClient, type AgentStartClient } from '../../client';
import { useAgentStartClient } from '../../client/vue';
import {
  mergeAgentStartHeaders,
  type AgentStartHeaders,
  useAgentStartConfig,
} from '../../config';
import ChannelConnectionPanel from './ChannelConnectionPanel.vue';

const props = defineProps<{
  apiBase?: string;
  headers?: AgentStartHeaders;
  tenantId?: string;
  client?: AgentStartClient;
}>();

const global = useAgentStartConfig();
const injected = useAgentStartClient();
const client = props.client ?? injected ?? createAgentStartClient({
  baseUrl: props.apiBase ?? global.apiBase ?? '/api',
  getTenant: () => props.tenantId,
  headers: () => mergeAgentStartHeaders(global.headers, props.headers),
});
</script>

<template>
  <div class="channel-hub-app">
    <header class="channel-hub-header">
      <div class="channel-hub-icon">💬</div>
      <div>
        <h2>渠道账户</h2>
        <p>配置 QQBot、微信、飞书等消息网关账号，并查看连接运行状态。</p>
      </div>
    </header>
    <ChannelConnectionPanel :client="client" :tenant-id="tenantId" />
  </div>
</template>

<style scoped>
.channel-hub-app { display: flex; flex-direction: column; gap: 20px; box-sizing: border-box; padding: 20px 24px; color: #111827; }
.channel-hub-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 2px rgba(15, 23, 42, .04); }
.channel-hub-icon { display: grid; place-items: center; width: 44px; height: 44px; flex: 0 0 auto; border-radius: 12px; color: #fff; background: linear-gradient(135deg, #10b981, #059669); font-size: 22px; }
.channel-hub-header h2 { margin: 0; font-size: 20px; }
.channel-hub-header p { margin: 3px 0 0; color: #6b7280; font-size: 13px; }
:global(.dark) .channel-hub-app { color: #f3f4f6; }
:global(.dark) .channel-hub-header { background: #1f1f1f; border-color: #2d2d2d; }
:global(.dark) .channel-hub-header p { color: #9ca3af; }
@media (max-width: 640px) { .channel-hub-app { padding: 12px 16px; } }
</style>
