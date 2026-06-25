# Client model

### Context
This is a child ticket of #003-budgeting-reporting, to add a client entity model. Clients are external entities that commission work through the agency. They have groups of projects (many-to-many via join table). In a future scope, clients log in with their NEAR account via the client portal (#003-07). For now they are admin-managed records with a `nearAccountId` column ready for portal auth. The admin needs to create clients, link them to projects, and later filter budgets and reports by client.

### Overview
Create two new tables under the `agency` schema:

```
agency.clients
  id            text PRIMARY KEY
  nearAccountId text (optional, for future portal auth — used by #003-07 resolveClientId middleware)
  name          text NOT NULL
  email         text
  contact_info  text (JSON string, optional)
  created_at    timestamp NOT NULL DEFAULT now()
  updated_at    timestamp NOT NULL DEFAULT now()

agency.client_projects
  client_id   text NOT NULL REFERENCES agency.clients(id) ON DELETE CASCADE
  project_id  text NOT NULL
  created_at  timestamp NOT NULL DEFAULT now()
  PRIMARY KEY (client_id, project_id)
```

API endpoints to add to `api/src/contract.ts`:

| Route | Method | Gate | Input | Output |
|-------|--------|------|-------|--------|
| `clients.adminList` | GET | `requireRole("admin", "contributor")` | `{ limit?, cursor? }` | `{ data: Client[], nextCursor }` |
| `clients.adminCreate` | POST | `requireRole("admin")` | `{ name, nearAccountId?, email?, contactInfo? }` | `{ client: Client }` |
| `clients.adminUpdate` | PATCH | `requireRole("admin")` | `{ id, name?, nearAccountId?, email?, contactInfo? }` | `{ client: Client }` |
| `clients.adminDelete` | DELETE | `requireRole("admin")` | `{ id }` | `{ deleted: true }` |
| `clients.linkProject` | POST | `requireRole("admin", "contributor")` | `{ clientId, projectId }` | `{ ok: true }` |
| `clients.unlinkProject` | DELETE | `requireRole("admin", "contributor")` | `{ clientId, projectId }` | `{ ok: true }` |
| `clients.listForProject` | GET | `requireRole("admin", "contributor")` | `{ projectId }` | `{ data: Client[] }` |
| `clients.listProjects` | GET | `requireRole("admin", "contributor")` | `{ clientId }` | `{ data: { id, slug, title }[] }` |

Admin UI:
- New `/admin/clients` route — list with create/inline-edit forms (follow existing `contributors-admin-section` pattern)
- Client multi-select on the project create/edit form (add `clientIds` field)
- Client badges on project detail page showing linked clients with unlink button

Files to create/change:
- `api/src/db/schema.ts` — add `clients` and `client_projects` tables
- `api/src/db/migrations/` — new migration
- `api/src/contract.ts` — add client endpoints
- `api/src/index.ts` — implement client handlers
- `ui/src/routes/_layout/_authenticated/_admin/admin.clients.index.tsx` — new admin route
- `ui/src/components/projects-admin-section.tsx` — add client multi-select to project form
- `ui/src/routes/_layout/_authenticated/_admin/admin/projects.$slug.tsx` — show linked clients with unlink
- `ui/src/lib/queries.ts` — add client query options
- `ui/src/components/index.ts` — export any new components

### Acceptance Criteria
- [ ] `agency.clients` and `agency.client_projects` tables exist with migration
- [ ] Client CRUD API endpoints work (create, read, update, delete)
- [ ] Link/unlink project endpoints work
- [ ] Admin can view client list at `/admin/clients`
- [ ] Admin can create, edit, and delete clients
- [ ] Project create/edit form includes client multi-select
- [ ] Project detail page shows linked clients with unlink button
- [ ] Clients can be linked to multiple projects (M:N)
- [ ] Projects can be linked to multiple clients
- [ ] Deleting a client cascades to remove join table rows (does not delete projects)
- [ ] Loading, empty, and error states for all client UIs
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] Follow existing component patterns: inline create form toggle ("+ new client" button), expandable edit form with `useEffect` re-sync, `useMutation` + toast for mutations.
- [ ] The project form client selector should be a multi-select dropdown or tag input. If no existing multi-select component exists, use checkboxes or a simple `select[multiple]`.
- [ ] Client deletion should warn if linked to active projects (confirmation dialog).
- [ ] **Seed data**: Seed the database early with test data: 2 clients (Acme Corp, Globex Inc), 3 builders (alice.near, bob.near, carol.near), and 4 projects with scopes/results linked via mentions. Development flows depend on having data to render from the start. Create these records as part of the migration or a seed script.
