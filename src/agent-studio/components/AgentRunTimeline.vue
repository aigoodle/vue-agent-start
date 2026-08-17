<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type {
  AgentRunClient,
  AgentRunEvent,
  AgentRunSnapshot,
} from '../agent-run';

const props = withDefaults(defineProps<{
  client: AgentRunClient;
  runId: string;
  pollIntervalMs?: number;
}>(), { pollIntervalMs: 1_000 });

const emit = defineEmits<{
  (event: 'settled', snapshot: AgentRunSnapshot): void;
  (event: 'error', error: Error): void;
}>();

const snapshot = ref<AgentRunSnapshot>();
const events = ref<AgentRunEvent[]>([]);
const loading = ref(false);
const acting = ref(false);
const error = ref('');
let controller: AbortController | undefined;

const pendingApproval = computed(() => {
  if (!snapshot.value?.responseJson) return undefined;
  try {
    return (JSON.parse(snapshot.value.responseJson) as {
      pendingApproval?: { approvalId: string; toolName: string; toolInput: string };
    }).pendingApproval;
  } catch {
    return undefined;
  }
});

function eventPayload(event: AgentRunEvent): string {
  if (!event.payloadJson) return '';
  try { return JSON.stringify(JSON.parse(event.payloadJson), null, 2); } catch { return event.payloadJson; }
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  events.value = [];
  error.value = '';
  loading.value = true;
  try {
    const initial = await props.client.get(props.runId);
    snapshot.value = initial;
    const iterator = props.client.watch(props.runId, {
      pollIntervalMs: props.pollIntervalMs,
      signal: controller.signal,
    });
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        snapshot.value = next.value;
        emit('settled', next.value);
        break;
      }
      events.value.push(...next.value.filter((candidate) =>
        !events.value.some((existing) => existing.sequence === candidate.sequence)));
    }
  } catch (cause) {
    if (controller.signal.aborted) return;
    const failure = cause instanceof Error ? cause : new Error(String(cause));
    error.value = failure.message;
    emit('error', failure);
  } finally {
    loading.value = false;
  }
}

async function cancelRun() {
  acting.value = true;
  try {
    snapshot.value = await props.client.cancel(props.runId);
    controller?.abort();
    emit('settled', snapshot.value);
  } catch (cause) {
    emit('error', cause instanceof Error ? cause : new Error(String(cause)));
  } finally { acting.value = false; }
}

async function decide(decision: 'APPROVE' | 'DENY') {
  const approval = pendingApproval.value;
  if (!approval) return;
  acting.value = true;
  try {
    await props.client.resume(props.runId, approval.approvalId, decision);
    await load();
  } catch (cause) {
    emit('error', cause instanceof Error ? cause : new Error(String(cause)));
  } finally { acting.value = false; }
}

watch(() => props.runId, load, { immediate: true });
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <section class="agent-run-timeline">
    <header>
      <div><strong>Agent Run</strong><code>{{ runId }}</code></div>
      <span class="status" :data-status="snapshot?.status">{{ snapshot?.status ?? 'LOADING' }}</span>
    </header>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="pendingApproval" class="approval">
      <div>工具 <strong>{{ pendingApproval.toolName }}</strong> 等待审批</div>
      <pre>{{ pendingApproval.toolInput }}</pre>
      <button :disabled="acting" @click="decide('APPROVE')">通过</button>
      <button :disabled="acting" @click="decide('DENY')">拒绝</button>
    </div>

    <ol>
      <li v-for="event in events" :key="event.sequence">
        <div><code>#{{ event.sequence }}</code><strong>{{ event.type }}</strong><time>{{ event.createdAt }}</time></div>
        <pre v-if="event.payloadJson">{{ eventPayload(event) }}</pre>
      </li>
    </ol>

    <footer>
      <button v-if="snapshot && ['CREATED', 'RUNNING', 'WAITING_APPROVAL'].includes(snapshot.status)"
              :disabled="acting" @click="cancelRun">取消运行</button>
      <span v-if="loading">正在同步…</span>
    </footer>
  </section>
</template>

<style scoped>
.agent-run-timeline { display:grid; gap:12px; color:#1f2937; font-size:13px }
header, header>div, li>div, footer { display:flex; align-items:center; gap:10px }
header { justify-content:space-between }
header code { margin-left:8px; color:#64748b }
.status { border-radius:999px; padding:3px 9px; background:#e2e8f0; font-weight:600 }
.status[data-status="COMPLETED"] { background:#dcfce7; color:#166534 }
.status[data-status="FAILED"], .status[data-status="TIMED_OUT"] { background:#fee2e2; color:#991b1b }
.status[data-status="WAITING_APPROVAL"] { background:#fef3c7; color:#92400e }
ol { display:grid; gap:8px; margin:0; padding:0; list-style:none }
li { border-left:2px solid #cbd5e1; padding:6px 10px }
li time { margin-left:auto; color:#94a3b8 }
pre { overflow:auto; margin:6px 0 0; padding:8px; border-radius:6px; background:#f8fafc; white-space:pre-wrap }
.approval { padding:12px; border:1px solid #f59e0b; border-radius:8px; background:#fffbeb }
button { margin-right:8px; padding:5px 10px; border:1px solid #cbd5e1; border-radius:6px; background:white; cursor:pointer }
button:disabled { cursor:not-allowed; opacity:.5 }
.error { color:#b91c1c }
</style>
