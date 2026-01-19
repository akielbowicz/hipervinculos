#!/usr/bin/env node
/**
 * Backfill missing metadata for bookmarks.
 *
 * This script identifies bookmarks with poor metadata (title equals URL)
 * and re-fetches metadata from the original URLs.
 *
 * Usage:
 *   node scripts/backfill-metadata.js [options]
 *
 * Options:
 *   --dry-run       Preview changes without saving
 *   --limit N       Process only N bookmarks (default: all)
 *   --delay MS      Delay between requests in ms (default: 1000)
 *   --skip-archived Skip archived bookmarks
 *   --continue      Continue from last saved progress
 */

const fs = require('fs');
const path = require('path');
const { loadData, saveData } = require('./data-utils');

const TIMEOUT_MS = 10000;
const DEFAULT_DELAY_MS = 1000;
const PROGRESS_FILE = path.join(__dirname, '../data/.backfill-progress.json');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  limit: parseInt(args[args.indexOf('--limit') + 1]) || Infinity,
  delay: parseInt(args[args.indexOf('--delay') + 1]) || DEFAULT_DELAY_MS,
  skipArchived: args.includes('--skip-archived'),
  continue: args.includes('--continue'),
};

/**
 * Check if a bookmark needs metadata update
 */
function needsUpdate(bookmark) {
  // Title is missing or equals the URL (truncated or full)
  const titleIsUrl = !bookmark.title ||
    bookmark.title === bookmark.url ||
    bookmark.title.startsWith('http://') ||
    bookmark.title.startsWith('https://');

  // Description is missing or equals the URL
  const descriptionIsUrl = !bookmark.description ||
    bookmark.description === bookmark.url ||
    bookmark.description.startsWith('http://') ||
    bookmark.description.startsWith('https://');

  return titleIsUrl || descriptionIsUrl;
}

/**
 * Detect content type from URL
 */
function detectContentType(url) {
  const urlLower = url.toLowerCase();

  // Video platforms
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') ||
      urlLower.includes('vimeo.com') || urlLower.includes('twitch.tv')) {
    return 'video';
  }

  // Code platforms
  if (urlLower.includes('github.com') || urlLower.includes('gitlab.com') ||
      urlLower.includes('bitbucket.org') || urlLower.includes('codeberg.org')) {
    return 'code';
  }

  // Social/tweets
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com') ||
      urlLower.includes('bsky.app') || urlLower.includes('mastodon')) {
    return 'tweet';
  }

  // Images
  if (urlLower.includes('imgur.com') || urlLower.includes('flickr.com') ||
      urlLower.includes('unsplash.com') || urlLower.includes('pinterest.com')) {
    return 'image';
  }

  // PDFs
  if (urlLower.endsWith('.pdf')) {
    return 'pdf';
  }

  return 'article';
}

/**
 * Extract site name from URL
 */
function extractSiteName(url) {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Fetch metadata from a URL using native fetch (Node 18+)
 */
async function fetchMetadata(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HipervinculosBot/1.0; +https://github.com/akielbowicz/hipervinculos)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { partial: true, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const finalUrl = response.url || url;

    // Simple regex-based extraction (no cheerio dependency in scripts)
    const getMetaContent = (html, property) => {
      // Try og: properties
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                      html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      // Try twitter: properties
      const twitterMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                           html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${property}["']`, 'i'));
      if (twitterMatch) return twitterMatch[1];

      // Try standard meta for description
      if (property === 'description') {
        const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
        if (metaMatch) return metaMatch[1];
      }

      return undefined;
    };

    // Extract title
    let title = getMetaContent(html, 'title');
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : undefined;
    }

    // Decode HTML entities
    if (title) {
      title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .trim()
        .substring(0, 200);
    }

    const description = getMetaContent(html, 'description');
    const image = getMetaContent(html, 'image');
    const siteName = getMetaContent(html, 'site_name');

    return {
      title,
      description: description ? description.substring(0, 500) : undefined,
      image,
      site_name: siteName,
      url: finalUrl,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      partial: true,
      error: error.name === 'AbortError' ? 'Timeout' : error.message
    };
  }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load progress from file
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Could not load progress file:', e.message);
  }
  return { processedIds: [], lastIndex: 0 };
}

/**
 * Save progress to file
 */
function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Main execution
 */
async function main() {
  console.log('📚 Bookmark Metadata Backfill Script');
  console.log('=====================================');
  console.log(`Options: ${JSON.stringify(options, null, 2)}`);
  console.log('');

  // Load bookmarks
  const bookmarks = loadData('bookmarks.jsonl');
  console.log(`📖 Loaded ${bookmarks.length} bookmarks`);

  // Load progress if continuing
  let progress = { processedIds: new Set(), lastIndex: 0 };
  if (options.continue) {
    const savedProgress = loadProgress();
    progress.processedIds = new Set(savedProgress.processedIds);
    progress.lastIndex = savedProgress.lastIndex;
    console.log(`📌 Continuing from index ${progress.lastIndex}, ${progress.processedIds.size} already processed`);
  }

  // Find bookmarks needing update
  const toUpdate = bookmarks.filter((b, idx) => {
    if (options.skipArchived && b.is_archived) return false;
    if (options.continue && progress.processedIds.has(b.id)) return false;
    return needsUpdate(b);
  });

  console.log(`🔍 Found ${toUpdate.length} bookmarks needing metadata update`);

  if (toUpdate.length === 0) {
    console.log('✅ All bookmarks have good metadata!');
    return;
  }

  // Show sample of what will be updated
  console.log('\n📋 Sample of bookmarks to update:');
  toUpdate.slice(0, 5).forEach(b => {
    console.log(`  - ${b.url.substring(0, 60)}...`);
    console.log(`    Title: "${b.title?.substring(0, 50) || '(none)'}"`);
  });

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN - No changes will be made');
    console.log(`Would update ${Math.min(toUpdate.length, options.limit)} bookmarks`);

    // In dry run, test fetching first 3 URLs
    console.log('\n📡 Testing metadata fetch for first 3 URLs:');
    for (let i = 0; i < Math.min(3, toUpdate.length); i++) {
      const bookmark = toUpdate[i];
      console.log(`\n  Fetching: ${bookmark.url.substring(0, 60)}...`);
      const metadata = await fetchMetadata(bookmark.url);
      if (metadata.partial) {
        console.log(`  ❌ Failed: ${metadata.error}`);
      } else {
        console.log(`  ✅ Title: "${metadata.title?.substring(0, 50) || '(none)'}"`);
        console.log(`     Description: "${metadata.description?.substring(0, 50) || '(none)'}..."`);
      }
      if (i < 2) await sleep(options.delay);
    }
    return;
  }

  // Process bookmarks
  const limit = Math.min(toUpdate.length, options.limit);
  console.log(`\n🚀 Processing ${limit} bookmarks...`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  // Create a map for quick lookup
  const bookmarkMap = new Map(bookmarks.map((b, idx) => [b.id, { bookmark: b, index: idx }]));

  for (let i = 0; i < limit; i++) {
    const bookmark = toUpdate[i];
    const { index } = bookmarkMap.get(bookmark.id);

    process.stdout.write(`\r[${i + 1}/${limit}] Processing: ${bookmark.url.substring(0, 50)}...`);

    try {
      const metadata = await fetchMetadata(bookmark.url);

      if (metadata.partial) {
        failed++;
        console.log(`\n  ❌ Failed: ${metadata.error}`);
      } else {
        // Update bookmark with new metadata
        const updates = {};

        if (metadata.title && metadata.title !== bookmark.url) {
          updates.title = metadata.title;
        }

        if (metadata.description && metadata.description !== bookmark.url) {
          updates.description = metadata.description;
        }

        if (metadata.image) {
          updates.image = metadata.image;
        }

        if (metadata.site_name) {
          updates.site_name = metadata.site_name;
        } else if (!bookmark.site_name) {
          updates.site_name = extractSiteName(bookmark.url);
        }

        // Detect content type if not already correct
        const detectedType = detectContentType(bookmark.url);
        if (detectedType !== 'article' && bookmark.content_type === 'article') {
          updates.content_type = detectedType;
        }

        if (Object.keys(updates).length > 0) {
          Object.assign(bookmarks[index], updates);
          updated++;
        } else {
          skipped++;
        }
      }

      // Track progress
      progress.processedIds.add(bookmark.id);
      progress.lastIndex = i;

      // Save progress every 10 bookmarks
      if ((i + 1) % 10 === 0) {
        saveProgress({
          processedIds: [...progress.processedIds],
          lastIndex: progress.lastIndex,
        });
        saveData('bookmarks.jsonl', bookmarks);
        console.log(`\n  💾 Saved progress (${updated} updated, ${failed} failed)`);
      }

    } catch (error) {
      failed++;
      console.log(`\n  ❌ Error: ${error.message}`);
    }

    // Rate limiting
    if (i < limit - 1) {
      await sleep(options.delay);
    }
  }

  // Final save
  saveData('bookmarks.jsonl', bookmarks);

  // Clean up progress file on completion
  if (updated + failed + skipped >= toUpdate.length) {
    try {
      fs.unlinkSync(PROGRESS_FILE);
    } catch {}
  } else {
    saveProgress({
      processedIds: [...progress.processedIds],
      lastIndex: progress.lastIndex,
    });
  }

  console.log('\n\n=====================================');
  console.log('📊 Summary:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏭️  Skipped (no new data): ${skipped}`);
  console.log(`  📁 Saved to: data/bookmarks.jsonl`);

  if (toUpdate.length > limit) {
    console.log(`\n💡 ${toUpdate.length - limit} bookmarks remaining. Run again with --continue`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
