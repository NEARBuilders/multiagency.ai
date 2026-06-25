# Report generation

### Context
This is a child ticket of #003-budgeting-reporting, blocked by #003-01, #003-02, #003-03, #002-02, and #002-07, to build the CSV report generator matching the product review template. The report aggregates projects, contributors (builders), payments (billings), and spend across clients. KPIs are computed automatically from project data. The report uses TanStack Table for data display (via #002-07) and CSV export via the existing `downloadCsv()` utility. The report page is reused by both admin (#003-04) and the client portal (#003-07) — it accepts an optional `clientId` to auto-scope when rendered for a client. It is the deliverable that closes the budgeting & reporting epic — everything configured in the prior tickets feeds into this report.

### Overview
The report template from the product review:

```
## Overview
- Reporting period: [start] → [end]
- Prepared by: [admin name]
- Summary: [auto-generated or manual]
- Website: [from runtime config]

## KPIs
### First-Time Accuracy
- Goal: >75%
- Current: [computed: % of scope projects that transitioned to result without re-scope]
- How we measured current: [generated description]

### On-Time Sprint Delivery (Velocity)
- Goal: >85%
- Current: [computed: % of projects/scope completed within deadline]
- How we measured current: [generated description]

## Contributor onboarding
- # contributors onboarded (cumulative): [total builders with onboarding_status = complete]
- # contributors onboarded (this period): [builders onboarded in date range]
- Notes:

## Projects
https://multiagency.ai/work

## Project Breakdown (per client)
[Client Name]
  [Project Title] — Budget: [scope total], Spent: [billings], Status: [status]
    [Scope Title] — Budget: [total], Spent: [billings], Contributors: [count]
      Results: [count], On-time: [Y/N]
    ...

## Notes / risks / blockers
```

Create an admin page at `/admin/reports` with:
1. **Filters bar**: date range picker (start/end), client multi-select, project multi-select
2. **Preview**: TanStack Table showing the report data grouped by client
3. **Download button**: generates and downloads the CSV

The report data is aggregated server-side via a new API endpoint `reports.generate` that accepts filter params and returns structured data. This keeps heavy aggregation out of the client.

API endpoint:
```typescript
reports.generate
  method: POST
  input: { startDate?, endDate?, clientIds?: string[], projectIds?: string[] }
  output: {
    overview: { period, preparedBy, summary, website }
    kpis: { firstTimeAccuracy: { goal, current, methodology }, onTimeDelivery: { goal, current, methodology } }
    contributors: { totalOnboarded, onboardedThisPeriod, notes }
    clients: [{ name, projects: [{
      title, slug, kind, status, budget, spent, contributorCount,
      scopes: [{ title, slug, budget, spent, contributorCount, resultCount }]
    }] }]
  }
```

Gate: `requireRole("admin", "contributor", "client")`.

When called by a client (via `resolveClientId` middleware from #003-07), the handler reads `context.clientId` and auto-scopes all data to that client. Admins and contributors pass an optional `clientId` filter in the request body.

Files to create/change:
- `api/src/contract.ts` — add `reports.generate` endpoint
- `api/src/index.ts` — implement report handler
- `api/src/services/reports.ts` — new service: aggregation logic
- `ui/src/routes/_layout/_authenticated/_admin/admin.reports.index.tsx` — new admin route
- `ui/src/lib/queries.ts` — add report query options
- `ui/src/lib/csv.ts` — may need report-specific CSV formatter

### Acceptance Criteria
- [ ] `/admin/reports` page exists with date range, client, and project filters
- [ ] Report preview renders data grouped by client using TanStack Table
- [ ] Download button generates and downloads a CSV file
- [ ] CSV matches the report template: Overview, KPIs, Contributors, Projects with scope breakdown per client
- [ ] KPIs are computed automatically from mention relationships (see #003-03):
  - First-time accuracy: % of scopes whose results directly mention them (no intermediate scope revisions)
  - On-time delivery: % of scopes with at least one result created before the scope's listing deadline
- [ ] Contributor stats: cumulative onboarded, onboarded in period
- [ ] Per-client project breakdown shows hierarchical: project → scopes (budget, spent, contributors) → result count per scope
- [ ] Filtering works: date range limits to billings/budgets in range; client/project filters limit scope
- [ ] Loading state while report data fetches
- [ ] Error state if aggregation fails
- [ ] Empty state if no data matches filters
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] KPI computation relies on mention relationships from #003-03: scopes mention their parent project, results mention their scope. Use `listMentionedBy(scopeId)` filtered by `kind: "result"` for scope results. Use `listMentionedBy(projectId)` filtered by `kind: "scope"` for project scopes.
- [ ] "Deadline" for on-time delivery: use the scope's internal listing `deadline` field. If no listing exists, use scope `createdAt` + a configurable expected duration.
- [ ] The report CSV should use the existing `toCsv()` and `downloadCsv()` utilities from `ui/src/lib/csv.ts`. The report's structured format (sections with headers) may need a custom CSV builder that handles multi-section output.
- [ ] The "Prepared by" field can read from the session user's name. The "Summary" can be auto-generated from the data or left as a manual textarea override before download.
