-- Создание таблиц для Discord бота
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- Таблица для хранения активных заявок на турнирные роли
CREATE TABLE IF NOT EXISTS tournament_role_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id BIGINT UNIQUE NOT NULL,
    channel_id BIGINT NOT NULL,
    guild_id BIGINT NOT NULL,
    applicant_id BIGINT NOT NULL,
    role_name TEXT NOT NULL,
    role_color TEXT NOT NULL,
    tournament_info TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_message_id ON tournament_role_requests(message_id);
CREATE INDEX IF NOT EXISTS idx_channel_id ON tournament_role_requests(channel_id);
CREATE INDEX IF NOT EXISTS idx_guild_id ON tournament_role_requests(guild_id);
CREATE INDEX IF NOT EXISTS idx_status ON tournament_role_requests(status);

-- Таблица для хранения других активных заявок (помощь, модератор, админ, разбан)
CREATE TABLE IF NOT EXISTS ticket_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id BIGINT UNIQUE NOT NULL,
    channel_id BIGINT NOT NULL,
    guild_id BIGINT NOT NULL,
    applicant_id BIGINT NOT NULL,
    ticket_type TEXT NOT NULL, -- help, moderator, administrator, unban
    ticket_data JSONB, -- Дополнительные данные (SteamID, возраст и т.д.)
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_ticket_message_id ON ticket_requests(message_id);
CREATE INDEX IF NOT EXISTS idx_ticket_channel_id ON ticket_requests(channel_id);
CREATE INDEX IF NOT EXISTS idx_ticket_guild_id ON ticket_requests(guild_id);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON ticket_requests(status);
CREATE INDEX IF NOT EXISTS idx_ticket_type ON ticket_requests(ticket_type);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления
DROP TRIGGER IF EXISTS update_tournament_role_requests_updated_at ON tournament_role_requests;
CREATE TRIGGER update_tournament_role_requests_updated_at BEFORE UPDATE
    ON tournament_role_requests FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_ticket_requests_updated_at ON ticket_requests;
CREATE TRIGGER update_ticket_requests_updated_at BEFORE UPDATE
    ON ticket_requests FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Таблица для аналитики и статистики
CREATE TABLE IF NOT EXISTS server_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id BIGINT NOT NULL,
    event_type TEXT NOT NULL, -- wipe_created, ticket_created, tournament_role_created, channel_deleted
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_analytics_guild_id ON server_analytics(guild_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON server_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON server_analytics(created_at);

-- Таблица участников сервера (актуальные данные)
CREATE TABLE IF NOT EXISTS guild_members (
    guild_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    username TEXT,
    display_name TEXT,
    is_bot BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (guild_id, member_id)
);

-- Снимки количества участников во времени
CREATE TABLE IF NOT EXISTS member_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id BIGINT NOT NULL,
    count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_member_counts_guild_id ON member_counts(guild_id);
CREATE INDEX IF NOT EXISTS idx_member_counts_created_at ON member_counts(created_at);

-- Таблица для отслеживания каналов с автоудалением
CREATE TABLE IF NOT EXISTS auto_delete_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id BIGINT UNIQUE NOT NULL,
    guild_id BIGINT NOT NULL,
    channel_type TEXT NOT NULL, -- tournament_role, help, moderator, admin, unban
    delete_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    status TEXT DEFAULT 'active', -- active, deleting, deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_auto_delete_channel_id ON auto_delete_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_auto_delete_guild_id ON auto_delete_channels(guild_id);
CREATE INDEX IF NOT EXISTS idx_auto_delete_status ON auto_delete_channels(status);
CREATE INDEX IF NOT EXISTS idx_auto_delete_delete_at ON auto_delete_channels(delete_at);

-- Комментарии к таблицам
COMMENT ON TABLE tournament_role_requests IS 'Хранит активные заявки на создание турнирных ролей';
COMMENT ON TABLE ticket_requests IS 'Хранит активные тикеты (помощь, модератор, админ, разбан)';
COMMENT ON TABLE server_analytics IS 'Хранит статистику и аналитику сервера';
COMMENT ON TABLE auto_delete_channels IS 'Хранит каналы для автоматического удаления';

-- Даем права на таблицы (для anon ключа)
ALTER TABLE tournament_role_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_delete_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_counts ENABLE ROW LEVEL SECURITY;

-- Политика: Разрешаем все операции (так как у нас приватный бот)
DROP POLICY IF EXISTS "Allow all operations" ON tournament_role_requests;
CREATE POLICY "Allow all operations" ON tournament_role_requests FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations" ON ticket_requests;
CREATE POLICY "Allow all operations" ON ticket_requests FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations" ON server_analytics;
CREATE POLICY "Allow all operations" ON server_analytics FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations" ON auto_delete_channels;
CREATE POLICY "Allow all operations" ON auto_delete_channels FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all operations" ON guild_members;
CREATE POLICY "Allow all operations" ON guild_members FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all operations" ON member_counts;
CREATE POLICY "Allow all operations" ON member_counts FOR ALL USING (true);

