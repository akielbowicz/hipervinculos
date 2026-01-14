# Changelog

All notable changes to Hipervínculos will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Infrastructure (2026-01-13)
- Initial project structure with organized directories
- Comprehensive `AGENTS.md` documenting repository structure and AI integration
- Development automation via `justfile` with 30+ commands
- GitHub Actions workflows:
  - `build.yml` - Automated Pagefind index generation and GitHub Pages deployment
  - `validate.yml` - Daily data integrity validation with issue creation on failure
  - `backup.yml` - Weekly backups to GitHub Releases with auto-cleanup
- Agent commands for Claude Code integration:
  - `/validate-data` - Run validation checks
  - `/build` - Build static site and search index
  - `/stats` - Display bookmark statistics

#### Data Layer (2026-01-13)
- JSON-based data storage:
  - `data/bookmarks.json` - Bookmark storage (empty, ready for data)
  - `data/metadata.json` - System statistics and metadata
  - `data/tags.json` - Tag definitions with colors
- Node.js validation scripts:
  - `validate-bookmarks.js` - Comprehensive data integrity checks
  - `update-metadata.js` - Automatic statistics calculation
  - `generate-pages.js` - HTML page generation for Pagefind
  - `check-links.js` - External link validation
- Data validation rules:
  - Unique bookmark IDs
  - Valid URL formats
  - No future timestamps
  - Required fields enforcement
  - Tag consistency checks
  - Content type validation

#### Static Site (2026-01-13)
- Mobile-first responsive HTML/CSS/JS interface
- Features:
  - Full-text search (ready for Pagefind integration)
  - Filter by read status (all, unread, favorites)
  - Filter by content type (article, video, code, etc.)
  - Sort options (newest, oldest, title A-Z)
  - Responsive grid layout (3-column desktop, 1-column mobile)
  - Dark mode support via CSS `prefers-color-scheme`
  - Keyboard shortcuts (`/` for search, `Esc` to clear)
  - Bookmark cards with:
    - Preview images or content type icons
    - Title and description
    - Metadata (type, site, date)
    - Tags
    - Quick actions (favorite, open)
- Loading and empty states
- Accessible design (ARIA labels, semantic HTML, keyboard navigation)

#### Documentation (2026-01-13)
- Enhanced `README.md` with quick start guide
- `AGENTS.md` - Complete repository and development guide
- Inline code documentation in all scripts
- Command-line help via `just --list`

### Changed

#### UI Redesign (2026-01-13)
- Implemented "Minimalist Grayscale" design language
- Updated color palette to strict black/white/gray (#171717, #ffffff)
- Refactored Navigation:
  - Consolidated header layout
  - Converted filter buttons to text-based tabs
  - Simplified dropdowns
- Redesigned Bookmark Cards:
  - Removed "action bar" and heavy shadows
  - Implemented "Flat" design with minimal borders
  - Moved "Favorite" button to image overlay
  - Made entire card clickable
  - Simplified metadata display with interpuncts

### Technical Details

**Stack:**
- Frontend: Vanilla HTML/CSS/JavaScript
- Search: Pagefind (static full-text search)
- Build: Node.js scripts
- CI/CD: GitHub Actions
- Hosting: GitHub Pages (ready)
- Data: JSON files in Git

**Design Patterns:**
- Git as database (inspired by `incitaciones` flat structure)
- Metadata-driven organization (from `incitaciones`)
- Just-based automation (from `fabbro`)
- Agent integration via `.agents/commands/` (from `fabbro`)
- Validation-first development
- Mobile-first responsive design

### Roadmap

#### Phase 1: Core Backend (Next)
- [ ] Cloudflare Worker setup
- [ ] Telegram bot integration
- [ ] URL metadata extraction
- [ ] GitHub API integration for data commits
- [ ] Duplicate detection via URL hashing

#### Phase 2: Advanced Features
- [ ] Browser extension
- [ ] Private bookmarks with authentication
- [ ] Collections/grouping
- [ ] Full-text notes
- [ ] Import/export utilities

#### Phase 3: Enhancement
- [ ] Reading time estimates
- [ ] Related bookmarks
- [ ] ML-based recommendations
- [ ] Public API

## Project Status

🚧 **Phase 0 Complete** - Infrastructure and static site foundation ready
📝 **Phase 1 Starting** - Backend implementation next

---

**Versioning:**
- Major: Breaking changes to data schema or API
- Minor: New features, non-breaking enhancements
- Patch: Bug fixes, documentation updates
