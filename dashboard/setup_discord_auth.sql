-- ============================================
-- Добавление поддержки Discord OAuth
-- ============================================

-- Добавляем поля для Discord в таблицу users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS discord_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS discord_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS discord_avatar VARCHAR(255);

-- Создаем индекс для быстрого поиска по Discord ID
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id) WHERE discord_id IS NOT NULL;

-- Комментарии
COMMENT ON COLUMN users.discord_id IS 'Discord ID пользователя (из OAuth)';
COMMENT ON COLUMN users.discord_username IS 'Discord username пользователя';
COMMENT ON COLUMN users.discord_avatar IS 'Discord avatar hash пользователя';

