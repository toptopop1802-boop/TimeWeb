#!/bin/bash
# Скрипт запуска Remote Monitor Client

# Проверить наличие виртуального окружения
if [ ! -d "remote_monitor_env" ]; then
    echo "Виртуальное окружение не найдено. Запустите сначала:"
    echo "  bash setup_remote_monitor.sh"
    exit 1
fi

# Активировать виртуальное окружение
source remote_monitor_env/bin/activate

# Запустить клиент с переданными аргументами
python remote_monitor_client.py "$@"

