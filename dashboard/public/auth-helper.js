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
        
        // Перенаправить на карты если пытается открыть админ-страницу
        const hash = window.location.hash;
        if (hash === '#analytics' || hash === '#messages' || hash === '#channels' || hash === '#admin' || hash === '#members') {
            console.warn('⛔ Доступ запрещен. Требуются права администратора.');
            window.location.hash = '#maps';
        }
    }
    
    // Установить обработчик для проверки при смене хеша
    window.addEventListener('hashchange', () => {
        if (!isAdmin(authData)) {
            const hash = window.location.hash;
            if (hash === '#analytics' || hash === '#messages' || hash === '#channels' || hash === '#admin' || hash === '#members') {
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
function displayUserInfo(authData) {
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
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
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
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 14px;">${displayName}</div>
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
                min-width: 280px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                z-index: 1000;
            ">
                <div style="padding: 12px; border-bottom: 1px solid var(--border-color); margin-bottom: 10px;">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${displayName}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${authData.user.email || 'Локальный пользователь'}</div>
                </div>
                
                <div style="padding: 8px 0;">
                    <button onclick="showUserActions()" style="
                        width: 100%;
                        padding: 10px 12px;
                        background: transparent;
                        color: var(--text-primary);
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        text-align: left;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                        <span style="font-size: 18px;">📊</span>
                        <span>Моя активность</span>
                    </button>
                    
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

// Показать историю действий пользователя
async function showUserActions() {
    const authData = getAuthData();
    if (!authData) return;
    
    try {
        const response = await fetch('/api/user/actions', {
            headers: { 'Authorization': `Bearer ${authData.token}` }
        });
        
        const actions = await response.json();
        
        // Создаем модальное окно с историей
        let modal = document.getElementById('user-actions-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'user-actions-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            `;
            
            modal.innerHTML = `
                <div style="
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 30px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="margin: 0; color: var(--text-primary);">📊 Моя активность</h3>
                        <button onclick="closeUserActionsModal()" style="
                            background: transparent;
                            border: none;
                            color: var(--text-secondary);
                            font-size: 24px;
                            cursor: pointer;
                            width: 32px;
                            height: 32px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 8px;
                        ">×</button>
                    </div>
                    <div id="user-actions-list"></div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
        
        // Отображаем действия
        const actionsList = document.getElementById('user-actions-list');
        if (actions.length === 0) {
            actionsList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px 0;">Пока нет действий</p>';
        } else {
            actionsList.innerHTML = actions.map(action => {
                const actionIcons = {
                    'map_upload': '⬆️',
                    'map_download': '⬇️',
                    'map_delete': '🗑️',
                    'login': '🔓',
                    'logout': '🔒'
                };
                
                const actionNames = {
                    'map_upload': 'Загрузка карты',
                    'map_download': 'Скачивание карты',
                    'map_delete': 'Удаление карты',
                    'login': 'Вход в систему',
                    'logout': 'Выход из системы'
                };
                
                const date = new Date(action.created_at);
                return `
                    <div style="
                        padding: 12px;
                        background: var(--bg-secondary);
                        border-radius: 8px;
                        margin-bottom: 8px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    ">
                        <span style="font-size: 24px;">${actionIcons[action.action_type] || '📝'}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary);">${actionNames[action.action_type] || action.action_type}</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">${date.toLocaleString('ru-RU')}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        modal.style.display = 'flex';
        toggleUserMenu(); // Закрываем dropdown
    } catch (error) {
        console.error('Failed to load user actions:', error);
        alert('Не удалось загрузить историю действий');
    }
}

function closeUserActionsModal() {
    const modal = document.getElementById('user-actions-modal');
    if (modal) {
        modal.style.display = 'none';
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
window.showUserActions = showUserActions;
window.closeUserActionsModal = closeUserActionsModal;

