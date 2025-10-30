# 🔐 Инструкция по настройке системы авторизации

## Что было создано:

1. ✅ **SQL схема** - `setup_auth_system.sql`
2. ✅ **Auth middleware** - `dashboard/auth-middleware.js`  
3. ✅ **Auth API routes** - `dashboard/auth-routes.js`
4. ✅ **Обновлен package.json** - добавлены bcryptjs, cookie-parser

## 📋 Шаги установки:

### 1️⃣ Установите SQL схему в Supabase

```bash
# Откройте Supabase Dashboard
https://supabase.com/dashboard

# Перейдите в SQL Editor
# Скопируйте содержимое файла setup_auth_system.sql
# Вставьте и выполните
```

Это создаст:
- Таблицу `users` (пользователи)
- Таблицу `sessions` (сессии)
- Таблицу `maps_metadata` (метаданные карт с владельцами)
- Первого админа: `username=admin`, `password=admin123`

### 2️⃣ На сервере установите новые зависимости

```bash
cd /root/TimeWeb
git pull

cd dashboard
npm install bcryptjs cookie-parser
```

### 3️⃣ Что нужно доделать:

#### A. Интегрировать auth routes в server.js

После строки с Discord Client добавьте:

```javascript
// Setup Auth routes
setupAuthRoutes(app, supabase);
```

#### B. Обновить API `/api/maps/upload` для сохранения владельца

Добавить проверку auth и сохранение в `maps_metadata`:

```javascript
app.post('/api/maps/upload', upload.single('map'), async (req, res) => {
    // Требуется авторизация
    await requireAuth(req, res, async () => {
        // ... существующий код загрузки ...
        
        // После загрузки в Storage, сохраняем в БД:
        const shortCode = generateShortCode(mapId);
        
        await supabase
            .from('maps_metadata')
            .insert({
                user_id: req.user.id,
                map_id: mapId,
                original_name: originalName,
                file_size: req.file.size,
                storage_path: storagePath,
                short_code: shortCode
            });
    }, supabase);
});
```

#### C. Обновить `/api/maps` для фильтрации по владельцу

```javascript
app.get('/api/maps', async (req, res) => {
    await requireAuth(req, res, async () => {
        const { data: maps, error } = await supabase
            .from('maps_metadata')
            .select('*')
            // RLS автоматически фильтрует:
            // - для user: только свои карты
            // - для admin: все карты
            .order('uploaded_at', { ascending: false });
        
        res.json(maps);
    }, supabase);
});
```

#### D. Создать страницу входа/регистрации

Создать `dashboard/public/login.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Вход - DS Bot</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="login-container">
        <h1>Вход в систему</h1>
        <form id="login-form">
            <input type="text" name="username" placeholder="Логин" required>
            <input type="password" name="password" placeholder="Пароль" required>
            <button type="submit">Войти</button>
        </form>
        <p>Нет аккаунта? <a href="/register.html">Регистрация</a></p>
    </div>
    
    <script>
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                localStorage.setItem('auth_token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                window.location.href = '/';
            } else {
                alert(result.error);
            }
        });
    </script>
</body>
</html>
```

#### E. Обновить `app.js` для проверки авторизации

В начале файла:

```javascript
// Проверка авторизации
function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!token || !user) {
        window.location.href = '/login.html';
        return null;
    }
    
    return { token, user };
}

// Добавить токен ко всем запросам
const authData = checkAuth();
if (authData) {
    // Скрыть админ-кнопку для обычных пользователей
    if (authData.user.role !== 'admin') {
        document.querySelector('[data-page="admin"]')?.remove();
    }
}

// Обновить все fetch запросы:
fetch('/api/maps', {
    headers: {
        'Authorization': `Bearer ${authData.token}`
    }
})
```

---

## 🎯 Результат:

После настройки:
- ✅ Пользователи должны войти в систему
- ✅ Каждая карта привязана к владельцу
- ✅ Пользователь видит только свои карты
- ✅ Админ видит все карты
- ✅ Кнопка "Админ" видна только админам
- ✅ Разделы "Аналитика", "Сообщения", "Автоудаление" доступны только админам

---

## 👤 Первый вход:

```
Логин: admin
Пароль: admin123
```

**ОБЯЗАТЕЛЬНО смените пароль после первого входа!**

Перейдите в настройки профиля и измените пароль через API:
```bash
POST /api/auth/change-password
{
  "old_password": "admin123",
  "new_password": "ваш_новый_пароль"
}
```

---

## 📝 TODO:

Из-за размера изменений, я создал базовую структуру. Вам нужно:

1. ✅ Выполнить SQL скрипт в Supabase
2. ⏳ Интегрировать auth routes в server.js
3. ⏳ Обновить maps API для работы с БД
4. ⏳ Создать страницу входа/регистрации
5. ⏳ Обновить app.js для проверки авторизации

Хотите чтобы я продолжил и создал все необходимые файлы полностью?

