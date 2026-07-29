<script setup lang="ts">
/**
 * KnowledgeApp — the single-drop-in knowledge base UI.
 *
 * Give it an `api-base` (default `/api`) and it wires everything for you:
 *   • card grid + create wizard drawer + detail drawer + chunks browser
 *   • the "先注册 Embedding 模型" empty-state nudge
 *   • toasts via ant-design-vue's `message` (or your own via slots/events)
 *   • dataset URL copy via navigator.clipboard
 *
 * Zero adapter wiring on the host side:
 *
 *   <KnowledgeApp />                     // uses /api
 *   <KnowledgeApp api-base="/my-api" />  // custom prefix
 *
 * Hosts wanting to override any single behaviour can:
 *   • pass an explicit `api` prop (skips the built-in factory), or
 *   • listen to `@go-to-embedding-setup` to intercept the router push.
 */
import { computed } from 'vue';

import { message } from 'ant-design-vue';

import { createSpringAgentStartAdapter } from '../adapters/springAgentStart';
import type { KnowledgeHubApi } from '../types';
import KnowledgeHubApp from './KnowledgeHubApp.vue';

interface Props {
  apiBase?: string;
  api?: KnowledgeHubApi;
  showEmbeddingSetupHint?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  apiBase: '/api',
  api: undefined,
  showEmbeddingSetupHint: true,
});

const emit = defineEmits<{
  (e: 'go-to-embedding-setup'): void;
}>();

const resolvedApi = computed<KnowledgeHubApi>(() => {
  if (props.api) return props.api;
  return createSpringAgentStartAdapter({
    baseUrl: props.apiBase,
    onSuccess: (msg: string) => message.success(msg),
    onError: (msg: string) => message.error(msg),
    onCopyApi: (id: string) => {
      const url = `${window.location.origin}${props.apiBase.replace(/\/+$/, '')}/datasets/${id}`;
      navigator.clipboard.writeText(url).then(
        () => message.success('已复制 API 地址'),
        () => message.error('复制失败'),
      );
    },
    onGoToEmbeddingSetup: props.showEmbeddingSetupHint
      ? () => emit('go-to-embedding-setup')
      : undefined,
  });
});
</script>

<template>
  <KnowledgeHubApp :api="resolvedApi" />
</template>
