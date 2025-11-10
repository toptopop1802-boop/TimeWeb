#!/bin/bash
# Скрипт установки Remote Monitor Client

set -e

echo "=== Установка Remote Monitor Client ==="

# Создать виртуальное окружение
echo "Создание виртуального окружения..."
python3 -m venv remote_monitor_env

# Активировать виртуальное окружение
echo "Активация виртуального окружения..."
source remote_monitor_env/bin/activate

# Обновить pip
echo "Обновление pip..."
pip install --upgrade pip

# Установить зависимости
echo "Установка зависимостей..."
pip install -r remote_monitor_requirements.txt

echo ""
echo "=== Установка завершена! ==="
echo ""
echo "Для запуска клиента используйте:"
echo "  source remote_monitor_env/bin/activate"
echo "  python remote_monitor_client.py --server http://ваш-сервер.com"
echo ""
echo "Или используйте скрипт запуска:"
echo "  ./run_remote_monitor.sh --server http://ваш-сервер.com"

