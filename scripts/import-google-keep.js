const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadData, saveData } = require('./data-utils');

// Parse CLI args
const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
const dryRun = args.includes('--dry-run');
// Find the path (first argument that isn't a flag)
const inputPath = args.find(arg => !arg.startsWith('-'));

// Find tag arg
const tagIndex = args.indexOf('--tag');
const extraTag = tagIndex !== -1 && args[tagIndex + 1] ? args[tagIndex + 1] : null;

if (help || !inputPath) {
  console.log(`
Usage: node scripts/import-google-keep.js <file-or-directory-path> [options]

Options:
  --dry-run   Preview import without saving
  --tag <tag> Add a specific tag to all imported items
  --help      Show this help
`);
  process.exit(help ? 0 : 1);
}

const BOOT_TIME = new Date().toISOString();

async function importKeep() {
  console.log(`🚀 Starting Google Keep Import...`);
  if (dryRun) console.log(`🔍 DRY RUN MODE: No changes will be written.`);

  // 1. Load Input
  const absolutePath = path.resolve(inputPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Path not found: ${absolutePath}`);
    process.exit(1);
  }

  let keepData = [];
  try {
    const stats = fs.statSync(absolutePath);
    if (stats.isDirectory()) {
      const files = fs.readdirSync(absolutePath);
      const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');
      console.log(`📂 Found ${jsonFiles.length} JSON files in directory.`);
      
      for (const file of jsonFiles) {
        const filePath = path.join(absolutePath, file);
        const raw = fs.readFileSync(filePath, 'utf8');
        const note = JSON.parse(raw);
        keepData.push(note);
      }
    } else {
      const raw = fs.readFileSync(absolutePath, 'utf8');
      const parsedData = JSON.parse(raw);
      if (Array.isArray(parsedData)) {
        keepData = parsedData;
      } else if (parsedData.notes && Array.isArray(parsedData.notes)) {
        keepData = parsedData.notes;
      } else {
        // Assume a single note object if it's not in an array, like the previous fix
        keepData = [parsedData];
      }
    }
  } catch (e) {
    console.error(`❌ Failed to read or parse data: ${e.message}`);
    process.exit(1);
  }

  console.log(`📄 Found ${keepData.length} total notes to process.`);

  // 2. Load Existing Bookmarks (for deduplication)
  // Note: data-utils looks for file relative to __dirname/../data/
  const existingBookmarks = loadData('bookmarks.jsonl');
  const existingUrls = new Set(existingBookmarks.map(b => b.url));
  
  // 3. Process
  const newBookmarks = [];
  const stats = {
    total: keepData.length,
    skipped_no_url: 0,
    skipped_duplicate: 0,
    imported: 0
  };

  // Regex to find URLs, avoiding trailing punctuation common in text
  // Matches http/https, non-whitespace, but doesn't end with .,;:!?)]
  const urlRegex = /https?:\/\/[^\s]+(?<![.,;:!?\)\]])/g;

  for (const note of keepData) {
    // Skip trashed items
    if (note.isTrashed) {
        continue;
    }

    const text = note.textContent || '';
    const matches = text.match(urlRegex);

    if (!matches || matches.length === 0) {
      stats.skipped_no_url++;
      continue;
    }

    // Take the first URL found
    const url = matches[0];

    // Check Duplicate
    if (existingUrls.has(url)) {
      stats.skipped_duplicate++;
      if (dryRun) console.log(`  Duplicate (Skipped): ${url}`);
      continue;
    }

    // Map Data
    // Title fallback: Note Title -> First 50 chars of body -> URL
    let title = note.title;
    if (!title) {
        const firstLine = text.split('\n')[0];
        title = firstLine.length > 0 ? firstLine.substring(0, 50) : url;
    }
    
    const description = text.substring(0, 500);
    
    // Tags
    const tags = [];
    if (note.labels) {
      note.labels.forEach(l => tags.push(l.name.toLowerCase()));
    }
    if (extraTag) tags.push(extraTag);

    // Timestamp (Keep is usec)
    const timestamp = note.createdTimestampUsec 
      ? new Date(note.createdTimestampUsec / 1000).toISOString() 
      : BOOT_TIME;

    // Generate Hash
    const hash = crypto.createHash('sha256').update(url).digest('hex').substring(0, 16);

    const bookmark = {
      id: crypto.randomUUID(),
      url: url,
      url_normalized: url, // Basic normalization same as url for now
      url_hash: hash,
      title: title,
      description: description,
      content_type: 'article', // default assumption
      source: 'import-google-keep',
      tags: [...new Set(tags)], // unique
      timestamp: timestamp,
      is_private: false,
      is_archived: note.isArchived || false,
      is_favorite: note.isPinned || false,
      read_status: 'unread'
    };

    newBookmarks.push(bookmark);
    existingUrls.add(url); // prevent duplicates within the same import file
    stats.imported++;
    
    if (dryRun) {
      console.log(`  [+] ${title} 
      URL: ${url}`);
    }
  }

  // 4. Save
  console.log(`
📊 Summary:`);
  console.log(`  Total Notes: ${stats.total}`);
  console.log(`  Skipped (No URL): ${stats.skipped_no_url}`);
  console.log(`  Skipped (Duplicate): ${stats.skipped_duplicate}`);
  console.log(`  To Import: ${stats.imported}`);

  if (stats.imported > 0 && !dryRun) {
    const finalList = [...existingBookmarks, ...newBookmarks];
    saveData('bookmarks.jsonl', finalList);
    console.log(`
✅ Successfully added ${stats.imported} bookmarks to data/bookmarks.jsonl`);
  } else if (dryRun) {
    console.log(`
💤 Dry run complete. No files changed.`);
  } else {
    console.log(`
⚠️ No new bookmarks to import.`);
  }
}

importKeep();
