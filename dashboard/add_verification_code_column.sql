-- Добавление колонки verification_code в таблицу registered_accounts
-- Выполнить если колонки еще нет

ALTER TABLE registered_accounts 
ADD COLUMN IF NOT EXISTS verification_code TEXT NULL;

-- Комментарий к колонке
COMMENT ON COLUMN registered_accounts.verification_code IS 'Код подтверждения из email для этого аккаунта';

