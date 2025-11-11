-- Таблица для хранения аккаунтов Stripe
CREATE TABLE IF NOT EXISTS stripe_accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    account_type VARCHAR(10) NOT NULL DEFAULT 'FREE', -- 'FREE' или 'PRO'
    registration_location VARCHAR(100),
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_email ON stripe_accounts(email);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_active ON stripe_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_type ON stripe_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_created ON stripe_accounts(created_at DESC);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_stripe_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stripe_accounts_updated_at
    BEFORE UPDATE ON stripe_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_stripe_accounts_updated_at();

-- Таблица для логирования использования аккаунтов
CREATE TABLE IF NOT EXISTS stripe_accounts_usage_log (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES stripe_accounts(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    user_ip VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_usage_account ON stripe_accounts_usage_log(account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_usage_date ON stripe_accounts_usage_log(used_at DESC);

