<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue';

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';

defineProps({
  showTitle: {
    type: Boolean,
    default: () => true,
  },
  readonly: {
    type: Boolean,
    default: () => false,
  },
  parentHierarchy: {
    type: Array,
    default: () => [],
  },
  mainData: {
    type: Object,
    default: () => {},
  },
});

const visible = ref<boolean>(false);

const formState: any = defineModel();
const editItem: any = ref({});
const model: any = ref({});
const parentModel: any = ref({});

const structData = computed(() => formState.value?.structOutput?.data ?? []);
const rootChildren = computed(() => structData.value[0]?.children ?? []);
const totalFields = computed(() => {
  let count = 0;
  const walk = (arr: any[]) => {
    arr?.forEach((n) => {
      count += 1;
      if (n.children) walk(n.children);
    });
  };
  walk(rootChildren.value);
  return count;
});

const toAddItem = (item: any) => {
  model.value = {
    description: '',
    name: '',
    type: 'string',
  };
  editItem.value = null;
  parentModel.value = item;
  visible.value = true;
};
const toEditItem = (item: any) => {
  editItem.value = item;
  model.value = { ...item };
  visible.value = true;
};
const removeItem = (item: any) => {
  const treeData = structData.value[0];
  if (treeData) deleteNodeById(treeData, item.id);
};
const submitForm = () => {
  if (
    (model.value.type === 'array' || model.value.type === 'object') &&
    !model.value.children
  ) {
    model.value.children = [];
  }
  if (editItem.value) {
    Object.assign(editItem.value, model.value);
  } else {
    if (!parentModel.value.children) parentModel.value.children = [];
    parentModel.value.children.push({ ...model.value });
  }
  visible.value = false;
};

function deleteNodeById(tree: any, targetId: string) {
  if (tree.children && tree.children.length > 0) {
    const index = tree.children.findIndex((node: any) => node.id === targetId);
    if (index === -1) {
      for (const child of tree.children) {
        const deleted = deleteNodeById(child, targetId);
        if (deleted) return true;
      }
    } else {
      tree.children.splice(index, 1);
      return true;
    }
  }
  return false;
}

const closePanel = () => {
  visible.value = false;
};

const typeLabel = (type: string) => {
  if (type === 'array') return 'array';
  return type || 'string';
};

const TreeNode: any = defineComponent({
  name: 'OutputTreeNode',
  props: {
    node: { type: Object, required: true },
    readonly: { type: Boolean, default: false },
    depth: { type: Number, default: 0 },
  },
  emits: ['edit', 'add', 'remove'],
  setup(props, { emit }) {
    return () => {
      const { node, readonly, depth } = props;
      const isBranch = node.type === 'object' || node.type === 'array';
      const typeClass = `output-type-${node.type || 'string'}`;

      const rowChildren: any[] = [
        h('span', { class: 'output-row-caret' }, isBranch ? '▾' : '·'),
        h('span', { class: 'output-row-name' }, node.name || '未命名'),
        h(
          'span',
          { class: ['output-type-pill', typeClass] },
          node.type === 'array' ? 'array' : node.type || 'string',
        ),
        node.description
          ? h('span', { class: 'output-row-desc' }, node.description)
          : null,
      ];

      if (!readonly) {
        rowChildren.push(
          h('div', { class: 'output-row-actions' }, [
            isBranch
              ? h(
                  'a',
                  {
                    class: 'output-row-action output-row-action-add',
                    title: '添加子字段',
                    onClick: (e: Event) => {
                      e.stopPropagation();
                      emit('add', node);
                    },
                  },
                  [h(PlusOutlined)],
                )
              : null,
            h(
              'a',
              {
                class: 'output-row-action output-row-action-edit',
                title: '编辑',
                onClick: (e: Event) => {
                  e.stopPropagation();
                  emit('edit', node);
                },
              },
              [h(EditOutlined)],
            ),
            h(
              'a',
              {
                class: 'output-row-action output-row-action-danger',
                title: '删除',
                onClick: (e: Event) => {
                  e.stopPropagation();
                  emit('remove', node);
                },
              },
              [h(DeleteOutlined)],
            ),
          ]),
        );
      }

      const row = h(
        'div',
        {
          class: 'output-row',
          style: { paddingLeft: `${depth * 14}px` },
          onClick: () => !readonly && emit('edit', node),
        },
        rowChildren,
      );

      const children =
        isBranch && node.children && node.children.length > 0
          ? node.children.map((c: any) =>
              h(TreeNode, {
                key: c.id || c.name,
                node: c,
                readonly,
                depth: depth + 1,
                onEdit: (n: any) => emit('edit', n),
                onAdd: (n: any) => emit('add', n),
                onRemove: (n: any) => emit('remove', n),
              }),
            )
          : [];

      return h('div', { class: 'output-tree-node' }, [row, ...children]);
    };
  },
});
</script>

<template>
  <div class="output-card">
    <div class="output-card-head" v-if="showTitle">
      <div class="output-card-head-left">
        <span class="output-card-title">输出变量</span>
        <span v-if="formState.structOutputEnabled" class="output-card-count">
          {{ totalFields }} 字段
        </span>
      </div>
      <div v-show="formState.structOutput?.data" class="output-card-toggle">
        <span class="output-card-toggle-label">结构化输出</span>
        <a-switch
          size="small"
          v-model:checked="formState.structOutputEnabled"
        />
      </div>
    </div>

    <div class="output-card-body">
      <template v-if="formState.structOutputEnabled">
        <div class="output-tree">
          <template v-for="root in structData" :key="root.id">
            <div class="output-tree-root">
              <div class="output-tree-root-title">
                <span class="output-tree-root-name">{{ root.name }}</span>
                <span class="output-type-pill output-type-object">
                  {{ typeLabel(root.type) }}
                </span>
                <span v-if="root.description" class="output-tree-root-desc">
                  {{ root.description }}
                </span>
                <a
                  v-if="!readonly"
                  class="output-tree-root-add"
                  @click="toAddItem(root)"
                >
                  <PlusOutlined />
                  <span>添加字段</span>
                </a>
              </div>

              <div
                v-if="!root.children || root.children.length === 0"
                class="output-empty"
              >
                <span>点击右侧「添加字段」定义输出结构</span>
              </div>

              <div v-else class="output-tree-children">
                <TreeNode
                  v-for="child in root.children"
                  :key="child.id || child.name"
                  :node="child"
                  :readonly="readonly"
                  :depth="1"
                  @edit="toEditItem"
                  @add="toAddItem"
                  @remove="removeItem"
                />
              </div>
            </div>
          </template>
        </div>

        <a-modal
          v-model:open="visible"
          title="结构化字段定义"
          :ok-text="editItem ? '更新' : '添加'"
          cancel-text="取消"
          @ok="submitForm"
          @cancel="closePanel"
        >
          <div class="output-modal-body">
            <a-form
              :model="model"
              name="basic"
              :label-col="{ span: 5 }"
              :wrapper-col="{ span: 17 }"
              autocomplete="off"
              layout="horizontal"
            >
              <a-form-item label="名称" name="name">
                <a-input
                  v-model:value="model.name"
                  placeholder="字段名，如 category"
                />
              </a-form-item>
              <a-form-item label="描述" name="description">
                <a-input
                  v-model:value="model.description"
                  placeholder="用于指导 LLM 输出"
                />
              </a-form-item>
              <a-form-item label="类型" name="type">
                <a-select v-model:value="model.type" style="width: 100%">
                  <a-select-option value="string">String</a-select-option>
                  <a-select-option value="number">Number</a-select-option>
                  <a-select-option value="boolean">Boolean</a-select-option>
                  <a-select-option value="object">Object</a-select-option>
                  <a-select-option value="array">Array[Object]</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="示例" name="example">
                <a-input
                  v-model:value="model.example"
                  placeholder="可选，示例值"
                />
              </a-form-item>
            </a-form>
          </div>
        </a-modal>
      </template>

      <div v-else class="output-plain">
        <div
          v-for="(item, idx) in formState.output"
          :key="`${item.name}-${idx}`"
          class="output-plain-row"
        >
          <div class="output-plain-name">{{ item.name }}</div>
          <span class="output-type-pill" :class="`output-type-${item.type}`">
            {{ typeLabel(item.type) }}
          </span>
          <div class="output-plain-label">{{ item.label }}</div>
        </div>
        <div
          v-if="!formState.output || formState.output.length === 0"
          class="output-empty"
        >
          <span>暂无输出定义</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.output-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.output-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.output-card-head-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.output-card-title {
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
}

.output-card-count {
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  color: color-mix(in srgb, var(--wf-accent, #6366f1) 90%, #000);
  background: color-mix(in srgb, var(--wf-accent, #6366f1) 12%, transparent);
  border-radius: 999px;
}

.output-card-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
}

/* -------- 结构化输出树 -------- */
.output-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.output-tree-root {
  padding: 8px 10px;
  background: #f9fafb;
  border: 1px solid #eef0f3;
  border-radius: 8px;
}

.output-tree-root-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed #e5e7eb;
  margin-bottom: 4px;
}

.output-tree-root-name {
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.output-tree-root-desc {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.output-tree-children {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 根节点右上角"添加字段"：文字按钮样式，走 vben 主题色 */
.output-tree-root-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 2px 8px;
  font-size: 11px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 4px;
  transition: background 0.12s, color 0.12s;
}

.output-tree-root-add:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 20%);
}

/* -------- 空态 -------- */
.output-empty {
  padding: 10px;
  text-align: center;
  font-size: 11px;
  color: #9ca3af;
  background: #ffffff;
  border: 1px dashed #e5e7eb;
  border-radius: 6px;
}

/* -------- 非结构化输出（简单列表） -------- */
.output-plain {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.output-plain-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  font-size: 12px;
  background: #f9fafb;
  border: 1px solid #eef0f3;
  border-radius: 6px;
}

.output-plain-name {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #1f2937;
  font-weight: 500;
}

.output-plain-label {
  margin-left: auto;
  color: #6b7280;
  font-size: 11px;
}

.output-modal-body {
  padding-top: 8px;
}
</style>

<!--
  以下样式作用于由 TreeNode（inline defineComponent + h()）渲染的元素。
  <style scoped> 编译出的属性选择器无法命中 h() 产物，因此必须写在非
  scoped 块里；类名全部为本文件专用，不存在污染其他组件的风险。
-->
<style>
.output-tree-node {
  display: flex;
  flex-direction: column;
}

.output-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px 5px 4px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, box-shadow 0.12s;
}

.output-row:hover {
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.output-row-caret {
  flex: none;
  width: 10px;
  font-size: 10px;
  color: #9ca3af;
  text-align: center;
}

.output-row-name {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #1f2937;
  font-weight: 500;
}

.output-row-desc {
  flex: 1;
  min-width: 0;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.output-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  flex: none;
  opacity: 0.85;
  transition: opacity 0.15s;
}

.output-row:hover .output-row-actions {
  opacity: 1;
}

.output-row-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  color: #6b7280;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1;
  transition: background 0.12s, color 0.12s, transform 0.12s;
}

.output-row-action .anticon {
  font-size: 13px;
}

.output-row-action:hover {
  transform: translateY(-1px);
}

/* 编辑：跟随 vben --primary 主题色（design-tokens/default.css 中 --primary: 212 100% 45%） */
.output-row-action-edit {
  color: hsl(var(--primary));
}

.output-row-action-edit:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 14%);
}

/* 新增：走当前节点主题色（--wf-accent 由 NodeConfigCard 注入） */
.output-row-action-add {
  color: var(--wf-accent, #6366f1);
}

.output-row-action-add:hover {
  background: color-mix(in srgb, var(--wf-accent, #6366f1) 14%, transparent);
}

/* 删除：红色，常态即可辨识 */
.output-row-action-danger {
  color: #ef4444;
}

.output-row-action-danger:hover {
  color: #dc2626;
  background: #fef2f2;
}

/* 类型徽章（在 h() 渲染的行内也会用到，因此和 action 一起放非 scoped） */
.output-type-pill {
  flex: none;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
  line-height: 1.5;
  letter-spacing: 0.2px;
  text-transform: lowercase;
  border: 1px solid transparent;
}

.output-type-string {
  color: #047857;
  background: #d1fae5;
  border-color: #6ee7b7;
}

.output-type-number {
  color: #b45309;
  background: #fef3c7;
  border-color: #fcd34d;
}

.output-type-boolean {
  color: #7c3aed;
  background: #ede9fe;
  border-color: #c4b5fd;
}

.output-type-object {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}

.output-type-array {
  color: #be185d;
  background: #fce7f3;
  border-color: #f9a8d4;
}

.output-type-file {
  color: #475569;
  background: #f1f5f9;
  border-color: #cbd5e1;
}
</style>
