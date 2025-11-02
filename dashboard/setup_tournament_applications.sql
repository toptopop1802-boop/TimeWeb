-- Таблица для хранения заявок на турнир
CREATE TABLE IF NOT EXISTS tournament_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discord_id BIGINT NOT NULL,
    steam_id TEXT NOT NULL,
    message_id BIGINT,  -- ID сообщения в Discord (NULL если еще не отправлено)
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, discord_id) -- Один пользователь может подать только одну заявку
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_tournament_applications_user_id ON tournament_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_applications_discord_id ON tournament_applications(discord_id);
CREATE INDEX IF NOT EXISTS idx_tournament_applications_status ON tournament_applications(status);
CREATE INDEX IF NOT EXISTS idx_tournament_applications_created_at ON tournament_applications(created_at DESC);

-- Таблица для управления статусом приема заявок
CREATE TABLE IF NOT EXISTS tournament_registration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_open BOOLEAN DEFAULT TRUE,
    closes_at TIMESTAMPTZ,
    main_message_id BIGINT,  -- ID главного сообщения со списком участников
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Вставляем дефолтную настройку (регистрация открыта)
INSERT INTO tournament_registration_settings (is_open, closes_at)
VALUES (TRUE, NULL)
ON CONFLICT DO NOTHING;

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_tournament_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_tournament_applications_updated_at ON tournament_applications;
CREATE TRIGGER trigger_update_tournament_applications_updated_at
    BEFORE UPDATE ON tournament_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_tournament_applications_updated_at();

-- Комментарии к таблицам
COMMENT ON TABLE tournament_applications IS 'Заявки на участие в турнире';
COMMENT ON TABLE tournament_registration_settings IS 'Настройки приема заявок на турнир (открыт/закрыт, время закрытия)';

