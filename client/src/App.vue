<template>
  <div class="app-shell" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar
      :open="sidebarOpen"
      :collapsed="sidebarCollapsed"
      @close="closeSidebar"
      @toggle-collapse="toggleSidebarCollapsed"
    />

    <!-- Mobile drawer backdrop; hidden at >=768px by the shell media query -->
    <div
      v-if="sidebarOpen"
      class="sidebar-backdrop"
      aria-hidden="true"
      @click="closeSidebar"
    ></div>

    <div class="app-main-column">
      <AppTopbar
        :sidebar-open="sidebarOpen"
        @toggle-sidebar="toggleSidebar"
        @show-profile-details="showProfileDetails = true"
        @show-tasks="showTasks = true"
      />
      <FilterBar />
      <main class="main-content">
        <router-view />
      </main>
    </div>

    <ProfileDetailsModal
      :is-open="showProfileDetails"
      @close="showProfileDetails = false"
    />

    <TasksModal
      :is-open="showTasks"
      :tasks="tasks"
      @close="showTasks = false"
      @add-task="addTask"
      @delete-task="deleteTask"
      @toggle-task="toggleTask"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import { api } from "./api";
import { useAuth } from "./composables/useAuth";
import { useI18n } from "./composables/useI18n";
import AppSidebar from "./components/AppSidebar.vue";
import AppTopbar from "./components/AppTopbar.vue";
import FilterBar from "./components/FilterBar.vue";
import ProfileDetailsModal from "./components/ProfileDetailsModal.vue";
import TasksModal from "./components/TasksModal.vue";

export default {
  name: "App",
  components: {
    AppSidebar,
    AppTopbar,
    FilterBar,
    ProfileDetailsModal,
    TasksModal,
  },
  setup() {
    const { currentUser } = useAuth();
    const { t } = useI18n();
    const showProfileDetails = ref(false);
    const showTasks = ref(false);
    const apiTasks = ref([]);

    // Merge mock tasks from currentUser with API tasks
    const tasks = computed(() => {
      return [...currentUser.value.tasks, ...apiTasks.value];
    });

    const loadTasks = async () => {
      try {
        apiTasks.value = await api.getTasks();
      } catch (err) {
        console.error("Failed to load tasks:", err);
      }
    };

    const addTask = async (taskData) => {
      try {
        const newTask = await api.createTask(taskData);
        // Add new task to the beginning of the array
        apiTasks.value.unshift(newTask);
      } catch (err) {
        console.error("Failed to add task:", err);
      }
    };

    const deleteTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const isMockTask = currentUser.value.tasks.some((t) => t.id === taskId);

        if (isMockTask) {
          // Remove from mock tasks
          const index = currentUser.value.tasks.findIndex(
            (t) => t.id === taskId,
          );
          if (index !== -1) {
            currentUser.value.tasks.splice(index, 1);
          }
        } else {
          // Remove from API tasks
          await api.deleteTask(taskId);
          apiTasks.value = apiTasks.value.filter((t) => t.id !== taskId);
        }
      } catch (err) {
        console.error("Failed to delete task:", err);
      }
    };

    const toggleTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const mockTask = currentUser.value.tasks.find((t) => t.id === taskId);

        if (mockTask) {
          // Toggle mock task status
          mockTask.status =
            mockTask.status === "pending" ? "completed" : "pending";
        } else {
          // Toggle API task
          const updatedTask = await api.toggleTask(taskId);
          const index = apiTasks.value.findIndex((t) => t.id === taskId);
          if (index !== -1) {
            apiTasks.value[index] = updatedTask;
          }
        }
      } catch (err) {
        console.error("Failed to toggle task:", err);
      }
    };

    onMounted(loadTasks);

    // Mobile drawer state. Only has a visible effect below 768px; at wider
    // widths the sidebar is always shown and the hamburger is hidden.
    const route = useRoute();
    const sidebarOpen = ref(false);

    const toggleSidebar = () => {
      sidebarOpen.value = !sidebarOpen.value;
    };

    const closeSidebar = () => {
      sidebarOpen.value = false;
    };

    // Close after navigation so the drawer doesn't cover the page just opened
    watch(() => route.fullPath, closeSidebar);

    // On open, move focus into the drawer so keyboard users land on the nav.
    // nextTick waits for .is-open to apply; the open rule drops the visibility
    // delay, so the link is focusable right away. Queried by id because the
    // links live inside AppSidebar and there is no ref across the component.
    watch(sidebarOpen, async (open) => {
      if (!open) return;
      await nextTick();
      const firstLink = document.querySelector("#app-sidebar .nav-item");
      if (firstLink) firstLink.focus();
    });

    const handleKeydown = (event) => {
      if (event.key === "Escape" && sidebarOpen.value) {
        closeSidebar();
        // Escape dismisses without navigating, so return focus to the control
        // that opened the drawer instead of leaving it on a now-hidden link
        const toggle = document.querySelector(".menu-toggle");
        if (toggle) toggle.focus();
      }
    };

    onMounted(() => window.addEventListener("keydown", handleKeydown));
    onUnmounted(() => window.removeEventListener("keydown", handleKeydown));

    // Rail (icons-only) vs expanded sidebar, for >=768px. Below 768px the drawer
    // always shows full labels and this value is ignored by the CSS.
    // Defaults: rail under 1280px, expanded at 1280px and up. Only a choice
    // made at >=1280px is persisted; at narrower widths the rail is the
    // default every time, so a toggle there lasts until the next reload or
    // until the 1280px boundary is crossed.
    const WIDE_QUERY = "(min-width: 1280px)";
    const COLLAPSED_STORAGE_KEY = "sidebarCollapsed";

    // localStorage can throw (privacy mode, disabled storage, quota), so every
    // access is guarded and failures fall back to the width-based default
    const readStoredCollapsed = () => {
      try {
        const value = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
        return value === null ? null : value === "true";
      } catch {
        return null;
      }
    };

    const writeStoredCollapsed = (value) => {
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(value));
      } catch {
        // Persistence is optional; the in-memory state still works
      }
    };

    // matchMedia is evaluated synchronously in setup (not onMounted) so the
    // first render already has the right width and the rail doesn't animate in
    const wideMedia = window.matchMedia(WIDE_QUERY);
    const defaultCollapsed = (isWide) => {
      if (!isWide) return true;
      const stored = readStoredCollapsed();
      return stored === null ? false : stored;
    };

    const sidebarCollapsed = ref(defaultCollapsed(wideMedia.matches));

    const toggleSidebarCollapsed = () => {
      sidebarCollapsed.value = !sidebarCollapsed.value;
      if (wideMedia.matches) writeStoredCollapsed(sidebarCollapsed.value);
    };

    // Crossing 1280px in either direction resets to that side's default
    // (the stored choice when going wide, the rail when going narrow)
    const handleWideChange = (event) => {
      sidebarCollapsed.value = defaultCollapsed(event.matches);
    };

    onMounted(() => wideMedia.addEventListener("change", handleWideChange));
    onUnmounted(() =>
      wideMedia.removeEventListener("change", handleWideChange),
    );

    return {
      showProfileDetails,
      showTasks,
      tasks,
      addTask,
      deleteTask,
      toggleTask,
      sidebarOpen,
      toggleSidebar,
      closeSidebar,
      sidebarCollapsed,
      toggleSidebarCollapsed,
    };
  },
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ---------- App shell ---------- */

.app-shell {
  display: grid;
  /* minmax(0, 1fr) stops wide tables/charts from pushing the content column wider than the viewport */
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
  /* The sidebar fills its grid track, so animating the track animates the
     sidebar width and reflows the content column with it */
  transition: grid-template-columns var(--transition-fast);
}

/* Icons-only rail. The drawer query below resets the columns under 768px,
   so this class has no layout effect there. */
.app-shell.is-sidebar-collapsed {
  grid-template-columns: var(--sidebar-collapsed-width) minmax(0, 1fr);
}

/* Sidebar positioning lives here (not in AppSidebar's scoped styles) so the
   drawer media query below can override it without a specificity fight */
.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  /* Hides the labels' overflow while the width animates instead of flashing a
     horizontal scrollbar. The rail tooltip is position: fixed, so it isn't clipped. */
  overflow-x: hidden;
  z-index: var(--z-sidebar);
}

.app-main-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-content {
  flex: 1;
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-6) var(--space-7);
}

/* Below 768px the sidebar becomes an off-canvas drawer. From 768px the 72px
   rail leaves a usable content column; the drawer always shows full labels.
   .is-sidebar-collapsed is listed so its column rule doesn't out-specify this one. */
@media (max-width: 767px) {
  .app-shell,
  .app-shell.is-sidebar-collapsed {
    grid-template-columns: minmax(0, 1fr);
  }

  /* visibility: hidden takes the closed drawer's links out of the tab order and
     the accessibility tree; a transform alone only moves them offscreen. The
     visibility change is delayed by the slide duration on close so the drawer
     stays visible while it animates out. */
  .app-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: var(--sidebar-width);
    transform: translateX(-100%);
    visibility: hidden;
    transition:
      transform var(--transition-fast),
      visibility 0s linear 150ms;
  }

  /* No delay on open so the drawer is focusable as soon as it starts sliding in */
  .app-sidebar.is-open {
    transform: translateX(0);
    visibility: visible;
    transition-delay: 0s;
    box-shadow: var(--shadow-lg);
  }

  /* One layer below the drawer so it dims the page (topbar included) but not the drawer.
     rgba of --color-text (#0f172a) at 40%; tokens have no overlay color. */
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    z-index: calc(var(--z-sidebar) - 1);
  }

  .main-content {
    padding: var(--space-4);
  }
}

@media (min-width: 768px) {
  .sidebar-backdrop {
    display: none;
  }
}

/* After the drawer query so it also wins over the drawer's slide transition.
   Visibility then flips immediately on close, which is fine without a slide. */
@media (prefers-reduced-motion: reduce) {
  .app-shell,
  .app-sidebar {
    transition: none;
  }
}

/* ---------- Page header ---------- */

/* The page title lives in the topbar, so views' .page-header holds only a short
   description. Flex row so optional header actions can sit to the right of it. */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.page-header p {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* ---------- Stats ---------- */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

/* Same look as .card; status variants only recolor the left accent and value */
.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
}

.stat-label {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}

.stat-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.025em;
}

.stat-card.success {
  border-left-color: var(--color-success);
}
.stat-card.success .stat-value {
  color: var(--color-success);
}

.stat-card.info {
  border-left-color: var(--color-info);
}
.stat-card.info .stat-value {
  color: var(--color-info);
}

.stat-card.warning {
  border-left-color: var(--color-warning);
}
.stat-card.warning .stat-value {
  color: var(--color-warning);
}

.stat-card.danger {
  border-left-color: var(--color-danger);
}
.stat-card.danger .stat-value {
  color: var(--color-danger);
}

/* ---------- Cards ---------- */

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.card-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
}

/* ---------- Tables ---------- */

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--color-surface-muted);
}

th {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

td {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

tbody tr {
  transition: background-color var(--transition-fast);
}

tbody tr:hover {
  background: var(--color-surface-muted);
}

/* ---------- Badges ---------- */

.badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

/* Trend and priority badges map onto the four status pairs */
.badge.success,
.badge.increasing {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.badge.info,
.badge.low {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.badge.warning,
.badge.medium {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.badge.danger,
.badge.decreasing,
.badge.high {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* Stable is neutral, not a status */
.badge.stable {
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

/* ---------- Buttons ---------- */

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.btn-primary {
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  color: var(--color-surface);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-surface-muted);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary:focus-visible,
.btn-secondary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* ---------- Modals ---------- */

/* Shared chrome for every *Modal.vue. Modals teleport to <body>, so the overlay
   sits outside the grid shell and --z-modal puts it above the sidebar drawer
   and topbar dropdowns. Each modal only sets its own max-width. */
.modal-overlay {
  position: fixed;
  inset: 0;
  /* rgba of --color-text (#0f172a); tokens have no overlay color */
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}

.modal-container {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
}

.close-button {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.close-button:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.close-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.modal-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

/* Label/value pairs used inside detail modals */
.info-grid {
  display: grid;
  /* min(200px, 100%) keeps a single column from overflowing narrow modals */
  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
  gap: var(--space-6);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-label {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.info-value {
  font-size: var(--text-base);
  color: var(--color-text);
  font-weight: 500;
}

/* Modal summary tiles (Backlog/Inventory/Cost detail): the .stat-card look in a
   compact size. Status variants only tint the background and accent, like .stat-card.* */
.summary-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.summary-label {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.summary-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
}

.summary-subtitle {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.summary-card.primary,
.summary-card.info {
  background: var(--color-primary-soft);
  border-left-color: var(--color-primary);
}

.summary-card.success,
.summary-card.success-card {
  background: var(--color-success-soft);
  border-left-color: var(--color-success);
}

.summary-card.warning,
.summary-card.warning-card {
  background: var(--color-warning-soft);
  border-left-color: var(--color-warning);
}

.summary-card.warning .summary-value,
.summary-card.warning-card .summary-value {
  color: var(--color-warning);
}

.summary-card.danger,
.summary-card.danger-card {
  background: var(--color-danger-soft);
  border-left-color: var(--color-danger);
}

.summary-card.danger .summary-value,
.summary-card.danger-card .summary-value {
  color: var(--color-danger);
}

/* <Transition name="modal"> */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}

/* ---------- States ---------- */

.loading {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.error {
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-soft);
  color: var(--color-danger);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  margin: var(--space-4) 0;
  font-size: var(--text-sm);
}
</style>
