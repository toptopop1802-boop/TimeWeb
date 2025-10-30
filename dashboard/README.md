# DS Bot Dashboard

Discord Bot Analytics Dashboard с хостингом карт.

## 🚀 Деплой на Vercel

### Подготовка

1. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/toptopop1802-boop/BublicRust.git
   cd BublicRust
   ```

2. **Установите зависимости:**
   ```bash
   npm install
   ```

3. **Настройте Supabase:**

   ### Шаг 1: Создайте таблицу
   - Откройте Supabase Dashboard -> SQL Editor
   - Выполните SQL из файла `setup_maps_storage.sql`

   ### Шаг 2: Создайте Storage Bucket
   - Откройте Supabase Dashboard -> Storage
   - Нажмите "New bucket"
   - Имя: `maps`
   - Public: `false` (приватный bucket)
   - File size limit: 100MB (или больше, если нужно)
   - Allowed MIME types: оставьте пустым или добавьте `application/octet-stream`

   ### Шаг 3: Настройте политики доступа (опционально)
   - В Storage -> Policies для bucket `maps`
   - Можно оставить без политик, если используете Service Role Key
   - Или создать политику для чтения/записи файлов

4. **Настройте переменные окружения в Vercel:**
   - `SUPABASE_URL` - URL вашего Supabase проекта
   - `SUPABASE_KEY` - Service Role Key (для Storage операций)
   - `DISCORD_BOT_TOKEN` - токен Discord бота (опционально)
   - `PORT` - порт (не обязателен для Vercel)

### Деплой

1. Подключите репозиторий к Vercel через GitHub
2. Vercel автоматически определит настройки из `vercel.json`
3. Добавьте переменные окружения в Vercel Dashboard
4. Деплой запустится автоматически

## 📁 Структура проекта

```
dashboard/
├── api/
│   └── index.js          # Vercel serverless entry point
├── public/
│   ├── index.html        # Главная страница
│   ├── app.js            # Клиентский JavaScript
│   └── style.css         # Стили
├── server.js             # Express сервер
├── vercel.json           # Конфигурация Vercel
├── setup_maps_storage.sql # SQL для создания таблицы maps
└── package.json          # Зависимости
```

## 🔧 Локальная разработка

```bash
npm install
npm run dev
```

Сервер запустится на `http://localhost:3000`

## 📝 Особенности

- ✅ Работает на Vercel (serverless)
- ✅ Хостинг карт через Supabase Storage
- ✅ Метаданные в Supabase Database
- ✅ Прямые ссылки на скачивание
- ✅ Drag & Drop загрузка файлов
- ✅ Темная тема в стиле Discord

## 🔐 Переменные окружения

См. `env.example` для примера конфигурации.
