-- Таблица для хранения persistent views (кнопки, которые должны работать после перезапуска)
CREATE TABLE IF NOT EXISTS persistent_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    view_type VARCHAR(50) NOT NULL, -- 'gradient_role', 'tournament_role', 'help_ticket', 'wipe_announcement', etc.
    view_data JSONB NOT NULL, -- Данные для восстановления view
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_persistent_views_guild ON persistent_views(guild_id);
CREATE INDEX IF NOT EXISTS idx_persistent_views_channel ON persistent_views(channel_id);
CREATE INDEX IF NOT EXISTS idx_persistent_views_message ON persistent_views(message_id);
CREATE INDEX IF NOT EXISTS idx_persistent_views_type ON persistent_views(view_type);
CREATE INDEX IF NOT EXISTS idx_persistent_views_active ON persistent_views(is_active) WHERE is_active = true;

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_persistent_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_persistent_views_updated_at ON persistent_views;
CREATE TRIGGER trigger_update_persistent_views_updated_at
    BEFORE UPDATE ON persistent_views
    FOR EACH ROW
    EXECUTE FUNCTION update_persistent_views_updated_at();

-- Комментарии к таблице
COMMENT ON TABLE persistent_views IS 'Хранит информацию о persistent views для восстановления после перезапуска бота';
COMMENT ON COLUMN persistent_views.view_type IS 'Тип view: gradient_role, tournament_role, help_ticket, wipe_announcement, etc.';
COMMENT ON COLUMN persistent_views.view_data IS 'JSON с данными для восстановления view (applicant_id, role_name, etc.)';
COMMENT ON COLUMN persistent_views.is_active IS 'FALSE если view уже не актуальна (заявка одобрена/отклонена)';

