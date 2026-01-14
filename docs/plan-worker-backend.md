# Implementation Plan: Cloudflare Worker (Telegram Bot Backend)

## 1. Project Initialization
- [ ] Create `worker/` directory structure.
- [ ] Create `worker/wrangler.toml` configuration:
  - Define KV namespaces: `KV_BOOKMARKS` (cache/retry), `KV_SESSIONS` (auth/ratelimit).
  - Define environment variables placeholders.
  - **Add Cron Trigger:** `[triggers] crons = ["0 * * * *"]` (Hourly).
- [ ] Create `worker/package.json`:
  - `hono`, `@octokit/rest`, `metascraper`, `cheerio`, `zod`.
- [ ] Create `worker/.dev.vars` (example) for local secrets.

## 2. Core Modules (TDD Approach)

### A. GitHub Adapter (`github.js`)
- **Test First:** Create `worker/test/github.test.js` mocking Octokit.
  - Test: `getBlob` returns parsed JSONL.
  - Test: `updateBlob` handles 409 Conflict loop.
- **Implementation:**
  - `getBookmarkFile()`: Fetches/Parses `data/bookmarks.jsonl`.
  - `saveBookmark(bookmark)`: Reads file -> Appends -> Commits (Atomic).

### B. Metadata Service (`metadata.js`)
- **Test First:** Create `worker/test/metadata.test.js` with mock HTML responses.
  - Test: Extracts Title/Desc/Image from standard meta tags.
  - Test: Handles timeouts (returns partial data).
- **Implementation:**
  - `fetchMetadata(url)`: Uses `metascraper` with `cheerio`.
  - Enforce 5s timeout.

### C. Telegram Handler (`telegram.js`)
- **Test First:** Create `worker/test/telegram.test.js` with mock Update objects.
  - Test: Parses `/start`, URL messages, and unknown commands.
- **Implementation:**
  - `handleUpdate(update)`: Dispatcher.
  - `sendMessage(chatId, text, buttons)`: Helper.

## 3. Worker Logic

### A. Entrypoint (`index.js`)
- Setup Hono.
- Route: `POST /webhook` -> `telegram.handleUpdate`.
- Route: `GET /api/health`.

### B. Cron Handler (`scheduled.js`)
- Event: `scheduled`.
- Logic:
  1. Scan `KV_BOOKMARKS` for keys starting with `retry:`.
  2. Attempt to process/save them.
  3. If success: Delete key.
  4. If fail: Increment attempt count or delete if >3.

## 4. The Save Flow (Integration)
1. **User sends URL.**
2. **Worker:**
   - Checks KV Cache (avoid re-fetching metadata if recently seen).
   - Calls `metadata.fetchMetadata(url)`.
     - *If fail/timeout:* Mark as `partial`, queue for Cron retry (KV).
   - Calls `github.saveBookmark(bookmark)`.
     - *If GitHub down:* Queue entire object to KV `retry:` list.
   - **Reply:** "✅ Saved" (or "⏳ Saved with partial data").

## 5. Verification
- **Unit:** Run `vitest` in `worker/`.
- **Integration:** `wrangler dev` + `curl` to simulate webhook.
- **Deployment:** `wrangler deploy`.