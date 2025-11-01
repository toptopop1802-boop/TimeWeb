-- Таблица для хранения заявок на градиентные роли
-- Используется для сохранения данных между перезапусками бота

CREATE TABLE IF NOT EXISTS gradient_role_requests (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL UNIQUE,
    channel_id BIGINT NOT NULL,
    guild_id BIGINT NOT NULL,
    applicant_id BIGINT,  -- ID заявителя (может быть NULL если заявка с сайта)
    role_name TEXT NOT NULL,
    color1 TEXT NOT NULL,  -- Hex цвет без #
    members BIGINT[] NOT NULL DEFAULT '{}',  -- Массив Discord ID участников
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_gradient_role_requests_channel_id ON gradient_role_requests(channel_id);
CREATE INDEX IF NOT EXISTS idx_gradient_role_requests_guild_id ON gradient_role_requests(guild_id);
CREATE INDEX IF NOT EXISTS idx_gradient_role_requests_status ON gradient_role_requests(status);
CREATE INDEX IF NOT EXISTS idx_gradient_role_requests_message_id ON gradient_role_requests(message_id);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_gradient_role_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_gradient_role_requests_updated_at ON gradient_role_requests;
CREATE TRIGGER trigger_update_gradient_role_requests_updated_at
    BEFORE UPDATE ON gradient_role_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_gradient_role_requests_updated_at();

-- Комментарии к таблице
COMMENT ON TABLE gradient_role_requests IS 'Заявки на создание градиентных ролей Discord';
COMMENT ON COLUMN gradient_role_requests.message_id IS 'ID сообщения с embed заявки';
COMMENT ON COLUMN gradient_role_requests.channel_id IS 'ID канала заявки';
COMMENT ON COLUMN gradient_role_requests.guild_id IS 'ID сервера Discord';
COMMENT ON COLUMN gradient_role_requests.applicant_id IS 'ID пользователя, подавшего заявку';
COMMENT ON COLUMN gradient_role_requests.role_name IS 'Название роли';
COMMENT ON COLUMN gradient_role_requests.color1 IS 'Hex код цвета без решетки';
COMMENT ON COLUMN gradient_role_requests.members IS 'Массив Discord ID участников для роли';
COMMENT ON COLUMN gradient_role_requests.status IS 'Статус заявки: pending, approved, rejected';
