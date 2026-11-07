<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && costData" class="modal-overlay" @click="close">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">{{ costData.month }} Cost Breakdown</h3>
            <button class="close-button" @click="close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M15 5L5 15M5 5L15 15"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="cost-summary">
              <div class="summary-card total">
                <div class="summary-label">Total Costs</div>
                <div class="summary-value">
                  {{ currencySymbol }}{{ totalCosts.toLocaleString() }}
                </div>
              </div>
            </div>

            <div class="cost-breakdown">
              <div class="cost-item procurement">
                <div class="cost-header">
                  <div class="cost-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <rect
                        x="4"
                        y="6"
                        width="16"
                        height="14"
                        rx="2"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                      <path
                        d="M8 6V4M16 6V4M4 10H20"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                  </div>
                  <div class="cost-info">
                    <div class="cost-name">Procurement</div>
                    <div class="cost-amount">
                      {{ currencySymbol
                      }}{{ costData.procurement.toLocaleString() }}
                    </div>
                  </div>
                </div>
                <div class="cost-percentage">
                  {{ getProcurementPercentage() }}% of total
                </div>
              </div>

              <div class="cost-item operational">
                <div class="cost-header">
                  <div class="cost-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="8"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                      <path
                        d="M12 8V12L15 15"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                  </div>
                  <div class="cost-info">
                    <div class="cost-name">Operational</div>
                    <div class="cost-amount">
                      {{ currencySymbol
                      }}{{ costData.operational.toLocaleString() }}
                    </div>
                  </div>
                </div>
                <div class="cost-percentage">
                  {{ getOperationalPercentage() }}% of total
                </div>
              </div>

              <div class="cost-item labor">
                <div class="cost-header">
                  <div class="cost-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="8"
                        r="4"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                      <path
                        d="M6 20C6 16.6863 8.68629 14 12 14C15.3137 14 18 16.6863 18 20"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                    </svg>
                  </div>
                  <div class="cost-info">
                    <div class="cost-name">Labor</div>
                    <div class="cost-amount">
                      {{ currencySymbol }}{{ costData.labor.toLocaleString() }}
                    </div>
                  </div>
                </div>
                <div class="cost-percentage">
                  {{ getLaborPercentage() }}% of total
                </div>
              </div>

              <div class="cost-item overhead">
                <div class="cost-header">
                  <div class="cost-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9 21 9 18 9 16C9 14 10 14 12 14C14 14 15 14 15 16C15 18 15 21 15 21M9 21H15"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                  </div>
                  <div class="cost-info">
                    <div class="cost-name">Overhead</div>
                    <div class="cost-amount">
                      {{ currencySymbol
                      }}{{ costData.overhead.toLocaleString() }}
                    </div>
                  </div>
                </div>
                <div class="cost-percentage">
                  {{ getOverheadPercentage() }}% of total
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
import { computed } from "vue";
import { useI18n } from "../composables/useI18n";

const { currentCurrency } = useI18n();

const currencySymbol = computed(() => {
  return currentCurrency.value === "JPY" ? "¥" : "$";
});

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  costData: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["close"]);

const totalCosts = computed(() => {
  if (!props.costData) return 0;
  return (
    props.costData.procurement +
    props.costData.operational +
    props.costData.labor +
    props.costData.overhead
  );
});

const getProcurementPercentage = () => {
  if (!props.costData || totalCosts.value === 0) return 0;
  return ((props.costData.procurement / totalCosts.value) * 100).toFixed(1);
};

const getOperationalPercentage = () => {
  if (!props.costData || totalCosts.value === 0) return 0;
  return ((props.costData.operational / totalCosts.value) * 100).toFixed(1);
};

const getLaborPercentage = () => {
  if (!props.costData || totalCosts.value === 0) return 0;
  return ((props.costData.labor / totalCosts.value) * 100).toFixed(1);
};

const getOverheadPercentage = () => {
  if (!props.costData || totalCosts.value === 0) return 0;
  return ((props.costData.overhead / totalCosts.value) * 100).toFixed(1);
};

const close = () => {
  emit("close");
};
</script>

<style scoped>
/* Modal chrome (.modal-*, .close-button, .summary-card base, transitions) and
   .btn-secondary are global in App.vue; only cost-specific content lives here */
.cost-summary {
  margin-bottom: var(--space-6);
}

/* Total tile is the one solid-primary hero tile: centered, inverted text */
.summary-card.total {
  text-align: center;
  background: var(--color-primary);
  border-color: var(--color-primary);
  padding: var(--space-6);
}

.summary-card.total .summary-label {
  color: var(--color-primary-soft);
}

.summary-card.total .summary-value {
  color: var(--color-surface);
}

.cost-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cost-item {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  border-left-width: 3px;
  background: var(--color-surface);
}

/* Cost-type colors stay literal on purpose: they encode the series and match the
   Spending "Monthly Cost Flow" chart (procurement/operational/labor/overhead) */
.cost-item.procurement {
  border-left-color: #3b82f6;
}
.cost-item.operational {
  border-left-color: #8b5cf6;
}
.cost-item.labor {
  border-left-color: #10b981;
}
.cost-item.overhead {
  border-left-color: #f59e0b;
}

.cost-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
}

.cost-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-surface);
}

/* Literal series colors, see .cost-item above */
.cost-item.procurement .cost-icon {
  background: #3b82f6;
}
.cost-item.operational .cost-icon {
  background: #8b5cf6;
}
.cost-item.labor .cost-icon {
  background: #10b981;
}
.cost-item.overhead .cost-icon {
  background: #f59e0b;
}

.cost-info {
  flex: 1;
  min-width: 0;
}

.cost-name {
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--text-base);
  margin-bottom: var(--space-1);
}

.cost-amount {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
}

.cost-percentage {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 500;
}
</style>
