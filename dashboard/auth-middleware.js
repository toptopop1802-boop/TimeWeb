// Middleware для проверки авторизации
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Генерация токена сессии
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Middleware для проверки аутентификации
async function requireAuth(req, res, next, supabase) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        console.log('🔐 [Auth] Checking token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
        
        if (!token) {
            console.log('   ❌ No token provided');
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        // Сначала проверяем как API токен (для Figma плагина и внешних API)
        const { data: apiToken, error: apiError } = await supabase
            .from('api_tokens')
            .select('*, users(*)')
            .eq('token', token)
            .eq('is_active', true)
            .maybeSingle();

        if (apiToken) {
            console.log('   ✅ Valid API token for user:', apiToken.users.username);
            req.user = apiToken.users;
            req.tokenType = 'api';
            
            // Обновляем last_used_at
            await supabase
                .from('api_tokens')
                .update({ last_used_at: new Date().toISOString() })
                .eq('id', apiToken.id);
            
            return next();
        }

        // Если не API токен - проверяем как сессию
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*, users(*)')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

        if (session) {
            console.log('   ✅ Valid session for user:', session.users.username);
            req.user = session.users;
            req.session = session;
            req.tokenType = 'session';
            return next();
        }

        console.log('   ❌ Invalid token - not found in api_tokens or sessions');
        return res.status(401).json({ error: 'Недействительная сессия' });
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        return res.status(401).json({ error: 'Ошибка авторизации' });
    }
}

// Middleware для проверки роли админа
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Требуются права администратора' });
    }
    next();
}

// Хеширование пароля
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

// Проверка пароля
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

module.exports = {
    requireAuth,
    requireAdmin,
    generateToken,
    hashPassword,
    verifyPassword
};

