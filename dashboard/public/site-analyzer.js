class SiteAnalyzer {
    constructor() {
        this.currentAnalysis = null;
        this.logs = [];
        this.clickModeEnabled = false;
        this.currentFrameUrl = null;
        
        this.init();
    }

    init() {
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyze());
        document.getElementById('siteUrl').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.analyze();
            }
        });
        
        // Загружать логи с сервера периодически
        this.loadServerLogs();
        setInterval(() => this.loadServerLogs(), 5000); // Каждые 5 секунд
        
        // Обработчики для просмотра сайта
        document.getElementById('enableClickBtn').addEventListener('click', () => this.toggleClickMode());
        document.getElementById('reloadFrameBtn').addEventListener('click', () => this.reloadFrame());
        document.getElementById('closeViewerBtn').addEventListener('click', () => this.closeViewer());
        
        // Обработчик кликов по overlay
        const clickOverlay = document.getElementById('clickOverlay');
        clickOverlay.addEventListener('click', (e) => this.handleFrameClick(e));
    }

    async loadServerLogs() {
        try {
            const response = await fetch('/api/site-analyzer/logs?limit=50');
            if (response.ok) {
                const data = await response.json();
                // Добавить серверные логи в общий список
                data.logs.forEach(log => {
                    const logMessage = `[Сервер] ${log.action}: ${JSON.stringify(log.details)}`;
                    if (!this.logs.find(l => l.time === new Date(log.timestamp).toLocaleTimeString() && l.message === logMessage)) {
                        this.addLog(logMessage, 'info');
                    }
                });
            }
        } catch (error) {
            // Игнорировать ошибки загрузки логов
        }
    }

    addLog(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            time: timestamp,
            message,
            level
        };
        
        this.logs.push(logEntry);
        this.updateLogsDisplay();
    }

    updateLogsDisplay() {
        const container = document.getElementById('logsContainer');
        container.innerHTML = '';
        
        // Показать последние 100 логов
        const recentLogs = this.logs.slice(-100);
        
        recentLogs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = `log-entry log-level-${log.level}`;
            entry.innerHTML = `<span class="log-time">[${log.time}]</span> ${log.message}`;
            container.appendChild(entry);
        });
        
        // Прокрутить вниз
        container.scrollTop = container.scrollHeight;
    }

    async analyze() {
        const urlInput = document.getElementById('siteUrl');
        const url = urlInput.value.trim();
        
        if (!url) {
            this.addLog('Ошибка: Введите URL сайта', 'error');
            return;
        }

        // Валидация URL
        try {
            new URL(url);
        } catch (e) {
            this.addLog('Ошибка: Неверный формат URL', 'error');
            return;
        }

        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="loading"></span> Анализ...';

        this.addLog(`Начало анализа сайта: ${url}`, 'info');

        try {
            const response = await fetch('/api/site-analyzer/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.addLog(`Анализ завершен успешно. Найдено кнопок: ${data.buttons.length}`, 'success');
            
            this.displayResults(data);
            this.currentAnalysis = data;
            
        } catch (error) {
            this.addLog(`Ошибка анализа: ${error.message}`, 'error');
            console.error('Analysis error:', error);
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Анализировать';
        }
    }

    displayResults(data) {
        const resultsPanel = document.getElementById('resultsPanel');
        resultsPanel.style.display = 'block';

        // Статистика
        document.getElementById('totalButtons').textContent = data.buttons.length;
        document.getElementById('buttonButtons').textContent = data.stats.buttonElements;
        document.getElementById('linkButtons').textContent = data.stats.linkButtons;
        document.getElementById('inputButtons').textContent = data.stats.inputButtons;

        // Список кнопок
        const buttonsList = document.getElementById('buttonsList');
        buttonsList.innerHTML = '';

        if (data.buttons.length === 0) {
            buttonsList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>Кнопки не найдены</p>
                </div>
            `;
            return;
        }

        data.buttons.forEach((button, index) => {
            const item = document.createElement('div');
            item.className = 'button-item';
            item.addEventListener('click', () => {
                // Если есть ссылка, открыть в просмотре, иначе показать детали
                if (button.href) {
                    const fullUrl = this.resolveUrl(button.href, data.url);
                    this.openSiteViewer(fullUrl, button);
                } else {
                    this.analyzeButton(button, index);
                }
            });
            
            const typeBadge = this.getTypeBadge(button.type);
            
            item.innerHTML = `
                <div class="button-header">
                    <span class="button-text">${this.escapeHtml(button.text || '(без текста)')}</span>
                    <span class="button-type">${typeBadge}</span>
                </div>
                <div class="button-details">
                    <div class="detail-item">
                        <span class="detail-label">Тип:</span>
                        <span class="detail-value">${button.type}</span>
                    </div>
                    ${button.selector ? `
                    <div class="detail-item">
                        <span class="detail-label">Селектор:</span>
                        <span class="detail-value">${this.escapeHtml(button.selector)}</span>
                    </div>
                    ` : ''}
                    ${button.href ? `
                    <div class="detail-item">
                        <span class="detail-label">Ссылка:</span>
                        <span class="detail-value">${this.escapeHtml(button.href)}</span>
                    </div>
                    ` : ''}
                    ${button.classes ? `
                    <div class="detail-item">
                        <span class="detail-label">Классы:</span>
                        <span class="detail-value">${this.escapeHtml(button.classes)}</span>
                    </div>
                    ` : ''}
                    ${button.id ? `
                    <div class="detail-item">
                        <span class="detail-label">ID:</span>
                        <span class="detail-value">${this.escapeHtml(button.id)}</span>
                    </div>
                    ` : ''}
                </div>
            `;
            
            buttonsList.appendChild(item);
        });

        this.addLog(`Отображено ${data.buttons.length} кнопок`, 'success');
    }

    getTypeBadge(type) {
        const badges = {
            'button': 'BUTTON',
            'link': 'LINK',
            'input': 'INPUT',
            'div': 'DIV',
            'span': 'SPAN',
            'a': 'A'
        };
        return badges[type] || type.toUpperCase();
    }

    async analyzeButton(button, index) {
        this.addLog(`Анализ кнопки #${index + 1}: "${button.text || '(без текста)'}"`, 'info');
        
        // Если есть ссылка, открыть сайт в просмотре
        if (button.href) {
            const fullUrl = this.resolveUrl(button.href, this.currentAnalysis.url);
            this.openSiteViewer(fullUrl, button);
            this.addLog(`Открыт просмотр сайта: ${fullUrl}`, 'success');
        }
        
        try {
            const response = await fetch('/api/site-analyzer/analyze-button', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: this.currentAnalysis.url,
                    button: button
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.addLog(`Анализ кнопки завершен. Найдено элементов: ${data.elements.length}`, 'success');
            
            // Показать детальный анализ в модальном окне или новом разделе
            this.showButtonDetails(button, data);
            
        } catch (error) {
            this.addLog(`Ошибка анализа кнопки: ${error.message}`, 'error');
        }
    }

    resolveUrl(href, baseUrl) {
        try {
            // Если ссылка абсолютная
            if (href.startsWith('http://') || href.startsWith('https://')) {
                return href;
            }
            // Если ссылка начинается с /
            if (href.startsWith('/')) {
                const base = new URL(baseUrl);
                return `${base.protocol}//${base.host}${href}`;
            }
            // Относительная ссылка
            const base = new URL(baseUrl);
            return new URL(href, base).href;
        } catch (e) {
            return href;
        }
    }

    openSiteViewer(url, button = null) {
        const viewer = document.getElementById('siteViewer');
        const frame = document.getElementById('siteFrame');
        const currentUrlSpan = document.getElementById('currentFrameUrl');
        
        this.currentFrameUrl = url;
        currentUrlSpan.textContent = url;
        
        // Загрузить сайт через прокси для обхода CORS
        frame.src = `/api/site-analyzer/proxy?url=${encodeURIComponent(url)}`;
        
        viewer.style.display = 'block';
        viewer.scrollIntoView({ behavior: 'smooth' });
        
        if (button) {
            this.addLog(`Открыт просмотр сайта для кнопки: "${button.text || '(без текста)'}"`, 'info');
        }
    }

    toggleClickMode() {
        this.clickModeEnabled = !this.clickModeEnabled;
        const overlay = document.getElementById('clickOverlay');
        const btn = document.getElementById('enableClickBtn');
        
        if (this.clickModeEnabled) {
            overlay.classList.add('active');
            btn.textContent = 'Выключить клики';
            this.addLog('Режим кликов включен. Кликните на элемент в iframe для взаимодействия', 'info');
        } else {
            overlay.classList.remove('active');
            btn.textContent = 'Включить клики';
            this.addLog('Режим кликов выключен', 'info');
        }
    }

    async handleFrameClick(e) {
        if (!this.clickModeEnabled) return;
        
        const frame = document.getElementById('siteFrame');
        const rect = frame.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.addLog(`Клик по координатам: (${Math.round(x)}, ${Math.round(y)})`, 'info');
        
        // Отправить команду клика на сервер для проксирования
        try {
            const response = await fetch('/api/site-analyzer/click', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: this.currentFrameUrl,
                    x: Math.round(x),
                    y: Math.round(y),
                    button: 'left'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.addLog(`Клик выполнен. Новый URL: ${data.url || 'без изменений'}`, 'success');
                
                // Обновить iframe если URL изменился
                if (data.url && data.url !== this.currentFrameUrl) {
                    setTimeout(() => {
                        this.openSiteViewer(data.url);
                    }, 500);
                }
            }
        } catch (error) {
            this.addLog(`Ошибка выполнения клика: ${error.message}`, 'error');
        }
    }

    reloadFrame() {
        const frame = document.getElementById('siteFrame');
        if (this.currentFrameUrl) {
            frame.src = `/api/site-analyzer/proxy?url=${encodeURIComponent(this.currentFrameUrl)}`;
            this.addLog('Сайт обновлен', 'info');
        }
    }

    closeViewer() {
        const viewer = document.getElementById('siteViewer');
        viewer.style.display = 'none';
        this.clickModeEnabled = false;
        document.getElementById('clickOverlay').classList.remove('active');
        document.getElementById('enableClickBtn').textContent = 'Включить клики';
        this.addLog('Просмотр сайта закрыт', 'info');
    }

    showButtonDetails(button, analysis) {
        // Создать модальное окно с деталями
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--bg-card);
            border-radius: 12px;
            padding: 24px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            margin: 20px;
        `;
        
        content.innerHTML = `
            <h2 style="margin-bottom: 16px;">Детальный анализ кнопки</h2>
            <div style="margin-bottom: 16px;">
                <strong>Текст:</strong> ${this.escapeHtml(button.text || '(без текста)')}<br>
                <strong>Тип:</strong> ${button.type}<br>
                ${button.selector ? `<strong>Селектор:</strong> ${this.escapeHtml(button.selector)}<br>` : ''}
            </div>
            <h3 style="margin-bottom: 12px;">Найденные элементы:</h3>
            <div style="background: var(--bg-darker); padding: 16px; border-radius: 8px;">
                ${analysis.elements.map((el, i) => `
                    <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                        <strong>Элемент #${i + 1}:</strong> ${this.escapeHtml(el.tagName || 'Unknown')}<br>
                        ${el.text ? `<strong>Текст:</strong> ${this.escapeHtml(el.text)}<br>` : ''}
                        ${el.attributes ? `<strong>Атрибуты:</strong> ${this.escapeHtml(JSON.stringify(el.attributes, null, 2))}<br>` : ''}
                    </div>
                `).join('')}
            </div>
            <button class="btn btn-primary" style="margin-top: 16px; width: 100%;" onclick="this.closest('div[style*=\"position: fixed\"]').remove()">Закрыть</button>
        `;
        
        modal.appendChild(content);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new SiteAnalyzer();
});

