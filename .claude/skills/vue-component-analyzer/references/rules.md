# Analyzer Rules

Each finding from `scripts/analyze.mjs` has a rule ID. Use this table to check a finding before reporting it, and to pick the fix. "Verify" is what to read in the source before you trust the finding, since the analyzer is static and will sometimes be wrong.

## Performance

| Rule | Severity | What it means | Verify | Typical fix |
|---|---|---|---|---|
| `vfor/missing-key` | high | A `v-for` has no `:key`. | Ignore it on a `<template v-for>` whose children carry the key. | Add `:key` with a stable id (`item.id`, `sku`, `month`). |
| `vfor/index-key` | medium | The key is the position alias (`i`, `` `row-${i}` ``). | If the source is an object, the second alias is the property key, which is stable. Index keys are also harmless on static lists that never reorder, filter, or hold inputs or component state. Lower the severity in that case. | Key on a field that is unique within the list. If none exists, combine fields, or derive an id in a computed. |
| `vfor/with-vif` | high/medium | `v-if` and `v-for` sit on the same element. In Vue 3 the `v-if` runs first, so it is high severity when it references the loop item, because then it's a bug. | None needed. | Filter in a computed, or move the `v-if` to a wrapping `<template>`. |
| `vfor/call-source` | medium | The list comes from a function call or array op during render. | None needed. | Use a computed per list. A parameterized call like `byTrend('up')` becomes one computed that groups everything once. |
| `template/method-call` | high/medium/low | A component function is called from the template. It's high when it loops over component data and runs inside `v-for` (O(n²) per render), medium when it loops or takes no arguments, low when it's a cheap no-argument helper. | Read the function. Cheap formatters with arguments, like `formatDate(order.date)`, are fine and the analyzer skips them. | Move work that takes no arguments into a computed. For per-item values, precompute a map or enriched list in a computed. Hoist loop-invariant work out of the loop, e.g. the max value used for bar heights. |
| `template/inline-collection-op` | high/medium | The template calls `.filter`, `.map`, `.sort` or similar inline. | None needed. | Use a computed. |
| `script/deep-watch` | low | A `watch` has `deep: true`. | It's fine on small objects. | Watch a getter for the specific fields instead. |
| `script/listener-leak` | medium | There are more `addEventListener` or `setInterval` calls than matching removals. | Removals may be in a composable, or the target may be a component-owned element. | Remove the listener in `onUnmounted`/`beforeUnmount`, or use a composable that cleans up after itself. |
| `script/console-log` | low | Debug logging is left in the component. It can be hot inside render paths. | None needed. | Delete it. Keep `console.error` inside catch blocks. |

## Correctness spotted along the way

| Rule | Severity | What it means | Verify | Typical fix |
|---|---|---|---|---|
| `template/unresolved-component` | high | A component tag is used but never imported or registered, so it renders nothing. | Check for global registration done in a way the analyzer can't see, such as a plugin `install()`. | Import and register it, or remove the usage. |
| `script/prop-mutation` | high | Code writes to a prop: an assignment, a mutating array method, or `v-model` bound to a prop. | Check it's really the props object and not a local variable that happens to share the name. | Emit an event. Or copy the prop into a local `ref` and watch it. Or use a computed get/set that emits `update:x`. |

## Code reuse

| Rule | Severity | What it means | Verify | Typical fix |
|---|---|---|---|---|
| `reuse/shadows-shared-helper` | medium | A component defines a function with the same name or body as a shared util or composable export. | Wrappers that call the shared helper under an import alias are skipped already. Check the remaining ones for a real behavioral difference. | Import the shared helper. If it really differs, rename the local one. |
| `reuse/duplicate-function` | medium | An identical function body appears in two or more components. | None needed. | Move it to `utils/` (pure) or a composable (needs reactive state, i18n, etc.). |
| `reuse/repeated-helper-name` | low | Components each define the same helper name with different bodies. This is drift. | Diff the bodies. Different behavior may be intended, or one copy may be stale. | Unify into one helper, with a parameter for the real difference. |
| `reuse/duplicate-template-block` | medium (cross-file)/low | The same element structure (tags, static classes, directives) repeats. Text and bound values are ignored. | Open both ranges. Similar structure can carry different meaning, so only extract when the pieces would change together. | Extract a component with props. Or, within one file, use a `v-for` over a small config array. |
| `reuse/duplicate-style-block` | low | An identical CSS declaration body appears under different selectors. | Matches on 4-5 declarations can be coincidence. | Move it to a shared class in the global stylesheet. |
| `reuse/selector-redefined` | low | The same class is defined in three or more files. | Scoped styles with the same name may be deliberately different. | Keep one canonical definition. |
| `script/unused-return` | low | `setup()` returns a value the template never references. | Make sure it isn't used through `$refs`, `expose`, or a parent template ref. | Remove it from the return, and delete it if nothing else uses it. |
| `script/unused-component` | low | A component is registered or imported but not used in the template. | It might be used in a render function. | Remove the import and registration. |

## Size

| Rule | Severity | Threshold |
|---|---|---|
| `size/large-component` | high >800 lines, medium >400 | Split by responsibility: sections become child components, data loading and derivations go into a composable. |
| `size/large-template` | medium >250 lines | Extract repeated or self-contained sections, such as each card or table. |
| `size/large-script` | medium >300 lines | Move reusable logic into composables. |

Size alone is a weak signal. Only rank a size finding high when the file also has reuse or performance findings that a split would resolve.

## Limits

- The checks are static. The analyzer can't see runtime list sizes, render frequency, or props passed by parents.
- Template call detection only covers the component's own functions. Imported helpers called from the template aren't measured.
- Render-function and JSX components are measured for script metrics only.
- When `unplugin-vue-components` or Nuxt is present, the analyzer skips unresolved-component checks.
- On Vue older than 3.4, `v-for` expressions are parsed with a regex fallback, which is less exact for unusual destructuring.
- Prop-mutation checks only run when a props binding is found (`setup(props)` or `const x = defineProps()`). Options API code that writes `this.someProp` is not checked.
