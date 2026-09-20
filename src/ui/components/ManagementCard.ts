import { defineComponent, h } from 'vue';

/**
 * Consistent catalog card for management pages (tools, channels, skills, etc.).
 * It owns the visual skeleton while feature modules provide domain content.
 */
export const ManagementCard = defineComponent({
  name: 'AsManagementCard',
  inheritAttrs: false,
  props: {
    title: String,
    subtitle: String,
    description: String,
    compact: Boolean,
    interactive: { type: Boolean, default: true },
  },
  setup(props, { attrs, slots }) {
    return () => h('article', {
      ...attrs,
      class: [
        'as-management-card',
        {
          'as-management-card--compact': props.compact,
          'as-management-card--interactive': props.interactive,
        },
        attrs.class,
      ],
      tabindex: props.interactive ? 0 : undefined,
    }, [
      h('header', { class: 'as-management-card__head' }, [
        slots.icon ? h('div', { class: 'as-management-card__icon' }, slots.icon()) : null,
        h('div', { class: 'as-management-card__title' }, [
          h('h3', slots.title?.() ?? props.title),
          (slots.subtitle || props.subtitle)
            ? h('small', slots.subtitle?.() ?? props.subtitle)
            : null,
        ]),
        slots.badge ? h('div', { class: 'as-management-card__badge' }, slots.badge()) : null,
      ]),
      (slots.description || props.description)
        ? h('div', { class: 'as-management-card__description' }, slots.description?.() ?? props.description)
        : null,
      slots.default ? h('div', { class: 'as-management-card__content' }, slots.default()) : null,
      (slots.meta || slots.actions)
        ? h('footer', { class: 'as-management-card__footer' }, [
          h('div', { class: 'as-management-card__meta' }, slots.meta?.()),
          h('div', { class: 'as-management-card__actions' }, slots.actions?.()),
        ])
        : null,
    ]);
  },
});
