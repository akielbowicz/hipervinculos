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
  loading: true
};

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

  // Load bookmarks
  await loadBookmarks();

  // Setup event listeners
  setupEventListeners();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Render initial view
  renderBookmarks();

  // Update stats
  updateStats();

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
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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
}

// Render bookmarks to DOM
function renderBookmarks() {
  const grid = document.getElementById('bookmarks-grid');
  const emptyState = document.getElementById('empty-state');

  if (state.loading) {
    return; // Show loading spinner
  }

  // Clear loading state
  grid.innerHTML = '';

  // Show empty state if no bookmarks
  if (state.filteredBookmarks.length === 0) {
    emptyState.classList.remove('hidden');
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

  // Render bookmark cards
  state.filteredBookmarks.forEach(bookmark => {
    const card = createBookmarkCard(bookmark);
    grid.appendChild(card);
  });
}

// Create bookmark card element
function createBookmarkCard(bookmark) {
  const card = document.createElement('article');
  card.className = 'bookmark-card';
  card.dataset.id = bookmark.id;

  // Image
  const image = bookmark.image
    ? `<img src="${escapeHtml(bookmark.image)}" alt="" class="bookmark-image" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="bookmark-image placeholder">${typeIcons[bookmark.content_type] || '📄'}</div>`;

  // Format date
  const date = new Date(bookmark.timestamp);
  const relativeDate = formatRelativeDate(date);

  card.innerHTML = `
    ${image}
    <div class="bookmark-content">
      <a href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener" class="bookmark-title">
        ${escapeHtml(bookmark.title || bookmark.url)}
      </a>

      ${bookmark.description ? `
        <p class="bookmark-description">${escapeHtml(bookmark.description)}</p>
      ` : ''}

      <div class="bookmark-metadata">
        <span class="bookmark-type">${typeIcons[bookmark.content_type || 'other']} ${bookmark.content_type || 'other'}</span>
        ${bookmark.site_name ? `<span class="bookmark-site">${escapeHtml(bookmark.site_name)}</span>` : ''}
        <time class="bookmark-date" datetime="${bookmark.timestamp}">${relativeDate}</time>
      </div>

      ${bookmark.tags && bookmark.tags.length > 0 ? `
        <div class="bookmark-tags">
          ${bookmark.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}

      <div class="bookmark-actions">
        <button class="action-btn favorite ${bookmark.is_favorite ? 'active' : ''}" onclick="toggleFavorite('${bookmark.id}')">
          ${bookmark.is_favorite ? '⭐' : '☆'}
        </button>
        <button class="action-btn" onclick="openBookmark('${escapeHtml(bookmark.url)}')">
          Open →
        </button>
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
  const shown = state.filteredBookmarks.length;

  if (state.searchQuery || state.currentFilter !== 'all' || state.currentType) {
    countEl.textContent = `Showing ${shown} of ${total} bookmarks`;
  } else {
    countEl.textContent = `${total} bookmarks`;
  }

  if (state.searchQuery) {
    resultsEl.textContent = `🔍 Search: "${state.searchQuery}"`;
    resultsEl.classList.remove('hidden');
  } else {
    resultsEl.classList.add('hidden');
  }
}

// Toggle favorite status (placeholder - would call API)
window.toggleFavorite = function(id) {
  const bookmark = state.bookmarks.find(b => b.id === id);
  if (bookmark) {
    bookmark.is_favorite = !bookmark.is_favorite;
    renderBookmarks();
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
