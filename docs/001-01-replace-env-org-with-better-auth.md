# Replace env-based auth with better-auth organizations, roles, and session identity

### Context
This is a child ticket of #001-tech-debt, to replace three coupled auth patterns with standard better-auth primitives. Currently:

1. **Org identity is env-based**: `getOrgAccountId()` resolves the DAO account from `AGENCY_ORG_ACCOUNT_MAINNET` / `AGENCY_ORG_ACCOUNT_TESTNET` env vars or hardcoded fallbacks in `api/src/lib/default-org-account.ts`. No multi-tenancy.

2. **Role gating is on-chain Sputnik DAO**: Every admin request calls `userInRole(orgAccountId, nearAccountId, roleName)` against the Sputnik DAO contract. The `gates` object (`admin`, `approver`, `requestor`, `operator`, `member`) uses a custom `requireRoles` middleware in `api/src/index.ts`. The `api/src/lib/auth.ts` middleware (`requireOrganization`, `requireRole`) already provides the standard pattern but is unused by the agency API.

3. **NEAR account is resolved via HTTP fetch**: `resolveNearAccountId(reqHeaders)` extracts the session cookie and fetches `${hostUrl}/api/auth/near/list-accounts` to find the user's primary NEAR account. This couples the API to the auth plugin over HTTP, depends on `HOST_URL` env var, and adds latency to every gated request.

The session context already carries `organizationId`, `user.role`, and linked NEAR accounts from better-auth. All three patterns should collapse into the standard `createAuthMiddleware` from `api/src/lib/auth.ts`.

**Role model**: Better-auth org roles control page/API access. DAO roles (`userInRole()` in `sputnik.ts`) remain available as utility functions but are never used for request gating.

| Role | System | Access |
|------|--------|--------|
| `admin` | Better Auth | Full CRUD — create budgets, billings, projects, manage settings, delete |
| `contributor` | Better Auth | Read-only admin — view lists, project detail, no modifications |
| `client` | Better Auth | Read-only portal — scoped to own data (added in 003-07) |
| Admin / Approver / Requestor | Sputnik DAO | On-chain treasury roles — not used for API gating post-refactor |

Load the `better-near-auth` skills for implementation: `siwn` (server-side NEP-413 auth config), `client` (siwnClient setup, authClient.near actions for reading NEAR identity from session), and `tanstack` (auth client as router context singleton). The SIWN auth is configured through the parent host's `bos.config.json` inheritance — the auth plugin running in the host provides the SIWN context.

### Overview
**Org identity**: Replace `getOrgAccountId()` with `context.organizationId`. Update `agency.settings` to key by `organizationId`. Remove `api/src/lib/default-org-account.ts`. Public `/settings` and `/team` endpoints need a fallback when no org is selected — use domain-based default org lookup.

**Role gating**: Remove the `gates` object and `requireRoles` middleware. Replace every `.use(gates.X)` with `.use(auth.requireOrganization).use(auth.requireRole(...))` where `auth = createAuthMiddleware(builder)`. Better-auth org roles control all request gating:

| Old gate | New middleware |
|----------|---------------|
| `gates.admin` | `.use(requireOrganization).use(requireRole("admin"))` |
| `gates.approver` | `.use(requireOrganization).use(requireRole("admin"))` — budget/billing creation is admin only |
| `gates.operator` | `.use(requireOrganization).use(requireRole("admin", "contributor"))` — combined admin + read-only admin access |
| `gates.member` | `.use(requireOrganization).use(requireRole("admin", "contributor"))` — same as operator |
| `gates.requestor` | not directly mapped — `contributor` provides read-only admin access |
| (new) client portal | `.use(requireOrganization).use(requireRole("client")).use(resolveClientId)` — added in 003-07 |

DAO `userInRole()` checks are no longer used for request gating. The `userInRole()` function stays as an available utility in `sputnik.ts`.

**NEAR resolution**: Remove `resolveNearAccountId()` and the `requireSession` middleware. NEAR account identity comes from the session's linked provider accounts — `authClient.near.getAccountId()` on the client, session context on the server. `actorAccountId` and `reviewed_by` fields still need NEAR account — read from session context directly.

Files to change:
- `api/src/index.ts` — remove `gates`, `requireRoles`, `requireSession`, `resolveNearAccountId`, `getOrgAccountId`; use `createAuthMiddleware(builder)` for all gating; read NEAR from session context
- `api/src/lib/auth.ts` — no changes needed (already provides the required middleware)
- `api/src/lib/default-org-account.ts` — remove entirely
- `api/src/lib/settings-defaults.ts` — remove env-based org defaulting, DAO role name constants, and the `requireRoles` default role exports
- `api/src/db/schema.ts` — rename `org_account_id` to `organization_id` in `agency.settings`
- `api/src/db/migrations/` — new migration for the column rename
- `api/src/services/settings-admin.ts` — update to use `organizationId`
- `api/src/services/sputnik.ts` — keep as-is; `userInRole()` stays as available utility, not used for auth gating
- Any service referencing `orgAccountId` — replace with `organizationId`

### Acceptance Criteria
- [ ] `AGENCY_ORG_ACCOUNT_*` env vars are no longer read for auth
- [ ] `defaultOrgAccount()` and `getOrgAccountId()` are removed
- [ ] `gates` object and `requireRoles` middleware are removed
- [ ] All handlers use `auth.requireOrganization` + `auth.requireRole(...)` from `lib/auth.ts`
- [ ] No Sputnik DAO RPC call occurs during auth gating
- [ ] `resolveNearAccountId()` and `requireSession` middleware are removed
- [ ] No HTTP fetch to `/api/auth/near/list-accounts` occurs during request handling
- [ ] NEAR account identity comes from the session's linked provider accounts
- [ ] `actorAccountId` and `reviewed_by` fields still record the acting user's NEAR account
- [ ] Public endpoints (`/settings`, `/team`) work without an organization context
- [ ] `agency.settings` table keys by `organization_id` with a migration
- [ ] `/team` and treasury endpoints still query Sputnik for display data (balances, team roster, proposals)
- [ ] DAO `userInRole()` remains available as a utility — not used for request gating
- [ ] `me.roles()` returns `{ orgRole: "admin" | "contributor" | "client" | null }` from session context
- [ ] `useMeRoles` hook gates on `orgRole` for page access, not DAO roles
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] `requireOrganization` middleware must set `context.user.role` from the active org membership (not global user role). When the session carries an `organizationId`, `requireRole(...)` checks the role on that specific org. The three org roles are `admin`, `contributor`, and `client`.
- [ ] NEAR account identity chain:
  - Session: `context.near?.primaryAccountId` — from the `better-near-auth` SIWN auth plugin (the parent host's siwn provider attaches linked NEAR accounts to the session)
  - Projects plugin: `walletAddress` — pass `primaryAccountId` as `walletAddress` when constructing plugin context
  - DB column: `agency.clients.nearAccountId` — stores NEAR account for client portal lookup via `resolveClientId` middleware
  - Builders plugin: `nearAccount` — the plugin's own natural key, not the same field; map `primaryAccountId` → `nearAccount` when calling the builders plugin
- [ ] Consider creating a helper `requireAgencyRole(...roles)` that wraps both `requireOrganization` and `requireRole` since every gated handler needs both.
- [ ] Update `me.roles()` handler in `api/src/index.ts` to return org role from session context instead of querying DAO: `{ orgRole: context.user.role ?? null }`. The `useMeRoles` hook in `ui/src/hooks/use-me-roles.ts` gates on `orgRole`. `isOperator` becomes a convenience boolean: `orgRole === "admin" || orgRole === "contributor"`. Rename to `canManage` or `isStaff` in a follow-up to drop the DAO-era naming.
- [ ] DAO role utilities (`userInRole`, `getRoles`) stay in `sputnik.ts` for use by treasury/team display handlers. They are not middleware or auth gates.
