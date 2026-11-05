---
name: saas-sidebar-redesign
description: Redesign a Vue 3 + vue-router app into a SaaS-style layout with a left sidebar, a design-token spacing and color scale, and normalized cards and page headers. Use this skill when asked to modernize or restyle a Vue app's UI, replace a top nav with a sidebar, or make spacing consistent.
---

# SaaS Sidebar Redesign

Turns a Vue 3 app's top-nav layout into a modern SaaS shell: a fixed left sidebar, a slim topbar, design tokens, and one consistent card and spacing system across every view.

Supporting files (read them when you reach the matching step):
- `references/tokens.css`: starter token sheet
- `references/app-shell-pattern.md`: sidebar, topbar, grid layout, responsive drawer, accessibility
- `references/normalize-checklist.md`: drift audit commands and canonical component specs

## Ground Rules

1. **Presentation only.** Keep routes, data fetching, filter state, i18n wiring, emitted events and modal logic exactly as they are. If a template has to move, move it whole.
2. **Project rules win.** Read the project's CLAUDE.md files first. Follow their required subagents (e.g. one that must handle `.vue` edits), their design-system colors, and the component style already in use (`export default { setup() }` vs `<script setup>`). Where they conflict with this skill, follow the project.
3. **No new dependencies.** Icons are inline SVG with `currentColor`. No icon packs, UI kits or CSS frameworks. No emojis in the UI.
4. **Comment the non-obvious.** Sticky offsets, grid track choices, the drawer breakpoint, z-index layering, and any spot where you kept a literal value on purpose.
5. **One shell, many views.** Get the shell right first, then normalize views. Don't restyle views before tokens exist.

## Step 1: Discover

Before you edit anything, find and report:

- The root layout component (the one rendering `<router-view>`) and its current nav markup.
- The router definition: paths, names, `meta`, and any routes missing from the nav.
- The i18n setup and the nav label keys. Note any hardcoded labels.
- Where global CSS lives (root component `<style>`, `src/styles/*`, `index.html`) and whether tokens or CSS variables already exist.
- Anything positioned relative to the current header: sticky offsets (`top: 70px`), dropdown anchors, `z-index` values.
- Toolbar widgets in the header (language switcher, profile menu, search) and modals mounted from the root.

Summarize this as a short inventory. Flag anything that would change behavior, and ask before doing it.

## Step 2: Tokens

1. Copy `references/tokens.css` to `src/styles/tokens.css` and import it once at the top of `main.js`.
2. If the project already has a palette, map the token values onto it. Don't add new hues.
3. Pick exactly one primary. If the codebase uses two near-identical blues, pick the more frequent one and note the other for Step 4.
4. Move the root `body` styles (font, background, text color) onto tokens.

## Step 3: App Shell

Follow `references/app-shell-pattern.md`.

1. **Sidebar component** (`AppSidebar.vue`):
   - brand block
   - nav items from one array (path, label key, icon, `exact` flag)
   - `router-link` with router-provided active classes
   - footer
2. **Topbar component** (`AppTopbar.vue`):
   - hamburger (mobile only)
   - current page title derived from the active nav item or `route.meta`
   - existing toolbar widgets moved here unchanged
3. **Root layout:**
   - Replace the top header with a CSS grid of `var(--sidebar-width) minmax(0, 1fr)`.
   - The right column holds the topbar, any sticky sub-bar, and `<main>`.
   - Keep modal mounts and their state where they were.
4. **Re-anchor** sticky sub-bars to `top: var(--topbar-height)` and align their max-width and padding with the main content.
5. **Responsive:**
   - Below 1024px the sidebar becomes an off-canvas drawer with a backdrop.
   - It closes on route change, on a backdrop click, and on Escape.
   - Use `aria-expanded` and `aria-controls` on the toggle, and `aria-current` on the active link.
6. Add any missing i18n keys the sidebar needs, in every locale file.

## Step 4: Normalize

Follow `references/normalize-checklist.md`.

1. Run the drift audit commands and note the worst offenders.
2. Rewrite the global canonical classes (`.page-header`, `.card`, `.card-header`, `.card-title`, `.stats-grid`, `.stat-card`, tables, `.badge`, buttons) on tokens.
3. Go through views and modals one at a time:
   - Remove overrides that only restate canonical classes.
   - Point look-alike variants at the canonical look.
   - Swap literals for tokens.
   - Move every z-index onto the token layers.
4. Leave chart geometry and data-encoding colors alone.

## Step 5: Verify

1. Run `npm run build` (or the project's equivalent). It must pass.
2. Start the dev servers and open every route at about 1440px and about 400px wide:
   - Data loads, and filters still change results.
   - The active nav state is correct, including `/` not being active everywhere.
   - At 400px the drawer opens and closes, and the body never scrolls horizontally.
   - Toolbar dropdowns sit above the topbar, and modals cover the sidebar.
   - Each locale renders without overflow in the sidebar.
3. Use the project's browser-testing tool (e.g. Playwright MCP) for screenshots. If it is unavailable, say so plainly instead of claiming visual verification.
4. Run the project's code-review agent on the diff, if it has one.
5. Report:
   - files added and changed
   - tokens introduced
   - overrides removed
   - anything left literal on purpose
   - anything you couldn't verify
