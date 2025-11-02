// Auth Helper - проверка авторизации и управление сессией

// Создать гостевую сессию
async function createGuestSession() {
    try {
        const response = await fetch('/api/auth/guest', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success && result.token) {
            localStorage.setItem('auth_token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            return { token: result.token, user: result.user };
        }
        
        // Если не удалось создать гостя, редиректим на login
        window.location.href = '/login.html';
        return null;
    } catch (error) {
        console.error('Failed to create guest session:', error);
        window.location.href = '/login.html';
        return null;
    }
}

// Получить данные авторизации
function getAuthData() {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        return null;
    }
    
    try {
        const user = JSON.parse(userStr);
        return { token, user };
    } catch (e) {
        return null;
    }
}

// Проверить авторизацию (редирект на login если не авторизован)
async function requireAuth() {
    const authData = getAuthData();
    
    if (!authData) {
        window.location.href = '/login.html';
        return null;
    }
    
    // Проверяем что токен валидный
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${authData.token}`
            }
        });
        
        if (!response.ok) {
            // Токен недействителен
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
            return null;
        }
        
        const data = await response.json();
        // Обновляем данные пользователя
        localStorage.setItem('user', JSON.stringify(data.user));
        
        return { token: authData.token, user: data.user };
    } catch (error) {
        console.error('Auth check failed:', error);
        return authData; // Возвращаем локальные данные если сервер недоступен
    }
}

// Проверить роль админа
function isAdmin(authData) {
    return authData && authData.user && authData.user.role === 'admin';
}

// Выход из системы
async function logout() {
    const authData = getAuthData();
    
    if (authData) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authData.token}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// Добавить токен авторизации ко всем fetch запросам
function fetchWithAuth(url, options = {}) {
    const authData = getAuthData();
    
    if (!authData) {
        throw new Error('Not authenticated');
    }
    
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${authData.token}`;
    
    return fetch(url, options);
}

// Показать/скрыть элементы в зависимости от роли
function setupRoleBasedUI(authData) {
    // Скрыть админ-элементы для обычных пользователей
    if (!isAdmin(authData)) {
        // Скрыть кнопку "Админ" в навигации
        const adminNavBtn = document.querySelector('[data-page="admin"]');
        if (adminNavBtn) {
            adminNavBtn.style.display = 'none';
        }
        
        // Скрыть раздел "Аналитика"
        const analyticsNavBtn = document.querySelector('[data-page="analytics"]');
        if (analyticsNavBtn) {
            analyticsNavBtn.style.display = 'none';
        }
        
        // Скрыть раздел "Сообщения"
        const messagesNavBtn = document.querySelector('[data-page="messages"]');
        if (messagesNavBtn) {
            messagesNavBtn.style.display = 'none';
        }
        
        // Скрыть раздел "Автоудаление"
        const channelsNavBtn = document.querySelector('[data-page="channels"]');
        if (channelsNavBtn) {
            channelsNavBtn.style.display = 'none';
        }

        // Скрыть раздел "Участники" (только для админа)
        const membersNavBtn = document.querySelector('[data-page="members"]');
        if (membersNavBtn) {
            membersNavBtn.style.display = 'none';
        }
        
        // "Хостинг фото" - доступен всем авторизованным пользователям (не скрываем)
        // Скрыть админ-линки, помеченные data-admin-only
        document.querySelectorAll('[data-admin-only="true"]').forEach(el=>{ el.style.display='none'; });
        
        // Перенаправить на карты если пытается открыть админ-страницу
        const hash = window.location.hash;
        if (hash === '#analytics' || hash === '#messages' || hash === '#channels' || hash === '#admin' || hash === '#members' || hash === '#server') {
            console.warn('⛔ Доступ запрещен. Требуются права администратора.');
            window.location.hash = '#maps';
        }
    }
    
    // Установить обработчик для проверки при смене хеша
    window.addEventListener('hashchange', () => {
        if (!isAdmin(authData)) {
            const hash = window.location.hash;
            if (hash === '#analytics' || hash === '#messages' || hash === '#channels' || hash === '#admin' || hash === '#members' || hash === '#server') {
                console.warn('⛔ Доступ запрещен. Требуются права администратора.');
                alert('Доступ запрещен. Требуются права администратора.');
                window.location.hash = '#maps';
            }
        }
    });
    
    // Показать информацию о пользователе
    displayUserInfo(authData);
}

// Отобразить информацию о пользователе
async function displayUserInfo(authData) {
    // Создаем элемент профиля в header если его нет
    const header = document.querySelector('.header');
    if (!header) return;
    
    // Проверяем существует ли уже
    let userInfo = header.querySelector('.user-info');
    
    if (!userInfo) {
        userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-left: auto;
            padding: 8px 16px;
            background: var(--bg-secondary);
            border-radius: 20px;
            cursor: pointer;
        `;
        
        const roleColor = isAdmin(authData) ? '#ef4444' : '#10b981';
        const roleText = isAdmin(authData) ? 'Админ' : 'Пользователь';
        const displayName = authData.user.username;
        const isDiscordUser = authData.user.email && authData.user.email.includes('@discord.user');
        
        // Загружаем статистику пользователя
        let userStats = { actions: 0, registrations: 0 };
        try {
            const statsResponse = await fetchWithAuth('/api/user/stats');
            if (statsResponse.ok) {
                userStats = await statsResponse.json();
            }
        } catch (e) {
            console.error('Failed to load user stats:', e);
        }
        
        // Градиенты для анимации
        const gradientColors = isAdmin(authData) 
            ? 'from: #ef4444, via: #dc2626, to: #991b1b' // Красный градиент для админа
            : 'from: #10b981, via: #059669, to: #047857'; // Зелёный градиент для пользователя
        
        const animationName = `rotate-gradient-${isAdmin(authData) ? 'admin' : 'user'}`;
        
        userInfo.innerHTML = `
            <style>
                @keyframes rotate-gradient-admin {
                    0% { background: conic-gradient(from 0deg, #ef4444, #dc2626, #991b1b, #ef4444); }
                    25% { background: conic-gradient(from 90deg, #ef4444, #dc2626, #991b1b, #ef4444); }
                    50% { background: conic-gradient(from 180deg, #ef4444, #dc2626, #991b1b, #ef4444); }
                    75% { background: conic-gradient(from 270deg, #ef4444, #dc2626, #991b1b, #ef4444); }
                    100% { background: conic-gradient(from 360deg, #ef4444, #dc2626, #991b1b, #ef4444); }
                }
                @keyframes rotate-gradient-user {
                    0% { background: conic-gradient(from 0deg, #10b981, #059669, #047857, #10b981); }
                    25% { background: conic-gradient(from 90deg, #10b981, #059669, #047857, #10b981); }
                    50% { background: conic-gradient(from 180deg, #10b981, #059669, #047857, #10b981); }
                    75% { background: conic-gradient(from 270deg, #10b981, #059669, #047857, #10b981); }
                    100% { background: conic-gradient(from 360deg, #10b981, #059669, #047857, #10b981); }
                }
                .avatar-container {
                    position: relative;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    padding: 3px;
                    animation: ${animationName} 4s linear infinite;
                }
                .avatar-inner {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: ${isDiscordUser ? 'linear-gradient(135deg, #5865F2, #4752C4)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 700;
                    font-size: 16px;
                }
            </style>
            <div onclick="toggleUserMenu()" style="
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                padding: 8px 12px;
                border-radius: 12px;
                transition: all 0.2s;
            " onmouseover="this.style.background='var(--bg-card)'" onmouseout="this.style.background='transparent'">
                <div style="text-align: right;">
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 14px; display: flex; align-items: center; gap: 6px;">
                        ${displayName}
                        ${isDiscordUser ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>' : ''}
                    </div>
                    <div style="font-size: 11px; color: ${roleColor};">${roleText}</div>
                </div>
                <div class="avatar-container">
                    <div class="avatar-inner">${displayName.charAt(0).toUpperCase()}</div>
                </div>
            </div>
            
            <!-- User Dropdown Menu -->
            <div id="user-dropdown" style="
                display: none;
                position: absolute;
                top: 70px;
                right: 20px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 12px;
                min-width: 320px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                z-index: 1000;
            ">
                <div style="padding: 12px; border-bottom: 1px solid var(--border-color); margin-bottom: 10px;">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        ${displayName}
                        ${isDiscordUser ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>' : ''}
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${isDiscordUser ? 'Discord пользователь' : authData.user.email || 'Локальный пользователь'}</div>
                </div>
                
                <!-- User Stats -->
                <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">Аналитика</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--accent-primary);" id="user-stats-actions">${userStats.actions || 0}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">Действий</div>
                        </div>
                        <div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--success);" id="user-stats-logins">${userStats.logins || 0}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">Входов</div>
                        </div>
                    </div>
                </div>
                
                <div style="padding: 8px 0;">
                    <button onclick="logout()" style="
                        width: 100%;
                        padding: 10px 12px;
                        background: transparent;
                        color: var(--danger);
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        text-align: left;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        transition: all 0.2s;
                        margin-top: 4px;
                    " onmouseover="this.style.background='rgba(255,71,87,0.1)'" onmouseout="this.style.background='transparent'">
                        <span style="font-size: 18px;">🚪</span>
                        <span>Выйти</span>
                    </button>
                </div>
            </div>
        `;
        
        header.appendChild(userInfo);
    }
}

// Переключить меню пользователя
function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

// Экспорт функций для глобального использования
window.createGuestSession = createGuestSession;
window.getAuthData = getAuthData;
window.requireAuth = requireAuth;
window.isAdmin = isAdmin;
window.logout = logout;
window.fetchWithAuth = fetchWithAuth;
window.setupRoleBasedUI = setupRoleBasedUI;
window.toggleUserMenu = toggleUserMenu;

