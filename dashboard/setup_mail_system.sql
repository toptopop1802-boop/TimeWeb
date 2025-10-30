-- Создание таблицы для почтовых ящиков
CREATE TABLE IF NOT EXISTS mailboxes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(255),
    quota_mb INTEGER DEFAULT 1000,
    used_space_mb INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    last_login TIMESTAMP,
    imap_host VARCHAR(255) DEFAULT 'mx1.timeweb.ru',
    imap_port INTEGER DEFAULT 993,
    smtp_host VARCHAR(255) DEFAULT 'mx1.timeweb.ru',
    smtp_port INTEGER DEFAULT 465,
    notes TEXT
);

-- Создание таблицы для писем (кэш входящих писем)
CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    mailbox_id INTEGER REFERENCES mailboxes(id) ON DELETE CASCADE,
    message_id VARCHAR(500) UNIQUE,
    subject TEXT,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    recipient_email VARCHAR(255) NOT NULL,
    cc TEXT,
    bcc TEXT,
    body_text TEXT,
    body_html TEXT,
    has_attachments BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    is_spam BOOLEAN DEFAULT false,
    size_bytes INTEGER,
    received_at TIMESTAMP NOT NULL,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    folder VARCHAR(50) DEFAULT 'INBOX'
);

-- Создание таблицы для вложений
CREATE TABLE IF NOT EXISTS email_attachments (
    id SERIAL PRIMARY KEY,
    email_id INTEGER REFERENCES emails(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    size_bytes INTEGER,
    file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы для логов синхронизации почты
CREATE TABLE IF NOT EXISTS mail_sync_logs (
    id SERIAL PRIMARY KEY,
    mailbox_id INTEGER REFERENCES mailboxes(id) ON DELETE CASCADE,
    sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_finished_at TIMESTAMP,
    emails_fetched INTEGER DEFAULT 0,
    status VARCHAR(50),
    error_message TEXT
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_mailboxes_email ON mailboxes(email);
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);

-- Добавление комментариев к таблицам
COMMENT ON TABLE mailboxes IS 'Хранит информацию о почтовых ящиках домена bublickrust.ru';
COMMENT ON TABLE emails IS 'Кэш входящих писем для быстрого доступа';
COMMENT ON TABLE email_attachments IS 'Информация о вложениях в письмах';
COMMENT ON TABLE mail_sync_logs IS 'Логи синхронизации почты с IMAP сервером';

