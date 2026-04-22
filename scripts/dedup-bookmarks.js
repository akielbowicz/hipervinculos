#!/usr/bin/env node
/**
 * Deduplicate bookmarks in data/bookmarks.jsonl.
 *
 * Usage:
 *   node scripts/dedup-bookmarks.js             # dry run
 *   node scripts/dedup-bookmarks.js --apply     # write changes
 *   node scripts/dedup-bookmarks.js --apply --keep=oldest
 *
 * Strategies:
 *   --keep=richest  Keep the bookmark with the most metadata (default)
 *   --keep=oldest   Keep the earliest bookmark in each duplicate group
 *   --keep=newest   Keep the latest bookmark in each duplicate group
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadData, saveData } = require('./data-utils');

const BOOKMARKS_FILE = 'bookmarks.jsonl';
const DATA_DIR = path.join(__dirname, '../data');
const APPLY = process.argv.includes('--apply');
const strategyArg = process.argv.find(arg => arg.startsWith('--keep='));
const KEEP_STRATEGY = strategyArg ? strategyArg.split('=')[1] : 'richest';
const VALID_STRATEGIES = new Set(['richest', 'oldest', 'newest']);

if (!VALID_STRATEGIES.has(KEEP_STRATEGY)) {
  console.error(`❌ Invalid strategy: ${KEEP_STRATEGY}`);
  console.error('   Valid values: richest, oldest, newest');
  process.exit(1);
}

function normalizeUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    parsed.hash = '';

    if ((parsed.protocol === 'http:' && parsed.port === '80') ||
        (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }

    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }

    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return url.replace(/\/+$/, '').trim();
  }
}

function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function timestampValue(bookmark) {
  const value = Date.parse(bookmark.timestamp || '');
  return Number.isNaN(value) ? 0 : value;
}

function richnessScore(bookmark) {
  let score = 0;

  const scalarFields = [
    'title',
    'description',
    'image',
    'site_name',
    'author',
    'content_type',
    'notes',
    'favicon',
    'read_status',
    'source',
    'url_normalized',
    'url_hash',
  ];

  for (const field of scalarFields) {
    if (bookmark[field]) score += 1;
  }

  score += Array.isArray(bookmark.tags) ? bookmark.tags.length : 0;
  if (bookmark.is_favorite) score += 2;
  if (bookmark.is_private) score += 1;
  if (bookmark.modified_timestamp) score += 1;

  return score;
}

function compareBookmarks(a, b, strategy) {
  if (strategy === 'oldest') {
    return timestampValue(a) - timestampValue(b);
  }

  if (strategy === 'newest') {
    return timestampValue(b) - timestampValue(a);
  }

  const scoreDiff = richnessScore(b) - richnessScore(a);
  if (scoreDiff !== 0) return scoreDiff;

  return timestampValue(a) - timestampValue(b);
}

function pickCanonical(group, strategy) {
  return [...group].sort((a, b) => compareBookmarks(a, b, strategy))[0];
}

function mergeBookmarks(group, strategy) {
  const canonical = pickCanonical(group, strategy);
  const normalizedUrl = normalizeUrl(canonical.url_normalized || canonical.url);

  const merged = {
    ...canonical,
    url_normalized: normalizedUrl || canonical.url_normalized || canonical.url,
    url_hash: canonical.url_hash || (normalizedUrl ? hashUrl(normalizedUrl) : canonical.url_hash),
  };

  const preferredScalarFields = [
    'title',
    'description',
    'image',
    'site_name',
    'author',
    'content_type',
    'notes',
    'favicon',
    'read_status',
    'source',
    'extraction_status',
    'extraction_duration_ms',
  ];

  for (const bookmark of group) {
    for (const field of preferredScalarFields) {
      if (!merged[field] && bookmark[field]) {
        merged[field] = bookmark[field];
      }
    }
  }

  merged.tags = [...new Set(group.flatMap(bookmark => Array.isArray(bookmark.tags) ? bookmark.tags : []))].sort();

  if (!merged.modified_timestamp) {
    const modifiedTimestamps = group
      .map(bookmark => bookmark.modified_timestamp)
      .filter(Boolean)
      .sort();

    if (modifiedTimestamps.length > 0) {
      merged.modified_timestamp = modifiedTimestamps[modifiedTimestamps.length - 1];
    }
  }

  return merged;
}

function backupBookmarks() {
  const sourcePath = path.join(DATA_DIR, BOOKMARKS_FILE);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(DATA_DIR, `bookmarks.${stamp}.bak.jsonl`);
  fs.copyFileSync(sourcePath, backupPath);
  return backupPath;
}

function main() {
  const bookmarks = loadData(BOOKMARKS_FILE);

  if (bookmarks.length === 0) {
    console.log('ℹ️  No bookmarks found.');
    return;
  }

  const groups = new Map();

  for (const bookmark of bookmarks) {
    const key = normalizeUrl(bookmark.url_normalized || bookmark.url) || bookmark.url;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bookmark);
  }

  const duplicateGroups = [...groups.entries()].filter(([, group]) => group.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate bookmarks found.');
    return;
  }

  const mergedByKey = new Map();
  for (const [key, group] of duplicateGroups) {
    mergedByKey.set(key, mergeBookmarks(group, KEEP_STRATEGY));
  }

  const dedupedBookmarks = [];
  const seenKeys = new Set();

  for (const bookmark of bookmarks) {
    const key = normalizeUrl(bookmark.url_normalized || bookmark.url) || bookmark.url;

    if (mergedByKey.has(key)) {
      if (seenKeys.has(key)) continue;
      dedupedBookmarks.push(mergedByKey.get(key));
      seenKeys.add(key);
      continue;
    }

    dedupedBookmarks.push({
      ...bookmark,
      ...(key ? { url_normalized: bookmark.url_normalized || key } : {}),
      ...(key ? { url_hash: bookmark.url_hash || hashUrl(key) } : {}),
    });
  }

  const duplicatesRemoved = bookmarks.length - dedupedBookmarks.length;

  console.log(`🔎 Found ${duplicateGroups.length} duplicate groups`);
  console.log(`🧹 Would remove ${duplicatesRemoved} duplicate bookmarks`);
  console.log(`📌 Strategy: keep=${KEEP_STRATEGY}`);
  console.log('');

  for (const [key, group] of duplicateGroups.slice(0, 20)) {
    const merged = mergedByKey.get(key);
    console.log(`• ${key}`);
    console.log(`  keep:   ${merged.id}  ${merged.title || merged.url}`);
    for (const bookmark of group) {
      const label = bookmark.id === merged.id ? 'keep' : 'drop';
      console.log(`  ${label.padEnd(6)} ${bookmark.id}  ${bookmark.timestamp || 'no-timestamp'}  ${bookmark.url}`);
    }
    console.log('');
  }

  if (duplicateGroups.length > 20) {
    console.log(`… ${duplicateGroups.length - 20} more duplicate groups omitted`);
    console.log('');
  }

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to write changes.');
    return;
  }

  const backupPath = backupBookmarks();
  saveData(BOOKMARKS_FILE, dedupedBookmarks);

  console.log(`✅ Deduplicated bookmarks written to data/${BOOKMARKS_FILE}`);
  console.log(`🗂️  Backup created: ${path.relative(process.cwd(), backupPath)}`);
  console.log('ℹ️  Recommended next steps: just validate && just update-metadata');
}

main();
