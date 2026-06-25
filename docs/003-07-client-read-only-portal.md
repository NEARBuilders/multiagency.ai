# Client read-only portal

### Context
This is a child ticket of #003-budgeting-reporting, blocked by #003-02, #003-03, #003-04, #002-02, and #002-07, to add a client-facing portal. A client signs in via NEAR SIWN with `role: "client"` on the agency organization. The portal is read-only — clients can view their projects, budgets, billings, and generate reports, but cannot modify anything. It reuses admin components in a read-only mode, scoped to the client's own data. This ticket completes the budget visibility loop: admin allocates funds, client sees where the money went.

### Overview

**Auth model**: The session carries `organizationId` + `user.role = "client"` (a better-auth org role, not a DAO role). A new middleware `resolveClientId` maps `nearAccountId` (from session's linked provider accounts) to `agency.clients.nearAccountId` to get the `clientId`. All queries auto-scope to that `clientId`.

**Pre-work** (should already exist from prior tickets):
- `agency.clients` has `nearAccountId` column (#003-02)
- `requireRole("client")` gate exists in the auth middleware (#001-01 — the gate migration table in 001-01 shows the client portal pattern: `.use(requireOrganization).use(requireRole("client")).use(resolveClientId)`)
- `agency.budgets` and `agency.billings` have `client_id` (#003-03)
- Report supports client scoping (#003-04)
- TanStack Table components exist (#002-07)

**Client routes** (all gated by `requireRole("client")` + `resolveClientId`):

| Route | Content |
|-------|---------|
| `/_client.tsx` | Client shell layout — minimal nav: Dashboard, Projects, Reports. No admin sidebar. Reads `resolveClientId` middleware result to get `clientId`. |
| `/client/` | Dashboard: stats cards (active projects count, total budget allocated, total spent, remaining). Quick links to projects and reports. |
| `/client/projects` | TanStack Table — projects linked to this client. Columns: title, kind, status, budget total, spent, remaining. Sortable. Click → project detail. Same `<DataTable>` as admin, filtered to `clientId`. |
| `/client/projects/{slug}` | Project detail — view only. Shows project info, budget breakdown, billings, contributors. **No** create/edit/delete buttons. **No** budget allocate form. **No** billing create form. Reuses the admin project detail component in a `readOnly` mode. |
| `/client/reports` | Same report page from #003-04. Filters auto-scoped to the client's projects. Same CSV download. |

**Read-only component pattern**: Admin components accept a `readOnly?: boolean` prop. When set:
- Create/edit buttons are hidden
- Form inputs are rendered as plain text
- Delete buttons are hidden
- The budget display and billing list still render, just without controls

**API changes**: A `resolveClientId` middleware that runs after auth middleware on client routes:
```typescript
const resolveClientId = builder.middleware(async ({ context, next }) => {
  const nearAccountId = context.near?.primaryAccountId;
  if (!nearAccountId) {
    throw new Error("NEAR account not linked. Link a NEAR wallet to access the client portal.");
  }
  const client = await db.query.clients.findFirst({
    where: eq(clients.nearAccountId, nearAccountId),
  });
  if (!client) {
    throw new Error(`No client record found for NEAR account ${nearAccountId}. Contact your agency admin.`);
  }
  return next({ context: { ...context, clientId: client.id } });
});
```

Existing endpoints that accept optional `clientId` filter (from 003-03): `billings.adminList`, `budgets.adminList`, `treasury.getRollups`. Add client scoping to `agency.projects.list` or use the projects plugin filtered by the projects linked to the client.

Files to create/change:
- `ui/src/routes/_client.tsx` — client shell layout with minimal nav
- `ui/src/routes/client/index.tsx` — client dashboard
- `ui/src/routes/client/projects.tsx` — client projects list
- `ui/src/routes/client/projects.$slug.tsx` — client project detail (read-only)
- `ui/src/routes/client/reports.tsx` — client reports (reuses 003-04 report page)
- `ui/src/components/shell.tsx` — may need a `ClientShell` variant or a `Shell` variant prop
- `api/src/index.ts` — add `resolveClientId` middleware, client-scoped endpoint variants, read-only enforcement
- `api/src/contract.ts` — add client-scoped endpoints if needed
- `ui/src/lib/queries.ts` — add client-scoped query options (always pass clientId)
- Various admin components — add `readOnly` prop support

### Acceptance Criteria
- [ ] Client signs in via NEAR SIWN and lands on the client dashboard
- [ ] Client shell has minimal nav: Dashboard, Projects, Reports
- [ ] Client dashboard shows stats: active projects, budget, spent, remaining
- [ ] Client projects list shows only their linked projects with budget/spent columns
- [ ] Client project detail is read-only: no create/edit/delete buttons, no budget forms, no billing forms
- [ ] Client report page shows the same report as #003-04, auto-scoped to client
- [ ] All client data is scoped to their `clientId` — cannot see other clients' data
- [ ] Admin routes are inaccessible to clients (FORBIDDEN)
- [ ] Client routes are inaccessible to unauthenticated users (UNAUTHORIZED)
- [ ] Client shell is visually distinct from admin shell (minimal, no admin-only links)
- [ ] Admin components support `readOnly` mode
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] The `readOnly` prop approach is simpler than duplicating components. Add `readOnly?: boolean` to project detail, budget display, billing list, and any other shared admin component.
- [ ] Client routes live at `/client/...`, not under `/_layout/_authenticated/_admin/`. They use their own layout (`_client.tsx`) with a different gate.
- [ ] The `resolveClientId` middleware should cache the client ID on the context to avoid re-querying on every handler.
- [ ] Consider a shared `ClientLayout` component that both `_client.tsx` and potential future builder portal use.
