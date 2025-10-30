# Архитектура Почтовой Системы

## 📐 Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                    Пользователь (Администратор)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Web Интерфейс (Frontend)                    │
│  ┌───────────────────┐         ┌──────────────────────┐        │
│  │  mail-admin.html  │         │  mail-inbox.html     │        │
│  │  ─────────────────│         │  ──────────────────  │        │
│  │  • Создание ящиков│         │  • Список писем      │        │
│  │  • Управление     │         │  • Просмотр писем    │        │
│  │  • Статистика     │         │  • Управление        │        │
│  └───────────────────┘         └──────────────────────┘        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (server.js)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     API Endpoints                         │  │
│  │  • POST   /api/mail/mailboxes          (создать ящик)   │  │
│  │  • GET    /api/mail/mailboxes          (список ящиков)  │  │
│  │  • DELETE /api/mail/mailboxes/:id      (удалить ящик)   │  │
│  │  • GET    /api/mail/mailboxes/:id/emails (письма)       │  │
│  │  • POST   /api/mail/mailboxes/:id/sync (синхронизация)  │  │
│  │  • GET    /api/mail/emails/:id         (одно письмо)    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Mail Service (mail-service.js)              │  │
│  │  • createMailbox()      - создание ящика                │  │
│  │  • getMailboxes()       - получение списка              │  │
│  │  • syncEmails()         - синхронизация с IMAP          │  │
│  │  • getEmails()          - получение писем из БД         │  │
│  │  • deleteEmail()        - удаление письма               │  │
│  │  • markAsRead()         - пометка письма                │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────┬─────────────────────────────────────┬────────────────┘
           │                                     │
           │ Node.js Libraries:                  │
           │ • imap                              │
           │ • mailparser                        │
           │ • nodemailer                        │
           │                                     │
           ▼                                     ▼
┌─────────────────────────┐         ┌──────────────────────────┐
│  Timeweb Mail Server    │         │  PostgreSQL Database     │
│  ───────────────────────│         │  (Supabase)              │
│  mx1.timeweb.ru         │         │  ──────────────────────  │
│  mx2.timeweb.ru         │         │  • mailboxes             │
│                         │         │  • emails                │
│  IMAP: 993 (SSL/TLS)    │         │  • email_attachments     │
│  SMTP: 465 (SSL/TLS)    │         │  • mail_sync_logs        │
└─────────────────────────┘         └──────────────────────────┘
```

## 🔄 Процесс работы

### 1. Создание почтового ящика

```
Админ → mail-admin.html → POST /api/mail/mailboxes
         ↓
    mail-service.createMailbox()
         ↓
    Хеширование пароля (bcrypt)
         ↓
    Сохранение в БД (mailboxes)
         ↓
    Возврат результата
```

### 2. Синхронизация писем (получение с IMAP)

```
Админ нажимает 🔄 → POST /api/mail/mailboxes/:id/sync
         ↓
    mail-service.syncEmails()
         ↓
    Подключение к IMAP серверу (mx1.timeweb.ru:993)
         ↓
    Открытие папки INBOX
         ↓
    Получение последних 50 писем
         ↓
    Парсинг каждого письма (mailparser)
         ↓
    Сохранение в БД (emails)
         ↓
    Возврат количества загруженных писем
```

### 3. Просмотр писем

```
Админ открывает ящик → mail-inbox.html
         ↓
    GET /api/mail/mailboxes/:id/emails
         ↓
    mail-service.getEmails()
         ↓
    Выборка из БД (emails) с сортировкой
         ↓
    Возврат списка писем
         ↓
    Отображение в интерфейсе
         ↓
Админ выбирает письмо → GET /api/mail/emails/:id
         ↓
    Получение полного письма из БД
         ↓
    Автоматическая пометка как прочитанного
         ↓
    Отображение содержимого (HTML/Text)
```

## 🗄️ Структура базы данных

### Таблица `mailboxes`
```sql
- id              (serial, PK)
- email           (varchar, unique) - полный email адрес
- password_hash   (text)            - хешированный пароль
- display_name    (varchar)         - отображаемое имя
- quota_mb        (integer)         - квота в МБ
- used_space_mb   (integer)         - использовано МБ
- is_active       (boolean)         - активен ли ящик
- created_at      (timestamp)       - дата создания
- created_by      (varchar)         - кто создал
- last_login      (timestamp)       - последний вход
- imap_host       (varchar)         - IMAP сервер
- imap_port       (integer)         - IMAP порт
- smtp_host       (varchar)         - SMTP сервер
- smtp_port       (integer)         - SMTP порт
```

### Таблица `emails`
```sql
- id              (serial, PK)
- mailbox_id      (integer, FK)     - связь с mailboxes
- message_id      (varchar, unique) - уникальный ID письма
- subject         (text)            - тема письма
- sender_email    (varchar)         - email отправителя
- sender_name     (varchar)         - имя отправителя
- recipient_email (varchar)         - email получателя
- body_text       (text)            - текстовое содержимое
- body_html       (text)            - HTML содержимое
- has_attachments (boolean)         - есть ли вложения
- is_read         (boolean)         - прочитано ли
- is_starred      (boolean)         - помечено звездой
- is_spam         (boolean)         - спам ли
- size_bytes      (integer)         - размер письма
- received_at     (timestamp)       - дата получения
- fetched_at      (timestamp)       - дата загрузки в БД
- folder          (varchar)         - папка (INBOX, Sent, etc)
```

## 🔐 Безопасность

### Текущая реализация:
- Пароли хешируются с помощью **bcrypt** (10 rounds)
- Все API endpoints требуют **аутентификацию**
- Доступ только для **администраторов**
- IMAP/SMTP подключения через **SSL/TLS**

### Рекомендации для production:
- Использовать симметричное шифрование для паролей (AES-256)
- Хранить ключи шифрования в переменных окружения
- Включить **HTTPS** для всех подключений
- Настроить **rate limiting** для API
- Добавить **2FA** для админов
- Логирование всех операций с почтой

## 🚀 Масштабирование

### Текущие ограничения:
- Синхронизация только последних 50 писем
- Ручная синхронизация (кнопка 🔄)
- Один IMAP подключение за раз
- Хранение писем в PostgreSQL

### Возможные улучшения:
1. **Фоновая синхронизация** - автоматическая каждые N минут
2. **Webhook от почтового сервера** - мгновенное получение писем
3. **Пагинация** - загрузка писем порциями
4. **Кеширование** - Redis для часто запрашиваемых данных
5. **Очереди задач** - Bull/BullMQ для синхронизации
6. **Горизонтальное масштабирование** - несколько инстансов

## 📊 Мониторинг

### Что можно отслеживать:
- Количество почтовых ящиков
- Общее количество писем
- Частота синхронизации
- Ошибки подключения к IMAP
- Размер использованного места
- Время отклика API

### Логирование:
```javascript
// Все операции логируются в консоль:
console.log('🔄 Syncing mailbox:', mailboxId);
console.log('✅ Fetched', emailsFetched, 'emails');
console.error('❌ IMAP error:', error);
```

## 🔄 Жизненный цикл письма

```
1. Письмо приходит на mx1.timeweb.ru
         ↓
2. Админ нажимает кнопку синхронизации
         ↓
3. IMAP соединение устанавливается
         ↓
4. Письмо загружается с сервера
         ↓
5. Парсинг (subject, body, sender, etc)
         ↓
6. Сохранение в PostgreSQL
         ↓
7. Отображение в веб-интерфейсе
         ↓
8. Админ читает письмо → is_read = true
         ↓
9. Админ может удалить → DELETE из БД
    (но остается на почтовом сервере)
```

## 🎯 Технологический стек

### Backend:
- **Node.js** - runtime
- **Express.js** - веб-фреймворк
- **imap** - IMAP клиент
- **mailparser** - парсинг MIME писем
- **nodemailer** - SMTP отправка
- **bcryptjs** - хеширование паролей
- **@supabase/supabase-js** - клиент БД

### Frontend:
- **Vanilla JavaScript** - без фреймворков
- **HTML5/CSS3** - современная верстка
- **Fetch API** - HTTP запросы
- **Auth Helper** - проверка авторизации

### Database:
- **PostgreSQL** (через Supabase)
- **SQL** - схема и запросы

### Infrastructure:
- **Timeweb** - почтовый хостинг
- **DNS** - настройка MX, SPF записей
- **SSL/TLS** - шифрование соединений

## 📝 API Спецификация

### Создание ящика
```http
POST /api/mail/mailboxes
Content-Type: application/json

{
  "email": "info@bublickrust.ru",
  "password": "secure_password",
  "displayName": "Support Team"
}

Response: 200 OK
{
  "id": 1,
  "email": "info@bublickrust.ru",
  "display_name": "Support Team",
  "created_at": "2025-10-30T12:00:00Z"
}
```

### Синхронизация писем
```http
POST /api/mail/mailboxes/1/sync

Response: 200 OK
{
  "success": true,
  "emailsFetched": 15
}
```

### Получение писем
```http
GET /api/mail/mailboxes/1/emails?limit=50&offset=0

Response: 200 OK
[
  {
    "id": 1,
    "subject": "Welcome!",
    "sender_email": "noreply@example.com",
    "sender_name": "Example Team",
    "is_read": false,
    "received_at": "2025-10-30T11:30:00Z"
  }
]
```

---

**Документация актуальна на:** 30 октября 2025
**Версия системы:** 1.0.0

