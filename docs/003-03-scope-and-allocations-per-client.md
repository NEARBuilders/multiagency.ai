# Scope and allocations per client

### Context
This is a child ticket of #003-budgeting-reporting, blocked by #003-01 and #003-02, to add client-scoped budgets and the hierarchical project→scope→result model. Currently budgets are tracked per project + token with no client attribution. Projects are flat — there's no way to break a project into scoped work, track budgets per scope, or deliver results against scopes.

The projects plugin at `plugins/projects/` already has `kind: "scope"` and `kind: "result"` values and a `project_mentions` table for cross-project linking. Mentions are the mechanism: a scope *mentions* its parent project, a result *mentions* the scope it delivers. The mention infrastructure exists for reads (`listMentions`, `listMentionedBy`) but needs a `createMention` endpoint for writes. This ticket adds that, wires it into the agency API, and builds the hierarchical project detail UI.

### Overview

**1. Add `client_id` to `agency.budgets` and `agency.billings`**: New nullable column on both tables referencing `agency.clients(id)`. Budget and billing create endpoints accept optional `clientId`. Audit logs and lists show client column and filter.

**2. Build the hierarchical project model using mentions**:

All entities are projects in the projects plugin — the `kind` field distinguishes their role. Mentions create a strict tree: a scope *mentions* its parent project, a result *mentions* its scope. Read hierarchy bottom-up via `listMentionedBy`, top-down via `listMentions`.

```
Project "Alpha Dashboard"                   kind: project
├── Scope "Design System"                   kind: scope     mentions Alpha Dashboard
│   ├── client: Acme Corp                   (via agency.client_projects)
│   ├── budget: 500 NEAR, 1000 USDC         (via agency.budgets → client_id = Acme)
│   ├── contributors: alice.near, bob.near  (via agency.project_contributors)
│   ├── billings:                           (via agency.billings → client_id = Acme)
│   │   ├── 200 NEAR to alice.near          (proposal #42, approved)
│   │   └── 1000 USDC to bob.near           (proposal #43, in progress)
│   └── Result "Design Tokens v1"           kind: result    mentions Design System
│       └── Result "Button Audit"           kind: result    mentions Design System
│
└── Scope "API Integration"                 kind: scope     mentions Alpha Dashboard
    ├── clients: Acme Corp + Globex Inc     (shared scope)
    ├── budget: 1000 NEAR (client: Acme) + 500 NEAR (client: Globex)
    ├── contributors: carol.near
    ├── billings: 300 NEAR to carol.near    (client: Globex, proposal #44, approved)
    └── Result "API v2"                     kind: result    mentions API Integration
```

**Data relationships:**

| Entity | Stored in | Linked via |
|--------|-----------|------------|
| Project "Alpha" | `projects` plugin | `kind = "project"` |
| Scope mentions parent | `project_mentions` | `sourceId = scope.id`, `targetId = parent.id` |
| Result mentions scope | `project_mentions` | `sourceId = result.id`, `targetId = scope.id` |
| Client ↔ scope | `agency.client_projects` | `project_id = scope.id`, `client_id = client.id` |
| Budget on scope | `agency.budgets` | `project_id = scope.id`, `client_id = client.id` |
| Billing on scope | `agency.billings` | `project_id = scope.id`, `contributor_id`, `client_id` |
| Contributor on scope | `agency.project_contributors` | `project_id = scope.id`, `contributor_id` |

**Budget rollup rules:**

| Level | Computation |
|-------|-------------|
| Scope budget | Sum of `agency.budgets` WHERE `project_id = scope.id` AND `client_id = X` |
| Project total | Sum of all scope budgets |
| Client total (across all projects) | Sum of budgets WHERE `client_id = X` |
| Remaining | Budget - allocated - committed - paid (from existing rollup logic) |
| Available | On-chain treasury balance for the token — cap at remaining |

**UI rendering per scope row:**

| Scope row (collapsed) | Scope row (expanded) |
|---|---|
| Title, client badges, kind badge | All collapsed fields |
| Budget total / spent / remaining | Budget bar with per-client breakdown |
| Contributor count | Contributor list with onboarding status |
| Expand button (▶/▼) | Budget controls (allocate/deallocate) from #002-04 |
| | Billings table (filtered to this scope) |
| | Results sub-table: title, status, deadline |
| | "Add result" button |


**3. Add `createMention` / `deleteMention` to the projects plugin**: The plugin at `plugins/projects/` has `listMentions`/`listMentionedBy` for reads but no write endpoints. Add to the plugin contract:
- `createMention`: POST /v1/projects/{sourceId}/mentions — `{ targetId, targetOwnerId?, targetSlug? }` — creates a mention row
- `deleteMention`: DELETE /v1/projects/{sourceId}/mentions/{targetSlug}/{targetOwnerId} — removes a mention

Gate: `requireAuth` (any authenticated user can create mentions; admin can delete). The agency API proxies these through the plugin client.

**4. Update the project create/edit form for hierarchy**:

| Field | Shown when | Purpose |
|-------|-----------|---------|
| `kind` | Always | Dropdown: project / scope / result |
| `parentProject` | kind = "scope" | Selector: which parent project does this scope belong to? Creates mention on submit. |
| `deliversScope` | kind = "result" | Selector: which scope does this result deliver? Creates mention on submit. |
| `clientIds` | kind = "scope" | Multi-select: which clients are funding this scope? Links via `agency.client_projects`. |

Project create: on submit, after creating the project row, if `parentProject` or `deliversScope` is set, call the mention endpoint to link them.

**5. Build the hierarchical project detail page**:

The project detail page at `/admin/projects/{slug}` gains a hierarchical view:

- **Project header**: title, slug, status, visibility, client badges
- **Scopes section**: TanStack Table listing all scopes that mention this project (`listMentionedBy` filtered by kind). Each scope row shows: title, client, budget total, spent, contributors count, expand button.
- **Expanded scope row**: reveals scope detail inline — budget with allocate/deallocate (from #002-04), billings list (scoped to this scope's project ID), results sub-table.
- **Results sub-table**: `listMentionedBy(scopeId)` filtered by `kind: "result"`. Each result shows title, status, deadline, link.
- **"Add scope" button**: opens project create form pre-filled with `kind: "scope"` and `parentProject` set to the current project.
- **"Add result" button** (on scope rows): opens project create form pre-filled with `kind: "result"` and `deliversScope` set to the scope.

**6. Client-scoped views**: Budget panel on scope rows shows per-client breakdown if the scope has linked clients. Budget create form shows client selector. Billings create form shows client selector for multi-client scopes. Budget audit log and billings list have client filter.

Files to change:
- `plugins/projects/src/contract.ts` — add `createMention`, `deleteMention` endpoints
- `plugins/projects/src/index.ts` — implement mention handlers
- `plugins/projects/src/services/projects.ts` — add mention creation/deletion logic
- `api/src/db/schema.ts` — add `client_id` to `budgets` and `billings` tables
- `api/src/db/migrations/` — new migration
- `api/src/contract.ts` — update budget/billing schemas to include optional `clientId`; expose mention endpoints or proxy through project endpoints
- `api/src/index.ts` — update budget/billing handlers, proxy mention calls, add mention-aware project listing
- `api/src/services/budgets.ts` — add `clientId` to create/deallocate/transfer
- `api/src/services/rollups.ts` — add optional client grouping, hierarchical budget rollup per project
- `ui/src/components/projects-admin-section.tsx` — add `kind`, `parentProject`, `deliversScope`, `clientIds` fields to project form; conditional field visibility
- `ui/src/routes/_layout/_authenticated/_admin/admin/projects.$slug.tsx` — build hierarchical view: scopes table with expand, results sub-table, inline budget controls per scope
- `ui/src/components/budgets-manager.tsx` — add client selector to budget forms, client column in audit log
- `ui/src/lib/queries.ts` — update budget/billing query options with client filter; add mention query options
- `ui/src/lib/format-amount.ts` — no changes needed

### Acceptance Criteria
- [ ] `client_id` column exists on `agency.budgets` and `agency.billings` (nullable)
- [ ] Budget and billing create endpoints accept optional `clientId`
- [ ] Projects plugin has `createMention` and `deleteMention` endpoints with tests
- [ ] Project create form shows `kind` dropdown (project / scope / result)
- [ ] When kind = "scope", form shows `parentProject` selector and `clientIds` multi-select
- [ ] When kind = "result", form shows `deliversScope` selector
- [ ] On submit, mentions are created linking scope→parent and result→scope
- [ ] Project detail page renders hierarchical: scopes table as top-level rows
- [ ] Expanding a scope row shows scope detail (budget with controls, billings, results sub-table)
- [ ] "Add scope" button pre-fills form with parent project
- [ ] "Add result" button on scope row pre-fills form with delivering-scope
- [ ] Budget panel per scope shows per-client breakdown
- [ ] Billings create form shows client selector for multi-client scopes
- [ ] Budgets audit log and billings list show client column and filter
- [ ] Treasury rollup supports optional client filter and hierarchical grouping
- [ ] No breaking changes to existing data (NULL client_id is valid, existing projects are `kind: "project"`)
- [ ] Loading states: skeleton for hierarchical tables, skeleton for expanded rows
- [ ] Empty states: "no scopes defined", "no results for this scope"
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] Scopes and results are created through the standard project create form — no separate editor or form. The `kind` dropdown and conditional `parentProject`/`deliversScope` fields are the only additions. Assume project data already exists.
- [ ] The projects plugin may need the `createMention` / `deleteMention` endpoints tested with the plugin's vitest setup (`plugins/projects/tests/`).
- [ ] Mention creation on project create: fire mention creation after the project row is inserted. If mention creation fails, roll back? Or accept that the project exists without a link (and the admin can fix it). Prefer fire-and-acknowledge — the form can surface errors.
- [ ] The hierarchical tables on the project detail page should use TanStack Table with `getSubRows()` for the nested model — parent = scope, subRows = results.
- [ ] Budget hierarchy: scope budgets sum up to the parent project's total. The rollup service in `api/src/services/rollups.ts` should compute this bottom-up.
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract.
