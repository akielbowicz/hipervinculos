#!/usr/bin/env node
/**
 * Auto-tag bookmarks based on keyword matching in title, description, and URL.
 * 
 * Usage:
 *   node scripts/auto-tag.js              # Dry run - show what would be tagged
 *   node scripts/auto-tag.js --apply      # Apply tags to bookmarks
 *   node scripts/auto-tag.js --stats      # Show tag statistics only
 */

const fs = require('fs');
const path = require('path');

const BOOKMARKS_PATH = path.join(__dirname, '../data/bookmarks.jsonl');
const TAGS_PATH = path.join(__dirname, '../data/tags.jsonl');

// Tag rules: each rule has keywords to match and the tag to apply
const TAG_RULES = [
  {
    tag: 'python',
    keywords: ['python', 'jupyter', 'pandas', 'numpy', 'scipy', 'matplotlib', 'pytest'],
    domains: ['jupyter.org', 'nbviewer.jupyter.org', 'colab.research.google.com'],
    color: '#3776ab',
    description: 'Python programming language'
  },
  {
    tag: 'javascript',
    keywords: ['javascript', 'nodejs', 'node.js', 'typescript', 'react', 'vue', 'svelte', 'npm'],
    domains: ['npmjs.com'],
    color: '#f7df1e',
    description: 'JavaScript and TypeScript'
  },
  {
    tag: 'rust',
    keywords: ['rust', 'rustlang', 'cargo', 'rustc'],
    domains: ['rust-lang.org', 'crates.io'],
    color: '#dea584',
    description: 'Rust programming language'
  },
  {
    tag: 'go',
    keywords: ['golang', 'go lang'],
    domains: ['go.dev', 'golang.org'],
    color: '#00add8',
    description: 'Go programming language'
  },
  {
    tag: 'haskell',
    keywords: ['haskell', 'ghc', 'cabal', 'monad', 'functor'],
    domains: ['haskell.org'],
    color: '#5e5086',
    description: 'Haskell programming language'
  },
  {
    tag: 'clojure',
    keywords: ['clojure', 'clojurescript', 'leiningen', 'lisp'],
    domains: ['clojure.org', 'clojuredocs.org'],
    color: '#5881d8',
    description: 'Clojure programming language'
  },
  {
    tag: 'julia',
    keywords: ['julia', 'julialang'],
    domains: ['julialang.org'],
    color: '#9558b2',
    description: 'Julia programming language'
  },
  {
    tag: 'machine-learning',
    keywords: ['machine learning', 'deep learning', 'neural network', 'tensorflow', 'pytorch', 'ml model', 'training', 'embeddings', 'transformer'],
    domains: ['arxiv.org', 'huggingface.co'],
    color: '#ff6f61',
    description: 'Machine learning and AI'
  },
  {
    tag: 'data',
    keywords: ['data engineering', 'data science', 'analytics', 'sql', 'database', 'etl', 'pipeline', 'dataframe'],
    domains: [],
    color: '#10b981',
    description: 'Data engineering and science'
  },
  {
    tag: 'visualization',
    keywords: ['visualization', 'chart', 'graph', 'plot', 'd3.js', 'dataviz', 'infographic'],
    domains: [],
    color: '#8b5cf6',
    description: 'Data visualization'
  },
  {
    tag: 'design',
    keywords: ['design', 'ui', 'ux', 'css', 'color', 'typography', 'layout', 'figma'],
    domains: ['dribbble.com', 'figma.com'],
    color: '#ec4899',
    description: 'Design and UI/UX'
  },
  {
    tag: 'devtools',
    keywords: ['cli', 'terminal', 'shell', 'bash', 'zsh', 'vim', 'neovim', 'editor', 'debugging'],
    domains: [],
    color: '#64748b',
    description: 'Developer tools and CLI'
  },
  {
    tag: 'architecture',
    keywords: ['system design', 'architecture', 'distributed', 'microservice', 'scalability', 'infrastructure'],
    domains: [],
    color: '#0ea5e9',
    description: 'System architecture and design'
  },
  {
    tag: 'tutorial',
    keywords: ['tutorial', 'guide', 'how to', 'introduction', 'getting started', 'learn', 'course', 'beginner'],
    domains: [],
    color: '#22c55e',
    description: 'Tutorials and learning resources'
  },
  {
    tag: 'video',
    keywords: [],
    domains: ['youtube.com', 'm.youtube.com', 'vimeo.com'],
    contentTypes: ['video'],
    color: '#ef4444',
    description: 'Video content'
  },
  {
    tag: 'github',
    keywords: [],
    domains: ['github.com', 'gist.github.com'],
    contentTypes: ['code'],
    color: '#333333',
    description: 'GitHub repositories and gists'
  }
];

function loadBookmarks() {
  const content = fs.readFileSync(BOOKMARKS_PATH, 'utf8');
  return content.trim().split('\n').map(line => JSON.parse(line));
}

function saveBookmarks(bookmarks) {
  const content = bookmarks.map(b => JSON.stringify(b)).join('\n') + '\n';
  fs.writeFileSync(BOOKMARKS_PATH, content);
}

function saveTags(rules, bookmarks) {
  const usedTags = new Set();
  for (const b of bookmarks) {
    for (const t of (b.tags || [])) usedTags.add(t);
  }
  
  const tagDefs = rules
    .filter(r => usedTags.has(r.tag))
    .map(r => ({ name: r.tag, color: r.color, description: r.description }));
  
  // Add any existing tags not in rules
  const existingTags = new Set(tagDefs.map(t => t.name));
  for (const tag of usedTags) {
    if (!existingTags.has(tag)) {
      tagDefs.push({ name: tag, color: '#64748b', description: 'Auto-generated tag' });
    }
  }
  
  tagDefs.sort((a, b) => a.name.localeCompare(b.name));
  const content = tagDefs.map(t => JSON.stringify(t)).join('\n') + '\n';
  fs.writeFileSync(TAGS_PATH, content);
}

function matchesRule(bookmark, rule) {
  const text = [
    bookmark.title || '',
    bookmark.description || '',
    bookmark.url || ''
  ].join(' ').toLowerCase();
  
  // Check keywords
  for (const kw of rule.keywords) {
    if (text.includes(kw.toLowerCase())) return true;
  }
  
  // Check domains
  try {
    const host = new URL(bookmark.url).hostname.replace('www.', '');
    for (const domain of rule.domains) {
      if (host === domain || host.endsWith('.' + domain)) return true;
    }
  } catch {}
  
  // Check content types
  if (rule.contentTypes && rule.contentTypes.includes(bookmark.content_type)) {
    return true;
  }
  
  return false;
}

function autoTag(bookmarks, dryRun = true) {
  const changes = [];
  
  for (const bookmark of bookmarks) {
    const existingTags = new Set(bookmark.tags || []);
    const newTags = [];
    
    for (const rule of TAG_RULES) {
      if (!existingTags.has(rule.tag) && matchesRule(bookmark, rule)) {
        newTags.push(rule.tag);
      }
    }
    
    if (newTags.length > 0) {
      changes.push({
        id: bookmark.id,
        title: (bookmark.title || bookmark.url).slice(0, 60),
        existing: [...existingTags],
        added: newTags
      });
      
      if (!dryRun) {
        bookmark.tags = [...existingTags, ...newTags].sort();
      }
    }
  }
  
  return changes;
}

function showStats(bookmarks) {
  const tagCounts = {};
  for (const b of bookmarks) {
    for (const t of (b.tags || [])) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }
  
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  const untagged = bookmarks.filter(b => !b.tags || b.tags.length === 0).length;
  
  console.log('\n📊 Tag Statistics\n');
  console.log(`Total bookmarks: ${bookmarks.length}`);
  console.log(`Untagged: ${untagged}`);
  console.log(`Tagged: ${bookmarks.length - untagged}\n`);
  
  if (sorted.length > 0) {
    console.log('Tags by usage:');
    for (const [tag, count] of sorted) {
      const bar = '█'.repeat(Math.min(count, 50));
      console.log(`  ${tag.padEnd(20)} ${String(count).padStart(4)} ${bar}`);
    }
  }
}

// Main
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const statsOnly = args.includes('--stats');
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
🏷️  Auto-tag bookmarks based on keyword matching

Usage:
  node scripts/auto-tag.js              Dry run - show what would be tagged
  node scripts/auto-tag.js --apply      Apply tags to bookmarks
  node scripts/auto-tag.js --stats      Show tag statistics only
  node scripts/auto-tag.js --help       Show this help message

The script matches keywords in title, description, and URL against
predefined rules to automatically assign tags to bookmarks.
`);
  process.exit(0);
}

const bookmarks = loadBookmarks();

if (statsOnly) {
  showStats(bookmarks);
  process.exit(0);
}

console.log('🏷️  Auto-tagging bookmarks...\n');

const changes = autoTag(bookmarks, !apply);

if (changes.length === 0) {
  console.log('No new tags to apply.');
  showStats(bookmarks);
  process.exit(0);
}

console.log(`Found ${changes.length} bookmarks to tag:\n`);

for (const c of changes.slice(0, 20)) {
  console.log(`  "${c.title}..."`);
  console.log(`    + ${c.added.join(', ')}`);
}

if (changes.length > 20) {
  console.log(`  ... and ${changes.length - 20} more`);
}

if (apply) {
  saveBookmarks(bookmarks);
  saveTags(TAG_RULES, bookmarks);
  console.log(`\n✅ Applied tags to ${changes.length} bookmarks`);
  showStats(bookmarks);
} else {
  console.log('\n⚠️  Dry run - no changes made');
  console.log('Run with --apply to save changes');
}
