-- Таблица зарегистрированных аккаунтов Cursor
CREATE TABLE IF NOT EXISTS registered_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    mailbox_password TEXT NULL,
    verification_code TEXT NULL,
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_location TEXT NULL,
    exported_at TIMESTAMP WITH TIME ZONE NULL,
    export_batch TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registered_accounts_email ON registered_accounts (email);
CREATE INDEX IF NOT EXISTS idx_registered_accounts_registered_at ON registered_accounts (registered_at);
CREATE INDEX IF NOT EXISTS idx_registered_accounts_exported_at ON registered_accounts (exported_at);

-- Демонстрационная запись, чтобы страница не была пустой
-- По просьбе: ebbo1995@bublickrust.ru / QyBF{4-EX9Ean$sP / 2025-11-11 23:21
INSERT INTO registered_accounts (email, password, registered_at)
VALUES ('ebbo1995@bublickrust.ru', 'QyBF{4-EX9Ean$sP', '2025-11-11 23:21:00+00')
ON CONFLICT (email) DO NOTHING;



