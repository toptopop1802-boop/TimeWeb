class SiteTrainer {
    constructor() {
        this.currentAnalysis = null;
        this.init();
    }

    init() {
        const urlInput = document.getElementById('siteUrl');
        const analyzeBtn = document.getElementById('analyzeBtn');
        
        analyzeBtn.addEventListener('click', () => this.analyze());
        
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.analyze();
            }
        });
    }

    async analyze() {
        const urlInput = document.getElementById('siteUrl');
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('Введите URL сайта');
            return;
        }

        // Валидация URL
        let validUrl = url;
        try {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                validUrl = 'https://' + url;
            }
            new URL(validUrl);
        } catch (e) {
            alert('Неверный формат URL');
            return;
        }

        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span class="loading"></span> Анализ...';

        try {
            // Загружаем сайт в iframe
            this.loadSitePreview(validUrl);

            // Анализируем сайт
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
            this.currentAnalysis = data;
            
            // Отображаем результаты
            this.displayResults(data);
            
        } catch (error) {
            alert(`Ошибка анализа: ${error.message}`);
            console.error('Analysis error:', error);
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Анализировать';
        }
    }

    loadSitePreview(url) {
        const frame = document.getElementById('siteFrame');
        frame.src = `/api/site-analyzer/proxy?url=${encodeURIComponent(url)}`;
    }

    displayResults(data) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.style.display = 'block';
        resultsContainer.scrollIntoView({ behavior: 'smooth' });

        // Информация о сайте
        this.displaySiteInfo(data);

        // Статистика
        this.displayStats(data.stats);

        // Элементы
        this.displayElements(data.buttons);
    }

    displaySiteInfo(data) {
        const siteInfo = document.getElementById('siteInfo');
        const url = new URL(data.url);
        
        siteInfo.innerHTML = `
            <div class="info-item">
                <span class="info-label">URL:</span>
                <span class="info-value">${this.escapeHtml(data.url)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Домен:</span>
                <span class="info-value">${this.escapeHtml(url.hostname)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Протокол:</span>
                <span class="info-value">${this.escapeHtml(url.protocol)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Всего элементов:</span>
                <span class="info-value">${data.buttons.length}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Время анализа:</span>
                <span class="info-value">${new Date(data.analyzedAt).toLocaleString('ru-RU')}</span>
            </div>
        `;
    }

    displayStats(stats) {
        const statsGrid = document.getElementById('statsGrid');
        
        statsGrid.innerHTML = `
            <div class="stat-box">
                <div class="stat-number">${stats.buttonElements || 0}</div>
                <div class="stat-label">Кнопки &lt;button&gt;</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${stats.linkButtons || 0}</div>
                <div class="stat-label">Ссылки &lt;a&gt;</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${stats.inputButtons || 0}</div>
                <div class="stat-label">Input кнопки</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${(stats.divButtons || 0) + (stats.spanButtons || 0)}</div>
                <div class="stat-label">Div/Span элементы</div>
            </div>
        `;
    }

    displayElements(buttons) {
        const elementsList = document.getElementById('elementsList');
        elementsList.innerHTML = '';

        if (buttons.length === 0) {
            elementsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Элементы не найдены</p>';
            return;
        }

        buttons.forEach((button, index) => {
            const card = document.createElement('div');
            card.className = 'element-card';
            card.addEventListener('click', () => {
                this.showElementDetails(button);
            });

            const tagName = button.type === 'link' ? 'a' : (button.type === 'input' ? 'input' : button.type);
            const typeBadge = this.getTypeBadge(button.type);

            card.innerHTML = `
                <div class="element-header">
                    <div>
                        <span class="element-tag">&lt;${tagName}&gt;</span>
                        ${button.text ? `<span style="margin-left: 8px; color: var(--text-primary);">${this.escapeHtml(button.text)}</span>` : ''}
                    </div>
                    <span class="element-type">${typeBadge}</span>
                </div>
                <div class="element-details">
                    ${button.selector ? `
                    <div class="detail-row">
                        <span class="detail-label">Селектор:</span>
                        <span class="detail-value">${this.escapeHtml(button.selector)}</span>
                    </div>
                    ` : ''}
                    ${button.href ? `
                    <div class="detail-row">
                        <span class="detail-label">Ссылка:</span>
                        <span class="detail-value">${this.escapeHtml(button.href)}</span>
                    </div>
                    ` : ''}
                    ${button.classes ? `
                    <div class="detail-row">
                        <span class="detail-label">Классы:</span>
                        <span class="detail-value">${this.escapeHtml(button.classes)}</span>
                    </div>
                    ` : ''}
                    ${button.id ? `
                    <div class="detail-row">
                        <span class="detail-label">ID:</span>
                        <span class="detail-value">${this.escapeHtml(button.id)}</span>
                    </div>
                    ` : ''}
                </div>
                ${button.html ? `
                <div class="code-preview">${this.escapeHtml(button.html.substring(0, 200))}${button.html.length > 200 ? '...' : ''}</div>
                ` : ''}
            `;

            elementsList.appendChild(card);
        });
    }

    showElementDetails(button) {
        // Строим полный HTML код элемента
        let htmlCode = '';
        
        if (button.html && button.html.length > 20) {
            htmlCode = button.html;
        } else {
            const tagName = button.type === 'link' ? 'a' : (button.type === 'input' ? 'input' : button.type);
            htmlCode = `<${tagName}`;
            
            if (button.id) htmlCode += ` id="${this.escapeHtml(button.id)}"`;
            if (button.classes) htmlCode += ` class="${this.escapeHtml(button.classes)}"`;
            if (button.href) htmlCode += ` href="${this.escapeHtml(button.href)}"`;
            if (button.type === 'input' && button.inputType) htmlCode += ` type="${this.escapeHtml(button.inputType)}"`;
            if (button.type === 'input' && button.text) htmlCode += ` value="${this.escapeHtml(button.text)}"`;
            
            if (button.type === 'input') {
                htmlCode += ' />';
            } else {
                htmlCode += `>${this.escapeHtml(button.text || '')}</${tagName}>`;
            }
        }

        // Форматируем HTML
        const formattedHtml = this.formatHtml(htmlCode);

        // Создаем обучающий вывод
        const trainingData = this.generateTrainingData(button, formattedHtml);

        // Показываем модальное окно с обучающими данными
        this.showTrainingModal(button, formattedHtml, trainingData);
    }

    generateTrainingData(button, htmlCode) {
        const tagName = button.type === 'link' ? 'a' : (button.type === 'input' ? 'input' : button.type);
        
        return {
            element: {
                tag: tagName,
                type: button.type,
                text: button.text || '',
                selector: button.selector || '',
                attributes: {
                    id: button.id || null,
                    classes: button.classes || null,
                    href: button.href || null,
                    type: button.inputType || null
                }
            },
            html: htmlCode,
            description: this.generateDescription(button)
        };
    }

    generateDescription(button) {
        const parts = [];
        
        parts.push(`Элемент типа "${button.type}"`);
        
        if (button.text) {
            parts.push(`с текстом "${button.text}"`);
        }
        
        if (button.href) {
            parts.push(`ведущий на "${button.href}"`);
        }
        
        if (button.classes) {
            parts.push(`с классами "${button.classes}"`);
        }
        
        if (button.id) {
            parts.push(`с ID "${button.id}"`);
        }
        
        return parts.join(', ') + '.';
    }

    formatHtml(html) {
        if (!html || !html.trim()) return html;
        
        let formatted = '';
        let indent = 0;
        const tab = '  ';
        
        html = html.replace(/>\s+</g, '><').trim();
        const parts = html.split(/(<[^>]+>)/);
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part.trim()) continue;
            
            if (part.startsWith('</')) {
                indent = Math.max(0, indent - 1);
                formatted += tab.repeat(indent) + part + '\n';
            } else if (part.startsWith('<')) {
                formatted += tab.repeat(indent) + part;
                if (!part.match(/\/\s*>$/)) {
                    formatted += '\n';
                    indent++;
                } else {
                    formatted += '\n';
                }
            } else {
                const text = part.trim();
                if (text) {
                    formatted += tab.repeat(indent) + text + '\n';
                }
            }
        }
        
        return formatted.trim();
    }

    showTrainingModal(button, htmlCode, trainingData) {
        const modal = document.createElement('div');
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
        content.style.cssText = `
            background: #1e1e1e;
            border-radius: 8px;
            padding: 0;
            max-width: 90%;
            max-height: 90vh;
            width: 900px;
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
            font-size: 16px;
        `;
        title.textContent = `📚 Обучающие данные: ${button.text || button.type}`;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: transparent;
            border: none;
            color: #cccccc;
            font-size: 24px;
            cursor: pointer;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
        `;
        closeBtn.onclick = () => modal.remove();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Тело
        const body = document.createElement('div');
        body.style.cssText = `
            padding: 20px;
            overflow: auto;
            flex: 1;
            background: #1e1e1e;
        `;
        
        // Описание элемента
        const description = document.createElement('div');
        description.style.cssText = `
            background: #252526;
            padding: 16px;
            border-radius: 6px;
            margin-bottom: 20px;
            color: #cccccc;
            font-size: 14px;
            line-height: 1.6;
        `;
        description.innerHTML = `
            <div style="color: #4ec9b0; font-weight: 600; margin-bottom: 8px;">Описание элемента:</div>
            <div>${this.escapeHtml(trainingData.description)}</div>
        `;
        
        // JSON данные для обучения
        const jsonData = document.createElement('div');
        jsonData.style.cssText = `
            background: #252526;
            padding: 16px;
            border-radius: 6px;
            margin-bottom: 20px;
        `;
        jsonData.innerHTML = `
            <div style="color: #4ec9b0; font-weight: 600; margin-bottom: 8px;">JSON данные для обучения:</div>
            <pre style="color: #d4d4d4; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; margin: 0; overflow-x: auto;">${JSON.stringify(trainingData.element, null, 2)}</pre>
        `;
        
        // HTML код
        const codeSection = document.createElement('div');
        codeSection.style.cssText = `
            background: #252526;
            padding: 16px;
            border-radius: 6px;
        `;
        codeSection.innerHTML = `
            <div style="color: #4ec9b0; font-weight: 600; margin-bottom: 8px;">HTML код:</div>
            <pre style="color: #d4d4d4; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; margin: 0; overflow-x: auto; white-space: pre-wrap;">${this.escapeHtml(htmlCode)}</pre>
        `;
        
        body.appendChild(description);
        body.appendChild(jsonData);
        body.appendChild(codeSection);
        
        // Футер
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 12px 20px;
            border-top: 1px solid #333;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        `;
        
        const copyJsonBtn = document.createElement('button');
        copyJsonBtn.textContent = 'Копировать JSON';
        copyJsonBtn.style.cssText = `
            padding: 8px 16px;
            background: #0e639c;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 13px;
        `;
        copyJsonBtn.onclick = () => {
            navigator.clipboard.writeText(JSON.stringify(trainingData.element, null, 2)).then(() => {
                copyJsonBtn.textContent = 'Скопировано!';
                setTimeout(() => copyJsonBtn.textContent = 'Копировать JSON', 2000);
            });
        };
        
        const copyHtmlBtn = document.createElement('button');
        copyHtmlBtn.textContent = 'Копировать HTML';
        copyHtmlBtn.style.cssText = `
            padding: 8px 16px;
            background: #0e639c;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 13px;
        `;
        copyHtmlBtn.onclick = () => {
            navigator.clipboard.writeText(htmlCode).then(() => {
                copyHtmlBtn.textContent = 'Скопировано!';
                setTimeout(() => copyHtmlBtn.textContent = 'Копировать HTML', 2000);
            });
        };
        
        footer.appendChild(copyJsonBtn);
        footer.appendChild(copyHtmlBtn);
        
        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(footer);
        modal.appendChild(content);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new SiteTrainer();
});

