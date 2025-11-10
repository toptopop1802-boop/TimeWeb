# Удаленный мониторинг компьютера

Система для удаленного мониторинга и управления компьютером через веб-интерфейс.

## Как использовать

### 1. На удаленном компьютере (который нужно мониторить)

**⚠️ ВАЖНО для Linux серверов без GUI:**
Если вы запускаете на сервере без графического интерфейса, установите Xvfb:
```bash
bash setup_xvfb.sh
```
Или вручную:
```bash
apt-get install xvfb x11-utils scrot imagemagick
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99
```

#### Вариант 1: Автоматическая установка (рекомендуется)

1. Сделайте скрипты исполняемыми:
```bash
chmod +x setup_remote_monitor.sh run_remote_monitor.sh
```

2. Запустите установку:
```bash
bash setup_remote_monitor.sh
```

3. Запустите клиент:
```bash
./run_remote_monitor.sh --server https://bublickrust.ru
```

#### Вариант 2: Ручная установка

1. Создайте виртуальное окружение:
```bash
python3 -m venv remote_monitor_env
```

2. Активируйте виртуальное окружение:
```bash
source remote_monitor_env/bin/activate
```

3. Установите зависимости:
```bash
pip install -r remote_monitor_requirements.txt
```

4. Запустите клиентский скрипт:
```bash
python remote_monitor_client.py --server https://bublickrust.ru
```

Или если у вас уже есть ID сессии:
```bash
python remote_monitor_client.py --server https://bublickrust.ru --session YOUR_SESSION_ID
```

**Примечание:** Если вы используете Windows, используйте `remote_monitor_env\Scripts\activate` вместо `source remote_monitor_env/bin/activate`

После запуска скрипт выведет ссылку для просмотра, например:
```
✓ Сессия зарегистрирована: abc123def456...
✓ Ссылка для просмотра: https://bublickrust.ru/remote-monitor.html?session=abc123def456...
```

### 2. На компьютере для просмотра

1. Откройте ссылку, которую выдал клиентский скрипт, или перейдите на:
   `https://bublickrust.ru/remote-monitor.html`
   
   Или используйте навигацию в Dashboard: **Удаленный мониторинг**

2. Введите ID сессии или полную ссылку в поле "ID сессии или ссылка"

3. Нажмите "Подключиться"

4. Вы увидите экран удаленного компьютера в реальном времени

5. Используйте кнопки управления для отправки команд:
   - Левый/Правый клик мыши
   - Клавиши (Enter, Escape, Tab, Backspace)
   - Отправка текста

## Возможности

- ✅ Просмотр экрана удаленного компьютера в реальном времени (2 FPS)
- ✅ Управление мышью (левый/правый клик)
- ✅ Отправка нажатий клавиш
- ✅ Ввод текста
- ✅ Отображение системной информации (имя компьютера, пользователь, ОС, IP)
- ✅ Журнал активности

## Безопасность

⚠️ **ВНИМАНИЕ**: Эта система не имеет встроенной аутентификации. Используйте только в доверенных сетях или добавьте собственную систему аутентификации.

Сессии автоматически удаляются через 60 секунд неактивности.

## API Endpoints

- `POST /api/remote-monitor/register` - Регистрация новой сессии
- `GET /api/remote-monitor/status/:sessionId` - Проверка статуса сессии
- `POST /api/remote-monitor/screen/:sessionId` - Загрузка скриншота
- `GET /api/remote-monitor/screen/:sessionId` - Получение скриншота
- `POST /api/remote-monitor/info/:sessionId` - Обновление системной информации
- `GET /api/remote-monitor/info/:sessionId` - Получение системной информации
- `POST /api/remote-monitor/command/:sessionId` - Отправка команды
- `GET /api/remote-monitor/commands/:sessionId` - Получение команд

## Технические детали

- Клиент отправляет скриншоты каждые 500ms (2 FPS)
- Команды проверяются каждые 100ms
- Сессии хранятся в памяти сервера (не сохраняются в БД)
- Автоматическая очистка неактивных сессий каждые 30 секунд

