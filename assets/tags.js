/**
 * Hipervínculos - Tags Page
 * Browse bookmarks organized by tag
 */

const state = {
  bookmarks: [],
  tagMap: new Map(), // tag -> bookmarks[]
  loading: true
};

async function init() {
  console.log('🏷️ Initializing Tags page...');
  await loadBookmarks();
  buildTagMap();
  render();
  console.log('✅ Tags page initialized');
}

async function loadBookmarks() {
  try {
    const response = await fetch('data/bookmarks.jsonl');
    if (!response.ok) throw new Error('Failed to load bookmarks');

    const text = await response.text();
    state.bookmarks = text
      .trim()
      .split(/\r?\n/)
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.error('Error parsing line:', e);
          return null;
        }
      })
      .filter(item => item !== null);

    state.loading = false;
    console.log(`📚 Loaded ${state.bookmarks.length} bookmarks`);
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    state.loading = false;
  }
}

function buildTagMap() {
  state.tagMap.clear();

  for (const bookmark of state.bookmarks) {
    if (!bookmark.tags || bookmark.tags.length === 0) continue;

    for (const tag of bookmark.tags) {
      if (!state.tagMap.has(tag)) {
        state.tagMap.set(tag, []);
      }
      state.tagMap.get(tag).push(bookmark);
    }
  }

  // Sort bookmarks within each tag by date (newest first)
  for (const [tag, bookmarks] of state.tagMap) {
    bookmarks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

function render() {
  const container = document.getElementById('tags-container');
  const statsEl = document.getElementById('tag-count');

  if (state.loading) return;

  // Sort tags by frequency (most bookmarks first)
  const sortedTags = [...state.tagMap.entries()]
    .sort((a, b) => b[1].length - a[1].length);

  // Update stats
  const totalTags = sortedTags.length;
  const taggedBookmarks = new Set(
    state.bookmarks
      .filter(b => b.tags && b.tags.length > 0)
      .map(b => b.id)
  ).size;
  statsEl.textContent = `${totalTags} tags · ${taggedBookmarks} tagged bookmarks`;

  if (sortedTags.length === 0) {
    container.innerHTML = `
      <div class="empty-tags">
        <p>No tagged bookmarks yet</p>
      </div>
    `;
    return;
  }

  container.innerHTML = sortedTags.map(([tag, bookmarks]) => `
    <div class="tag-group" data-tag="${escapeHtml(tag)}">
      <div class="tag-header" onclick="toggleTag('${escapeHtml(tag)}')">
        <div class="tag-info">
          <span class="tag-name">${escapeHtml(tag)}</span>
          <span class="tag-count">${bookmarks.length}</span>
        </div>
        <span class="tag-toggle">›</span>
      </div>
      <div class="tag-bookmarks">
        ${bookmarks.map(b => renderBookmark(b)).join('')}
      </div>
    </div>
  `).join('');
}

function renderBookmark(bookmark) {
  const date = new Date(bookmark.timestamp);
  const dateStr = date.toLocaleDateString();

  let domain = '';
  try {
    domain = new URL(bookmark.url).hostname.replace('www.', '');
  } catch (e) {
    domain = bookmark.site_name || '';
  }

  return `
    <div class="tag-bookmark">
      <a href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener" class="tag-bookmark-title">
        ${escapeHtml(bookmark.title || bookmark.url)}
      </a>
      <div class="tag-bookmark-meta">
        <span>${domain}</span>
        <span>${dateStr}</span>
      </div>
    </div>
  `;
}

window.toggleTag = function(tag) {
  const group = document.querySelector(`.tag-group[data-tag="${tag}"]`);
  if (group) {
    group.classList.toggle('expanded');
  }
};

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
