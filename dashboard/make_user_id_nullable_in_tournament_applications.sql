-- Делаем user_id необязательным в tournament_applications
-- Теперь можно добавлять заявки только по discord_id

ALTER TABLE tournament_applications 
ALTER COLUMN user_id DROP NOT NULL;

-- Обновляем комментарий к таблице
COMMENT ON COLUMN tournament_applications.user_id IS 'ID пользователя из таблицы users (необязательно, может быть NULL если добавлено через команду бота)';


