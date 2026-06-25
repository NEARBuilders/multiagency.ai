# Align API with new projects plugin

### Context
This is a child ticket of #001-tech-debt, blocked by #001-01, to align the agency API with the local projects plugin at `plugins/projects/`. The new plugin introduces:
- New `kind` values: `"scope"` and `"result"` (in addition to `"project"`, `"idea"`)
- Global unique slugs (`projects_slug_unique` index)
- New endpoints: `getProjectBySlug`, `listMentions`, `listMentionedBy`
- New context shape: uses `walletAddress ?? userId` for owner resolution, and `context.user.role` for admin-level actions
- New `project_mentions` table for cross-project linking

The current API uses `proxyCtx(orgAccountId)` which sets `userId: orgAccountId, walletAddress: orgAccountId` but does NOT pass `user.role`. The new plugin uses `context.user.role` for create/update/delete authorization, so the proxy context must include it. The agency API should also expose agency-scoped endpoints for the new project kinds and mention linking.

### Overview
Update `proxyCtx` to include `user.role` and proper `organizationId` from the session context. Update the `UpstreamProject` type derivation to match the new contract shape. Update agency project CRUD endpoints to support `scope` and `result` kinds. Remove the 5-second TTL `daoProjectsCache` — the plugin is now local, not a remote MF bundle with network latency. Remove `nearnListingId` from the agency project type — it's no longer needed since listings are now internal. Add agency endpoints for the new plugin capabilities if needed (mentions, get-by-slug).

Files to change:
- `api/src/index.ts` — update `proxyCtx`, `UpstreamProject` type, `toContractProject` mapper, remove `daoProjectsCache`
- `api/src/contract.ts` — update project schema (add `scope`/`result` kinds, remove `nearnListingId`, add mention endpoints if needed)
- `api/src/db/schema.ts` — check if `agency.listings` needs updates for new kinds
- `api/src/services/listings.ts` — may need updates for new project kinds

### Acceptance Criteria
- [ ] `proxyCtx` includes `user.role` (matching the caller's role) and `organizationId`
- [ ] `UpstreamProject` type matches the new `plugins/projects/src/contract.ts` shape
- [ ] `toContractProject` maps all new project fields correctly
- [ ] Agency project CRUD supports `scope` and `result` kinds
- [ ] `daoProjectsCache` is removed or replaced with a non-TTL-based approach
- [ ] `nearnListingId` is removed from the agency project type
- [ ] Projects plugin calls use `requireOrganization`-gated context (not fabricated `proxyCtx` for org identity — organizationId from session)
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] `proxyCtx` may no longer be needed for org identity since the session now carries `organizationId`. The proxy may only need to set `user.role` and forward `organizationId`/`walletAddress` from the real context.
- [ ] The new plugin's `getProjectBySlug` and mention endpoints may be useful for agency features — consider exposing them in the agency contract.
- [ ] Scopes and results use the same project create form — no separate editor. The `kind` field on the form is the only UI change for project creation. Assume project data is already seeded or created through the standard flow.
