-- Добавление колонки mailbox_password в таблицу registered_accounts
-- Выполнить если колонки еще нет

ALTER TABLE registered_accounts 
ADD COLUMN IF NOT EXISTS mailbox_password TEXT NULL;

-- Комментарий к колонке
COMMENT ON COLUMN registered_accounts.mailbox_password IS 'Пароль от почтового ящика (NotLetters) для получения кода подтверждения';

