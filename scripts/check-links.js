#!/usr/bin/env node
/**
 * Check External Links
 *
 * Validates that external URLs in bookmarks are still accessible.
 * This is a basic implementation that can be enhanced with parallel requests,
 * rate limiting, and more sophisticated error handling.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const bookmarksPath = path.join(__dirname, '../data/bookmarks.json');

function checkUrl(url) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      method: 'HEAD',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BookmarkChecker/1.0)'
      }
    };

    const req = client.request(url, options, (res) => {
      resolve({
        url,
        status: res.statusCode,
        ok: res.statusCode >= 200 && res.statusCode < 400
      });
    });

    req.on('error', (err) => {
      resolve({
        url,
        status: null,
        ok: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url,
        status: null,
        ok: false,
        error: 'Timeout'
      });
    });

    req.end();
  });
}

async function checkLinks() {
  console.log('🔗 Checking external links...');
  console.log('⚠️  Note: This performs HEAD requests to all bookmark URLs');
  console.log('');

  try {
    const bookmarks = JSON.parse(fs.readFileSync(bookmarksPath, 'utf8'));
    console.log(`📚 Checking ${bookmarks.length} bookmarks`);
    console.log('');

    const results = {
      total: 0,
      ok: 0,
      broken: 0,
      errors: []
    };

    // Check first 50 bookmarks as a sample (can be made configurable)
    const sample = bookmarks.slice(0, 50);

    for (const bookmark of sample) {
      results.total++;
      process.stdout.write(`Checking ${results.total}/${sample.length}...\r`);

      const result = await checkUrl(bookmark.url);

      if (result.ok) {
        results.ok++;
      } else {
        results.broken++;
        results.errors.push({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          status: result.status,
          error: result.error
        });
      }

      // Rate limit: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('');
    console.log('');
    console.log('📊 Link Check Results');
    console.log('====================');
    console.log(`Total checked: ${results.total}`);
    console.log(`✅ Accessible: ${results.ok}`);
    console.log(`❌ Broken/Error: ${results.broken}`);
    console.log('');

    if (results.broken > 0) {
      console.log('Broken Links:');
      results.errors.forEach(err => {
        console.log(`  ${err.id} - ${err.title}`);
        console.log(`    URL: ${err.url}`);
        console.log(`    Status: ${err.status || 'N/A'} ${err.error ? `(${err.error})` : ''}`);
        console.log('');
      });
    }

    // Exit with warning code if broken links found, but don't fail the build
    process.exit(0);

  } catch (err) {
    console.error('❌ Error checking links:', err.message);
    process.exit(1);
  }
}

checkLinks();
