# TanStack Table data grids

### Context
This is a child ticket of #002-ux-improvements, blocked by #002-02, to replace existing admin list UIs with `@tanstack/react-table` headless tables. Currently admin lists (projects, contributors, budgets audit log, billings, applications) use raw HTML tables or simple card layouts with no sorting, filtering, or column management. `@tanstack/react-table` is already in the catalog (`package.json` catalogs) and provides headless table primitives (column defs, sorting, filtering, pagination, selection, column visibility, controlled state). This ticket builds the table infrastructure used by the admin shell and provides the foundation for the report data display in Epic 3.

### Overview
Create a reusable `<DataTable>` component wrapping `@tanstack/react-table` following the project's component patterns. Apply it to each admin list:

1. **Projects list** (`/admin/projects`) — columns: title, slug, kind, status, visibility, client(s), updated. Sort by title/status/updated. Filter by kind/status/client. Pagination. Row click → navigate to project detail.
2. **Contributors list** (`/admin/contributors`) — columns: name, NEAR account, skills, location, projects assigned. Sort by name. Filter by skill. Pagination.
3. **Budgets audit log** (`/admin/budgets`) — columns: verb (budget/deallocate/transfer), project, token, amount, client, note, actor, date. Sort by date/amount. Filter by project/token/client. Infinite scroll (cursor-based, not page-based — keep existing pattern).
4. **Billings list** (`/admin/billings`) — columns: proposal ID, project, contributor, token, amount, status, date. Sort by date/amount. Filter by project/contributor/status. Infinite scroll.
5. **Applications list** (`/admin/applications`) — columns: name, email, kind, status, date. Sort by date. Filter by kind/status. Infinite scroll.

The component must be headless: define column defs, row models, and state without prescribing markup. Render accessible table markup (`<table>`, `<thead>`, `<tbody>`, `aria-sort`). Table state is owned by the consuming component, not synced to URL/server state initially. Each table gets a CSV export button using the existing `downloadCsv()` from `ui/src/lib/csv.ts`.

Follow existing component patterns: `cva` variants, `data-slot` attributes, semantic Tailwind tokens, `cn()` class merging. Export from `ui/src/components/index.ts`.

Files to create/change:
- `ui/src/components/ui/data-table.tsx` — reusable `<DataTable>` component
- `ui/src/components/index.ts` — add export
- `ui/src/routes/_layout/_authenticated/_admin/admin.projects.index.tsx` — projects table (new route from #002-02)
- `ui/src/routes/_layout/_authenticated/_admin/admin.contributors.index.tsx` — contributors table (new route from #002-02)
- `ui/src/routes/_layout/_authenticated/_admin/admin.budgets.index.tsx` — budgets audit log table (new route from #002-02)
- `ui/src/routes/_layout/_authenticated/_admin/admin.billings.index.tsx` — billings table (new route from #002-02)
- `ui/src/routes/_layout/_authenticated/_admin/admin.applications.index.tsx` — applications table (new route from #002-02)
- `ui/src/lib/queries.ts` — may need new query keys for table-filtered queries

### Acceptance Criteria
- [ ] `<DataTable>` component created with headless `@tanstack/react-table` integration
- [ ] Supports: column sorting (clickable headers with `aria-sort`), filtering (per-column or global), pagination (page-based for projects/contributors, cursor-based for budgets/billings/applications), column visibility toggle, row selection
- [ ] Projects list renders with sort/filter/paginate
- [ ] Contributors list renders with sort/filter/paginate
- [ ] Budgets audit log renders with sort/filter/cursor-paginate
- [ ] Billings list renders with sort/filter/cursor-paginate
- [ ] Applications list renders with sort/filter/cursor-paginate
- [ ] Each table has a CSV export button
- [ ] Accessible markup: `<table>`, `<thead>`, `<tbody>`, `aria-sort`, `scope="col"`
- [ ] Skeleton loading state while data fetches
- [ ] Empty state with message when no rows match filters
- [ ] Error state with retry
- [ ] Follows existing component patterns (cva, data-slot, semantic Tailwind, cn)
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] `@tanstack/react-table` is already in the root package.json catalog — no install needed. Import from `@tanstack/react-table`.
- [ ] For infinite-scroll tables (budgets, billings, applications), use `useInfiniteQuery` with cursor pagination, not `useReactTable`'s built-in pagination. The TanStack Table `getRowModel()` works with any data source.
- [ ] Column definitions should be typed: `ColumnDef<RowType>[]` imported from `@tanstack/react-table`.
- [ ] The CSV export should export all data matching current filters, not just the visible page.
