// Single source of truth for the main navigation, shared by AppSidebar (links)
// and AppTopbar (page title). Icons are 24x24 stroke paths rendered with
// stroke="currentColor" so they pick up the link's text color.
export const navItems = [
  {
    path: '/',
    labelKey: 'nav.overview',
    // findNavItem prefix-matches non-exact items, so '/' needs exact to avoid
    // matching every path; AppSidebar also uses it as a highlight guard
    exact: true,
    icon: [
      'M3 10.5 12 3l9 7.5',
      'M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9'
    ]
  },
  {
    path: '/inventory',
    labelKey: 'nav.inventory',
    icon: [
      'M21 8 12 3 3 8v8l9 5 9-5V8Z',
      'M3 8l9 5 9-5',
      'M12 13v8'
    ]
  },
  {
    path: '/orders',
    labelKey: 'nav.orders',
    icon: [
      'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z',
      'M16 5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2',
      'M9 12h6',
      'M9 16h4'
    ]
  },
  {
    path: '/spending',
    labelKey: 'nav.finance',
    icon: [
      'M12 3v18',
      'M16.5 7.5c-.6-1.2-2.2-2-4.5-2-2.5 0-4 1.2-4 3s1.5 2.6 4 3 4 1.2 4 3-1.5 3-4 3c-2.3 0-3.9-.8-4.5-2'
    ]
  },
  {
    path: '/demand',
    labelKey: 'nav.demandForecast',
    icon: [
      'M3 17l6-6 4 4 8-8',
      'M15 7h6v6'
    ]
  },
  {
    path: '/reports',
    labelKey: 'nav.reports',
    icon: [
      'M4 20V10',
      'M10 20V4',
      'M16 20v-7',
      'M22 20H2'
    ]
  }
]

// Returns the nav item that owns `path`: exact items match only themselves,
// the rest match their own path or any sub-path (e.g. /orders/123).
export function findNavItem (path) {
  return navItems.find(item =>
    item.exact
      ? path === item.path
      : path === item.path || path.startsWith(item.path + '/')
  )
}
