class SiteAnalyzer {
    constructor() {
        this.currentAnalysis = null;
        this.logs = [];
        this.clickModeEnabled = false;
        this.currentFrameUrl = null;
        
        this.init();
    }

    init() {
        const urlInput = document.getElementById('siteUrl');
        const analyzeBtn = document.getElementById('analyzeBtn');
        
        analyzeBtn.addEventListener('click', () => this.analyze());
        
        // Автоматический предпросмотр при вводе URL (с задержкой)
        let previewTimeout;
        urlInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (!url) {
                return;
            }
            
            // Очищаем предыдущий таймаут
            clearTimeout(previewTimeout);
            
            // Устанавливаем новый таймаут для предпросмотра
            previewTimeout = setTimeout(() => {
                try {
                    let validUrl = url;
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        validUrl = 'https://' + url;
                    }
                    // Валидация URL
                    try {
                        new URL(validUrl);
                        // Если URL валидный, открываем предпросмотр
                        this.openSiteViewer(validUrl);
                    } catch (urlError) {
                        // URL невалидный, игнорируем
                    }
                } catch (e) {
                    // Игнорируем все ошибки при автоматическом предпросмотре
                }
            }, 1000); // Задержка 1 секунда после окончания ввода
        });
        
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(previewTimeout);
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
        
        // Обработчик кликов напрямую в iframe (если возможно)
        const siteFrame = document.getElementById('siteFrame');
        siteFrame.addEventListener('load', () => {
            const frameLoading = document.getElementById('frameLoading');
            if (frameLoading) {
                frameLoading.style.display = 'none';
            }
            
            // Проверяем, что загрузился правильный сайт
            try {
                const frameDoc = siteFrame.contentDocument || siteFrame.contentWindow?.document;
                if (frameDoc) {
                    // Пытаемся получить URL (может вызвать ошибку безопасности)
                    try {
                        const frameUrl = frameDoc.location?.href || siteFrame.contentWindow?.location?.href;
                        if (frameUrl && !frameUrl.includes('bublickrust.ru') && this.currentFrameUrl) {
                            this.addLog(`Сайт загружен: ${frameUrl}`, 'success');
                        }
                    } catch (urlError) {
                        // Игнорируем ошибки доступа к location
                    }
                    
                    // Пытаемся добавить обработчик кликов в iframe
                    try {
                        frameDoc.addEventListener('click', (e) => {
                            if (this.clickModeEnabled) {
                                // Координаты клика относительно iframe
                                const rect = siteFrame.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const y = e.clientY - rect.top;
                                this.handleFrameClick({ clientX: x + rect.left, clientY: y + rect.top });
                            }
                        });
                    } catch (eventError) {
                        // Игнорируем ошибки добавления обработчиков
                    }
                }
            } catch (e) {
                // CORS или другие ограничения безопасности
                // Используем overlay вместо прямого доступа
                // Не логируем, чтобы не спамить
            }
        });
        
        siteFrame.addEventListener('error', (e) => {
            const frameLoading = document.getElementById('frameLoading');
            if (frameLoading) {
                frameLoading.style.display = 'none';
            }
            this.addLog('Ошибка загрузки iframe', 'error');
        });
        
        // Global error handler for unhandled errors from iframe
        window.addEventListener('error', (e) => {
            // Check if error is related to iframe
            if (e.message && (
                e.message.includes('bublickrust.ru') || 
                e.message.includes('Application error') ||
                e.message.includes('cross-origin')
            )) {
                e.preventDefault(); // Suppress error
                return false;
            }
        }, true);
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            if (e.reason && typeof e.reason === 'string' && (
                e.reason.includes('bublickrust.ru') || 
                e.reason.includes('Application error') ||
                e.reason.includes('cross-origin')
            )) {
                e.preventDefault(); // Suppress error
            }
        });
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
        let validUrl = url;
        try {
            // Если URL не начинается с http:// или https://, добавляем https://
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                validUrl = 'https://' + url;
            }
            new URL(validUrl);
        } catch (e) {
            this.addLog('Ошибка: Неверный формат URL', 'error');
            return;
        }

        // Сразу открываем предпросмотр сайта
        this.openSiteViewer(validUrl);
        this.addLog(`Открыт предпросмотр сайта: ${validUrl}`, 'info');

        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="loading"></span> Анализ...';

        this.addLog(`Начало анализа сайта: ${validUrl}`, 'info');

        try {
            const response = await fetch('/api/site-analyzer/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: validUrl })
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
                // Всегда показываем код элемента
                this.showButtonCode(button);
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
        const frameLoading = document.getElementById('frameLoading');
        
        // Валидация и нормализация URL
        let validUrl = url;
        try {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                validUrl = 'https://' + url;
            }
            new URL(validUrl);
        } catch (e) {
            this.addLog(`Ошибка: Неверный URL: ${url}`, 'error');
            return;
        }
        
        this.currentFrameUrl = validUrl;
        currentUrlSpan.textContent = validUrl;
        
        // Показываем индикатор загрузки
        if (frameLoading) {
            frameLoading.style.display = 'flex';
        }
        
        // Загрузить сайт через прокси для обхода CORS
        const proxyUrl = `/api/site-analyzer/proxy?url=${encodeURIComponent(validUrl)}`;
        frame.src = proxyUrl;
        
        this.addLog(`Загрузка сайта: ${validUrl}`, 'info');
        
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
        const frame = document.getElementById('siteFrame');
        
        if (this.clickModeEnabled) {
            overlay.classList.add('active');
            overlay.style.pointerEvents = 'auto';
            btn.textContent = 'Выключить клики';
            btn.style.background = 'rgba(196,5,82,0.9)';
            this.addLog('Режим кликов включен. Кликните на элемент в iframe для взаимодействия', 'info');
            
            // Пытаемся сделать iframe интерактивным
            try {
                const frameDoc = frame.contentDocument || frame.contentWindow?.document;
                if (frameDoc && frameDoc.body) {
                    try {
                        frameDoc.body.style.cursor = 'pointer';
                    } catch (styleError) {
                        // Игнорируем ошибки стилей
                    }
                }
            } catch (e) {
                // CORS ограничения
            }
        } else {
            overlay.classList.remove('active');
            overlay.style.pointerEvents = 'none';
            btn.textContent = 'Включить клики';
            btn.style.background = '';
            this.addLog('Режим кликов выключен', 'info');
        }
    }

    async handleFrameClick(e) {
        if (!this.clickModeEnabled) return;
        
        const frame = document.getElementById('siteFrame');
        const rect = frame.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Проверяем, что клик внутри iframe
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
            return;
        }
        
        this.addLog(`Клик по координатам: (${Math.round(x)}, ${Math.round(y)})`, 'info');
        
        // Пытаемся кликнуть напрямую в iframe
        try {
            const frameDoc = frame.contentDocument || frame.contentWindow?.document;
            if (frameDoc) {
                try {
                    const element = frameDoc.elementFromPoint(x, y);
                    if (element) {
                        // Если это ссылка, показываем код элемента
                        if (element.tagName === 'A') {
                            try {
                                const href = element.href;
                                if (href) {
                                    this.addLog(`Найдена ссылка: ${href}`, 'info');
                                    // Показываем код элемента вместо перехода
                                    this.showElementCode(element, frameDoc);
                                    return;
                                }
                            } catch (hrefError) {
                                // Игнорируем ошибки доступа к href, но все равно показываем код
                                this.showElementCode(element, frameDoc);
                                return;
                            }
                        }
                        
                        // Для всех элементов показываем код
                        this.showElementCode(element, frameDoc);
                        return;
                    }
                } catch (elementError) {
                    // Игнорируем ошибки доступа к элементам
                }
            }
        } catch (e) {
            // CORS или другие ограничения - используем серверный метод для получения HTML
            this.addLog('Не удалось получить элемент напрямую. Попробуйте кликнуть еще раз.', 'warning');
        }
    }

    reloadFrame() {
        const frame = document.getElementById('siteFrame');
        const frameLoading = document.getElementById('frameLoading');
        
        if (this.currentFrameUrl) {
            if (frameLoading) {
                frameLoading.style.display = 'flex';
            }
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

    showButtonCode(button) {
        try {
            // Используем сохраненный HTML, если он есть и достаточно полный
            let htmlCode = '';
            
            if (button.html && button.html.length > 20) {
                // Используем сохраненный HTML (может быть обрезан до 200 символов)
                htmlCode = button.html;
            } else {
                // Строим HTML код из данных кнопки
                const tagName = button.type === 'link' ? 'a' : (button.type === 'input' ? 'input' : button.type);
                
                htmlCode = `<${tagName}`;
                
                // Добавляем атрибуты
                if (button.id) {
                    htmlCode += ` id="${this.escapeHtml(button.id)}"`;
                }
                if (button.classes) {
                    htmlCode += ` class="${this.escapeHtml(button.classes)}"`;
                }
                if (button.href) {
                    htmlCode += ` href="${this.escapeHtml(button.href)}"`;
                }
                if (button.type === 'input' && button.inputType) {
                    htmlCode += ` type="${this.escapeHtml(button.inputType)}"`;
                }
                if (button.type === 'input' && button.text) {
                    htmlCode += ` value="${this.escapeHtml(button.text)}"`;
                }
                
                // Завершаем тег
                if (button.type === 'input') {
                    htmlCode += ' />';
                } else {
                    htmlCode += `>${this.escapeHtml(button.text || '')}</${tagName}>`;
                }
            }
            
            // Форматируем HTML
            const formattedHtml = this.formatHtml(htmlCode);
            
            // Определяем tagName для виртуального элемента
            const tagName = button.type === 'link' ? 'a' : (button.type === 'input' ? 'input' : button.type);
            
            // Создаем виртуальный элемент для передачи в showCodeModal
            const virtualElement = {
                tagName: tagName.toUpperCase(),
                id: button.id || null,
                className: button.classes || ''
            };
            
            // Показываем модальное окно с кодом
            this.showCodeModal(formattedHtml, virtualElement);
            
        } catch (error) {
            this.addLog(`Ошибка при получении кода кнопки: ${error.message}`, 'error');
        }
    }
    
    showElementCode(element, frameDoc) {
        try {
            // Получаем HTML код элемента
            let htmlCode = '';
            try {
                htmlCode = element.outerHTML || element.innerHTML || '';
            } catch (e) {
                // Если не можем получить outerHTML, создаем вручную
                htmlCode = `<${element.tagName.toLowerCase()}`;
                if (element.id) htmlCode += ` id="${element.id}"`;
                if (element.className) htmlCode += ` class="${element.className}"`;
                // Добавляем другие атрибуты
                if (element.attributes) {
                    for (let attr of element.attributes) {
                        if (attr.name !== 'id' && attr.name !== 'class') {
                            htmlCode += ` ${attr.name}="${attr.value}"`;
                        }
                    }
                }
                htmlCode += `>${element.innerHTML || ''}</${element.tagName.toLowerCase()}>`;
            }
            
            // Форматируем HTML
            const formattedHtml = this.formatHtml(htmlCode);
            
            // Показываем модальное окно с кодом
            this.showCodeModal(formattedHtml, element);
            
        } catch (error) {
            this.addLog(`Ошибка при получении кода элемента: ${error.message}`, 'error');
        }
    }
    
    formatHtml(html) {
        // Простое форматирование HTML с отступами
        if (!html || !html.trim()) return html;
        
        let formatted = '';
        let indent = 0;
        const tab = '  ';
        
        // Нормализуем пробелы
        html = html.replace(/>\s+</g, '><').trim();
        
        // Разбиваем на теги и текст
        const parts = html.split(/(<[^>]+>)/);
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part.trim()) continue;
            
            if (part.startsWith('</')) {
                // Закрывающий тег
                indent = Math.max(0, indent - 1);
                formatted += tab.repeat(indent) + part + '\n';
            } else if (part.startsWith('<')) {
                // Открывающий тег
                formatted += tab.repeat(indent) + part;
                // Проверяем, самозакрывающийся ли тег
                if (!part.match(/\/\s*>$/)) {
                    // Не самозакрывающийся - увеличиваем отступ
                    formatted += '\n';
                    indent++;
                } else {
                    formatted += '\n';
                }
            } else {
                // Текст между тегами
                const text = part.trim();
                if (text) {
                    formatted += tab.repeat(indent) + text + '\n';
                }
            }
        }
        
        return formatted.trim();
    }
    
    highlightHtml(html) {
        // Простая подсветка синтаксиса HTML
        return html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/(&lt;\/?)([\w-]+)([^&]*?)(&gt;)/g, (match, open, tag, attrs, close) => {
                let highlighted = `<span class="code-tag">${open}</span><span class="code-tag-name">${tag}</span>`;
                
                // Подсветка атрибутов
                if (attrs) {
                    highlighted += attrs.replace(/([\w-]+)(=)(["'][^"']*["'])/g, 
                        '<span class="code-attr">$1</span><span class="code-operator">$2</span><span class="code-string">$3</span>');
                }
                
                highlighted += `<span class="code-tag">${close}</span>`;
                return highlighted;
            })
            .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="code-comment">$1</span>');
    }
    
    showCodeModal(htmlCode, element) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'code-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
        `;
        
        const content = document.createElement('div');
        content.className = 'code-modal-content';
        content.style.cssText = `
            background: #1e1e1e;
            border-radius: 8px;
            padding: 0;
            max-width: 90%;
            max-height: 90vh;
            width: 800px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        `;
        
        // Заголовок
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 16px 20px;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const title = document.createElement('div');
        title.style.cssText = `
            color: #cccccc;
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        title.innerHTML = `
            <span style="color: #4ec9b0;">&lt;</span>
            <span style="color: #569cd6;">${element.tagName.toLowerCase()}</span>
            <span style="color: #4ec9b0;">&gt;</span>
            <span style="color: #808080; font-size: 12px; margin-left: 8px;">${element.id ? `#${element.id}` : ''} ${element.className ? `.${element.className.split(' ')[0]}` : ''}</span>
        `;
        
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Копировать';
        copyBtn.style.cssText = `
            padding: 6px 12px;
            background: #0e639c;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: background 0.2s;
        `;
        copyBtn.onmouseover = () => copyBtn.style.background = '#1177bb';
        copyBtn.onmouseout = () => copyBtn.style.background = '#0e639c';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(htmlCode).then(() => {
                copyBtn.textContent = 'Скопировано!';
                setTimeout(() => {
                    copyBtn.textContent = 'Копировать';
                }, 2000);
            });
        };
        
        header.appendChild(title);
        header.appendChild(copyBtn);
        
        // Тело с кодом
        const codeBody = document.createElement('div');
        codeBody.style.cssText = `
            padding: 20px;
            overflow: auto;
            flex: 1;
            background: #1e1e1e;
        `;
        
        const codePre = document.createElement('pre');
        codePre.style.cssText = `
            margin: 0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.6;
            color: #d4d4d4;
        `;
        
        const codeElement = document.createElement('code');
        codeElement.className = 'code-content';
        codeElement.innerHTML = this.highlightHtml(htmlCode);
        
        codePre.appendChild(codeElement);
        codeBody.appendChild(codePre);
        
        // Футер с кнопкой закрытия
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 12px 20px;
            border-top: 1px solid #333;
            display: flex;
            justify-content: flex-end;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Закрыть';
        closeBtn.style.cssText = `
            padding: 8px 16px;
            background: #3c3c3c;
            border: none;
            border-radius: 4px;
            color: #cccccc;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s;
        `;
        closeBtn.onmouseover = () => closeBtn.style.background = '#4a4a4a';
        closeBtn.onmouseout = () => closeBtn.style.background = '#3c3c3c';
        closeBtn.onclick = () => modal.remove();
        
        footer.appendChild(closeBtn);
        
        content.appendChild(header);
        content.appendChild(codeBody);
        content.appendChild(footer);
        modal.appendChild(content);
        
        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Закрытие по Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        document.body.appendChild(modal);
        
        // Фокус на кнопке копирования для удобства
        copyBtn.focus();
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

