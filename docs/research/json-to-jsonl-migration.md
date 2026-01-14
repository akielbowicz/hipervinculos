# Research: Migration from JSON to JSONL for Data Files

## 1. Context & Motivation

**Current State:**
- `data/bookmarks.json`: JSON Array of objects.
- `data/tags.json`: JSON Object with a `tags` property containing an array.
- `data/metadata.json`: JSON Object with statistics.

**Problem:**
- **Git Diffs:** JSON arrays stored on multiple lines generate noisy diffs (indentation, commas).
- **Merge Conflicts:** Concurrent edits to the array (especially appending) often conflict on the closing bracket or trailing comma.
- **Parsing:** Requires loading the entire array into memory.

**Solution: JSONL (JSON Lines)**
- Each line is a valid, independent JSON object.
- **Append-friendly:** Adding a record is just appending a line. No trailing commas.
- **Git-friendly:** Diffs show exactly what changed line-by-line.
- **Streamable:** Can be processed line-by-line.

## 2. Target Data Structure

### `data/bookmarks.jsonl`
Convert from a JSON array to a newline-delimited list of bookmark objects.

**Example:**
```json
{"id": "1", "url": "https://example.com", "title": "Example", ...}
{"id": "2", "url": "https://foo.bar", "title": "Foo", ...}
```

### `data/tags.jsonl`
Convert from `{ "tags": [...] }` to a newline-delimited list of tag objects.

**Example:**
```json
{"name": "javascript", "color": "#f7df1e", "description": "..."}
{"name": "python", "color": "#3776ab", "description": "..."}
```

### `data/metadata.json`
**Recommendation: Keep as JSON.**
- It is a single object (singleton), not a list of records.
- It is a generated artifact (derived from bookmarks), so git merge conflicts are less critical (it's usually overwritten).
- Converting a single object to a one-line JSONL file offers no format advantage.

## 3. Impact Analysis & Implementation Plan

### A. Data Migration
1.  **Script**: Create `scripts/migrate-to-jsonl.js` to transform existing files.
2.  **Validation**: Ensure data count and content match exactly.
3.  **Cleanup**: Delete `data/bookmarks.json` and `data/tags.json`.

### B. Application Logic Updates

#### 1. Frontend (`assets/app.js`)
Browsers do not natively parse JSONL via `response.json()`.
**Change:**
```javascript
// Old
const data = await response.json();

// New
const text = await response.text();
const lines = text.trim() ? text.trim().split(/\r?\n/) : [];
const data = lines
  .filter(line => line.trim())
  .map(line => JSON.parse(line));
```

#### 2. Node.js Scripts (`scripts/*.js`)
`require('../data/bookmarks.json')` will no longer work.
**Affected Scripts:**
- `scripts/check-links.js`
- `scripts/generate-pages.js`
- `scripts/update-metadata.js`
- `scripts/validate-bookmarks.js`

**Change:**
Create a shared utility `scripts/utils.js` (see below) or inline the safe parsing logic if strictly necessary. Using a utility is preferred.

```javascript
// Inline example (if utility not used)
const fs = require('fs');
const content = fs.readFileSync('data/bookmarks.jsonl', 'utf8');
const bookmarks = content.trim() ? content.trim().split(/\r?\n/).map(JSON.parse) : [];
```

#### 3. `justfile` (Task Runner)
The `justfile` currently uses many `node -e` one-liners that `require` the JSON files. Inlining the parsing logic makes these commands brittle and hard to read.

**Proposed Solution: Shared Utility Module**
Create `scripts/data-utils.js` (or similar) to handle data loading.

```javascript
// scripts/data-utils.js
const fs = require('fs');
const path = require('path');

function loadData(filename) {
  const filePath = path.join(__dirname, '../data', filename);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) return [];
  
  return content
    .trim()
    .split(/\r?\n/)
    .filter(line => line.trim()) // Ignore empty lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error(`Warning: skipping invalid line in ${filename}`);
        return null;
      }
    })
    .filter(item => item !== null);
}

module.exports = { loadData };
```

**Updated Justfile Usage:**
`@node -e "const { loadData } = require('./scripts/data-utils'); const data = loadData('bookmarks.jsonl'); ..."`

### C. Documentation
Update all references in:
- `HANDOFF.md`
- `AGENTS.md`
- `specs/bookmark-complete-spec.md` (API paths and file references)

## 4. Execution Steps
1.  **Migrate Data**: Run migration script (with validation).
2.  **Create Utility**: Create `scripts/data-utils.js` for robust JSONL parsing.
3.  **Update Code**: Refactor `assets/app.js` and `scripts/*.js` to use the new format/utility.
4.  **Update Automation**: Refactor `justfile` to use `scripts/data-utils.js`.
5.  **Update Docs**: grep and replace references.
6.  **Verify**: Run `just build`, `just validate`, and check the frontend.
