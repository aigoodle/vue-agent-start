<script setup lang="ts">
/**
 * DatasetCardGrid — Dify-parity knowledge-base list card grid.
 *
 * Emits `create` and `open(dataset)` — the host renders whichever surface it
 * wants for those (KnowledgeHubApp uses the wizard + drawer). Header slot
 * carries the search + filter row so hosts can extend if needed.
 *
 * Delete lives inside a "⋯" popup menu in the card footer (not a top-right X)
 * — destructive actions should require intent, not a mis-hover.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useKhI18n } from '../i18n';
import type { DatasetCardItem } from '../types';

interface Props {
  datasets: DatasetCardItem[];
  /** Keyword filter (v-model'd from the parent search input). */
  keyword?: string;
  /** Show the leading "+新建" placeholder card. */
  showCreateCard?: boolean;
  disabledReason?: string;
}

const props = withDefaults(defineProps<Props>(), {
  keyword: '',
  showCreateCard: true,
});

const emit = defineEmits<{
  (e: 'create'): void;
  (e: 'open', dataset: DatasetCardItem): void;
  (e: 'settings', dataset: DatasetCardItem): void;
  (e: 'delete', dataset: DatasetCardItem): void;
}>();

const { t } = useKhI18n();

const ICONS = ['📙', '📗', '📘', '📕', '📓', '📔', '📒', '🗂', '📚', '🧭'];
const BGS = [
  '#FFF4ED',
  '#EEF4FF',
  '#EFFDF4',
  '#FEF3F2',
  '#FFF8E6',
  '#FDF2FA',
  '#F0F9FF',
  '#F0FDF9',
];
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.trunc((h << 5) - h + s.charCodeAt(i));
  return Math.abs(h);
}
function iconOf(d: DatasetCardItem) {
  return ICONS[hashCode(d.id || d.name) % ICONS.length];
}
function bgOf(d: DatasetCardItem) {
  return BGS[hashCode((d.id || d.name) + '.bg') % BGS.length];
}
function fromNow(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86_400 * 30) return `${Math.floor(diff / 86_400)} 天前`;
  return new Date(iso).toLocaleDateString();
}

const filtered = computed(() => {
  const q = (props.keyword ?? '').trim().toLowerCase();
  if (!q) return props.datasets;
  return props.datasets.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q),
  );
});

// -------- popup menu state
const openMenuId = ref<string | null>(null);
function toggleMenu(id: string) {
  openMenuId.value = openMenuId.value === id ? null : id;
}
function closeMenu() {
  openMenuId.value = null;
}
function onMenuOpen(d: DatasetCardItem) {
  closeMenu();
  emit('open', d);
}
function onMenuSettings(d: DatasetCardItem) {
  closeMenu();
  emit('settings', d);
}
function onMenuDelete(d: DatasetCardItem) {
  closeMenu();
  emit('delete', d);
}

// Close on any outside click / Esc — the menu itself stops propagation.
function onDocClick() {
  if (openMenuId.value !== null) closeMenu();
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && openMenuId.value !== null) closeMenu();
}
onMounted(() => {
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div class="kh-cards">
    <!-- +新建 -->
    <div
      v-if="showCreateCard"
      class="kh-card kh-card-new"
      :class="{ 'kh-card-disabled': !!disabledReason }"
      :title="disabledReason"
      @click="!disabledReason && emit('create')"
    >
      <div class="kh-card-new-inner">
        <div class="kh-card-plus">+</div>
        <div class="kh-card-title-new">新建知识库</div>
        <div class="kh-card-sub-new">导入文档 / 上传文件 / 空知识库</div>
      </div>
    </div>

    <div
      v-for="d in filtered"
      :key="d.id"
      class="kh-card"
      :class="{ 'kh-card-active': openMenuId === d.id }"
      @click="emit('open', d)"
    >
      <div class="kh-card-head">
        <div class="kh-card-icon" :style="{ background: bgOf(d) }">
          {{ iconOf(d) }}
        </div>
        <div class="kh-card-title-wrap">
          <div class="kh-card-title" :title="d.name">{{ d.name }}</div>
          <div class="kh-card-meta">
            <span
              class="kh-card-tag"
              :data-tone="d.indexingTechnique === 'ECONOMY' ? 'default' : 'blue'"
            >
              {{ d.indexingTechnique === 'ECONOMY' ? '经济' : '高质量' }}
            </span>
            <span>· {{ fromNow(d.updatedAt) || '刚刚' }}</span>
          </div>
        </div>
      </div>
      <div class="kh-card-desc" :title="d.description || ''">
        {{ d.description || '暂无描述' }}
      </div>
      <div class="kh-card-spacer" />
      <div class="kh-card-foot">
        <span class="kh-card-foot-item" :title="`${d.documentCount ?? 0} 个文档`">
          📄 {{ d.documentCount ?? 0 }}
        </span>
        <span class="kh-card-foot-item" :title="`${d.segmentCount ?? 0} 个片段`">
          🧩 {{ d.segmentCount ?? 0 }}
        </span>
        <span class="kh-card-foot-fill" />
        <div class="kh-card-menu-wrap" @click.stop>
          <button
            type="button"
            class="kh-card-more"
            :class="{ 'is-open': openMenuId === d.id }"
            :aria-haspopup="'menu'"
            :aria-expanded="openMenuId === d.id"
            :title="t('card.more')"
            @click="toggleMenu(d.id)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="3" cy="8" r="1.4" fill="currentColor" />
              <circle cx="8" cy="8" r="1.4" fill="currentColor" />
              <circle cx="13" cy="8" r="1.4" fill="currentColor" />
            </svg>
          </button>
          <div
            v-if="openMenuId === d.id"
            class="kh-card-menu"
            role="menu"
          >
            <button
              type="button"
              class="kh-card-menu-item"
              role="menuitem"
              @click="onMenuOpen(d)"
            >
              <span class="kh-card-menu-ico">📂</span>{{ t('card.open') }}
            </button>
            <button
              type="button"
              class="kh-card-menu-item"
              role="menuitem"
              @click="onMenuSettings(d)"
            >
              <span class="kh-card-menu-ico">⚙️</span>{{ t('card.settings') }}
            </button>
            <div class="kh-card-menu-divider" />
            <button
              type="button"
              class="kh-card-menu-item kh-card-menu-item-danger"
              role="menuitem"
              @click="onMenuDelete(d)"
            >
              <span class="kh-card-menu-ico">🗑</span>{{ t('card.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kh-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--kh-space-4);
}
.kh-card {
  position: relative;
  height: 200px;
  padding: 16px 18px 12px;
  background: var(--kh-card-bg);
  border: 1px solid var(--kh-card-border);
  border-radius: var(--kh-card-radius);
  cursor: pointer;
  transition:
    box-shadow var(--kh-tx-fast),
    transform var(--kh-tx-fast),
    border-color var(--kh-tx-fast);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--kh-shadow-sm);
}
.kh-card:hover {
  box-shadow: var(--kh-card-shadow-hover);
  transform: translateY(-2px);
  border-color: var(--kh-color-border-hover);
}
.kh-card-active {
  border-color: var(--kh-color-primary-outline);
  box-shadow: var(--kh-card-shadow-hover);
}
.kh-card-new {
  border: 1.5px dashed var(--kh-color-primary-outline);
  background: var(--kh-color-primary-soft);
  box-shadow: none;
}
.kh-card-new:hover {
  border-color: var(--kh-color-primary);
  transform: translateY(-2px);
}
.kh-card-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.kh-card-new-inner {
  margin: auto 0;
  text-align: center;
  color: var(--kh-color-primary);
}
.kh-card-plus {
  font-size: 42px;
  line-height: 1;
  font-weight: 200;
}
.kh-card-title-new {
  margin-top: 6px;
  font-size: var(--kh-fs-2xl);
  font-weight: 500;
}
.kh-card-sub-new {
  margin-top: 4px;
  font-size: var(--kh-fs-md);
  color: var(--kh-color-text-muted);
}

.kh-card-head {
  display: flex;
  gap: var(--kh-space-3);
  align-items: flex-start;
}
.kh-card-icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--kh-radius-md);
  font-size: 22px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
}
.kh-card-title-wrap {
  min-width: 0;
  flex: 1;
}
.kh-card-title {
  font-size: var(--kh-fs-2xl);
  font-weight: 600;
  color: var(--kh-color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.1px;
}
.kh-card-meta {
  margin-top: 4px;
  font-size: var(--kh-fs-md);
  color: var(--kh-color-text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.kh-card-tag {
  padding: 1px 6px;
  border-radius: var(--kh-radius-xs);
  background: var(--kh-color-info-soft);
  color: var(--kh-color-info);
  font-size: var(--kh-fs-xs);
}
.kh-card-tag[data-tone='default'] {
  background: var(--kh-color-surface-hover);
  color: var(--kh-color-text-secondary);
}
.kh-card-desc {
  margin-top: 10px;
  font-size: var(--kh-fs-lg);
  color: var(--kh-color-text-tertiary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.kh-card-spacer {
  flex: 1;
}
.kh-card-foot {
  display: flex;
  align-items: center;
  gap: var(--kh-space-3);
  font-size: var(--kh-fs-md);
  color: var(--kh-color-text-tertiary);
  border-top: 1px solid var(--kh-color-divider);
  padding-top: var(--kh-space-2);
}
.kh-card-foot-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.kh-card-foot-fill {
  flex: 1;
}

/* "⋯" menu trigger — sits in the footer, right-aligned. */
.kh-card-menu-wrap {
  position: relative;
  display: inline-flex;
}
.kh-card-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--kh-radius-sm);
  background: transparent;
  color: var(--kh-color-text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition:
    background var(--kh-tx-fast),
    color var(--kh-tx-fast),
    opacity var(--kh-tx-fast);
}
.kh-card:hover .kh-card-more,
.kh-card-more.is-open {
  opacity: 1;
}
.kh-card-more:hover,
.kh-card-more.is-open {
  background: var(--kh-color-surface-hover);
  color: var(--kh-color-text-primary);
}

/* Popup menu — anchored to the ⋯ button, opens upward so it doesn't clip. */
.kh-card-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  min-width: 148px;
  padding: 4px;
  background: var(--kh-color-surface-raised);
  border: 1px solid var(--kh-color-border);
  border-radius: var(--kh-radius-md);
  box-shadow: var(--kh-shadow-lg);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 1px;
  animation: kh-menu-in 0.12s ease-out;
}
@keyframes kh-menu-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.kh-card-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: transparent;
  border: none;
  border-radius: var(--kh-radius-sm);
  font-size: var(--kh-fs-lg);
  color: var(--kh-color-text-primary);
  text-align: left;
  cursor: pointer;
  transition: background var(--kh-tx-fast), color var(--kh-tx-fast);
}
.kh-card-menu-item:hover {
  background: var(--kh-color-surface-hover);
}
.kh-card-menu-ico {
  font-size: 14px;
  line-height: 1;
  width: 16px;
  display: inline-flex;
  justify-content: center;
}
.kh-card-menu-item-danger {
  color: var(--kh-color-danger);
}
.kh-card-menu-item-danger:hover {
  background: var(--kh-color-danger-soft);
}
.kh-card-menu-divider {
  height: 1px;
  margin: 4px 2px;
  background: var(--kh-color-divider);
}
</style>
