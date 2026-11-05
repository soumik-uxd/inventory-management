# Normalize Checklist

Run these audits after the shell is in place. The search commands assume `client/src`, so adjust the path for the project.

## 1. Find drift

```bash
# Hardcoded colors per value (most frequent first)
grep -rhoE '#[0-9a-fA-F]{3,6}\b' src | sort | uniq -c | sort -rn | head -40
# Border radii
grep -rhoE 'border-radius:\s*[^;]+' src | sort | uniq -c | sort -rn
# Padding / gap values
grep -rhoE '(padding|gap|margin)[a-z-]*:\s*[^;]+' src | sort | uniq -c | sort -rn | head -40
# Global classes redefined inside scoped view styles
grep -nE '^\s*\.(card|card-header|card-title|stat-card|page-header|stats-grid)\b' src/views/*.vue src/components/*.vue
# z-index values
grep -rnE 'z-index:\s*[0-9]+' src
```

## 2. Canonical components

Define these once in the global stylesheet. Afterward, views should only add layout around them.

| Class | Spec |
|---|---|
| `.page-header` | flex, space-between, align end, `gap: var(--space-4)`, `margin-bottom: var(--space-6)`. h2 `--text-xl`/700, subtitle `--text-sm` muted. |
| `.card` | `--color-surface`, 1px `--color-border`, `--radius-lg`, `--shadow-sm`, padding `var(--space-6)`. |
| `.card-header` | flex, space-between, `margin-bottom: var(--space-4)`. |
| `.card-title` | `--text-lg`/600, `--color-text`. |
| `.stats-grid` | `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`, `gap: var(--space-4)`, `margin-bottom: var(--space-6)`. |
| `.stat-card` | the `.card` look plus label (`--text-xs`, uppercase, letter-spacing 0.05em, muted), value (`--text-xl`/700). Status variants change only an accent (icon or left border color), not padding or radius. |
| tables | header row `--color-surface-muted`, `--text-xs` uppercase muted; cells padding `var(--space-3) var(--space-4)`; row hover `--color-surface-muted`. |
| `.badge` | `--radius-full`, padding `var(--space-1) var(--space-2)`, `--text-xs`/600, soft background and status foreground. |
| buttons | `--radius-md`, padding `var(--space-2) var(--space-4)`, primary uses `--color-primary` and `--color-primary-hover`, visible `:focus-visible`. |

## 3. Per-view pass

For each view and modal:

- [ ] Delete scoped overrides that only restate a canonical class with different numbers. Keep overrides that change the layout itself (e.g. a card with no padding that wraps a full-bleed table).
- [ ] When a view invents a near-duplicate (`.kpi-card`, `.summary-card`, `.chart-card`), either switch the markup to the canonical class or make the variant build on it. Don't add a third look.
- [ ] Replace literal spacing, radius, color and shadow values with tokens. Round off-scale values (`0.313rem`, `0.625rem`, `0.938rem`) to the nearest step.
- [ ] Collapse duplicate primaries and off-palette accents onto `--color-primary` / status tokens. Chart series colors may stay literal when they encode data. Note it in a comment if so.
- [ ] Put every `z-index` on the token layers.
- [ ] Check for grids that must stack at phone width (`minmax(... , 1fr)` with `auto-fit`, or a media query).
- [ ] Wrap wide tables in an `overflow-x: auto` container.

## 4. Don't touch

- Template logic, `v-if`/`v-for`, data fetching, computed values, filter wiring, emitted events.
- i18n keys, except adding the ones the new nav needs.
- Chart geometry and SVG math.
