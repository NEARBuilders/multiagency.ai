# Continuous deployment pipeline via GitHub Actions and Railway

### Context
This is a child ticket of #001-tech-debt, to set up and verify the continuous deployment pipeline. The deployment pipeline is continuous via GitHub Actions and a Railway instance with shared ownership.

### Overview
The pipeline already exists: CI runs on every push/PR (`bun typecheck`, `bun lint`, `bun biome ci .`, `bun audit`). Deploy runs `bos publish --deploy` and `railway redeploy` on main merges. Verify this pipeline works after the auth refactor in #001-01. Remove obsolete env vars (`AGENCY_ORG_ACCOUNT_*`). Update `.env.example`. No Dockerfile changes.

### Acceptance Criteria
- [ ] CI passes: `typecheck`, `lint`, `biome`, `audit`
- [ ] Deploy workflow publishes config to FastKV and triggers Railway redeploy
- [ ] Railway deploys successfully with the refactored auth model
- [ ] `.env.example` reflects current required env vars
- [ ] No `AGENCY_ORG_ACCOUNT_*` env vars referenced in deploy configs
- [ ] Dockerfile is out of scope — do not modify
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices
