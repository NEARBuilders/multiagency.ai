<!-- intent-skills:start -->
# Skill mappings - load `use` with `npx @tanstack/intent@latest load <use>`.
skills:
  - when: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
    use: "@tanstack/devtools#devtools-app-setup"
  - when: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
    use: "@tanstack/devtools#devtools-marketplace"
  - when: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
    use: "@tanstack/devtools#devtools-plugin-panel"
  - when: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
    use: "@tanstack/devtools#devtools-production"
  - when: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
    use: "@tanstack/devtools-event-client#devtools-bidirectional"
  - when: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
    use: "@tanstack/devtools-event-client#devtools-event-client"
  - when: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
    use: "@tanstack/devtools-event-client#devtools-instrumentation"
  - when: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
    use: "@tanstack/router-plugin#router-plugin"
  - when: "Load environment variables from a .env file into process.env for Node.js applications. Use when configuring apps with secrets, setting up local development environments, managing API keys and database uRLs, parsing .env file contents, or populating environment variables programmatically. Always use this skill when the user mentions .env, even for simple tasks like \"set up dotenv\" — the skill contains critical gotchas (encrypted keys, variable expansion, command substitution) that prevent common production issues."
    use: "dotenv#dotenv"
  - when: "Use dotenvx to run commands with environment variables, manage multiple .env files, expand variables, and encrypt env files for safe commits and CI/CD."
    use: "dotenv#dotenvx"
  - when: "Build every-plugin modules with oRPC contracts, Effect services, and Module Federation. Use when creating or modifying plugins under plugins/ or the _template scaffold."
    use: "every-plugin#plugin-development"
  - when: "Test every-plugin modules with vitest and the plugin runtime. Use when writing or modifying plugin tests under plugins/*/src/__tests__/ or plugins/*/tests/."
    use: "every-plugin#plugin-testing"
  - when: "Development workflow for everything-dev projects using bos dev, bos start, and the Module Federation runtime. Use when starting dev servers, debugging hot reload, or understanding the service-descriptor architecture."
    use: "everything-dev#dev-workflow"
  - when: "Publish bos.config.json to the FastKV registry, sync from upstream, and upgrade workspace packages. Use when deploying, syncing, or managing runtime configuration across projects."
    use: "everything-dev#publish-sync"
<!-- intent-skills:end -->

# Agent Instructions

Operational guidance for AI agents working on the **Agency Dashboard Template** repo (maintained by [MultiAgency](https://github.com/MultiAgency); built on the [everything.dev](https://github.com/NEARBuilders/everything-dev) runtime, scaffolded via `bos init`). The repo is a customizable template for on-chain agencies — downstream operators instantiate it via `bunx everything-dev init`, not by forking. Same routes for everyone — `/`, `/work`, `/team`, `/treasury`, `/docs`, plus three intake forms (`/apply` for contributors, `/register` for founders, `/contact` for clients) — with operator-only sections (Manage Projects, Budgets, Contributors, Applications Inbox, Billings, Proposals) revealed inline on the matching public route when the signed-in NEAR account holds an operator role on the DAO. The `payouts` surface is a tab on `/treasury` (no standalone route). `/admin/projects/$slug` is the only deep-admin route; `/admin/settings` lets a DAO admin edit operational identity (nearnAccountId, urls, description, contactEmail); `orgAccountId` is read-only there (env-driven — change by editing `AGENCY_ORG_ACCOUNT_*` and restarting). Agency identity has three layers: brand identity (`name`/`headline`/`tagline`) is hardcoded; operational identity is admin-editable via `/admin/settings` with env-var fallbacks (`AGENCY_*`); Sputnik role names are env-only to avoid self-lockout. Multi-tenant per-user settings is v2. Verify what exists in `ui/src/routes/` and `api/src/contract.ts` before assuming a surface is missing.

## Quick Reference

**Start Development:**
```bash
cp .env.example .env   # First time only
bun install
bun run db:migrate     # Apply API migrations (one-time per fresh checkout)
bun run dev
```

**Publish:**
```bash
bos publish           # Publish config to the FastKV registry
bos publish --deploy  # Build/deploy all workspaces, then publish
```

## Architecture

This is a **Module Federation monorepo** with runtime-loaded configuration. The host is **remote** — it is not in this repository. You only work on `/ui` and `/api` (plus any plugins).

```
┌─────────────────────────────────────────────────────────┐
│                    Host (Remote)                        │
│  - Hono.js + oRPC router                               │
│  - Runtime config loader (bos.config.json)              │
│  - Module Federation host                               │
│  - every-plugin runtime                                │
└─────────────────────────────────────────────────────────┘
            ↓                         ↓
┌───────────────────────┐ ┌───────────────────────┐
│    UI (Local)         │ │    API Plugin (Local)  │
│  - React 19           │ │  - every-plugin        │
│  - TanStack Router    │ │  - oRPC contract        │
│  - Module Federation  │ │  - Effect services     │
└───────────────────────┘ └───────────────────────┘
```

The host loads UI and API at runtime from URLs in `bos.config.json`. No rebuild is needed when URLs change.

### Runtime Config

All runtime configuration lives in `bos.config.json`. The UI reads `window.__RUNTIME_CONFIG__` to get account, gateway, API base URL, etc.

Use these helpers from `@/app`:
- `getAppName()` — active runtime title (falls back to account)
- `getAccount()` — NEAR account from config
- `getRepository()` — repository URL from config
- `getActiveRuntime()` — active runtime info (accountId, gatewayId, title)
- `getRuntimeConfig()` — full client config

## Architectural Decisions (v1)

Load-bearing facts for any agent making changes. Each decision: **Rule / Why / How to apply / Anchors.**

### DAO-canonical role gating

**Rule.** Server gates resolve role names via `defaultAdminRoleName()` / `defaultApproverRoleName()` / `defaultRequestorRoleName()` (in `api/src/lib/settings-defaults.ts`) — `AGENCY_ADMIN_ROLE` / `AGENCY_APPROVER_ROLE` / `AGENCY_REQUESTOR_ROLE` env vars with hardcoded fallback `Admin` / `Approver` / `Requestor`. The DAO's `get_policy` is the single source of truth.

**Why.** Agencies may use Trezu's role names (default) or raw Sputnik's `all`/`council`. Overrides set via env at deploy time; no DB row, no UI in v1. Chain stays authoritative; client-side gating is advisory.

**How to apply.** Pick the gate matching the surface intent:
- `gates.admin` — governance (applications.adminUpdate, contributors.adminCreate/Update)
- `gates.approver` — financial *writes* (budgets writes, billings.adminCreate)
- `gates.operator` — Admin OR Approver — most operational ops (lists, project create/update, assignments, nearn reads) AND financial *reads* (treasury.getBalances, treasury.getRollups, projects.getBudget — Admin needs treasury visibility to make governance decisions even without write authority)
- `gates.member` — Admin OR Approver OR Requestor — member-internal reads (projects.adminList)
- `gates.requestor` — strict, symmetric; no current consumer (forward-scaffolding)

Apply via `builder.<name>.use(gates.<key>).handler(...)`. Ad-hoc compositions: `requireRoles([...])`. For mixed gating (role check OR project assignment), `requireSession` + inline check — see `agency.projects.adminGet`. Requestor-tier writes (filing payment requests) live on NEARN/Trezu, not here.

**Anchors.** `requireRoles` factory and `gates` registry in `api/src/index.ts`; `userInRole` in `api/src/services/sputnik.ts`.

### Treasury = Sputnik DAO contract

**Rule.** The agency's identity is `orgAccountId` — any NEAR account, resolved per request via `getOrgAccountId(reqHeaders)` (env-driven through `defaultOrgAccount(network)`). When that account is a Sputnik DAO subaccount (`isSputnikDao(orgAccountId)` true — suffix matches `.sputnik-dao.near` / `.sputnikv2.testnet`), the same account doubles as the treasury: funds custody + governance, one onchain contract. Reads through `services/sputnik.ts` (which expects a DAO). Agencies using a non-DAO `orgAccountId` configure their identity at upstream but get no treasury features.

**Why.** Decouples agency identity from treasury implementation. Top-level NEAR accounts (e.g., `multiagency.near`) yield globally-unique prefixes for upstream's `organizationId` tag; Sputnik subaccounts yield prefixes unique within the factory. Trezu is a sibling UI for Sputnik DAOs only; dashboard observes via NEAR RPC. Trezu has no public REST API.

**How to apply.** One `orgAccountId` per network per agency — agencies in multi-network deployments operate a mainnet account *and* a testnet account in parallel (see "Multi-network resolution"), each independently a DAO or non-DAO. For DAO features (treasury, roles), the operator picks Sputnik subaccount(s) on the relevant network(s). Reads go through `services/sputnik.ts` whose parameter names stay `daoAccountId` (they require a DAO); callers pass `orgAccountId` and accept that those calls only work when `isSputnikDao(orgAccountId)` is true. Don't model treasury state locally.

**Anchors.** `getOrgAccountId` in `api/src/index.ts`; `defaultOrgAccount` in `api/src/lib/default-org-account.ts`; `isSputnikDao` in `services/sputnik.ts`; `services/sputnik.ts` (DAO-specific reads).

### Projects live upstream; NEARN linkage is the local `listings` cache

**Rule.** Project rows live in NEARBuilders/everything-dev's `projects` plugin, accessed via `pluginsClient.projects(...)`. The dashboard does not own `agency.projects`. Per-project state authored in this template lives in `agency.listings`, keyed to upstream's project id with `source` discriminating `'nearn' | 'internal'`. NEARN-sourced rows cache the bounty payload (read-only canonical, lazy-refresh on stale read); internal-sourced rows are reserved for DAO-authored listings (future).

**Why.** Aligns with the four-system division (dashboard indexes, doesn't author project rows). Lets NEARN data survive nearn.io downtime via the local cache. Unifies "NEARN listing" and future "internal listing" under one `Listing` shape at the contract layer.

**How to apply.** Read project metadata via `plugins.projects(proxyCtx(orgAccountId)).listProjects/getProject` (always pass ctx so private DAO projects come through). Look up NEARN data via `getListingForProject(projectId, "nearn", db)` from `services/listings.ts` — handles lazy refresh and 404→archived transitions. Never write to `agency.listings` directly for NEARN rows; go through `attachNearnListing` / `detachNearnListing`.

**Anchors.** `services/listings.ts`; `agency.listings` schema; `proxyCtx` + `fetchOrgProjects` helpers in `api/src/index.ts`.

### Proxy upstream calls as the organization identity, never the operator

**Rule.** Every `plugins.projects(...)` call uses `proxyCtx(orgAccountId)` for ownership context — sets upstream's `userId` / `walletAddress`, which upstream uses to derive each project row's `ownerId`. The upstream `organizationId` input/filter is the full `orgAccountId` itself; no derivation. Never proxy as the operator's `nearAccountId`. The only exception is the public `list` handler, which calls `plugins.projects()` with no context and an explicit `visibility: "public"` filter.

**Why.** Upstream's `canEditProject` matches strictly on `ownerId === userId`; there is no concept of organization membership at the plugin layer. If operators proxied as themselves, only each project's original creator could edit it — multi-operator DAOs would break. Proxying as the org makes every project `ownerId = organizationId`, so any DAO operator can edit any DAO project, and upstream's `(ownerId, slug)` slug-uniqueness becomes the org-scoped constraint we actually want. Using the full `orgAccountId` rather than a derived prefix means testnet and mainnet DAOs land in distinct upstream namespaces by construction — the `.testnet` / `.near` suffix carries network identity, so cross-network collision is impossible.

**How to apply.** Use `proxyCtx(orgAccountId)` for the context, `orgAccountId` directly for the `organizationId` input/filter. Strict-equality guards on returned rows: `result.data.organizationId !== orgAccountId` throws `NOT_FOUND`. Per-operator audit lives locally in `agency.budgets.actorAccountId` and `agency.billings.actorAccountId` — upstream sees only "the org did it."

**Anchors.** `proxyCtx` + `requireProjectInOrg` in `api/src/index.ts`; SPEC's "Schema change (projects move upstream)" section.

### Project description is member + contributor context, not public

**Rule.** `projects.description` is admin-internal "notes". Returned by `projects.adminGet` to DAO members (any tier) and contributors assigned to the project. The public `agency.projects.list` returns `publicProject` shape which omits `description`.

**Why.** Deep public narrative lives on NEARN. Local description is fallback for member/contributor view, not public listing.

**How to apply.** Gate admin detail with `requireSession` + inline check admitting any of the three DAO roles OR a matching contributor assignment. Don't add a public single-project route without revisiting public surface posture.

**Anchors.** `agency.projects.adminGet`, `publicProject` in `api/src/contract.ts`.

### Contributors are agency-internal vendor records

**Rule.** `nearAccountId` nullable (support pre-NEARN tracking for legal/compliance). `name` required; `email` optional. Dashboard owns `onboardingStatus` (pending/complete/expired) regardless of NEARN linkage. Compliance documents themselves (tax forms, contracts) live in the operator's existing systems — status tracking only.

**Why.** When `nearAccountId` is populated, NEARN is canonical identity; until then the local row is source of truth. PII storage stays out of the dashboard.

**How to apply.** Don't add compliance document storage. Keep `onboardingStatus` as the only lifecycle field; PII pointers stay external.

**Anchors.** `contributors` table in `api/src/db/schema.ts`.

### No duplication of NEARN/Trezu features

**Rule.** If NEARN or Trezu (= Sputnik DAO via Trezu's UI) already provides a feature, the dashboard links out or fetches; it does not reimplement.

**Why.** The dashboard is an observability + planning layer over four systems. Duplicating financial-action or marketplace surfaces creates parallel state machines and reconciliation bugs.

**How to apply.** Before adding any write surface, ask: does Sputnik (via Trezu) or NEARN already do this? If yes, link out.

**Anchors.** Produces the project/contributor overlay shapes above and the billings pointer-only design below.

### Dashboard reads treasury balance from chain

**Rule.** Budget rollups sanity-check against live treasury holdings (NEAR + FT balances on the DAO account, fetched via NEAR RPC). Cache TTL follows the `get_policy` pattern. UI surfaces explicit warning when sum of budgets exceeds treasury balance per token. Note: `budgeted` (sum of `budgets` rows) and `allocated` (active NEARN listing reward, NEARN-derived) are distinct stages in the rollup model — see SPEC's "Target rollup model" — and this rule is about the budgeted side.

**Why.** Stored treasury copy = stale on every transfer; we'd reimplement Sputnik's accounting badly.

**How to apply.** Use `services/sputnik.ts` for chain reads. Don't add a `treasuryCache` table.

**Anchors.** `services/sputnik.ts.getTreasuryBalances`; `get_available_amount` DAO contract method.

### Treasury tokens are discovered via FastNEAR's account-ft indexer

**Rule.** `getDaoTokenIds(orgAccountId)` calls FastNEAR's `/v1/account/{id}/ft` endpoint (mainnet `api.fastnear.com`, testnet `test.api.fastnear.com`), filters out zero-balance entries, and prepends `"near"`. Cached 60s with stale-while-error on failure. `KNOWN_TOKENS` is a metadata-only registry — icon, symbol, decimals, display name; unknown FTs (no registry entry) fall back to on-chain `getFtMetadata(contractId, ownerAccountId)`.

**Why.** Sputnik has no view method for FT inventory, but FastNEAR's indexer answers "what FTs does this account currently hold?" in a single REST call. This reflects actual holdings (including tokens received via direct `ft_transfer`, not just Sputnik Transfer proposals) and avoids the cold-start gap of proposal-history-based discovery — `/treasury` shows the full token list on first load. Aligns with [Trezu's primary discovery path](https://github.com/NEAR-DevHub/trezu/blob/main/nt-be/src/handlers/balance_changes/token_discovery.rs); Trezu additionally scans transaction receipts and the NEAR Intents multi-token contract for completeness, which we don't need for v1.

**How to apply.** Don't add tokens to `KNOWN_TOKENS` just to query their balance — FastNEAR discovers them automatically once the DAO holds a positive balance. Add to `KNOWN_TOKENS` only when you want a curated icon/display name. Each entry carries `chainNetwork: "mainnet" | "testnet"`; `tokens.list` rejects known entries whose `chainNetwork` differs from the DAO's network and falls through to on-chain `ft_metadata`, so a mainnet DAO holding a contract literally named `wrap.testnet` shows the real mainnet metadata rather than leaking the testnet entry's "(testnet)" label. Limitation: FT holdings on `intents.near` (NEAR Intents multi-token contract) are not surfaced — if an agency needs that, add a sibling indexer call.

**Anchors.** `services/sputnik.ts.getDaoTokenIds`, `fetchAccountFtHoldings`, `getFtMetadata`; `services/tokens.ts.KNOWN_TOKENS`, `getTokenMetadata`; `tokens.list` handler in `api/src/index.ts` (the chainNetwork-vs-orgNetwork check).

### FT operations follow the owner's network, not the contract's account name

**Rule.** `getFtMetadata(contractId, ownerAccountId)` and `fetchFtBalance(ownerAccountId, contractId)` both pass the *owner* account to `rpcCall` for RPC URL inference. The contract account name is a string, not a network marker.

**Why.** Contract account suffixes look like network labels but aren't. A mainnet account can literally be named `wrap.testnet` (or `foo.testnet`, or any other `.testnet`-suffixed string); it's still a mainnet contract. A DAO can only hold tokens whose contracts live on its own network — so the owner's network is the only reliable signal for which RPC handles the call. Suffix-based routing of the contract account misrouted `ft_balance_of` to testnet for a mainnet DAO whose proposal history referenced `wrap.testnet`, surfacing as a phantom balance card on the treasury page.

**How to apply.** Every new FT view-call helper takes the owner account as a parameter and routes through it. The `ftMetadataCache` key is compound `${owner}::${contract}` so the same contract account name on two networks doesn't collide. Don't reintroduce contract-suffix routing for any chain call whose semantics are owned by an account on a different chain — when in doubt, route by the consumer's account.

**Anchors.** `services/sputnik.ts.getFtMetadata`, `fetchFtBalance`, `rpcCall`, `rpcUrlFor`.

### Budgets are positive; corrections come from named verbs

**Rule.** Three write paths into `budgets`: `adminCreate` (positive row), `adminDeallocate` (positive input; handler writes `-amount`, `relatedBudgetId` null), `adminTransfer` (paired `-from`/`+to` rows linked via `relatedBudgetId`). Contract's `baseAmount` validator is positive-only; handlers do the signing.

**Why.** UI forms take positive amounts and pick the verb at click time. Project budgets allowed to go negative — over-budget surfaces as warning, not blocked at API.

**How to apply.** New budget paths follow the verb pattern. Don't accept signed amounts at the contract.

**Anchors.** `budgets.adminCreate/adminDeallocate/adminTransfer` handlers.

### Single-tenant in v1

**Rule.** One agency, one DAO per deployment. Multi-tenant tooling (active-org switching, multiple DAOs in one deployment) deferred to v2.

**Why.** Multi-tenant adds active-org context to every gate and most queries; v1 brief is two weeks.

**How to apply.** Don't add `agencyId` columns or active-org middleware.

**Anchors.** Settings resolve per request from env (`api/src/lib/settings-defaults.ts`); `organizationId` on upstream `projects` rows equals the agency's `orgAccountId`.

### Public surface posture

**Rule.** Chain-derived read-only data MAY be public; locally-authored operational data is admin-only.

- **Chain-mirroring (public OK)**: DAO roles + members, treasury balances, Sputnik transfer proposals — anything queryable via NEAR RPC
- **Locally-authored (admin-only)**: budgets, billings, contributor records + compliance status, applications, project descriptions, project↔contributor assignments

**Why.** Hiding the UI doesn't hide chain data. Product posture is transparency, codified in the schema-defaulted tagline "Open Books · Open Source · Open Doors". Local-table reads have no chain equivalent.

**How to apply.** A new route that calls NEAR RPC and reshapes the result is fine public. A new route that selects from a local table is not. Public projects directory returns `projectWithNearn = publicProject.extend({ nearnListing })` where `publicProject = project.omit({ description: true })`; re-introducing `description` or adding a public single-project route requires revisiting this rule. Agencies that disagree delete or move the routes — they're template-excluded.

**Anchors.** Public surfaces: `team.list/getPublicSummary`, `treasury.getPublicBalances/getPublicSummary`, `proposals.list/getPublicSummary`, `agency.projects.list`.

### Agency table join shape

**Rule.** Project-scoped tables (`budgets`, `billings`, `projectContributors`, `listings`) reference upstream's project rows via a plain-text `projectId` column — no FK, since the projects live in another plugin's schema. Referential integrity is app-layer: handlers verify membership via `requireProjectInOrg(projectId, orgAccountId)` or by joining against `fetchOrgProjects(orgAccountId)`. Agency-scoped tables (`applications`, `contributors`) have no `projectId` — `applications` is a public-inquiry table; `contributors` links to projects via `projectContributors` (composite PK `(projectId, contributorId)`).

**Why.** Project rows moved to upstream's `projects` plugin; FKs across plugin-owned schemas aren't possible. App-layer integrity is the trade-off for indexing rather than authoring projects locally.

**How to apply.** New project-scoped tables: `projectId text NOT NULL` (no `.references(...)`). Gate writes with `requireProjectInOrg`. Composite-PK join tables for many-to-many. For agency-wide reads filtered by project, batch-list upstream projects once (`fetchOrgProjects`) and filter local rows by the resulting id set.

**Anchors.** `api/src/db/schema.ts`; `fetchOrgProjects` / `requireProjectInOrg` helpers in `api/src/index.ts`.

### Billings are 1:1 with Sputnik DAO Transfer proposals

**Rule.** Every contributor payment is a DAO proposal. `billings.proposalId` is `NOT NULL UNIQUE` (`billings_proposal_unique`). No off-chain billing. The billings row is a slim project-scoping wrapper around an on-chain proposal. Status, recipient, token, and amount all come from chain.

**Why.** Chain is the single source of truth. Local lifecycle column = parallel state machine = reconciliation bugs.

**How to apply.**

- **At create** (`billings.adminCreate`): operator inputs `projectId` + `proposalId` (+ optional `contributorId` override + optional `note`). Handler fetches via `getProposal`, rejects non-`Transfer` kinds with `BAD_REQUEST`, derives `tokenId` / `amount` / `contributorId` from the proposal payload (`receiver_id` matched against `contributors.nearAccountId`).
- **At read** (`adminList`, `computeBudget`): rows enriched with `getProposal(daoAccountId, proposalId).status` — seven-state Sputnik enum (`InProgress` / `Approved` / `Rejected` / `Removed` / `Expired` / `Moved` / `Failed`). `InProgress` cached 15s in-memory; absorbing states cached indefinitely in the `proposals` table. Per-row Trezu deep-link: `https://trezu.app/<daoAccountId>/requests/<proposalId>`.
- **Budget rollup** (slices model): `allocated` / `committed` / `paid` / `remaining` are disjoint per project and sum to `budgeted`. `paid` = Sputnik Transfer `status === "Approved"`. `committed` = Sputnik Transfer `status === "InProgress"` + listings with `isWinnersAnnounced=true` where no non-failed billing exists for the same `(projectId, tokenId)`. `allocated` = the project's active listing `rewardAmount` where `isPublished=true AND isArchived=false AND isWinnersAnnounced=false` — NEARN-source wins over internal-source if both exist on the same project; 0 if no active listing. `remaining` = `budgeted − allocated − committed − paid`. Terminal-fail proposals (`Rejected`/`Removed`/`Expired`/`Moved`/`Failed`), unpublished listings (`isPublished=false`), and archived listings (`isArchived=true`) are excluded from all source columns. Archived projects (`status="archived"`) are also excluded at the rollup-call boundary in `treasury.getRollups` — defense-in-depth against listing-cascade divergence; `projects.adminUpdate` cascades the project status to its listings' `isArchived` field, but the rollup filter is the durable guarantee. NEARN's `status` field is uniformly `"OPEN"` and not load-bearing; `deadline` is operationally informative but accounting-irrelevant. Agency rollup adds `available = balance − (budgeted − paid)` (treasury slack). Math lives in `services/rollups.ts.rollupForToken`; both `computeBudget` (per-project) and `treasury.getRollups` (agency) consume it. See SPEC → Target rollup model.
- **Never**: reintroduce a local `status` column; add `billings.adminUpdate`; accept operator-typed token/amount fields.

**Anchors.** `billings` table and `proposals` cache table in `api/src/db/schema.ts`; `billings.adminCreate/adminList` and `computeBudget` in `api/src/index.ts`.

### Effect usage policy: at the boundary, plain async inside

**Rule.** `Effect.gen` / `Effect.promise` in `createPlugin`'s `initialize` / `shutdown` hooks (framework boundary). Inside services and route handlers: plain `async`/`Promise` with `Map`-based caches.

**Why.** Lifting services into Effect-Tag layers adds ceremony without architectural justification at this scale.

**How to apply.** Don't add new Effect-Tag layers unless cache + retry + typed errors form a justified unit OR testability via Tag swap is needed.

**Anchors.** `createPlugin` in `api/src/index.ts`; service files in `api/src/services/`.

### u128-shaped fields coerce with String(...)

**Rule.** At the deserialization boundary, coerce u128-shaped fields (`amount`, `balance`, `share_price`, vote counts, bond, gas) with `String(raw.field ?? "0")`. Never use `parseInt` / `parseFloat` / `Number(...)` on a u128.

**Why.** Older Sputnik deployments JSON-encode `U128` as numbers; newer ones as strings. A tight `z.string().parse()` throws silently → query resolves to undefined → UI shows empty state while `curl` against the same RPC returns rows. Downstream `BigInt(value)` is safe once normalized.

**How to apply.** Apply to every new contract view that returns a u128-shaped field. Don't tighten the zod schema for these.

**Anchors.** `parseProposal`, FT/NEAR balance fetchers in `services/sputnik.ts`.

### Agency-identity defaults

**Rule.** Brand identity (`name`, `headline`, `tagline`) is hardcoded in `settings-defaults.ts` — invariant for this deployment, NOT env-overridable, NOT in the settings table. The active `orgAccountId` resolves from env per request (`AGENCY_ORG_ACCOUNT_MAINNET` / `AGENCY_ORG_ACCOUNT_TESTNET`); operational identity (`nearnAccountId`, `websiteUrl`, `docsUrl`, `description`, `contactEmail`) resolves DB → env → hardcoded per request, with the `agency.settings` row keyed by `orgAccountId` and editable at `/admin/settings`. Env-var fallbacks for editable fields: `AGENCY_NEARN_ACCOUNT`, `AGENCY_WEBSITE_URL`, `AGENCY_DOCS_URL`, `AGENCY_DESCRIPTION`, `AGENCY_CONTACT_EMAIL`. Role-name overrides (`defaultAdminRoleName` / `defaultApproverRoleName` / `defaultRequestorRoleName`) read `AGENCY_ADMIN_ROLE` / `AGENCY_APPROVER_ROLE` / `AGENCY_REQUESTOR_ROLE`, hardcoded fallback `Admin` / `Approver` / `Requestor` — env-only, never in the settings table (self-lockout risk).

**Why.** A fresh deploy demos meaningfully against the maintainer's DAO with zero config. Brand strings hardcoded keep the codebase honest about its identity claim — agencies rebrand by editing `settings-defaults.ts`, not by setting env vars. Operational identity is admin-editable via `/admin/settings` (NEARN handle, urls, description, contact email) so a deployed agency can fix or evolve those fields without redeploy. The active DAO (`orgAccountId`) stays env-only — admin can't repoint the dashboard at a different DAO from inside the dashboard, avoiding the self-lockout risk. Role names stay env-only because changing them while admin is irreversible if the new name doesn't have a member.

**How to apply.** Don't hardcode `MultiAgency` strings on public surfaces; read from `settings.getPublic`. For new brand-identity fields, hardcode in `settings-defaults.ts`. For new operational-identity fields, add an env-override path with a null/empty default.

**Anchors.** `HARDCODED_*` constants + per-field `default*()` helpers in `api/src/lib/settings-defaults.ts`; `FALLBACK` in `ui/src/routes/_layout/index.tsx`.

### Multi-network resolution

**Rule.** The dashboard observes one network per request, resolved by `getNetwork(reqHeaders)` in `api/src/lib/network.ts`:

1. **Pinned mode** — if `NEAR_NETWORK` env is set (`mainnet` or `testnet`), every request returns that network. NetworkToggle UI hides. Single-network deployments.
2. **Free mode** — `NEAR_NETWORK` unset. Client carries the active network via the `X-Network` request header set by `apiClient.fetch`. The header value comes from `getNetwork()` in `ui/src/lib/auth.ts`, which reads `?network=` URL search param (canonical, set by `setNetwork` on toggle) → `localStorage["agency_network"]` (next-session memory) → runtime config → suffix-of-account. Server-side `getNetwork(reqHeaders)` reads the header. Anonymous visitors toggle via NetworkToggle; signed-in users see a read-only badge (toggle hidden, current network derived from URL/localStorage).

Public surfaces (`/treasury`, `/team`, etc.) render the resolved view network's data per-visitor. Admin gates run against the resolved network's DAO. No cookies — privacy-friendly, no GDPR banner concern.

**SSR first-paint limitation (v0.1).** SSR loaders run without URL access and default to mainnet's cache; client hydration with a different network refetches via header (one-time flicker per page load for non-mainnet visitors). Loader-hit queries in `ui/src/lib/queries.ts` include `getNetwork()` in their queryKey so SSR-cached mainnet data doesn't satisfy a testnet client request — cache miss forces the refetch. Eliminating the flicker requires upstream `everything-dev` support for a per-request `apiClient` factory in `RenderOptions` (tracked as Option α in `plans/v1.md`).

**Why.** Same deployment serves both networks: anonymous testnet-curious visitors can browse testnet data via toggle; the maintainer's testing workflow toggles before signing in with the matching network's wallet. Pinned mode lets single-network operators opt out — set `NEAR_NETWORK` in env, toggle disappears, every visitor sees that one network.

**How to apply.** Server-side: call `getOrgAccountId(context.reqHeaders)` for every handler that needs the active org. Never read `NEAR_NETWORK` env directly in service code (`defaultOrgAccount(network)` + `pinnedNetwork()` in `api/src/lib/default-org-account.ts` are the only legitimate consumers). For services like `rpcUrlFor` and `isNearnAvailable`, derive from the passed `orgAccountId`'s suffix via `networkOf` — account-driven, not env-driven. Client-side: NetworkToggle subscribes to `settings.getPublic.networkPinned` and hides when pinned; `setNetwork` (the toggle's click handler) writes localStorage + rewrites URL with `?network=` + full-reloads so SSR re-runs and queryClient rebuilds with the new network in queryKeys.

**Anchors.** `getNetwork`, `NETWORK_HEADER` in `api/src/lib/network.ts`; `getOrgAccountId` in `api/src/index.ts`; `defaultOrgAccount(network)`, `pinnedNetwork()` in `api/src/lib/default-org-account.ts`; `setNetwork`, `getNetwork` in `ui/src/lib/auth.ts`; `createApiClient` + `detectClientNetwork` (per-fetch header injection) in `ui/src/lib/api.ts`; loader-hit queryOptions with network-keyed cache in `ui/src/lib/queries.ts`; `<NetworkToggle>` in `ui/src/components/network-toggle.tsx`; `networkPinned` field on `settings.getPublic` output.

### Default org account

**Rule.** `orgAccountId` is deploy-time config — handlers resolve it from env via `defaultOrgAccount(network)` per request. The function is in `api/src/lib/default-org-account.ts` — `NEAR_NETWORK === "testnet"` selects `AGENCY_ORG_ACCOUNT_TESTNET` (default `multiagency.sputnikv2.testnet`); else `AGENCY_ORG_ACCOUNT_MAINNET` (default `multiagency.sputnik-dao.near`). The `agency.settings` table is keyed BY `orgAccountId` (each DAO carries its own per-DAO operational identity row), but the *active* `orgAccountId` itself doesn't come from the DB — it resolves env-only, so changing the dashboard's target DAO is an env edit + restart, not a settings UI save. `userInRole` short-circuits for non-DAO accounts to `accountId === orgAccountId` (self-ownership), so any NEAR account (not just Sputnik DAOs) can be the org.

**Why.** A fresh deploy demos meaningfully against the maintainer's DAO without any pre-seed write. Lazy resolution means `.env` edits to `NEAR_NETWORK` / the per-network vars take effect on the next request, not just first boot. The settings UI at `/admin/settings` is multi-tenant native: rows are keyed by `orgAccountId`, so each DAO carries its own row independent of others; `orgAccountId` itself is read-only in the UI (env-driven, change-by-restart) so admin can't accidentally lock themselves out by repointing at a DAO where they aren't admin; role names stay out of the UI (env-only — irreversible if the new name has no member).

**How to apply.** Set `NEAR_NETWORK` and override `AGENCY_ORG_ACCOUNT_MAINNET` or `AGENCY_ORG_ACCOUNT_TESTNET` before deploy. Agencies instantiated via `bunx everything-dev init` get this baked in. Operational identity (`nearnAccountId`, `websiteUrl`, `docsUrl`, `description`, `contactEmail`) is admin-editable at `/admin/settings` with env-var fallbacks (`AGENCY_NEARN_ACCOUNT`, `AGENCY_WEBSITE_URL`, `AGENCY_DOCS_URL`, `AGENCY_DESCRIPTION`, `AGENCY_CONTACT_EMAIL`). The active `orgAccountId` resolves from env only — to repoint at a different DAO, edit `AGENCY_ORG_ACCOUNT_MAINNET|TESTNET` and restart. Role-name overrides via `AGENCY_ADMIN_ROLE`, `AGENCY_APPROVER_ROLE`, `AGENCY_REQUESTOR_ROLE` — env-only, never settings UI. Brand identity (name, headline, tagline) is hardcoded — edit `settings-defaults.ts` to rebrand. Each editable field resolves per request through `getResolvedPublicSettings` (DB → env → hardcoded).

**Anchors.** `defaultOrgAccount()` in `api/src/lib/default-org-account.ts`; `defaultPublicSettings()` + per-field `default*()` helpers in `api/src/lib/settings-defaults.ts`; `settings.getPublic` handler in `api/src/index.ts`; `userInRole` short-circuit in `api/src/services/sputnik.ts`.

### Chain position: downstream of everything.dev, upstream of agency deployments

**Rule.** `bos.config.json`'s `extends: bos://dev.everything.near/everything.dev` extends the framework; `bos publish --deploy` publishes our config for downstream agency deployments to extend.

**Why.** Three-tier propagation: upstream framework → this template → downstream agency deployments.

**How to apply.** Pull framework updates via `bos upgrade` (bumps `everything-dev` and `every-plugin`, then runs sync); publish downstream via `bos publish --deploy`. Operational identity (DAO account, NEARN slug, urls, description, contactEmail) is admin-editable at `/admin/settings` after deploy, with env fallbacks at deploy time; brand identity (name, headline, tagline) is hardcoded in `settings-defaults.ts` — edit that file to rebrand. `bos init` ships scaffolding, not deployment-specific values.

**Anchors.** `bos.config.json`.

### Public docs registered in docs-registry

**Rule.** The `/docs` route iterates `ui/src/lib/docs-registry.ts`. Each entry's `source` field picks one of two served paths:
- `source: "skills"` → `ui/public/skills/<slug>.md` (mirrors `.opencode/skills/<slug>/SKILL.md` verbatim — update both files)
- `source: "docs"` → `ui/public/docs/<slug>.md` (template-authored, no upstream mirror — agency-specific operating-model content like entity, contributors, services-agreement, work-order)

**Why.** Single registry is source of truth for `/docs` index and detail pages.

**How to apply.** Don't add a third DOCS array elsewhere. Keep `.opencode/skills/` and `ui/public/skills/` in sync for mirrored entries.

**Anchors.** `ui/src/lib/docs-registry.ts`; `_layout/docs/index.tsx`, `_layout/docs/$slug.tsx`.

## Development Workflow

### Typical Session
1. `bun run dev` to start development
2. UI at http://localhost:3003; API at http://localhost:3001 (default ports from upstream's `service-descriptor.ts`; rsbuild/rspack auto-bump up if a parallel session is on those ports — host on 3000 has no auto-bump and will fail with EADDRINUSE if taken)
3. Check `.bos/logs/` for process logs if issues occur
4. Stop with Ctrl+C in the dev terminal (no `bos kill` subcommand exists in v1.9.x); if processes persist, `lsof -i :3000-3004 -P | grep LISTEN` and `kill <PID>` the stragglers

### Debugging Issues

**API not responding:**
- Verify `bun run dev` is still running in its terminal
- Check `.bos/logs/api.log` for errors

**UI not loading:**
- Verify `bun run dev` is still running in its terminal
- Check browser console for Module Federation errors
- Clear browser cache and retry

**Type errors:**
- Run `bun typecheck`
- Ensure `api/src/contract.ts` is in sync with UI usage

## Code Changes

### Making Changes
- **UI Changes**: Edit `ui/src/` files → hot reload automatically
- **API Changes**: Edit `api/src/` files → hot reload automatically
- **New Components**: Create in `ui/src/components/ui/`. Export from `ui/src/components/index.ts` only when consumed across multiple call sites; single-call-site primitives import directly from `@/components/ui/<name>`.
- **New Routes**: Create file in `ui/src/routes/`, TanStack Router auto-generates tree

### Style Requirements
- Use semantic Tailwind classes: `bg-background`, `text-foreground`, `text-muted-foreground`
- No hardcoded colors like `bg-blue-600`
- No code comments in implementation
- Follow existing patterns in neighboring files
- `bg-accent` (yellow) on `bg-background` (cream) requires a `border-foreground` border to be visible — surface contrast alone is 1.07:1; the 2px black border is load-bearing on primary CTAs

### Adding API Endpoints
1. Define in `api/src/contract.ts` — the oRPC route definitions and Zod schemas
2. Implement in `api/src/index.ts` — the `createRouter` function
3. Use in UI via `apiClient` from `useApiClient()` hook

**Conventions for admin endpoints:**

- **Namespace.** Nest template-specific procedures under `agency.<entity>` (e.g. `agency.projects.list`). Top-level keys on `apiClient` (`projects`, `auth`, …) are reserved for upstream-plugin contracts that `bos types gen` folds into `ApiContract` — those procedures appear in autocomplete but aren't callable through this client (the dashboard's API doesn't implement them). The `agency.` prefix keeps template procedures visually distinct from that type noise. Today only `projects` is nested; the rest (`applications`, `contributors`, `assignments`, `budgets`, `billings`, `proposals`, `tokens`, `treasury`, `nearn`, `me`, `team`, `settings`) sit at top-level and should migrate under `agency.` as they're touched.
- **Gating.** Pick the gate that matches the surface from the `gates` registry: `gates.admin` (governance), `gates.approver` (finance), `gates.operator` (Admin OR Approver — most operational ops), `gates.member` (Admin OR Approver OR Requestor — member-internal reads), `gates.requestor` (strict, for symmetry). Apply via `builder.<name>.use(gates.<key>).handler(...)`. For ad-hoc compositions, use the `requireRoles([...])` factory directly. Server gates by Sputnik DAO role; client gating is advisory only. For surfaces with mixed gating (e.g., role check OR project assignment), use `requireSession` + an inline policy check inside the handler — see `agency.projects.adminGet` for the canonical pattern.
- **Pagination for time-series lists** (audit logs, activity, submissions). Input extends `paginationInput` (defined in `contract.ts`); output shape is `{ data, nextCursor: string | null }`. Handler: default `limit = 50`, max 200; when `input.cursor` is present, add `lt(table.createdAt, new Date(input.cursor))` to the where clause; set `nextCursor` to the last row's `createdAt.toISOString()` only when the page filled to `limit`. UI uses `useInfiniteQuery` with `getNextPageParam: (last) => last.nextCursor ?? undefined`. See `billings.adminList`, `budgets.adminList`, `applications.adminList` for working references.
- **Audit fields on review-style mutations.** When a mutation transitions a row through a review lifecycle (e.g. `applications.adminUpdate`'s status change), set `reviewedBy = context.nearAccountId ?? null` and `reviewedAt = new Date()` on every call. The UI surfaces "last reviewed by X · YYYY-MM-DD HH:MM:SS" automatically when these fields are non-null.

### Plugin Architecture

Business logic is organized into independent plugins loaded via Module Federation:
- **`api/`** — Today owns the agency surface (applications, contributors, budgets, billings, listings, assignments, settings, treasury, nearn, team, me, and the `agency.projects` proxy/cache layer over upstream's projects plugin) plus shared auth middleware.
- **`plugins/`** — No template-authored plugins on disk. `bos.config.json` registers `projects` from upstream (NEARBuilders/everything-dev) for host loading, and the dashboard *does* consume it: `agency.projects.*` handlers proxy reads/writes via `pluginsClient.projects(proxyCtx(orgAccountId))`, with NEARN-cached listing data joined from local `agency.listings`. As agency-specific plugins ship, they live in this directory, each self-contained with `contract.ts`, `index.ts`, and an rspack config for independent deployment.

The UI accesses plugin routes via namespaced clients: `apiClient.<pluginName>.<routeName>()`.

**Scaffolding a new plugin.** This template does not vendor a local `plugins/_template/`. The canonical scaffold lives upstream at [`NEARBuilders/everything-dev/plugins/_template`](https://github.com/NEARBuilders/everything-dev/tree/main/plugins/_template), with `LLM.txt` implementation guidance in that directory and existing plugins (`auth`, `opencode`, `projects`, `registry`) as working references. The dashboard has not validated the end-to-end scaffolding flow itself; treat upstream as the starting point.

**Planned crossovers (anticipated, not committed).**

- **`projects` × `agency.projects`.** The dashboard's `agency.projects.*` handlers proxy to upstream via `pluginsClient.projects(proxyCtx(orgAccountId))`. Upstream owns project rows; `agency.listings` caches per-project NEARN payloads and reserves space for future internal listings. See "Projects live upstream; NEARN linkage is the local `listings` cache" and "Proxy upstream calls as the organization identity, never the operator" above.
- **Trezu plugin (possible).** A Trezu plugin packaging the on-chain write flows (AddMember, Transfer, ChangePolicy) is one path for relaxing the dashboard's read-only posture on Sputnik. Imported as a peer if it ships. Not committed.

### Plugin Client (pluginsClient)

The API plugin receives typed client factories for all other plugins via `createPlugin.withPlugins<PluginsClient>()`, enabling in-process composition without HTTP roundtrips.

**Two-phase loading**: The host loads non-API plugins first (Phase 1), creates a `pluginsClient` map, then loads the API with that map injected (Phase 2). The host is generic — no plugin-specific code.

**Generated types** (`api/src/plugins-client.gen.ts`, `ui/src/api-contract.gen.ts`, `ui/src/auth-types.gen.ts`) are gitignored. No install-time hook — `bos types gen` emits broken imports when `auth.development` is a `local:` path not checked out on disk. `bos dev` loads auth remotely from `auth.production` without touching these files; treat the gen files as stable once present. To regenerate when upstream auth's contract changes, temporarily point `auth.development` at the same URL as `auth.production`, run `bos types gen`, then revert.

### Workspace Dependency Versions

`api/package.json` and `ui/package.json` use literal version specifiers (e.g. `"better-auth": "1.6.9"`), not `catalog:` refs — that's upstream's template default, and these files are template-tracked. Don't "fix" workspace deps to `catalog:` refs; the next `bos sync` overwrites the change. The root `workspaces.catalog` still pins canonical versions for `overrides` and root deps; workspaces just don't reference it.

## Testing & Quality

**Before committing:**
```bash
bun test        # Run all tests
bun typecheck   # Type check all packages
bun lint        # Run linting
```

PR CI runs `bun audit` and warns on critical/high vulnerabilities but does not fail the build. Treat the warning as informational.

## Common Patterns

### Authentication Check
Routes requiring auth use `_authenticated.tsx` layout. Auth is NEAR-only via `better-near-auth` SIWN; there is no login page, so unauthenticated users are sent back to `/` where the landing exposes the connect button:
```typescript
import { sessionQueryOptions } from "@/lib/auth";

export const Route = createFileRoute("/_layout/_authenticated")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    if (!session?.user) {
      throw redirect({ to: "/" });
    }
    return { session };
  },
});
```

### API Client Usage
oRPC returns the contract output shape directly — no `{ data }` envelope is added by the client. Destructure to match the contract.
```typescript
import { useApiClient } from "@/app";

function MyComponent() {
  const apiClient = useApiClient();
  const { status, timestamp } = await apiClient.ping();
  await apiClient.applications.create({ kind, name, email });
}
```

### App Name in UI
`getAppName(config)` returns `getActiveRuntime(config)?.title ?? getAccount(config)`. Anywhere a `runtimeConfig` is in scope (loader data or `head()`), the canonical pattern is:
```typescript
import { getAppName } from "@/app";

const { runtimeConfig } = Route.useLoaderData();
const appName = getAppName(runtimeConfig) || "app";
```

## Troubleshooting

**Process won't start:**
```bash
lsof -i :3000-3004 -P | grep LISTEN  # Find stragglers, then `kill <PID>`
bun install                          # Ensure dependencies
bun run dev                          # Restart
```

**Module Federation errors:**
- Check `bos.config.json` URLs are accessible
- Verify shared dependency versions match in package.json
- Clear browser cache

**Database issues:**
```bash
bun run db:migrate  # Apply generated migrations (safe for CI/non-interactive)
bun run db:push     # Interactive schema sync (local dev only — needs a TTY)
bun run db:studio   # Open Drizzle Studio
```

### Cross-Checking Onchain State

When the dashboard's view of a Sputnik DAO disagrees with reality, verify against the chain directly before suspecting the indexer. The `near` CLI bypasses our `services/sputnik.ts` cache, NEARN, Trezu, and any local DB row:

```bash
# DAO policy (roles, members, bond, voting rules)
near contract call-function as-read-only <dao>.sputnik-dao.near get_policy \
  json-args '{}' network-config mainnet now

# Single proposal (status, kind, vote counts) — direct chain truth
near contract call-function as-read-only <dao>.sputnik-dao.near get_proposal \
  json-args '{"id": <proposalId>}' network-config mainnet now

# Last proposal id (basis for pagination — see fetchTransferProposals cursor math)
near contract call-function as-read-only <dao>.sputnik-dao.near get_last_proposal_id \
  json-args '{}' network-config mainnet now

# Available NEAR balance (treasury free-after-locked)
near contract call-function as-read-only <dao>.sputnik-dao.near get_available_amount \
  json-args '{}' network-config mainnet now

# FT balance against an NEP-141 contract
near contract call-function as-read-only <token>.near ft_balance_of \
  json-args '{"account_id": "<dao>.sputnik-dao.near"}' network-config mainnet now

# Account summary including delegations (useful for cross-checking individual signers)
near account view-account-summary <signer>.near network-config mainnet now
```

If the default RPC is rate-limited, swap `network-config mainnet` for `network-config mainnet-fastnear`.

Use this when: a proposal status looks stuck (compare to chain); over-budget warnings fire and you want to confirm the actual treasury free-balance; a vote count in the UI looks off (u128 schema regression — see the lenience rule in Architectural Decisions); proposal pagination skips items (compare `get_last_proposal_id` to UI's `lastProposalId`).

**`GET /api/auth/near/list-accounts 401` in console on anonymous load:**
Cosmetic only. `better-near-auth`'s `siwnClient` plugin calls `restoreFromSession` unconditionally on init, which hits `list-accounts` — an endpoint gated by better-auth's standard `sessionMiddleware`. Anon → 401. The client catches it silently (`catch {}`); the 401 still surfaces in the browser's network layer log. App functionality is unaffected. The dashboard's server-side `resolveNearAccountId` also handles the 401 gracefully via `if (!res.ok) return undefined`. No fix locally — the `siwnClient` plugin has no `autoRestore: false` option, and patching it just for cleaner console output isn't worth the maintenance burden.

## Environment

**Required files:**
- `.env` - Secrets (see `.env.example`)
- `bos.config.json` - Runtime configuration (committed)

**Key ports** (defaults from upstream's `service-descriptor.ts`):
- 3000 - host
- 3001 - api
- 3002 - auth
- 3003 - ui
- 3010+ - plugins

UI/API auto-bump up if a parallel session occupies their slot (rsbuild/rspack handle EADDRINUSE themselves). Host has no auto-bump and fails outright if 3000 is taken — coordinate with parallel sessions or override via `app.host.development: "http://localhost:<port>"` in `bos.config.json`.
