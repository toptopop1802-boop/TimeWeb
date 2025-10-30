# 🚀 Инструкция по деплою на Vercel

## Быстрый старт

1. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/toptopop1802-boop/BublicRust.git
   cd BublicRust/dashboard
   ```

2. **Установите зависимости:**
   ```bash
   npm install
   ```

3. **Настройте Supabase:**

   ### Создайте таблицу maps:
   - Откройте [Supabase Dashboard](https://app.supabase.com)
   - Перейдите в SQL Editor
   - Скопируйте содержимое `setup_maps_storage.sql`
   - Выполните SQL запрос

   ### Создайте Storage Bucket:
   - В Supabase Dashboard перейдите в Storage
   - Нажмите "New bucket"
   - **Имя:** `maps`
   - **Public:** `false` (приватный)
   - **File size limit:** 100MB
   - Сохраните

4. **Деплой на Vercel:**

   ### Вариант 1: Через GitHub
   - Подключите репозиторий к Vercel
   - Vercel автоматически определит настройки
   - Добавьте переменные окружения в Vercel Dashboard:
     - Перейдите в Project Settings -> Environment Variables
     - Добавьте переменные:
       - **`SUPABASE_URL`** - ваш Supabase URL (например: `https://xxxxx.supabase.co`)
       - **`SUPABASE_KEY`** - **Service Role Key** (НЕ anon key!)
         - Найти можно в Supabase Dashboard -> Settings -> API -> Service Role Key
         - Важно: Service Role Key имеет полный доступ, включая Storage
       - **`DISCORD_BOT_TOKEN`** - опционально (для функций Discord бота)
     - Выберите окружения: Production, Preview, Development
     - Сохраните и перезапустите деплой
   - Деплой запустится автоматически

   ### Вариант 2: Через Vercel CLI
   ```bash
   npm i -g vercel
   vercel
   ```
   Следуйте инструкциям и добавьте переменные окружения

## 📝 Важные моменты

- ⚠️ **Service Role Key:** Для работы с Storage нужен Service Role Key, а не anon key
- 📦 **Storage Bucket:** Должен называться точно `maps`
- 🔒 **Политики:** Можно не настраивать, если используете Service Role Key
- 💾 **Хранение:** Все файлы хранятся в Supabase Storage, а не на сервере

## 🧪 Проверка работы

После деплоя:
1. Откройте ваш сайт на Vercel
2. Перейдите в раздел "Хостинг карт"
3. Загрузите тестовый файл `.map`
4. Проверьте, что ссылка на скачивание работает

## 🐛 Решение проблем

**Ошибка "Supabase not configured":**
- Проверьте, что переменные окружения добавлены в Vercel
- Убедитесь, что используется Service Role Key

**Ошибка при загрузке файла:**
- Проверьте, что bucket `maps` создан в Supabase
- Проверьте политики доступа bucket
- Проверьте размер файла (лимит 100MB)

**Файлы не скачиваются:**
- Проверьте, что storage_path в базе данных правильный
- Проверьте права доступа к bucket

