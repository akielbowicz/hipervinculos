#!/usr/bin/env node
/**
 * Update Metadata Statistics
 *
 * Recalculates and updates statistics in metadata.json based on current bookmarks.
 */

const fs = require('fs');
const path = require('path');
const { loadData } = require('./data-utils');

const metadataPath = path.join(__dirname, '../data/metadata.json');

try {
  console.log('📊 Updating metadata statistics...');

  // Load bookmarks
  const bookmarks = loadData('bookmarks.jsonl');
  console.log(`📚 Loaded ${bookmarks.length} bookmarks`);

  // Load existing metadata
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

  // Calculate statistics
  const stats = {
    by_type: {
      article: 0,
      video: 0,
      image: 0,
      pdf: 0,
      code: 0,
      tweet: 0,
      other: 0
    },
    by_read_status: {
      unread: 0,
      reading: 0,
      read: 0
    },
    favorites_count: 0,
    private_count: 0,
    archived_count: 0
  };

  const tagsUsage = {};
  let lastBookmarkId = null;
  let lastTimestamp = null;

  for (const bookmark of bookmarks) {
    // Count by type
    const type = bookmark.content_type || 'other';
    if (stats.by_type[type] !== undefined) {
      stats.by_type[type]++;
    }

    // Count by read status
    const status = bookmark.read_status || 'unread';
    if (stats.by_read_status[status] !== undefined) {
      stats.by_read_status[status]++;
    }

    // Count flags
    if (bookmark.is_favorite) stats.favorites_count++;
    if (bookmark.is_private) stats.private_count++;
    if (bookmark.is_archived) stats.archived_count++;

    // Count tags
    if (bookmark.tags && Array.isArray(bookmark.tags)) {
      for (const tag of bookmark.tags) {
        tagsUsage[tag] = (tagsUsage[tag] || 0) + 1;
      }
    }

    // Track last bookmark
    if (!lastTimestamp || new Date(bookmark.timestamp) > new Date(lastTimestamp)) {
      lastTimestamp = bookmark.timestamp;
      lastBookmarkId = bookmark.id;
    }
  }

  // Update metadata
  metadata.total_bookmarks = bookmarks.length;
  metadata.last_updated = new Date().toISOString();
  metadata.last_bookmark_id = lastBookmarkId;
  metadata.statistics = stats;
  metadata.tags_usage = tagsUsage;

  // Write updated metadata
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');

  console.log('✅ Metadata updated successfully!');
  console.log('');
  console.log('Statistics:');
  console.log(`  Total: ${metadata.total_bookmarks}`);
  console.log(`  Unread: ${stats.by_read_status.unread}`);
  console.log(`  Favorites: ${stats.favorites_count}`);
  console.log(`  Private: ${stats.private_count}`);
  console.log(`  Tags: ${Object.keys(tagsUsage).length}`);

} catch (err) {
  console.error('❌ Error updating metadata:', err.message);
  process.exit(1);
}
