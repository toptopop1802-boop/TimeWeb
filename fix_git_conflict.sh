#!/bin/bash
# Скрипт для решения конфликта git pull

echo "=== Решение конфликта git pull ==="
echo ""
echo "Вариант 1: Сохранить локальные изменения и обновить (рекомендуется)"
echo "  git stash"
echo "  git pull"
echo "  git stash pop"
echo ""
echo "Вариант 2: Отменить локальные изменения (если они не нужны)"
echo "  git checkout -- run_remote_monitor.sh"
echo "  git pull"
echo ""
echo "Вариант 3: Закоммитить локальные изменения"
echo "  git add run_remote_monitor.sh"
echo "  git commit -m 'Local changes'"
echo "  git pull"
echo ""

