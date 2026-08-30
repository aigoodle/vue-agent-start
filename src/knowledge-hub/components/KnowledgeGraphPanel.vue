<script setup lang="ts">
import { computed, ref } from 'vue';

import type { KnowledgeGraph, KnowledgeGraphNode } from '../types';

interface Props {
  graph?: KnowledgeGraph | null;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  graph: undefined,
  loading: false,
});

const filterType = ref('all');
const selectedId = ref<string | null>(null);
const MAX_RENDERED_NODES = 180;
const typeLabels: Record<string, string> = {
  document: '文档', heading: '标题', segment: '片段', entity: '实体',
};
const typeColors: Record<string, string> = {
  document: '#e4572e', heading: '#f3a712', segment: '#2e86ab', entity: '#2a9d6f',
};

const allTypes = computed(() => [
  'all',
  ...Array.from(new Set(props.graph?.nodes.map((node) => node.type) ?? [])),
]);
const visibleNodes = computed(() => {
  const nodes = props.graph?.nodes ?? [];
  const filtered = filterType.value === 'all'
    ? nodes
    : nodes.filter((node) => node.type === filterType.value);
  return filtered.slice()
    .sort((left, right) => (right.weight ?? 1) - (left.weight ?? 1))
    .slice(0, MAX_RENDERED_NODES);
});
const visibleIds = computed(() => new Set(visibleNodes.value.map((node) => node.id)));
const visibleEdges = computed(() => (props.graph?.edges ?? []).filter(
  (edge) => visibleIds.value.has(edge.source) && visibleIds.value.has(edge.target),
));
const layoutNodes = computed(() => {
  const groups = new Map<string, KnowledgeGraphNode[]>();
  for (const node of visibleNodes.value) {
    const list = groups.get(node.type) ?? [];
    list.push(node);
    groups.set(node.type, list);
  }
  const radii: Record<string, number> = {
    document: 70, heading: 135, entity: 205, segment: 260,
  };
  const output: Array<{ node: KnowledgeGraphNode; x: number; y: number }> = [];
  let fallbackRing = 150;
  for (const [type, nodes] of groups) {
    const radius = radii[type] ?? fallbackRing;
    fallbackRing += 28;
    nodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, nodes.length);
      output.push({
        node,
        x: 450 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius,
      });
    });
  }
  return output;
});
const positions = computed(() => new Map(
  layoutNodes.value.map((item) => [item.node.id, item]),
));
const selectedNode = computed(() => props.graph?.nodes.find(
  (node) => node.id === selectedId.value,
) ?? null);
const selectedEdges = computed(() => selectedId.value
  ? (props.graph?.edges ?? []).filter(
      (edge) => edge.source === selectedId.value || edge.target === selectedId.value,
    )
  : []);

function colorFor(type: string) {
  return typeColors[type] ?? '#64748b';
}
function radiusFor(node: KnowledgeGraphNode) {
  return Math.min(17, 7 + Math.sqrt(Math.max(1, node.weight ?? 1)) * 1.8);
}
function labelFor(type: string) {
  return typeLabels[type] ?? type;
}
</script>

<template>
  <section class="kh-kg">
    <header class="kh-kg-head">
      <div>
        <div class="kh-kg-eyebrow">GRAPH EXPLORER</div>
        <h3 class="kh-kg-title">知识关系网络</h3>
        <p class="kh-kg-sub">结构节点、语义实体与证据片段在同一张图中可追溯呈现</p>
      </div>
      <div class="kh-kg-stats">
        <strong>{{ props.graph?.nodes.length ?? 0 }}</strong> 节点
        <span />
        <strong>{{ props.graph?.edges.length ?? 0 }}</strong> 关系
      </div>
    </header>

    <div class="kh-kg-toolbar">
      <button
        v-for="type in allTypes"
        :key="type"
        :class="['kh-kg-filter', filterType === type && 'kh-kg-filter-active']"
        @click="filterType = type"
      >
        <i v-if="type !== 'all'" :style="{ background: colorFor(type) }" />
        {{ type === 'all' ? '全部' : labelFor(type) }}
      </button>
      <span v-if="visibleNodes.length < (props.graph?.nodes.length ?? 0)" class="kh-kg-limit">
        当前绘制 {{ visibleNodes.length }} 个高权重节点
      </span>
    </div>

    <div v-if="loading" class="kh-kg-empty">正在聚合图谱关系...</div>
    <div v-else-if="!props.graph || props.graph.nodes.length === 0" class="kh-kg-empty">
      完成文档解析后，结构与语义关系会在这里出现。
    </div>
    <div v-else class="kh-kg-workspace">
      <div class="kh-kg-canvas">
        <svg viewBox="0 0 900 600" role="img" aria-label="知识图谱网络">
          <defs>
            <radialGradient id="kg-bg">
              <stop offset="0" stop-color="#fffdf7" />
              <stop offset="1" stop-color="#f3f7f4" />
            </radialGradient>
          </defs>
          <rect width="900" height="600" fill="url(#kg-bg)" @click="selectedId = null" />
          <g class="kh-kg-links">
            <line
              v-for="edge in visibleEdges"
              :key="`${edge.source}-${edge.target}-${edge.relation}`"
              :x1="positions.get(edge.source)?.x"
              :y1="positions.get(edge.source)?.y"
              :x2="positions.get(edge.target)?.x"
              :y2="positions.get(edge.target)?.y"
              :class="{ 'kh-kg-link-active': selectedId === edge.source || selectedId === edge.target }"
              :style="{ strokeWidth: Math.min(4, 0.7 + Math.sqrt(edge.weight ?? 1) * 0.55) }"
            />
          </g>
          <g
            v-for="item in layoutNodes"
            :key="item.node.id"
            class="kh-kg-dot"
            :class="{ 'kh-kg-dot-active': selectedId === item.node.id }"
            :transform="`translate(${item.x} ${item.y})`"
            @click.stop="selectedId = item.node.id"
          >
            <circle class="kh-kg-dot-halo" :r="radiusFor(item.node) + 7" />
            <circle :r="radiusFor(item.node)" :fill="colorFor(item.node.type)" />
            <text
              v-if="item.node.type !== 'segment' || selectedId === item.node.id"
              :y="radiusFor(item.node) + 15"
              text-anchor="middle"
            >{{ item.node.label.slice(0, 16) }}</text>
          </g>
        </svg>
        <div class="kh-kg-legend">
          <span v-for="type in allTypes.filter((item) => item !== 'all')" :key="type">
            <i :style="{ background: colorFor(type) }" />{{ labelFor(type) }}
          </span>
        </div>
      </div>

      <aside class="kh-kg-detail">
        <template v-if="selectedNode">
          <div class="kh-kg-detail-type" :style="{ color: colorFor(selectedNode.type) }">
            {{ labelFor(selectedNode.type) }} · 权重 {{ selectedNode.weight ?? 1 }}
          </div>
          <h4>{{ selectedNode.label }}</h4>
          <p>{{ selectedNode.description || '该节点来自文档结构或分段语义索引。' }}</p>
          <dl>
            <template v-if="selectedNode.headingPath"><dt>标题路径</dt><dd>{{ selectedNode.headingPath }}</dd></template>
            <template v-if="selectedNode.source"><dt>来源</dt><dd>{{ selectedNode.source }}</dd></template>
            <template v-if="selectedNode.documentId"><dt>文档 ID</dt><dd>{{ selectedNode.documentId }}</dd></template>
            <template v-if="selectedNode.segmentId"><dt>片段 ID</dt><dd>{{ selectedNode.segmentId }}</dd></template>
            <template v-if="selectedNode.evidenceSegmentIds?.length">
              <dt>证据片段</dt><dd>{{ selectedNode.evidenceSegmentIds.length }} 个</dd>
            </template>
          </dl>
          <div class="kh-kg-relations-title">直接关系 {{ selectedEdges.length }}</div>
          <div class="kh-kg-relations">
            <span v-for="edge in selectedEdges.slice(0, 12)" :key="`${edge.source}-${edge.target}-${edge.relation}`">
              {{ edge.relation }} · {{ edge.weight ?? 1 }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="kh-kg-detail-empty">
            <div class="kh-kg-orbit"><i /><i /><i /></div>
            <strong>选择一个节点</strong>
            <p>查看概念权重、来源片段和直接关系。线条粗细表示关系强度。</p>
          </div>
        </template>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.kh-kg { --ink: #17332a; height: 100%; min-height: 430px; display: flex; flex-direction: column; gap: 12px; padding: 18px; color: var(--ink); background: #f7f8f2; }
.kh-kg-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
.kh-kg-eyebrow { color: #e4572e; font: 700 10px/1.2 'IBM Plex Mono', monospace; letter-spacing: .18em; }
.kh-kg-title { margin: 4px 0 0; font: 700 22px/1.15 Georgia, serif; }
.kh-kg-sub { margin: 5px 0 0; color: #728078; font-size: 12px; }
.kh-kg-stats { display: flex; align-items: baseline; gap: 7px; color: #728078; font-size: 11px; white-space: nowrap; }
.kh-kg-stats strong { color: var(--ink); font: 700 20px/1 Georgia, serif; }
.kh-kg-stats span { width: 1px; height: 16px; margin: 0 4px; background: #ccd5ce; }
.kh-kg-toolbar { display: flex; align-items: center; gap: 6px; min-height: 30px; }
.kh-kg-filter { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #d9dfda; border-radius: 999px; padding: 5px 10px; color: #65736b; background: transparent; font-size: 11px; cursor: pointer; }
.kh-kg-filter i, .kh-kg-legend i { width: 7px; height: 7px; border-radius: 50%; }
.kh-kg-filter-active { border-color: var(--ink); color: var(--ink); background: #fff; }
.kh-kg-limit { margin-left: auto; color: #8b978f; font-size: 10px; }
.kh-kg-empty { flex: 1; display: grid; place-items: center; min-height: 300px; color: #77847c; border: 1px dashed #ccd5ce; }
.kh-kg-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 245px; border: 1px solid #d8ded8; background: #fff; overflow: hidden; }
.kh-kg-canvas { position: relative; min-width: 0; min-height: 360px; overflow: hidden; }
.kh-kg-canvas svg { width: 100%; height: 100%; display: block; }
.kh-kg-links line { stroke: #b8c5bd; opacity: .48; transition: opacity .15s; }
.kh-kg-links .kh-kg-link-active { stroke: #e4572e; opacity: .9; }
.kh-kg-dot { cursor: pointer; }
.kh-kg-dot circle { stroke: #fff; stroke-width: 2; transition: transform .15s; }
.kh-kg-dot:hover circle:not(.kh-kg-dot-halo), .kh-kg-dot-active circle:not(.kh-kg-dot-halo) { transform: scale(1.2); }
.kh-kg-dot-halo { fill: transparent; stroke: transparent !important; }
.kh-kg-dot-active .kh-kg-dot-halo { fill: #e4572e22; }
.kh-kg-dot text { fill: #43564d; font-size: 9px; paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
.kh-kg-legend { position: absolute; left: 12px; bottom: 10px; display: flex; gap: 12px; padding: 6px 9px; background: #ffffffd9; color: #65736b; font-size: 9px; }
.kh-kg-legend span { display: flex; align-items: center; gap: 4px; }
.kh-kg-detail { padding: 18px; border-left: 1px solid #e0e5e1; background: #fbfcf8; overflow: auto; }
.kh-kg-detail-type { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.kh-kg-detail h4 { margin: 8px 0; font: 700 18px/1.25 Georgia, serif; word-break: break-word; }
.kh-kg-detail > p { color: #66766d; font-size: 11px; line-height: 1.55; }
.kh-kg-detail dl { margin: 16px 0; }
.kh-kg-detail dt { margin-top: 9px; color: #8a968f; font-size: 9px; text-transform: uppercase; letter-spacing: .08em; }
.kh-kg-detail dd { margin: 2px 0 0; color: #35483f; font-size: 10px; word-break: break-all; }
.kh-kg-relations-title { padding-top: 12px; border-top: 1px solid #e2e7e3; font-size: 10px; font-weight: 700; }
.kh-kg-relations { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.kh-kg-relations span { padding: 3px 6px; color: #52665b; background: #eaf1ec; font-size: 9px; }
.kh-kg-detail-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #738178; }
.kh-kg-detail-empty strong { margin-top: 18px; color: var(--ink); font: 700 15px Georgia, serif; }
.kh-kg-detail-empty p { max-width: 180px; font-size: 10px; line-height: 1.5; }
.kh-kg-orbit { position: relative; width: 64px; height: 64px; border: 1px solid #b9c8be; border-radius: 50%; }
.kh-kg-orbit::after { content: ''; position: absolute; inset: 14px; border: 1px solid #d0d9d2; border-radius: 50%; }
.kh-kg-orbit i { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: #2a9d6f; }
.kh-kg-orbit i:nth-child(1) { left: 5px; top: 11px; }.kh-kg-orbit i:nth-child(2) { right: 2px; top: 30px; background: #e4572e; }.kh-kg-orbit i:nth-child(3) { left: 25px; bottom: 4px; background: #2e86ab; }
@media (max-width: 760px) { .kh-kg { padding: 12px; }.kh-kg-workspace { grid-template-columns: 1fr; overflow: auto; }.kh-kg-canvas { min-height: 420px; }.kh-kg-detail { min-height: 180px; border-left: 0; border-top: 1px solid #e0e5e1; }.kh-kg-sub, .kh-kg-limit { display: none; } }
</style>
