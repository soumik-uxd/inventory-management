# App Shell Pattern

Reference layout for a sidebar-based Vue 3 app. Adapt names, component style (`setup()` vs `<script setup>`), and i18n calls to the project.

## Layout

```
+-----------+--------------------------------------+
|           | Topbar (sticky, --topbar-height)     |
|  Sidebar  +--------------------------------------+
|  (sticky, | Optional sticky sub-bar (filters)    |
|  100vh)   +--------------------------------------+
|           | Main content (max-width, padded)     |
|           |                                      |
+-----------+--------------------------------------+
```

```css
.app-shell {
  display: grid;
  /* minmax(0, 1fr) stops wide tables/charts from pushing the content column wider than the viewport */
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
}
.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  z-index: var(--z-sidebar);
}
.app-main-column { display: flex; flex-direction: column; min-width: 0; }
.app-topbar {
  position: sticky;
  top: 0;
  height: var(--topbar-height);
  z-index: var(--z-topbar);
}
.main-content {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-6) var(--space-7);
}
```

## Sidebar component

- Drive nav items from a single array so labels, icons and paths live in one place:
  ```js
  const navItems = [
    { path: '/', labelKey: 'nav.overview', icon: 'home', exact: true },
    { path: '/inventory', labelKey: 'nav.inventory', icon: 'box' },
  ]
  ```
- Render each with `<router-link :to="item.path" class="nav-item">`. For active styling, use the classes vue-router adds itself: `router-link-active` for prefix matches and `router-link-exact-active` for exact matches. `/` needs exact matching or it stays active on every page. Don't hand-write `$route.path === ...` checks.
- Icons are inline SVG with `stroke="currentColor"`, 18-20px, `aria-hidden="true"`. Keep them in a small map inside the component and add no icon dependency.
- Structure, top to bottom:
  1. Brand block: logo mark plus app name and subtitle, the same height as the topbar so the two line up.
  2. Optional section label in small caps (`--text-xs`, letter-spacing 0.05em, muted).
  3. Nav list.
  4. Footer pinned to the bottom with `margin-top: auto`: version or help link.
- Nav item states:
  - default: muted text, transparent background
  - hover: `--color-surface-muted`
  - active: `--color-primary-soft` background, `--color-primary` text and icon, weight 600
  - keyboard focus: `:focus-visible` outline of 2px primary with offset 2px
- Wrap the list in `<nav aria-label="Main">` and set `aria-current="page"` on the active link. router-link sets this automatically on exact-active links.

## Topbar component

- Left: hamburger button (mobile only), then the page title. Derive the title from the matched nav item or `route.meta.title`. Don't duplicate it per view.
- Right: existing toolbar widgets (language switcher, profile menu, notifications). Their dropdowns already anchor top-right, so they normally need no changes.
- Background `--color-surface`, bottom border `--color-border`, padding `0 var(--space-7)`.

## Responsive drawer (below 1024px)

```css
@media (max-width: 1023px) {
  .app-shell { grid-template-columns: minmax(0, 1fr); }
  .app-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: var(--sidebar-width);
    transform: translateX(-100%);
    transition: transform var(--transition-fast);
  }
  .app-sidebar.is-open { transform: translateX(0); box-shadow: var(--shadow-lg); }
  .sidebar-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: calc(var(--z-sidebar) - 1); }
  .main-content { padding: var(--space-4); }
}
@media (min-width: 1024px) {
  .menu-toggle, .sidebar-backdrop { display: none; }
}
```

- Keep the drawer state (`sidebarOpen`) in the root layout. The topbar emits `toggle-sidebar` and the sidebar emits `close`.
- Close the drawer on route change (`watch(() => route.fullPath, ...)`), on a backdrop click, and on Escape. Add the keydown listener in `onMounted` and remove it in `onUnmounted`.
- The hamburger is a `<button>` with `aria-label`, `aria-expanded="sidebarOpen"` and `aria-controls="app-sidebar"`.
- Check the phone width: the body must never scroll horizontally. Tables go inside `overflow-x: auto` wrappers.

## Things that break when the top nav goes away

- Sticky sub-bars hardcoded to the old header height (e.g. `top: 70px`). Change them to `top: var(--topbar-height)`.
- Content `max-width` and padding duplicated on sub-bars. Point them at `--content-max-width` and the spacing tokens so their edges stay aligned with the main content.
- z-index values: put every one on the token layers so dropdowns sit above the topbar and modals above everything.
- Teleported modals (`<Teleport to="body">`) aren't affected by the grid, but check that their backdrop covers the sidebar.
