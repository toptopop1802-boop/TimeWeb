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

// Проверить авторизацию (редирект на login если не авторизован, или создать гостевую сессию)
async function requireAuth(autoGuest = true) {
    const authData = getAuthData();
    
    if (!authData) {
        if (autoGuest) {
            // Автоматически входим как гость
            return await createGuestSession();
        } else {
            window.location.href = '/login.html';
            return null;
        }
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
        const autoDeleteNavBtn = document.querySelector('[data-page="auto-delete"]');
        if (autoDeleteNavBtn) {
            autoDeleteNavBtn.style.display = 'none';
        }
        
        // Перенаправить на карты если пытается открыть админ-страницу
        const hash = window.location.hash;
        if (hash === '#analytics' || hash === '#messages' || hash === '#auto-delete' || hash === '#admin') {
            window.location.hash = '#maps';
        }
    }
    
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
        
        const isGuest = authData.user.username.startsWith('guest_');
        const roleColor = isAdmin(authData) ? '#ef4444' : (isGuest ? '#a0a0a0' : '#10b981');
        const roleText = isAdmin(authData) ? 'Админ' : (isGuest ? 'Гость' : 'Пользователь');
        const displayName = isGuest ? 'Гость' : authData.user.username;
        
        userInfo.innerHTML = `
            <div style="text-align: right;">
                <div style="font-weight: 600; color: var(--text-primary);">${displayName}</div>
                <div style="font-size: 12px; color: ${roleColor};">${roleText}</div>
            </div>
            ${isGuest ? `
                <button onclick="window.location.href='/login.html'" style="
                    padding: 6px 12px;
                    background: var(--accent-primary);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-right: 5px;
                ">Войти</button>
            ` : ''}
            <button onclick="logout()" style="
                padding: 6px 12px;
                background: var(--danger);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 12px;
            ">Выход</button>
        `;
        
        header.appendChild(userInfo);
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

