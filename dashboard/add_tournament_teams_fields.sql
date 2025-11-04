-- Миграция: Добавление полей для команд турнира
-- Выполните эту миграцию, если таблицы уже существуют

-- Добавляем поле team_number в tournament_applications если его еще нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tournament_applications' 
        AND column_name = 'team_number'
    ) THEN
        ALTER TABLE tournament_applications 
        ADD COLUMN team_number INTEGER;
        
        RAISE NOTICE 'Column team_number added to tournament_applications';
    ELSE
        RAISE NOTICE 'Column team_number already exists in tournament_applications';
    END IF;
END $$;

-- Добавляем поля team1_message_id и team2_message_id в tournament_registration_settings если их еще нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tournament_registration_settings' 
        AND column_name = 'team1_message_id'
    ) THEN
        ALTER TABLE tournament_registration_settings 
        ADD COLUMN team1_message_id BIGINT;
        
        RAISE NOTICE 'Column team1_message_id added to tournament_registration_settings';
    ELSE
        RAISE NOTICE 'Column team1_message_id already exists in tournament_registration_settings';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tournament_registration_settings' 
        AND column_name = 'team2_message_id'
    ) THEN
        ALTER TABLE tournament_registration_settings 
        ADD COLUMN team2_message_id BIGINT;
        
        RAISE NOTICE 'Column team2_message_id added to tournament_registration_settings';
    ELSE
        RAISE NOTICE 'Column team2_message_id already exists in tournament_registration_settings';
    END IF;
END $$;



