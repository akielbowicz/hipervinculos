# AGENTS.md - Repository Structure & AI Integration Guide

This document provides a comprehensive overview of the Hipervínculos bookmark manager repository structure, development philosophy, and integration patterns for AI coding assistants.

## Repository Overview

**Hipervínculos** is a personal bookmark manager with:
- **Mobile-first input**: Telegram bot with share sheet integration
- **Powerful search**: Full-text search via Pagefind
- **Static site**: GitHub Pages hosted interface
- **Serverless backend**: Cloudflare Workers + GitHub API

## Directory Structure

```
hipervinculos/
├── data/                           # Bookmark data storage
│   ├── bookmarks.json              # All bookmarks (append-only array)
│   ├── metadata.json               # System metadata and statistics
│   └── tags.json                   # Tag definitions with colors
│
├── scripts/                        # Build and maintenance scripts
│   ├── generate-pages.js           # Convert bookmarks to HTML for Pagefind
│   ├── update-metadata.js          # Update statistics
│   ├── validate-bookmarks.js       # Data integrity checks
│   ├── import.js                   # Import from other services
│   └── export.js                   # Export to various formats
│
├── worker/                         # Cloudflare Worker (serverless backend)
│   ├── src/
│   │   ├── index.js                # Main Worker entry point
│   │   ├── telegram.js             # Telegram bot handlers
│   │   ├── metadata.js             # URL metadata extraction
│   │   ├── github.js               # GitHub API integration
│   │   └── utils.js                # Shared utilities
│   └── wrangler.toml               # Worker configuration
│
├── assets/                         # Static site assets
│   ├── styles.css                  # Main stylesheet
│   ├── app.js                      # Client-side JavaScript
│   └── icons/                      # Content type icons
│
├── pages/                          # Generated HTML pages for Pagefind
│   └── {bookmark-id}.html          # One page per bookmark
│
├── pagefind/                       # Generated search index (do not edit)
│   ├── pagefind.js
│   ├── pagefind-ui.js
│   └── index/
│
├── .agents/                        # AI assistant integration
│   └── commands/                   # Claude Code slash commands
│       ├── add-bookmark            # Quick bookmark addition
│       ├── validate-data           # Run validation checks
│       └── generate-build          # Trigger build process
│
├── .github/workflows/              # GitHub Actions CI/CD
│   ├── build.yml                   # Build Pagefind index on data changes
│   ├── validate.yml                # Daily data validation
│   └── backup.yml                  # Weekly backups
│
├── docs/                           # User documentation
│   ├── SETUP.md                    # Setup instructions
│   ├── COMMANDS.md                 # Telegram bot commands
│   ├── API.md                      # API reference
│   └── DEVELOPMENT.md              # Developer guide
│
├── specs/                          # Feature specifications (BDD style)
│   └── bookmark-complete-spec.md   # Complete system specification
│
├── index.html                      # Main static site interface
├── justfile                        # Development automation
├── package.json                    # Node.js dependencies
├── CHANGELOG.md                    # Version history
└── README.md                       # Project overview
```

## Development Philosophy

### 1. Data-Driven Architecture

**Storage Strategy:**
- **Git as database**: All bookmarks stored in `data/bookmarks.json`
- **Append-only**: New bookmarks appended to array (Git tracks history)
- **Metadata separation**: System stats in separate `metadata.json`
- **Tag definitions**: Centralized in `tags.json` with colors/descriptions

**Benefits:**
- Version control for all changes
- Easy backup and restore
- Transparent data access
- No database infrastructure

### 2. Build Pipeline

**On Bookmark Save:**
1. Cloudflare Worker receives URL from Telegram
2. Extract metadata (title, description, image)
3. Commit to GitHub via API → `data/bookmarks.json`
4. GitHub Action triggered on push
5. Generate HTML pages from bookmarks
6. Pagefind indexes pages
7. Deploy to GitHub Pages

**Workflow:**
```
Telegram → Worker → GitHub API → Actions → Pagefind → Pages
```

### 3. Mobile-First UX

**Design Principles:**
- One-tap bookmark saving (share sheet → Telegram)
- Preview before save (rich card with image)
- Inline actions (edit, tag, delete without typing commands)
- Optimistic UI (show changes immediately, sync in background)
- Offline support (Service Worker caches bookmarks)

### 4. Validation & Quality

**Automated Checks:**
- Unique bookmark IDs
- Valid URL formats
- No future timestamps
- Required fields present
- Tag consistency
- Link validation (external URLs still active)

**Run via:**
- GitHub Actions (daily)
- Pre-commit hooks (local development)
- Manual: `just validate`

### 5. AI Assistant Integration

**Agent Commands** (`.agents/commands/`):
- `add-bookmark`: Quick bookmark addition
- `validate-data`: Run validation checks
- `generate-build`: Trigger build process
- `review`: Run Rule of 5 review on code/changes
- `prepare-commit`: Interactive workflow for safe, atomic commits

**Usage Pattern:**
```bash
/add-bookmark https://example.com "Article Title"
/validate-data
/generate-build
```

## Key Technologies

- **Backend**: Cloudflare Workers (JavaScript)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Search**: Pagefind (static full-text search)
- **Storage**: GitHub (JSON files)
- **CI/CD**: GitHub Actions
- **Bot**: Telegram Bot API
- **Hosting**: GitHub Pages

## Development Workflow

### Local Development

```bash
# Setup
npm install
just setup

# Run Worker locally
cd worker && wrangler dev

# Build static site
just build

# Serve locally
just serve

# Validate data
just validate
```

### Testing

```bash
# Run all tests
just test

# Validate bookmarks
just validate

# Check for broken links
just check-links
```

### Deployment

```bash
# Deploy Worker
cd worker && wrangler deploy

# Deploy site (automatic on push to main)
git push origin main
```

## Data Schema

### Bookmark Object

```json
{
  "id": "uuid-v4",
  "url": "https://example.com/article",
  "url_normalized": "https://example.com/article",
  "url_hash": "sha256-first-16-chars",
  "title": "Article Title",
  "description": "Meta description",
  "image": "https://example.com/og-image.jpg",
  "favicon": "data:image/png;base64,...",
  "content_type": "article|video|image|pdf|code|tweet|other",
  "author": "Author name",
  "site_name": "example.com",
  "timestamp": "2025-01-12T10:30:00.000Z",
  "modified_timestamp": "2025-01-15T14:20:00.000Z",
  "tags": ["javascript", "tutorial"],
  "is_private": false,
  "is_archived": false,
  "is_favorite": false,
  "read_status": "unread|reading|read",
  "notes": "Personal notes",
  "source": "telegram|browser_extension|api|import",
  "extraction_status": "success|partial|failed",
  "extraction_duration_ms": 1250
}
```

### Metadata Object

```json
{
  "total_bookmarks": 1247,
  "last_updated": "2025-01-12T10:30:00Z",
  "last_bookmark_id": "abc-123-def",
  "statistics": {
    "by_type": {
      "article": 450,
      "video": 120,
      "code": 80
    },
    "by_read_status": {
      "unread": 890,
      "reading": 23,
      "read": 334
    },
    "favorites_count": 45,
    "private_count": 12
  },
  "tags_usage": {
    "javascript": 145,
    "python": 89
  }
}
```

## Integration Patterns

### Adding a New Feature

1. **Document in spec**: Update `bookmark-complete-spec.md`
2. **Write tests**: Create `.feature` file in `specs/`
3. **Implement**: Update Worker, scripts, or frontend
4. **Validate**: Run `just validate`
5. **Document**: Update relevant docs in `docs/`
6. **Update changelog**: Add entry to `CHANGELOG.md`

### Modifying Bookmark Schema

1. **Update schema**: In this document and spec
2. **Migration script**: Add to `scripts/migrations/`
3. **Update validation**: Modify `scripts/validate-bookmarks.js`
4. **Update generation**: Modify `scripts/generate-pages.js`
5. **Test thoroughly**: Validate with existing data
6. **Version bump**: Update `metadata.json` schema version

### Adding Agent Commands

1. **Create command file**: In `.agents/commands/`
2. **Define clear prompt**: Include context, validation, output format
3. **Document expected behavior**: Comment at top of file
4. **Test with real scenarios**: Verify output matches expectations
5. **Update this document**: Add to command list above

## Error Handling Strategy

**Worker Errors:**
- Metadata extraction timeout: Save with partial data, queue retry
- GitHub API failure: Queue for retry, notify user
- Rate limit exceeded: Clear message with retry time
- Invalid URL: Immediate feedback with suggestions

**Build Errors:**
- Invalid JSON: Halt build, create GitHub issue
- Missing required fields: Warning in logs, skip bookmark
- Link validation failures: Warning only (don't block build)

**Client Errors:**
- Network offline: Queue actions, sync when online
- Search index unavailable: Fallback to client-side search
- API error: Retry with exponential backoff

## Security Considerations

- **Telegram**: Webhook signature verification, user ID allowlist
- **API**: Bearer token authentication, rate limiting
- **GitHub**: Fine-grained PAT, single repo access
- **Private bookmarks**: Excluded from public HTML generation
- **Input sanitization**: All text fields sanitized, URLs validated
- **CSP**: Content Security Policy headers on static site

## Performance Targets

- **First Contentful Paint**: <1s
- **Time to Interactive**: <2s
- **Search response**: <300ms
- **Metadata extraction**: <5s
- **Build time**: <3 minutes (10k bookmarks)

## Contributing

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for:
- Code style guidelines
- Testing requirements
- Pull request process
- Local development setup

---

**Last Updated**: 2026-01-13
**Spec Version**: 3.0
