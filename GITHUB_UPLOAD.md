# Инструкция по загрузке проекта на GitHub

## Шаг 1: Инициализация Git репозитория

Откройте терминал в папке проекта и выполните:

```bash
git init
git add .
git commit -m "Initial commit: Discord Bot + Dashboard"
```

## Шаг 2: Подключение к GitHub репозиторию

```bash
git remote add origin https://github.com/toptopop1802-boop/TimeWeb.git
git branch -M main
```

## Шаг 3: Загрузка файлов на GitHub

```bash
git push -u origin main
```

Если потребуется принудительная загрузка (если репозиторий не пустой):

```bash
git push -u origin main --force
```

## Шаг 4: Проверка

Перейдите на https://github.com/toptopop1802-boop/TimeWeb и убедитесь, что все файлы загружены.

---

## Альтернативный способ (если нужно слить с существующими файлами)

```bash
git init
git remote add origin https://github.com/toptopop1802-boop/TimeWeb.git
git fetch
git checkout -b main origin/main
git add .
git commit -m "Add Discord Bot and Dashboard"
git push origin main
```

---

## Важные замечания

1. Убедитесь, что файл `.gitignore` корректно настроен (уже создан)
2. Файлы `.env` НЕ будут загружены (это правильно!)
3. Папка `botenv/` и `node_modules/` также не будут загружены
4. Создайте `.env` файлы вручную на сервере при деплое

---

## Быстрый запуск после клонирования

После клонирования репозитория используйте один из скриптов запуска:

### Windows (PowerShell):
```powershell
.\start.ps1
```

### Linux/Mac:
```bash
chmod +x start.sh start.py
./start.sh
```

### Универсальный (Python):
```bash
python start.py
```

Скрипты автоматически:
- Проверят установку Python и Node.js
- Создадут виртуальное окружение
- Установят все зависимости
- Запустят бота и дашборд одновременно

