# 🚀 Быстрый старт

## Установка и запуск в одну команду

### Windows (PowerShell)
```powershell
.\start.ps1
```

### Linux/Mac
```bash
chmod +x start.sh
./start.sh
```

### Универсальный способ (Python)
```bash
python start.py
```

## Что делают скрипты автоматически

✅ Проверяют наличие Python 3.8+ и Node.js 16+  
✅ Создают виртуальное окружение Python  
✅ Устанавливают все зависимости Python и Node.js  
✅ Проверяют наличие .env файлов  
✅ Запускают Discord бота и Dashboard одновременно  
✅ Выводят логи обоих сервисов в реальном времени  

## Первый запуск

### 1. Настройте переменные окружения

Создайте файл `.env` в корне проекта:
```env
DISCORD_BOT_TOKEN=ваш_токен_бота
SUPABASE_URL=ваш_supabase_url
SUPABASE_KEY=ваш_supabase_key
```

Создайте файл `dashboard/.env`:
```env
PORT=3000
DISCORD_BOT_TOKEN=ваш_токен_бота
SUPABASE_URL=ваш_supabase_url
SUPABASE_KEY=ваш_supabase_key
```

### 2. Запустите проект

Выберите подходящий скрипт и запустите его. Скрипт сам установит все зависимости.

### 3. Откройте Dashboard

После запуска откройте в браузере:
```
http://localhost:3000
```

## Остановка сервисов

Нажмите `Ctrl+C` в терминале - все сервисы остановятся автоматически.

## Возможные проблемы

### Python не найден
Установите Python 3.8+ с https://www.python.org/downloads/

### Node.js не найден
Установите Node.js 16+ с https://nodejs.org/

### Ошибка при установке зависимостей
Проверьте подключение к интернету и повторите запуск скрипта.

### Бот не запускается
Убедитесь, что в `.env` файле указан правильный `DISCORD_BOT_TOKEN`.

## Дополнительная информация

📖 Полная документация: `README.md`  
🔧 Настройка базы данных: `dashboard/SETUP.md`  
🚀 Деплой на сервер: `dashboard/DEPLOY.md`  
📤 Загрузка на GitHub: `GITHUB_UPLOAD.md`

