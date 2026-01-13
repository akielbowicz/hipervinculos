#!/usr/bin/env node
/**
 * Generate HTML Pages for Pagefind
 *
 * Creates individual HTML pages for each bookmark to be indexed by Pagefind.
 * Private bookmarks are excluded from generation.
 */

const fs = require('fs');
const path = require('path');

const bookmarksPath = path.join(__dirname, '../data/bookmarks.json');
const pagesDir = path.join(__dirname, '../pages');

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function generateHtml(bookmark) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(bookmark.title)}</title>
</head>
<body>
  <article data-pagefind-body>
    <h1>${escapeHtml(bookmark.title)}</h1>
    ${bookmark.description ? `<p>${escapeHtml(bookmark.description)}</p>` : ''}
    <a href="${escapeHtml(bookmark.url)}">${escapeHtml(bookmark.url)}</a>
    <time datetime="${bookmark.timestamp}">${bookmark.timestamp}</time>

    <!-- Metadata for filtering -->
    <div data-pagefind-meta="type">${escapeHtml(bookmark.content_type || 'other')}</div>
    <div data-pagefind-meta="site">${escapeHtml(bookmark.site_name || '')}</div>
    <div data-pagefind-meta="author">${escapeHtml(bookmark.author || '')}</div>
    <div data-pagefind-meta="read_status">${escapeHtml(bookmark.read_status || 'unread')}</div>
    <div data-pagefind-meta="is_favorite">${bookmark.is_favorite ? 'true' : 'false'}</div>
    <div data-pagefind-meta="is_archived">${bookmark.is_archived ? 'true' : 'false'}</div>

    <!-- Tags -->
    ${bookmark.tags && bookmark.tags.length > 0 ? `
    <div data-pagefind-meta="tags">${bookmark.tags.map(escapeHtml).join(', ')}</div>
    <div class="tags">
      ${bookmark.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
    </div>
    ` : ''}

    <!-- Notes (searchable) -->
    ${bookmark.notes ? `
    <div data-pagefind-body>
      <h2>Notes</h2>
      <p>${escapeHtml(bookmark.notes)}</p>
    </div>
    ` : ''}

    <!-- Bookmark ID (hidden but searchable) -->
    <div data-pagefind-meta="id">${escapeHtml(bookmark.id)}</div>
  </article>
</body>
</html>
`;
}

try {
  console.log('📄 Generating HTML pages for Pagefind...');

  // Load bookmarks
  const bookmarks = JSON.parse(fs.readFileSync(bookmarksPath, 'utf8'));
  console.log(`📚 Loaded ${bookmarks.length} bookmarks`);

  // Ensure pages directory exists
  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true });
  }

  // Clean existing pages
  const existingPages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
  for (const page of existingPages) {
    fs.unlinkSync(path.join(pagesDir, page));
  }
  console.log(`🧹 Removed ${existingPages.length} existing pages`);

  // Generate new pages
  let generated = 0;
  let skipped = 0;

  for (const bookmark of bookmarks) {
    // Skip private bookmarks
    if (bookmark.is_private) {
      skipped++;
      continue;
    }

    const html = generateHtml(bookmark);
    const filename = `${bookmark.id}.html`;
    fs.writeFileSync(path.join(pagesDir, filename), html);
    generated++;
  }

  console.log(`✅ Generated ${generated} HTML pages`);
  if (skipped > 0) {
    console.log(`🔒 Skipped ${skipped} private bookmarks`);
  }

} catch (err) {
  console.error('❌ Error generating pages:', err.message);
  process.exit(1);
}
