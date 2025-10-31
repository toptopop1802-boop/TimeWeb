-- Таблица API токенов для внешних интеграций
CREATE TABLE IF NOT EXISTS api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, -- Название токена (например, "Figma Plugin", "Mobile App")
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE -- NULL = бессрочный
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens (token);
CREATE INDEX IF NOT EXISTS idx_api_tokens_is_active ON api_tokens (is_active);

-- Комментарии
COMMENT ON TABLE api_tokens IS 'API токены для внешних интеграций (Figma, мобильные приложения и т.д.)';
COMMENT ON COLUMN api_tokens.token IS 'Сам токен (64 символа hex)';
COMMENT ON COLUMN api_tokens.name IS 'Название для идентификации токена';
COMMENT ON COLUMN api_tokens.is_active IS 'Активен ли токен';
COMMENT ON COLUMN api_tokens.last_used_at IS 'Время последнего использования токена';

-- Вставляем токен для Figma плагина для админа (bublick)
-- Сначала находим ID админа
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE username = 'bublick' LIMIT 1;
    
    IF admin_user_id IS NOT NULL THEN
        -- Удаляем старый токен если есть
        DELETE FROM api_tokens WHERE token = '58076245d1f7985852fc5dc77d2da0294dac4c714f3cdc773029d470ccd10511';
        
        -- Вставляем новый
        INSERT INTO api_tokens (user_id, token, name, description, is_active)
        VALUES (
            admin_user_id,
            '58076245d1f7985852fc5dc77d2da0294dac4c714f3cdc773029d470ccd10511',
            'Figma Plugin',
            'Токен для автоматической загрузки изображений из Figma плагина',
            TRUE
        )
        ON CONFLICT (token) DO UPDATE 
        SET is_active = TRUE, 
            last_used_at = NULL,
            name = EXCLUDED.name,
            description = EXCLUDED.description;
        
        RAISE NOTICE 'API token created/updated for user: bublick';
    ELSE
        RAISE WARNING 'Admin user "bublick" not found. Please create admin user first.';
    END IF;
END $$;

