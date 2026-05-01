# Persist Installed Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist installed theme/icon extensions per user and workspace so they survive page reloads.

**Architecture:** Add a backend table keyed by `repo_id + user_id + extension_id` that stores processed theme/icon payloads as JSON text, expose install/list routes behind repo read access, and hydrate the appearance store from the backend when the IDE opens.

**Tech Stack:** Fastify, Drizzle ORM, PostgreSQL, React, Zustand, Vitest

---

### Task 1: Backend persistence model

**Files:**
- Modify: `api/src/db/schema.ts`
- Modify: `api/src/db/schema.test.ts`
- Create: `api/drizzle/0001_persist_installed_extensions.sql`
- Modify: `api/drizzle/meta/_journal.json`

- [ ] Add a new `installed_extensions` table with `repo_id`, `user_id`, `extension_id`, `display_name`, `themes_json`, `icon_themes_json`, timestamps, and a composite primary key.
- [ ] Extend the schema test so the new table columns are asserted.
- [ ] Add a migration that creates the table and foreign keys to `repos` and `users`.

### Task 2: Extensions API persistence

**Files:**
- Modify: `api/src/modules/extensions/extensions.service.ts`
- Modify: `api/src/modules/extensions/extensions.controller.ts`
- Modify: `api/src/modules/extensions/extensions.routes.ts`

- [ ] Split pure VSIX parsing from installation persistence so the install flow can reuse the parsed payload.
- [ ] On install, upsert the processed extension payload into `installed_extensions` for the current repo/user and return the payload.
- [ ] Add a `GET /extensions/installed` route that returns flattened installed themes and icon themes for the current workspace.
- [ ] Protect install/list routes with repo read access instead of auth-only access.

### Task 3: Frontend hydration

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/extensions.ts`
- Modify: `web/src/stores/appearanceStore.ts`
- Modify: `web/src/pages/IDEPage.tsx`
- Modify: `web/src/components/editor/EditorPane.tsx`

- [ ] Add a frontend payload type for installed extension state.
- [ ] Pass `workspace` on install requests and add a fetch helper for installed extensions.
- [ ] Add store actions to replace/reset installed themes and icon themes cleanly per workspace.
- [ ] Fetch installed extensions when the IDE page loads and hydrate the store before user interaction.

### Task 4: Verification

**Files:**
- Test: `web/src/stores/appearanceStore.test.ts`
- Test: `web/src/components/editor/EditorPane.test.tsx`
- Test: `web/src/components/extensions/ExtensionsPanel.test.tsx`

- [ ] Add store coverage for replace/reset behavior.
- [ ] Keep existing editor and extension tests green after the API signature change.
- [ ] Run `cd api && npm run typecheck`, `cd web && npm run typecheck`, and focused `vitest` coverage for changed frontend files.
