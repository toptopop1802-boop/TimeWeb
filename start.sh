#!/bin/bash

# Bash скрипт для запуска бота и дашборда одновременно (Linux/Mac)

echo "========================================"
echo "  Discord Bot + Dashboard Launcher"
echo "========================================"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Проверка наличия Python
echo -e "${YELLOW}[1/5] Проверка Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python не найден! Установите Python 3.8+${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python найден: $(python3 --version)${NC}"

# Проверка наличия Node.js
echo -e "${YELLOW}[2/5] Проверка Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не найден! Установите Node.js 16+${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js найден: $(node --version)${NC}"

# Проверка виртуального окружения Python
echo -e "${YELLOW}[3/5] Проверка виртуального окружения...${NC}"
if [ ! -d "botenv" ]; then
    echo -e "${YELLOW}⚠️  Виртуальное окружение не найдено. Создаю...${NC}"
    python3 -m venv botenv
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Ошибка создания виртуального окружения!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Виртуальное окружение создано${NC}"
    
    echo -e "${YELLOW}📦 Установка Python зависимостей...${NC}"
    source botenv/bin/activate
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Ошибка установки зависимостей!${NC}"
        exit 1
    fi
    deactivate
else
    echo -e "${GREEN}✅ Виртуальное окружение найдено${NC}"
fi

# Проверка node_modules
echo -e "${YELLOW}[4/5] Проверка Node.js зависимостей...${NC}"
if [ ! -d "dashboard/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Node modules не найдены. Устанавливаю...${NC}"
    cd dashboard
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Ошибка установки зависимостей!${NC}"
        cd ..
        exit 1
    fi
    cd ..
    echo -e "${GREEN}✅ Node modules установлены${NC}"
else
    echo -e "${GREEN}✅ Node modules найдены${NC}"
fi

# Проверка .env файлов
echo -e "${YELLOW}[5/5] Проверка конфигурации...${NC}"
ENV_MISSING=0
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Файл .env не найден в корне проекта!${NC}"
    ENV_MISSING=1
fi
if [ ! -f "dashboard/.env" ]; then
    echo -e "${YELLOW}⚠️  Файл .env не найден в dashboard!${NC}"
    ENV_MISSING=1
fi

if [ $ENV_MISSING -eq 1 ]; then
    echo -e "${YELLOW}⚠️  Создайте .env файлы на основе env.example${NC}"
    echo -e "${YELLOW}   Продолжаю запуск...${NC}"
else
    echo -e "${GREEN}✅ Конфигурация найдена${NC}"
fi

echo ""
echo "========================================"
echo "  Запуск сервисов..."
echo "========================================"
echo ""

# Обработчик для корректного завершения
cleanup() {
    echo -e "\n${YELLOW}⏹️  Остановка сервисов...${NC}"
    kill $BOT_PID 2>/dev/null
    kill $DASH_PID 2>/dev/null
    echo -e "${GREEN}✅ Все сервисы остановлены${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Запуск Discord бота
echo -e "${CYAN}🚀 Запуск Discord Bot...${NC}"
source botenv/bin/activate
python broadcast_bot.py 2>&1 | sed "s/^/$(echo -e "${MAGENTA}")[BOT]$(echo -e "${NC}") /" &
BOT_PID=$!
deactivate

# Небольшая задержка
sleep 2

# Запуск Dashboard
echo -e "${CYAN}🚀 Запуск Dashboard...${NC}"
cd dashboard
node server.js 2>&1 | sed "s/^/$(echo -e "${BLUE}")[DASH]$(echo -e "${NC}") /" &
DASH_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ Сервисы запущены!${NC}"
echo ""
echo -e "${CYAN}📊 Dashboard: http://localhost:3000${NC}"
echo -e "${CYAN}🤖 Discord Bot: Работает в фоне${NC}"
echo ""
echo -e "${YELLOW}Нажмите Ctrl+C для остановки всех сервисов${NC}"
echo ""

# Ожидание завершения процессов
wait

