#!/usr/bin/env node
/**
 * Add a bookmark locally from the command line.
 * 
 * Usage:
 *   node scripts/add-bookmark.js <url> [title]
 *   node scripts/add-bookmark.js https://example.com
 *   node scripts/add-bookmark.js https://example.com "My Title"
 */

const { loadData, saveData } = require('./data-utils');
const crypto = require('crypto');

const url = process.argv[2];
const title = process.argv[3];

if (!url) {
  console.error('Usage: node scripts/add-bookmark.js <url> [title]');
  process.exit(1);
}

// Validate URL
try {
  new URL(url);
} catch {
  console.error('❌ Invalid URL:', url);
  process.exit(1);
}

const bookmarks = loadData('bookmarks.jsonl');

// Check for duplicates
const normalized = url.replace(/\/$/, '').toLowerCase();
const existing = bookmarks.find(b => 
  b.url === url || 
  b.url_normalized === normalized ||
  b.url.replace(/\/$/, '').toLowerCase() === normalized
);

if (existing) {
  console.error('⚠️  Already bookmarked:');
  console.error(`   ${existing.title}`);
  console.error(`   ID: ${existing.id}`);
  console.error(`   Saved: ${existing.timestamp.slice(0, 10)}`);
  process.exit(1);
}

// Create bookmark
const hostname = new URL(url).hostname.replace('www.', '');
const bookmark = {
  id: crypto.randomUUID(),
  url: url,
  url_normalized: normalized,
  url_hash: crypto.createHash('sha256').update(url).digest('hex').slice(0, 16),
  title: title || hostname,
  description: '',
  content_type: 'article',
  site_name: hostname,
  timestamp: new Date().toISOString(),
  tags: [],
  is_private: false,
  is_archived: false,
  is_favorite: false,
  read_status: 'unread',
  source: 'cli'
};

bookmarks.push(bookmark);
saveData('bookmarks.jsonl', bookmarks);

console.log('✅ Saved!');
console.log(`   ${bookmark.title}`);
console.log(`   ID: ${bookmark.id}`);
console.log(`   Run 'just build' to update the index.`);
