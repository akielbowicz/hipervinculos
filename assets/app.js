/**
 * Hipervínculos - Bookmark Manager
 * Client-side application
 */

// State management
const state = {
  bookmarks: [],
  filteredBookmarks: [],
  currentFilter: 'all',
  currentType: '',
  currentSort: 'newest',
  searchQuery: '',
  loading: true,
  displayedCount: 0,
  itemsPerPage: 50
};

// Valid values for URL params
const validFilters = ['all', 'unread', 'favorites'];
const validTypes = ['', 'article', 'video', 'code', 'image', 'tweet', 'pdf', 'other'];
const validSorts = ['newest', 'oldest', 'title'];

// Parse URL query params into state values
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    searchQuery: params.get('q') || '',
    currentFilter: validFilters.includes(params.get('filter')) ? params.get('filter') : 'all',
    currentType: validTypes.includes(params.get('type')) ? params.get('type') : '',
    currentSort: validSorts.includes(params.get('sort')) ? params.get('sort') : 'newest'
  };
}

// Update URL with current state (without adding to history)
function updateQueryParams() {
  const params = new URLSearchParams();

  if (state.searchQuery) params.set('q', state.searchQuery);
  if (state.currentFilter !== 'all') params.set('filter', state.currentFilter);
  if (state.currentType) params.set('type', state.currentType);
  if (state.currentSort !== 'newest') params.set('sort', state.currentSort);

  const queryString = params.toString();
  const newURL = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

  history.replaceState(null, '', newURL);
}

// Sync UI elements with current state
function syncUIFromState() {
  // Search input
  const searchInput = document.getElementById('search');
  const searchClear = document.getElementById('search-clear');
  searchInput.value = state.searchQuery;
  searchClear.classList.toggle('visible', state.searchQuery.length > 0);

  // Filter buttons
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === state.currentFilter);
  });

  // Type dropdown
  document.getElementById('type-filter').value = state.currentType;

  // Sort dropdown
  document.getElementById('sort-select').value = state.currentSort;
}

// Content type icons
const typeIcons = {
  article: '📄',
  video: '📹',
  code: '💻',
  image: '🖼️',
  tweet: '📱',
  pdf: '📕',
  other: '📄'
};

// Initialize app
async function init() {
  console.log('🚀 Initializing Hipervínculos...');

  // Restore state from URL query params
  const urlState = getQueryParams();
  Object.assign(state, urlState);

  // Load bookmarks
  await loadBookmarks();

  // Setup event listeners
  setupEventListeners();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Sync UI with restored state
  syncUIFromState();

  // Apply initial filters and render (ensures proper sorting)
  applyFilters();

  // Handle browser back/forward navigation
  window.addEventListener('popstate', () => {
    const urlState = getQueryParams();
    Object.assign(state, urlState);
    syncUIFromState();
    applyFilters();
  });

  console.log('✅ App initialized');
}

// Load bookmarks from data file
async function loadBookmarks() {
  try {
    const response = await fetch('data/bookmarks.jsonl');
    if (!response.ok) {
      throw new Error('Failed to load bookmarks');
    }

    const text = await response.text();
    state.bookmarks = text
      .trim()
      .split(/\r?\n/)
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.error('Error parsing line:', line, e);
          return null;
        }
      })
      .filter(item => item !== null);

    state.filteredBookmarks = [...state.bookmarks];
    state.loading = false;

    console.log(`📚 Loaded ${state.bookmarks.length} bookmarks`);
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    showError('Failed to load bookmarks');
    state.loading = false;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('search');
  const searchClear = document.getElementById('search-clear');

  searchInput.addEventListener('input', debounce((e) => {
    state.searchQuery = e.target.value.trim();
    searchClear.classList.toggle('visible', state.searchQuery.length > 0);
    applyFilters();
  }, 300));

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    searchClear.classList.remove('visible');
    applyFilters();
    searchInput.focus();
  });

  // Filter buttons
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.currentFilter = e.target.dataset.filter;
      applyFilters();
    });
  });

  // Type filter
  document.getElementById('type-filter').addEventListener('change', (e) => {
    state.currentType = e.target.value;
    applyFilters();
  });

  // Sort select
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.currentSort = e.target.value;
    applyFilters();
  });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // "/" or "Ctrl+K" to focus search
    if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
      e.preventDefault();
      document.getElementById('search').focus();
    }

    // Escape to clear search
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('search');
      if (searchInput.value) {
        searchInput.value = '';
        state.searchQuery = '';
        document.getElementById('search-clear').classList.remove('visible');
        applyFilters();
      }
    }
  });
}

// Apply filters and render
function applyFilters() {
  let filtered = [...state.bookmarks];

  // Apply read status filter
  if (state.currentFilter === 'unread') {
    filtered = filtered.filter(b => b.read_status === 'unread' || !b.read_status);
  } else if (state.currentFilter === 'favorites') {
    filtered = filtered.filter(b => b.is_favorite);
  }

  // Apply type filter
  if (state.currentType) {
    filtered = filtered.filter(b => b.content_type === state.currentType);
  }

  // Apply search query
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(b => {
      return (
        b.title?.toLowerCase().includes(query) ||
        b.description?.toLowerCase().includes(query) ||
        b.tags?.some(t => t.toLowerCase().includes(query)) ||
        b.site_name?.toLowerCase().includes(query) ||
        b.notes?.toLowerCase().includes(query)
      );
    });
  }

  // Apply sorting
  filtered.sort((a, b) => {
    switch (state.currentSort) {
      case 'newest':
        return new Date(b.timestamp) - new Date(a.timestamp);
      case 'oldest':
        return new Date(a.timestamp) - new Date(b.timestamp);
      case 'title':
        return (a.title || '').localeCompare(b.title || '');
      default:
        return 0;
    }
  });

  state.filteredBookmarks = filtered;
  renderBookmarks();
  updateStats();
  updateQueryParams();
}

// Render bookmarks to DOM
function renderBookmarks(append = false) {
  const grid = document.getElementById('bookmarks-grid');
  const emptyState = document.getElementById('empty-state');

  if (state.loading) {
    return; // Show loading spinner
  }

  // Clear grid if not appending
  if (!append) {
    grid.innerHTML = '';
    state.displayedCount = 0;
  }

  // Show empty state if no bookmarks
  if (state.filteredBookmarks.length === 0) {
    emptyState.classList.remove('hidden');
    removeLoadMoreButton();
    const message = document.getElementById('empty-message');

    if (state.searchQuery) {
      message.textContent = `No bookmarks found for "${state.searchQuery}"`;
    } else if (state.currentFilter === 'favorites') {
      message.textContent = 'No favorite bookmarks yet';
    } else if (state.currentFilter === 'unread') {
      message.textContent = 'No unread bookmarks';
    } else {
      message.textContent = 'Start by sending a link to your Telegram bot';
    }

    return;
  }

  emptyState.classList.add('hidden');

  // Get the next batch of bookmarks
  const startIndex = state.displayedCount;
  const endIndex = Math.min(startIndex + state.itemsPerPage, state.filteredBookmarks.length);
  const batch = state.filteredBookmarks.slice(startIndex, endIndex);

  // Render bookmark cards
  batch.forEach(bookmark => {
    const card = createBookmarkCard(bookmark);
    grid.appendChild(card);
  });

  state.displayedCount = endIndex;

  // Show or hide "Load more" button
  if (state.displayedCount < state.filteredBookmarks.length) {
    showLoadMoreButton();
  } else {
    removeLoadMoreButton();
  }
}

// Show "Load more" button
function showLoadMoreButton() {
  let btn = document.getElementById('load-more-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'load-more-btn';
    btn.className = 'load-more-btn';
    btn.addEventListener('click', () => {
      renderBookmarks(true);
      updateStats();
    });
    const grid = document.getElementById('bookmarks-grid');
    grid.parentNode.insertBefore(btn, grid.nextSibling);
  }
  const remaining = state.filteredBookmarks.length - state.displayedCount;
  btn.textContent = `Load more (${remaining} remaining)`;
}

// Remove "Load more" button
function removeLoadMoreButton() {
  const btn = document.getElementById('load-more-btn');
  if (btn) {
    btn.remove();
  }
}

// Create bookmark card element
function createBookmarkCard(bookmark) {
  const card = document.createElement('div');
  card.className = 'bookmark-card';
  card.dataset.id = bookmark.id;
  
  // Format date
  const date = new Date(bookmark.timestamp);
  const relativeDate = formatRelativeDate(date);
  
  // Simple domain extraction
  let domain = '';
  try {
    domain = new URL(bookmark.url).hostname.replace('www.', '');
  } catch (e) {
    domain = bookmark.site_name || '';
  }

  // Favorite Button (SVG)
  const starIcon = bookmark.is_favorite
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

  card.innerHTML = `
    <div class="bookmark-content">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <a href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener" class="bookmark-title">
          ${escapeHtml(bookmark.title || bookmark.url)}
        </a>
        <button class="favorite-btn ${bookmark.is_favorite ? 'active' : ''}" 
                onclick="toggleFavorite(event, '${bookmark.id}')"
                aria-label="Toggle favorite">
          ${starIcon}
        </button>
      </div>

      ${bookmark.description ? `
        <p class="bookmark-description">${escapeHtml(bookmark.description)}</p>
      ` : ''}

      <div class="bookmark-metadata">
        <span class="type-icon">${typeIcons[bookmark.content_type || 'other']}</span>
        <span class="domain">${domain}</span>
        <span class="date">${relativeDate}</span>
        ${bookmark.tags && bookmark.tags.length > 0 ? `
          <div class="bookmark-tags">
            ${bookmark.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  return card;
}

// Update stats bar
function updateStats() {
  const countEl = document.getElementById('bookmark-count');
  const resultsEl = document.getElementById('search-results');

  const total = state.bookmarks.length;
  const filtered = state.filteredBookmarks.length;
  const displayed = state.displayedCount;

  if (state.searchQuery || state.currentFilter !== 'all' || state.currentType) {
    if (displayed < filtered) {
      countEl.textContent = `Showing ${displayed} of ${filtered} (${total} total)`;
    } else {
      countEl.textContent = `Showing ${filtered} of ${total} bookmarks`;
    }
  } else {
    if (displayed < filtered) {
      countEl.textContent = `Showing ${displayed} of ${total} bookmarks`;
    } else {
      countEl.textContent = `${total} bookmarks`;
    }
  }

  if (state.searchQuery) {
    resultsEl.textContent = `🔍 Search: "${state.searchQuery}"`;
    resultsEl.classList.remove('hidden');
  } else {
    resultsEl.classList.add('hidden');
  }
}

// Toggle favorite status (placeholder - would call API)
window.toggleFavorite = function(event, id) {
  event.stopPropagation();
  const bookmark = state.bookmarks.find(b => b.id === id);
  if (bookmark) {
    bookmark.is_favorite = !bookmark.is_favorite;

    // Update card in-place to preserve pagination/scroll position
    const card = document.querySelector(`.bookmark-card[data-id="${id}"]`);
    if (card) {
      const btn = card.querySelector('.favorite-btn');
      btn.classList.toggle('active', bookmark.is_favorite);
      btn.innerHTML = bookmark.is_favorite
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
    }
    // TODO: Call API to persist change
  }
};

// Open bookmark
window.openBookmark = function(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
};

// Utility functions
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatRelativeDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) {
    return date.toLocaleDateString();
  } else if (diffDay > 0) {
    return `${diffDay}d ago`;
  } else if (diffHour > 0) {
    return `${diffHour}h ago`;
  } else if (diffMin > 0) {
    return `${diffMin}m ago`;
  } else {
    return 'Just now';
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showError(message) {
  const grid = document.getElementById('bookmarks-grid');
  grid.innerHTML = `
    <div class="loading">
      <p style="color: var(--text-primary);">❌ ${message}</p>
    </div>
  `;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
