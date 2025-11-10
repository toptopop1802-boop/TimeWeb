class SiteAutomation {
    constructor() {
        this.logs = [];
        this.init();
    }

    init() {
        document.getElementById('generateBtn').addEventListener('click', () => this.runAutomation());
    }

    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            time: timestamp,
            message,
            type
        };
        
        this.logs.push(logEntry);
        this.updateLogsDisplay();
    }

    updateLogsDisplay() {
        const container = document.getElementById('logContainer');
        container.innerHTML = '';
        
        this.logs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = `log-entry ${log.type}`;
            entry.innerHTML = `<span class="log-time">[${log.time}]</span> ${this.escapeHtml(log.message)}`;
            container.appendChild(entry);
        });
        
        container.scrollTop = container.scrollHeight;
    }

    async runAutomation() {
        const generateBtn = document.getElementById('generateBtn');
        const resultsPanel = document.getElementById('resultsPanel');
        const siteUrl = document.getElementById('siteUrl').value.trim();
        const elementConfigText = document.getElementById('elementConfig').value.trim();
        
        if (!siteUrl) {
            alert('Введите URL сайта');
            return;
        }

        if (!elementConfigText) {
            alert('Введите конфигурацию элемента');
            return;
        }

        let elementConfig;
        try {
            elementConfig = JSON.parse(elementConfigText);
        } catch (e) {
            alert('Неверный формат JSON конфигурации');
            return;
        }

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="loading"></span> Выполнение...';
        resultsPanel.classList.add('active');
        this.logs = [];
        this.addLog('Начало автоматизации...', 'info');

        try {
            this.addLog(`Открытие сайта: ${siteUrl}`, 'info');
            
            const response = await fetch('/api/site-automation/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: siteUrl,
                    element: elementConfig
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data.logs && data.logs.length > 0) {
                data.logs.forEach(log => {
                    this.addLog(log.message, log.type || 'info');
                });
            }
            
            if (data.success) {
                this.addLog('Автоматизация завершена успешно!', 'success');
            } else {
                this.addLog(`Автоматизация завершена с ошибками: ${data.error || 'Неизвестная ошибка'}`, 'error');
            }
            
            // Показываем инструкции по установке зависимостей, если есть ошибка
            if (data.troubleshooting) {
                const troubleshootingBox = document.createElement('div');
                troubleshootingBox.style.cssText = `
                    background: #fff3cd;
                    border: 2px solid #ffc107;
                    border-radius: 8px;
                    padding: 16px;
                    margin-top: 16px;
                    color: #856404;
                `;
                troubleshootingBox.innerHTML = `
                    <strong style="display: block; margin-bottom: 8px;">⚠️ Требуется установка системных зависимостей:</strong>
                    <pre style="background: #f8f9fa; padding: 12px; border-radius: 4px; overflow-x: auto; margin: 0; font-size: 12px;">${this.escapeHtml(data.troubleshooting)}</pre>
                    <p style="margin-top: 12px; margin-bottom: 0; font-size: 13px;">Выполните эту команду на сервере в терминале с правами root.</p>
                `;
                document.getElementById('resultsPanel').appendChild(troubleshootingBox);
            }
            
            if (data.screenshot) {
                const previewBox = document.getElementById('previewBox');
                const screenshotImg = document.getElementById('screenshotImg');
                screenshotImg.src = `data:image/png;base64,${data.screenshot}`;
                previewBox.style.display = 'block';
                this.addLog('Скриншот получен', 'success');
            }
            
            if (data.finalUrl) {
                this.addLog(`Финальный URL: ${data.finalUrl}`, 'success');
            }
            
        } catch (error) {
            this.addLog(`Ошибка: ${error.message}`, 'error');
            console.error('Automation error:', error);
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Генерация аккаунта';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SiteAutomation();
});

