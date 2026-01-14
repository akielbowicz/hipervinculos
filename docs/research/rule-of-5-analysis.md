# Rule of 5 Review: Hipervínculos

**Date:** 2026-01-13
**Reviewer:** Gemini (Agent)
**Context:** Initial Infrastructure Setup

## Overview

This document applies Steve Yegge's "Universal Rule of 5 Review" methodology to the current state of the Hipervínculos repository.

## Stage 1: Draft (Shape) - Get the shape right

**Assessment:** EXCELLENT
The project structure follows a clear separation of concerns (Data, Assets, Scripts, Pages). The infrastructure for a static site with search (Pagefind) and data validation is well-established.

**Recommendations:**
1.  **Move Specifications:** Move `bookmark-complete-spec.md` into the `specs/` directory to declutter the root.
2.  **Standardize Scripts:** Ensure all scripts in `scripts/` share the same shebang (`#!/usr/bin/env node`) and executable permissions.

## Stage 2: Correctness - Is the logic sound?

**Assessment:** GOOD
Validation scripts are robust. Private bookmark filtering is correctly implemented in generation logic.

**Recommendations:**
1.  **Duplicate URL Detection:** Add a warning in `scripts/validate-bookmarks.js` for duplicate URLs. While legitimate use cases exist (e.g., re-reading), unintentional duplicates are common errors.
2.  **Tag Type Safety:** Explicitly validate that all items in `tags` array are strings in `validate-bookmarks.js`.
3.  **ID Format Validation:** Enforce UUID v4 format (or at least safe-filename characters) for `id` field in validation to prevent filesystem issues during page generation.

## Stage 3: Clarity - Can someone else understand this?

**Assessment:** EXCELLENT
The `HANDOFF.md` is a model of clarity. `justfile` provides a self-documenting interface.

**Recommendations:**
1.  **Agent Documentation:** Ensure `AGENTS.md` is kept in sync with `HANDOFF.md` regarding new capabilities or architectural decisions.
    -   *Finding:* `AGENTS.md` lists `specs/telegram-bot.feature` etc., but the `specs/` directory is currently empty. Documentation should match reality.
2.  **Comment Complex Logic:** Ensure any future complex logic in `app.js` (search implementation) is well-commented.

## Stage 4: Edge Cases - What could go wrong?

**Assessment:** GOOD
Timeouts and future timestamp checks are in place.

**Recommendations:**
1.  **Malicious Data:** Although `escapeHtml` is used, consider `id` field injection risks if filenames aren't validated.
2.  **Large Dataset Performance:** As noted in Technical Debt, >1000 bookmarks might impact `app.js` performance (client-side search).
    -   *Mitigation:* Plan for pagination or virtual scrolling in `index.html`.
3.  **Empty States:** Ensure `app.js` handles:
    -   No bookmarks found.
    -   No tags defined.

## Stage 5: Excellence - Ready to ship?

**Assessment:** GOOD (for Phase 0)
The foundation is solid.

**Recommendations:**
1.  **Unit Tests:** Add a simple test suite (e.g., using built-in `node:test`) for the critical scripts (`validate-bookmarks.js`, `generate-pages.js`).
2.  **Pre-commit Hooks:** Use `husky` or similar to run `just validate` before commit to prevent bad data from entering the repo.

## Action Plan

1.  [ ] Move `bookmark-complete-spec.md` to `specs/`.
2.  [ ] Update `scripts/validate-bookmarks.js` with ID regex and duplicate URL warning.
3.  [ ] Create initial unit tests for validation logic.
