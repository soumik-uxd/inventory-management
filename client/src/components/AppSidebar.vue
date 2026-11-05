<template>
  <aside
    id="app-sidebar"
    class="app-sidebar"
    :class="{ 'is-open': open, 'is-collapsed': collapsed }"
    @scroll="hideTooltip"
  >
    <div class="sidebar-brand">
      <div class="brand-mark" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
          <path d="M3 8l9 5 9-5" />
          <path d="M12 13v8" />
        </svg>
      </div>
      <div class="brand-text">
        <span class="brand-name">{{ t('nav.companyName') }}</span>
        <span class="brand-subtitle">{{ t('nav.subtitle') }}</span>
      </div>
    </div>

    <nav class="sidebar-nav" :aria-label="t('nav.mainNav')">
      <ul class="nav-list">
        <li v-for="item in navItems" :key="item.path">
          <!-- router-link adds router-link-active / router-link-exact-active and
               aria-current="page" itself. is-exact is a defensive guard so '/'
               can only ever highlight on an exact match.
               The explicit close is needed because clicking the current route's
               link doesn't change route.fullPath, so App.vue's watcher never fires. -->
          <!-- Hover/focus handlers drive the rail-mode tooltip; showTooltip is a
               no-op when the sidebar is expanded or in drawer mode. -->
          <router-link
            :to="item.path"
            class="nav-item"
            :class="{ 'is-exact': item.exact }"
            @click="$emit('close')"
            @mouseenter="showTooltip($event, t(item.labelKey))"
            @mouseleave="hideTooltip"
            @focus="showTooltip($event, t(item.labelKey), true)"
            @blur="hideTooltip"
            @keydown.esc="hideTooltip"
          >
            <svg
              class="nav-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path v-for="d in item.icon" :key="d" :d="d" />
            </svg>
            <span class="nav-label">{{ t(item.labelKey) }}</span>
          </router-link>
        </li>
      </ul>
    </nav>

    <div class="sidebar-footer">
      <span class="sidebar-version">v1.0.0</span>
      <button
        type="button"
        class="collapse-toggle"
        :aria-label="toggleLabel"
        :aria-expanded="collapsed ? 'false' : 'true'"
        aria-controls="app-sidebar"
        @click="$emit('toggle-collapse')"
        @mouseenter="showTooltip($event, toggleLabel)"
        @mouseleave="hideTooltip"
        @focus="showTooltip($event, toggleLabel, true)"
        @blur="hideTooltip"
        @keydown.esc="hideTooltip"
      >
        <svg
          class="collapse-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
    </div>

    <!-- Rail-mode tooltip. position: fixed takes it out of the sidebar's
         overflow clipping (the sidebar has no transform at >=768px, so the
         viewport is its containing block). aria-hidden because the link's
         visually hidden label already provides the accessible name. -->
    <div
      v-if="tooltip"
      class="nav-tooltip"
      :style="{ top: tooltip.top + 'px', left: tooltip.left + 'px' }"
      aria-hidden="true"
    >
      {{ tooltip.label }}
    </div>
  </aside>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { useI18n } from '../composables/useI18n'
import { navItems } from '../navigation'

// Must match the rail media queries below and the drawer breakpoint in App.vue
const RAIL_QUERY = '(min-width: 768px)'

export default {
  name: 'AppSidebar',
  props: {
    open: {
      type: Boolean,
      default: false
    },
    // Icons-only rail. Only takes effect at >=768px; the drawer ignores it.
    collapsed: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'toggle-collapse'],
  setup(props) {
    const { t } = useI18n()

    const toggleLabel = computed(() =>
      props.collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')
    )

    const tooltip = ref(null)

    // Positions the fixed tooltip just right of the hovered/focused control,
    // vertically centered on it. Only shown in rail mode, where labels are hidden.
    const showTooltip = (event, label, fromFocus = false) => {
      if (!props.collapsed || !window.matchMedia(RAIL_QUERY).matches) return
      const el = event.currentTarget
      // Mouse clicks also focus the link; only show on keyboard focus so the
      // tooltip doesn't linger after the pointer leaves
      if (fromFocus && !el.matches(':focus-visible')) return
      const rect = el.getBoundingClientRect()
      tooltip.value = {
        label,
        top: rect.top + rect.height / 2,
        left: rect.right + 12
      }
    }

    const hideTooltip = () => {
      tooltip.value = null
    }

    // Expanding shows the real labels, so drop any tooltip left from the rail
    watch(() => props.collapsed, hideTooltip)

    return {
      t,
      navItems,
      toggleLabel,
      tooltip,
      showTooltip,
      hideTooltip
    }
  }
}
</script>

<style scoped>
/* Positioning (sticky column at >=768px, fixed drawer below 768px) lives in the
   global shell styles in App.vue so the drawer media query is not out-specified
   by this scoped rule. Only the sidebar's own look lives here. */
.app-sidebar {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

/* Same height as the topbar so the brand block and topbar bottom borders line up */
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: var(--topbar-height);
  flex-shrink: 0;
  padding: 0 var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-surface);
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-name,
.brand-subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.brand-subtitle {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.sidebar-nav {
  padding: var(--space-4) var(--space-3);
}

.nav-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.nav-item:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

/* Defensive guard: exact items ('/') only ever highlight on
   router-link-exact-active. Others also accept router-link-active, which
   Router 4 sets for matched parent route records (not path prefixes). */
.nav-item:not(.is-exact).router-link-active,
.nav-item.router-link-exact-active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}

.nav-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.nav-icon {
  flex-shrink: 0;
}

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* margin-top: auto pins the footer to the bottom of the flex column */
.sidebar-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: auto;
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-5);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.collapse-toggle:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.collapse-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* The chevron points left (collapse) when expanded and flips right (expand) in the rail */
.collapse-icon {
  transition: transform var(--transition-fast);
}

.is-collapsed .collapse-icon {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .collapse-icon,
  .nav-item {
    transition: none;
  }
}

/* Drawer mode always shows full labels, so there is nothing to collapse */
@media (max-width: 767px) {
  .collapse-toggle {
    display: none;
  }
}

.nav-tooltip {
  position: fixed;
  transform: translateY(-50%);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-text);
  color: var(--color-surface);
  font-size: var(--text-xs);
  font-weight: 500;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
  pointer-events: none;
}

/* Small arrow pointing back at the control */
.nav-tooltip::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 100%;
  transform: translateY(-50%);
  border: 4px solid transparent;
  border-right-color: var(--color-text);
}

/* ---------- Rail mode (icons only), >=768px ---------- */
@media (min-width: 768px) {
  .is-collapsed .sidebar-brand {
    justify-content: center;
    padding: 0;
  }

  .is-collapsed .nav-item {
    justify-content: center;
    padding: var(--space-2);
  }

  .is-collapsed .sidebar-footer {
    justify-content: center;
    padding: var(--space-3) 0;
  }

  .is-collapsed .sidebar-version {
    display: none;
  }

  /* Visually hidden but still read as the accessible name (not display: none),
     so links and the brand keep their text for screen readers */
  .is-collapsed .brand-text,
  .is-collapsed .nav-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}
</style>
