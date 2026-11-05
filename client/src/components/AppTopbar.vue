<template>
  <header class="app-topbar">
    <div class="topbar-left">
      <button
        type="button"
        class="menu-toggle"
        :aria-label="t('nav.menu')"
        :aria-expanded="sidebarOpen ? 'true' : 'false'"
        aria-controls="app-sidebar"
        @click="$emit('toggle-sidebar')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      </button>
      <h1 class="topbar-title">{{ pageTitle }}</h1>
    </div>

    <div class="topbar-actions">
      <LanguageSwitcher />
      <ProfileMenu
        @show-profile-details="$emit('show-profile-details')"
        @show-tasks="$emit('show-tasks')"
      />
    </div>
  </header>
</template>

<script>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '../composables/useI18n'
import { findNavItem } from '../navigation'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ProfileMenu from './ProfileMenu.vue'

export default {
  name: 'AppTopbar',
  components: {
    LanguageSwitcher,
    ProfileMenu
  },
  props: {
    sidebarOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['toggle-sidebar', 'show-profile-details', 'show-tasks'],
  setup() {
    const route = useRoute()
    const { t } = useI18n()

    // Title comes from the same nav config as the sidebar, so labels never drift
    const pageTitle = computed(() => {
      const item = findNavItem(route.path)
      return item ? t(item.labelKey) : t('nav.companyName')
    })

    return {
      t,
      pageTitle
    }
  }
}
</script>

<style scoped>
.app-topbar {
  /* Sticky at top: 0; FilterBar sticks directly below at top: var(--topbar-height) */
  position: sticky;
  top: 0;
  z-index: var(--z-topbar);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  height: var(--topbar-height);
  padding: 0 var(--space-7);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.menu-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  padding: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.menu-toggle:hover {
  background: var(--color-surface-muted);
  border-color: var(--color-border-strong);
}

.menu-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.topbar-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

/* Hamburger only exists below the 768px drawer breakpoint. At >=768px the
   sidebar's own collapse toggle takes over. Hidden here rather than in App.vue
   because the scoped display:flex above would out-specify a global rule. */
@media (min-width: 768px) {
  .menu-toggle {
    display: none;
  }
}

/* Match .main-content's drawer-width padding */
@media (max-width: 767px) {
  .app-topbar {
    padding: 0 var(--space-4);
  }
}

/* At phone width hide the widget text labels so both widgets fit beside the title */
@media (max-width: 480px) {
  .topbar-actions :deep(.language-label),
  .topbar-actions :deep(.profile-name) {
    display: none;
  }
}
</style>
