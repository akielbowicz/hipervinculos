#!/usr/bin/env node
/**
 * Split bookmarks that contain multiple URLs in title/description/notes.
 * Creates new bookmarks for each extra URL found.
 * 
 * Usage:
 *   node scripts/split-bookmarks.js              # Dry run - show what would be split
 *   node scripts/split-bookmarks.js --apply      # Apply changes
 *   node scripts/split-bookmarks.js --id <id>    # Process specific bookmark only
 */

const { loadData, saveData } = require('./data-utils');
const crypto = require('crypto');

const URL_REGEX = /https?:\/\/[^\s"<>\)]+/g;
const IMAGE_EXTS = /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp)$/i;

function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX) || [];
  return matches
    .map(u => u.replace(/[.,;:!?\]]+$/, '')) // Clean trailing punctuation
    .filter(u => !IMAGE_EXTS.test(u))
    .filter(u => !u.includes('t.co/')); // Skip twitter shortlinks
}

function findExtraUrls(bookmark) {
  const text = [
    bookmark.title || '',
    bookmark.description || '',
    bookmark.notes || ''
  ].join(' ');

  const urls = extractUrls(text);
  const mainUrl = bookmark.url.replace(/\/$/, '').toLowerCase();

  return [...new Set(urls)].filter(u => {
    const normalized = u.replace(/\/$/, '').toLowerCase();
    return normalized !== mainUrl &&
           !mainUrl.includes(normalized) &&
           !normalized.includes(mainUrl);
  });
}

function createBookmark(url, parent) {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    url: url,
    url_normalized: url.replace(/\/$/, '').toLowerCase(),
    url_hash: crypto.createHash('sha256').update(url).digest('hex').slice(0, 16),
    title: hostname,
    description: `Split from: ${parent.title || parent.url}`,
    content_type: 'article',
    site_name: hostname,
    timestamp: parent.timestamp,
    tags: [...(parent.tags || [])],
    is_private: parent.is_private || false,
    is_archived: parent.is_archived || false,
    is_favorite: false,
    read_status: 'unread',
    source: 'split',
    split_from: parent.id
  };
}

// Parse args
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const idIndex = args.indexOf('--id');
const targetId = idIndex !== -1 ? args[idIndex + 1] : null;

const bookmarks = loadData('bookmarks.jsonl');
const existingUrls = new Set(bookmarks.map(b => b.url.replace(/\/$/, '').toLowerCase()));

const toSplit = [];
const newBookmarks = [];

for (const bookmark of bookmarks) {
  if (targetId && bookmark.id !== targetId) continue;

  const extraUrls = findExtraUrls(bookmark);
  if (extraUrls.length === 0) continue;

  const uniqueExtras = extraUrls.filter(u => {
    const norm = u.replace(/\/$/, '').toLowerCase();
    return !existingUrls.has(norm);
  });

  if (uniqueExtras.length === 0) continue;

  toSplit.push({
    id: bookmark.id,
    title: (bookmark.title || bookmark.url).slice(0, 50),
    mainUrl: bookmark.url,
    extraUrls: uniqueExtras
  });

  for (const url of uniqueExtras) {
    const newBm = createBookmark(url, bookmark);
    if (newBm) {
      newBookmarks.push(newBm);
      existingUrls.add(newBm.url_normalized);
    }
  }
}

if (toSplit.length === 0) {
  console.log('✅ No bookmarks to split.');
  process.exit(0);
}

console.log(`\n📚 Found ${toSplit.length} bookmarks with extra URLs:\n`);

for (const item of toSplit.slice(0, 15)) {
  console.log(`  "${item.title}..."`);
  for (const url of item.extraUrls) {
    console.log(`    → ${url.slice(0, 70)}`);
  }
  console.log('');
}

if (toSplit.length > 15) {
  console.log(`  ... and ${toSplit.length - 15} more\n`);
}

console.log(`Total new bookmarks to create: ${newBookmarks.length}\n`);

if (apply) {
  const all = [...bookmarks, ...newBookmarks];
  saveData('bookmarks.jsonl', all);
  console.log(`✅ Created ${newBookmarks.length} new bookmarks`);
} else {
  console.log('⚠️  Dry run - no changes made');
  console.log('Run with --apply to save changes');
}
