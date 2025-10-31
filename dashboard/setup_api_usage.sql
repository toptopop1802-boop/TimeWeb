    -- Логи использования API токенов
    CREATE TABLE IF NOT EXISTS api_usage_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        token_id UUID NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_api_usage_token ON api_usage_logs(token_id);
    CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage_logs(created_at DESC);


