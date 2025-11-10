#!/bin/bash
# Скрипт установки Xvfb для работы на сервере без GUI

echo "=== Установка Xvfb для Remote Monitor ==="

# Проверить, установлен ли Xvfb
if command -v Xvfb &> /dev/null; then
    echo "✓ Xvfb уже установлен"
else
    echo "Установка Xvfb..."
    apt-get update
    apt-get install -y xvfb x11-utils scrot imagemagick
fi

# Проверить, запущен ли Xvfb
if pgrep -x "Xvfb" > /dev/null; then
    echo "✓ Xvfb уже запущен"
else
    echo "Запуск Xvfb на дисплее :99..."
    Xvfb :99 -screen 0 1024x768x24 &
    sleep 2
    echo "✓ Xvfb запущен"
fi

# Установить DISPLAY
export DISPLAY=:99
echo "export DISPLAY=:99" >> ~/.bashrc

echo ""
echo "=== Готово! ==="
echo "Xvfb запущен на дисплее :99"
echo "DISPLAY установлен в :99"
echo ""
echo "Для постоянной работы добавьте в crontab или systemd:"
echo "  Xvfb :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset &"
echo ""
echo "Теперь можно запустить клиент:"
echo "  ./run_remote_monitor.sh --server https://bublickrust.ru"

