// Скрипт для страницы логов

let logs = [];
let autoScrollEnabled = true;
let filters = {
  info: true,
  success: true,
  warning: true,
  error: true,
  debug: true
};

// Элементы DOM
const logsContainer = document.getElementById('logsContainer');
const totalLogsEl = document.getElementById('totalLogs');
const errorCountEl = document.getElementById('errorCount');
const successCountEl = document.getElementById('successCount');

// Кнопки
const clearLogsBtn = document.getElementById('clearLogs');
const autoScrollBtn = document.getElementById('autoScroll');
const filterInfoBtn = document.getElementById('filterInfo');
const filterSuccessBtn = document.getElementById('filterSuccess');
const filterWarningBtn = document.getElementById('filterWarning');
const filterErrorBtn = document.getElementById('filterError');
const filterDebugBtn = document.getElementById('filterDebug');

// Инициализация
function init() {
  // Загружаем сохраненные логи из storage
  chrome.storage.local.get(['extensionLogs'], (result) => {
    if (result.extensionLogs && Array.isArray(result.extensionLogs)) {
      logs = result.extensionLogs;
      renderLogs();
    }
  });

  // Слушаем новые логи от background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'newLog') {
      addLog(request.log);
    }
  });

  // Обработчики кнопок
  clearLogsBtn.addEventListener('click', clearLogs);
  autoScrollBtn.addEventListener('click', toggleAutoScroll);
  filterInfoBtn.addEventListener('click', () => toggleFilter('info', filterInfoBtn));
  filterSuccessBtn.addEventListener('click', () => toggleFilter('success', filterSuccessBtn));
  filterWarningBtn.addEventListener('click', () => toggleFilter('warning', filterWarningBtn));
  filterErrorBtn.addEventListener('click', () => toggleFilter('error', filterErrorBtn));
  filterDebugBtn.addEventListener('click', () => toggleFilter('debug', filterDebugBtn));
}

// Добавление нового лога
function addLog(logEntry) {
  logs.push(logEntry);
  
  // Ограничиваем количество логов (последние 1000)
  if (logs.length > 1000) {
    logs = logs.slice(-1000);
  }

  // Сохраняем в storage
  chrome.storage.local.set({ extensionLogs: logs });

  renderLogs();
}

// Очистка логов
function clearLogs() {
  if (confirm('Очистить все логи?')) {
    logs = [];
    chrome.storage.local.set({ extensionLogs: [] });
    renderLogs();
  }
}

// Переключение автоскролла
function toggleAutoScroll() {
  autoScrollEnabled = !autoScrollEnabled;
  autoScrollBtn.classList.toggle('active', autoScrollEnabled);
  if (autoScrollEnabled) {
    scrollToBottom();
  }
}

// Переключение фильтра
function toggleFilter(type, button) {
  filters[type] = !filters[type];
  button.classList.toggle('active', filters[type]);
  renderLogs();
}

// Форматирование времени
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

// Рендеринг логов
function renderLogs() {
  if (logs.length === 0) {
    logsContainer.innerHTML = '<div class="empty-logs">Нет логов</div>';
    updateStats();
    return;
  }

  const filteredLogs = logs.filter(log => filters[log.level] !== false);
  
  if (filteredLogs.length === 0) {
    logsContainer.innerHTML = '<div class="empty-logs">Нет логов с выбранными фильтрами</div>';
    updateStats();
    return;
  }

  logsContainer.innerHTML = filteredLogs.map(log => {
    const time = formatTime(log.timestamp);
    const source = log.source || 'unknown';
    const message = escapeHtml(String(log.message));
    let dataHtml = '';
    if (log.data !== undefined && log.data !== null) {
      try {
        const pretty = JSON.stringify(log.data, null, 2);
        dataHtml = `<div class="log-data" style="margin-top:6px;"><pre style="margin:0; white-space:pre-wrap; color:#9aa0a6;">${escapeHtml(pretty)}</pre></div>`;
      } catch {
        dataHtml = `<div class="log-data" style="margin-top:6px;"><pre style="margin:0; white-space:pre-wrap; color:#9aa0a6;">${escapeHtml(String(log.data))}</pre></div>`;
      }
    }
    
    return `
      <div class="log-entry ${log.level}">
        <span class="log-time">${time}</span>
        <span class="log-source">[${source}]</span>
        <span class="log-message">${message}</span>
        ${dataHtml}
      </div>
    `;
  }).join('');

  updateStats();

  if (autoScrollEnabled) {
    scrollToBottom();
  }
}

// Обновление статистики
function updateStats() {
  totalLogsEl.textContent = logs.length;
  errorCountEl.textContent = logs.filter(l => l.level === 'error').length;
  successCountEl.textContent = logs.filter(l => l.level === 'success').length;
}

// Скролл вниз
function scrollToBottom() {
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Инициализация при загрузке
init();

// Периодическая проверка новых логов (на случай если сообщения не проходят)
setInterval(() => {
  chrome.storage.local.get(['extensionLogs'], (result) => {
    if (result.extensionLogs && Array.isArray(result.extensionLogs)) {
      const newLength = result.extensionLogs.length;
      if (newLength !== logs.length) {
        logs = result.extensionLogs;
        renderLogs();
      }
    }
  });
}, 1000);

