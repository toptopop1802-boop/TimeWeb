const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Client, GatewayIntentBits } = require('discord.js');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cookieParser = require('cookie-parser');
let sharp = null; try { sharp = require('sharp'); } catch (_) { /* optional */ }
require('dotenv').config();

const { setupAuthRoutes } = require('./auth-routes');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const PORT = process.env.PORT || 3000;
const IS_SERVERLESS = !!process.env.VERCEL;
const GALLERY_PATH = process.env.GALLERY_PATH || '/gallery-images-bublick';

function createApp() {
    const app = express();

    // CORS middleware для всех запросов (в том числе для Figma Plugin)
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        
        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        
        next();
    });

    // Middleware
    app.use(cookieParser());

    // Configure multer for file uploads (memory storage for serverless)
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 100 * 1024 * 1024 // 100MB limit
        },
        fileFilter: (req, file, cb) => {
            if (path.extname(file.originalname).toLowerCase() === '.map') {
                cb(null, true);
            } else {
                cb(new Error('Только файлы .map разрешены'));
            }
        }
    });

    // =====================
    // Public Image Hosting
    // =====================
    const imageUpload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 15 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const ok = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
            cb(ok ? null : new Error('Допустимы только изображения PNG/JPG/GIF/WebP'), ok);
        }
    });

    // GET endpoint for upload info - HTML page
    app.get('/api/images/upload', (req, res) => {
        res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Upload API - Status</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, rgba(196,5,82,0.1) 0%, rgba(228,115,92,0.1) 100%), #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
        }
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            pointer-events: none;
            background:
                linear-gradient(0deg, rgba(0,0,0,0.02) 1px, transparent 1px) repeat-y,
                linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px) repeat-x;
            background-size: 24px 24px;
            z-index: 0;
        }
        .container {
            background: rgba(255, 255, 255, 0.98);
            border-radius: 20px;
            border: 1px solid rgba(196,5,82,0.1);
            box-shadow: 0 10px 40px rgba(196,5,82,0.08), 0 2px 8px rgba(0,0,0,0.04);
            padding: 50px;
            max-width: 700px;
            width: 100%;
            position: relative;
            z-index: 1;
        }
        .status {
            text-align: center;
            margin-bottom: 40px;
        }
        .status-icon {
            font-size: 72px;
            margin-bottom: 15px;
            animation: pulse 2s infinite;
            filter: drop-shadow(0 4px 8px rgba(40,167,69,0.3));
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        h1 {
            color: #212529;
            margin-bottom: 12px;
            font-size: 32px;
            font-weight: 700;
        }
        .subtitle {
            color: #6c757d;
            font-size: 18px;
            margin-bottom: 20px;
        }
        .subtitle strong {
            color: #28a745;
            font-weight: 700;
        }
        .info-card {
            background: #f8f9fa;
            border-left: 4px solid #c40552;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 0;
            border-bottom: 1px solid #dee2e6;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: 600;
            color: #495057;
            font-size: 15px;
        }
        .value {
            color: #c40552;
            font-weight: 600;
            font-size: 15px;
        }
        .formats {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .format-tag {
            background: linear-gradient(135deg, #c40552, #e4735c);
            color: white;
            padding: 6px 14px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 2px 6px rgba(196,5,82,0.25);
        }
        .example-code {
            background: #2d3748;
            color: #68d391;
            padding: 20px;
            border-radius: 12px;
            font-family: 'Courier New', Consolas, monospace;
            font-size: 13px;
            line-height: 1.6;
            overflow-x: auto;
            margin-top: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .back-btn {
            display: inline-block;
            margin-top: 30px;
            padding: 14px 28px;
            background: linear-gradient(135deg, #c40552, #e4735c);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 700;
            font-size: 15px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(196,5,82,0.3);
        }
        .back-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(196,5,82,0.4);
        }
        .back-btn:active {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="status">
            <div class="status-icon">✅</div>
            <h1>Image Upload API</h1>
            <div class="subtitle">Статус: <strong>РАБОТАЕТ</strong></div>
        </div>

        <div class="info-card">
            <div class="info-row">
                <span class="label">Метод:</span>
                <span class="value">POST</span>
            </div>
            <div class="info-row">
                <span class="label">Endpoint:</span>
                <span class="value">/api/images/upload</span>
            </div>
            <div class="info-row">
                <span class="label">Авторизация:</span>
                <span class="value">Bearer Token</span>
            </div>
            <div class="info-row">
                <span class="label">Поле формы:</span>
                <span class="value">image</span>
            </div>
            <div class="info-row">
                <span class="label">Макс. размер:</span>
                <span class="value">15 MB</span>
            </div>
            <div class="info-row">
                <span class="label">Форматы:</span>
                <div class="formats">
                    <span class="format-tag">PNG</span>
                    <span class="format-tag">JPG</span>
                    <span class="format-tag">JPEG</span>
                    <span class="format-tag">GIF</span>
                    <span class="format-tag">WebP</span>
                </div>
            </div>
        </div>

        <div class="example-code">
curl -X POST https://bublickrust.ru/api/images/upload \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "image=@your-image.png"
        </div>

        <center>
            <a href="/" class="back-btn">← Вернуться на главную</a>
        </center>
    </div>
</body>
</html>
        `);
    });

    // Authenticated upload, public read
    app.post('/api/images/upload', imageUpload.single('image'), async (req, res) => {
        try {
            console.log('📤 [Image Upload] Request received');
            console.log('   Headers:', JSON.stringify(req.headers, null, 2));
            console.log('   File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'NO FILE');
            
            if (!supabase) {
                console.log('   ❌ Supabase not configured');
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Require auth
            let currentUser = null;
            await requireAuth(req, res, async () => { currentUser = req.user; }, supabase);
            if (!currentUser) {
                console.log('   ❌ Auth failed');
                return;
            }
            
            console.log('   ✅ Authenticated as:', currentUser.username || currentUser.id);

            // API usage log (per token)
            try {
                if (req.tokenType === 'api' && req.apiTokenId) {
                    await supabase
                        .from('api_usage_logs')
                        .insert({ token_id: req.apiTokenId, endpoint: 'images/upload' });
                }
            } catch (e) {
                console.warn('   ⚠️ Failed to log API usage:', e.message);
            }

            if (!req.file) return res.status(400).json({ error: 'Файл не получен' });

            const ext = path.extname(req.file.originalname).toLowerCase();
            const id = uuidv4();
            const storagePath = `images/${id}${ext}`;

            const { error: upErr } = await supabase.storage
                .from('images')
                .upload(storagePath, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });
            
            if (upErr) {
                if (upErr.message && upErr.message.includes('Bucket not found')) {
                    return res.status(503).json({ error: 'Bucket "images" не создан в Supabase Storage. Создайте его в Dashboard.' });
                }
                throw upErr;
            }

            // Short code derived from id
            const cleaned = id.replace(/-/g, '');
            const hash = cleaned.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
            const shortCode = Math.abs(hash).toString(36).substring(0, 7).toUpperCase().padEnd(7, '0');

            // Сохраняем метаданные в таблицу images_metadata
            try {
                const { error: metaError } = await supabase
                    .from('images_metadata')
                    .insert({
                        image_id: id,
                        user_id: currentUser.id,
                        original_name: req.file.originalname,
                        file_size: req.file.size,
                        mime_type: req.file.mimetype,
                        storage_path: storagePath,
                        short_code: shortCode
                    });
                
                if (metaError) {
                    console.error('   ⚠️  Failed to save image metadata:', metaError);
                } else {
                    console.log('   ✅ Image metadata saved:', shortCode);
                }
            } catch (metaErr) {
                console.error('   ⚠️  Image metadata error:', metaErr);
            }

            // Логируем действие пользователя
            await logUserAction(currentUser.id, 'image_upload', {
                image_id: id,
                short_code: shortCode,
                original_name: req.file.originalname,
                file_size: req.file.size
            });

            // Public direct URL via our domain
            const base = process.env.PUBLIC_BASE_URL || (req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers.host}` : `${req.protocol}://${req.get('host')}`);
            const directUrl = `${base}/i/${shortCode}`;

            console.log('   🎉 Upload complete:', directUrl);

            res.json({ success: true, id, shortCode, directUrl });
        } catch (error) {
            console.error('Image upload error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // List images (admin only)
    app.get('/api/images/list', async (req, res) => {
        // Admin gate
        await requireAuth(req, res, async () => {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Требуются права администратора' });
            }
        }, supabase);
        if (!req.user || req.user.role !== 'admin') return;
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 60, 1), 200);
            const offset = Math.max(parseInt(req.query.offset) || 0, 0);
            const q = (req.query.q || '').trim();
            const sort = (req.query.sort || 'created_at:desc').toLowerCase();
            const [sortField, sortDir] = sort.split(':');

            const base = process.env.PUBLIC_BASE_URL || (req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers.host}` : `${req.protocol}://${req.get('host')}`);

            // 1) Пробуем читать из БД (быстро)
            try {
                let query = supabase
                    .from('images_metadata')
                    .select('image_id, user_id, original_name, file_size, mime_type, storage_path, short_code, created_at', { count: 'exact' });

                // Сортировка
                const allowedSort = new Set(['created_at', 'file_size', 'original_name', 'short_code']);
                const field = allowedSort.has(sortField) ? sortField : 'created_at';
                const asc = (sortDir === 'asc');
                query = query.order(field, { ascending: asc });

                if (q) {
                    query = query.or(`original_name.ilike.%${q}%,short_code.ilike.%${q}%`);
                }

                query = query.range(offset, offset + limit - 1);

                const { data, error, count } = await query;
                if (!error && Array.isArray(data)) {
                    const items = data.map(row => ({
                        ...row,
                        directUrl: `${base}/i/${row.short_code}`
                    }));
                    const totalBytes = items.reduce((s, x) => s + (x.file_size || 0), 0);
                    res.setHeader('Cache-Control', 'no-store');
                    return res.json({ items, count: count ?? items.length, offset, limit, totalBytes });
                }
                // если ошибка — перейдём к резервному способу
                if (error) console.warn('images/list meta fallback:', error.message);
            } catch (metaErr) {
                console.warn('images/list meta try failed:', metaErr.message);
            }

            // 2) Резерв: листинг бакета Storage
            const { data: files, error: storageError } = await supabase.storage
                .from('images')
                .list('images', { limit, offset, sortBy: { column: 'created_at', order: 'desc' } });
            if (storageError) throw storageError;

            const items = (files || []).map(f => {
                const ext = path.extname(f.name);
                const id = path.basename(f.name, ext).replace(/-/g, '');
                const hash = id.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
                const short = Math.abs(hash).toString(36).substring(0, 7).toUpperCase().padEnd(7, '0');
                return {
                    image_id: id,
                    original_name: f.name,
                    file_size: parseInt((f?.metadata?.size) || (f?.size) || '0'),
                    mime_type: null,
                    storage_path: f.name.startsWith('images/') ? f.name : `images/${f.name}`,
                    short_code: short,
                    created_at: f.created_at || f.last_modified || null,
                    directUrl: `${base}/i/${short}`
                };
            });
            // Сортировка на стороне сервера для fallback
            items.sort((a,b)=>{
                if (sortField === 'file_size') return (a.file_size||0) - (b.file_size||0);
                if (sortField === 'original_name') return String(a.original_name||'').localeCompare(String(b.original_name||''));
                if (sortField === 'short_code') return String(a.short_code||'').localeCompare(String(b.short_code||''));
                // default created_at desc
                return new Date(a.created_at||0) - new Date(b.created_at||0);
            });
            if (sortDir !== 'asc') items.reverse();
            const totalBytes = items.reduce((s, x) => s + (x.file_size || 0), 0);
            res.setHeader('Cache-Control', 'no-store');
            return res.json({ items, count: items.length, offset, limit, totalBytes });
        } catch (e) {
            console.error('Image list error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Daily stats for images (counts and bytes)
    app.get('/api/images/stats', async (req, res) => {
        // Admin gate
        await requireAuth(req, res, async () => {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Требуются права администратора' });
            }
        }, supabase);
        if (!req.user || req.user.role !== 'admin') return;
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
            const since = new Date(); since.setDate(since.getDate() - days);

            // Prefer DB
            let records = [];
            const { data, error } = await supabase
                .from('images_metadata')
                .select('created_at, file_size')
                .gte('created_at', since.toISOString())
                .order('created_at', { ascending: true });
            if (!error && Array.isArray(data)) {
                records = data.map(r => ({ created_at: r.created_at, file_size: r.file_size || 0 }));
            } else {
                // Fallback to storage list (limited)
                for (let offset = 0; offset < 5000; offset += 1000) {
                    const { data: files, error: listErr } = await supabase.storage
                        .from('images')
                        .list('images', { limit: 1000, offset, sortBy: { column: 'created_at', order: 'asc' } });
                    if (listErr || !files || files.length === 0) break;
                    files.forEach(f => {
                        const ts = f.created_at || f.last_modified;
                        if (ts && new Date(ts) >= since) {
                            records.push({ created_at: ts, file_size: parseInt((f?.metadata?.size) || (f?.size) || '0') });
                        }
                    });
                    if (files.length < 1000) break;
                }
            }

            // Aggregate per-day
            const dayMap = new Map();
            records.forEach(r => {
                const day = new Date(r.created_at).toISOString().slice(0,10);
                if (!dayMap.has(day)) dayMap.set(day, { date: day, count: 0, bytes: 0 });
                const row = dayMap.get(day);
                row.count += 1;
                row.bytes += r.file_size || 0;
            });
            const timeline = Array.from(dayMap.values()).sort((a,b)=> a.date.localeCompare(b.date));
            const totalCount = timeline.reduce((s,x)=>s+x.count,0);
            const totalBytes = timeline.reduce((s,x)=>s+x.bytes,0);
            res.json({ days, totalCount, totalBytes, timeline });
        } catch (e) {
            console.error('Images stats error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Delete image by short code (admin only)
    app.delete('/api/images/:shortCode([A-Z0-9]{7})', async (req, res) => {
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            await requireAuth(req, res, async ()=>{}, supabase);
            if (!req.user || req.user.role !== 'admin') return; // requireAuth already sent response when unauthorized
            const { shortCode } = req.params;

            // Resolve storage path via DB first
            let storagePath = null; let metaId = null;
            try {
                const { data: row } = await supabase
                    .from('images_metadata')
                    .select('id, storage_path')
                    .eq('short_code', shortCode)
                    .maybeSingle();
                if (row) { storagePath = row.storage_path; metaId = row.id; }
            } catch(_) {}
            if (!storagePath) {
                // fallback scan
                for (let offset = 0; offset < 5000; offset += 500) {
                    const { data: files } = await supabase.storage.from('images').list('images', { limit: 500, offset });
                    if (!files || files.length === 0) break;
                    const found = files.find(f => {
                        const ext = path.extname(f.name);
                        const id = path.basename(f.name, ext).replace(/-/g,'');
                        const code = Math.abs(id.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0)).toString(36).substring(0,7).toUpperCase().padEnd(7,'0');
                        return code === shortCode;
                    });
                    if (found) { storagePath = found.name.startsWith('images/') ? found.name : `images/${found.name}`; break; }
                    if (files.length < 500) break;
                }
            }
            if (!storagePath) return res.status(404).json({ error: 'Не найдено' });

            // Delete from storage
            const { error: delErr } = await supabase.storage.from('images').remove([storagePath]);
            if (delErr) throw delErr;
            if (metaId) await supabase.from('images_metadata').delete().eq('id', metaId);
            res.json({ success: true });
        } catch (e) {
            console.error('Delete image error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Public image by short code
    app.get('/i/:shortCode([A-Z0-9]{7})', async (req, res) => {
        try {
            if (!supabase) return res.status(503).send('Supabase not configured');
            const shortCode = req.params.shortCode;

            // 1) Пытаемся найти запись напрямую в БД (самый быстрый и консистентный способ)
            let storagePath = null;
            try {
                const { data: row, error: metaErr } = await supabase
                    .from('images_metadata')
                    .select('storage_path')
                    .eq('short_code', shortCode)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                if (!metaErr && row && row.storage_path) {
                    storagePath = row.storage_path;
                }
            } catch (e) {
                // игнорируем и используем резервный путь
            }

            // 2) Резервный путь — сканируем bucket постранично и вычисляем код (дороже, но надёжно)
            if (!storagePath) {
                const PAGE = 500; // до 500 файлов за запрос
                for (let offset = 0; offset < 5000; offset += PAGE) { // ограничим до ~5000 файлов на поиск
                    const { data: files, error: listErr } = await supabase.storage
                        .from('images')
                        .list('images', { limit: PAGE, offset, sortBy: { column: 'created_at', order: 'desc' } });
                    if (listErr) break;
                    if (!files || files.length === 0) break;

                    const found = files.find(f => {
                        const ext = path.extname(f.name);
                        const fileId = path.basename(f.name, ext);
                        const cleaned = fileId.replace(/-/g, '');
                        const hash = cleaned.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
                        const code = Math.abs(hash).toString(36).substring(0, 7).toUpperCase().padEnd(7, '0');
                        return code === shortCode;
                    });
                    if (found) {
                        storagePath = found.name.startsWith('images/') ? found.name : `images/${found.name}`;
                        break;
                    }
                    if (files.length < PAGE) break; // достигли конца
                }
            }

            if (!storagePath) return res.status(404).send('Not found');

            const { data, error } = await supabase.storage.from('images').download(storagePath);
            if (error || !data) return res.status(404).send('Not found');

            const arrayBuffer = await data.arrayBuffer();
            const original = Buffer.from(arrayBuffer);

            // Optional resizing for thumbnails
            const w = parseInt(req.query.w);
            const h = parseInt(req.query.h);
            const q = Math.min(Math.max(parseInt(req.query.q) || 75, 10), 95);
            const wantResize = sharp && ((w && w > 0) || (h && h > 0));
            if (wantResize) {
                try {
                    const s = sharp(original, { failOn: 'none' });
                    if (w || h) s.resize({ width: w || null, height: h || null, fit: 'inside' });
                    const webp = await s.webp({ quality: q }).toBuffer();
                    res.setHeader('Content-Type', 'image/webp');
                    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
                    res.setHeader('Content-Length', webp.length);
                    return res.send(webp);
                } catch (e) {
                    console.warn('Resize failed, sending original:', e.message);
                }
            }

            const ext = path.extname(storagePath).toLowerCase();
            const type = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'application/octet-stream';
            res.setHeader('Content-Type', type);
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            res.setHeader('Content-Length', original.length);
            res.send(original);
        } catch (error) {
            console.error('Public image error:', error);
            res.status(500).send('Internal error');
        }
    });
    // Middleware
    app.use(cors());
    app.use(express.json());

    // Supabase Client (guard missing env)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    let supabase = null;
    if (SUPABASE_URL && SUPABASE_KEY) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.warn('⚠️  SUPABASE_URL or SUPABASE_KEY is not set. Supabase-dependent endpoints will return 503.');
    }

    // Discord Client (disable on serverless)
    let discordReady = false;
    const discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    if (!IS_SERVERLESS && process.env.DISCORD_BOT_TOKEN) {
        discordClient.once('ready', () => {
            console.log(`✅ Discord bot connected as ${discordClient.user.tag}`);
            discordReady = true;
        });
        discordClient.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
            console.error('❌ Failed to login to Discord:', err);
        });
    } else if (IS_SERVERLESS) {
        console.warn('⚠️  Discord features are disabled in serverless environment.');
    }

    // ============================================
    // API ENDPOINTS
    // ============================================

    // Setup auth routes
    if (supabase) {
        setupAuthRoutes(app, supabase);
        console.log('✅ Auth routes initialized');
    }

    // Получить статистику за период
    app.get('/api/stats', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }
            const days = parseInt(req.query.days) || 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const { data, error } = await supabase
                .from('server_analytics')
                .select('*')
                .gte('created_at', cutoffDate.toISOString())
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Группируем по типам событий
            const stats = {
                wipe_created: 0,
                ticket_created: 0,
                tournament_role_created: 0,
                channel_deleted: 0,
                member_count: 0,
                timeline: []
            };

            const timelineMap = new Map();

            data.forEach(event => {
                // Подсчет по типам
                stats[event.event_type] = (stats[event.event_type] || 0) + 1;

                // Временная шкала (по дням)
                const date = new Date(event.created_at).toISOString().split('T')[0];
                if (!timelineMap.has(date)) {
                    timelineMap.set(date, {
                        date,
                        wipe_created: 0,
                        ticket_created: 0,
                        tournament_role_created: 0,
                        channel_deleted: 0,
                        member_count: 0,
                        wipe_signup_looking: 0,
                        wipe_signup_ready: 0,
                        wipe_signup_not_coming: 0
                    });
                }
                const dayStats = timelineMap.get(date);
                if (event.event_type === 'member_count') {
                    const count = (event.event_data && (event.event_data.count || event.event_data["count"])) || 0;
                    // сохраняем последний или максимальный на день
                    dayStats.member_count = Math.max(dayStats.member_count || 0, count);
                    stats.member_count = Math.max(stats.member_count || 0, count);
                } else {
                    dayStats[event.event_type] = (dayStats[event.event_type] || 0) + 1;
                    stats[event.event_type] = (stats[event.event_type] || 0) + 1;
                }
            });

            // Получаем статистику записи на вайп из отдельной таблицы
            const { data: wipeSignupData, error: wipeSignupError } = await supabase
                .from('wipe_signup_stats')
                .select('*')
                .gte('created_at', cutoffDate.toISOString())
                .order('created_at', { ascending: true });

            if (!wipeSignupError && wipeSignupData) {
                stats.wipe_signup_looking = 0;
                stats.wipe_signup_ready = 0;
                stats.wipe_signup_not_coming = 0;

                wipeSignupData.forEach(signup => {
                    const date = new Date(signup.created_at).toISOString().split('T')[0];
                    
                    // Убедимся что дата есть в timeline
                    if (!timelineMap.has(date)) {
                        timelineMap.set(date, {
                            date,
                            wipe_created: 0,
                            ticket_created: 0,
                            tournament_role_created: 0,
                            channel_deleted: 0,
                            member_count: 0,
                            wipe_signup_looking: 0,
                            wipe_signup_ready: 0,
                            wipe_signup_not_coming: 0
                        });
                    }
                    
                    const dayStats = timelineMap.get(date);
                    
                    // Подсчитываем по типам
                    if (signup.signup_type === 'looking') {
                        stats.wipe_signup_looking++;
                        dayStats.wipe_signup_looking++;
                    } else if (signup.signup_type === 'ready') {
                        stats.wipe_signup_ready++;
                        dayStats.wipe_signup_ready++;
                    } else if (signup.signup_type === 'not_coming') {
                        stats.wipe_signup_not_coming++;
                        dayStats.wipe_signup_not_coming++;
                    }
                });
            }

            stats.timeline = Array.from(timelineMap.values());
            stats.total = data.length;

            res.json(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить статистику записи на вайп
    app.get('/api/wipe-signup-stats', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }
            const days = parseInt(req.query.days) || 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const { data, error } = await supabase
                .from('wipe_signup_stats')
                .select('*')
                .gte('created_at', cutoffDate.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Подсчёт статистики
            const stats = {
                looking_total: 0,      // Всего ищут игроков
                looking_count: 0,      // Сколько всего слотов ищут
                ready_total: 0,        // Сколько готовы зайти
                not_coming_total: 0,   // Сколько не зайдут
                recent_signups: [],    // Последние 50 записей
                timeline: []           // По дням
            };

            const timelineMap = new Map();

            data.forEach((signup, index) => {
                const date = new Date(signup.created_at).toISOString().split('T')[0];
                
                // Инициализируем день если нет
                if (!timelineMap.has(date)) {
                    timelineMap.set(date, {
                        date,
                        looking: 0,
                        looking_count: 0,
                        ready: 0,
                        not_coming: 0
                    });
                }
                const dayStats = timelineMap.get(date);

                // Подсчёт по типам
                if (signup.signup_type === 'looking') {
                    stats.looking_total++;
                    const count = signup.player_count || 1;
                    stats.looking_count += count;
                    dayStats.looking++;
                    dayStats.looking_count += count;
                } else if (signup.signup_type === 'ready') {
                    stats.ready_total++;
                    dayStats.ready++;
                } else if (signup.signup_type === 'not_coming') {
                    stats.not_coming_total++;
                    dayStats.not_coming++;
                }

                // Последние 50 записей
                if (index < 50) {
                    stats.recent_signups.push({
                        type: signup.signup_type,
                        user_id: signup.user_id,
                        count: signup.player_count || 0,
                        message_content: signup.message_content,
                        created_at: signup.created_at
                    });
                }
            });

            stats.timeline = Array.from(timelineMap.values()).reverse();
            stats.total = data.length;

            res.json(stats);
        } catch (error) {
            console.error('Error fetching wipe signup stats:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить активные каналы для автоудаления
    app.get('/api/auto-delete-channels', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }
            const { data, error } = await supabase
                .from('auto_delete_channels')
                .select('*')
                .eq('status', 'active')
                .order('delete_at', { ascending: true });

            if (error) throw error;

            // Добавляем оставшееся время
            const now = new Date();
            const channels = data.map(ch => ({
                ...ch,
                time_left_seconds: Math.max(0, Math.floor((new Date(ch.delete_at) - now) / 1000))
            }));

            res.json(channels);
        } catch (error) {
            console.error('Error fetching auto-delete channels:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // RUST SERVER REPORTING API
    // ============================================

    // Report current players from Rust plugin
    app.post('/api/rust/players/report', async (req, res) => {
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            // Require auth (API token or session)
            let currentUser = null;
            await requireAuth(req, res, async () => { currentUser = req.user; }, supabase);
            if (!currentUser) return; // middleware already replied

            const body = req.body || {};
            const serverName = (body.server && body.server.name) || null;
            const players = Array.isArray(body.players) ? body.players : [];

            if (players.length === 0) {
                return res.json({ success: true, updated: 0 });
            }

            // Upsert players
            const rows = players.map(p => ({
                steam_id: String(p.steamId || p.userId || ''),
                name: p.name || null,
                ip: p.ip || null,
                team_id: p.teamId ? String(p.teamId) : null,
                team_members: p.teamMembers ? p.teamMembers : null,
                grid: p.grid || null,
                x: typeof p.x === 'number' ? p.x : null,
                y: typeof p.y === 'number' ? p.y : null,
                z: typeof p.z === 'number' ? p.z : null,
                online: p.online !== false, // default true
                server_name: serverName,
                last_seen: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })).filter(r => r.steam_id);

            const { error: upErr } = await supabase
                .from('rust_players')
                .upsert(rows, { onConflict: 'steam_id' });

            if (upErr) throw upErr;

            // Optionally mark others offline from previous session (skip: requires server identity)

            res.json({ success: true, updated: rows.length });
        } catch (error) {
            console.error('Rust report error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // List last known players (admin only)
    app.get('/api/rust/players', async (req, res) => {
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            await requireAuth(req, res, async () => {}, supabase);
            if (!req.user || req.user.role !== 'admin') return; // only admins

            const limit = Math.min(Math.max(parseInt(req.query.limit) || 1000, 1), 5000);
            const { data, error } = await supabase
                .from('rust_players')
                .select('*')
                .order('online', { ascending: false })
                .order('updated_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            res.json(data || []);
        } catch (error) {
            console.error('Rust players list error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // PLAYER STATISTICS API
    // ============================================

    // Report kills from Rust plugin (similar to RustApp)
    app.post('/api/rust/kills/report', async (req, res) => {
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            let currentUser = null;
            await requireAuth(req, res, async () => { currentUser = req.user; }, supabase);
            if (!currentUser) return;

            const body = req.body || {};
            const kills = Array.isArray(body.kills) ? body.kills : [];

            if (kills.length === 0) {
                return res.json({ success: true, inserted: 0 });
            }

            let inserted = 0;
            for (const kill of kills) {
                // Insert kill
                const { data: killData, error: killError } = await supabase
                    .from('player_kills')
                    .insert({
                        initiator_steam_id: String(kill.initiator_steam_id || ''),
                        target_steam_id: String(kill.target_steam_id || ''),
                        game_time: kill.game_time || null,
                        distance: kill.distance || 0,
                        weapon: kill.weapon || null,
                        is_headshot: kill.is_headshot || false
                    })
                    .select('id')
                    .single();

                if (killError) {
                    console.error('Error inserting kill:', killError);
                    continue;
                }

                // Insert combat logs
                if (kill.hit_history && Array.isArray(kill.hit_history) && kill.hit_history.length > 0) {
                    const combatLogs = kill.hit_history.map(log => ({
                        kill_id: killData.id,
                        time: log.time || 0,
                        attacker_steam_id: log.attacker_steam_id || null,
                        target_steam_id: log.target_steam_id || null,
                        attacker: log.attacker || null,
                        target: log.target || null,
                        weapon: log.weapon || null,
                        ammo: log.ammo || null,
                        bone: log.bone || null,
                        distance: log.distance || 0,
                        hp_old: log.hp_old || 0,
                        hp_new: log.hp_new || 0,
                        info: log.info || null,
                        proj_hits: log.proj_hits || 0,
                        pi: log.pi || 0,
                        proj_travel: log.proj_travel || 0,
                        pm: log.pm || 0,
                        desync: log.desync || 0,
                        ad: log.ad || false
                    }));

                    const { error: logsError } = await supabase
                        .from('combat_logs')
                        .insert(combatLogs);

                    if (logsError) {
                        console.error('Error inserting combat logs:', logsError);
                    }
                }

                // Update player statistics
                await updatePlayerStats(kill.initiator_steam_id, kill.target_steam_id, kill);

                inserted++;
            }

            res.json({ success: true, inserted });
        } catch (error) {
            console.error('Rust kills report error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Helper function to update player statistics
    async function updatePlayerStats(initiatorSteamId, targetSteamId, kill) {
        try {
            // Count hits by bone type from hit_history
            let headshotsCount = 0;
            let torsoHitsCount = 0;
            let limbHitsCount = 0;

            if (kill.hit_history && Array.isArray(kill.hit_history)) {
                kill.hit_history.forEach(log => {
                    const bone = (log.bone || '').toLowerCase();
                    if (bone === 'head' || bone === 'head.head') {
                        headshotsCount++;
                    } else if (bone === 'torso' || bone === 'chest' || bone === 'spine' || bone === 'spine1' || bone === 'spine2' || bone === 'spine3' || bone === 'spine4') {
                        torsoHitsCount++;
                    } else if (bone && bone !== '') {
                        limbHitsCount++;
                    }
                });
            }

            // If is_headshot is true but no head hits in history, count it
            if (kill.is_headshot && headshotsCount === 0) {
                headshotsCount = 1;
            }

            // Update initiator stats (kills)
            const { data: initiatorStats } = await supabase
                .from('player_statistics')
                .select('*')
                .eq('steam_id', initiatorSteamId)
                .single();

            if (initiatorStats) {
                await supabase
                    .from('player_statistics')
                    .update({
                        total_kills: (initiatorStats.total_kills || 0) + 1,
                        headshots: (initiatorStats.headshots || 0) + headshotsCount,
                        torso_hits: (initiatorStats.torso_hits || 0) + torsoHitsCount,
                        limb_hits: (initiatorStats.limb_hits || 0) + limbHitsCount,
                        last_updated: new Date().toISOString()
                    })
                    .eq('steam_id', initiatorSteamId);
            } else {
                await supabase
                    .from('player_statistics')
                    .insert({
                        steam_id: initiatorSteamId,
                        total_kills: 1,
                        headshots: headshotsCount,
                        total_deaths: 0,
                        torso_hits: torsoHitsCount,
                        limb_hits: limbHitsCount,
                        total_reports: 0,
                        total_hours_played: 0
                    });
            }

            // Update target stats (deaths)
            const { data: targetStats } = await supabase
                .from('player_statistics')
                .select('*')
                .eq('steam_id', targetSteamId)
                .single();

            if (targetStats) {
                await supabase
                    .from('player_statistics')
                    .update({
                        total_deaths: (targetStats.total_deaths || 0) + 1,
                        last_updated: new Date().toISOString()
                    })
                    .eq('steam_id', targetSteamId);
            } else {
                await supabase
                    .from('player_statistics')
                    .insert({
                        steam_id: targetSteamId,
                        total_kills: 0,
                        headshots: 0,
                        total_deaths: 1,
                        torso_hits: 0,
                        limb_hits: 0,
                        total_reports: 0,
                        total_hours_played: 0
                    });
            }
        } catch (error) {
            console.error('Error updating player stats:', error);
        }
    }

    // Demo data generator function
    function generateDemoPlayerStats(steamId, days = 7) {
        // Generate random but realistic stats
        const killsPeriod = Math.floor(Math.random() * 50) + 10;
        const deathsPeriod = Math.floor(Math.random() * 40) + 5;
        const totalKills = Math.floor(Math.random() * 200) + 50;
        const totalDeaths = Math.floor(Math.random() * 150) + 30;
        const headshots = Math.floor(killsPeriod * (0.3 + Math.random() * 0.3)); // 30-60% headshots
        const torsoHits = Math.floor(killsPeriod * (0.2 + Math.random() * 0.2)); // 20-40% torso
        const limbHits = killsPeriod - headshots - torsoHits;
        const hoursPlayed = Math.floor(Math.random() * 200) + 50;
        const totalReports = Math.floor(Math.random() * 10);

        return {
            steam_id: steamId,
            kd_ratio: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2),
            total_kills: totalKills,
            total_deaths: totalDeaths,
            kills_period: killsPeriod,
            deaths_period: deathsPeriod,
            headshots: headshots,
            torso_hits: torsoHits,
            limb_hits: limbHits,
            total_reports: totalReports,
            hours_played: hoursPlayed,
            recent_kills: Array.from({ length: Math.min(10, killsPeriod) }, (_, i) => ({
                id: `demo-kill-${i}`,
                initiator_steam_id: steamId,
                target_steam_id: `76561198${Math.floor(Math.random() * 1000000000)}`,
                game_time: new Date(Date.now() - i * 3600000).toISOString(),
                distance: Math.floor(Math.random() * 200) + 10,
                weapon: ['AK47', 'LR300', 'M4', 'MP5', 'Bolt Action Rifle', 'L96'][Math.floor(Math.random() * 6)],
                is_headshot: Math.random() > 0.5,
                created_at: new Date(Date.now() - i * 3600000).toISOString()
            }))
        };
    }

    // Get player statistics
    app.get('/api/player-stats/:steamId', async (req, res) => {
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            await requireAuth(req, res, async () => {}, supabase);
            if (!req.user) return;

            const { steamId } = req.params;
            const days = parseInt(req.query.days) || 7;
            const useDemo = req.query.demo === 'true' || req.query.demo === '1';

            // Return demo data if requested
            if (useDemo) {
                return res.json(generateDemoPlayerStats(steamId, days));
            }

            // Get player statistics
            const { data: stats, error: statsError } = await supabase
                .from('player_statistics')
                .select('*')
                .eq('steam_id', steamId)
                .single();

            if (statsError && statsError.code !== 'PGRST116') {
                throw statsError;
            }

            // If player doesn't exist, return demo data
            if (!stats) {
                return res.json(generateDemoPlayerStats(steamId, days));
            }

            const playerStats = stats;

            // Get kills in period
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - days);
            
            const { data: kills, error: killsError } = await supabase
                .from('player_kills')
                .select('*')
                .eq('initiator_steam_id', steamId)
                .gte('created_at', dateFrom.toISOString())
                .order('created_at', { ascending: false });

            if (killsError) throw killsError;

            // Get deaths in period
            const { data: deaths, error: deathsError } = await supabase
                .from('player_kills')
                .select('*')
                .eq('target_steam_id', steamId)
                .gte('created_at', dateFrom.toISOString())
                .order('created_at', { ascending: false });

            if (deathsError) throw deathsError;

            // Calculate hit locations from combat logs
            const killIds = kills ? kills.map(k => k.id) : [];
            let headshots = 0, torsoHits = 0, limbHits = 0;

            if (killIds.length > 0) {
                const { data: combatLogs } = await supabase
                    .from('combat_logs')
                    .select('bone')
                    .in('kill_id', killIds);

                if (combatLogs && combatLogs.length > 0) {
                    combatLogs.forEach(log => {
                        const bone = (log.bone || '').toLowerCase();
                        if (bone === 'head' || bone === 'head.head') {
                            headshots++;
                        } else if (bone === 'torso' || bone === 'chest' || bone === 'spine' || bone === 'spine1' || bone === 'spine2' || bone === 'spine3' || bone === 'spine4') {
                            torsoHits++;
                        } else if (bone && bone !== '') {
                            limbHits++;
                        }
                    });
                }
            }

            // Fallback: if no combat logs but we have kills with is_headshot flag
            if (headshots === 0 && torsoHits === 0 && limbHits === 0 && kills && kills.length > 0) {
                kills.forEach(kill => {
                    if (kill.is_headshot) {
                        headshots++;
                    }
                });
            }

            // Calculate hours played (mock for now - should be calculated from sessions)
            const hoursPlayed = playerStats.total_hours_played || 0;

            res.json({
                steam_id: steamId,
                kd_ratio: playerStats.total_deaths > 0 ? (playerStats.total_kills / playerStats.total_deaths).toFixed(2) : playerStats.total_kills.toFixed(2),
                total_kills: playerStats.total_kills,
                total_deaths: playerStats.total_deaths,
                kills_period: kills ? kills.length : 0,
                deaths_period: deaths ? deaths.length : 0,
                headshots,
                torso_hits: torsoHits,
                limb_hits: limbHits,
                total_reports: playerStats.total_reports || 0,
                hours_played: hoursPlayed,
                recent_kills: kills ? kills.slice(0, 10) : []
            });
        } catch (error) {
            console.error('Get player stats error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get combat log for a specific kill
    app.get('/api/player-stats/:steamId/combatlog/:killId', async (req, res) => {
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            await requireAuth(req, res, async () => {}, supabase);
            if (!req.user) return;

            const { killId } = req.params;

            const { data: combatLogs, error } = await supabase
                .from('combat_logs')
                .select('*')
                .eq('kill_id', killId)
                .order('time', { ascending: false });

            if (error) throw error;

            res.json(combatLogs || []);
        } catch (error) {
            console.error('Get combat log error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get player kills list (for combat log table)
    app.get('/api/player-stats/:steamId/kills', async (req, res) => {
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            await requireAuth(req, res, async () => {}, supabase);
            if (!req.user) return;

            const { steamId } = req.params;
            const limit = Math.min(parseInt(req.query.limit) || 50, 200);

            const { data: kills, error } = await supabase
                .from('player_kills')
                .select(`
                    *,
                    combat_logs (
                        time,
                        attacker,
                        target,
                        weapon,
                        ammo,
                        bone,
                        distance,
                        hp_old,
                        hp_new,
                        info
                    )
                `)
                .or(`initiator_steam_id.eq.${steamId},target_steam_id.eq.${steamId}`)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            res.json(kills || []);
        } catch (error) {
            console.error('Get player kills error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить список серверов
    app.get('/api/guilds', async (req, res) => {
        try {
            if (IS_SERVERLESS || !discordReady) {
                return res.status(503).json({ error: 'Discord bot not available' });
            }

            const guilds = discordClient.guilds.cache.map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL(),
                memberCount: guild.memberCount
            }));

            res.json(guilds);
        } catch (error) {
            console.error('Error fetching guilds:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить каналы сервера
    app.get('/api/guilds/:guildId/channels', async (req, res) => {
        try {
            if (IS_SERVERLESS || !discordReady) {
                return res.status(503).json({ error: 'Discord bot not available' });
            }

            const guild = discordClient.guilds.cache.get(req.params.guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Guild not found' });
            }

            const channels = guild.channels.cache
                .filter(ch => ch.isTextBased())
                .map(ch => ({
                    id: ch.id,
                    name: ch.name,
                    type: ch.type
                }));

            res.json(channels);
        } catch (error) {
            console.error('Error fetching channels:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить сообщения из канала
    app.get('/api/channels/:channelId/messages', async (req, res) => {
        try {
            if (IS_SERVERLESS || !discordReady) {
                return res.status(503).json({ error: 'Discord bot not available' });
            }

            const channel = await discordClient.channels.fetch(req.params.channelId);
            if (!channel || !channel.isTextBased()) {
                return res.status(404).json({ error: 'Channel not found or not text-based' });
            }

            const messages = await channel.messages.fetch({ limit: 50 });
            
            const formattedMessages = messages.map(msg => ({
                id: msg.id,
                content: msg.content,
                author: msg.author.tag,
                authorId: msg.author.id,
                timestamp: msg.createdAt.toISOString(),
                attachments: msg.attachments.map(att => ({
                    url: att.url,
                    name: att.name
                }))
            })).reverse();

            res.json(formattedMessages);
        } catch (error) {
            console.error('Error fetching messages:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Отправить сообщение от имени бота
    app.post('/api/send-message', async (req, res) => {
        try {
            if (IS_SERVERLESS || !discordReady) {
                return res.status(503).json({ error: 'Discord bot not available' });
            }

            const { channelId, content, embed } = req.body;

            if (!channelId || (!content && !embed)) {
                return res.status(400).json({ error: 'channelId and content/embed are required' });
            }

            const channel = await discordClient.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                return res.status(404).json({ error: 'Channel not found or not text-based' });
            }

            const messageOptions = {};
            if (content) messageOptions.content = content;
            if (embed) messageOptions.embeds = [embed];

            const message = await channel.send(messageOptions);

            res.json({
                success: true,
                messageId: message.id,
                channelId: message.channelId
            });
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // MAPS HOSTING API (без базы данных, только Storage)
    // ============================================

    // Generate map preview
    app.post('/api/maps/preview', upload.single('map'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Файл не загружен' });
            }

            // Require auth
            let currentUser = null;
            await requireAuth(req, res, async () => {
                currentUser = req.user;
            }, supabase);
            if (!currentUser) return;

            // Используем rustmaps.com API для генерации превью
            // Отправляем файл на их сервер для генерации превью
            try {
                // Используем встроенный fetch (Node.js 18+)
                const fetch = globalThis.fetch;
                
                if (!fetch) {
                    throw new Error('fetch не доступен');
                }

                // Используем FormData из встроенного API (Node.js 18+)
                const formData = new FormData();
                const blob = new Blob([req.file.buffer], { type: 'application/octet-stream' });
                formData.append('map', blob, req.file.originalname);

                // Пробуем использовать rustmaps.com API
                const rustmapsResponse = await fetch('https://rustmaps.com/api/v2/maps/preview', {
                    method: 'POST',
                    body: formData
                });

                if (rustmapsResponse.ok) {
                    const rustmapsData = await rustmapsResponse.json();
                    const previewUrl = rustmapsData.preview_url || rustmapsData.image_url || rustmapsData.url;
                    
                    if (previewUrl) {
                        // Если есть URL превью, возвращаем его с параметрами сжатия
                        // Добавляем параметры для сжатия изображения (если API поддерживает)
                        let finalUrl = previewUrl;
                        
                        // Пробуем добавить параметры сжатия через query string
                        // Многие API поддерживают параметры w (width), h (height), q (quality)
                        try {
                            const urlObj = new URL(previewUrl);
                            // Устанавливаем максимальную ширину 800px для превью
                            urlObj.searchParams.set('w', '800');
                            urlObj.searchParams.set('q', '75'); // Качество 75% для меньшего размера
                            finalUrl = urlObj.toString();
                        } catch (e) {
                            // Если не удалось распарсить URL, используем оригинальный
                            console.log('Не удалось добавить параметры сжатия к URL');
                        }
                        
                        return res.json({
                            preview_url: finalUrl,
                            success: true
                        });
                    }
                }
            } catch (apiError) {
                console.log('⚠️ RustMaps API недоступен:', apiError.message);
            }

            // Альтернативный метод: возвращаем информацию о файле без превью
            // Превью будет доступно после загрузки карты
            res.json({
                preview_url: null,
                success: false,
                message: 'Превью будет доступно после загрузки карты',
                file_info: {
                    name: req.file.originalname,
                    size: req.file.size
                }
            });
        } catch (error) {
            console.error('Error generating map preview:', error);
            res.status(500).json({ error: error.message || 'Ошибка генерации превью' });
        }
    });

    // Upload map file
    app.post('/api/maps/upload', upload.single('map'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Файл не загружен' });
            }

            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Require auth
            let currentUser = null;
            await requireAuth(req, res, async () => {
                currentUser = req.user;
            }, supabase);
            if (!currentUser) return;

            const mapId = uuidv4();
            const fileExt = path.extname(req.file.originalname);
            const originalName = req.file.originalname;
            const fileName = `${mapId}${fileExt}`;
            const storagePath = `maps/${fileName}`;

            // Upload to Supabase Storage with metadata
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('maps')
                .upload(storagePath, req.file.buffer, {
                    contentType: 'application/octet-stream',
                    upsert: false,
                    metadata: {
                        originalName: originalName,
                        uploadedAt: new Date().toISOString(),
                        fileSize: req.file.size.toString()
                    }
                });

            if (uploadError) {
                console.error('Supabase upload error:', uploadError);
                return res.status(500).json({ error: uploadError.message || 'Ошибка загрузки файла' });
            }

            // Save to maps_metadata table with user_id
            try {
                const { error: metaError } = await supabase
                    .from('maps_metadata')
                    .insert({
                        map_id: mapId,
                        user_id: currentUser.id,
                        original_name: originalName,
                        file_size: req.file.size,
                        storage_path: storagePath,
                        short_code: generateShortCodeForMap(mapId)
                    });
                
                if (metaError) {
                    console.error('❌ Failed to save metadata:', metaError);
                    console.error('Data attempted:', { mapId, userId: currentUser.id, originalName, storagePath });
                } else {
                    console.log('✅ Metadata saved successfully for map:', mapId);
                }
            } catch (metaErr) {
                console.error('❌ Metadata insert error:', metaErr);
            }

            // Log action
            await logUserAction(currentUser.id, 'map_upload', {
                map_id: mapId,
                original_name: originalName,
                file_size: req.file.size
            });

            // Return map data
            const mapData = {
                id: mapId,
                original_name: originalName,
                storage_path: storagePath,
                file_size: req.file.size,
                uploaded_at: new Date().toISOString(),
                owner_id: currentUser.id,
                owner_name: currentUser.username
            };

            res.json({
                success: true,
                map: mapData
            });
        } catch (error) {
            console.error('Error uploading map:', error);
            res.status(500).json({ error: error.message || 'Ошибка загрузки файла' });
        }
    });

    // Helper: generate short code from UUID
    function generateShortCodeForMap(uuid) {
        const cleaned = uuid.replace(/-/g, '');
        const hash = cleaned.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
        return Math.abs(hash).toString(36).substring(0, 7).toUpperCase().padEnd(7, '0');
    }

    // Get maps: only own maps for regular users, all for admin
    app.get('/api/maps', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Try to identify current user (optional for backward-compat). If auth header present, enforce auth.
            let currentUser = null;
            const authHeader = req.headers.authorization;
            if (authHeader) {
                await requireAuth(req, res, async () => {
                    currentUser = req.user;
                }, supabase);
                if (!currentUser) return; // requireAuth already responded
            }

            // List all files from Storage bucket (root of bucket)
            const { data: files, error } = await supabase.storage
                .from('maps')
                .list('maps', {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) {
                console.error('Supabase storage list error:', error);
                // Если папка не существует, попробуем корень
                const { data: rootFiles, error: rootError } = await supabase.storage
                    .from('maps')
                    .list('', {
                        limit: 100,
                        offset: 0,
                        sortBy: { column: 'created_at', order: 'desc' }
                    });
                
                if (rootError) {
                    console.error('Root list error:', rootError);
                    return res.json([]);
                }
                
                files = rootFiles;
            }

            console.log('📁 Files in storage:', files);
            console.log('📊 Total files found:', files?.length || 0);

            // Фильтруем только файлы (не папки) и с расширением .map
            const mapFiles = (files || []).filter(file => {
                const isFolder = file.id === null;
                const hasMapExtension = file.name && path.extname(file.name).toLowerCase() === '.map';
                console.log(`  - ${file.name}: isFolder=${isFolder}, hasMapExt=${hasMapExtension}`);
                return !isFolder && hasMapExtension;
            });

            // Get metadata from database
            let metaMap = {};
            try {
                const { data: metaRows, error: metaError } = await supabase
                    .from('maps_metadata')
                    .select('map_id, user_id, users(username)');
                
                if (metaError) {
                    console.error('❌ Error fetching metadata:', metaError);
                } else {
                    console.log('✅ Fetched metadata for', metaRows?.length || 0, 'maps');
                }
                
                if (Array.isArray(metaRows)) {
                    metaRows.forEach(meta => {
                        metaMap[meta.map_id] = {
                            user_id: meta.user_id,
                            owner_name: meta.users?.username || 'Unknown'
                        };
                    });
                }
            } catch (e) {
                console.error('❌ Metadata fetch error:', e.message);
            }

            // Transform files to map format
            let maps = mapFiles.map(file => {
                const fileExt = path.extname(file.name);
                const fileName = path.basename(file.name, fileExt);
                // Убираем префикс 'maps/' если он есть
                const mapId = fileName.replace('maps/', '');
                const metadata = file.metadata || {};
                const meta = metaMap[mapId] || {};
                
                return {
                    id: mapId,
                    original_name: metadata.originalName || file.name,
                    storage_path: file.name,
                    file_size: parseInt(metadata.fileSize || file.metadata?.size || '0'),
                    uploaded_at: metadata.uploadedAt || file.created_at || new Date().toISOString(),
                    owner_id: meta.user_id,
                    owner_name: meta.owner_name
                };
            });

            // If user is not admin, filter to own maps only
            if (currentUser && currentUser.role !== 'admin') {
                maps = maps.filter(m => m.owner_id === currentUser.id);
            }

            console.log(`Found ${maps.length} maps in storage`);
            res.json(maps);
        } catch (error) {
            console.error('Error fetching maps:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Download map file (only owner or admin)
    app.get('/api/maps/download/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Enforce auth for download
            let currentUser = null;
            await requireAuth(req, res, async () => {
                currentUser = req.user;
            }, supabase);
            if (!currentUser) return;

            console.log('📥 Download request for ID:', req.params.id);

            // Try both paths
            let files = null;
            let error = null;
            
            // First try maps/ folder
            const result1 = await supabase.storage.from('maps').list('maps');
            if (!result1.error && result1.data) {
                files = result1.data;
            } else {
                // Fallback to root
                const result2 = await supabase.storage.from('maps').list('');
                files = result2.data;
                error = result2.error;
            }

            if (error) throw error;

            console.log('📁 Looking in files:', files?.map(f => f.name));

            // Find file by ID (ID is filename without extension)
            const file = files?.find(f => {
                const fileExt = path.extname(f.name);
                const fileId = path.basename(f.name, fileExt);
                console.log(`  Comparing: ${fileId} === ${req.params.id}`);
                return fileId === req.params.id;
            });

            if (!file) {
                console.error('❌ File not found for ID:', req.params.id);
                return res.status(404).json({ error: 'Карта не найдена' });
            }

            console.log('✅ Found file:', file.name);
            const storagePath = file.name.startsWith('maps/') ? file.name : `maps/${file.name}`;

            // Ownership check via metadata table if possible
            try {
                const { data: metaRow } = await supabase
                    .from('maps_metadata')
                    .select('id, user_id')
                    .eq('id', req.params.id)
                    .single();
                if (metaRow && currentUser.role !== 'admin' && metaRow.user_id !== currentUser.id) {
                    return res.status(403).json({ error: 'Нет доступа к этой карте' });
                }
            } catch (e) {
                console.warn('Ownership check skipped:', e.message);
            }

            // Get file from Supabase Storage
            const { data: fileData, error: downloadError } = await supabase.storage
                .from('maps')
                .download(storagePath);

            if (downloadError || !fileData) {
                return res.status(404).json({ error: 'Файл не найден' });
            }

            // Get original name from metadata
            const metadata = file.metadata || {};
            const originalName = metadata.originalName || file.name;

            // Convert blob to buffer for streaming
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Log download action
            await logUserAction(currentUser.id, 'map_download', {
                map_id: req.params.id,
                original_name: originalName,
                file_size: buffer.length
            });

            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', buffer.length);
            res.send(buffer);
        } catch (error) {
            console.error('Error downloading map:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete map (only owner or admin)
    app.delete('/api/maps/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Enforce auth for delete
            let currentUser = null;
            await requireAuth(req, res, async () => {
                currentUser = req.user;
            }, supabase);
            if (!currentUser) return;

            console.log('🗑️ Delete request for ID:', req.params.id);

            // Try both paths
            let files = null;
            
            // First try maps/ folder
            const result1 = await supabase.storage.from('maps').list('maps');
            if (!result1.error && result1.data) {
                files = result1.data;
            } else {
                // Fallback to root
                const result2 = await supabase.storage.from('maps').list('');
                files = result2.data;
            }

            console.log('📁 Looking in files for delete:', files?.map(f => f.name));

            // Find file by ID
            const file = files?.find(f => {
                const fileExt = path.extname(f.name);
                const fileId = path.basename(f.name, fileExt);
                console.log(`  Delete comparing: ${fileId} === ${req.params.id}`);
                return fileId === req.params.id;
            });

            if (!file) {
                console.error('❌ File not found for delete:', req.params.id);
                return res.status(404).json({ error: 'Карта не найдена' });
            }

            // Ownership check via metadata table
            try {
                const { data: metaRow } = await supabase
                    .from('maps_metadata')
                    .select('id, user_id')
                    .eq('id', req.params.id)
                    .single();
                if (metaRow && currentUser.role !== 'admin' && metaRow.user_id !== currentUser.id) {
                    return res.status(403).json({ error: 'Нет доступа к этой карте' });
                }
            } catch (e) {
                console.warn('Ownership check skipped:', e.message);
            }

            console.log('✅ Deleting file:', file.name);
            const storagePath = file.name.startsWith('maps/') ? file.name : `maps/${file.name}`;

            // Delete file from storage
            const { error: storageError } = await supabase.storage
                .from('maps')
                .remove([storagePath]);

            if (storageError) throw storageError;

            // Log delete action
            await logUserAction(currentUser.id, 'map_delete', {
                map_id: req.params.id,
                original_name: file.name
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting map:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // CHANGELOG API
    // ============================================

    // Get all changelog entries
    app.get('/api/changelog', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { data, error } = await supabase
                .from('changelog')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            // Return array with 120 entries (3 rows × 40 columns)
            // Fill missing entries with null
            const result = Array(120).fill(null).map((_, index) => {
                return data[index] || null;
            });
            res.json(result);
        } catch (error) {
            console.error('Error fetching changelog:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Increment views for changelog entry
    app.post('/api/changelog/:id/view', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { id } = req.params;

            // Get current views
            const { data: entry, error: fetchError } = await supabase
                .from('changelog')
                .select('views')
                .eq('id', id)
                .single();

            if (fetchError || !entry) {
                return res.status(404).json({ error: 'Changelog entry not found' });
            }

            // Increment views
            const { data, error } = await supabase
                .from('changelog')
                .update({ views: (entry.views || 0) + 1 })
                .eq('id', id)
                .select('views')
                .single();

            if (error) throw error;

            res.json({ success: true, views: data.views });
        } catch (error) {
            console.error('Error incrementing views:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // CHANGELOG ADMIN API
    // ============================================

    // Test endpoint to verify routing works
    app.get('/api/admin/test', (req, res) => {
        res.json({ message: 'Admin API works!', timestamp: new Date().toISOString() });
    });

    // Get all changelog entries (admin - with full data)
    app.get('/api/admin/changelog', async (req, res) => {
        try {
            console.log('Admin changelog endpoint called');
            if (!supabase) {
                console.error('Supabase not configured');
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { data, error } = await supabase
                .from('changelog')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            console.log(`Found ${data?.length || 0} changelog entries`);
            res.json(data || []);
        } catch (error) {
            console.error('Error fetching changelog (admin):', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get single changelog entry
    app.get('/api/admin/changelog/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { id } = req.params;

            const { data, error } = await supabase
                .from('changelog')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!data) {
                return res.status(404).json({ error: 'Changelog entry not found' });
            }

            res.json(data);
        } catch (error) {
            console.error('Error fetching changelog entry:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Create new changelog entry
    app.post('/api/admin/changelog', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { build, subtitle, date, added, fixed, changed } = req.body;

            if (!build) {
                return res.status(400).json({ error: 'Build number is required' });
            }

            const { data, error } = await supabase
                .from('changelog')
                .insert({
                    build,
                    subtitle: subtitle || '',
                    date: date || new Date().toISOString(),
                    added: added || [],
                    fixed: fixed || [],
                    changed: changed || [],
                    views: 0
                })
                .select()
                .single();

            if (error) throw error;

            res.json({ success: true, data });
        } catch (error) {
            console.error('Error creating changelog entry:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Update changelog entry
    app.put('/api/admin/changelog/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { id } = req.params;
            const { build, subtitle, date, added, fixed, changed } = req.body;

            const updateData = {};
            if (build !== undefined) updateData.build = build;
            if (subtitle !== undefined) updateData.subtitle = subtitle;
            if (date !== undefined) updateData.date = date;
            if (added !== undefined) updateData.added = added;
            if (fixed !== undefined) updateData.fixed = fixed;
            if (changed !== undefined) updateData.changed = changed;

            const { data, error } = await supabase
                .from('changelog')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            if (!data) {
                return res.status(404).json({ error: 'Changelog entry not found' });
            }

            res.json({ success: true, data });
        } catch (error) {
            console.error('Error updating changelog entry:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete changelog entry
    app.delete('/api/admin/changelog/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { id } = req.params;

            const { error } = await supabase
                .from('changelog')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting changelog entry:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // USER ACTIVITY API
    // ============================================

    // Get user activity
    app.get('/api/user/activity', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Require auth
            let currentUser = null;
            await requireAuth(req, res, async () => {
                currentUser = req.user;
            }, supabase);
            if (!currentUser) return;

            // Get user actions from database
            const { data, error } = await supabase
                .from('user_actions')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            res.json({
                success: true,
                actions: data || []
            });
        } catch (error) {
            console.error('Error fetching user activity:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Log user action (internal helper)
    async function logUserAction(userId, actionType, actionDetails = {}) {
        if (!supabase) return;
        try {
            await supabase
                .from('user_actions')
                .insert({
                    user_id: userId,
                    action_type: actionType,
                    action_details: actionDetails
                });
            console.log(`✅ Logged action: ${actionType} for user ${userId}`);
        } catch (error) {
            console.error('❌ Failed to log action:', error);
        }
    }

    // Health check
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            discord: !IS_SERVERLESS && discordReady,
            supabase: !!supabase,
            changelog: true,
            timestamp: new Date().toISOString()
        });
    });

    // Short URL handler for map downloads (e.g., /ABC1234)
    app.get('/:shortCode([A-Z0-9]{7})', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const shortCode = req.params.shortCode;
            console.log('🔗 Short URL request:', shortCode);
            
            // Try both paths
            let files = null;
            
            // First try maps/ folder
            const result1 = await supabase.storage.from('maps').list('maps');
            if (!result1.error && result1.data) {
                files = result1.data;
            } else {
                // Fallback to root
                const result2 = await supabase.storage.from('maps').list('');
                files = result2.data;
            }

            console.log('📁 Files for short URL:', files?.map(f => f.name));

            // Generate short codes and find match
            const file = files?.find(f => {
                const fileExt = path.extname(f.name);
                const fileId = path.basename(f.name, fileExt);
                
                // Generate same short code as frontend
                const cleaned = fileId.replace(/-/g, '');
                const hash = cleaned.split('').reduce((acc, char) => {
                    return ((acc << 5) - acc) + char.charCodeAt(0);
                }, 0);
                const code = Math.abs(hash).toString(36).substring(0, 7).toUpperCase().padEnd(7, '0');
                
                return code === shortCode;
            });

            if (!file) {
                return res.status(404).send(`
                    <!DOCTYPE html>
                    <html><head><meta charset="UTF-8"><title>Карта не найдена</title></head>
                    <body style="font-family:sans-serif;text-align:center;padding:50px;">
                        <h1>❌ Карта не найдена</h1>
                        <p>Код: ${shortCode}</p>
                        <a href="/">← Вернуться на главную</a>
                    </body></html>
                `);
            }

            const storagePath = file.name.startsWith('maps/') ? file.name : `maps/${file.name}`;
            console.log('✅ Short URL matched file:', file.name, '-> path:', storagePath);

            // Download file from storage
            const { data: fileData, error: downloadError } = await supabase.storage
                .from('maps')
                .download(storagePath);

            if (downloadError || !fileData) {
                return res.status(404).json({ error: 'Файл не найден' });
            }

            // Get original name from metadata
            const metadata = file.metadata || {};
            const originalName = metadata.originalName || file.name;

            // Convert blob to buffer
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', buffer.length);
            res.send(buffer);
        } catch (error) {
            console.error('Error downloading map via short code:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Serve static files (after all API routes)
    // Skip /api routes to avoid conflicts
    const staticMiddleware = express.static('public');
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next(); // Skip static files for API routes
        }
        return staticMiddleware(req, res, next);
    });

    // Hidden gallery page (nav скрывает для пользователей; API защищают действия)
    app.get(GALLERY_PATH, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'images-gallery.html'));
    });

    // Avoid 404 spam from browsers requesting site icon
    app.get('/favicon.ico', (req, res) => res.status(204).end());

    // =====================
    // API TOKENS MANAGEMENT
    // =====================
    // Create new API token for current user
    app.post('/api/api-tokens', async (req, res) => {
        await requireAuth(req, res, async () => {}, supabase);
        if (!req.user) return;
        try {
            const name = (req.body && req.body.name) || 'Figma Plugin';
            const description = (req.body && req.body.description) || null;
            const token = require('crypto').randomBytes(32).toString('hex');
            const { data, error } = await supabase
                .from('api_tokens')
                .insert({ user_id: req.user.id, token, name, description, is_active: true })
                .select('id, created_at')
                .single();
            if (error) throw error;
            res.json({ success: true, token, id: data.id, created_at: data.created_at });
        } catch (e) {
            console.error('Create token error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // List current user's tokens with usage counts
    app.get('/api/api-tokens/mine', async (req, res) => {
        await requireAuth(req, res, async () => {}, supabase);
        if (!req.user) return;
        try {
            const { data: tokens, error } = await supabase
                .from('api_tokens')
                .select('id, name, description, is_active, created_at, last_used_at')
                .eq('user_id', req.user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;

            // Get usage counts
            const tokenIds = (tokens || []).map(t => t.id);
            const usageMap = new Map();
            
            if (tokenIds.length > 0) {
                try {
                    const { data: logs, error: logError } = await supabase
                        .from('api_usage_logs')
                        .select('token_id')
                        .in('token_id', tokenIds);
                    
                    if (!logError && logs) {
                        // Count manually
                        logs.forEach(log => {
                            const current = usageMap.get(log.token_id) || 0;
                            usageMap.set(log.token_id, current + 1);
                        });
                    }
                } catch (e) {
                    console.warn('Failed to load usage counts:', e.message);
                }
            }

            const result = (tokens || []).map(t => ({ ...t, calls: usageMap.get(t.id) || 0 }));
            res.json({ items: result });
        } catch (e) {
            console.error('List tokens error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Revoke token
    app.delete('/api/api-tokens/:id', async (req, res) => {
        await requireAuth(req, res, async () => {}, supabase);
        if (!req.user) return;
        try {
            const { id } = req.params;
            const { error } = await supabase
                .from('api_tokens')
                .update({ is_active: false })
                .eq('id', id)
                .eq('user_id', req.user.id);
            if (error) throw error;
            res.json({ success: true });
        } catch (e) {
            console.error('Revoke token error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // =====================================================
    // STRIPE ACCOUNTS API - для расширения Cursor
    // =====================================================

    // =====================================================
    // REGISTERED ACCOUNTS API - учет успешно созданных аккаунтов Cursor
    // =====================================================

    // Хранение последнего кода подтверждения в памяти (без БД)
    let lastVerificationCode = {
        code: null,
        email: null,
        updatedAt: null
    };

    // Получить последний код подтверждения
    app.get('/api/registered-accounts/last-code', (req, res) => {
        res.json({
            code: lastVerificationCode.code,
            email: lastVerificationCode.email,
            updatedAt: lastVerificationCode.updatedAt
        });
    });

    // Обновить последний код подтверждения (вызывается расширением)
    app.post('/api/registered-accounts/last-code', (req, res) => {
        const { code, email } = req.body;
        if (code) {
            lastVerificationCode = {
                code: String(code),
                email: email || null,
                updatedAt: new Date().toISOString()
            };
            console.log(`✅ Код обновлен: ${code}${email ? ` для ${email}` : ''}`);
            res.json({ success: true, updatedAt: lastVerificationCode.updatedAt });
        } else {
            res.status(400).json({ error: 'Code is required' });
        }
    });

    // Список зарегистрированных аккаунтов (новые сверху)
    app.get('/api/registered-accounts', async (req, res) => {
        try {
            // Пробуем получить с mailbox_password
            let { data, error } = await supabase
                .from('registered_accounts')
                .select('*')
                .order('registered_at', { ascending: false, nullsFirst: false });

            // Fallback если колонки mailbox_password нет
            if (error && (String(error.code) === '42703' || String(error.code) === 'PGRST204' || 
                (error.message && error.message.includes('mailbox_password')))) {
                const retry = await supabase
                    .from('registered_accounts')
                    .select('id, email, password, registered_at, registration_location, exported_at, export_batch, created_at')
                    .order('registered_at', { ascending: false, nullsFirst: false });
                data = retry.data;
                error = retry.error;
                // Добавляем mailbox_password как null для старых записей
                if (data) {
                    data = data.map(item => ({ ...item, mailbox_password: null }));
                }
            }

            if (error) throw error;

            res.json(data || []);
        } catch (e) {
            console.error('Registered accounts list error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Добавить зарегистрированный аккаунт
    app.post('/api/registered-accounts', async (req, res) => {
        try {
            const { email, password, mailbox_password, registered_at, registration_location } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const isoRegisteredAt = registered_at || new Date().toISOString();

            // Вставляем или обновляем при конфликте email
            let { data, error } = await supabase
                .from('registered_accounts')
                .upsert({
                    email,
                    password,
                    mailbox_password,
                    registered_at: isoRegisteredAt,
                    registration_location
                }, { onConflict: 'email' })
                .select()
                .single();

            // Fallback: если нет колонок registration_location или mailbox_password, пишем без них
            if (error && (String(error.code) === '42703' || String(error.code) === 'PGRST204' || 
                (error.message && (error.message.includes('registration_location') || error.message.includes('mailbox_password'))))) {
                console.log('⚠️ Некоторые колонки отсутствуют, сохраняем без них');
                const retryData = {
                    email,
                    password,
                    registered_at: isoRegisteredAt
                };
                // Пробуем добавить mailbox_password если колонка есть
                if (mailbox_password && !error.message.includes('mailbox_password')) {
                    retryData.mailbox_password = mailbox_password;
                }
                const retry = await supabase
                    .from('registered_accounts')
                    .upsert(retryData, { onConflict: 'email' })
                    .select()
                    .single();
                data = retry.data;
                error = retry.error;
            }

            if (error) throw error;

            console.log(`✅ Зарегистрированный аккаунт сохранен: ${email}${mailbox_password ? ' (с паролем почты)' : ''}`);
            res.status(201).json(data);
        } catch (e) {
            console.error('Registered account create error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Экспорт TXT: отдает N неэкспортированных аккаунтов и помечает их экспортированными
    app.get('/api/registered-accounts/export.txt', async (req, res) => {
        try {
            const count = Math.max(1, Math.min(1000, parseInt(req.query.count || '10', 10) || 10));
            console.log(`📥 Запрос экспорта: запрошено ${count} аккаунтов`);

            // Сначала проверяем есть ли колонка exported_at - пробуем простой запрос
            let { data: rows, error } = await supabase
                .from('registered_accounts')
                .select('email, password, mailbox_password, registered_at, registration_location, exported_at')
                .is('exported_at', null)
                .order('registered_at', { ascending: true, nullsFirst: true })
                .limit(count);

            console.log(`📊 Первый запрос: найдено ${rows?.length || 0} записей, ошибка: ${error ? error.message : 'нет'}`);

            // Fallback: если ошибка из-за отсутствующих колонок
            if (error && (String(error.code) === '42703' || String(error.code) === 'PGRST204' || 
                (error.message && (error.message.includes('registration_location') || error.message.includes('mailbox_password') || error.message.includes('exported_at'))))) {
                console.log('⚠️ Некоторые колонки отсутствуют, пробуем базовые поля');
                
                // Пробуем запрос без exported_at (возможно все записи неэкспортированы)
                let retry = await supabase
                    .from('registered_accounts')
                    .select('email, password, registered_at')
                    .order('registered_at', { ascending: true, nullsFirst: true })
                    .limit(count);
                
                if (retry.error) {
                    console.log(`⚠️ Ошибка базового запроса: ${retry.error.message}, пробуем только email и password`);
                    // Последняя попытка - только email и password
                    retry = await supabase
                        .from('registered_accounts')
                        .select('email, password')
                        .limit(count);
                }
                
                rows = retry.data;
                error = retry.error;
                console.log(`📊 Повторный запрос: найдено ${rows?.length || 0} записей, ошибка: ${error ? error.message : 'нет'}`);
            }

            if (error) {
                // Если таблицы или колонок еще нет — отдаём пустой txt, а не 500
                const msg = String(error.message || '').toLowerCase();
                if ((msg.includes('relation') && msg.includes('does not exist')) || String(error.code) === '42703' || String(error.code) === 'PGRST204') {
                    console.log('⚠️ Таблица или колонки отсутствуют, возвращаем пустой файл');
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    return res.status(200).send('');
                }
                console.error('❌ Ошибка при запросе экспорта:', error);
                throw error;
            }

            const items = rows || [];
            console.log(`📋 Обработка экспорта: ${items.length} аккаунтов для экспорта`);
            
            if (items.length === 0) {
                // Проверяем есть ли вообще записи в таблице
                const { count: totalCount } = await supabase
                    .from('registered_accounts')
                    .select('*', { count: 'exact', head: true });
                console.log(`⚠️ Нет неэкспортированных записей. Всего записей в таблице: ${totalCount || 0}`);
                if (totalCount > 0) {
                    console.log('💡 Все записи уже экспортированы (exported_at не null)');
                }
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                return res.status(200).send(''); // пустой ответ
            }

            // Помечаем как экспортированные (если колонка exported_at существует)
            const batchId = require('crypto').randomBytes(8).toString('hex');
            const emails = items.map(i => i.email);
            const nowIso = new Date().toISOString();

            let { error: updErr } = await supabase
              .from('registered_accounts')
              .update({ exported_at: nowIso, export_batch: batchId })
              .in('email', emails);

            // Fallback: если колонок нет — просто не помечаем, отдаем файл
            if (updErr && (String(updErr.code) === '42703' || String(updErr.code) === 'PGRST204' || 
                (updErr.message && (updErr.message.includes('exported_at') || updErr.message.includes('export_batch'))))) {
                console.log('⚠️ Колонки exported_at/export_batch отсутствуют, пропускаем пометку экспорта');
                updErr = null;
            }

            if (updErr) {
                console.error('❌ Export mark update error:', updErr);
            } else {
                console.log(`✅ Помечено как экспортировано: ${emails.length} аккаунтов`);
            }

            // Формируем TXT
            const fmt = (iso) => {
                try {
                    const d = new Date(iso);
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    const hh = String(d.getHours()).padStart(2, '0');
                    const mi = String(d.getMinutes()).padStart(2, '0');
                    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
                } catch {
                    return iso || '';
                }
            };

            const lines = items.map(it => {
                const loc = (it.registration_location !== undefined && it.registration_location !== null) ? it.registration_location : '—';
                const ts = (it.registered_at !== undefined && it.registered_at !== null) ? fmt(it.registered_at) : '—';
                const mailboxPwd = (it.mailbox_password !== undefined && it.mailbox_password !== null) ? it.mailbox_password : '—';
                const parts = [
                    '-----------------',
                    `${it.email} | ${it.password}`
                ];
                if (mailboxPwd !== '—') {
                    parts.push(`Пароль почты: ${mailboxPwd}`);
                }
                if (ts !== '—' || loc !== '—') {
                    parts.push(`Регистрация (${loc}): ${ts}`);
                }
                parts.push('-----------------');
                return parts.join('\n');
            });

            const content = lines.join('\n');
            const fname = `accounts-${new Date().toISOString().replace(/[:T]/g,'-').slice(0,16)}.txt`;

            console.log(`✅ Экспорт: ${items.length} аккаунтов, размер файла: ${content.length} байт`);
            console.log(`📄 Первые 200 символов файла: ${content.substring(0, 200)}`);

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
            return res.status(200).send(content);
        } catch (e) {
            console.error('Registered accounts export error:', e);
            // На фронт отдадим пустой файл, чтобы не ломать UX
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.status(200).send('');
        }
    });

    // Статистика зарегистрированных аккаунтов
    app.get('/api/registered-accounts/stats', async (req, res) => {
        try {
            const { count: total } = await supabase
                .from('registered_accounts')
                .select('*', { count: 'exact', head: true });

            res.json({ total: total || 0 });
        } catch (e) {
            console.error('Registered accounts stats error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Получить случайный активный аккаунт (для расширения)
    app.get('/api/stripe-accounts/random', async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('stripe_accounts')
                .select('id, email, password, account_type')
                .eq('is_active', true)
                .order('last_used', { ascending: true, nullsFirst: true })
                .limit(1)
                .single();

            if (error) {
                console.error('Error fetching random account:', error);
                return res.status(404).json({ error: 'No active accounts available' });
            }

            // Помечаем аккаунт как неактивный и обновляем last_used
            await supabase
                .from('stripe_accounts')
                .update({ 
                    is_active: false,
                    last_used: new Date().toISOString() 
                })
                .eq('email', data.email);

            // Логируем использование
            await supabase
                .from('stripe_accounts_usage_log')
                .insert({
                    account_id: data.id,
                    success: true,
                    user_ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                    user_agent: req.headers['user-agent']
                });

            // Возвращаем только нужные поля (без id)
            res.json({
                email: data.email,
                password: data.password,
                account_type: data.account_type
            });
        } catch (e) {
            console.error('Random account error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Получить все аккаунты (с фильтрацией)
    app.get('/api/stripe-accounts', async (req, res) => {
        try {
            const { type, active } = req.query;
            
            let query = supabase
                .from('stripe_accounts')
                .select('*')
                .order('created_at', { ascending: false });

            if (type) {
                query = query.eq('account_type', type.toUpperCase());
            }

            if (active !== undefined) {
                query = query.eq('is_active', active === 'true');
            }

            const { data, error } = await query;

            if (error) throw error;

            res.json(data || []);
        } catch (e) {
            console.error('List accounts error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Получить статистику аккаунтов
    app.get('/api/stripe-accounts/stats', async (req, res) => {
        try {
            // Общее количество
            const { count: total } = await supabase
                .from('stripe_accounts')
                .select('*', { count: 'exact', head: true });

            // PRO аккаунты
            const { count: pro } = await supabase
                .from('stripe_accounts')
                .select('*', { count: 'exact', head: true })
                .eq('account_type', 'PRO');

            // FREE аккаунты
            const { count: free } = await supabase
                .from('stripe_accounts')
                .select('*', { count: 'exact', head: true })
                .eq('account_type', 'FREE');

            // Активные
            const { count: active } = await supabase
                .from('stripe_accounts')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            res.json({ total, pro, free, active });
        } catch (e) {
            console.error('Stats error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Добавить аккаунт
    app.post('/api/stripe-accounts', async (req, res) => {
        try {
            const { email, password, account_type = 'FREE', registration_location, notes } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const { data, error } = await supabase
                .from('stripe_accounts')
                .insert({
                    email,
                    password,
                    account_type: account_type.toUpperCase(),
                    registration_location,
                    notes
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique violation
                    return res.status(409).json({ error: 'Account with this email already exists' });
                }
                throw error;
            }

            res.status(201).json(data);
        } catch (e) {
            console.error('Create account error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Обновить аккаунт
    app.patch('/api/stripe-accounts/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Разрешаем обновлять только определенные поля
            const allowedFields = ['account_type', 'is_active', 'notes', 'registration_location'];
            const filteredUpdates = {};
            
            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    filteredUpdates[field] = updates[field];
                }
            }

            if (Object.keys(filteredUpdates).length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }

            const { data, error } = await supabase
                .from('stripe_accounts')
                .update(filteredUpdates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json(data);
        } catch (e) {
            console.error('Update account error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Удалить аккаунт
    app.delete('/api/stripe-accounts/:id', async (req, res) => {
        try {
            const { id } = req.params;

            const { error } = await supabase
                .from('stripe_accounts')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.json({ success: true });
        } catch (e) {
            console.error('Delete account error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Отметить аккаунт как использованный (от расширения)
    app.post('/api/stripe-accounts/log-usage', async (req, res) => {
        try {
            const { email, success = true, error_message, account_type = 'FREE', registration_location } = req.body;

            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            // Находим аккаунт
            const { data: account } = await supabase
                .from('stripe_accounts')
                .select('id, account_type')
                .eq('email', email)
                .single();

            if (!account) {
                // Если аккаунт не найден, создаем его автоматически
                const { data: newAccount } = await supabase
                    .from('stripe_accounts')
                    .insert({
                        email,
                        password: 'auto-generated', // Пароль неизвестен
                        account_type: account_type.toUpperCase(),
                        registration_location,
                        registration_date: new Date().toISOString()
                    })
                    .select('id')
                    .single();

                if (newAccount) {
                    await supabase
                        .from('stripe_accounts_usage_log')
                        .insert({
                            account_id: newAccount.id,
                            success,
                            error_message,
                            user_ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                            user_agent: req.headers['user-agent']
                        });
                }

                return res.json({ success: true, created: true });
            }

            // Обновляем информацию об аккаунте если она была передана
            if (account_type && account.account_type === 'FREE' && account_type.toUpperCase() === 'PRO') {
                await supabase
                    .from('stripe_accounts')
                    .update({ account_type: 'PRO' })
                    .eq('id', account.id);
            }

            if (registration_location) {
                await supabase
                    .from('stripe_accounts')
                    .update({ registration_location })
                    .eq('id', account.id);
            }

            // Логируем использование
            await supabase
                .from('stripe_accounts_usage_log')
                .insert({
                    account_id: account.id,
                    success,
                    error_message,
                    user_ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                    user_agent: req.headers['user-agent']
                });

            res.json({ success: true });
        } catch (e) {
            console.error('Log usage error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    return app;
}

// Start server in non-serverless environments
if (!IS_SERVERLESS && require.main === module) {
    const app = createApp();
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
        console.log(`🚀 Dashboard server running on http://${HOST}:${PORT}`);
        console.log(`📊 Visit http://localhost:${PORT} to view analytics`);
        if (HOST === '0.0.0.0') {
            console.log(`🌐 External access: http://ваш_домен:${PORT}`);
        }
    });
}

module.exports = { createApp };

