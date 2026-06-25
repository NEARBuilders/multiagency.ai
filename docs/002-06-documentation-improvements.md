# Documentation improvements

### Context
This is a child ticket of #002-ux-improvements, to improve documentation for demo-readiness. Currently the docs system fetches markdown from an external assets URL. The doc registry in `ui/src/lib/docs-registry.ts` defines 6 entries across two sections (operating model + integration skills). For a demo, the docs need to clearly explain the agency operating model, admin workflow, and how to use the dashboard. Legible docs are part of the demo.

### Overview
Update documentation content and structure:
1. **Doc content**: Improve the markdown content for existing doc pages — ensure they are clear, accurate, and up-to-date with the current product. Content lives externally (fetched from assets URL), so changes must be made at the source. Determine where the content is hosted and update it.
2. **New doc**: Add an "Admin Guide" doc entry explaining the admin workflow — how to add projects, manage contributors, set budgets, create billings, and review applications. Link it from the admin shell.
3. **Doc registry**: Update `docs-registry.ts` with the new entry and any changed slugs/descriptions.
4. **Doc styling**: Verify `react-markdown` rendering looks good (headings, tables, code blocks, links). Fix any styling issues.
5. **Footer / landing**: Update the landing page footer docs link and any inline documentation references.

Files to change:
- `ui/src/lib/docs-registry.ts` — add new admin guide entry, update existing entries
- `ui/src/routes/_layout/index.tsx` — verify docs footer link
- `ui/src/routes/_layout/docs/$slug.tsx` — verify markdown rendering for new content types
- `ui/src/routes/_layout/_authenticated/_admin.tsx` — may add a docs link in the admin shell
- External: markdown source files at the assets URL (content update)

### Acceptance Criteria
- [ ] All existing doc pages have clear, accurate content
- [ ] New "Admin Guide" doc entry exists in the registry
- [ ] Admin guide explains: projects, contributors, budgets, billings, applications workflows
- [ ] Doc pages render correctly (headings, lists, tables, code, links)
- [ ] Internal links in docs use SPA navigation (not full page reload)
- [ ] External links open in new tab with `rel="noopener noreferrer"`
- [ ] Landing page footer docs link works
- [ ] Admin shell has a link to the admin guide
- [ ] `bun typecheck` and `bun lint` pass
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
- [ ] Must follow TanStack Router best practices (prefetch data in `loader` rather than `beforeLoad`, use `router.invalidate()` after mutations)
- [ ] Must follow TanStack Query best practices (use `queryOptions` from `@/lib/queries`, optimistic updates where appropriate, proper cache invalidation after mutations)
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] Determine where markdown content is hosted. The loader fetches from `${assetsUrl}/${doc.source}/${slug}.md`. Check `assetsUrl` in runtime config — it may come from a CDN or static file server.
- [ ] If you control the content source, update markdown files directly. If not, create a local fallback mechanism or document the update process.
- [ ] Consider whether some docs should be co-located in the repo (e.g., in `ui/public/docs/`) rather than fetched externally — this would simplify updates and remove the external dependency.
