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
        
        if (!token) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        // Проверяем токен в БД
        const { data: session, error } = await supabase
            .from('sessions')
            .select('*, users(*)')
            .eq('token', token)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error || !session) {
            return res.status(401).json({ error: 'Недействительная сессия' });
        }

        // Добавляем пользователя в request
        req.user = session.users;
        req.session = session;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
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

