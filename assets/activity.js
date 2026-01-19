/**
 * Hipervínculos - Activity Visualization
 * GitHub-style hierarchical activity heatmap
 */

const state = {
  bookmarks: [],
  byYear: {},
  byMonth: {},
  byDay: {},
  selectedYear: null,
  selectedMonth: null,
  selectedDay: null
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function init() {
  console.log('🚀 Initializing Activity view...');
  await loadBookmarks();
  processBookmarks();
  renderYears();
  updateStats();
  console.log('✅ Activity initialized');
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
          return null;
        }
      })
      .filter(item => item !== null);

    console.log(`📚 Loaded ${state.bookmarks.length} bookmarks`);
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    showError('Failed to load bookmarks');
  }
}

function processBookmarks() {
  state.byYear = {};
  state.byMonth = {};
  state.byDay = {};

  state.bookmarks.forEach(bookmark => {
    if (!bookmark.timestamp) return;

    const date = new Date(bookmark.timestamp);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    const yearKey = `${year}`;
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!state.byYear[yearKey]) state.byYear[yearKey] = [];
    state.byYear[yearKey].push(bookmark);

    if (!state.byMonth[monthKey]) state.byMonth[monthKey] = [];
    state.byMonth[monthKey].push(bookmark);

    if (!state.byDay[dayKey]) state.byDay[dayKey] = [];
    state.byDay[dayKey].push(bookmark);
  });
}

function getHeatLevel(count, maxCount) {
  if (count === 0) return 0;
  if (maxCount === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function renderYears() {
  const container = document.getElementById('activity-container');
  container.innerHTML = '';

  const years = Object.keys(state.byYear).sort((a, b) => b - a);
  
  if (years.length === 0) {
    container.innerHTML = '<p class="loading">No bookmarks found</p>';
    return;
  }

  const maxMonthCount = Math.max(
    ...Object.values(state.byMonth).map(arr => arr.length),
    1
  );

  years.forEach(year => {
    const yearRow = document.createElement('div');
    yearRow.className = 'year-row';
    yearRow.dataset.year = year;

    const yearCount = state.byYear[year].length;

    yearRow.innerHTML = `
      <div class="year-header">
        <span class="year-label">${year}</span>
        <span class="year-count">${yearCount} bookmark${yearCount !== 1 ? 's' : ''}</span>
      </div>
      <div class="months-grid" id="months-${year}"></div>
    `;

    container.appendChild(yearRow);

    const monthsGrid = document.getElementById(`months-${year}`);
    
    for (let month = 0; month < 12; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const count = state.byMonth[monthKey]?.length || 0;
      const heatLevel = getHeatLevel(count, maxMonthCount);

      const cell = document.createElement('div');
      cell.className = `month-cell heat-${heatLevel}`;
      cell.dataset.month = monthKey;
      cell.dataset.tooltip = `${MONTH_NAMES[month]} ${year}: ${count}`;
      
      cell.addEventListener('click', () => toggleMonthDetail(year, month, monthKey));
      
      monthsGrid.appendChild(cell);
    }
  });
}

function toggleMonthDetail(year, month, monthKey) {
  const yearRow = document.querySelector(`.year-row[data-year="${year}"]`);
  const existingDetail = yearRow.querySelector('.month-detail');
  
  document.querySelectorAll('.month-cell.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.month-detail').forEach(el => el.remove());

  if (existingDetail && state.selectedMonth === monthKey) {
    state.selectedMonth = null;
    return;
  }

  state.selectedYear = year;
  state.selectedMonth = monthKey;

  const monthCell = yearRow.querySelector(`.month-cell[data-month="${monthKey}"]`);
  monthCell.classList.add('selected');

  const detail = document.createElement('div');
  detail.className = 'month-detail';
  
  const monthName = MONTH_NAMES[month];
  const bookmarks = state.byMonth[monthKey] || [];

  detail.innerHTML = `
    <div class="month-detail-header">
      <span class="month-detail-title">${monthName} ${year} (${bookmarks.length} bookmarks)</span>
      <button class="month-detail-close" aria-label="Close">×</button>
    </div>
    <div class="week-labels">
      ${DAY_NAMES.map(d => `<span class="week-label">${d}</span>`).join('')}
    </div>
    <div class="days-grid" id="days-${monthKey}"></div>
    <div class="day-bookmarks" id="day-bookmarks-${monthKey}"></div>
  `;

  yearRow.appendChild(detail);

  detail.querySelector('.month-detail-close').addEventListener('click', () => {
    detail.remove();
    monthCell.classList.remove('selected');
    state.selectedMonth = null;
  });

  renderDaysGrid(year, month, monthKey);
}

function renderDaysGrid(year, month, monthKey) {
  const daysGrid = document.getElementById(`days-${monthKey}`);
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const maxDayCount = Math.max(
    ...Object.entries(state.byDay)
      .filter(([key]) => key.startsWith(monthKey))
      .map(([, arr]) => arr.length),
    1
  );

  const weeks = [];
  let currentWeek = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push(null);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  weeks.forEach(week => {
    const weekRow = document.createElement('div');
    weekRow.className = 'week-row';

    week.forEach(day => {
      const cell = document.createElement('div');
      
      if (day === null) {
        cell.className = 'day-cell empty';
      } else {
        const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
        const count = state.byDay[dayKey]?.length || 0;
        const heatLevel = getHeatLevel(count, maxDayCount);
        
        cell.className = `day-cell heat-${heatLevel}`;
        cell.dataset.day = dayKey;
        cell.dataset.tooltip = `${MONTH_NAMES[month]} ${day}: ${count}`;
        cell.style.position = 'relative';
        
        cell.addEventListener('click', () => showDayBookmarks(dayKey, monthKey));
      }

      weekRow.appendChild(cell);
    });

    daysGrid.appendChild(weekRow);
  });
}

function showDayBookmarks(dayKey, monthKey) {
  const container = document.getElementById(`day-bookmarks-${monthKey}`);
  const bookmarks = state.byDay[dayKey] || [];

  document.querySelectorAll('.day-cell.selected').forEach(el => el.classList.remove('selected'));
  
  const dayCell = document.querySelector(`.day-cell[data-day="${dayKey}"]`);
  if (dayCell) dayCell.classList.add('selected');

  if (bookmarks.length === 0) {
    container.innerHTML = '<p class="day-bookmarks-header">No bookmarks on this day</p>';
    return;
  }

  const [year, month, day] = dayKey.split('-');
  const dateStr = `${MONTH_NAMES[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;

  container.innerHTML = `
    <div class="day-bookmarks-header">${dateStr} — ${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''}</div>
    ${bookmarks.map(b => {
      let domain = '';
      try {
        domain = new URL(b.url).hostname.replace('www.', '');
      } catch (e) {
        domain = b.site_name || '';
      }
      return `
        <div class="day-bookmark-item">
          <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener" class="day-bookmark-link">
            ${escapeHtml(b.title || b.url)}
          </a>
          <span class="day-bookmark-domain">${domain}</span>
        </div>
      `;
    }).join('')}
  `;
}

function updateStats() {
  const statsEl = document.getElementById('total-count');
  const total = state.bookmarks.length;
  const years = Object.keys(state.byYear).length;
  
  statsEl.textContent = `${total} bookmarks across ${years} year${years !== 1 ? 's' : ''}`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  const container = document.getElementById('activity-container');
  container.innerHTML = `<p class="loading">❌ ${message}</p>`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
