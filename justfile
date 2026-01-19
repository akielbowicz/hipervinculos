# Justfile for Hipervínculos Bookmark Manager
# Run `just` or `just --list` to see available commands

# Default recipe (show help)
default:
    @just --list

# === Setup & Installation ===

# Install all dependencies
setup:
    @echo "📦 Installing Node.js dependencies..."
    npm install
    @echo "✅ Setup complete!"

# Install Pagefind CLI
setup-pagefind:
    @echo "📦 Installing Pagefind..."
    npm install -g pagefind
    @echo "✅ Pagefind installed!"

# Install Wrangler (Cloudflare Workers CLI)
setup-wrangler:
    @echo "📦 Installing Wrangler..."
    npm install -g wrangler
    @echo "✅ Wrangler installed!"

# Complete development environment setup
setup-dev: setup setup-pagefind setup-wrangler
    @echo "🎉 Development environment ready!"

# === Development Commands ===

# Build the static site (generate pages + Pagefind index)
build:
    @echo "🏗️  Building static site..."
    node scripts/generate-pages.js
    npx pagefind --site .
    node scripts/update-metadata.js
    @echo "✅ Build complete!"

# Serve the site locally
serve:
    @echo "🌐 Starting local server at http://localhost:8000"
    @echo "Press Ctrl+C to stop"
    python3 -m http.server 8000

# Build and serve in one command
dev: build serve

# Run Cloudflare Worker locally
worker-dev:
    @echo "⚡ Starting Worker in development mode..."
    cd worker && wrangler dev

# === Data Management ===

# Add a bookmark locally
add url title="":
    @node scripts/add-bookmark.js "{{url}}" "{{title}}"

# Split bookmarks with multiple URLs (dry run by default)
split-bookmarks *args="":
    @node scripts/split-bookmarks.js {{args}}

# Validate bookmark data integrity
validate:
    @echo "🔍 Validating bookmark data..."
    node scripts/validate-bookmarks.js

# Update metadata statistics
update-metadata:
    @echo "📊 Updating metadata..."
    node scripts/update-metadata.js

# Check for broken external links
check-links:
    @echo "🔗 Checking external links..."
    node scripts/check-links.js

# Show bookmark statistics
stats:
    @echo "📊 Bookmark Statistics"
    @echo "======================"
    @node -e "const {loadData}=require('./scripts/data-utils'); const data=loadData('bookmarks.jsonl'); const meta=require('./data/metadata.json'); console.log('Total bookmarks:', meta.total_bookmarks); console.log('Unread:', meta.statistics.by_read_status.unread); console.log('Favorites:', meta.statistics.favorites_count); console.log('Private:', meta.statistics.private_count); console.log(''); console.log('By Type:'); Object.entries(meta.statistics.by_type).forEach(([k,v])=>console.log('  '+k+':', v));"

# List all tags with usage counts
tags:
    @echo "🏷️  Tags"
    @echo "======="
    @node -e "const meta=require('./data/metadata.json'); Object.entries(meta.tags_usage).sort((a,b)=>b[1]-a[1]).forEach(([tag,count])=>console.log(count.toString().padStart(4)+' - '+tag));"

# List recent bookmarks (default: 10)
recent n="10":
    @echo "📚 Recent Bookmarks (last {{n}})"
    @echo "================================"
    @node -e "const {loadData}=require('./scripts/data-utils'); const data=loadData('bookmarks.jsonl'); data.slice(-{{n}}).reverse().forEach(b=>console.log(b.timestamp.slice(0,10)+' - '+b.title+' ('+b.site_name+')'))"

# Search bookmarks by keyword
search query:
    @echo "🔍 Search results for: {{query}}"
    @echo "================================"
    @node -e "const {loadData}=require('./scripts/data-utils'); const data=loadData('bookmarks.jsonl'); const q='{{query}}'.toLowerCase(); data.filter(b=>b.title.toLowerCase().includes(q)||b.description?.toLowerCase().includes(q)||b.tags.some(t=>t.includes(q))).forEach(b=>console.log('🔖 '+b.title+' ('+b.site_name+')'+'\\n   🔗 '+b.url+'\\n'))"

# Find bookmarks by tag
find-tag tag:
    @echo "🏷️  Bookmarks tagged: {{tag}}"
    @echo "=========================="
    @node -e "const {loadData}=require('./scripts/data-utils'); const data=loadData('bookmarks.jsonl'); data.filter(b=>b.tags.includes('{{tag}}')).forEach(b=>console.log('🔖 '+b.title+'\\n   🔗 '+b.url+'\\n'))"

# List unread bookmarks
unread:
    @echo "📭 Unread Bookmarks"
    @echo "=================="
    @node -e "const {loadData}=require('./scripts/data-utils'); const data=loadData('bookmarks.jsonl'); data.filter(b=>b.read_status==='unread').slice(-20).reverse().forEach(b=>console.log('🔖 '+b.title+' ('+b.site_name+')'))"

# List favorite bookmarks
favorites:
    @echo "⭐ Favorite Bookmarks"
    @echo "===================="
    @node -e "const {loadData}=require('./scripts/data-utils'); const data=loadData('bookmarks.jsonl'); data.filter(b=>b.is_favorite).reverse().forEach(b=>console.log('🔖 '+b.title+' ('+b.site_name+')'))"

# === Import/Export ===

# Import bookmarks from file (format: pinboard|pocket|html|csv)
import format file:
    @echo "📥 Importing bookmarks from {{file}} (format: {{format}})"
    node scripts/import.js --format {{format}} --file {{file}}

# Export bookmarks to file (format: json|html|csv|markdown)
export format output:
    @echo "📤 Exporting bookmarks to {{output}} (format: {{format}})"
    node scripts/export.js --format {{format}} --output {{output}}

# === Worker Management ===

# Deploy Cloudflare Worker to production
worker-deploy:
    @echo "🚀 Deploying Worker to Cloudflare..."
    cd worker && wrangler deploy
    @echo "✅ Worker deployed!"

# Set Worker secret (example: just worker-secret TELEGRAM_BOT_TOKEN)
worker-secret name:
    @echo "🔐 Setting secret: {{name}}"
    cd worker && wrangler secret put {{name}}

# Show Worker logs
worker-logs:
    cd worker && wrangler tail

# === Git & Versioning ===

# Update CHANGELOG with new entry
changelog message:
    @echo "📝 Updating CHANGELOG..."
    @echo "\n$(date '+%Y-%m-%d') - {{message}}" >> CHANGELOG.md
    @echo "✅ CHANGELOG updated!"

# Commit bookmark data changes
commit-data message:
    @echo "💾 Committing data changes..."
    git add data/
    git commit -m "data: {{message}}"
    @echo "✅ Changes committed!"

# === Testing & Quality ===

# Run all validation checks
test: validate check-links
    @echo "✅ All tests passed!"

# Clean generated files
clean:
    @echo "🧹 Cleaning generated files..."
    rm -rf pages/*.html
    rm -rf pagefind/
    @echo "✅ Clean complete!"

# Rebuild everything from scratch
rebuild: clean build
    @echo "✅ Rebuild complete!"

# === Documentation ===

# Generate API documentation
docs-api:
    @echo "📚 Generating API documentation..."
    node scripts/generate-api-docs.js
    @echo "✅ API docs generated!"

# Open spec in default editor
spec:
    $EDITOR specs/bookmark-complete-spec.md

# === Quick Actions ===

# Quick status check (validate + stats)
status: validate stats

# Pre-push checks (validate + test + build)
pre-push: validate test build
    @echo "✅ Pre-push checks passed! Safe to push."

# Full CI pipeline (what runs on GitHub Actions)
ci: validate test build
    @echo "✅ CI pipeline passed!"

# === Utility Commands ===

# Format JSON files
fmt:
    @echo "✨ Formatting JSON files..."
    @for file in data/*.json; do \
        jq '.' $$file > $$file.tmp && mv $$file.tmp $$file; \
    done
    @echo "✅ Formatting complete!"

# Show repository size
size:
    @echo "📏 Repository Size"
    @echo "=================="
    @echo -n "Bookmarks data: "
    @du -h data/bookmarks.jsonl | cut -f1
    @echo -n "Pages: "
    @du -sh pages/ 2>/dev/null | cut -f1 || echo "Not built yet"
    @echo -n "Pagefind index: "
    @du -sh pagefind/ 2>/dev/null | cut -f1 || echo "Not built yet"
    @echo -n "Total repo: "
    @du -sh . | cut -f1

# Health check (all systems)
health:
    @echo "🏥 System Health Check"
    @echo "====================="
    @echo -n "Data files: "
    @test -f data/bookmarks.jsonl && test -f data/metadata.json && test -f data/tags.jsonl && echo "✅" || echo "❌"
    @echo -n "Node modules: "
    @test -d node_modules && echo "✅" || echo "❌ (run: just setup)"
    @echo -n "Pagefind: "
    @which pagefind > /dev/null && echo "✅" || echo "❌ (run: just setup-pagefind)"
    @echo -n "Wrangler: "
    @which wrangler > /dev/null && echo "✅" || echo "❌ (run: just setup-wrangler)"
    @echo -n "Worker config: "
    @test -f worker/wrangler.toml && echo "✅" || echo "❌"
    @echo ""
    @just validate
