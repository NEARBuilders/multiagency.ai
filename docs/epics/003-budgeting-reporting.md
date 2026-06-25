# Epic 003: Budgeting & Reporting

### Context

The primary objective is enabling an agency admin to configure projects, contributors (builders), and clients — where clients provide scope and allocations, contributors bill against them, and everyone gets audit trails and reports. See 003-02 notes for seed data instructions. The builders plugin at `plugins/builders/` (registered as `contributors` in `bos.config.json`) provides a richer contributor model (skills, bio, links, location) and replaces the local `agency.contributors` table. The new projects plugin supports `scope` and `result` project kinds and cross-project mentions, enabling a hierarchical project→scope→result model. Clients are external entities linked to projects via a join table, and budget/billing entries are client-scoped. Accepted applications can be converted to builders in one click. A contributor detail page gives admins a full picture of each builder. The client portal lets clients log in and see their projects, budgets, billings, and generate reports — read-only, no admin controls. The report aggregates all of this into a CSV matching the product review template, with KPIs computed automatically from mention relationships.

### Tickets

| # | Ticket | Dependency |
|---|--------|------------|
| 003-01 | Adopt builders plugin for contributors | 001-02 |
| 003-02 | Client model (includes `nearAccountId` for portal auth) | 001-01 |
| 003-03 | Scope and allocations per client (includes billing `client_id`) | 003-01, 003-02 |
| 003-04 | Report generation (reused by admin + client portal) | 003-01, 003-02, 003-03, 002-07, 002-02 |
| 003-05 | Application → builder conversion | 003-01, 002-02 |
| 003-06 | Contributor detail page | 003-01, 002-07, 002-02 |
| 003-07 | Client read-only portal | 003-02, 003-03, 003-04, 002-02, 002-07 |

All tickets in this epic assume the auth modernization from Epic 001 (specifically 001-01) is complete. `requireRole(...)` gates use the better-auth org roles (`admin`, `contributor`, `client`) defined there.

### Acceptance Criteria

- [ ] Builders plugin replaces `agency.contributors` — all contributor operations proxy to the plugin
- [ ] `onboardingStatus` moves to `agency.project_contributors` as a per-assignment field
- [ ] Existing contributor data is migrated to the builders plugin
- [ ] `agency.clients` and `agency.client_projects` tables exist with CRUD API + admin UI
- [ ] `agency.clients` has `nearAccountId` column for portal auth
- [ ] Budget and billing entries optionally reference a client (`client_id` on both tables)
- [ ] Budget and billing views are filterable by client
- [ ] Project `scope` and `result` kinds with mention-based hierarchy (scope mentions parent, result mentions scope)
- [ ] Accepted applications have a one-click "convert to builder" action
- [ ] `/admin/contributors/{nearAccount}` shows builder profile, projects, billings, payment summary
- [ ] Client portal at `/client/` shows dashboard, projects, project detail (read-only), and reports
- [ ] Client portal data is scoped to the client's own projects/budgets/billings
- [ ] Client portal reuses admin components in `readOnly` mode
- [ ] CSV report matches the product review template: overview, KPIs, contributor stats, per-client project breakdown, notes
- [ ] KPIs are computed automatically from mention relationships (scope→result links)
- [ ] Report is reused by both admin and client portal with appropriate data scoping
- [ ] Report CSV is downloadable via the existing `downloadCsv()` pattern
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices
