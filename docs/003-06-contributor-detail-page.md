# Contributor detail page

### Context
This is a child ticket of #003-budgeting-reporting, blocked by #003-01, #002-07, and #002-02, to add a dedicated contributor detail page. Currently the admin can list contributors and see their cross-project assignments when assigning (#002-05), but there's no single page showing a builder's full picture: profile, all projects, all billings, payment history, onboarding status per project. This page is the admin's primary surface for understanding a contributor's engagement.

### Overview
Create a new admin route at `/admin/contributors/{nearAccount}` with sections:

1. **Builder profile card**: Name, NEAR account (with NEAR wallet explorer link), skills (badges), bio, location, links. From the builders plugin (`contributors.getBuilder`). Editable inline (reuse builder edit form from 003-01 admin contributors section).

2. **Projects table**: TanStack Table showing all projects this builder is assigned to. Columns: project title (linked), role, onboarding status (badge: pending/complete/expired), assigned date. Sortable by title/status. From `assignments.adminList` filtered by builder + projects plugin for project names.

3. **Billings table**: TanStack Table showing all billings against this builder. Columns: proposal ID (linked to Trezu), project name, token, amount, status, date. Sortable by date/amount. Filterable by project. From `billings.adminList` filtered by contributor.

4. **Payment summary**: Total billed (sum of all billings), total paid (sum of billings with approved proposal status), total pending. Quick stats cards at the top.

All data is scoped to the builder's `nearAccount` from the URL param. The page uses TanStack Table components from #002-07 for the tables.

Files to create/change:
- `ui/src/routes/_layout/_authenticated/_admin/admin.contributors.$nearAccount.tsx` — new route
- `ui/src/lib/queries.ts` — add builder detail query options, builder-specific billing query
- `ui/src/components/index.ts` — export any new sub-components

API changes: none needed — the existing endpoints (`contributors.getBuilder`, `assignments.adminList`, `billings.adminList`) already support the necessary filtering. If `assignments.adminList` only filters by `projectId`, add a `contributorId` filter parameter. If `billings.adminList` doesn't filter by `contributorId`, add the filter.

If API changes are needed:
- `api/src/contract.ts` — add optional `contributorId` filter to `assignments.adminList` and `billings.adminList`
- `api/src/index.ts` — implement the filter in handlers

### Acceptance Criteria
- [ ] `/admin/contributors/{nearAccount}` route exists and is linked from the contributors list
- [ ] Builder profile card shows: name, NEAR account (with explorer link), skills, bio, location, links
- [ ] Projects table shows all assigned projects with role, onboarding status, and link to project detail
- [ ] Billings table shows all billings against this builder with project, amount, status, date
- [ ] Payment summary shows: total billed, total paid, total pending
- [ ] Profile data is editable inline (reuse builder edit form)
- [ ] Loading states: skeleton cards for profile, skeleton rows for tables
- [ ] Error states: graceful fallback per section
- [ ] Empty states: "no projects assigned", "no billings"
- [ ] Tables use TanStack Table components from #002-07 (sorting, filtering)
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] The route file uses TanStack Router's splat/dynamic param: `admin.contributors.$nearAccount.tsx`. The `nearAccount` contains dots (e.g., `jane.near`) — ensure the router handles dots in params correctly.
- [ ] If `assignments.adminList` doesn't accept a `contributorId` filter, add it to the contract as `contributorId: z.string().optional()`. The existing handler can filter in-memory from the joined data, or add a WHERE clause.
- [ ] Payment summary: "approved" proposals map to paid. "in-progress" proposals count as pending. The billing status comes from the cached proposal data.
