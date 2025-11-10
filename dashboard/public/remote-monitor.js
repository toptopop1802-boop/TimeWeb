class RemoteMonitor {
    constructor() {
        this.sessionId = null;
        this.isConnected = false;
        this.updateInterval = null;
        this.lastUpdateTime = null;
        this.frameCount = 0;
        this.fpsStartTime = Date.now();
        this.currentFPS = 0;
        
        this.init();
    }

    init() {
        // Извлечь sessionId из URL если есть
        const urlParams = new URLSearchParams(window.location.search);
        const sessionIdFromUrl = urlParams.get('session');
        if (sessionIdFromUrl) {
            document.getElementById('sessionId').value = sessionIdFromUrl;
        }

        // Обработчики событий
        document.getElementById('connectBtn').addEventListener('click', () => this.connect());
        document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());
        document.getElementById('sendTextBtn').addEventListener('click', () => this.sendText());
        
        // Обработчики кнопок управления
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const param = e.target.dataset.button || e.target.dataset.key;
                this.sendCommand(action, param);
            });
        });

        // Enter для отправки текста
        document.getElementById('textInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendText();
            }
        });
    }

    async connect() {
        const sessionIdInput = document.getElementById('sessionId').value.trim();
        if (!sessionIdInput) {
            alert('Введите ID сессии или ссылку');
            return;
        }

        // Извлечь sessionId из ссылки если это ссылка
        let sessionId = sessionIdInput;
        try {
            const url = new URL(sessionIdInput);
            const params = new URLSearchParams(url.search);
            sessionId = params.get('session') || sessionIdInput;
        } catch (e) {
            // Не ссылка, используем как есть
        }

        this.sessionId = sessionId;
        
        try {
            // Проверить подключение
            const response = await fetch(`/api/remote-monitor/status/${sessionId}`);
            if (!response.ok) {
                throw new Error('Сессия не найдена или неактивна');
            }

            const data = await response.json();
            if (!data.active) {
                throw new Error('Сессия неактивна');
            }

            this.isConnected = true;
            this.updateUI();
            this.startPolling();
            this.addLog('Подключено к сессии: ' + sessionId);
            
        } catch (error) {
            alert('Ошибка подключения: ' + error.message);
            console.error('Connection error:', error);
        }
    }

    disconnect() {
        this.isConnected = false;
        this.stopPolling();
        this.updateUI();
        this.addLog('Отключено от сессии');
        document.getElementById('screenImage').style.display = 'none';
        document.getElementById('screenPlaceholder').style.display = 'block';
    }

    updateUI() {
        const statusEl = document.getElementById('connectionStatus');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const monitorContent = document.getElementById('monitorContent');
        const sessionIdDisplay = document.getElementById('sessionIdDisplay');

        if (this.isConnected) {
            statusEl.innerHTML = '<span class="status-indicator status-connected"></span><span>Подключено</span>';
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'block';
            monitorContent.style.display = 'block';
            sessionIdDisplay.style.display = 'block';
            sessionIdDisplay.textContent = `ID сессии: ${this.sessionId}`;
        } else {
            statusEl.innerHTML = '<span class="status-indicator status-disconnected"></span><span>Не подключено</span>';
            connectBtn.style.display = 'block';
            disconnectBtn.style.display = 'none';
            monitorContent.style.display = 'none';
            sessionIdDisplay.style.display = 'none';
        }
    }

    startPolling() {
        // Обновлять каждые 500ms
        this.updateInterval = setInterval(() => {
            this.fetchScreen();
            this.fetchSystemInfo();
        }, 500);
        
        // Сразу получить данные
        this.fetchScreen();
        this.fetchSystemInfo();
    }

    stopPolling() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async fetchScreen() {
        if (!this.sessionId) return;

        try {
            const response = await fetch(`/api/remote-monitor/screen/${this.sessionId}?t=${Date.now()}`);
            if (!response.ok) {
                if (response.status === 404) {
                    this.disconnect();
                    return;
                }
                throw new Error('Ошибка получения экрана');
            }

            const blob = await response.blob();
            if (blob.size > 0) {
                const imageUrl = URL.createObjectURL(blob);
                const img = document.getElementById('screenImage');
                const placeholder = document.getElementById('screenPlaceholder');
                
                img.onload = () => {
                    URL.revokeObjectURL(imageUrl);
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                };
                
                img.src = imageUrl;
                
                // Обновить FPS
                this.frameCount++;
                const now = Date.now();
                if (now - this.fpsStartTime >= 1000) {
                    this.currentFPS = this.frameCount;
                    this.frameCount = 0;
                    this.fpsStartTime = now;
                    document.getElementById('fps').textContent = this.currentFPS;
                }
                
                this.lastUpdateTime = new Date();
                document.getElementById('lastUpdate').textContent = this.lastUpdateTime.toLocaleTimeString();
            }
        } catch (error) {
            console.error('Error fetching screen:', error);
        }
    }

    async fetchSystemInfo() {
        if (!this.sessionId) return;

        try {
            const response = await fetch(`/api/remote-monitor/info/${this.sessionId}`);
            if (!response.ok) return;

            const info = await response.json();
            
            document.getElementById('computerName').textContent = info.computerName || '-';
            document.getElementById('userName').textContent = info.userName || '-';
            document.getElementById('osInfo').textContent = info.osInfo || '-';
            document.getElementById('ipAddress').textContent = info.ipAddress || '-';
            document.getElementById('resolution').textContent = info.resolution || '-';
            
        } catch (error) {
            console.error('Error fetching system info:', error);
        }
    }

    async sendCommand(action, param) {
        if (!this.sessionId || !this.isConnected) return;

        try {
            const response = await fetch(`/api/remote-monitor/command/${this.sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, param })
            });

            if (response.ok) {
                const data = await response.json();
                this.addLog(`Команда отправлена: ${action} ${param || ''}`);
            } else {
                throw new Error('Ошибка отправки команды');
            }
        } catch (error) {
            console.error('Error sending command:', error);
            alert('Ошибка отправки команды');
        }
    }

    async sendText() {
        const textInput = document.getElementById('textInput');
        const text = textInput.value.trim();
        if (!text) return;

        try {
            const response = await fetch(`/api/remote-monitor/command/${this.sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'type', text })
            });

            if (response.ok) {
                this.addLog(`Текст отправлен: ${text}`);
                textInput.value = '';
            } else {
                throw new Error('Ошибка отправки текста');
            }
        } catch (error) {
            console.error('Error sending text:', error);
            alert('Ошибка отправки текста');
        }
    }

    addLog(message) {
        const logContainer = document.getElementById('logContainer');
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const time = new Date().toLocaleTimeString();
        logEntry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
        
        logContainer.insertBefore(logEntry, logContainer.firstChild);
        
        // Ограничить количество записей
        while (logContainer.children.length > 100) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new RemoteMonitor();
});

