#!/bin/bash
# Скрипт для решения проблемы с git pull

echo "=== Решение проблемы git pull ==="
echo ""
echo "Файл run_remote_monitor.sh был удален из репозитория."
echo "Удаляем локальные изменения и обновляем код:"
echo ""
echo "Выполните на сервере:"
echo "  git checkout -- run_remote_monitor.sh"
echo "  git pull"
echo ""
echo "Или если файл больше не нужен:"
echo "  rm -f run_remote_monitor.sh"
echo "  git pull"
echo ""

