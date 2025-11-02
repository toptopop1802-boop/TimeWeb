-- Миграция: Добавление поля main_message_id в таблицу tournament_registration_settings
-- Выполните эту миграцию, если таблица уже существует

-- Добавляем поле main_message_id если его еще нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tournament_registration_settings' 
        AND column_name = 'main_message_id'
    ) THEN
        ALTER TABLE tournament_registration_settings 
        ADD COLUMN main_message_id BIGINT;
        
        RAISE NOTICE 'Column main_message_id added to tournament_registration_settings';
    ELSE
        RAISE NOTICE 'Column main_message_id already exists in tournament_registration_settings';
    END IF;
END $$;

