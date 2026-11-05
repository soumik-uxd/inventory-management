<template>
  <div class="filters-bar">
    <div class="filters-container">
      <div class="filters-grid">
        <div class="filter-group">
          <label>{{ t('filters.timePeriod') }}</label>
          <select v-model="selectedPeriod" class="filter-select">
            <option value="all">{{ t('filters.allMonths') }}</option>
            <option value="2025-01">{{ t('months.january') }}</option>
            <option value="2025-02">{{ t('months.february') }}</option>
            <option value="2025-03">{{ t('months.march') }}</option>
            <option value="2025-04">{{ t('months.april') }}</option>
            <option value="2025-05">{{ t('months.may') }}</option>
            <option value="2025-06">{{ t('months.june') }}</option>
            <option value="2025-07">{{ t('months.july') }}</option>
            <option value="2025-08">{{ t('months.august') }}</option>
            <option value="2025-09">{{ t('months.september') }}</option>
            <option value="2025-10">{{ t('months.october') }}</option>
            <option value="2025-11">{{ t('months.november') }}</option>
            <option value="2025-12">{{ t('months.december') }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label>{{ t('filters.location') }}</label>
          <select v-model="selectedLocation" class="filter-select">
            <option value="all">{{ t('filters.all') }}</option>
            <option value="San Francisco">{{ t('warehouses.sanFrancisco') }}</option>
            <option value="London">{{ t('warehouses.london') }}</option>
            <option value="Tokyo">{{ t('warehouses.tokyo') }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label>{{ t('filters.category') }}</label>
          <select v-model="selectedCategory" class="filter-select">
            <option value="all">{{ t('filters.all') }}</option>
            <option value="circuit boards">{{ t('categories.circuitBoards') }}</option>
            <option value="sensors">{{ t('categories.sensors') }}</option>
            <option value="actuators">{{ t('categories.actuators') }}</option>
            <option value="controllers">{{ t('categories.controllers') }}</option>
            <option value="power supplies">{{ t('categories.powerSupplies') }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label>{{ t('filters.orderStatus') }}</label>
          <select v-model="selectedStatus" class="filter-select">
            <option value="all">{{ t('filters.all') }}</option>
            <option value="delivered">{{ t('status.delivered') }}</option>
            <option value="shipped">{{ t('status.shipped') }}</option>
            <option value="processing">{{ t('status.processing') }}</option>
            <option value="backordered">{{ t('status.backordered') }}</option>
          </select>
        </div>
      </div>

      <button
        class="reset-filters-btn"
        @click="resetFilters"
        :disabled="!hasActiveFilters"
        title="Reset all filters"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script>
import { useFilters } from '../composables/useFilters'
import { useI18n } from '../composables/useI18n'

export default {
  name: 'FilterBar',
  setup() {
    const {
      selectedPeriod,
      selectedLocation,
      selectedCategory,
      selectedStatus,
      hasActiveFilters,
      resetFilters
    } = useFilters()

    const { t } = useI18n()

    return {
      t,
      selectedPeriod,
      selectedLocation,
      selectedCategory,
      selectedStatus,
      hasActiveFilters,
      resetFilters
    }
  }
}
</script>

<style scoped>
.filters-bar {
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-3) 0;
  /* Sticks directly under the sticky topbar; below it in the layer stack so
     topbar dropdowns stay on top */
  position: sticky;
  top: var(--topbar-height);
  z-index: var(--z-sticky);
}

/* Same max-width and horizontal padding as .main-content so edges line up */
.filters-container {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 0 var(--space-7);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.filters-grid {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
  flex: 1;
  min-width: 0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-group label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.filter-select {
  padding: var(--space-1) var(--space-3);
  min-height: 32px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-sm);
  color: var(--color-text);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  font-weight: 500;
  min-width: 140px;
}

.filter-select:hover {
  border-color: var(--color-text-subtle);
}

/* Focus ring is --color-primary at 15% alpha; tokens have no alpha variant */
.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.reset-filters-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}

.reset-filters-btn:hover:not(:disabled) {
  background: var(--color-surface-muted);
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.reset-filters-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.reset-filters-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.reset-filters-btn svg {
  width: 18px;
  height: 18px;
}

/* Match .main-content's drawer-width padding (drawer breakpoint is 768px) */
@media (max-width: 767px) {
  .filters-container {
    padding: 0 var(--space-4);
  }
}

/* Phone width: two filters per row, label above select, reset button top-aligned */
@media (max-width: 640px) {
  .filters-container {
    align-items: flex-start;
  }

  .filters-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2) var(--space-3);
  }

  .filter-group {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-1);
  }

  .filter-select {
    min-width: 0;
    width: 100%;
  }
}
</style>
