#!/bin/bash
# Скрипт запуска Remote Monitor Client

# Проверить наличие виртуального окружения
if [ ! -d "remote_monitor_env" ]; then
    echo "Виртуальное окружение не найдено. Запустите сначала:"
    echo "  bash setup_remote_monitor.sh"
    exit 1
fi

# Проверить наличие активационного скрипта
if [ ! -f "remote_monitor_env/bin/activate" ]; then
    echo "Ошибка: файл активации не найден"
    exit 1
fi

# Активировать виртуальное окружение
source remote_monitor_env/bin/activate

# Проверить аргументы
if [ $# -eq 0 ] || [[ "$*" == *"ваш-сервер"* ]]; then
    echo "⚠️  ВНИМАНИЕ: Замените 'http://ваш-сервер.com' на реальный URL вашего сервера!"
    echo ""
    echo "Пример:"
    echo "  ./run_remote_monitor.sh --server http://localhost:3000"
    echo "  ./run_remote_monitor.sh --server https://yourdomain.com"
    echo ""
    if [[ "$*" == *"ваш-сервер"* ]]; then
        exit 1
    fi
fi

# Запустить клиент с переданными аргументами
python remote_monitor_client.py "$@"

