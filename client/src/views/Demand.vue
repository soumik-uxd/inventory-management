<template>
  <div class="demand">
    <div class="page-header">
      <p>{{ t("demand.description") }}</p>
    </div>

    <div v-if="loading" class="loading">{{ t("common.loading") }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div class="demand-trend-cards">
        <div class="trend-card increasing-card">
          <div class="trend-header">
            <div class="trend-icon">↑</div>
            <div>
              <div class="trend-label">{{ t("demand.increasingDemand") }}</div>
              <div class="trend-count">
                {{
                  t("demand.itemsCount", {
                    count: getForecastsByTrend("increasing").length,
                  })
                }}
              </div>
            </div>
          </div>
          <div class="trend-items">
            <div
              v-for="item in getForecastsByTrend('increasing').slice(0, 5)"
              :key="item.id"
              class="trend-item"
            >
              <span class="item-name">{{ item.item_name }}</span>
              <span class="item-change">+{{ getChangePercent(item) }}%</span>
            </div>
            <div
              v-if="getForecastsByTrend('increasing').length > 5"
              class="more-items"
            >
              +{{ getForecastsByTrend("increasing").length - 5 }}
              {{ t("demand.more") }}
            </div>
          </div>
        </div>

        <div class="trend-card stable-card">
          <div class="trend-header">
            <div class="trend-icon">→</div>
            <div>
              <div class="trend-label">{{ t("demand.stableDemand") }}</div>
              <div class="trend-count">
                {{
                  t("demand.itemsCount", {
                    count: getForecastsByTrend("stable").length,
                  })
                }}
              </div>
            </div>
          </div>
          <div class="trend-items">
            <div
              v-for="item in getForecastsByTrend('stable').slice(0, 5)"
              :key="item.id"
              class="trend-item"
            >
              <span class="item-name">{{ item.item_name }}</span>
              <span class="item-change neutral"
                >{{ getChangePercent(item) }}%</span
              >
            </div>
            <div
              v-if="getForecastsByTrend('stable').length > 5"
              class="more-items"
            >
              +{{ getForecastsByTrend("stable").length - 5 }}
              {{ t("demand.more") }}
            </div>
          </div>
        </div>

        <div class="trend-card decreasing-card">
          <div class="trend-header">
            <div class="trend-icon">↓</div>
            <div>
              <div class="trend-label">{{ t("demand.decreasingDemand") }}</div>
              <div class="trend-count">
                {{
                  t("demand.itemsCount", {
                    count: getForecastsByTrend("decreasing").length,
                  })
                }}
              </div>
            </div>
          </div>
          <div class="trend-items">
            <div
              v-for="item in getForecastsByTrend('decreasing').slice(0, 5)"
              :key="item.id"
              class="trend-item"
            >
              <span class="item-name">{{ item.item_name }}</span>
              <span class="item-change">{{ getChangePercent(item) }}%</span>
            </div>
            <div
              v-if="getForecastsByTrend('decreasing').length > 5"
              class="more-items"
            >
              +{{ getForecastsByTrend("decreasing").length - 5 }}
              {{ t("demand.more") }}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t("demand.demandForecasts") }}</h3>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ t("demand.table.sku") }}</th>
                <th>{{ t("demand.table.itemName") }}</th>
                <th>{{ t("demand.table.currentDemand") }}</th>
                <th>{{ t("demand.table.forecastedDemand") }}</th>
                <th>{{ t("demand.table.change") }}</th>
                <th>{{ t("demand.table.trend") }}</th>
                <th>{{ t("demand.table.period") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="forecast in forecasts" :key="forecast.id">
                <td>
                  <strong>{{ forecast.item_sku }}</strong>
                </td>
                <td>{{ forecast.item_name }}</td>
                <td>{{ forecast.current_demand }}</td>
                <td>
                  <strong>{{ forecast.forecasted_demand }}</strong>
                </td>
                <td>
                  <span :style="{ color: getChangeColor(forecast) }">
                    {{ getChangePercent(forecast) }}%
                  </span>
                </td>
                <td>
                  <span :class="['badge', forecast.trend]">
                    {{ t(`trends.${forecast.trend}`) }}
                  </span>
                </td>
                <td>{{ translatePeriod(forecast.period) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, computed } from "vue";
import { api } from "../api";
import { useFilters } from "../composables/useFilters";
import { useI18n } from "../composables/useI18n";

export default {
  name: "Demand",
  setup() {
    const { t } = useI18n();
    const loading = ref(true);
    const error = ref(null);
    const allForecasts = ref([]);
    const inventoryItems = ref([]);

    // Use shared filters
    const { selectedLocation, selectedCategory, getCurrentFilters } =
      useFilters();

    // Filter forecasts based on inventory filters
    const forecasts = computed(() => {
      if (
        selectedLocation.value === "all" &&
        selectedCategory.value === "all"
      ) {
        return allForecasts.value;
      }

      // Get SKUs of items that match the filters
      const validSkus = new Set(inventoryItems.value.map((item) => item.sku));
      return allForecasts.value.filter((f) => validSkus.has(f.item_sku));
    });

    const loadForecasts = async () => {
      try {
        loading.value = true;
        const filters = getCurrentFilters();

        const [forecastsData, inventoryData] = await Promise.all([
          api.getDemandForecasts(),
          api.getInventory({
            warehouse: filters.warehouse,
            category: filters.category,
          }),
        ]);

        allForecasts.value = forecastsData;
        inventoryItems.value = inventoryData;
      } catch (err) {
        error.value = "Failed to load demand forecasts: " + err.message;
      } finally {
        loading.value = false;
      }
    };

    // Watch for filter changes and reload data
    watch([selectedLocation, selectedCategory], () => {
      loadForecasts();
    });

    const getForecastsByTrend = (trend) => {
      return forecasts.value.filter((f) => f.trend === trend);
    };

    const getChangePercent = (forecast) => {
      const change = (
        ((forecast.forecasted_demand - forecast.current_demand) /
          forecast.current_demand) *
        100
      ).toFixed(1);
      return change > 0 ? `+${change}` : change;
    };

    const getChangeColor = (forecast) => {
      const change = forecast.forecasted_demand - forecast.current_demand;
      const changePercent = Math.abs((change / forecast.current_demand) * 100);

      // If change is within ±2%, consider it stable and show blue
      if (changePercent <= 2) {
        return "var(--color-info)"; // Blue for stable
      }

      if (change > 0) return "var(--color-success)"; // Green for increasing
      if (change < 0) return "var(--color-danger)"; // Red for decreasing
      return "var(--color-info)"; // Blue for no change
    };

    const translatePeriod = (period) => {
      // Period values like "Next 3 months", "Q1 2025", "30 days", etc.
      const { currentLocale } = useI18n();
      if (currentLocale.value === "ja") {
        return period
          .replace(/Next\s+/i, "次の")
          .replace(/\s+months/i, "か月")
          .replace(/\s+month/i, "か月")
          .replace(/\s+days/i, "日間")
          .replace(/\s+day/i, "日")
          .replace("Q1", "第1四半期")
          .replace("Q2", "第2四半期")
          .replace("Q3", "第3四半期")
          .replace("Q4", "第4四半期");
      }
      return period;
    };

    onMounted(loadForecasts);

    return {
      t,
      loading,
      error,
      forecasts,
      getForecastsByTrend,
      getChangePercent,
      getChangeColor,
      translatePeriod,
    };
  },
};
</script>

<style scoped>
.demand-trend-cards {
  display: grid;
  /* min(320px, 100%) lets the column shrink below 320px on phones instead of overflowing */
  grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

/* Builds on the .stat-card look: same surface, border, radius, padding; the
   trend variants only recolor the left accent, matching .stat-card.* */
.trend-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
  min-width: 0;
  transition: box-shadow var(--transition-fast);
}

.trend-card:hover {
  box-shadow: var(--shadow-md);
}

.increasing-card {
  border-left-color: var(--color-success);
}

.stable-card {
  border-left-color: var(--color-info);
}

.decreasing-card {
  border-left-color: var(--color-danger);
}

.trend-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-surface-muted);
}

.trend-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-size: var(--text-xl);
  font-weight: 700;
  flex-shrink: 0;
}

.increasing-card .trend-icon {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.stable-card .trend-icon {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.decreasing-card .trend-icon {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.trend-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.trend-count {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
  margin-top: var(--space-1);
}

.trend-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.trend-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.trend-item:hover {
  background: var(--color-surface-muted);
}

.item-name {
  font-size: var(--text-sm);
  color: var(--color-text);
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: var(--space-4);
}

.item-change {
  font-size: var(--text-xs);
  font-weight: 700;
  flex-shrink: 0;
}

.increasing-card .item-change {
  color: var(--color-success);
}

.stable-card .item-change {
  color: var(--color-info);
}

.decreasing-card .item-change {
  color: var(--color-danger);
}

.item-change.neutral {
  color: var(--color-text-muted);
}

.more-items {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-style: italic;
  text-align: center;
  padding: var(--space-2);
}
</style>
