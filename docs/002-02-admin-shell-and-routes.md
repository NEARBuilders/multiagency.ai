# Dedicated admin shell and standalone routes

### Context
This is a child ticket of #002-ux-improvements, to create a coherent admin navigation experience. Currently admin sections live as operator tabs embedded on public pages:
- Project list → `/work` operator tab (components/projects-admin-section.tsx)
- Contributor list → `/team` operator tab (components/contributors-admin-section.tsx)
- Budget rollup + audit log → `/treasury` operator tab (components/budgets-manager.tsx)
- Application review → `/team` operator tab (components/applications-admin-section.tsx)
- Billing list → only exists inline on `/admin/projects/{slug}`

This fragments admin workflows across unrelated pages and makes demo flow confusing. A dedicated admin shell with sidebar navigation and standalone routes makes the product coherent.

### Overview
Create a proper admin layout shell at `ui/src/routes/_layout/_authenticated/_admin.tsx` with a sidebar containing navigation links. The sidebar should list: Projects, Contributors, Budgets, Billings, Applications, Settings. Each item links to `/admin/<name>`. Make the admin layout visually distinct (sidebar, maybe a different header treatment). Move admin sections out of their current public-page homes into standalone routes:

- `/admin/projects` — project list + create (extract from `projects-admin-section.tsx`, add standalone route `_admin/admin.projects.index.tsx`)
- `/admin/contributors` — contributor list + create (extract from `contributors-admin-section.tsx`, add `_admin/admin.contributors.index.tsx`)
- `/admin/budgets` — budget rollup + audit log (extract from `budgets-manager.tsx`, add `_admin/admin.budgets.index.tsx`)
- `/admin/billings` — flat billing list across all projects (extract from project detail billing section, add `_admin/admin.billings.index.tsx`)
- `/admin/applications` — application review pipeline (extract from `applications-admin-section.tsx`, add `_admin/admin.applications.index.tsx`)

Keep existing routes: `/admin/settings` and `/admin/projects/{slug}`.

The operator tabs on public pages can be removed or replaced with links to the new admin routes (e.g., "manage contributors →" link on `/team`).

Files to change:
- `ui/src/routes/_layout/_authenticated/_admin.tsx` — replace pass-through `<Outlet />` with admin shell layout + sidebar
- Create: `_admin/admin.projects.index.tsx`, `_admin/admin.contributors.index.tsx`, `_admin/admin.budgets.index.tsx`, `_admin/admin.billings.index.tsx`, `_admin/admin.applications.index.tsx`
- `ui/src/routes/_layout/team.tsx` — remove operator tabs, replace with "manage →" link
- `ui/src/routes/_layout/work.tsx` — remove operator tabs, replace with "manage →" link
- `ui/src/routes/_layout/treasury.tsx` — remove operator tabs, replace with "manage →" link
- `ui/src/components/shell.tsx` — possibly update to show admin nav differently

### Acceptance Criteria
- [ ] Admin layout renders a sidebar with: Projects, Contributors, Budgets, Billings, Applications, Settings
- [ ] Each sidebar link navigates to the corresponding `/admin/<name>` route
- [ ] All admin CRUD functionality works on the new routes (create, edit, delete, filter, paginate)
- [ ] Public pages (`/team`, `/work`, `/treasury`) no longer embed admin operator tabs
- [ ] Public pages have a "manage →" link to the admin equivalent (visible only to operators)
- [ ] All existing admin functionality is preserved (no feature regression)
- [ ] Admin sidebar highlights the active route
- [ ] Mobile: sidebar collapses into a hamburger/drawer (follows Shell pattern)
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] Follow the existing Shell component patterns in `ui/src/components/shell.tsx` for the admin layout. The admin sidebar can be a simpler variant (no logo, no social icons, just nav).
- [ ] The billing list (`/admin/billings`) is new — it needs an infinite-scroll list similar to the project detail billing section, but aggregated across all projects with project/contributor filter support (the API already has `billings.adminList` with cursor pagination).
