#!/usr/bin/env node
/**
 * Validate Bookmarks Data
 *
 * Checks bookmark data integrity:
 * - All bookmark IDs are unique
 * - No future timestamps
 * - All required fields present
 * - Valid URL formats
 * - Tags exist in tags.json
 * - Valid JSON structure
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

class Validator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.bookmarks = [];
    this.metadata = {};
    this.tags = {};
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  error(message) {
    this.errors.push(message);
    this.log(`❌ ${message}`, 'red');
  }

  warn(message) {
    this.warnings.push(message);
    this.log(`⚠️  ${message}`, 'yellow');
  }

  info(message) {
    this.log(`ℹ️  ${message}`, 'blue');
  }

  success(message) {
    this.log(`✅ ${message}`, 'green');
  }

  loadData() {
    try {
      // Load bookmarks
      const bookmarksPath = path.join(__dirname, '../data/bookmarks.json');
      this.bookmarks = JSON.parse(fs.readFileSync(bookmarksPath, 'utf8'));
      this.info(`Loaded ${this.bookmarks.length} bookmarks`);

      // Load metadata
      const metadataPath = path.join(__dirname, '../data/metadata.json');
      this.metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      this.info('Loaded metadata');

      // Load tags
      const tagsPath = path.join(__dirname, '../data/tags.json');
      this.tags = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
      this.info(`Loaded ${this.tags.tags?.length || 0} tag definitions`);

      return true;
    } catch (err) {
      this.error(`Failed to load data: ${err.message}`);
      return false;
    }
  }

  validateUniqueIds() {
    const ids = new Set();
    const duplicates = [];

    for (const bookmark of this.bookmarks) {
      if (!bookmark.id) {
        this.error(`Bookmark missing ID: ${bookmark.url || 'unknown'}`);
        continue;
      }

      if (ids.has(bookmark.id)) {
        duplicates.push(bookmark.id);
      }
      ids.add(bookmark.id);
    }

    if (duplicates.length > 0) {
      this.error(`Found ${duplicates.length} duplicate IDs: ${duplicates.join(', ')}`);
    } else {
      this.success('All bookmark IDs are unique');
    }
  }

  validateTimestamps() {
    const now = new Date();
    const futureBookmarks = [];

    for (const bookmark of this.bookmarks) {
      if (!bookmark.timestamp) {
        this.error(`Bookmark ${bookmark.id} missing timestamp`);
        continue;
      }

      const timestamp = new Date(bookmark.timestamp);
      if (timestamp > now) {
        futureBookmarks.push({
          id: bookmark.id,
          timestamp: bookmark.timestamp
        });
      }

      // Check modified_timestamp if present
      if (bookmark.modified_timestamp) {
        const modifiedTimestamp = new Date(bookmark.modified_timestamp);
        if (modifiedTimestamp > now) {
          this.warn(`Bookmark ${bookmark.id} has future modified_timestamp`);
        }
        if (modifiedTimestamp < timestamp) {
          this.warn(`Bookmark ${bookmark.id} modified_timestamp before timestamp`);
        }
      }
    }

    if (futureBookmarks.length > 0) {
      this.error(`Found ${futureBookmarks.length} bookmarks with future timestamps`);
      futureBookmarks.forEach(b => {
        console.log(`  ${b.id}: ${b.timestamp}`);
      });
    } else {
      this.success('All timestamps are valid');
    }
  }

  validateRequiredFields() {
    const required = ['id', 'url', 'title', 'timestamp'];
    const missing = [];

    for (const bookmark of this.bookmarks) {
      const bookmarkMissing = [];
      for (const field of required) {
        if (!bookmark[field]) {
          bookmarkMissing.push(field);
        }
      }

      if (bookmarkMissing.length > 0) {
        missing.push({
          id: bookmark.id || 'unknown',
          fields: bookmarkMissing
        });
      }
    }

    if (missing.length > 0) {
      this.error(`Found ${missing.length} bookmarks with missing required fields`);
      missing.forEach(b => {
        console.log(`  ${b.id}: missing ${b.fields.join(', ')}`);
      });
    } else {
      this.success('All bookmarks have required fields');
    }
  }

  validateUrls() {
    const invalid = [];

    for (const bookmark of this.bookmarks) {
      if (!bookmark.url) continue;

      try {
        const url = new URL(bookmark.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          invalid.push({
            id: bookmark.id,
            url: bookmark.url,
            reason: 'Invalid protocol (must be http or https)'
          });
        }
      } catch (err) {
        invalid.push({
          id: bookmark.id,
          url: bookmark.url,
          reason: 'Malformed URL'
        });
      }
    }

    if (invalid.length > 0) {
      this.error(`Found ${invalid.length} bookmarks with invalid URLs`);
      invalid.forEach(b => {
        console.log(`  ${b.id}: ${b.reason}`);
      });
    } else {
      this.success('All URLs are valid');
    }
  }

  validateTags() {
    const definedTags = new Set(this.tags.tags?.map(t => t.name) || []);
    const undefinedTags = new Set();
    const unusedTags = new Set(definedTags);

    for (const bookmark of this.bookmarks) {
      if (!bookmark.tags || !Array.isArray(bookmark.tags)) {
        this.warn(`Bookmark ${bookmark.id} has no tags or tags is not an array`);
        continue;
      }

      for (const tag of bookmark.tags) {
        if (!definedTags.has(tag)) {
          undefinedTags.add(tag);
        } else {
          unusedTags.delete(tag);
        }
      }
    }

    if (undefinedTags.size > 0) {
      this.warn(`Found ${undefinedTags.size} undefined tags: ${Array.from(undefinedTags).join(', ')}`);
    }

    if (unusedTags.size > 0) {
      this.info(`${unusedTags.size} tags defined but not used: ${Array.from(unusedTags).join(', ')}`);
    }

    if (undefinedTags.size === 0 && unusedTags.size === 0) {
      this.success('All tags are properly defined');
    }
  }

  validateContentTypes() {
    const validTypes = ['article', 'video', 'image', 'pdf', 'code', 'tweet', 'other'];
    const invalid = [];

    for (const bookmark of this.bookmarks) {
      if (bookmark.content_type && !validTypes.includes(bookmark.content_type)) {
        invalid.push({
          id: bookmark.id,
          type: bookmark.content_type
        });
      }
    }

    if (invalid.length > 0) {
      this.error(`Found ${invalid.length} bookmarks with invalid content_type`);
      invalid.forEach(b => {
        console.log(`  ${b.id}: ${b.type}`);
      });
    } else {
      this.success('All content types are valid');
    }
  }

  validateMetadata() {
    if (this.metadata.total_bookmarks !== this.bookmarks.length) {
      this.warn(`Metadata total_bookmarks (${this.metadata.total_bookmarks}) doesn't match actual count (${this.bookmarks.length})`);
    }

    // Validate statistics match actual counts
    const actualStats = {
      by_type: {},
      by_read_status: { unread: 0, reading: 0, read: 0 },
      favorites_count: 0,
      private_count: 0,
      archived_count: 0
    };

    for (const bookmark of this.bookmarks) {
      // Count by type
      const type = bookmark.content_type || 'other';
      actualStats.by_type[type] = (actualStats.by_type[type] || 0) + 1;

      // Count by read status
      const status = bookmark.read_status || 'unread';
      if (actualStats.by_read_status[status] !== undefined) {
        actualStats.by_read_status[status]++;
      }

      // Count flags
      if (bookmark.is_favorite) actualStats.favorites_count++;
      if (bookmark.is_private) actualStats.private_count++;
      if (bookmark.is_archived) actualStats.archived_count++;
    }

    // Check if metadata stats match
    const statsMatch = JSON.stringify(actualStats.by_type) === JSON.stringify(this.metadata.statistics?.by_type || {});
    if (!statsMatch) {
      this.warn('Metadata statistics may be out of sync (run: node scripts/update-metadata.js)');
    } else {
      this.success('Metadata statistics are accurate');
    }
  }

  run() {
    console.log('\n📋 Validating Bookmark Data\n');

    if (!this.loadData()) {
      return false;
    }

    console.log('');
    this.validateUniqueIds();
    this.validateTimestamps();
    this.validateRequiredFields();
    this.validateUrls();
    this.validateTags();
    this.validateContentTypes();
    this.validateMetadata();

    console.log('\n📊 Validation Summary\n');
    console.log(`Total bookmarks: ${this.bookmarks.length}`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log('');

    if (this.errors.length === 0) {
      this.success('✨ All validation checks passed!');
      return true;
    } else {
      this.log('❌ Validation failed with errors', 'red');
      return false;
    }
  }
}

// Run validation
const validator = new Validator();
const success = validator.run();
process.exit(success ? 0 : 1);
