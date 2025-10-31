# 🔧 Исправление ошибок сервера и базы данных

## Исправленные проблемы:

### ✅ 1. Ошибка регистрации: `duplicate key value violates unique constraint "users_username_key"`

**Причина:** Race condition - несколько запросов пытались создать пользователя с одинаковым именем одновременно.

**Исправление:**
- Добавлена проверка существующего пользователя перед вставкой
- Добавлена обработка ошибки дубликата (код `23505`)
- Улучшено логирование ошибок

### ✅ 2. База данных карт и изображений

**Проблема:** Метаданные изображений не сохранялись в базу данных.

**Исправление:**
- Добавлено сохранение метаданных в таблицу `images_metadata`
- Добавлено логирование действий пользователя
- Создан SQL файл для таблицы метаданных

---

## 🚀 Применить на сервере:

```bash
# 1. Подключитесь к серверу
ssh root@bublickrust.ru

# 2. Перейдите в папку проекта
cd /root/dsbot

# 3. Получите последние изменения
git pull origin main

# 4. Примените SQL для создания таблицы images_metadata
# В Supabase Dashboard → SQL Editor → New query
```

Скопируйте и выполните SQL из файла `dashboard/setup_images_metadata.sql`:

```sql
-- Таблица метаданных изображений
CREATE TABLE IF NOT EXISTS images_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    short_code TEXT NOT NULL UNIQUE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_images_metadata_user_id ON images_metadata (user_id);
CREATE INDEX IF NOT EXISTS idx_images_metadata_short_code ON images_metadata (short_code);
CREATE INDEX IF NOT EXISTS idx_images_metadata_created_at ON images_metadata (created_at DESC);
```

```bash
# 5. Перезапустите dashboard
cd dashboard
pm2 restart dsbot

# 6. Проверьте логи
pm2 logs dsbot --lines 100
```

---

## 🔍 Проверка работы:

### 1. Регистрация пользователей

Попробуйте зарегистрироваться с тем же именем дважды:

**Ожидаемое поведение:**
- Первый раз: ✅ Регистрация успешна
- Второй раз: ❌ "Это имя уже занято. Попробуйте другое имя."

**В логах сервера:**
```
✅ New user created: username
```

или

```
⚠️  User exists with password: username
```

### 2. Загрузка изображений

Загрузите изображение через Figma плагин или тестовую страницу.

**Ожидаемое поведение:**
- ✅ Изображение загружено
- ✅ Метаданные сохранены в базу
- ✅ Получен short_code и directUrl

**В логах сервера:**
```
📤 [Image Upload] Request received
   ✅ Authenticated as: username
   ✅ Image metadata saved: ABC1234
   🎉 Upload complete: https://bublickrust.ru/i/ABC1234
```

### 3. Проверка базы данных

В Supabase Dashboard → Table Editor:

**Таблица `images_metadata`:**
- Должны быть записи с загруженными изображениями
- Столбцы: `image_id`, `user_id`, `short_code`, `original_name`, `file_size`

**Таблица `user_actions`:**
- Должны быть записи с типом `image_upload`

---

## 📊 Мониторинг ошибок

После применения исправлений следите за логами:

```bash
# Следить за логами в реальном времени
pm2 logs dsbot

# Показать последние 200 строк
pm2 logs dsbot --lines 200

# Поиск ошибок
pm2 logs dsbot --lines 500 | grep "❌"
```

---

## ⚠️ Если проблема осталась:

### Проблема 1: Ошибка "duplicate key" всё ещё появляется

**Возможная причина:** В базе есть "зомби" пользователи с пустым `password_hash`.

**Решение:** Удалите дубликаты или обновите их:

```sql
-- Проверить дубликаты
SELECT username, COUNT(*) 
FROM users 
GROUP BY username 
HAVING COUNT(*) > 1;

-- Удалить дубликаты с пустым паролем (если есть)
DELETE FROM users 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM users 
    GROUP BY username
);
```

### Проблема 2: Изображения не загружаются

**Проверьте:**

1. **Bucket "images" существует** в Supabase Storage
2. **Права доступа** на bucket:
   ```
   Policy: Allow public read access
   SELECT: Enable for public
   ```
3. **Таблица `images_metadata` создана** (см. SQL выше)

### Проблема 3: Таблица `images_metadata` не создаётся

**Ошибка:** `relation "images_metadata" does not exist`

**Решение:**
1. Откройте Supabase Dashboard
2. Перейдите в SQL Editor
3. Скопируйте весь SQL из `dashboard/setup_images_metadata.sql`
4. Выполните запрос
5. Проверьте что таблица появилась в Table Editor

---

## 🎯 Ожидаемый результат:

После применения всех исправлений:

✅ Регистрация работает без ошибок duplicate key  
✅ Изображения сохраняются в Storage и в базу  
✅ Карты загружаются корректно  
✅ Все действия логируются в `user_actions`  
✅ Детальные логи в консоли для отладки  

---

## 📞 Если нужна помощь:

Отправьте логи сервера:

```bash
pm2 logs dsbot --lines 200 > server_logs.txt
cat server_logs.txt
```

