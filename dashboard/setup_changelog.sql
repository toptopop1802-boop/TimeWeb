-- Создание таблицы для хранения changelog записей
CREATE TABLE IF NOT EXISTS changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    build TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    views INTEGER DEFAULT 0,
    added JSONB DEFAULT '[]'::jsonb,
    fixed JSONB DEFAULT '[]'::jsonb,
    changed JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Создание индекса для быстрого поиска по дате
CREATE INDEX IF NOT EXISTS idx_changelog_date ON changelog(date DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_build ON changelog(build);

-- Комментарии к таблице
COMMENT ON TABLE changelog IS 'Таблица для хранения записей изменений (changelog)';
COMMENT ON COLUMN changelog.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN changelog.build IS 'Номер сборки (например, 3.11243.5025)';
COMMENT ON COLUMN changelog.subtitle IS 'Подзаголовок записи';
COMMENT ON COLUMN changelog.date IS 'Дата и время изменения';
COMMENT ON COLUMN changelog.views IS 'Количество просмотров';
COMMENT ON COLUMN changelog.added IS 'Массив строк с добавленными функциями';
COMMENT ON COLUMN changelog.fixed IS 'Массив строк с исправленными проблемами';
COMMENT ON COLUMN changelog.changed IS 'Массив строк с измененными функциями';

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_changelog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_changelog_updated_at
    BEFORE UPDATE ON changelog
    FOR EACH ROW
    EXECUTE FUNCTION update_changelog_updated_at();


