-- Таблица метаданных изображений
CREATE TABLE IF NOT EXISTS images_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    short_code TEXT NOT NULL UNIQUE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_images_metadata_user_id ON images_metadata (user_id);
CREATE INDEX IF NOT EXISTS idx_images_metadata_short_code ON images_metadata (short_code);
CREATE INDEX IF NOT EXISTS idx_images_metadata_created_at ON images_metadata (created_at DESC);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для таблицы images_metadata
DROP TRIGGER IF EXISTS set_updated_at ON images_metadata;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON images_metadata
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Комментарии
COMMENT ON TABLE images_metadata IS 'Метаданные загруженных изображений';
COMMENT ON COLUMN images_metadata.image_id IS 'UUID изображения';
COMMENT ON COLUMN images_metadata.user_id IS 'ID пользователя, загрузившего изображение';
COMMENT ON COLUMN images_metadata.short_code IS 'Короткий код для публичного доступа (7 символов)';
COMMENT ON COLUMN images_metadata.view_count IS 'Количество просмотров изображения';

