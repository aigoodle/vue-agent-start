import {
  Comment,
  Teleport,
  Transition,
  defineComponent,
  h,
  ref,
  type App,
  type PropType,
  type VNode,
} from 'vue';

type AnyRecord = Record<string, unknown>;

function nodes(slot?: () => VNode[]) {
  return slot?.() ?? [];
}

function plainText(children: VNode[]): string {
  return children
    .flatMap((child) => {
      if (typeof child.children === 'string') return [child.children];
      if (Array.isArray(child.children)) return [plainText(child.children as VNode[])];
      return [];
    })
    .join('');
}

const Button = defineComponent({
  name: 'AsButton',
  inheritAttrs: false,
  props: {
    type: { type: String, default: 'default' },
    size: { type: String, default: 'middle' },
    danger: Boolean,
    loading: Boolean,
    disabled: Boolean,
    block: Boolean,
    htmlType: { type: String, default: 'button' },
    icon: { type: [Object, Function] as PropType<unknown>, default: undefined },
  },
  setup(props, { attrs, slots }) {
    return () => h('button', {
      ...attrs,
      type: props.htmlType,
      disabled: props.disabled || props.loading,
      class: ['as-btn', `as-btn--${props.type}`, `as-btn--${props.size}`, {
        'as-btn--danger': props.danger,
        'as-btn--loading': props.loading,
        'as-btn--block': props.block,
        'as-btn--icon-only': !plainText(nodes(slots.default)).trim(),
      }, attrs.class],
    }, [
      props.loading ? h('span', { class: 'as-spinner as-spinner--small', 'aria-hidden': 'true' }) : props.icon ? h(props.icon as never) : null,
      slots.default?.(),
    ]);
  },
});

const Input = defineComponent({
  name: 'AsInput',
  inheritAttrs: false,
  props: {
    value: { type: [String, Number], default: '' },
    allowClear: Boolean,
    disabled: Boolean,
    size: { type: String, default: 'middle' },
  },
  emits: ['update:value', 'change', 'pressEnter'],
  setup(props, { attrs, emit, slots }) {
    return () => h('span', { class: ['as-input-wrap', `as-input-wrap--${props.size}`, attrs.class] }, [
      slots.prefix?.(),
      h('input', {
        ...attrs,
        class: 'as-input',
        value: props.value,
        disabled: props.disabled,
        onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
        onChange: (event: Event) => emit('change', event),
        onKeydown: (event: KeyboardEvent) => { if (event.key === 'Enter') emit('pressEnter', event); },
      }),
      props.allowClear && props.value !== '' ? h('button', {
        class: 'as-input-clear', type: 'button', tabindex: -1,
        onClick: () => emit('update:value', ''),
      }, '×') : null,
      slots.suffix?.(),
    ]);
  },
});

const Textarea = defineComponent({
  name: 'AsTextarea', inheritAttrs: false,
  props: { value: { type: [String, Number], default: '' }, autoSize: { type: [Boolean, Object], default: false } },
  emits: ['update:value', 'change'],
  setup: (props, { attrs, emit }) => () => h('textarea', {
    ...attrs, value: props.value, class: ['as-textarea', attrs.class],
    style: [props.autoSize ? { fieldSizing: 'content' } : null, attrs.style as never],
    onInput: (event: Event) => emit('update:value', (event.target as HTMLTextAreaElement).value),
    onChange: (event: Event) => emit('change', event),
  }),
});

const InputNumber = defineComponent({
  name: 'AsInputNumber', inheritAttrs: false,
  props: { value: { type: Number, default: undefined }, min: Number, max: Number, step: { type: Number, default: 1 }, disabled: Boolean },
  emits: ['update:value', 'change'],
  setup: (props, { attrs, emit }) => () => h('input', {
    ...attrs, type: 'number', value: props.value, min: props.min, max: props.max, step: props.step,
    disabled: props.disabled, class: ['as-input as-input-number', attrs.class],
    onInput: (event: Event) => {
      const raw = (event.target as HTMLInputElement).value;
      const value = raw === '' ? undefined : Number(raw);
      emit('update:value', value); emit('change', value);
    },
  }),
});

const SelectOption = defineComponent({
  name: 'AsSelectOption', inheritAttrs: false,
  props: { value: { type: [String, Number, Boolean], required: true }, disabled: Boolean },
  setup: (props, { attrs, slots }) => () => h('option', { ...attrs, value: String(props.value), disabled: props.disabled }, slots.default?.()),
});

const Select = defineComponent({
  name: 'AsSelect', inheritAttrs: false,
  props: {
    value: { type: null as unknown as PropType<any>, default: undefined },
    options: { type: Array as PropType<Array<{ value: unknown; label: string; disabled?: boolean }>>, default: undefined },
    mode: String,
    placeholder: String,
    disabled: Boolean,
    allowClear: Boolean,
  },
  emits: ['update:value', 'change', 'select', 'dropdownVisibleChange'],
  setup(props, { attrs, emit, slots }) {
    return () => h('select', {
      ...attrs,
      class: ['as-select', attrs.class],
      value: props.value as never,
      multiple: props.mode === 'multiple' || props.mode === 'tags',
      disabled: props.disabled,
      onFocus: () => emit('dropdownVisibleChange', true),
      onBlur: () => emit('dropdownVisibleChange', false),
      onChange: (event: Event) => {
        const el = event.target as HTMLSelectElement;
        const value = el.multiple ? Array.from(el.selectedOptions).map((o) => o.value) : el.value;
        emit('update:value', value); emit('change', value); emit('select', value);
      },
    }, [
      props.placeholder && (props.value === undefined || props.value === '') ? h('option', { value: '', disabled: true }, props.placeholder) : null,
      ...(props.options?.map((option) => h('option', { value: String(option.value), disabled: option.disabled }, option.label)) ?? []),
      slots.default?.(),
    ]);
  },
});

const Switch = defineComponent({
  name: 'AsSwitch',
  props: { checked: Boolean, disabled: Boolean, size: String, checkedChildren: String, unCheckedChildren: String },
  emits: ['update:checked', 'change'],
  setup: (props, { emit }) => () => h('button', {
    type: 'button', role: 'switch', 'aria-checked': props.checked, disabled: props.disabled,
    class: ['as-switch', { 'as-switch--checked': props.checked, 'as-switch--small': props.size === 'small' }],
    onClick: () => { emit('update:checked', !props.checked); emit('change', !props.checked); },
  }, [h('span', { class: 'as-switch__handle' }), (props.checked ? props.checkedChildren : props.unCheckedChildren) ? h('span', { class: 'as-switch__label' }, props.checked ? props.checkedChildren : props.unCheckedChildren) : null]),
});

const Checkbox = defineComponent({
  name: 'AsCheckbox', inheritAttrs: false,
  props: { checked: Boolean, disabled: Boolean }, emits: ['update:checked', 'change'],
  setup: (props, { attrs, emit, slots }) => () => h('label', { class: ['as-check', attrs.class] }, [
    h('input', { ...attrs, class: 'as-check__input', type: 'checkbox', checked: props.checked, disabled: props.disabled,
      onChange: (event: Event) => { const value = (event.target as HTMLInputElement).checked; emit('update:checked', value); emit('change', event); } }),
    h('span', { class: 'as-check__box' }), h('span', slots.default?.()),
  ]),
});

const Card = defineComponent({
  name: 'AsCard', inheritAttrs: false,
  props: { title: String, bordered: { type: Boolean, default: true }, hoverable: Boolean },
  setup: (props, { attrs, slots }) => () => h('section', { ...attrs, class: ['as-card', { 'as-card--borderless': !props.bordered, 'as-card--hoverable': props.hoverable }, attrs.class] }, [
    (props.title || slots.title || slots.extra) ? h('header', { class: 'as-card__head' }, [h('div', { class: 'as-card__title' }, slots.title?.() ?? props.title), h('div', { class: 'as-card__extra' }, slots.extra?.())]) : null,
    h('div', { class: 'as-card__body' }, slots.default?.()),
    slots.actions ? h('footer', { class: 'as-card__actions' }, slots.actions()) : null,
  ]),
});

const Tag = defineComponent({
  name: 'AsTag', inheritAttrs: false, props: { color: String, closable: Boolean }, emits: ['close'],
  setup: (props, { attrs, slots, emit }) => () => h('span', { ...attrs, class: ['as-tag', props.color ? `as-tag--${props.color}` : '', attrs.class] }, [slots.default?.(), props.closable ? h('button', { type: 'button', onClick: (e: Event) => emit('close', e) }, '×') : null]),
});

const Spin = defineComponent({
  name: 'AsSpin', props: { spinning: { type: Boolean, default: true }, tip: String, size: String },
  setup: (props, { slots }) => () => h('div', { class: ['as-spin-wrap', { 'as-spin-wrap--nested': slots.default }] }, [
    slots.default?.(), props.spinning ? h('span', { class: 'as-spin' }, [h('span', { class: ['as-spinner', props.size && `as-spinner--${props.size}`] }), props.tip ? h('small', props.tip) : null]) : null,
  ]),
});

const Modal = defineComponent({
  name: 'AsModal', inheritAttrs: false,
  props: {
    open: Boolean, visible: Boolean, title: String, width: { type: [String, Number], default: 520 },
    okText: { type: String, default: '确定' }, cancelText: { type: String, default: '取消' },
    confirmLoading: Boolean, footer: { type: [String, Boolean, Object] as PropType<unknown>, default: undefined },
    maskClosable: { type: Boolean, default: true }, closable: { type: Boolean, default: true }, destroyOnClose: Boolean,
  },
  emits: ['update:open', 'update:visible', 'ok', 'cancel', 'afterClose'],
  setup(props, { attrs, emit, slots }) {
    const close = (event?: Event) => { emit('update:open', false); emit('update:visible', false); emit('cancel', event); };
    return () => h(Teleport, { to: 'body' }, h(Transition, { name: 'as-modal-fade', onAfterLeave: () => emit('afterClose') }, () => (props.open || props.visible) ? h('div', {
      class: 'as-modal-root', onKeydown: (event: KeyboardEvent) => { if (event.key === 'Escape') close(event); },
    }, [
      h('div', { class: 'as-modal__mask', onClick: (event: Event) => { if (props.maskClosable) close(event); } }),
      h('section', { ...attrs, class: ['as-modal', attrs.class], role: 'dialog', 'aria-modal': 'true', style: [{ width: typeof props.width === 'number' ? `${props.width}px` : props.width }, attrs.style as never] }, [
        h('header', { class: 'as-modal__head' }, [h('div', { class: 'as-modal__title' }, slots.title?.() ?? props.title), props.closable ? h('button', { type: 'button', class: 'as-modal__close', 'aria-label': '关闭', onClick: close }, '×') : null]),
        h('div', { class: 'as-modal__body' }, slots.default?.()),
        props.footer === null || props.footer === false ? null : h('footer', { class: 'as-modal__footer' }, slots.footer?.() ?? [h(Button, { onClick: close }, () => props.cancelText), h(Button, { type: 'primary', loading: props.confirmLoading, onClick: () => emit('ok') }, () => props.okText)]),
      ]),
    ]) : null));
  },
}) as ReturnType<typeof defineComponent> & { confirm?: (options: AnyRecord) => void; info?: (options: AnyRecord) => void };

const Form = defineComponent({ name: 'AsForm', inheritAttrs: false, props: { model: Object, layout: String }, emits: ['finish'], setup: (props, { attrs, slots, emit }) => () => h('form', { ...attrs, class: ['as-form', props.layout && `as-form--${props.layout}`, attrs.class], onSubmit: (e: Event) => { e.preventDefault(); emit('finish', props.model); } }, slots.default?.()) });
const FormItem = defineComponent({ name: 'AsFormItem', props: { label: String, required: Boolean, help: String, validateStatus: String }, setup: (props, { slots }) => () => h('label', { class: ['as-form-item', props.validateStatus && `as-form-item--${props.validateStatus}`] }, [props.label ? h('span', { class: 'as-form-item__label' }, [props.required ? h('i', '*') : null, props.label]) : null, h('span', { class: 'as-form-item__control' }, [slots.default?.(), props.help ? h('small', props.help) : null])]) });

const Alert = defineComponent({ name: 'AsAlert', props: { type: { type: String, default: 'info' }, message: String, description: String, closable: Boolean, showIcon: Boolean }, setup: (props, { slots }) => () => h('div', { class: ['as-alert', `as-alert--${props.type}`], role: 'alert' }, [props.showIcon ? h('span', { class: 'as-alert__icon' }, props.type === 'error' ? '!' : 'i') : null, h('div', [h('strong', slots.message?.() ?? props.message), props.description ? h('p', props.description) : null, slots.default?.()])]) });
const Empty = defineComponent({ name: 'AsEmpty', props: { description: { type: [String, Boolean], default: '暂无数据' } }, setup: (props, { slots }) => () => h('div', { class: 'as-empty' }, [h('div', { class: 'as-empty__image' }, slots.image?.() ?? '○'), props.description !== false ? h('p', slots.description?.() ?? props.description) : null, slots.default?.()]) });

const Row = defineComponent({ name: 'AsRow', inheritAttrs: false, props: { gutter: { type: [Number, Array], default: 0 }, justify: String, align: String, wrap: { type: Boolean, default: true } }, setup: (props, { attrs, slots }) => () => h('div', { ...attrs, class: ['as-row', attrs.class], style: [{ gap: `${Array.isArray(props.gutter) ? props.gutter[0] : props.gutter}px`, justifyContent: props.justify, alignItems: props.align, flexWrap: props.wrap ? 'wrap' : 'nowrap' }, attrs.style as never] }, slots.default?.()) });
const Col = defineComponent({ name: 'AsCol', inheritAttrs: false, props: { span: { type: Number, default: 24 }, offset: Number, push: Number, pull: Number }, setup: (props, { attrs, slots }) => () => h('div', { ...attrs, class: ['as-col', attrs.class], style: [{ flex: `0 0 ${(props.span / 24) * 100}%`, maxWidth: `${(props.span / 24) * 100}%`, marginInlineStart: props.offset ? `${(props.offset / 24) * 100}%` : undefined, position: 'relative', insetInlineStart: props.push ? `${(props.push / 24) * 100}%` : props.pull ? `-${(props.pull / 24) * 100}%` : undefined }, attrs.style as never] }, slots.default?.()) });
const Space = defineComponent({ name: 'AsSpace', inheritAttrs: false, props: { size: { type: [String, Number], default: 'small' }, direction: String, wrap: Boolean }, setup: (props, { attrs, slots }) => () => h('div', { ...attrs, class: ['as-space', attrs.class], style: [{ gap: typeof props.size === 'number' ? `${props.size}px` : ({ small: '8px', middle: '16px', large: '24px' } as AnyRecord)[props.size] as string, flexDirection: props.direction === 'vertical' ? 'column' : 'row', flexWrap: props.wrap ? 'wrap' : undefined }, attrs.style as never] }, slots.default?.()) });

const Tooltip = defineComponent({ name: 'AsTooltip', props: { title: String, placement: String }, setup: (props, { slots }) => () => h('span', { class: 'as-tooltip', 'data-tip': props.title }, slots.default?.()) });
const Popover = defineComponent({ name: 'AsPopover', props: { open: Boolean, title: String, trigger: String }, emits: ['update:open'], setup: (props, { slots, emit }) => { const local = ref(false); return () => h('span', { class: 'as-popover', onClick: () => { if (props.trigger === 'click' || !props.trigger) { local.value = !local.value; emit('update:open', local.value); } } }, [slots.default?.(), (props.open || local.value) ? h('div', { class: 'as-popover__panel', onClick: (e: Event) => e.stopPropagation() }, [props.title ? h('strong', props.title) : null, slots.content?.()]) : null]); } });
const Popconfirm = defineComponent({ name: 'AsPopconfirm', props: { title: String, okText: { type: String, default: '确定' }, cancelText: { type: String, default: '取消' } }, emits: ['confirm', 'cancel'], setup: (props, { slots, emit }) => { const open = ref(false); return () => h('span', { class: 'as-popover', onClick: () => { open.value = true; } }, [slots.default?.(), open.value ? h('div', { class: 'as-popover__panel', onClick: (e: Event) => e.stopPropagation() }, [h('p', props.title), h('div', { class: 'as-popconfirm__actions' }, [h(Button, { size: 'small', onClick: () => { open.value = false; emit('cancel'); } }, () => props.cancelText), h(Button, { size: 'small', type: 'primary', onClick: () => { open.value = false; emit('confirm'); } }, () => props.okText)])]) : null]); } });
const Menu = defineComponent({ name: 'AsMenu', inheritAttrs: false, emits: ['click'], setup: (_, { attrs, slots, emit }) => () => h('div', { ...attrs, class: ['as-menu', attrs.class], onClick: (event: Event) => { const key = (event.target as HTMLElement).closest<HTMLElement>('[data-menu-key]')?.dataset.menuKey; if (key !== undefined) emit('click', { key, domEvent: event }); } }, slots.default?.()) });
const MenuItem = defineComponent({ name: 'AsMenuItem', inheritAttrs: false, props: { key: [String, Number] }, setup: (props, { attrs, slots }) => () => h('button', { ...attrs, type: 'button', class: ['as-menu-item', attrs.class], 'data-menu-key': String(props.key ?? attrs.key ?? '') }, slots.default?.()) });
const Dropdown = defineComponent({ name: 'AsDropdown', props: { trigger: { type: [String, Array], default: 'click' } }, setup: (_, { slots }) => { const open = ref(false); return () => h('span', { class: 'as-popover', onClick: () => { open.value = !open.value; } }, [slots.default?.(), open.value ? h('div', { class: 'as-popover__panel', onClick: (e: Event) => e.stopPropagation() }, slots.overlay?.() ?? slots.dropdown?.()) : null]); } });
const Drawer = defineComponent({ name: 'AsDrawer', inheritAttrs: false, props: { open: Boolean, title: String, width: { type: [String, Number], default: 480 }, placement: { type: String, default: 'right' } }, emits: ['update:open', 'close'], setup: (props, { attrs, slots, emit }) => () => h(Teleport as any, { to: 'body' }, [props.open ? h('div', { class: 'as-drawer-root' }, [h('div', { class: 'as-modal__mask', onClick: () => { emit('update:open', false); emit('close'); } }), h('aside', { ...attrs, class: ['as-drawer', `as-drawer--${props.placement}`, attrs.class], style: { width: typeof props.width === 'number' ? `${props.width}px` : props.width } }, [h('header', { class: 'as-modal__head' }, [h('div', { class: 'as-modal__title' }, slots.title?.() ?? props.title), h('button', { class: 'as-modal__close', type: 'button', onClick: () => { emit('update:open', false); emit('close'); } }, '×')]), h('div', { class: 'as-drawer__body' }, slots.default?.()), slots.footer ? h('footer', { class: 'as-modal__footer' }, slots.footer()) : null])]) : null]) });
const Tabs = defineComponent({ name: 'AsTabs', props: { activeKey: [String, Number], items: Array }, emits: ['update:activeKey', 'change'], setup: (props, { slots, emit }) => () => h('div', { class: 'as-tabs' }, [Array.isArray(props.items) ? h('nav', { class: 'as-tabs__nav' }, (props.items as AnyRecord[]).map((item) => h('button', { type: 'button', class: { active: item.key === props.activeKey }, onClick: () => { emit('update:activeKey', item.key); emit('change', item.key); } }, String(item.label ?? item.key)))) : null, h('div', { class: 'as-tabs__content' }, slots.default?.())]) });
const TabPane = defineComponent({ name: 'AsTabPane', props: { key: [String, Number], tab: String }, setup: (_, { slots }) => () => h('div', { class: 'as-tab-pane' }, slots.default?.()) });
const Segmented = defineComponent({ name: 'AsSegmented', props: { value: [String, Number], options: { type: Array as PropType<Array<string | number | { label: string; value: unknown }>>, default: () => [] } }, emits: ['update:value', 'change'], setup: (props, { emit }) => () => h('div', { class: 'as-segmented' }, props.options.map((item) => { const option = typeof item === 'object' ? item : { label: String(item), value: item }; return h('button', { type: 'button', class: { active: option.value === props.value }, onClick: () => { emit('update:value', option.value); emit('change', option.value); } }, option.label); })) });
const Skeleton = defineComponent({ name: 'AsSkeleton', props: { active: Boolean, loading: { type: Boolean, default: true } }, setup: (props, { slots }) => () => props.loading ? h('div', { class: ['as-skeleton', { 'as-skeleton--active': props.active }] }, [h('i'), h('i'), h('i')]) : slots.default?.() });
const Slider = defineComponent({ name: 'AsSlider', inheritAttrs: false, props: { value: { type: Number, default: 0 }, min: { type: Number, default: 0 }, max: { type: Number, default: 100 }, step: { type: Number, default: 1 } }, emits: ['update:value', 'change'], setup: (props, { attrs, emit }) => () => h('input', { ...attrs, class: ['as-slider', attrs.class], type: 'range', value: props.value, min: props.min, max: props.max, step: props.step, onInput: (e: Event) => { const value = Number((e.target as HTMLInputElement).value); emit('update:value', value); emit('change', value); } }) });

const TableColumn = defineComponent({ name: 'AsTableColumn', setup: () => () => h(Comment) });
const Table = defineComponent({
  name: 'AsTable',
  props: {
    dataSource: { type: Array as PropType<object[]>, default: () => [] },
    columns: { type: Array as PropType<Array<{ title: string; dataIndex?: string; key?: string }>>, default: () => [] },
    pagination: { type: [Boolean, Object], default: false },
    rowKey: { type: [String, Function], default: 'key' },
  },
  setup: (props, { slots }) => () => h('div', { class: 'as-table-wrap' }, [
    h('table', { class: 'as-table' }, [
      h('thead', [h('tr', props.columns.map((column) => h('th', column.title)))]),
      h('tbody', props.dataSource.map((sourceRow, rowIndex) => {
        const row = sourceRow as AnyRecord;
        const key = typeof props.rowKey === 'function' ? props.rowKey(row) : (row[String(props.rowKey)] ?? rowIndex);
        return h('tr', { key: String(key) }, props.columns.map((column) => h('td',
          slots.bodyCell?.({ text: column.dataIndex ? row[column.dataIndex] : undefined, record: row, column, index: rowIndex })
            ?? (column.dataIndex ? String(row[column.dataIndex] ?? '') : ''),
        )));
      })),
    ]),
  ]),
});

const RadioGroup = defineComponent({ name: 'AsRadioGroup', props: { value: [String, Number, Boolean] }, emits: ['update:value', 'change'], setup: (props, { slots, emit }) => () => h('div', { class: 'as-radio-group', onClick: (e: Event) => { const value = (e.target as HTMLElement).closest<HTMLElement>('[data-radio-value]')?.dataset.radioValue; if (value !== undefined) { emit('update:value', value); emit('change', { target: { value } }); } } }, slots.default?.()) });
const RadioButton = defineComponent({ name: 'AsRadioButton', props: { value: [String, Number, Boolean] }, setup: (props, { slots }) => () => h('button', { type: 'button', class: 'as-radio-button', 'data-radio-value': String(props.value) }, slots.default?.()) });

const componentMap: Record<string, ReturnType<typeof defineComponent>> = {
  AButton: Button, AInput: Input, ATextarea: Textarea, AInputNumber: InputNumber,
  ASelect: Select, ASelectOption: SelectOption, ASwitch: Switch, ACheckbox: Checkbox,
  ACard: Card, ATag: Tag, ASpin: Spin, AModal: Modal, AForm: Form, AFormItem: FormItem,
  AAlert: Alert, AEmpty: Empty, ARow: Row, ACol: Col, ASpace: Space, ATooltip: Tooltip,
  APopover: Popover, APopconfirm: Popconfirm, ADropdown: Dropdown, AMenu: Menu, AMenuItem: MenuItem,
  ADrawer: Drawer, ATabs: Tabs, ATabPane: TabPane, ASegmented: Segmented, ASkeleton: Skeleton, ASlider: Slider,
  ATable: Table, ATableColumn: TableColumn, ARadioGroup: RadioGroup, ARadioButton: RadioButton,
  AInputGroup: Space,
};

export const AgentStartUi = {
  install(app: App) {
    Object.entries(componentMap).forEach(([name, component]) => app.component(name, component));
  },
};

const toastRoot = () => {
  let root = document.querySelector<HTMLElement>('.as-message-root');
  if (!root) { root = document.createElement('div'); root.className = 'as-message-root'; document.body.appendChild(root); }
  return root;
};

function toast(type: string, content: unknown, duration = 3) {
  if (typeof document === 'undefined') return;
  const item = document.createElement('div'); item.className = `as-message as-message--${type}`; item.textContent = String(content ?? '');
  toastRoot().appendChild(item); window.setTimeout(() => item.remove(), duration * 1000);
}

export const message = {
  success: (content: unknown, duration?: number) => toast('success', content, duration),
  error: (content: unknown, duration?: number) => toast('error', content, duration),
  warning: (content: unknown, duration?: number) => toast('warning', content, duration),
  info: (content: unknown, duration?: number) => toast('info', content, duration),
  loading: (content: unknown, duration?: number) => toast('loading', content, duration),
};

Object.assign(Modal, {
  confirm(options: AnyRecord) {
    if (typeof window === 'undefined') return;
    if (window.confirm(String(options.title ?? options.content ?? '确认执行此操作？'))) (options.onOk as (() => void) | undefined)?.();
    else (options.onCancel as (() => void) | undefined)?.();
  },
  info(options: AnyRecord) { if (typeof window !== 'undefined') window.alert(String(options.title ?? options.content ?? '')); },
});

export {
  Alert, Button, Card, Checkbox, Col, Empty, Form, FormItem, Input, InputNumber,
  Modal, Popover, Popconfirm, Dropdown, Menu, MenuItem, Drawer, Tabs, TabPane,
  RadioButton, RadioGroup, Row, Segmented, Select, SelectOption,
  Skeleton, Slider, Space, Spin, Switch, Table, TableColumn, Tag, Textarea, Tooltip,
};
