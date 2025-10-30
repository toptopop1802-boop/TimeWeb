# Discord Bot + Dashboard

Проект включает Discord бота на Python и веб-дашборд на Node.js для управления и аналитики.

## Структура проекта

- `broadcast_bot.py` - Discord бот на Python
- `database.py` - Модуль для работы с базой данных
- `dashboard/` - Веб-интерфейс дашборда
- `setup_database.sql` - SQL скрипт для настройки базы данных

## Быстрый старт

### 1. Установка зависимостей

#### Python (Бот)
```bash
# Создать виртуальное окружение
python -m venv botenv

# Активировать виртуальное окружение
# Windows:
botenv\Scripts\activate
# Linux/Mac:
source botenv/bin/activate

# Установить зависимости
pip install -r requirements.txt
```

#### Node.js (Dashboard)
```bash
cd dashboard
npm install
```

### 2. Настройка переменных окружения

Скопируйте файл `env.example` в `.env` и заполните необходимые значения:

```bash
# В корне проекта
cp env.example .env

# В папке dashboard
cd dashboard
cp env.example .env
```

### 3. Запуск проекта

#### Запуск всего проекта (Windows PowerShell):
```powershell
.\start.ps1
```

#### Запуск всего проекта (Linux/Mac):
```bash
./start.sh
```

#### Или запустите компоненты по отдельности:

**Discord Бот:**
```bash
python broadcast_bot.py
```

**Dashboard:**
```bash
cd dashboard
npm start
```

## Требования

- Python 3.8+
- Node.js 16+
- PostgreSQL (Supabase)
- Discord Bot Token

## Документация

Подробная документация находится в папке `dashboard/`:
- `SETUP.md` - Подробная инструкция по настройке
- `DEPLOY.md` - Инструкция по деплою
- `VERCEL_SETUP.md` - Настройка для Vercel

## Возможности

### Discord Bot
- Автоматическое удаление каналов
- Система тикетов
- Управление вайпами
- Аналитика сервера

### Dashboard
- Просмотр статистики
- Управление сообщениями
- Хостинг карт (.map файлы)
- Система changelog

## Лицензия

MIT

