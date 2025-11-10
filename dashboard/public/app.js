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
    const loader = document.getElementById('loader');
    const app = document.getElementById('app');
    if (loader) loader.style.display = 'flex';
    if (app) app.style.display = 'none';
}

// Utility: Hide loader
function hideLoader() {
    const loader = document.getElementById('loader');
    const app = document.getElementById('app');
    if (loader) loader.style.display = 'none';
    if (app) app.style.display = 'flex';
}

// Utility: Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    const lastUpdate = document.getElementById('last-update');
    if (lastUpdate) lastUpdate.textContent = now.toLocaleTimeString('ru-RU');
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
        const statWipes = document.getElementById('stat-wipes');
        const statTickets = document.getElementById('stat-tickets');
        const statRoles = document.getElementById('stat-roles');
        const statDeleted = document.getElementById('stat-deleted');
        
        if (statWipes) statWipes.textContent = data.wipe_created || 0;
        if (statTickets) statTickets.textContent = data.ticket_created || 0;
        if (statRoles) statRoles.textContent = data.tournament_role_created || 0;
        if (statDeleted) statDeleted.textContent = data.channel_deleted || 0;

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
                    channel_deleted: 0,
                    wipe_signup_looking: 0,
                    wipe_signup_ready: 0,
                    wipe_signup_not_coming: 0
                });
            }
            // place today's totals at the last minute
            const last = timelineNormalized[timelineNormalized.length - 1];
            last.wipe_created = data.wipe_created || 0;
            last.ticket_created = data.ticket_created || 0;
            last.tournament_role_created = data.tournament_role_created || 0;
            last.channel_deleted = data.channel_deleted || 0;
            last.wipe_signup_looking = data.wipe_signup_looking || 0;
            last.wipe_signup_ready = data.wipe_signup_ready || 0;
            last.wipe_signup_not_coming = data.wipe_signup_not_coming || 0;
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
                    channel_deleted: 0,
                    wipe_signup_looking: 0,
                    wipe_signup_ready: 0,
                    wipe_signup_not_coming: 0
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
                    channel_deleted: 0,
                    wipe_signup_looking: 0,
                    wipe_signup_ready: 0,
                    wipe_signup_not_coming: 0
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
                    channel_deleted: 0,
                    wipe_signup_looking: 0,
                    wipe_signup_ready: 0,
                    wipe_signup_not_coming: 0
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
            segment: {
                borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
            }
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
            spanGaps: true,
            segment: {
                borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
            }
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
            spanGaps: true,
            segment: {
                borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
            }
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
            spanGaps: true,
            segment: {
                borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
            }
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
            spanGaps: true,
            segment: {
                borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
            }
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
            spanGaps: true,
            segment: {
                borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
            }
        }];
    } else if (view === 'wipe-signup') {
        // Три линии: ищут игроков, готовы зайти, не зайдут
        datasets = [
            {
                label: 'Ищут игроков',
                data: timeline.map(t => t.wipe_signup_looking || 0),
                borderColor: '#3b9bf9',
                backgroundColor: buildGradient(ctx, 'rgba(59, 155, 249, 1)'),
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 10,
                pointBackgroundColor: '#3b9bf9',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                pointHoverBorderWidth: 4,
                pointHoverBackgroundColor: '#3b9bf9',
                spanGaps: true,
                segment: {
                    borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
                }
            },
            {
                label: 'Готовы зайти',
                data: timeline.map(t => t.wipe_signup_ready || 0),
                borderColor: '#57F287',
                backgroundColor: buildSecondaryGradient(ctx, 'rgba(87, 242, 135, 1)'),
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 10,
                pointBackgroundColor: '#57F287',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                pointHoverBorderWidth: 4,
                pointHoverBackgroundColor: '#57F287',
                spanGaps: true,
                segment: {
                    borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
                }
            },
            {
                label: 'Не зайдут',
                data: timeline.map(t => t.wipe_signup_not_coming || 0),
                borderColor: '#ED4245',
                backgroundColor: buildSecondaryGradient(ctx, 'rgba(237, 66, 69, 1)'),
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 10,
                pointBackgroundColor: '#ED4245',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                pointHoverBorderWidth: 4,
                pointHoverBackgroundColor: '#ED4245',
                spanGaps: true,
                segment: {
                    borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
                }
            }
        ];
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
                    duration: 2500,
                    easing: 'easeInOutCubic',
                    delay: (context) => {
                        let delay = 0;
                        if (context.type === 'data' && context.mode === 'default') {
                            delay = context.dataIndex * 50;
                        }
                        return delay;
                    }
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

    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('active');
            // Render default demo view on open
            demoCurrentDays = 30;
            demoCurrentType = 'all';
            renderDemoChart(demoCurrentDays, demoCurrentType);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.classList.remove('active');
            if (demoChart) {
                demoChart.destroy();
                demoChart = null;
            }
        });
    }

    // Close on outside click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                if (demoChart) {
                    demoChart.destroy();
                    demoChart = null;
                }
            }
        });
    }

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
            spanGaps: true,
            segment: {
                borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
            }
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
            spanGaps: true,
            segment: {
                borderColor: ctx => ctx.p0.skip || ctx.p1.skip ? 'rgba(0,0,0,0)' : undefined
            }
        }];
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 2500,
            easing: 'easeInOutCubic',
            delay: (context) => {
                let delay = 0;
                if (context.type === 'data' && context.mode === 'default') {
                    delay = context.dataIndex * 50;
                }
                return delay;
            }
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
            const page = link.dataset.page;
            const href = link.getAttribute('href') || '';
            const isExternal = link.target === '_blank' || href.startsWith('/') || href.startsWith('http');
            if (!page) {
                // Нет внутренней страницы — позволяем обычную навигацию (для внешних ссылок)
                if (!isExternal) return; // ни страница, ни внешняя — ничего не делаем
                return; // браузер сам перейдёт
            }
            e.preventDefault();
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
        
        // Check if it's player-stats with parameters
        if (hash.startsWith('player-stats')) {
            navigateToPage(hash);
            return;
        }
        
        if (hash) {
            navigateToPage(hash);
        }
    });

    // Handle initial page load
    let initialHash = window.location.hash.substring(1);
    if (!initialHash || initialHash === 'undefined') {
        initialHash = 'analytics';
        window.location.hash = 'analytics';
    }
    
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
    // Извлекаем имя страницы из hash (убираем параметры после ?)
    const pageName = page.split('?')[0];
    
    // Check admin-only pages
    const adminPages = ['server', 'analytics', 'channels', 'admin', 'users'];
    if (adminPages.includes(pageName)) {
        const authData = getAuthData();
        if (!authData || !isAdmin(authData)) {
            console.warn('⛔ Доступ запрещен. Требуются права администратора.');
            window.location.hash = '#maps';
            return;
        }
    }

    // Update active link
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
        if (l.dataset.page === pageName || l.getAttribute('href') === `#${pageName}`) {
            l.classList.add('active');
        }
    });

    // Update URL hash (сохраняем параметры если они есть)
    const currentHash = window.location.hash.substring(1);
    if (!currentHash.startsWith(pageName)) {
        // Если hash не начинается с имени страницы, обновляем его
        const params = page.includes('?') ? '?' + page.split('?')[1] : '';
        window.location.hash = pageName + params;
    }

    // Show corresponding page
    document.querySelectorAll('.page').forEach(p => {
        p.style.display = 'none';
    });
    
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    // Hide changelog detail page if switching away from changelog
    const changelogDetailPage = document.getElementById('page-changelog-detail');
    if (changelogDetailPage && pageName !== 'changelog') {
        changelogDetailPage.style.display = 'none';
    }
    
    // Clear changelog detail hash if not on changelog page
    if (pageName !== 'changelog') {
        const changelogHashMatch = window.location.hash.match(/^#changelog\/(\d+)$/);
        if (changelogHashMatch) {
            window.location.hash = 'changelog';
        }
    }

    // Load page data
    // Специальная обработка для страницы статистики игроков с параметрами
    if (pageName === 'player-stats' && typeof handlePlayerStatsPageLoad === 'function') {
        setTimeout(() => {
            handlePlayerStatsPageLoad();
        }, 100);
    }
    if (page === 'analytics') {
        const periodSelect = document.getElementById('period-select');
        const days = periodSelect ? parseInt(periodSelect.value) : 30;
        loadAnalytics(days);
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
    } else if (page === 'api') {
        // Загрузка и отрисовка токенов API
        if (typeof loadApiTokens === 'function') {
            loadApiTokens();
        }
    } else if (page === 'admin') {
        loadAdminChangelog();
        // Используем улучшенную панель если она доступна
        if (typeof loadImprovedTournamentAdminPanel === 'function') {
            loadImprovedTournamentAdminPanel();
        } else {
            loadTournamentAdminPanel();
        }
    } else if (page === 'gradient-role') {
        // Инициализация страницы заявки на градиентную роль
        initGradientRolePage();
    } else if (page === 'training-request') {
        // Инициализация страницы заявки на турнир
        initTrainingRequestPage();
    } else if (page === 'server') {
        loadServerPlayers();
    } else if (page === 'users') {
        loadUsers();
    }
}

// ============================================
// USERS PAGE (Admin Only)
// ============================================

async function loadUsers() {
    console.log('👥 Loading users page');
    const usersList = document.getElementById('users-list');
    
    if (!usersList) {
        console.error('❌ Users list container not found');
        return;
    }
    
    const authData = getAuthData();
    if (!authData || !isAdmin(authData)) {
        usersList.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: var(--danger);"><div style="font-size: 48px; margin-bottom: 16px;">⛔</div><div style="font-size: 18px; font-weight: 600;">Доступ запрещен. Требуются права администратора.</div></div>';
        return;
    }
    
    try {
        usersList.innerHTML = '<div class="admin-loading">Загрузка пользователей...</div>';
        
        // Загружаем статус БД и пользователей параллельно
        const [dbStatusResponse, usersResponse] = await Promise.all([
            fetchWithAuth('/api/admin/database-status'),
            fetchWithAuth('/api/admin/users')
        ]);
        
        if (!usersResponse.ok) {
            throw new Error(`HTTP ${usersResponse.status}`);
        }
        
        const dbStatus = dbStatusResponse.ok ? await dbStatusResponse.json() : null;
        const data = await usersResponse.json();
        // API возвращает массив напрямую, а не объект с полем users
        const users = Array.isArray(data) ? data : (data.users || []);
        
        console.log(`✅ Loaded ${users.length} users`);
        console.log('📊 Database status:', dbStatus);
        
        // Update stats - используем данные из БД если доступны
        const totalUsers = dbStatus?.usersCount || users.length;
        const totalUsersEl = document.getElementById('total-users');
        const totalAdminsEl = document.getElementById('total-admins');
        const totalRegsTodayEl = document.getElementById('total-registrations-today');
        
        if (totalUsersEl) totalUsersEl.textContent = totalUsers;
        if (totalAdminsEl) totalAdminsEl.textContent = users.filter(u => u.role === 'admin').length;
        
        // Count today's registrations
        const today = new Date().toDateString();
        const todayRegs = users.filter(u => {
            if (!u.created_at) return false;
            return new Date(u.created_at).toDateString() === today;
        }).length;
        if (totalRegsTodayEl) totalRegsTodayEl.textContent = todayRegs;
        
        // Показываем статус БД
        let dbStatusHtml = '';
        if (dbStatus) {
            const statusColor = dbStatus.connected ? '#10b981' : '#ef4444';
            const statusText = dbStatus.connected ? '✅ Подключена' : '❌ Не подключена';
            const statusBg = dbStatus.connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            
            dbStatusHtml = `
                <div style="background: var(--bg-card); border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 2px solid var(--border-color);">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">🗄️</span>
                        <span>Статус базы данных</span>
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                        <div style="padding: 16px; background: ${statusBg}; border-radius: 12px; border-left: 4px solid ${statusColor};">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Статус</div>
                            <div style="font-size: 18px; font-weight: 700; color: ${statusColor};">${statusText}</div>
                        </div>
                        <div style="padding: 16px; background: var(--bg-secondary); border-radius: 12px;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">URL</div>
                            <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); word-break: break-all;">${dbStatus.url}</div>
                        </div>
                        <div style="padding: 16px; background: var(--bg-secondary); border-radius: 12px;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Key Preview</div>
                            <code style="font-size: 13px; color: var(--text-primary);">${dbStatus.keyPreview}</code>
                        </div>
                        <div style="padding: 16px; background: var(--bg-secondary); border-radius: 12px;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Пользователей в БД</div>
                            <div style="font-size: 24px; font-weight: 700; color: var(--text-primary);">${totalUsers}</div>
                        </div>
                    </div>
                    ${totalUsers !== users.length ? `
                        <div style="margin-top: 16px; padding: 12px; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border-left: 4px solid #f59e0b;">
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                ⚠️ В БД: <strong>${totalUsers}</strong> пользователей, загружено: <strong>${users.length}</strong>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        if (users.length === 0) {
            usersList.innerHTML = `
                ${dbStatusHtml}
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Нет зарегистрированных пользователей</div>
                    <div style="font-size: 14px;">Пользователи появятся здесь после регистрации</div>
                </div>
            `;
            return;
        }
        
        // Загружаем Steam ID и Discord тег для каждого пользователя
        const usersWithSteamId = await Promise.all(users.map(async (user) => {
            if (!user.discord_id) return { ...user, steam_id: null, discord_tag: null };
            
            const result = { ...user, steam_id: null, discord_tag: null };
            
            // Получаем Steam ID
            try {
                const steamResponse = await fetchWithAuth(`/api/admin/users/${user.discord_id}/steam-id`);
                if (steamResponse.ok) {
                    const steamData = await steamResponse.json();
                    result.steam_id = steamData.steam_id || null;
                }
            } catch (e) {
                console.warn(`Failed to get Steam ID for user ${user.discord_id}:`, e);
            }
            
            // Получаем Discord тег если нет discord_username
            if (!user.discord_username) {
                try {
                    const tagResponse = await fetchWithAuth(`/api/admin/users/${user.discord_id}/discord-tag`);
                    if (tagResponse.ok) {
                        const tagData = await tagResponse.json();
                        result.discord_tag = tagData.tag || null;
                    }
                } catch (e) {
                    console.warn(`Failed to get Discord tag for user ${user.discord_id}:`, e);
                }
            }
            
            return result;
        }));
        
        // Сортировка по умолчанию (по дате регистрации, новые сверху)
        let sortedUsers = [...usersWithSteamId];
        let currentSort = 'date_desc';
        
        // Render users with sorting
        usersList.innerHTML = `
            ${dbStatusHtml}
            <div style="background: var(--bg-card); border-radius: 16px; padding: 20px; margin-bottom: 24px; border: 2px solid var(--border-color);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary);">Сортировка</h3>
                    <select id="users-sort-select" style="padding: 10px 16px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; cursor: pointer; font-weight: 600;">
                        <option value="date_desc">📅 Дата регистрации (новые → старые)</option>
                        <option value="date_asc">📅 Дата регистрации (старые → новые)</option>
                        <option value="username_asc">👤 Имя (А → Я)</option>
                        <option value="username_desc">👤 Имя (Я → А)</option>
                        <option value="role">👑 Роль (Admin → User)</option>
                    </select>
                </div>
            </div>
            <div id="users-grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">
                ${usersWithSteamId.map(user => `
                    <div style="
                        background: var(--bg-card);
                        border-radius: 16px;
                        padding: 24px;
                        border: 2px solid var(--border-color);
                        transition: all 0.3s;
                        position: relative;
                        overflow: hidden;
                    " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                        <!-- Role badge -->
                        <div style="
                            position: absolute;
                            top: 16px;
                            right: 16px;
                            padding: 6px 12px;
                            border-radius: 8px;
                            font-size: 11px;
                            font-weight: 700;
                            text-transform: uppercase;
                            ${user.role === 'admin' ? 'background: linear-gradient(135deg, #ef4444, #dc2626); color: white;' : 'background: var(--bg-secondary); color: var(--text-secondary);'}
                        ">
                            ${user.role === 'admin' ? '👑 Admin' : '👤 User'}
                        </div>
                        
                        <!-- User info -->
                        <div style="display: flex; align-items: start; gap: 16px; margin-bottom: 20px;">
                            <div style="
                                width: 64px;
                                height: 64px;
                                border-radius: 50%;
                                background: linear-gradient(135deg, #667eea, #764ba2);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: white;
                                font-size: 28px;
                                font-weight: 700;
                                flex-shrink: 0;
                            ">
                                ${(user.username || user.discord_username || 'U')[0].toUpperCase()}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; word-break: break-word;">
                                    ${user.username || user.discord_username || 'Неизвестный'}
                                </div>
                                <div style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                                    <span>📅</span>
                                    <span>${new Date(user.created_at).toLocaleDateString('ru-RU')}</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Details -->
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${user.discord_username || user.discord_tag ? `
                            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                                <span style="font-size: 18px;">💬</span>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Discord</div>
                                    <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); word-break: break-word;">${user.discord_username || user.discord_tag || 'Неизвестно'}</div>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${user.discord_id ? `
                            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                                <span style="font-size: 18px;">🆔</span>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Discord ID</div>
                                    <code style="font-size: 13px; font-weight: 600; color: var(--text-primary); word-break: break-all;">${user.discord_id}</code>
                                </div>
                            </div>
                        ` : ''}
                            
                            ${user.email ? `
                                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                                    <span style="font-size: 18px;">📧</span>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Email</div>
                                        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); word-break: break-word;">${user.email}</div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${user.steam_id ? `
                                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                                    <span style="font-size: 18px;">🎮</span>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Steam ID</div>
                                        <code style="font-size: 13px; font-weight: 600; color: var(--text-primary); word-break: break-all; background: rgba(102, 126, 234, 0.1); padding: 4px 8px; border-radius: 6px; display: inline-block;">${user.steam_id}</code>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Обработчик сортировки
        const sortSelect = document.getElementById('users-sort-select');
        const usersGrid = document.getElementById('users-grid-container');
        
        function sortAndRenderUsers(sortType) {
            let sorted = [...usersWithSteamId];
            
            switch(sortType) {
                case 'date_desc':
                    sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                    break;
                case 'date_asc':
                    sorted.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
                    break;
                case 'username_asc':
                    sorted.sort((a, b) => {
                        const nameA = (a.username || a.discord_username || '').toLowerCase();
                        const nameB = (b.username || b.discord_username || '').toLowerCase();
                        return nameA.localeCompare(nameB, 'ru');
                    });
                    break;
                case 'username_desc':
                    sorted.sort((a, b) => {
                        const nameA = (a.username || a.discord_username || '').toLowerCase();
                        const nameB = (b.username || b.discord_username || '').toLowerCase();
                        return nameB.localeCompare(nameA, 'ru');
                    });
                    break;
                case 'role':
                    sorted.sort((a, b) => {
                        if (a.role === 'admin' && b.role !== 'admin') return -1;
                        if (a.role !== 'admin' && b.role === 'admin') return 1;
                        return 0;
                    });
                    break;
            }
            
            // Перерисовываем только сетку
            usersGrid.innerHTML = sorted.map(user => `
                <div style="
                    background: var(--bg-card);
                    border-radius: 16px;
                    padding: 24px;
                    border: 2px solid var(--border-color);
                    transition: all 0.3s;
                    position: relative;
                    overflow: hidden;
                " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                    <!-- Role badge -->
                    <div style="
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        padding: 6px 12px;
                        border-radius: 8px;
                        font-size: 11px;
                        font-weight: 700;
                        text-transform: uppercase;
                        ${user.role === 'admin' ? 'background: linear-gradient(135deg, #ef4444, #dc2626); color: white;' : 'background: var(--bg-secondary); color: var(--text-secondary);'}
                    ">
                        ${user.role === 'admin' ? '👑 Admin' : '👤 User'}
                    </div>
                    
                    <!-- User info -->
                    <div style="display: flex; align-items: start; gap: 16px; margin-bottom: 20px;">
                        <div style="
                            width: 64px;
                            height: 64px;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #667eea, #764ba2);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 28px;
                            font-weight: 700;
                            flex-shrink: 0;
                        ">
                            ${(user.username || user.discord_username || 'U')[0].toUpperCase()}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; word-break: break-word;">
                                ${user.username || user.discord_username || 'Неизвестный'}
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                                <span>📅</span>
                                <span>${new Date(user.created_at).toLocaleDateString('ru-RU')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Details -->
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${user.discord_username || user.discord_tag ? `
                            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                                <span style="font-size: 18px;">💬</span>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Discord</div>
                                    <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); word-break: break-word;">${user.discord_username || user.discord_tag || 'Неизвестно'}</div>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${user.discord_id ? `
                            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                                <span style="font-size: 18px;">🆔</span>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Discord ID</div>
                                    <code style="font-size: 13px; font-weight: 600; color: var(--text-primary); word-break: break-all;">${user.discord_id}</code>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${user.email ? `
                            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                                <span style="font-size: 18px;">📧</span>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Email</div>
                                    <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); word-break: break-word;">${user.email}</div>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${user.steam_id ? `
                            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                                <span style="font-size: 18px;">🎮</span>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Steam ID</div>
                                    <code style="font-size: 13px; font-weight: 600; color: var(--text-primary); word-break: break-all; background: rgba(102, 126, 234, 0.1); padding: 4px 8px; border-radius: 6px; display: inline-block;">${user.steam_id}</code>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }
        
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                sortAndRenderUsers(e.target.value);
            });
        }
        
    } catch (error) {
        console.error('❌ Error loading users:', error);
        usersList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--danger);">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Ошибка загрузки</div>
                <div style="font-size: 14px;">${error.message}</div>
            </div>
        `;
    }
}

// ============================================
// END USERS PAGE
// ============================================

// ============================================
// RUST SERVER PAGE
// ============================================

async function loadServerPlayers() {
    try {
        const tbody = document.getElementById('server-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" style="padding:40px; text-align:center; color: var(--text-secondary); font-size:15px;">Загрузка...</td></tr>`;
        }
        const onlineOnly = document.getElementById('server-online-only')?.checked;
        const res = await fetchWithAuth(`/api/rust/players?cb=${Date.now()}`);
        const data = await res.json();
        const search = (document.getElementById('server-search')?.value || '').trim().toLowerCase();

        window.__serverPlayersCache = Array.isArray(data) ? data : [];
        let players = window.__serverPlayersCache;
        if (onlineOnly) players = players.filter(p => p.online);
        if (search) {
            players = players.filter(p =>
                String(p.name || '').toLowerCase().includes(search) ||
                String(p.steam_id || '').toLowerCase().includes(search) ||
                String(p.ip || '').toLowerCase().includes(search) ||
                String(p.grid || '').toLowerCase().includes(search)
            );
        }

        // Update online count
        try {
            const totalOnline = (window.__serverPlayersCache || []).filter(p => p.online).length;
            const badge = document.getElementById('server-online-count');
            if (badge) {
                const onlineText = badge.querySelector('span:last-child') || badge;
                if (onlineText === badge) {
                    badge.textContent = `Онлайн: ${totalOnline}`;
                } else {
                    onlineText.textContent = `Онлайн: ${totalOnline}`;
                }
            }
        } catch(_) {}

        const rows = players.map((p, idx) => {
            const teamSize = Array.isArray(p.team_members) ? p.team_members.length : (p.team_members && p.team_members.members ? p.team_members.members.length : 0);
            const teamLabel = p.team_id ? `${p.team_id} (${teamSize})` : '-';
            const xyz = [p.x, p.y, p.z].every(v => typeof v === 'number') ? `${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}` : '-';
            const statusColor = p.online ? '#4ade80' : '#94a3b8';
            const statusBg = p.online ? 'rgba(74,222,128,0.1)' : 'rgba(148,163,184,0.1)';
            const statusText = p.online ? 'Онлайн' : 'Оффлайн';
            const updated = p.updated_at ? new Date(p.updated_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const rowBg = idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)';
            return `<tr data-steamid="${p.steam_id}" style="background:${rowBg}; transition:background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='${rowBg}'">
                <td style=\"padding:16px; border-bottom:1px solid var(--border-color); font-weight:600; color:var(--text-primary);\">${escapeHtml(p.name || '-') }</td>
                <td style=\"padding:16px; border-bottom:1px solid var(--border-color); font-family: monospace; font-size:13px; color:var(--text-secondary);\">${escapeHtml(p.steam_id || '-') }</td>
                <td style=\"padding:16px; border-bottom:1px solid var(--border-color); font-size:13px; color:var(--text-secondary);\">${escapeHtml(p.ip || '-') }</td>
                <td style=\"padding:16px; border-bottom:1px solid var(--border-color); font-size:13px; color:var(--text-primary);\">${escapeHtml(teamLabel)}</td>
                <td style=\"padding:16px; border-bottom:1px solid var(--border-color); font-size:13px; color:var(--text-primary); font-weight:600;\">${escapeHtml(p.grid || '-') }</td>
                <td style=\"padding:16px; border-bottom:1px solid var(--border-color); font-family:monospace; font-size:12px; color:var(--text-secondary);\">${xyz}</td>
                <td style=\"padding:16px; border-bottom:1px solid var(--border-color);\">
                    <span style=\"display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; background:${statusBg}; color:${statusColor}; font-weight:600; font-size:12px;\">
                        <span style=\"width:8px;height:8px;background:${statusColor};border-radius:50%;display:inline-block;\"></span>
                        ${statusText}
                    </span>
                </td>
                <td style=\"padding:16px; border-bottom:1px solid var(--border-color); color: var(--text-secondary); font-size:12px;\">${updated}</td>
                <td style=\"padding:16px; border-bottom:1px solid var(--border-color); text-align:right;\">
                    ${p.team_id || Array.isArray(p.team_members) ? `<button class=\"btn btn-sm\" data-action=\"team\" data-id=\"${escapeHtml(p.steam_id || '')}\" style=\"padding:8px 14px; background:linear-gradient(135deg,var(--accent-primary),var(--accent-secondary)); color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600; font-size:13px; transition:transform 0.2s, box-shadow 0.2s; box-shadow:0 2px 8px rgba(59,155,249,0.2);\" onmouseover=\"this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 12px rgba(59,155,249,0.3)'\" onmouseout=\"this.style.transform='scale(1)';this.style.boxShadow='0 2px 8px rgba(59,155,249,0.2)'\">👥 Состав</button>` : '-'}
                </td>
            </tr>`;
        });

        if (tbody) {
            tbody.innerHTML = rows.length ? rows.join('') : `<tr><td colspan=\"9\" style=\"padding:14px; color: var(--text-secondary);\">Нет данных</td></tr>`;
        }
    } catch (e) {
        console.error('Failed to load players:', e);
        const tbody = document.getElementById('server-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan=\"9\" style=\"padding:14px; color: var(--danger);\">Ошибка загрузки: ${escapeHtml(e.message)}</td></tr>`;
    }
}

// helpers
function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
}

// Wire controls
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('server-refresh-btn');
    if (btn) btn.addEventListener('click', loadServerPlayers);
    const search = document.getElementById('server-search');
    if (search) search.addEventListener('input', () => { setTimeout(loadServerPlayers, 100); });
    const onlineOnly = document.getElementById('server-online-only');
    if (onlineOnly) onlineOnly.addEventListener('change', loadServerPlayers);
    const tbody = document.getElementById('server-table-body');
    if (tbody) tbody.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action="team"]');
        if (el) {
            const steamId = el.getAttribute('data-id');
            openTeamModal(steamId);
        }
    });
    const teamClose = document.getElementById('server-team-close');
    if (teamClose) teamClose.addEventListener('click', closeTeamModal);
    const teamOk = document.getElementById('server-team-ok');
    if (teamOk) teamOk.addEventListener('click', closeTeamModal);
});

function openTeamModal(steamId) {
    const players = window.__serverPlayersCache || [];
    const p = players.find(x => String(x.steam_id) === String(steamId));
    if (!p) return;
    const teamId = p.team_id || null;
    let allMembers = [];
    
    // Собираем всех участников команды
    if (teamId) {
        // Если есть team_id, ищем всех игроков с таким же team_id
        const teamPlayers = players.filter(x => x.team_id && String(x.team_id) === String(teamId));
        allMembers = teamPlayers;
        
        // Также добавляем участников из team_members если они есть
        if (Array.isArray(p.team_members)) {
            p.team_members.forEach(m => {
                const memberSteamId = String(m.steamId || m.steamid || m.id || '');
                const foundInCache = allMembers.find(x => String(x.steam_id) === memberSteamId);
                if (!foundInCache) {
                    // Добавляем участника из team_members даже если его нет в списке онлайн игроков
                    allMembers.push({
                        name: m.name || '-',
                        steam_id: memberSteamId || '-',
                        online: false // по умолчанию офлайн, если не найден в кеше
                    });
                }
            });
        }
    } else if (Array.isArray(p.team_members)) {
        // Если нет team_id, но есть team_members, показываем всех из team_members
        allMembers = p.team_members.map(m => {
            const memberSteamId = String(m.steamId || m.steamid || m.id || '');
            const found = players.find(x => String(x.steam_id) === memberSteamId);
            if (found) {
                return found; // Используем данные из кеша
            }
            // Возвращаем участника из team_members даже если его нет в кеше
            return { 
                name: m.name || '-', 
                steam_id: memberSteamId || '-', 
                online: false 
            };
        });
    }
    
    // Если нет команды вообще, показываем только этого игрока
    if (allMembers.length === 0) allMembers = [p];
    
    // Убираем дубликаты по steam_id
    const uniqueMembers = [];
    const seenIds = new Set();
    allMembers.forEach(m => {
        const id = String(m.steam_id || m.steamId || '-');
        if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueMembers.push(m);
        }
    });

    const body = document.getElementById('server-team-body');
    if (body) {
        const rows = uniqueMembers.map(m => {
            const isOnline = m.online === true;
            const statusColor = isOnline ? '#4ade80' : '#94a3b8';
            const statusBg = isOnline ? 'rgba(74,222,128,0.1)' : 'rgba(148,163,184,0.1)';
            const statusText = isOnline ? 'Онлайн' : 'Оффлайн';
            const name = escapeHtml(m.name || '-');
            const sid = escapeHtml(m.steam_id || m.steamId || '-');
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid var(--border-color); transition:background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="width:10px;height:10px;background:${statusColor};border-radius:50%;display:inline-block;box-shadow:0 0 8px ${statusColor}80;"></span>
                    <span style="font-weight:600; color:var(--text-primary); font-size:15px;">${name}</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="padding:6px 12px; border-radius:8px; background:${statusBg}; color:${statusColor}; font-weight:600; font-size:12px;">${statusText}</span>
                    <span style="font-family:monospace; color: var(--text-secondary); font-size:12px;">${sid}</span>
                </div>
            </div>`;
        });
        body.innerHTML = `<div style="display:flex; flex-direction:column; max-height:400px; overflow-y:auto;">${rows.join('')}</div>`;
    }
    const modal = document.getElementById('server-team-modal');
    const title = document.getElementById('server-team-title');
    if (title) title.textContent = `👥 Состав команды: ${escapeHtml(p.name || 'Неизвестно')}`;
    if (modal) modal.style.display = 'block';
}

function closeTeamModal(){
    const modal = document.getElementById('server-team-modal');
    if (modal) modal.style.display = 'none';
}


// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Обработка токена из URL (Discord OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const discordToken = urlParams.get('discord_token');
    if (discordToken) {
        // Сохраняем токен и получаем данные пользователя
        localStorage.setItem('auth_token', discordToken);
        
        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${discordToken}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Убираем токен из URL
                window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
                
                console.log('✅ Discord OAuth успешно завершен');
            } else {
                console.error('❌ Failed to get user data after Discord OAuth');
                localStorage.removeItem('auth_token');
            }
        } catch (error) {
            console.error('❌ Error processing Discord token:', error);
            localStorage.removeItem('auth_token');
        }
    }
    
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
    const periodSelect = document.getElementById('period-select');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            loadAnalytics(parseInt(e.target.value));
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const days = parseInt(document.getElementById('period-select')?.value || 30);
            loadAnalytics(days);
        });
    }

    // Load initial data
    try {
        await loadAnalytics(30);
    } catch (error) {
        console.error('Error loading analytics:', error);
    }

    // Hide loader after 1 second
    setTimeout(hideLoader, 1000);

    // Auto-refresh every minute
    autoRefreshInterval = setInterval(() => {
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'page-analytics') {
            const periodSelect = document.getElementById('period-select');
            const days = periodSelect ? parseInt(periodSelect.value) : 30;
            loadAnalytics(days);
        } else if (activePage && activePage.id === 'page-channels') {
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

    if (!canvas) return;
    
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
            // Показываем превью перед загрузкой
            showMapPreview(file);
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
            // Показываем превью перед загрузкой
            showMapPreview(file);
        }
    });
}

// Показываем превью карты перед загрузкой
async function showMapPreview(file) {
    const dropZone = document.getElementById('maps-drop');
    if (!dropZone) return;
    
    // Удаляем старое превью если есть
    const oldPreview = dropZone.querySelector('.map-preview-container');
    if (oldPreview) {
        oldPreview.remove();
    }
    
    // Создаем контейнер для превью
    const previewContainer = document.createElement('div');
    previewContainer.className = 'map-preview-container';
    
    // Сразу показываем базовую информацию о файле с иконкой
    const fileInfoHtml = `
        <div class="map-preview-basic">
            <div class="map-preview-icon">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 64px; height: 64px; stroke: var(--accent-primary); fill: none;">
                    <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.447 2.224A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="map-preview-info">
                <h4>${escapeHtml(file.name)}</h4>
                <p>Размер: ${formatFileSize(file.size)}</p>
                <p style="color: var(--text-secondary); font-size: 12px; margin-top: 8px;">Готов к загрузке</p>
            </div>
            <div class="map-preview-actions">
                <button class="btn btn-primary" onclick="uploadSelectedMap()">Загрузить карту</button>
                <button class="btn btn-secondary" onclick="cancelMapPreview()">Отмена</button>
            </div>
        </div>
    `;
    
    // Сразу показываем информацию о файле
    previewContainer.innerHTML = fileInfoHtml;
    
    // Вставляем превью в drop zone
    dropZone.appendChild(previewContainer);
    
    // Сохраняем файл для загрузки
    window.pendingMapFile = file;
    
    // Пробуем получить превью изображения в фоне (не блокируя UI)
    try {
        // Отправляем файл на сервер для генерации превью
        const formData = new FormData();
        formData.append('map', file);
        
        const previewResponse = await fetch(`${API_URL}/api/maps/preview`, {
            method: 'POST',
            body: formData,
            headers: currentUser && currentUser.token ? {
                'Authorization': `Bearer ${currentUser.token}`
            } : {}
        });
        
        if (previewResponse.ok) {
            const previewData = await previewResponse.json();
            
            // Если превью успешно получено, показываем его
                if (previewData.preview_url) {
                // Добавляем параметры сжатия для изображения превью
                let previewUrl = previewData.preview_url;
                try {
                    const url = new URL(previewUrl);
                    // Устанавливаем параметры для сжатия изображения
                    url.searchParams.set('w', '800'); // Максимальная ширина 800px
                    url.searchParams.set('q', '75'); // Качество 75%
                    previewUrl = url.toString();
                } catch (e) {
                    // Если не удалось распарсить URL, используем оригинальный
                    console.log('Не удалось добавить параметры сжатия');
                }
                
                // Обновляем превью, добавляя изображение
                previewContainer.innerHTML = `
                    <div class="map-preview-image-container">
                        <img src="${previewUrl}" alt="Превью карты" class="map-preview-image" loading="lazy" onerror="this.onerror=null; this.style.display='none';">
                        <div class="map-preview-info">
                            <h4>${escapeHtml(file.name)}</h4>
                            <p>Размер: ${formatFileSize(file.size)}</p>
                        </div>
                        <div class="map-preview-actions">
                            <a href="${previewUrl}" download="${file.name.replace('.map', '_preview.jpg')}" class="btn btn-secondary" style="text-decoration: none; display: inline-block;">📥 Скачать превью</a>
                            <button class="btn btn-primary" onclick="uploadSelectedMap()">Загрузить карту</button>
                            <button class="btn btn-secondary" onclick="cancelMapPreview()">Отмена</button>
                        </div>
                    </div>
                `;
                
                // Сохраняем URL превью для использования при загрузке
                window.pendingMapPreviewUrl = previewUrl;
            }
            // Если превью недоступно, оставляем базовую информацию (уже показана)
        } else {
            // Если запрос не успешен, оставляем базовую информацию (уже показана)
        }
    } catch (error) {
        console.error('Ошибка генерации превью:', error);
        // Оставляем базовую информацию (уже показана)
    }
}

// Загружаем выбранную карту
window.uploadSelectedMap = function() {
    if (window.pendingMapFile) {
        uploadMap(window.pendingMapFile);
        window.pendingMapFile = null;
    }
}

// Отменяем превью
window.cancelMapPreview = function() {
    const dropZone = document.getElementById('maps-drop');
    const previewContainer = dropZone?.querySelector('.map-preview-container');
    if (previewContainer) {
        previewContainer.remove();
    }
    const fileInput = document.getElementById('maps-file');
    if (fileInput) {
        fileInput.value = '';
    }
    window.pendingMapFile = null;
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
    
    // Скрываем превью во время загрузки
    const previewContainer = dropZone.querySelector('.map-preview-container');
    if (previewContainer) {
        previewContainer.style.display = 'none';
    }

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
                
                // Пробуем получить превью для загруженной карты
                const mapData = response.map;
                if (window.pendingMapPreviewUrl) {
                    mapData.preview_url = window.pendingMapPreviewUrl;
                    window.pendingMapPreviewUrl = null;
                }
                
                // Сохраняем в локальную историю
                saveMapToLocalHistory(mapData);
                
                showToast('Карта успешно загружена!', 'success');
                progressDiv.style.display = 'none';
                dropZone.style.opacity = '1';
                dropZone.style.pointerEvents = 'auto';
                // Удаляем превью после успешной загрузки
                const previewContainer = dropZone.querySelector('.map-preview-container');
                if (previewContainer) {
                    previewContainer.remove();
                }
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
        // Показываем превью обратно при ошибке
        const previewContainer = dropZone.querySelector('.map-preview-container');
        if (previewContainer) {
            previewContainer.style.display = 'block';
        }
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
            download_url: generateDownloadUrl(map.id),
            preview_url: map.preview_url || null // Сохраняем превью если есть
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
            const previewUrl = map.preview_url || null;

            return `
                <div class="map-card">
                    ${previewUrl ? `
                        <div class="map-preview-thumbnail" style="margin-bottom: 16px; border-radius: 8px; overflow: hidden; border: 2px solid var(--border-color);">
                            <img src="${previewUrl}" alt="Превью карты" style="width: 100%; height: auto; display: block;" loading="lazy" onerror="this.style.display='none';">
                        </div>
                    ` : ''}
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
                        ${previewUrl ? `<a href="${previewUrl}" download="${map.original_name.replace('.map', '_preview.jpg')}" class="btn btn-secondary" style="text-decoration: none; display: inline-block; padding: 8px 16px; margin-right: 8px;">📥 Превью</a>` : ''}
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
    
    let isSubmitting = false;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Защита от множественных отправок
        if (isSubmitting) {
            console.warn('⚠️ [Gradient Role] Заявка уже отправляется');
            return;
        }
        
        console.log('🌈 [Gradient Role] Форма отправлена');
        isSubmitting = true;
        
        const roleNameEl = document.getElementById('role-name');
        const color1El = document.getElementById('role-color1');
        const membersEl = document.getElementById('role-members');
        
        if (!roleNameEl || !color1El || !membersEl) {
            showToast('Ошибка: форма не найдена', 'error');
            isSubmitting = false;
            return;
        }
        
        const roleName = roleNameEl.value.trim();
        const color1 = color1El.value.trim();
        const members = membersEl.value.trim();
        const statusDiv = document.getElementById('gradient-role-status');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        // Блокируем кнопку
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
            submitBtn.style.cursor = 'not-allowed';
        }
        
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
        } finally {
            // Разблокируем кнопку
            isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
            }
        }
    });
    
    gradientRoleFormInitialized = true;
    console.log('✅ [Gradient Role] Обработчик формы установлен');
}

// ============================================
// TOURNAMENT FORM HANDLER
// ============================================

function setupTournamentFormHandler() {
    const form = document.getElementById('tournament-application-form');
    if (!form) return;
    
    // Удаляем старые обработчики если есть
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Добавляем новый обработчик
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submit-application-btn');
        const statusDiv = document.getElementById('tournament-status-message');
        const steamIdInput = document.getElementById('steam-id-input');
        
        if (!submitBtn || !steamIdInput) {
            console.error('❌ [Tournament Form] Required elements not found');
            return;
        }
        
        const steamId = steamIdInput.value.trim();
        
        // Валидация Steam ID
        if (!steamId) {
            showTournamentStatus('error', 'Пожалуйста, укажите ваш Steam ID');
            return;
        }
        
        if (!/^\d+$/.test(steamId)) {
            showTournamentStatus('error', 'Steam ID должен содержать только цифры');
            return;
        }
        
        // Отключаем кнопку
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
        
        try {
            const authData = getAuthData();
            const response = await fetch('/api/tournament/apply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.token}`
                },
                body: JSON.stringify({ steamId })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showTournamentStatus('success', '✅ Заявка успешно подана! Она появится в Discord канале.');
                newForm.style.display = 'none';
                // Обновляем статус
                setTimeout(() => {
                    loadTournamentStatus();
                }, 1000);
            } else {
                showTournamentStatus('error', data.error || 'Ошибка при подаче заявки');
                submitBtn.disabled = false;
                submitBtn.textContent = '📝 Подать заявку';
            }
        } catch (error) {
            console.error('Application error:', error);
            showTournamentStatus('error', 'Ошибка при отправке заявки. Попробуйте позже.');
            submitBtn.disabled = false;
            submitBtn.textContent = '📝 Подать заявку';
        }
    });
}

// ============================================
// TRAINING REQUEST PAGE
// ============================================

async function initTrainingRequestPage() {
    console.log('🏆 [Training Request] Инициализация страницы');
    
    const contentDiv = document.getElementById('training-request-content');
    if (!contentDiv) {
        console.warn('⚠️ [Training Request] Контейнер не найден');
        return;
    }
    
    // Проверяем авторизацию
    const authData = getAuthData();
    
    if (!authData || !authData.user) {
        // Пользователь не авторизован - показываем кнопку входа через Discord
        const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=1417959083704582224&response_type=code&redirect_uri=${encodeURIComponent('https://bublickrust.ru/signin-discord')}&scope=identify+email`;
        
        contentDiv.innerHTML = `
            <div style="background: var(--bg-card); border-radius: 16px; padding: 60px 40px; border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.1); text-align: center;">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 30px; display: block; color: #5865F2;">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                <h3 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: var(--text-primary);">
                    Войдите через Discord
                </h3>
                <p style="margin: 0 0 40px 0; color: var(--text-secondary); font-size: 16px; line-height: 1.6;">
                    Для доступа к разделу "Заявка на турнир" необходимо авторизоваться через Discord
                </p>
                <a href="${discordAuthUrl}" style="display: inline-flex; align-items: center; gap: 12px; padding: 16px 40px; background: #5865F2; color: white; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 700; transition: all 0.2s; box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);" onmouseover="this.style.background='#4752C4'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(88, 101, 242, 0.4)'" onmouseout="this.style.background='#5865F2'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(88, 101, 242, 0.3)'">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                    </svg>
                    Войти через Discord
                </a>
            </div>
        `;
        return;
    }
    
    // Пользователь авторизован - проверяем что он действительно зарегистрирован
    // Проверяем через API, что пользователь существует в базе данных
    try {
        const userResponse = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${authData.token}` }
        });
        
        if (!userResponse.ok) {
            // Пользователь не найден в базе - показываем ошибку
            contentDiv.innerHTML = `
                <div style="background: var(--bg-card); border-radius: 16px; padding: 60px 40px; border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.1); text-align: center;">
                    <div style="color: #ef4444; font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <h3 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: var(--text-primary);">
                        Пользователь не найден
                    </h3>
                    <p style="margin: 0 0 40px 0; color: var(--text-secondary); font-size: 16px; line-height: 1.6;">
                        Ваша учетная запись не найдена в системе. Пожалуйста, попробуйте войти снова через Discord.
                    </p>
                    <a href="/login.html" style="display: inline-flex; align-items: center; gap: 12px; padding: 16px 40px; background: #5865F2; color: white; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 700; transition: all 0.2s; box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);">
                        Войти через Discord
                    </a>
                </div>
            `;
            return;
        }
        
        // Обновляем данные пользователя из ответа API
        const userData = await userResponse.json();
        localStorage.setItem('user', JSON.stringify(userData.user));
        authData.user = userData.user;
        
        // Проверяем, что пользователь авторизован через Discord
        if (!userData.user.discord_id) {
            // Пользователь авторизован, но не через Discord - показываем кнопку входа через Discord
            const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=1417959083704582224&response_type=code&redirect_uri=${encodeURIComponent('https://bublickrust.ru/signin-discord')}&scope=identify+email`;
            
            contentDiv.innerHTML = `
                <div style="background: var(--bg-card); border-radius: 16px; padding: 60px 40px; border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.1); text-align: center;">
                    <div style="color: #f59e0b; font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <h3 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: var(--text-primary);">
                        Требуется авторизация через Discord
                    </h3>
                    <p style="margin: 0 0 20px 0; color: var(--text-secondary); font-size: 16px; line-height: 1.6;">
                        Вы авторизованы как обычный пользователь (<strong>${userData.user.username}</strong>), но для подачи заявки на турнир необходимо авторизоваться через Discord.
                    </p>
                    <p style="margin: 0 0 40px 0; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
                        Нажмите кнопку ниже, чтобы войти через Discord. Ваши данные будут привязаны к учетной записи Discord.
                    </p>
                    <a href="${discordAuthUrl}" style="display: inline-flex; align-items: center; gap: 12px; padding: 16px 40px; background: #5865F2; color: white; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 700; transition: all 0.2s; box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);" onmouseover="this.style.background='#4752C4'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(88, 101, 242, 0.4)'" onmouseout="this.style.background='#5865F2'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(88, 101, 242, 0.3)'">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                        </svg>
                        Войти через Discord
                    </a>
                </div>
            `;
            return;
        }
    } catch (error) {
        console.error('❌ [Training Request] Ошибка проверки пользователя:', error);
        contentDiv.innerHTML = `
            <div style="background: var(--bg-card); border-radius: 16px; padding: 60px 40px; border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.1); text-align: center;">
                <div style="color: #ef4444; font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h3 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: var(--text-primary);">
                    Ошибка проверки
                </h3>
                <p style="margin: 0 0 40px 0; color: var(--text-secondary); font-size: 16px; line-height: 1.6;">
                    Не удалось проверить вашу учетную запись. Пожалуйста, попробуйте позже.
                </p>
            </div>
        `;
        return;
    }
    
    // Пользователь авторизован и зарегистрирован через Discord - показываем его данные
    const user = authData.user;
    const username = user.username || user.discord_username || 'Пользователь';
    const userId = user.id || user.discord_id || 'ID не указан';
    
    // Получаем аватарку Discord если есть
    let avatarUrl = '';
    let avatarHtml = '';
    if (user.discord_avatar && user.discord_id) {
        const avatarHash = user.discord_avatar;
        const discordId = user.discord_id;
        avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=256`;
        avatarHtml = `<img src="${avatarUrl}" alt="${username}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
        avatarHtml = `<div style="width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #5865F2, #4752C4); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px;">${username.charAt(0).toUpperCase()}</div>`;
    }
    
    // Определяем отображаемый ID (Discord ID или обычный ID)
    const displayId = user.discord_id || userId;
    
    contentDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 20px;">
            <div class="avatar-container" style="position: relative; width: 48px; height: 48px; border-radius: 50%; padding: 3px; animation: rotate-gradient-user 4s linear infinite;">
                <div class="avatar-inner" style="width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${avatarHtml}
                </div>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text-primary); font-size: 14px; margin-bottom: 4px;">
                    ${username}
                </div>
                ${user.discord_id ? `
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                    </svg>
                    <span>Discord ID: ${displayId}</span>
                </div>
                ` : ''}
            </div>
            <div style="padding: 8px 12px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.2);">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #22c55e; font-weight: 600;">
                    <span>✅</span>
                    <span>Авторизован</span>
                </div>
            </div>
        </div>
        <div style="background: var(--bg-card); border-radius: 16px; padding: 32px; border: 1px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: var(--text-primary);">
                🏆 Подача заявки на турнир
            </h2>
            
            <!-- Countdown Timer -->
            <div id="tournament-countdown-container" style="display: none; margin-bottom: 24px;"></div>
            
            <div id="tournament-form-container">
                <form id="tournament-application-form" style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Discord ID (readonly) -->
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">
                            Discord ID
                        </label>
                        <input 
                            type="text" 
                            id="discord-id-input" 
                            value="${displayId}" 
                            readonly 
                            style="width: 100%; padding: 12px 16px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 8px; font-size: 14px; color: var(--text-secondary); cursor: not-allowed;"
                        >
                        <p style="margin: 6px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                            Ваш Discord ID (изменить нельзя)
                        </p>
                    </div>
                    
                    <!-- Steam ID -->
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">
                            Steam ID <span style="color: var(--danger);">*</span>
                        </label>
                        <input 
                            type="text" 
                            id="steam-id-input" 
                            placeholder="Введите ваш Steam ID (только цифры)" 
                            required 
                            pattern="[0-9]+"
                            maxlength="20"
                            style="width: 100%; padding: 12px 16px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 8px; font-size: 14px; color: var(--text-primary); transition: border-color 0.2s;"
                            onfocus="this.style.borderColor='var(--accent-primary)'"
                            onblur="this.style.borderColor='var(--border-color)'"
                        >
                        <p style="margin: 6px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                            Укажите ваш Steam ID (только цифры, без пробелов)
                        </p>
                    </div>
                    
                    <!-- Submit Button -->
                    <button 
                        type="submit" 
                        id="submit-application-btn"
                        style="width: 100%; padding: 14px 24px; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);"
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(88, 101, 242, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(88, 101, 242, 0.3)'"
                    >
                        📝 Подать заявку
                    </button>
                </form>
                
                <!-- Status Message -->
                <div id="tournament-status-message" style="margin-top: 20px; padding: 16px; border-radius: 8px; display: none;"></div>
            </div>
        </div>
    `;
    
    // Устанавливаем обработчик формы
    setupTournamentFormHandler();
    
    // Загружаем статус заявки и настройки турнира
    await Promise.all([
        loadTournamentStatus(),
        loadTournamentCountdown()
    ]);
    
    console.log('✅ [Training Request] Контент загружен', { username, userId, hasAvatar: !!avatarUrl, discordId: user.discord_id });
}

// Countdown Timer для игроков
async function loadTournamentCountdown() {
    try {
        const response = await fetch('/api/tournament/public-settings');
        if (!response.ok) return;
        
        const data = await response.json();
        const container = document.getElementById('tournament-countdown-container');
        if (!container) return;
        
        // Если регистрация закрыта - показываем сообщение
        if (!data.isOpen) {
            container.innerHTML = `
                <div style="padding: 20px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 12px; color: white; text-align: center;">
                    <div style="font-size: 20px; font-weight: 700;">⏱️ Регистрация закрыта</div>
                </div>
            `;
            container.style.display = 'block';
            return;
        }
        
        // Если нет дедлайна - показываем что регистрация открыта
        if (!data.closesAt) {
            container.innerHTML = `
                <div style="padding: 20px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 12px; color: white; text-align: center;">
                    <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">✅ Регистрация открыта</div>
                    <div style="font-size: 14px; opacity: 0.9;">Время закрытия не установлено. Подавайте заявки!</div>
                </div>
            `;
            container.style.display = 'block';
            return;
        }
        
        const deadline = new Date(data.closesAt);
        
        // Функция обновления таймера
        function updateCountdown() {
            const now = new Date();
            const diff = deadline - now;
            
            if (diff <= 0) {
                container.innerHTML = `
                    <div style="padding: 20px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 12px; color: white; text-align: center;">
                        <div style="font-size: 20px; font-weight: 700;">⏱️ Регистрация закрыта</div>
                    </div>
                `;
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            const milliseconds = Math.floor((diff % 1000) / 10); // Показываем в сотых долях
            
            container.innerHTML = `
                <div style="padding: 28px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 16px; color: white; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);">
                    <div style="text-align: center; margin-bottom: 16px;">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">⏰ Регистрация закрывается через</div>
                        <div style="font-size: 12px; opacity: 0.8;">${deadline.toLocaleString('ru-RU')}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                        <div style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 16px; text-align: center; backdrop-filter: blur(10px);">
                            <div style="font-size: 32px; font-weight: 700; line-height: 1; margin-bottom: 8px;">${days}</div>
                            <div style="font-size: 12px; opacity: 0.9; font-weight: 600;">Дней</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 16px; text-align: center; backdrop-filter: blur(10px);">
                            <div style="font-size: 32px; font-weight: 700; line-height: 1; margin-bottom: 8px;">${hours.toString().padStart(2, '0')}</div>
                            <div style="font-size: 12px; opacity: 0.9; font-weight: 600;">Часов</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 16px; text-align: center; backdrop-filter: blur(10px);">
                            <div style="font-size: 32px; font-weight: 700; line-height: 1; margin-bottom: 8px;">${minutes.toString().padStart(2, '0')}</div>
                            <div style="font-size: 12px; opacity: 0.9; font-weight: 600;">Минут</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 16px; text-align: center; backdrop-filter: blur(10px);">
                            <div style="font-size: 32px; font-weight: 700; line-height: 1; margin-bottom: 8px;">${seconds.toString().padStart(2, '0')}</div>
                            <div style="font-size: 10px; opacity: 0.7; margin-top: 4px;">.${milliseconds.toString().padStart(2, '0')}</div>
                            <div style="font-size: 12px; opacity: 0.9; font-weight: 600; margin-top: 2px;">Секунд</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        container.style.display = 'block';
        updateCountdown();
        
        // Обновляем каждые 50 мс для плавности
        const intervalId = setInterval(updateCountdown, 50);
        
        // Сохраняем ID интервала для очистки при навигации
        if (!window.tournamentCountdownIntervals) {
            window.tournamentCountdownIntervals = [];
        }
        window.tournamentCountdownIntervals.push(intervalId);
        
    } catch (error) {
        console.error('Load countdown error:', error);
    }
}

// Очистка интервалов при выходе со страницы
window.addEventListener('hashchange', () => {
    if (window.tournamentCountdownIntervals) {
        window.tournamentCountdownIntervals.forEach(id => clearInterval(id));
        window.tournamentCountdownIntervals = [];
    }
});

async function loadTournamentStatus() {
    try {
        const authData = getAuthData();
        const response = await fetch('/api/tournament/status', {
            headers: { 'Authorization': `Bearer ${authData.token}` }
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        // Проверяем статус регистрации ПЕРВЫМ делом
        const formContainer = document.getElementById('tournament-form-container');
        if (formContainer) {
            const form = document.getElementById('tournament-application-form');
            
            // Если регистрация закрыта - скрываем форму независимо от статуса заявки
            if (!data.registrationOpen) {
                if (form) form.style.display = 'none';
                
                const closesAtText = data.closesAt ? 
                    `Регистрация закрыта до ${new Date(data.closesAt).toLocaleString('ru-RU')}` : 
                    'Регистрация закрыта';
                
                formContainer.innerHTML = `
                    <div style="padding: 24px; background: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3); text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
                        <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: var(--danger);">
                            Регистрация закрыта
                        </h3>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                            ${closesAtText}
                        </p>
                    </div>
                `;
                return; // Прекращаем дальнейшую обработку
            }
            
            // Если заявка уже подана, показываем статус
            if (data.hasApplication) {
                const statusMessages = {
                    'pending': '⏳ Ожидание рассмотрения',
                    'approved': '✅ Заявка одобрена',
                    'rejected': '❌ Заявка отклонена'
                };
                
                const statusText = statusMessages[data.application.status] || 'Неизвестный статус';
                
                // Если заявка одобрена или отклонена - показываем форму для создания новой
                if (data.application.status === 'approved' || data.application.status === 'rejected') {
                    // Сохраняем HTML формы если она есть
                    let formHTML = '';
                    if (form) {
                        formHTML = form.outerHTML;
                    }
                    
                    // Создаем новый контент с статусом и формой
                    formContainer.innerHTML = `
                        <div style="padding: 24px; background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); text-align: center; margin-bottom: 24px;">
                            <div style="font-size: 48px; margin-bottom: 16px;">${data.application.status === 'approved' ? '✅' : '❌'}</div>
                            <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: var(--text-primary);">
                                ${statusText}
                            </h3>
                            <p style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 14px;">
                                Steam ID: <strong>${data.application.steam_id}</strong>
                            </p>
                            <p style="margin: 0 0 16px 0; color: var(--text-secondary); font-size: 12px;">
                                Подана: ${new Date(data.application.created_at).toLocaleString('ru-RU')}
                            </p>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 13px; padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 8px;">
                                💡 Вы можете создать новую заявку ниже
                            </p>
                        </div>
                        ${formHTML}
                    `;
                    
                    // Переустанавливаем обработчик формы
                    setTimeout(() => {
                        setupTournamentFormHandler();
                    }, 100);
                } else {
                    // Если pending - скрываем форму
                    if (form) form.style.display = 'none';
                    
                    formContainer.innerHTML = `
                        <div style="padding: 24px; background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
                            <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: var(--text-primary);">
                                ${statusText}
                            </h3>
                            <p style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 14px;">
                                Steam ID: <strong>${data.application.steam_id}</strong>
                            </p>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 12px;">
                                Подана: ${new Date(data.application.created_at).toLocaleString('ru-RU')}
                            </p>
                        </div>
                    `;
                }
            }
        }
        
        // Если регистрация закрыта и нет заявки, показываем сообщение (fallback)
        if (!data.registrationOpen && !data.hasApplication) {
            const formContainer = document.getElementById('tournament-form-container');
            if (formContainer) {
                const form = document.getElementById('tournament-application-form');
                if (form) form.style.display = 'none';
                
                const closesAtText = data.closesAt ? 
                    `Регистрация закрыта до ${new Date(data.closesAt).toLocaleString('ru-RU')}` : 
                    'Регистрация закрыта';
                
                formContainer.innerHTML = `
                    <div style="padding: 24px; background: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3); text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
                        <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: var(--danger);">
                            Регистрация закрыта
                        </h3>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                            ${closesAtText}
                        </p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Load tournament status error:', error);
    }
}

function showTournamentStatus(type, message) {
    const statusDiv = document.getElementById('tournament-status-message');
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    statusDiv.style.padding = '16px';
    statusDiv.style.borderRadius = '8px';
    
    if (type === 'success') {
        statusDiv.style.background = 'rgba(34, 197, 94, 0.1)';
        statusDiv.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        statusDiv.style.color = '#22c55e';
    } else {
        statusDiv.style.background = 'rgba(239, 68, 68, 0.1)';
        statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        statusDiv.style.color = '#ef4444';
    }
    
    statusDiv.textContent = message;
}

// ============================================
// TOURNAMENT ADMIN PANEL
// ============================================

async function loadTournamentAdminPanel() {
    const container = document.getElementById('tournament-admin-container');
    if (!container) return;
    
    try {
        const authData = getAuthData();
        if (!authData || !isAdmin(authData)) {
            container.innerHTML = '<p style="color: var(--danger);">⛔ Доступ запрещен</p>';
            return;
        }
        
        // Загружаем настройки и заявки
        const [settingsRes, applicationsRes] = await Promise.all([
            fetch('/api/tournament/settings', {
                headers: { 'Authorization': `Bearer ${authData.token}` }
            }),
            fetch('/api/tournament/applications', {
                headers: { 'Authorization': `Bearer ${authData.token}` }
            })
        ]);
        
        const settingsData = await settingsRes.json();
        const applicationsData = await applicationsRes.json();
        
        const settings = settingsData.settings || { is_open: true, closes_at: null };
        const applications = applicationsData.applications || [];
        
        // Формируем HTML
        container.innerHTML = `
            <div style="display: grid; gap: 24px;">
                <!-- Настройки регистрации -->
                <div style="background: var(--bg-card); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
                    <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: var(--text-primary);">
                        ⚙️ Управление регистрацией
                    </h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <input 
                                type="checkbox" 
                                id="tournament-registration-open" 
                                ${settings.is_open ? 'checked' : ''}
                                style="width: 20px; height: 20px; cursor: pointer;"
                            >
                            <label for="tournament-registration-open" style="font-weight: 600; color: var(--text-primary); cursor: pointer;">
                                Регистрация открыта
                            </label>
                        </div>
                        
                        <div id="tournament-close-time-container" style="${settings.is_open ? 'display: none;' : ''}">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                                Закрыть до (необязательно)
                            </label>
                            <input 
                                type="datetime-local" 
                                id="tournament-close-time" 
                                value="${settings.closes_at ? new Date(settings.closes_at).toISOString().slice(0, 16) : ''}"
                                style="width: 100%; padding: 10px 12px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 8px; font-size: 14px; color: var(--text-primary);"
                            >
                        </div>
                        
                        <button 
                            id="save-tournament-settings-btn"
                            style="padding: 12px 24px; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.transform='translateY(-2px)'"
                            onmouseout="this.style.transform='translateY(0)'"
                        >
                            💾 Сохранить настройки
                        </button>
                    </div>
                </div>
                
                <!-- Список заявок -->
                <div style="background: var(--bg-card); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color);">
                    <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: var(--text-primary);">
                        📋 Заявки на турнир (${applications.length})
                    </h3>
                    
                    <div id="tournament-applications-list" style="display: flex; flex-direction: column; gap: 12px;">
                        ${applications.length === 0 ? 
                            '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Заявок пока нет</p>' :
                            applications.map(app => {
                                const statusColors = {
                                    'pending': 'rgba(251, 191, 36, 0.2)',
                                    'approved': 'rgba(34, 197, 94, 0.2)',
                                    'rejected': 'rgba(239, 68, 68, 0.2)'
                                };
                                const statusTexts = {
                                    'pending': '⏳ Ожидание',
                                    'approved': '✅ Одобрено',
                                    'rejected': '❌ Отклонено'
                                };
                                const createdDate = new Date(app.created_at).toLocaleString('ru-RU');
                                const user = app.users || {};
                                
                                return `
                                    <div style="padding: 16px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                                        <div style="display: flex; justify-content: space-between; align-items: start; gap: 16px;">
                                            <div style="flex: 1;">
                                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                                    <strong style="color: var(--text-primary);">${user.discord_username || user.username || 'Неизвестно'}</strong>
                                                    <span style="padding: 4px 12px; background: ${statusColors[app.status] || statusColors.pending}; border-radius: 6px; font-size: 12px; font-weight: 600; color: var(--text-primary);">
                                                        ${statusTexts[app.status] || app.status}
                                                    </span>
                                                </div>
                                                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary);">
                                                    <div>🆔 Discord ID: <code>${app.discord_id}</code></div>
                                                    <div>🎮 Steam ID: <code>${app.steam_id}</code></div>
                                                    <div>📅 Подана: ${createdDate}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')
                        }
                    </div>
                </div>
            </div>
        `;
        
        // Обработчики событий
        const openCheckbox = document.getElementById('tournament-registration-open');
        const closeTimeContainer = document.getElementById('tournament-close-time-container');
        const saveBtn = document.getElementById('save-tournament-settings-btn');
        
        if (openCheckbox) {
            openCheckbox.addEventListener('change', (e) => {
                if (closeTimeContainer) {
                    closeTimeContainer.style.display = e.target.checked ? 'none' : 'block';
                }
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const isOpen = openCheckbox.checked;
                const closesAt = isOpen ? null : (document.getElementById('tournament-close-time')?.value || null);
                
                saveBtn.disabled = true;
                saveBtn.textContent = 'Сохранение...';
                
                try {
                    const response = await fetch('/api/tournament/settings', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authData.token}`
                        },
                        body: JSON.stringify({
                            isOpen,
                            closesAt: closesAt ? new Date(closesAt).toISOString() : null
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showToast('✅ Настройки сохранены', 'success');
                        loadTournamentAdminPanel();
                    } else {
                        throw new Error(data.error || 'Ошибка сохранения');
                    }
                } catch (error) {
                    showToast(`Ошибка: ${error.message}`);
                    saveBtn.disabled = false;
                    saveBtn.textContent = '💾 Сохранить настройки';
                }
            });
        }
        
    } catch (error) {
        console.error('Load tournament admin panel error:', error);
        if (container) {
            container.innerHTML = `<p style="color: var(--danger);">Ошибка загрузки: ${error.message}</p>`;
        }
    }
}

// ================= API TOKENS (USER) =================
// Локальное хранилище токенов (key -> token value)
function getStoredTokens(){
    try {
        const stored = localStorage.getItem('api_tokens_store');
        return stored ? JSON.parse(stored) : {};
    } catch(e) { return {}; }
}

function saveTokenToStorage(tokenId, tokenValue){
    try {
        const store = getStoredTokens();
        store[tokenId] = tokenValue;
        localStorage.setItem('api_tokens_store', JSON.stringify(store));
    } catch(e) { console.error('Failed to save token:', e); }
}

function getTokenFromStorage(tokenId){
    const store = getStoredTokens();
    return store[tokenId] || null;
}

async function loadApiTokens(){
    try{
        const auth = getAuthData();
        if(!auth){ return; }
        const listRes = await fetch('/api/api-tokens/mine', { headers: { 'Authorization': `Bearer ${auth.token}` }});
        const listData = listRes.ok ? await listRes.json() : { items: [] };
        const container = document.getElementById('api-tokens-container');
        if(!container) return;
        const items = listData.items || [];
        if(items.length === 0){ container.innerHTML = `<div style="color:var(--text-secondary)">Токенов нет. Создайте первый токен.</div>`; }
        else {
            container.innerHTML = items.map(t => {
                const storedToken = getTokenFromStorage(t.id);
                const hasStoredToken = !!storedToken;
                return `
                <div style=\"display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border-color);border-radius:8px;padding:10px;margin:8px 0;background:var(--bg-card)\">
                  <div style=\"display:flex;flex-direction:column;gap:4px\">
                    <div style=\"font-weight:700\">${escapeHtml(t.name)}</div>
                    <div style=\"color:var(--text-secondary);font-size:12px\">Создан: ${new Date(t.created_at).toLocaleString()} • Вызовов: ${t.calls}</div>
                  </div>
                  <div style=\"display:flex;gap:8px;align-items:center\">
                    <span style=\"font-family:monospace;color:var(--text-secondary)\">••••••••••••••••••••</span>
                    ${hasStoredToken ? `<button class=\"btn btn-sm\" onclick=\"copyStoredToken('${t.id}')\" title=\"Скопировать токен\">📋 Копировать</button>` : ''}
                    <button class=\"btn btn-danger btn-sm\" onclick=\"revokeToken('${t.id}')\">Отозвать</button>
                  </div>
                </div>`;
            }).join('');
        }
        const createBtn = document.getElementById('api-create-btn');
        if(createBtn){
            createBtn.onclick = async ()=>{
                createBtn.disabled = true;
                const r = await fetch('/api/api-tokens', { method:'POST', headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ name:'Figma Plugin' }) });
                createBtn.disabled = false;
                if(!r.ok){ alert('Не удалось создать токен'); return; }
                const d = await r.json();
                // Сохраняем токен локально
                saveTokenToStorage(d.id, d.token);
                const box = document.getElementById('api-new-token');
                const inp = document.getElementById('api-new-token-input');
                inp.value = d.token;
                box.style.display = 'block';
                loadApiTokens();
            };
        }
    }catch(e){ console.error(e); }
}

window.copyStoredToken = function(tokenId){
    const token = getTokenFromStorage(tokenId);
    if(!token){
        alert('Токен не найден в локальном хранилище. Создайте новый токен.');
        return;
    }
    navigator.clipboard.writeText(token).then(() => {
        showToast('Токен скопирован!', 'success');
    }).catch(() => {
        alert('Не удалось скопировать токен');
    });
}

window.revokeToken = async function(id){
    const auth = getAuthData();
    if(!auth) return;
    if(!confirm('Отозвать токен?')) return;
    const r = await fetch(`/api/api-tokens/${id}`, { method:'DELETE', headers: { 'Authorization': `Bearer ${auth.token}` }});
    if(!r.ok){ alert('Ошибка'); return; }
    // Удаляем токен из локального хранилища
    try {
        const store = getStoredTokens();
        delete store[id];
        localStorage.setItem('api_tokens_store', JSON.stringify(store));
    } catch(e) {}
    loadApiTokens();
}

// ==========================================
// API ANALYTICS
// ==========================================
let apiActivityChart = null;

async function loadAPIAnalytics() {
    try {
        console.log('📊 Loading API analytics...');
        
        // Check API health
        const healthResponse = await fetch('/api/health');
        const health = await healthResponse.json();
        
        // Update status indicator
        const statusEl = document.getElementById('api-status');
        if (statusEl) {
            statusEl.textContent = health.status === 'ok' ? '✅' : '❌';
            statusEl.style.color = health.status === 'ok' ? 'var(--success)' : 'var(--danger)';
        }
        
        // Get user activity stats (for uploads/downloads)
        try {
            const authData = getAuthData();
            if (authData && authData.token) {
                const activityResponse = await fetch('/api/user/activity', {
                    headers: {
                        'Authorization': `Bearer ${authData.token}`
                    }
                });
                
                if (activityResponse.ok) {
                    const activityData = await activityResponse.json();
                    const actions = activityData.actions || [];
                    
                    // Count uploads
                    const uploadCount = actions.filter(a => a.action_type === 'map_upload' || a.action_type === 'image_upload').length;
                    const viewCount = actions.filter(a => a.action_type === 'map_download' || a.action_type === 'image_view').length;
                    
                    const apiTotalUploads = document.getElementById('api-total-uploads');
                    const apiTotalViews = document.getElementById('api-total-views');
                    if (apiTotalUploads) apiTotalUploads.textContent = uploadCount;
                    if (apiTotalViews) apiTotalViews.textContent = viewCount;
                    
                    // Prepare chart data (last 30 days)
                    const chartData = prepareAPIChartData(actions);
                    renderAPIChart(chartData);
                } else {
                    console.warn('Could not load user activity');
                    // Show mock data
                    renderMockAPIChart();
                }
            } else {
                // Not logged in - show mock data
                renderMockAPIChart();
            }
        } catch (err) {
            console.error('Error loading user activity:', err);
            renderMockAPIChart();
        }
        
    } catch (error) {
        console.error('Error loading API analytics:', error);
        // Show error state
        const apiStatus = document.getElementById('api-status');
        if (apiStatus) {
            apiStatus.textContent = '❌';
            apiStatus.style.color = 'var(--danger)';
        }
    }
}

function prepareAPIChartData(actions) {
    const last30Days = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        last30Days.push({
            date: date.toISOString().split('T')[0],
            uploads: 0,
            views: 0
        });
    }
    
    // Count actions by day
    actions.forEach(action => {
        const actionDate = new Date(action.created_at).toISOString().split('T')[0];
        const dayData = last30Days.find(d => d.date === actionDate);
        if (dayData) {
            if (action.action_type === 'map_upload' || action.action_type === 'image_upload') {
                dayData.uploads++;
            } else if (action.action_type === 'map_download' || action.action_type === 'image_view') {
                dayData.views++;
            }
        }
    });
    
    return last30Days;
}

function renderAPIChart(data) {
    const canvas = document.getElementById('api-activity-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (apiActivityChart) {
        apiActivityChart.destroy();
    }
    
    // Get CSS variables
    const styles = getComputedStyle(document.documentElement);
    const primaryColor = styles.getPropertyValue('--accent-primary').trim();
    const secondaryColor = styles.getPropertyValue('--accent-secondary').trim();
    const textColor = styles.getPropertyValue('--text-primary').trim();
    const gridColor = styles.getPropertyValue('--border-color').trim();
    
    apiActivityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            }),
            datasets: [
                {
                    label: 'Загрузки',
                    data: data.map(d => d.uploads),
                    borderColor: primaryColor,
                    backgroundColor: primaryColor + '20',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.5,
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'Просмотры',
                    data: data.map(d => d.views),
                    borderColor: secondaryColor,
                    backgroundColor: secondaryColor + '20',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.5,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: {
                        color: textColor,
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor, drawBorder: false },
                    ticks: {
                        color: textColor,
                        stepSize: 1,
                        font: { size: 11 }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function renderMockAPIChart() {
    // Generate mock data for demonstration
    const mockData = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        mockData.push({
            date: date.toISOString().split('T')[0],
            uploads: Math.floor(Math.random() * 5),
            views: Math.floor(Math.random() * 15)
        });
    }
    
    const apiTotalUploads = document.getElementById('api-total-uploads');
    const apiTotalViews = document.getElementById('api-total-views');
    if (apiTotalUploads) apiTotalUploads.textContent = mockData.reduce((sum, d) => sum + d.uploads, 0);
    if (apiTotalViews) apiTotalViews.textContent = mockData.reduce((sum, d) => sum + d.views, 0);
    
    renderAPIChart(mockData);
}

// Initialize API analytics when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, открыта ли страница API
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'page-api') {
                const display = window.getComputedStyle(mutation.target).display;
                if (display !== 'none') {
                    loadAPIAnalytics();
                }
            }
        });
    });
    
    const apiPage = document.getElementById('page-api');
    if (apiPage) {
        observer.observe(apiPage, { attributes: true, attributeFilter: ['style'] });
        
        // Загружаем сразу если страница уже открыта
        if (window.getComputedStyle(apiPage).display !== 'none') {
            loadAPIAnalytics();
        }
    }
});

