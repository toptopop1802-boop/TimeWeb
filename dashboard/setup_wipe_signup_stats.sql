-- ============================================
-- Таблица для статистики записи на вайп
-- ============================================

CREATE TABLE IF NOT EXISTS wipe_signup_stats (
    id BIGSERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    signup_type TEXT NOT NULL CHECK (signup_type IN ('looking', 'ready', 'not_coming')),
    player_count INTEGER DEFAULT NULL, -- Для типа 'looking' - сколько игроков ищет (+1, +2 и т.д.)
    message_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по гильдии и типу
CREATE INDEX IF NOT EXISTS idx_wipe_signup_guild_type ON wipe_signup_stats (guild_id, signup_type);

-- Индекс для статистики по пользователям
CREATE INDEX IF NOT EXISTS idx_wipe_signup_user ON wipe_signup_stats (user_id);

-- Индекс для временной статистики
CREATE INDEX IF NOT EXISTS idx_wipe_signup_created_at ON wipe_signup_stats (created_at);

-- Комментарии к таблице и полям
COMMENT ON TABLE wipe_signup_stats IS 'Статистика записи пользователей на вайп';
COMMENT ON COLUMN wipe_signup_stats.guild_id IS 'ID сервера Discord';
COMMENT ON COLUMN wipe_signup_stats.user_id IS 'ID пользователя Discord';
COMMENT ON COLUMN wipe_signup_stats.signup_type IS 'Тип записи: looking (ищет игроков), ready (готов зайти), not_coming (не зайдет)';
COMMENT ON COLUMN wipe_signup_stats.player_count IS 'Количество игроков для типа looking (+1, +2 и т.д.)';
COMMENT ON COLUMN wipe_signup_stats.message_content IS 'Оригинальное содержимое сообщения';
COMMENT ON COLUMN wipe_signup_stats.created_at IS 'Дата и время создания записи';

