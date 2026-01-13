# Hipervínculos

Personal bookmark manager optimized for mobile capture and cross-device access with powerful search.

## Features

- 📱 **Mobile-first**: Telegram bot with share sheet integration
- 🔍 **Powerful search**: Full-text search via Pagefind with filters
- 🌐 **Browse-first**: Recent bookmarks visible without searching
- 🔒 **Private by default**: Self-hosted, you control your data
- ⚡ **Zero-friction saving**: One tap to bookmark, metadata extracted automatically

## Quick Start

### Prerequisites

- GitHub account
- Telegram account
- Cloudflare account (free tier)

### Setup

1. **Clone this repository**
   ```bash
   git clone https://github.com/yourusername/hipervinculos.git
   cd hipervinculos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure secrets** (see [Setup Guide](docs/SETUP.md))
   - Telegram bot token
   - GitHub personal access token
   - Cloudflare Worker secrets

4. **Deploy**
   ```bash
   # Deploy Cloudflare Worker
   wrangler deploy

   # Enable GitHub Pages
   # In repo settings: Pages → Source: GitHub Actions
   ```

## Usage

### Telegram Bot

Send any URL to your Telegram bot:
```
https://example.com/article
```

Bot responds with preview and saves automatically.

**Commands:**
- `/recent` - Show recent bookmarks
- `/search query` - Search bookmarks
- `/tags` - List all tags
- `/stats` - Show statistics
- `/help` - Command reference

### Web Interface

Access your bookmarks at: `https://yourusername.github.io/hipervinculos/`

- Browse recent saves
- Search with filters (type, tags, read status)
- Edit titles, add tags, mark as read
- Mobile-responsive design

## Development

See [Development Guide](docs/DEVELOPMENT.md) for:
- Local development setup
- Testing workflows
- Contributing guidelines
- Architecture overview

## Documentation

- [Complete Specification](bookmark-complete-spec.md)
- [Setup Guide](docs/SETUP.md)
- [Telegram Commands](docs/COMMANDS.md)
- [API Reference](docs/API.md)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Status

🚧 **In Development** - See [CHANGELOG.md](CHANGELOG.md) for progress.
