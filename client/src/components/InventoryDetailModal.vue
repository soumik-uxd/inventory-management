<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && inventoryItem" class="modal-overlay" @click="close">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">Inventory Item Details</h3>
            <button class="close-button" @click="close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="item-header">
              <div class="item-icon" :class="getStockIconClass()">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="12" width="32" height="28" rx="2" stroke="currentColor" stroke-width="2.5"/>
                  <path d="M16 8V16M32 8V16M8 20H40" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                  <path d="M16 28H32M16 34H24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="item-title-section">
                <h4 class="item-name">{{ translateProductName(inventoryItem.name) }}</h4>
                <div class="item-sku">SKU: {{ inventoryItem.sku }}</div>
              </div>
              <span class="stock-badge" :class="getStockStatusClass()">
                {{ getStockStatus() }}
              </span>
            </div>

            <div class="stock-summary">
              <div class="summary-card primary">
                <div class="summary-label">Quantity on Hand</div>
                <div class="summary-value">{{ inventoryItem.quantity_on_hand }} units</div>
              </div>
              <div class="summary-card" :class="getSummaryCardClass()">
                <div class="summary-label">Stock Level</div>
                <div class="summary-value">{{ stockPercentage }}%</div>
                <div class="summary-subtitle">vs. reorder point</div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Category</div>
                <div class="info-value">{{ inventoryItem.category }}</div>
              </div>

              <div class="info-item">
                <div class="info-label">Location</div>
                <div class="info-value">{{ inventoryItem.location }}</div>
              </div>

              <div class="info-item">
                <div class="info-label">Reorder Point</div>
                <div class="info-value">{{ inventoryItem.reorder_point }} units</div>
              </div>

              <div class="info-item">
                <div class="info-label">Units Remaining</div>
                <div class="info-value">
                  <span :style="{ color: inventoryItem.quantity_on_hand <= inventoryItem.reorder_point ? 'var(--color-danger)' : 'var(--color-success)' }">
                    {{ inventoryItem.quantity_on_hand - inventoryItem.reorder_point }} units
                  </span>
                </div>
              </div>

              <div class="info-item">
                <div class="info-label">Unit Cost</div>
                <div class="info-value">{{ currencySymbol }}{{ inventoryItem.unit_cost.toFixed(2) }}</div>
              </div>

              <div class="info-item">
                <div class="info-label">Total Value</div>
                <div class="info-value total-value">
                  {{ currencySymbol }}{{ totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
                </div>
              </div>

              <div class="info-item">
                <div class="info-label">Warehouse</div>
                <div class="info-value">{{ translateWarehouse(inventoryItem.location) }}</div>
              </div>

              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">
                  <span :class="['badge', getStockStatusClass()]">
                    {{ getStockStatus() }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="close">Close</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n'

const { currentCurrency, translateProductName, translateWarehouse } = useI18n()

const currencySymbol = computed(() => {
  return currentCurrency.value === 'JPY' ? '¥' : '$'
})

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  inventoryItem: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const totalValue = computed(() => {
  if (!props.inventoryItem) return 0
  return props.inventoryItem.quantity_on_hand * props.inventoryItem.unit_cost
})

const stockPercentage = computed(() => {
  if (!props.inventoryItem || props.inventoryItem.reorder_point === 0) return 0
  return Math.round((props.inventoryItem.quantity_on_hand / props.inventoryItem.reorder_point) * 100)
})

const close = () => {
  emit('close')
}

const getStockStatus = () => {
  if (!props.inventoryItem) return 'Unknown'
  if (props.inventoryItem.quantity_on_hand <= props.inventoryItem.reorder_point) {
    return 'Low Stock'
  } else if (props.inventoryItem.quantity_on_hand <= props.inventoryItem.reorder_point * 1.5) {
    return 'Adequate'
  } else {
    return 'In Stock'
  }
}

const getStockStatusClass = () => {
  const status = getStockStatus()
  if (status === 'Low Stock') return 'danger'
  if (status === 'Adequate') return 'warning'
  return 'success'
}

const getStockIconClass = () => {
  const status = getStockStatus()
  if (status === 'Low Stock') return 'danger-icon'
  if (status === 'Adequate') return 'warning-icon'
  return 'success-icon'
}

const getSummaryCardClass = () => {
  const status = getStockStatus()
  if (status === 'Low Stock') return 'danger-card'
  if (status === 'Adequate') return 'warning-card'
  return 'success-card'
}
</script>

<style scoped>
/* Modal chrome (.modal-*, .close-button, .info-*, .summary-card, transitions) and
   .btn-secondary are global in App.vue; only inventory-specific content lives here */
.modal-container {
  max-width: 700px;
}

.item-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-6);
}

.item-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-surface);
  flex-shrink: 0;
}

.item-title-section {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 var(--space-1) 0;
}

.item-sku {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-family: 'Monaco', 'Courier New', monospace;
}

.item-icon.success-icon {
  background: var(--color-success);
}

.item-icon.warning-icon {
  background: var(--color-warning);
}

.item-icon.danger-icon {
  background: var(--color-danger);
}

/* Header badge: same pill and status pairs as the global .badge, one size up */
.stock-badge {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  white-space: nowrap;
  flex-shrink: 0;
}

.stock-badge.success {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.stock-badge.warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.stock-badge.danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* Two summary tiles side by side, stacked at phone width */
.stock-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.info-value.total-value {
  font-size: var(--text-lg);
  color: var(--color-primary);
  font-weight: 700;
}
</style>
