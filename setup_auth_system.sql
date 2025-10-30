-- ============================================
-- Система авторизации для Dashboard
-- ============================================

-- ВАЖНО: Перед выполнением этого скрипта создайте Storage Buckets в Supabase Dashboard:
--
-- 1. Откройте Supabase Dashboard -> Storage
-- 2. Создайте bucket "maps":
--    - Name: maps
--    - Public: ✅ (включите публичный доступ)
--    - File size limit: 100MB
--
-- 3. Создайте bucket "images":
--    - Name: images
--    - Public: ✅ (включите публичный доступ)
--    - File size limit: 15MB
--    - Allowed MIME types: image/png, image/jpeg, image/gif, image/webp

-- 1. Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- 2. Таблица сессий
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- 3. Обновляем таблицу для хранения метаданных карт
-- (вместо хранения только в Storage, добавим записи в БД)
CREATE TABLE IF NOT EXISTS maps_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    map_id VARCHAR(255) UNIQUE NOT NULL, -- UUID файла в Storage
    original_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    short_code VARCHAR(7) UNIQUE NOT NULL,
    download_count INT DEFAULT 0,
    is_public BOOLEAN DEFAULT false, -- Публичная карта видна всем
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_maps_user_id ON maps_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_maps_short_code ON maps_metadata(short_code);
CREATE INDEX IF NOT EXISTS idx_maps_map_id ON maps_metadata(map_id);

-- 5. Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Триггер для maps_metadata
DROP TRIGGER IF EXISTS update_maps_metadata_updated_at ON maps_metadata;
CREATE TRIGGER update_maps_metadata_updated_at
    BEFORE UPDATE ON maps_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Функция для очистки истекших сессий
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 8. Создаем первого админа (замените пароль!)
-- Пароль: admin123 (ОБЯЗАТЕЛЬНО СМЕНИТЕ ПОСЛЕ ПЕРВОГО ВХОДА!)
-- Hash для 'admin123': $2b$10$rBV2gHUqN9Nv.5fX7QJRyO7YzK0pK6Rb8.xGDJnq4rK.FHkY8Qy3W
INSERT INTO users (username, email, password_hash, role, is_active)
VALUES 
    ('admin', 'admin@bublickrust.ru', '$2b$10$rBV2gHUqN9Nv.5fX7QJRyO7YzK0pK6Rb8.xGDJnq4rK.FHkY8Qy3W', 'admin', true)
ON CONFLICT ON CONSTRAINT users_email_key DO NOTHING;

-- 9. Row Level Security (RLS) - ОТКЛЮЧАЕМ, т.к. используем JWT через backend
-- Backend сам контролирует доступ через middleware

-- Удаляем все политики
DROP POLICY IF EXISTS user_maps_select ON maps_metadata;
DROP POLICY IF EXISTS user_maps_insert ON maps_metadata;
DROP POLICY IF EXISTS user_maps_update ON maps_metadata;
DROP POLICY IF EXISTS user_maps_delete ON maps_metadata;

-- Отключаем RLS для всех таблиц
ALTER TABLE IF EXISTS maps_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_actions DISABLE ROW LEVEL SECURITY;

-- RLS отключен - доступ контролируется через backend API и JWT токены
COMMENT ON TABLE maps_metadata IS 'RLS DISABLED - Access controlled by backend JWT middleware';

-- 10. Комментарии для документации
COMMENT ON TABLE users IS 'Таблица пользователей системы';
COMMENT ON TABLE sessions IS 'Активные сессии пользователей';
COMMENT ON TABLE maps_metadata IS 'Метаданные загруженных карт с привязкой к пользователям';
COMMENT ON COLUMN users.role IS 'Роль: user (обычный пользователь) или admin (администратор)';
COMMENT ON COLUMN maps_metadata.is_public IS 'Публичная карта видна всем пользователям';
COMMENT ON COLUMN maps_metadata.short_code IS '7-значный код для короткой ссылки';

-- ============================================
-- АНАЛИТИКА РЕГИСТРАЦИЙ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================

CREATE TABLE IF NOT EXISTS user_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_registrations_user_id ON user_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_registrations_registered_at ON user_registrations(registered_at DESC);

COMMENT ON TABLE user_registrations IS 'Аналитика регистраций пользователей';
COMMENT ON COLUMN user_registrations.registered_at IS 'Дата и время регистрации';

-- ============================================
-- АНАЛИТИКА ДЕЙСТВИЙ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================

CREATE TABLE IF NOT EXISTS user_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'map_upload', 'map_download', 'map_delete', 'login', 'logout'
    action_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_type ON user_actions(action_type);

COMMENT ON TABLE user_actions IS 'Лог действий пользователей';
COMMENT ON COLUMN user_actions.action_type IS 'Тип действия: map_upload, map_download, map_delete, login, logout';
COMMENT ON COLUMN user_actions.action_details IS 'JSON с деталями действия';

-- Готово!
-- Теперь выполните:
-- 1. В Supabase Dashboard -> SQL Editor -> вставьте и выполните этот скрипт
-- 2. Админ-логин: bublick / fufel52
-- 3. Обычные пользователи регистрируются просто по имени

