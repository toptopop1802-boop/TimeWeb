// ============================================
// UTILITY FUNCTIONS (defined first for global access)
// ============================================

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Show toast notification
function showToast(message, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('success');
    if (type === 'success') el.classList.add('success');
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

// ============================================
// COPY HELPERS (defined early for onclick handlers)
// ============================================

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('✅ Скопировано!', 'success');
    } catch (err) {
        showToast('Не удалось скопировать', 'error');
    }
    document.body.removeChild(textarea);
}

function copyApiEndpoint() {
    const input = document.getElementById('api-endpoint-url');
    if (!input) return;
    
    input.select();
    input.setSelectionRange(0, 99999);
    
    const text = input.value;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('✅ API endpoint скопирован!', 'success');
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    } catch (err) {
        fallbackCopy(text);
    }
}

function copyCode(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Element not found:', elementId);
        return;
    }
    
    // Для pre элементов берем весь текст включая форматирование
    let text = '';
    if (element.tagName === 'PRE') {
        // Копируем весь текст из pre, убирая HTML теги но сохраняя структуру
        const clone = element.cloneNode(true);
        // Удаляем все span элементы для получения чистого текста
        clone.querySelectorAll('span').forEach(span => {
            const textNode = document.createTextNode(span.textContent);
            span.parentNode.replaceChild(textNode, span);
        });
        text = clone.textContent || clone.innerText;
    } else {
        text = element.textContent || element.innerText || element.value;
    }
    
    // Убираем лишние пробелы и переносы строк
    text = text.trim();
    
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('✅ Код скопирован!', 'success');
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    } catch (err) {
        console.error('Copy error:', err);
        fallbackCopy(text);
    }
}

// Экспортируем функции глобально сразу
window.copyApiEndpoint = copyApiEndpoint;
window.copyCode = copyCode;

// === AUTH CHECK ===
// Проверяем авторизацию перед загрузкой приложения
let currentUser = null;

(async function initAuth() {
    try {
        const authData = await requireAuth();
        if (!authData) {
            return; // Редирект на login произойдет в requireAuth
        }
        
        currentUser = authData;
        
        // Настраиваем UI в зависимости от роли
        setupRoleBasedUI(authData);
        
        console.log('✅ Авторизован как:', authData.user.username, '| Роль:', authData.user.role);
    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = '/login.html';
    }
})();

// API Base URL (can be overridden via window.API_URL or ?api=...)
const API_URL = (function() {
    const qp = new URLSearchParams(window.location.search).get('api');
    if (typeof window.API_URL === 'string' && window.API_URL.trim()) return window.API_URL.trim();
    if (qp && qp.trim()) return qp.trim();
    return window.location.origin;
})();

// Global State
let chart = null;
let autoRefreshInterval = null;
let currentChartData = null;
let currentChartView = 'all';
// Demo
let demoChart = null;
let demoCurrentDays = 30;
let demoCurrentType = 'all';

// Utility: Generate short code from UUID (7 characters alphanumeric)
function generateShortCode(uuid) {
    // Берем первые символы UUID и создаем 7-значный код
    const cleaned = uuid.replace(/-/g, '');
    const hash = cleaned.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    const code = Math.abs(hash).toString(36).substring(0, 7).toUpperCase();
    return code.padEnd(7, '0');
}

// Utility: Format time
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}ч ${minutes}м ${secs}с`;
    } else if (minutes > 0) {
        return `${minutes}м ${secs}с`;
    } else {
        return `${secs}с`;
    }
}

// Utility: Show loader
function showLoader() {
    document.getElementById('loader').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

// Utility: Hide loader
function hideLoader() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
}

// Utility: Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('last-update').textContent = now.toLocaleTimeString('ru-RU');
}

// Utility: HEX -> RGBA
function hexToRgba(hex, alpha = 1) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
    const bigint = parseInt(full, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================
// ANALYTICS PAGE
// ============================================

async function loadAnalytics(days = 30) {
    try {
        const response = await fetch(`${API_URL}/api/stats?days=${days}`);
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Invalid response (status ${response.status}): ${text.slice(0, 120)}`);
        }
        const data = await response.json();

        // Update stats cards
        document.getElementById('stat-wipes').textContent = data.wipe_created || 0;
        document.getElementById('stat-tickets').textContent = data.ticket_created || 0;
        document.getElementById('stat-roles').textContent = data.tournament_role_created || 0;
        document.getElementById('stat-deleted').textContent = data.channel_deleted || 0;

        // Normalize timeline: fill missing days with zeros so the line is continuous
        let timelineNormalized = [];
        if (days === 1) {
            // Build minute buckets from start of today to now, set last point to today's totals
            const now = new Date();
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const minutes = Math.max(1, Math.floor((now - startOfDay) / 60000));
            for (let i = 0; i <= minutes; i++) {
                const dt = new Date(startOfDay.getTime() + i * 60000);
                timelineNormalized.push({
                    date: dt.toISOString(),
                    wipe_created: 0,
                    ticket_created: 0,
                    tournament_role_created: 0,
                    channel_deleted: 0
                });
            }
            // place today's totals at the last minute
            const last = timelineNormalized[timelineNormalized.length - 1];
            last.wipe_created = data.wipe_created || 0;
            last.ticket_created = data.ticket_created || 0;
            last.tournament_role_created = data.tournament_role_created || 0;
            last.channel_deleted = data.channel_deleted || 0;
        } else {
            const today = new Date();
            const start = new Date();
            start.setDate(today.getDate() - (days - 1));
            const byDate = new Map((data.timeline || []).map(t => [new Date(t.date).toISOString().split('T')[0], t]));

            for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                const t = byDate.get(key) || {
                    date: key,
                    wipe_created: 0,
                    ticket_created: 0,
                    tournament_role_created: 0,
                    channel_deleted: 0
                };
                timelineNormalized.push(t);
            }
        }

        // Store chart data and update
        currentChartData = timelineNormalized;
        updateChart(currentChartData, currentChartView);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Error loading analytics:', error);
        // Fallback: render empty timeline for requested range so UI stays usable
        const timelineNormalized = [];
        if (days === 1) {
            const now = new Date();
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const minutes = Math.max(1, Math.floor((now - startOfDay) / 60000));
            for (let i = 0; i <= minutes; i++) {
                const dt = new Date(startOfDay.getTime() + i * 60000);
                timelineNormalized.push({
                    date: dt.toISOString(),
                    wipe_created: 0,
                    ticket_created: 0,
                    tournament_role_created: 0,
                    channel_deleted: 0
                });
            }
        } else {
            const today = new Date();
            const start = new Date();
            start.setDate(today.getDate() - (days - 1));
            for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                timelineNormalized.push({
                    date: key,
                    wipe_created: 0,
                    ticket_created: 0,
                    tournament_role_created: 0,
                    channel_deleted: 0
                });
            }
        }
        currentChartData = timelineNormalized;
        updateChart(currentChartData, currentChartView);
        updateLastUpdateTime();
    }
}

function updateChart(timeline, view = 'all') {
    const ctx = document.getElementById('activity-chart').getContext('2d');

    const firstDate = timeline.length ? new Date(timeline[0].date) : null;
    const lastDate = timeline.length ? new Date(timeline[timeline.length - 1].date) : null;
    const isSameDay = firstDate && lastDate && firstDate.toDateString() === lastDate.toDateString();

    const labels = timeline.map(t => {
        const date = new Date(t.date);
        return isSameDay
            ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    });

    let datasets = [];

    function getAccentRgba(alpha = 1) {
        const styles = getComputedStyle(document.documentElement);
        const hex = styles.getPropertyValue('--accent-primary').trim() || '#3b9bf9';
        return hexToRgba(hex, alpha);
    }

    function hexToRgba(hex, alpha = 1) {
        const h = hex.replace('#', '');
        const bigint = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function buildGradient(ctx, color) {
        const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height || 220);
        gradient.addColorStop(0, color.replace('1)', '0.45)'));
        gradient.addColorStop(0.5, color.replace('1)', '0.2)'));
        gradient.addColorStop(1, color.replace('1)', '0)'));
        return gradient;
    }

    function buildSecondaryGradient(ctx, color) {
        const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height || 220);
        gradient.addColorStop(0, color.replace('1)', '0.35)'));
        gradient.addColorStop(0.5, color.replace('1)', '0.15)'));
        gradient.addColorStop(1, color.replace('1)', '0)'));
        return gradient;
    }

    if (view === 'all') {
        const total = timeline.map(t =>
            (t.wipe_created || 0) + (t.ticket_created || 0) + (t.tournament_role_created || 0) + (t.channel_deleted || 0)
        );
        datasets = [{
            label: 'Все события',
            data: total,
            borderColor: getAccentRgba(1),
            backgroundColor: buildGradient(ctx, getAccentRgba(1)),
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getAccentRgba(1),
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: getAccentRgba(1),
            spanGaps: true,
            shadowOffsetX: 0,
            shadowOffsetY: 4,
            shadowBlur: 12,
            shadowColor: getAccentRgba(0.3)
        }];
    } else if (view === 'wipes') {
        datasets = [{
            label: 'Вайпы',
            data: timeline.map(t => t.wipe_created || 0),
            borderColor: getAccentRgba(1),
            backgroundColor: buildGradient(ctx, getAccentRgba(1)),
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getAccentRgba(1),
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: getAccentRgba(1),
            spanGaps: true
        }];
    } else if (view === 'tickets') {
        datasets = [{
            label: 'Тикеты',
            data: timeline.map(t => t.ticket_created || 0),
            borderColor: getAccentRgba(1),
            backgroundColor: buildGradient(ctx, getAccentRgba(1)),
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getAccentRgba(1),
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: getAccentRgba(1),
            spanGaps: true
        }];
    } else if (view === 'roles') {
        datasets = [{
            label: 'Роли',
            data: timeline.map(t => t.tournament_role_created || 0),
            borderColor: getAccentRgba(1),
            backgroundColor: buildGradient(ctx, getAccentRgba(1)),
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getAccentRgba(1),
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: getAccentRgba(1),
            spanGaps: true
        }];
    } else if (view === 'deleted') {
        datasets = [{
            label: 'Удалено каналов',
            data: timeline.map(t => t.channel_deleted || 0),
            borderColor: getAccentRgba(1),
            backgroundColor: buildGradient(ctx, getAccentRgba(1)),
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getAccentRgba(1),
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: getAccentRgba(1),
            spanGaps: true
        }];
    } else if (view === 'members') {
        datasets = [{
            label: 'Участники',
            data: timeline.map(t => t.member_count || 0),
            borderColor: getAccentRgba(1),
            backgroundColor: buildGradient(ctx, getAccentRgba(1)),
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getAccentRgba(1),
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: getAccentRgba(1),
            spanGaps: true
        }];
    }

    const maxValue = Math.max(1, ...datasets.flatMap(ds => ds.data));
    const stepSize = maxValue <= 10 ? 1 : undefined;

    if (chart) {
        chart.data.labels = labels;
        chart.data.datasets = datasets;
        chart.options.scales.y.ticks.stepSize = stepSize;
        chart.update('active');
    } else {
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.2,
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                },
                plugins: {
                    legend: {
                        display: view !== 'all',
                        position: 'top',
                        labels: {
                            color: '#a0a0a0',
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15,
                            font: { 
                                size: 13,
                                weight: '500'
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(37, 37, 37, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#a0a0a0',
                        borderColor: getAccentRgba(0.5),
                        borderWidth: 2,
                        padding: 12,
                        titleFont: {
                            size: 14,
                            weight: '600'
                        },
                        bodyFont: {
                            size: 13
                        },
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            display: true,
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8a8a8a',
                            font: {
                                size: 11
                            },
                            padding: 10
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8a8a8a',
                            precision: 0,
                            stepSize,
                            font: {
                                size: 11
                            },
                            padding: 10
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                elements: {
                    line: {
                        borderCapStyle: 'round',
                        borderJoinStyle: 'round'
                    }
                }
            }
        });
    }
}

// ============================================
// CHART TABS
// ============================================

function setupChartTabs() {
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update chart
            currentChartView = tab.dataset.chart;
            if (currentChartData) {
                updateChart(currentChartData, currentChartView);
            }
        });
    });
}

// ============================================
// MESSAGES PAGE
// ============================================

async function loadGuilds() {
    try {
        const response = await fetch(`${API_URL}/api/guilds`);
        const guilds = await response.json();

        const select = document.getElementById('guild-select');
        select.innerHTML = '<option value="">Выберите сервер...</option>';
        
        guilds.forEach(guild => {
            const option = document.createElement('option');
            option.value = guild.id;
            option.textContent = `${guild.name} (${guild.memberCount} участников)`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading guilds:', error);
    }
}

async function loadChannels(guildId) {
    try {
        const response = await fetch(`${API_URL}/api/guilds/${guildId}/channels`);
        const channels = await response.json();

        const select = document.getElementById('channel-select');
        select.innerHTML = '<option value="">Выберите канал...</option>';
        select.disabled = false;
        
        channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `# ${channel.name}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading channels:', error);
    }
}

async function sendMessage(channelId, content) {
    try {
        const response = await fetch(`${API_URL}/api/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ channelId, content })
        });

        const data = await response.json();

        const status = document.getElementById('message-status');
        if (data.success) {
            status.className = 'message-status success';
            status.textContent = '✅ Сообщение успешно отправлено!';
            document.getElementById('message-content').value = '';
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        const status = document.getElementById('message-status');
        status.className = 'message-status error';
        status.textContent = `❌ Ошибка: ${error.message}`;
    }

    setTimeout(() => {
        document.getElementById('message-status').style.display = 'none';
    }, 5000);
}

async function readMessages(channelId) {
    try {
        const response = await fetch(`${API_URL}/api/channels/${channelId}/messages`);
        const messages = await response.json();

        const container = document.getElementById('messages-container');
        const messagesList = document.getElementById('messages-list');

        if (messages.length === 0) {
            messagesList.innerHTML = '<p style="color: #a0a0a0; text-align: center; padding: 20px;">Нет сообщений в этом канале</p>';
        } else {
            messagesList.innerHTML = messages.map(msg => {
                const date = new Date(msg.timestamp);
                const timeStr = date.toLocaleString('ru-RU');
                
                return `
                    <div class="message-item">
                        <div class="message-header">
                            <span class="message-author">${msg.author}</span>
                            <span class="message-time">${timeStr}</span>
                        </div>
                        <div class="message-content">${escapeHtml(msg.content)}</div>
                    </div>
                `;
            }).join('');
        }

        container.style.display = 'block';
    } catch (error) {
        console.error('Error reading messages:', error);
        alert(`Ошибка чтения сообщений: ${error.message}`);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// AUTO-DELETE CHANNELS PAGE
// ============================================

async function loadAutoDeleteChannels() {
    try {
        const response = await fetch(`${API_URL}/api/auto-delete-channels`);
        const channels = await response.json();

        const container = document.getElementById('channels-list');

        if (channels.length === 0) {
            container.innerHTML = '<p style="color: #a0a0a0; text-align: center; padding: 40px;">Нет каналов на автоудаление</p>';
            return;
        }

        container.innerHTML = channels.map(ch => {
            const timerClass = ch.time_left_seconds < 300 ? 'danger' : 
                              ch.time_left_seconds < 1800 ? 'warning' : '';
            
            return `
                <div class="channel-card">
                    <div class="channel-info">
                        <h4>Канал ID: ${ch.channel_id}</h4>
                        <p>Тип: ${ch.channel_type}</p>
                    </div>
                    <div class="channel-timer ${timerClass}">
                        ${formatTime(ch.time_left_seconds)}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading auto-delete channels:', error);
    }
}

// ============================================
// DEMO MODAL
// ============================================

function setupDemoModal() {
    const modal = document.getElementById('demo-modal');
    const demoBtn = document.getElementById('demo-btn');
    const closeBtn = document.getElementById('demo-modal-close');

    demoBtn.addEventListener('click', () => {
        modal.classList.add('active');
        // Render default demo view on open
        demoCurrentDays = 30;
        demoCurrentType = 'all';
        renderDemoChart(demoCurrentDays, demoCurrentType);
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        if (demoChart) {
            demoChart.destroy();
            demoChart = null;
        }
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            if (demoChart) {
                demoChart.destroy();
                demoChart = null;
            }
        }
    });

    // Range tabs
    const rangeTabs = document.getElementById('demo-range-tabs');
    if (rangeTabs) {
        rangeTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.demo-range');
            if (!btn) return;
            rangeTabs.querySelectorAll('.demo-range').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            demoCurrentDays = parseInt(btn.dataset.days);
            renderDemoChart(demoCurrentDays, demoCurrentType);
        });
    }

    // Type tabs
    const typeTabs = document.getElementById('demo-type-tabs');
    if (typeTabs) {
        typeTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.demo-type');
            if (!btn) return;
            typeTabs.querySelectorAll('.demo-type').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            demoCurrentType = btn.dataset.type;
            renderDemoChart(demoCurrentDays, demoCurrentType);
        });
    }
}

// ============================================
// DEMO DATA / CHART
// ============================================

function seededRandom(seed) {
    let t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function generateDemoData(days) {
    const now = new Date();
    const points = days === 1 ? 24 : days; // hourly for 1D, daily otherwise
    const labels = [];
    const series = {
        wipes: [],
        tickets: [],
        roles: [],
        deleted: []
    };

    for (let i = points - 1; i >= 0; i--) {
        const date = new Date(now);
        if (days === 1) {
            date.setHours(now.getHours() - i);
            labels.push(date.toLocaleTimeString('ru-RU', { hour: '2-digit' }));
        } else {
            date.setDate(now.getDate() - i);
            labels.push(date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }));
        }

        // nice wave-like shape with noise, different amplitudes
        const base = Math.sin((points - i) / points * Math.PI) * 10;
        const rnd1 = Math.floor(seededRandom(i * 17 + points) * 4);
        const rnd2 = Math.floor(seededRandom(i * 31 + points) * 3);

        series.wipes.push(Math.max(0, Math.round(base + 2 + rnd1)));
        series.tickets.push(Math.max(0, Math.round(base * 0.8 + 1 + rnd2)));
        series.roles.push(Math.max(0, Math.round(base * 0.6 + rnd1 % 2)));
        series.deleted.push(Math.max(0, Math.round(base * 0.5 + rnd2 % 2)));
    }

    return { labels, series };
}

function buildGradient(ctx, color) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, color.replace('1)', '0.35)'));
    gradient.addColorStop(1, color.replace('1)', '0)'));
    return gradient;
}

function renderDemoChart(days, type) {
    const canvas = document.getElementById('demo-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { labels, series } = generateDemoData(days);

    function getAccentRgba(alpha = 1) {
        const styles = getComputedStyle(document.documentElement);
        const hex = styles.getPropertyValue('--accent-primary').trim() || '#3b9bf9';
        return hexToRgba(hex, alpha);
    }

    let datasets = [];
    if (type === 'all') {
        const total = series.wipes.map((_, idx) => series.wipes[idx] + series.tickets[idx] + series.roles[idx] + series.deleted[idx]);
        datasets = [{
            label: 'Все события',
            data: total,
            borderColor: getAccentRgba(1),
            backgroundColor: buildGradient(ctx, getAccentRgba(1)),
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getAccentRgba(1),
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: getAccentRgba(1),
            spanGaps: true
        }];
    } else {
        const map = { wipes: 'Вайпы', tickets: 'Тикеты', roles: 'Роли', deleted: 'Удаленные каналы' };
        datasets = [{
            label: map[type],
            data: series[type],
            borderColor: getAccentRgba(1),
            backgroundColor: buildGradient(ctx, getAccentRgba(1)),
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getAccentRgba(1),
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: getAccentRgba(1),
            spanGaps: true
        }];
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { 
            duration: 1000, 
            easing: 'easeInOutQuart' 
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(37, 37, 37, 0.95)',
                titleColor: '#ffffff',
                bodyColor: '#a0a0a0',
                borderColor: getAccentRgba(0.5),
                borderWidth: 2,
                padding: 12,
                titleFont: {
                    size: 14,
                    weight: '600'
                },
                bodyFont: {
                    size: 13
                },
                cornerRadius: 8,
                displayColors: true
            }
        },
        scales: {
            x: {
                grid: { 
                    display: true,
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                ticks: { 
                    color: '#8a8a8a', 
                    maxTicksLimit: days === 1 ? 8 : 10,
                    font: {
                        size: 11
                    },
                    padding: 10
                }
            },
            y: {
                beginAtZero: true,
                grid: { 
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                ticks: { 
                    color: '#8a8a8a', 
                    precision: 0,
                    font: {
                        size: 11
                    },
                    padding: 10
                }
            }
        },
        elements: {
            line: {
                borderCapStyle: 'round',
                borderJoinStyle: 'round'
            }
        }
    };

    if (demoChart) {
        demoChart.data.labels = labels;
        demoChart.data.datasets = datasets;
        demoChart.update('active');
    } else {
        demoChart = new Chart(ctx, { type: 'line', data: { labels, datasets }, options });
    }
}

// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
    // Handle navigation clicks
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const page = link.dataset.page;
            navigateToPage(page);
        });
    });

    // Handle hash changes (browser back/forward buttons)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1); // Remove #
        
        // Check if it's a changelog detail page
        const changelogDetailMatch = hash.match(/^changelog\/(.+)$/);
        if (changelogDetailMatch) {
            const id = changelogDetailMatch[1];
            navigateToPage('changelog');
            // Wait for changelog to load, then open detail
            setTimeout(() => {
                openChangelogDetailPageById(id);
            }, 100);
            return;
        }
        
        if (hash) {
            navigateToPage(hash);
        }
    });

    // Handle initial page load
    const initialHash = window.location.hash.substring(1);
    
    // Check if it's a changelog detail page
    const changelogDetailMatch = initialHash.match(/^changelog\/(.+)$/);
    if (changelogDetailMatch) {
        const id = changelogDetailMatch[1];
        navigateToPage('changelog');
        // Wait for changelog to load, then open detail
        setTimeout(() => {
            openChangelogDetailPageById(id);
        }, 500);
    } else if (initialHash) {
        navigateToPage(initialHash);
    } else {
        // Default to analytics if no hash
        navigateToPage('analytics');
    }
}

function navigateToPage(page) {
    // Update active link
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
        if (l.dataset.page === page || l.getAttribute('href') === `#${page}`) {
            l.classList.add('active');
        }
    });

    // Update URL hash
    if (window.location.hash !== `#${page}`) {
        window.location.hash = page;
    }

    // Show corresponding page
    document.querySelectorAll('.page').forEach(p => {
        p.style.display = 'none';
    });
    
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    // Hide changelog detail page if switching away from changelog
    const changelogDetailPage = document.getElementById('page-changelog-detail');
    if (changelogDetailPage && page !== 'changelog') {
        changelogDetailPage.style.display = 'none';
    }
    
    // Clear changelog detail hash if not on changelog page
    if (page !== 'changelog') {
        const changelogHashMatch = window.location.hash.match(/^#changelog\/(\d+)$/);
        if (changelogHashMatch) {
            window.location.hash = 'changelog';
        }
    }

    // Load page data
    if (page === 'analytics') {
        const days = parseInt(document.getElementById('period-select').value);
        loadAnalytics(days);
    } else if (page === 'messages') {
        loadGuilds();
    } else if (page === 'channels') {
        loadAutoDeleteChannels();
    } else if (page === 'pipette') {
        // Инициализируем color wheel
        initColorWheel();
        // nothing to load, but ensure canvas resizes
        resizePipetteCanvas();
        // layout pass first
        setTimeout(resizePipetteCanvas, 0);
    } else if (page === 'maps') {
        loadMaps();
    } else if (page === 'changelog') {
        loadChangelog();
    } else if (page === 'images') {
        // Загружаем историю изображений
        if (typeof renderImagesHistory === 'function') {
            renderImagesHistory();
        }
    } else if (page === 'admin') {
        loadAdminChangelog();
    } else if (page === 'gradient-role') {
        // Инициализация страницы заявки на градиентную роль
        initGradientRolePage();
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Show loader
    showLoader();

    // Setup navigation
    setupNavigation();
    
    // Setup chart tabs
    setupChartTabs();
    
    // Setup demo modal
    setupDemoModal();

    // Setup pipette
    setupPipette();

    // Setup maps page
    setupMapsPage();

    // Setup delete confirm modal
    setupDeleteConfirmModal();

    // Setup changelog navigation
    setupChangelogNavigation();

    // Setup admin page
    setupAdminPage();

    // Sidebar всегда свернут - отключено расширение
    // setupSidebarHover();
    
    // Initialize API endpoint URL
    const apiEndpointInput = document.getElementById('api-endpoint-url');
    if (apiEndpointInput) {
        apiEndpointInput.value = `${window.location.origin}/api/images/upload`;
    }
    
    // Load saved theme
    loadTheme();
    
    // Setup theme toggle button
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Period selector
    document.getElementById('period-select').addEventListener('change', (e) => {
        loadAnalytics(parseInt(e.target.value));
    });

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => {
        const days = parseInt(document.getElementById('period-select').value);
        loadAnalytics(days);
    });

    // Guild selector
    document.getElementById('guild-select').addEventListener('change', (e) => {
        if (e.target.value) {
            loadChannels(e.target.value);
        } else {
            document.getElementById('channel-select').disabled = true;
            document.getElementById('channel-select').innerHTML = '<option value="">Сначала выберите сервер...</option>';
        }
    });

    // Channel selector
    document.getElementById('channel-select').addEventListener('change', (e) => {
        const hasChannel = !!e.target.value;
        document.getElementById('send-message-btn').disabled = !hasChannel;
        document.getElementById('read-messages-btn').disabled = !hasChannel;
        
        // Hide messages container when changing channels
        if (!hasChannel) {
            document.getElementById('messages-container').style.display = 'none';
        }
    });

    // Send message button
    document.getElementById('send-message-btn').addEventListener('click', () => {
        const channelId = document.getElementById('channel-select').value;
        const content = document.getElementById('message-content').value.trim();

        if (!channelId || !content) {
            alert('Выберите канал и введите сообщение!');
            return;
        }

        sendMessage(channelId, content);
    });

    // Read messages button
    document.getElementById('read-messages-btn').addEventListener('click', () => {
        const channelId = document.getElementById('channel-select').value;

        if (!channelId) {
            alert('Выберите канал!');
            return;
        }

        readMessages(channelId);
    });

    // Load initial data
    await loadAnalytics(30);

    // Hide loader after 1 second
    setTimeout(hideLoader, 1000);

    // Auto-refresh every minute
    autoRefreshInterval = setInterval(() => {
        const activePage = document.querySelector('.page.active');
        if (activePage.id === 'page-analytics') {
            const days = parseInt(document.getElementById('period-select').value);
            loadAnalytics(days);
        } else if (activePage.id === 'page-channels') {
            loadAutoDeleteChannels();
        }
    }, 60000); // 60 seconds
});

function setupSidebarHover() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    let collapseTimer = null;
    const expand = () => {
        sidebar.classList.add('expanded');
        if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
    };
    const scheduleCollapse = () => {
        if (collapseTimer) clearTimeout(collapseTimer);
        collapseTimer = setTimeout(() => sidebar.classList.remove('expanded'), 220);
    };
    sidebar.addEventListener('mouseenter', expand);
    sidebar.addEventListener('mouseleave', scheduleCollapse);
    // start collapsed
    sidebar.classList.remove('expanded');
}
// ============================================
// PIPETTE (EYEDROPPER) TOOL
// ============================================

let pipetteImage = null;

function setupPipette() {
    const fileInput = document.getElementById('pipette-file');
    const dropZone = document.getElementById('pipette-drop');
    const canvasWrap = document.getElementById('pipette-canvas-wrap');
    const canvas = document.getElementById('pipette-canvas');
    const magnifier = document.getElementById('pipette-magnifier');
    if (!fileInput || !dropZone || !canvas) return;

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) loadPipetteImage(file);
    });

    ;['dragenter','dragover'].forEach(evt => dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary');
    }));

    ;['dragleave','drop'].forEach(evt => dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
    }));

    dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) loadPipetteImage(file);
    });

    // Paste image from clipboard (Ctrl+V)
    window.addEventListener('paste', (e) => {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.type && it.type.indexOf('image') !== -1) {
                const blob = it.getAsFile();
                if (blob) loadPipetteImage(blob);
                e.preventDefault();
                break;
            }
        }
    });

    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.copy;
            const input = document.getElementById(id);
            if (input) {
                const text = input.value;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => showToast('Скопировано')).catch(() => {
                        // Fallback для старых браузеров
                        fallbackCopy(text);
                    });
                } else {
                    fallbackCopy(text);
                }
            }
        });
    });

    let pipetteFrozen = false;
    canvas.addEventListener('mousemove', (e) => {
        if (pipetteFrozen) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let x = Math.floor((e.clientX - rect.left) * scaleX);
        let y = Math.floor((e.clientY - rect.top) * scaleY);
        x = Math.max(0, Math.min(canvas.width - 1, x));
        y = Math.max(0, Math.min(canvas.height - 1, y));
        const ctx = canvas.getContext('2d');
        try {
            const data = ctx.getImageData(x, y, 1, 1).data;
            updatePipetteOutputs(data[0], data[1], data[2]);
            drawMagnifier(canvas, magnifier, x, y);
        } catch {}
    });

    canvas.addEventListener('click', () => {
        pipetteFrozen = !pipetteFrozen;
        showToast(pipetteFrozen ? 'Захвачено' : 'Разморозка');
    });

    window.addEventListener('resize', resizePipetteCanvas);

    // Hotkeys: Space toggle freeze, C copy HEX (only on pipette page)
    window.addEventListener('keydown', (e) => {
        // Check if pipette page is active
        const pipettePage = document.getElementById('page-pipette');
        if (!pipettePage || pipettePage.style.display === 'none') {
            return; // Don't handle keys if not on pipette page
        }

        // Check if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return; // Don't intercept if typing in input
        }

        if (e.code === 'Space') {
            e.preventDefault();
            pipetteFrozen = !pipetteFrozen;
            showToast(pipetteFrozen ? 'Захвачено' : 'Разморозка', 'success');
        } else if (e.key && (e.key === 'c' || e.key === 'C')) {
            const hex = document.getElementById('pipette-hex');
            if (hex) {
                navigator.clipboard.writeText(hex.value).then(() => showToast('HEX скопирован', 'success'));
            }
        }
    });

    function loadPipetteImage(file) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            pipetteImage = img;
            drawPipetteImage();
            canvasWrap.style.display = 'block';
            if (dropZone) dropZone.style.display = 'none';
            
            // Скрываем color wheel когда загружается фото
            const colorWheelContainer = document.getElementById('color-wheel-container');
            if (colorWheelContainer) {
                colorWheelContainer.style.display = 'none';
                console.log('🎨 Color wheel hidden (photo loaded)');
            }
            
            showToast('Изображение загружено', 'success');
            URL.revokeObjectURL(url);
        };
        img.onerror = () => showToast('Не удалось загрузить изображение');
        img.src = url;
    }
}

function drawPipetteImage() {
    const canvas = document.getElementById('pipette-canvas');
    if (!canvas || !pipetteImage) return;
    const ctx = canvas.getContext('2d');
    const wrap = document.getElementById('pipette-canvas-wrap');
    const availableW = wrap.clientWidth || pipetteImage.width;
    const maxH = Math.floor(window.innerHeight * 0.7);
    const byW = availableW / pipetteImage.width;
    const byH = maxH / pipetteImage.height;
    const ratio = Math.min(1, byW, byH);
    const cssW = Math.max(1, Math.floor(pipetteImage.width * ratio));
    const cssH = Math.max(1, Math.floor(pipetteImage.height * ratio));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(pipetteImage, 0, 0, cssW, cssH);
}

function drawMagnifier(srcCanvas, magCanvas, cx, cy) {
    if (!magCanvas) return;
    const magSize = 120; // css size (match CSS)
    magCanvas.width = magSize;
    magCanvas.height = magSize;
    const ctx = magCanvas.getContext('2d');
    const scale = 10; // 10x zoom
    const sw = Math.floor(magCanvas.width / scale);
    const sh = Math.floor(magCanvas.height / scale);
    const sx = Math.max(0, Math.min(srcCanvas.width - sw, cx - Math.floor(sw / 2)));
    const sy = Math.max(0, Math.min(srcCanvas.height - sh, cy - Math.floor(sh / 2)));
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, magCanvas.width, magCanvas.height);
    ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, magCanvas.width, magCanvas.height);
    // crosshair for exact pixel in center
    const center = Math.floor(magCanvas.width / 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center, 0); ctx.lineTo(center, magCanvas.height); // vertical
    ctx.moveTo(0, center); ctx.lineTo(magCanvas.width, center); // horizontal
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center + 1, 0); ctx.lineTo(center + 1, magCanvas.height);
    ctx.moveTo(0, center + 1); ctx.lineTo(magCanvas.width, center + 1);
    ctx.stroke();
    // position near cursor
    const rect = srcCanvas.getBoundingClientRect();
    const scaleX = rect.width / srcCanvas.width;
    const scaleY = rect.height / srcCanvas.height;
    const cssX = cx * scaleX;
    const cssY = cy * scaleY;
    let left = Math.round(cssX + 16);
    let top = Math.round(cssY + 16);
    if (left + magSize > rect.width) left = Math.round(cssX - magSize - 16);
    if (top + magSize > rect.height) top = Math.round(cssY - magSize - 16);
    if (left < 0) left = 0; if (top < 0) top = 0;
    magCanvas.style.left = `${left}px`;
    magCanvas.style.top = `${top}px`;
}

function resizePipetteCanvas() {
    if (pipetteImage) drawPipetteImage();
}

function updatePipetteOutputs(r, g, b) {
    const hex = rgbToHex(r, g, b);
    const cmyk = rgbToCmyk(r, g, b);
    const hsv = rgbToHsv(r, g, b);
    const hsl = rgbToHsl(r, g, b);

    setInput('pipette-hex', hex);
    setInput('pipette-rgb', `${r}, ${g}, ${b}`);
    setInput('pipette-cmyk', `${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%`);
    setInput('pipette-hsv', `${hsv.h}°, ${hsv.s}%, ${hsv.v}%`);
    setInput('pipette-hsl', `${hsl.h}°, ${hsl.s}%, ${hsl.l}%`);
    const colorBox = document.getElementById('pipette-result-color');
    if (colorBox) colorBox.style.background = hex;
}

function setInput(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function rgbToHex(r, g, b) {
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToCmyk(r, g, b) {
    const rr = r / 255, gg = g / 255, bb = b / 255;
    const k = 1 - Math.max(rr, gg, bb);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    const c = Math.round(((1 - rr - k) / (1 - k)) * 100);
    const m = Math.round(((1 - gg - k) / (1 - k)) * 100);
    const y = Math.round(((1 - bb - k) / (1 - k)) * 100);
    const kk = Math.round(k * 100);
    return { c, m, y, k: kk };
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) h = 0; else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// ============================================
// COLOR WHEEL PICKER
// ============================================

let colorWheelCanvas = null;
let colorWheelCtx = null;
let colorWheelDragging = false;

function initColorWheel() {
    colorWheelCanvas = document.getElementById('color-wheel-canvas');
    if (!colorWheelCanvas) return;
    
    colorWheelCtx = colorWheelCanvas.getContext('2d', { willReadFrequently: true });
    drawColorWheel();
    
    // Обработчики для drag режима
    colorWheelCanvas.addEventListener('mousedown', handleColorWheelMouseDown);
    colorWheelCanvas.addEventListener('mousemove', handleColorWheelMouseMove);
    colorWheelCanvas.addEventListener('mouseup', handleColorWheelMouseUp);
    colorWheelCanvas.addEventListener('mouseleave', handleColorWheelMouseUp);
    
    // Touch support для мобильных
    colorWheelCanvas.addEventListener('touchstart', handleColorWheelTouchStart);
    colorWheelCanvas.addEventListener('touchmove', handleColorWheelTouchMove);
    colorWheelCanvas.addEventListener('touchend', handleColorWheelMouseUp);
    
    console.log('🎨 Color wheel initialized with drag support');
}

function drawColorWheel() {
    if (!colorWheelCtx || !colorWheelCanvas) return;
    
    const size = colorWheelCanvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;
    
    console.log('🎨 Drawing color wheel, size:', size);
    
    // Очищаем canvas белым фоном
    colorWheelCtx.fillStyle = '#ffffff';
    colorWheelCtx.fillRect(0, 0, size, size);
    
    // Рисуем цветовой круг pixel by pixel
    const imageData = colorWheelCtx.createImageData(size, size);
    const data = imageData.data;
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= radius) {
                // Вычисляем угол (hue) и насыщенность
                const angle = Math.atan2(dy, dx);
                const hue = (angle * 180 / Math.PI + 90 + 360) % 360;
                const saturation = distance / radius;
                
                // Конвертируем HSV в RGB
                const value = 1.0; // Яркость максимальная
                const c = value * saturation;
                const x1 = c * (1 - Math.abs((hue / 60) % 2 - 1));
                const m = value - c;
                
                let r, g, b;
                if (hue < 60) {
                    r = c; g = x1; b = 0;
                } else if (hue < 120) {
                    r = x1; g = c; b = 0;
                } else if (hue < 180) {
                    r = 0; g = c; b = x1;
                } else if (hue < 240) {
                    r = 0; g = x1; b = c;
                } else if (hue < 300) {
                    r = x1; g = 0; b = c;
                } else {
                    r = c; g = 0; b = x1;
                }
                
                const index = (y * size + x) * 4;
                data[index] = Math.round((r + m) * 255);
                data[index + 1] = Math.round((g + m) * 255);
                data[index + 2] = Math.round((b + m) * 255);
                data[index + 3] = 255; // Alpha
            } else {
                // За пределами круга - прозрачно
                const index = (y * size + x) * 4;
                data[index] = 255;
                data[index + 1] = 255;
                data[index + 2] = 255;
                data[index + 3] = 0;
            }
        }
    }
    
    colorWheelCtx.putImageData(imageData, 0, 0);
    
    // Рисуем внешнюю границу
    colorWheelCtx.beginPath();
    colorWheelCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    colorWheelCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    colorWheelCtx.lineWidth = 3;
    colorWheelCtx.stroke();
    
    console.log('✅ Color wheel drawn successfully');
}

function handleColorWheelMouseDown(e) {
    e.preventDefault();
    colorWheelDragging = true;
    updateColorFromPosition(e.clientX, e.clientY);
}

function handleColorWheelMouseMove(e) {
    const rect = colorWheelCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const size = colorWheelCanvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;
    
    // Проверяем, что курсор внутри круга
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= radius) {
        colorWheelCanvas.style.cursor = 'crosshair';
        
        // Если зажата кнопка мыши - обновляем цвет
        if (colorWheelDragging) {
            updateColorFromPosition(e.clientX, e.clientY, true);
        }
    } else {
        colorWheelCanvas.style.cursor = 'default';
    }
}

function handleColorWheelMouseUp(e) {
    if (colorWheelDragging) {
        colorWheelDragging = false;
        console.log('🎨 Drag ended');
    }
}

function handleColorWheelTouchStart(e) {
    e.preventDefault();
    colorWheelDragging = true;
    const touch = e.touches[0];
    updateColorFromPosition(touch.clientX, touch.clientY);
}

function handleColorWheelTouchMove(e) {
    e.preventDefault();
    if (colorWheelDragging && e.touches.length > 0) {
        const touch = e.touches[0];
        updateColorFromPosition(touch.clientX, touch.clientY, true);
    }
}

function updateColorFromPosition(clientX, clientY, isDragging = false) {
    const rect = colorWheelCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const size = colorWheelCanvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;
    
    // Проверяем, что точка внутри круга
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= radius) {
        // Получаем цвет из точки
        const imageData = colorWheelCtx.getImageData(Math.round(x), Math.round(y), 1, 1);
        const r = imageData.data[0];
        const g = imageData.data[1];
        const b = imageData.data[2];
        
        const hex = rgbToHex(r, g, b);
        
        // Обновляем превью и поле ввода
        const preview = document.getElementById('color-wheel-preview');
        const hexInput = document.getElementById('color-wheel-hex');
        
        if (preview) preview.style.background = hex;
        if (hexInput) hexInput.value = hex;
        
        if (!isDragging) {
            console.log('🎨 Selected color:', hex);
        }
    }
}

function copyColorFromWheel() {
    const hexInput = document.getElementById('color-wheel-hex');
    if (!hexInput) return;
    
    const hex = hexInput.value;
    
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(hex).then(() => {
                showToast('✅ HEX код скопирован: ' + hex, 'success');
                console.log('📋 Copied color:', hex);
            }).catch(() => {
                fallbackCopy(hex);
            });
        } else {
            fallbackCopy(hex);
        }
    } catch (err) {
        fallbackCopy(hex);
    }
}

// Экспортируем функцию для использования в HTML
window.copyColorFromWheel = copyColorFromWheel;

// ============================================
// MAPS HOSTING PAGE
// ============================================

function setupMapsPage() {
    const fileInput = document.getElementById('maps-file');
    const dropZone = document.getElementById('maps-drop');
    
    if (!fileInput || !dropZone) return;

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.map')) {
                showToast('Пожалуйста, выберите файл с расширением .map');
                return;
            }
            uploadMap(file);
        }
    });

    // Click on drop zone
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop
    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.map')) {
                showToast('Пожалуйста, перетащите файл с расширением .map');
                return;
            }
            uploadMap(file);
        }
    });
}

async function uploadMap(file) {
    console.log('📤 Начало загрузки карты:', file.name, 'Размер:', file.size, 'байт');
    
    const formData = new FormData();
    formData.append('map', file);
    
    console.log('📦 FormData создан, отправляем на:', `${API_URL}/api/maps/upload`);

    const progressDiv = document.getElementById('maps-upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const dropZone = document.getElementById('maps-drop');

    progressDiv.style.display = 'block';
    dropZone.style.opacity = '0.5';
    dropZone.style.pointerEvents = 'none';

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = percent + '%';
                progressText.textContent = `Загрузка: ${percent}%`;
                console.log('📊 Прогресс загрузки:', percent + '%');
            }
        });

        xhr.addEventListener('load', () => {
            console.log('📡 Ответ сервера получен. Статус:', xhr.status);
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                console.log('✅ Карта загружена успешно!', response);
                
                // Сохраняем в локальную историю
                saveMapToLocalHistory(response.map);
                
                showToast('Карта успешно загружена!', 'success');
                progressDiv.style.display = 'none';
                dropZone.style.opacity = '1';
                dropZone.style.pointerEvents = 'auto';
                console.log('🔄 Перезагружаем список карт...');
                loadMaps();
            } else {
                let errorMessage = 'Ошибка загрузки';
                try {
                    const error = JSON.parse(xhr.responseText);
                    errorMessage = error.error || errorMessage;
                } catch (e) {
                    errorMessage = `HTTP ${xhr.status}: ${xhr.statusText}`;
                }
                throw new Error(errorMessage);
            }
        });

        xhr.addEventListener('error', () => {
            throw new Error('Ошибка соединения');
        });

        xhr.open('POST', `${API_URL}/api/maps/upload`);
        
        // Добавляем токен авторизации
        if (currentUser && currentUser.token) {
            xhr.setRequestHeader('Authorization', `Bearer ${currentUser.token}`);
        }
        
        xhr.send(formData);
    } catch (error) {
        showToast(`Ошибка: ${error.message}`);
        progressDiv.style.display = 'none';
        dropZone.style.opacity = '1';
        dropZone.style.pointerEvents = 'auto';
    }
}

// ============================================
// ЛОКАЛЬНАЯ ИСТОРИЯ КАРТ (localStorage)
// ============================================

function getLocalMapsHistory() {
    try {
        const history = localStorage.getItem('maps_history');
        return history ? JSON.parse(history) : [];
    } catch (e) {
        console.error('Ошибка чтения истории карт:', e);
        return [];
    }
}

function saveMapToLocalHistory(map) {
    try {
        const history = getLocalMapsHistory();
        
        // Добавляем в начало списка
        history.unshift({
            id: map.id,
            original_name: map.original_name,
            file_size: map.file_size,
            uploaded_at: map.uploaded_at || new Date().toISOString(),
            download_url: generateDownloadUrl(map.id)
        });
        
        // Ограничиваем историю 100 картами
        const limited = history.slice(0, 100);
        localStorage.setItem('maps_history', JSON.stringify(limited));
        
        console.log('💾 Карта сохранена в локальную историю:', map.original_name);
    } catch (e) {
        console.error('Ошибка сохранения истории:', e);
    }
}

function removeMapFromLocalHistory(mapId) {
    try {
        const history = getLocalMapsHistory();
        const filtered = history.filter(m => m.id !== mapId);
        localStorage.setItem('maps_history', JSON.stringify(filtered));
        console.log('🗑️ Карта удалена из локальной истории:', mapId);
    } catch (e) {
        console.error('Ошибка удаления из истории:', e);
    }
}

function generateDownloadUrl(mapId) {
    const shortCode = generateShortCode(mapId);
    return `${window.location.origin}/${shortCode}`;
}

async function loadMaps() {
    try {
        console.log('📂 Загрузка карт из локальной истории');
        
        // Загружаем из localStorage
        const maps = getLocalMapsHistory();
        console.log('💾 Найдено карт в истории:', maps.length);

        const container = document.getElementById('maps-list');
        if (!container) {
            console.error('❌ Контейнер maps-list не найден');
            return;
        }

        if (maps.length === 0) {
            console.log('ℹ️ История пуста, показываем пустое сообщение');
            container.innerHTML = '<p class="maps-empty">Загрузите первую карту для начала<br><small style="color: var(--text-secondary); font-size: 12px;">История хранится локально на вашем устройстве</small></p>';
            return;
        }
        
        console.log('✅ Рендерим', maps.length, 'карт(ы) из локальной истории');

        container.innerHTML = maps.map(map => {
            const downloadUrl = map.download_url || generateDownloadUrl(map.id);
            const uploadDate = new Date(map.uploaded_at).toLocaleString('ru-RU');
            const fileSize = formatFileSize(map.file_size || 0);

            return `
                <div class="map-card">
                    <div class="map-info">
                        <h4 class="map-name">${escapeHtml(map.original_name)}</h4>
                        <div class="map-meta">
                            <span>📅 ${uploadDate}</span>
                            <span>📦 ${fileSize}</span>
                            <span style="color: var(--success); font-size: 12px;">💾 Локально</span>
                        </div>
                    </div>
                    <div class="map-link-section">
                        <input type="text" class="map-link-input" value="${downloadUrl}" readonly id="map-link-${map.id}">
                        <button class="map-link-btn" onclick="copyMapLink('${map.id}', '${downloadUrl}')">⧉ Копировать</button>
                        <button class="map-delete-btn" onclick="deleteMapLocal('${map.id}')">🗑️ Удалить</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading maps:', error);
        const container = document.getElementById('maps-list');
        if (container) {
            let errorMsg = 'Ошибка загрузки списка карт';
            if (error.message) {
                if (error.message.includes('Supabase not configured')) {
                    errorMsg = 'Supabase не настроен. Добавьте переменные окружения SUPABASE_URL и SUPABASE_KEY в Vercel.';
                } else {
                    errorMsg = error.message;
                }
            }
            container.innerHTML = `<p class="maps-empty" style="color: var(--danger);">⚠️ ${errorMsg}</p>`;
        }
        showToast(error.message || 'Ошибка загрузки списка карт');
    }
}

function deleteMapLocal(mapId) {
    if (!confirm('Удалить карту из локальной истории?')) return;
    
    removeMapFromLocalHistory(mapId);
    loadMaps();
    showToast('Карта удалена из истории', 'success');
}

window.copyMapLink = function(mapId, url) {
    const input = document.getElementById(`map-link-${mapId}`);
    if (!input) return;

    input.select();
    input.setSelectionRange(0, 99999);

    // Fallback для HTTP (не HTTPS)
    const copyText = () => {
        try {
            // Пробуем современный API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(input.value);
            }
            
            // Fallback для старых браузеров или HTTP
            const success = document.execCommand('copy');
            if (success) {
                return Promise.resolve();
            }
            throw new Error('Copy failed');
        } catch (err) {
            return Promise.reject(err);
        }
    };

    copyText().then(() => {
        const btn = input.nextElementSibling;
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = '✓ Скопировано';
            btn.classList.add('copy-success');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('copy-success');
            }, 2000);
        }
        showToast('Ссылка скопирована!', 'success');
    }).catch(() => {
        showToast('Не удалось скопировать ссылку');
    });
};

let pendingDeleteMapId = null;

window.deleteMap = function(mapId) {
    pendingDeleteMapId = mapId;
    const modal = document.getElementById('delete-confirm-modal');
    if (modal) {
        modal.classList.add('active');
    }
};

function setupDeleteConfirmModal() {
    const modal = document.getElementById('delete-confirm-modal');
    const closeBtn = document.getElementById('delete-modal-close');
    const cancelBtn = document.getElementById('delete-cancel-btn');
    const confirmBtn = document.getElementById('delete-confirm-btn');

    function closeModal() {
        modal.classList.remove('active');
        pendingDeleteMapId = null;
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (!pendingDeleteMapId) return;

            const mapId = pendingDeleteMapId;
            closeModal();

            try {
                // Добавляем токен авторизации
                const headers = {};
                if (currentUser && currentUser.token) {
                    headers['Authorization'] = `Bearer ${currentUser.token}`;
                }
                
                const response = await fetch(`${API_URL}/api/maps/${mapId}`, {
                    method: 'DELETE',
                    headers
                });

                if (response.ok) {
                    showToast('Карта удалена', 'success');
                    loadMaps();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Ошибка удаления');
                }
            } catch (error) {
                showToast(`Ошибка: ${error.message}`);
            }
        });
    }

    // Close on outside click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================
// CHANGELOG PAGE
// ============================================

let changelogData = [];

async function loadChangelog() {
    try {
        const response = await fetch(`${API_URL}/api/changelog`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        changelogData = (data || []).filter(item => item !== null && item !== undefined);
        renderChangelogGrid();
        renderChangelogTimeline();
    } catch (error) {
        console.error('Error loading changelog:', error);
        changelogData = [];
        renderChangelogGrid();
        renderChangelogTimeline();
    }
}

function renderChangelogGrid() {
    const grid = document.getElementById('changelog-grid');
    if (!grid) return;

    const totalSquares = 120; // 3 rows × 40 columns
    const squares = [];

    // Fill grid with squares
    for (let i = 0; i < totalSquares; i++) {
        const changelog = changelogData[i];
        const square = document.createElement('div');
        square.className = 'changelog-square';
        
        if (changelog) {
            // Determine color based on changelog type
            let typeClass = 'empty';
            if (changelog.added && changelog.added.length > 0) {
                typeClass = 'added';
            } else if (changelog.fixed && changelog.fixed.length > 0) {
                typeClass = 'fixed';
            } else if (changelog.changed && changelog.changed.length > 0) {
                typeClass = 'changed';
            }
            
            square.className = `changelog-square ${typeClass}`;
            square.dataset.id = changelog.id;
            square.addEventListener('click', () => openChangelogDetailPageById(changelog.id));
        } else {
            square.className = 'changelog-square empty';
        }
        
        squares.push(square);
    }

    grid.innerHTML = '';
    squares.forEach(square => grid.appendChild(square));
}

function renderChangelogTimeline() {
    const timeline = document.getElementById('changelog-timeline');
    if (!timeline) return;

    timeline.innerHTML = '';

    if (changelogData.length === 0) {
        timeline.innerHTML = '<div class="changelog-empty">Нет изменений</div>';
        return;
    }

    // Sort by date (newest first)
    const sortedData = [...changelogData].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });

    sortedData.forEach((changelog) => {
        const entry = createChangelogEntry(changelog);
        timeline.appendChild(entry);
    });
}

function createChangelogEntry(changelog) {
    const entry = document.createElement('div');
    entry.className = 'changelog-entry';
    
    // Format date
    const date = new Date(changelog.date);
    const dateStr = date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric'
    });
    
    // Calculate time ago
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeAgo = '';
    if (diffDays > 0) {
        timeAgo = `${diffDays} д ${diffHours} ч назад`;
    } else if (diffHours > 0) {
        timeAgo = `${diffHours} ч ${diffMinutes} мин назад`;
    } else {
        timeAgo = `${diffMinutes} мин назад`;
    }

    // Get build number or title
    const buildNumber = changelog.build || changelog.version || 'Сборка';
    const subtitle = changelog.subtitle || '';

    // Count total changes
    const totalAdded = changelog.added ? changelog.added.length : 0;
    const totalFixed = changelog.fixed ? changelog.fixed.length : 0;
    const totalChanged = changelog.changed ? changelog.changed.length : 0;
    const totalChanges = totalAdded + totalFixed + totalChanged;

    // Get preview items (first 3-5 items total)
    const previewItems = [];
    const maxPreviewItems = 4; // Показываем максимум 4 элемента в превью
    
    if (changelog.added && changelog.added.length > 0) {
        previewItems.push(...changelog.added.slice(0, Math.min(2, changelog.added.length)).map(item => ({ text: item, type: 'added' })));
    }
    if (changelog.fixed && changelog.fixed.length > 0 && previewItems.length < maxPreviewItems) {
        const remaining = maxPreviewItems - previewItems.length;
        previewItems.push(...changelog.fixed.slice(0, Math.min(2, remaining, changelog.fixed.length)).map(item => ({ text: item, type: 'fixed' })));
    }
    if (changelog.changed && changelog.changed.length > 0 && previewItems.length < maxPreviewItems) {
        const remaining = maxPreviewItems - previewItems.length;
        previewItems.push(...changelog.changed.slice(0, Math.min(2, remaining, changelog.changed.length)).map(item => ({ text: item, type: 'changed' })));
    }

    // Show "Read more" button only if there are more items than shown
    const hasMoreItems = totalChanges > previewItems.length;
    const showReadMore = hasMoreItems || previewItems.length < totalChanges;

    entry.innerHTML = `
        <div class="changelog-entry-content">
            <div class="changelog-entry-header">
                <div class="changelog-entry-title-group">
                    <h3 class="changelog-entry-title"># ${buildNumber}</h3>
                    ${subtitle ? `<p class="changelog-entry-subtitle">${escapeHtml(subtitle)}</p>` : ''}
                </div>
                ${showReadMore ? `<button class="changelog-read-more" data-id="${changelog.id}">
                    Читать больше →
                </button>` : ''}
            </div>
            <div class="changelog-entry-meta">
                <span class="changelog-entry-time">${timeAgo}</span>
                <span class="changelog-entry-date">${dateStr}</span>
            </div>
            <div class="changelog-entry-items">
                ${previewItems.map(item => `
                    <div class="changelog-entry-item">
                        <span class="changelog-entry-item-bullet ${item.type}">—</span>
                        <span class="changelog-entry-item-text">${escapeHtml(item.text)}</span>
                    </div>
                `).join('')}
                ${totalChanges > previewItems.length ? `<div class="changelog-entry-more">и еще ${totalChanges - previewItems.length}...</div>` : ''}
            </div>
        </div>
    `;

    return entry;
}

function openChangelogDetailPageById(id) {
    const changelog = changelogData.find(item => item.id === id);
    if (!changelog) return;
    openChangelogDetailPage(changelog);
}

function openChangelogDetailPage(changelog) {
    if (!changelog) return;

    const detailPage = document.getElementById('page-changelog-detail');
    const changelogPage = document.getElementById('page-changelog');
    
    // Check if already showing this changelog
    const currentHash = window.location.hash.substring(1);
    if (currentHash === `changelog/${changelog.id}` && detailPage.style.display !== 'none') {
        return; // Already showing this page
    }

    const dateEl = document.getElementById('changelog-detail-date');
    const timeAgoEl = document.getElementById('changelog-detail-time-ago');
    const viewsEl = document.getElementById('changelog-detail-views');
    const addedSection = document.getElementById('changelog-detail-added');
    const fixedSection = document.getElementById('changelog-detail-fixed');
    const changedSection = document.getElementById('changelog-detail-changed');
    const addedList = document.getElementById('changelog-detail-added-list');
    const fixedList = document.getElementById('changelog-detail-fixed-list');
    const changedList = document.getElementById('changelog-detail-changed-list');

    // Format date
    const date = new Date(changelog.date);
    const dateStr = date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric'
    });
    
    // Calculate time ago
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeAgo = '';
    if (diffDays > 0) {
        timeAgo = `${diffDays} д ${diffHours} ч назад`;
    } else if (diffHours > 0) {
        timeAgo = `${diffHours} ч ${diffMinutes} мин назад`;
    } else {
        timeAgo = `${diffMinutes} мин назад`;
    }

    dateEl.textContent = dateStr;
    timeAgoEl.textContent = timeAgo;
    viewsEl.textContent = `${changelog.views || 0} просмотров`;

    // Render sections
    if (changelog.added && changelog.added.length > 0) {
        addedSection.style.display = 'block';
        addedList.innerHTML = changelog.added.map(item => `
            <li class="changelog-item">
                <div class="changelog-item-bullet added"></div>
                <div class="changelog-item-text">${escapeHtml(item)}</div>
            </li>
        `).join('');
    } else {
        addedSection.style.display = 'none';
    }

    if (changelog.fixed && changelog.fixed.length > 0) {
        fixedSection.style.display = 'block';
        fixedList.innerHTML = changelog.fixed.map(item => `
            <li class="changelog-item">
                <div class="changelog-item-bullet fixed"></div>
                <div class="changelog-item-text">${escapeHtml(item)}</div>
            </li>
        `).join('');
    } else {
        fixedSection.style.display = 'none';
    }

    if (changelog.changed && changelog.changed.length > 0) {
        changedSection.style.display = 'block';
        changedList.innerHTML = changelog.changed.map(item => `
            <li class="changelog-item">
                <div class="changelog-item-bullet changed"></div>
                <div class="changelog-item-text">${escapeHtml(item)}</div>
            </li>
        `).join('');
    } else {
        changedSection.style.display = 'none';
    }

    // Increment views
    incrementChangelogViews(changelog.id);

    // Show detail page and hide changelog page
    changelogPage.style.display = 'none';
    detailPage.style.display = 'block';
    
    // Update URL hash - directly set hash (will trigger hashchange which is handled)
    const newHash = `changelog/${changelog.id}`;
    if (window.location.hash !== `#${newHash}`) {
        window.location.hash = newHash;
    }
}

function setupChangelogNavigation() {
    const backBtn = document.getElementById('changelog-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const detailPage = document.getElementById('page-changelog-detail');
            const changelogPage = document.getElementById('page-changelog');
            
            detailPage.style.display = 'none';
            changelogPage.style.display = 'block';
            
            // Update hash to just changelog (not detail)
            window.location.hash = 'changelog';
        });
    }

    // Handle "Read more" button clicks using event delegation
    const timeline = document.getElementById('changelog-timeline');
    if (timeline) {
        timeline.addEventListener('click', (e) => {
            const readMoreBtn = e.target.closest('.changelog-read-more');
            if (readMoreBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = readMoreBtn.dataset.id;
                if (id) {
                    openChangelogDetailPageById(id);
                }
            }
        });
    }
}

async function incrementChangelogViews(id) {
    try {
        await fetch(`${API_URL}/api/changelog/${id}/view`, {
            method: 'POST'
        });
        // Update local data
        const changelog = changelogData.find(item => item.id === id);
        if (changelog) {
            changelog.views = (changelog.views || 0) + 1;
        }
    } catch (error) {
        console.error('Error incrementing views:', error);
    }
}

// Переключение темы
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    updateThemeStyles(newTheme);
    updateThemeButton(newTheme);
}

function updateThemeStyles(theme) {
    const root = document.documentElement;
    
    if (theme === 'dark') {
        root.style.setProperty('--bg-dark', '#1b1b1b');
        root.style.setProperty('--bg-darker', '#141414');
        root.style.setProperty('--bg-card', '#222222');
        root.style.setProperty('--bg-secondary', '#2d2d2d');
        root.style.setProperty('--border-color', '#2d2d2d');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#a0a0a0');
    } else {
        root.style.setProperty('--bg-dark', '#ffffff');
        root.style.setProperty('--bg-darker', '#f8f9fa');
        root.style.setProperty('--bg-card', '#f0f0f0');
        root.style.setProperty('--bg-secondary', '#e9ecef');
        root.style.setProperty('--border-color', '#dee2e6');
        root.style.setProperty('--text-primary', '#212529');
        root.style.setProperty('--text-secondary', '#6c757d');
    }
}

function updateThemeButton(theme) {
    const themeText = document.getElementById('theme-text');
    if (themeText) {
        themeText.textContent = theme === 'light' ? 'Темная' : 'Светлая';
    }
}

// Загрузить сохраненную тему при загрузке
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeStyles(savedTheme);
    updateThemeButton(savedTheme);
}

// Функции уже экспортированы выше
window.toggleTheme = toggleTheme;


// ============================================
// GRADIENT ROLE REQUEST FORM
// ============================================

// Флаг инициализации формы
let gradientRoleFormInitialized = false;

// Инициализация страницы градиентной роли
function initGradientRolePage() {
    console.log('🌈 [Gradient Role] Инициализация страницы');
    
    // Если форма уже инициализирована, не добавляем обработчик повторно
    if (gradientRoleFormInitialized) {
        console.log('🌈 [Gradient Role] Форма уже инициализирована');
        return;
    }
    
    const form = document.getElementById('gradient-role-form');
    if (!form) {
        console.warn('⚠️ [Gradient Role] Форма не найдена!');
        return;
    }
    
    console.log('✅ [Gradient Role] Форма найдена, добавляем обработчик');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('🌈 [Gradient Role] Форма отправлена');
        
        const roleName = document.getElementById('role-name').value.trim();
        const color1 = document.getElementById('role-color1').value.trim();
        const members = document.getElementById('role-members').value.trim();
        const statusDiv = document.getElementById('gradient-role-status');
        
        console.log('📝 [Gradient Role] Данные формы:', {
            roleName,
            color1,
            members
        });
        
        if (!roleName || !color1 || !members) {
            console.warn('⚠️ [Gradient Role] Не заполнены обязательные поля');
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.style.background = 'rgba(239,68,68,0.1)';
                statusDiv.style.borderLeft = '4px solid #ef4444';
                statusDiv.style.color = '#ef4444';
                statusDiv.textContent = '❌ Заполните все обязательные поля';
            }
            return;
        }
        
        // Получаем данные пользователя
        const authData = getAuthData();
        console.log('👤 [Gradient Role] Auth данные:', authData);
        
        if (!authData || !authData.user) {
            console.error('❌ [Gradient Role] Пользователь не авторизован');
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.style.background = 'rgba(239,68,68,0.1)';
                statusDiv.style.borderLeft = '4px solid #ef4444';
                statusDiv.style.color = '#ef4444';
                statusDiv.textContent = '❌ Необходимо войти в систему';
            }
            return;
        }
        
        // Показываем загрузку
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = 'rgba(59,130,246,0.1)';
            statusDiv.style.borderLeft = '4px solid #3b82f6';
            statusDiv.style.color = '#3b82f6';
            statusDiv.textContent = '⏳ Отправка заявки...';
        }
        
        const requestData = {
            roleName: roleName,
            color1: color1.replace('#', ''),
            members: members,
            userId: authData.user.discord_id || authData.user.id
        };
        
        console.log('📤 [Gradient Role] Отправка запроса на API:', requestData);
        
        // Определяем URL API - если на проде используем прокси, иначе localhost
        const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8787/api/gradient-role'
            : '/api/gradient-role';
        
        console.log('🔗 [Gradient Role] URL:', apiUrl);
        console.log('🌐 [Gradient Role] Hostname:', window.location.hostname);
        
        try {
            // Отправляем запрос на API бота
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer bublickrust'
                },
                body: JSON.stringify(requestData)
            });
            
            console.log('📥 [Gradient Role] Ответ от API:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                url: response.url,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            // Получаем текст ответа для отладки
            const responseText = await response.text();
            console.log('📄 [Gradient Role] Текст ответа (первые 500 символов):', responseText.substring(0, 500));
            
            // Пытаемся распарсить JSON
            let result;
            try {
                result = JSON.parse(responseText);
                console.log('📦 [Gradient Role] Данные ответа:', result);
            } catch (parseError) {
                console.error('❌ [Gradient Role] Не удалось распарсить JSON:', parseError);
                console.error('📄 [Gradient Role] Полный текст ответа:', responseText);
                throw new Error(`Сервер вернул не JSON (status ${response.status}): ${responseText.substring(0, 100)}`);
            }
            
            if (response.ok && result.success) {
                console.log('✅ [Gradient Role] Заявка успешно отправлена!');
                if (statusDiv) {
                    statusDiv.style.display = 'block';
                    statusDiv.style.background = 'rgba(16,185,129,0.1)';
                    statusDiv.style.borderLeft = '4px solid #10b981';
                    statusDiv.style.color = '#10b981';
                    statusDiv.innerHTML = `✅ Заявка успешно отправлена!<br><small>Создан Discord канал: ${result.channelName || 'создан'}</small>`;
                }
                form.reset();
                showToast('Заявка отправлена! Проверьте Discord', 'success');
            } else {
                throw new Error(result.error || 'Ошибка отправки');
            }
        } catch (error) {
            console.error('❌ [Gradient Role] Ошибка запроса:', error);
            console.error('❌ [Gradient Role] Stack trace:', error.stack);
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.style.background = 'rgba(239,68,68,0.1)';
                statusDiv.style.borderLeft = '4px solid #ef4444';
                statusDiv.style.color = '#ef4444';
                statusDiv.textContent = `❌ Ошибка: ${error.message}`;
            }
            showToast('Ошибка отправки заявки', 'error');
        }
    });
    
    gradientRoleFormInitialized = true;
    console.log('✅ [Gradient Role] Обработчик формы установлен');
}

