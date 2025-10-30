# Настройка статистики записи на вайп

## 📊 Обзор

Система сохраняет все записи пользователей на вайп в отдельную таблицу `wipe_signup_stats` в базе данных Supabase. Это позволяет:

- ✅ Хранить историю всех записей на вайп
- 📈 Отображать статистику на дашборде
- 👥 Анализировать активность пользователей
- 📅 Строить графики по дням

## 🗄️ Структура базы данных

### Таблица: `wipe_signup_stats`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | BIGSERIAL | Уникальный ID записи (PRIMARY KEY) |
| `guild_id` | BIGINT | ID сервера Discord |
| `user_id` | BIGINT | ID пользователя Discord |
| `signup_type` | TEXT | Тип записи: `looking`, `ready`, `not_coming` |
| `player_count` | INTEGER | Количество игроков (для типа `looking`) |
| `message_content` | TEXT | Оригинальное содержимое сообщения |
| `created_at` | TIMESTAMP | Дата и время записи |

### Типы записей

- **`looking`** - Ищет игроков в команду (+1, +2, +3 и т.д.)
- **`ready`** - Готов зайти на вайп (зайду, иду, буду)
- **`not_coming`** - Не зайдёт на вайп (не зайду, пропущу, пас)

## 🚀 Установка

### 1. Создайте таблицу в Supabase

Выполните SQL-скрипт из файла `dashboard/setup_wipe_signup_stats.sql` в SQL-редакторе Supabase:

```sql
-- Откройте Supabase Dashboard → SQL Editor
-- Скопируйте содержимое файла setup_wipe_signup_stats.sql
-- Выполните скрипт (Run)
```

Скрипт создаст:
- ✅ Таблицу `wipe_signup_stats`
- ✅ Индексы для быстрого поиска
- ✅ Комментарии к таблице и полям

### 2. Проверьте создание таблицы

```sql
-- Проверка таблицы
SELECT * FROM wipe_signup_stats LIMIT 5;

-- Проверка индексов
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'wipe_signup_stats';
```

### 3. Перезапустите бота

После создания таблицы перезапустите Discord-бота:

```bash
# Linux/Mac
./start.sh

# Windows
.\start.ps1
```

## 📈 Использование на дашборде

### График активности

1. Откройте дашборд: `http://bublickrust.ru`
2. Перейдите на вкладку **"Аналитика"**
3. В разделе **"График активности"** выберите вкладку **"Запись на вайп"**

График покажет три линии:
- 💎 **Синяя** - Ищут игроков (looking)
- ✅ **Зелёная** - Готовы зайти (ready)
- ❌ **Красная** - Не зайдут (not_coming)

### API Endpoints

#### Получить статистику записи на вайп

```javascript
GET /api/wipe-signup-stats?days=30

Response:
{
  "looking_total": 45,          // Всего записей "ищет игроков"
  "looking_count": 78,          // Сумма всех слотов (+1, +2, +3)
  "ready_total": 123,           // Всего записей "готов зайти"
  "not_coming_total": 12,       // Всего записей "не зайду"
  "recent_signups": [           // Последние 50 записей
    {
      "type": "looking",
      "user_id": 123456789,
      "count": 2,
      "message_content": "+2",
      "created_at": "2025-10-30T12:00:00Z"
    }
  ],
  "timeline": [                 // Статистика по дням
    {
      "date": "2025-10-30",
      "looking": 5,
      "looking_count": 8,
      "ready": 12,
      "not_coming": 1
    }
  ],
  "total": 180
}
```

## 🔧 Методы database.py

### `save_wipe_signup()`

Сохраняет запись о записи на вайп:

```python
await bot.db.save_wipe_signup(
    guild_id=message.guild.id,
    user_id=message.author.id,
    signup_type="looking",  # 'looking', 'ready', 'not_coming'
    player_count=2,         # Для типа 'looking'
    message_content="+2"
)
```

### `get_wipe_signup_stats()`

Получает статистику за период:

```python
stats = await bot.db.get_wipe_signup_stats(
    guild_id=guild.id,
    days=30
)

# stats = {
#     "looking": 45,
#     "ready": 123,
#     "not_coming": 12,
#     "by_date": {...},
#     "total": 180
# }
```

### `get_user_wipe_signups()`

Получает записи конкретного пользователя:

```python
user_signups = await bot.db.get_user_wipe_signups(
    guild_id=guild.id,
    user_id=user.id,
    limit=10
)
```

## 📊 Примеры запросов

### Статистика за последние 7 дней

```sql
SELECT 
    DATE(created_at) as date,
    signup_type,
    COUNT(*) as count
FROM wipe_signup_stats
WHERE guild_id = YOUR_GUILD_ID
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), signup_type
ORDER BY date DESC;
```

### Топ-10 активных пользователей

```sql
SELECT 
    user_id,
    COUNT(*) as signup_count,
    COUNT(CASE WHEN signup_type = 'looking' THEN 1 END) as looking_count,
    COUNT(CASE WHEN signup_type = 'ready' THEN 1 END) as ready_count,
    COUNT(CASE WHEN signup_type = 'not_coming' THEN 1 END) as not_coming_count
FROM wipe_signup_stats
WHERE guild_id = YOUR_GUILD_ID
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY signup_count DESC
LIMIT 10;
```

### Средний размер команды (для типа 'looking')

```sql
SELECT 
    AVG(player_count) as avg_team_size,
    MIN(player_count) as min_team_size,
    MAX(player_count) as max_team_size
FROM wipe_signup_stats
WHERE guild_id = YOUR_GUILD_ID
  AND signup_type = 'looking'
  AND player_count IS NOT NULL;
```

## 🔍 Отладка

### Проверка последних записей

```sql
SELECT 
    id,
    user_id,
    signup_type,
    player_count,
    message_content,
    created_at
FROM wipe_signup_stats
ORDER BY created_at DESC
LIMIT 10;
```

### Подсчёт записей по типам

```sql
SELECT 
    signup_type,
    COUNT(*) as count
FROM wipe_signup_stats
WHERE guild_id = YOUR_GUILD_ID
GROUP BY signup_type;
```

## ⚠️ Важно

1. **Не удаляйте старые данные** - они используются для построения графиков и анализа
2. **Индексы** - созданы автоматически для оптимизации запросов
3. **Резервное копирование** - Supabase автоматически создаёт бэкапы
4. **Производительность** - таблица оптимизирована для больших объёмов данных

## 📝 Changelog

- **2025-10-30**: Создана таблица `wipe_signup_stats` и API endpoints
- Добавлена вкладка "Запись на вайп" в график активности дашборда
- Реализованы методы в `database.py` для работы с таблицей

