const Imap = require('imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

class MailService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    /**
     * Создать новый почтовый ящик
     */
    async createMailbox(email, password, displayName, createdBy) {
        try {
            // Проверяем, что email заканчивается на @bublickrust.ru
            if (!email.endsWith('@bublickrust.ru')) {
                throw new Error('Email должен заканчиваться на @bublickrust.ru');
            }

            // Хешируем пароль
            const passwordHash = await bcrypt.hash(password, 10);

            // Создаем запись в базе данных
            const { data, error } = await this.supabase
                .from('mailboxes')
                .insert([{
                    email,
                    password_hash: passwordHash,
                    display_name: displayName,
                    created_by: createdBy,
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                mailbox: {
                    id: data.id,
                    email: data.email,
                    display_name: data.display_name,
                    created_at: data.created_at
                }
            };
        } catch (error) {
            console.error('Error creating mailbox:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Получить список всех почтовых ящиков
     */
    async getMailboxes() {
        try {
            const { data, error } = await this.supabase
                .from('mailboxes')
                .select('id, email, display_name, is_active, created_at, last_login, quota_mb, used_space_mb')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return { success: true, mailboxes: data };
        } catch (error) {
            console.error('Error fetching mailboxes:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Удалить почтовый ящик
     */
    async deleteMailbox(mailboxId) {
        try {
            const { error } = await this.supabase
                .from('mailboxes')
                .delete()
                .eq('id', mailboxId);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error deleting mailbox:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Обновить пароль почтового ящика
     */
    async updateMailboxPassword(mailboxId, newPassword) {
        try {
            const passwordHash = await bcrypt.hash(newPassword, 10);

            const { error } = await this.supabase
                .from('mailboxes')
                .update({ password_hash: passwordHash })
                .eq('id', mailboxId);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error updating password:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Получить настройки IMAP для почтового ящика
     */
    async getImapConfig(mailboxId) {
        try {
            const { data, error } = await this.supabase
                .from('mailboxes')
                .select('email, password_hash, imap_host, imap_port')
                .eq('id', mailboxId)
                .single();

            if (error) throw error;

            return {
                success: true,
                config: {
                    user: data.email,
                    password: data.password_hash, // В реальном приложении пароль нужно расшифровывать
                    host: data.imap_host,
                    port: data.imap_port,
                    tls: true,
                    tlsOptions: { rejectUnauthorized: false }
                }
            };
        } catch (error) {
            console.error('Error getting IMAP config:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Синхронизировать письма с IMAP сервера
     */
    async syncEmails(mailboxId, imapConfig) {
        return new Promise((resolve) => {
            const imap = new Imap(imapConfig);
            let emailsFetched = 0;

            imap.once('ready', () => {
                imap.openBox('INBOX', true, async (err, box) => {
                    if (err) {
                        console.error('Error opening inbox:', err);
                        imap.end();
                        return resolve({ success: false, error: err.message });
                    }

                    // Ищем последние 50 писем
                    const searchCriteria = ['ALL'];
                    const fetchOptions = {
                        bodies: '',
                        struct: true,
                        markSeen: false
                    };

                    imap.search(searchCriteria, (err, results) => {
                        if (err) {
                            console.error('Error searching emails:', err);
                            imap.end();
                            return resolve({ success: false, error: err.message });
                        }

                        if (results.length === 0) {
                            imap.end();
                            return resolve({ success: true, emailsFetched: 0 });
                        }

                        // Берем последние 50 писем
                        const fetchResults = results.slice(-50);
                        const fetch = imap.fetch(fetchResults, fetchOptions);

                        fetch.on('message', (msg) => {
                            msg.on('body', (stream) => {
                                simpleParser(stream, async (err, parsed) => {
                                    if (err) {
                                        console.error('Error parsing email:', err);
                                        return;
                                    }

                                    try {
                                        // Сохраняем письмо в базу данных
                                        const { error } = await this.supabase
                                            .from('emails')
                                            .upsert([{
                                                mailbox_id: mailboxId,
                                                message_id: parsed.messageId,
                                                subject: parsed.subject || '(Без темы)',
                                                sender_email: parsed.from?.value[0]?.address || 'unknown',
                                                sender_name: parsed.from?.value[0]?.name || '',
                                                recipient_email: imapConfig.user,
                                                body_text: parsed.text || '',
                                                body_html: parsed.html || '',
                                                has_attachments: parsed.attachments && parsed.attachments.length > 0,
                                                size_bytes: parsed.size || 0,
                                                received_at: parsed.date || new Date(),
                                                folder: 'INBOX'
                                            }], {
                                                onConflict: 'message_id'
                                            });

                                        if (!error) {
                                            emailsFetched++;
                                        }
                                    } catch (error) {
                                        console.error('Error saving email:', error);
                                    }
                                });
                            });
                        });

                        fetch.once('error', (err) => {
                            console.error('Fetch error:', err);
                            imap.end();
                            resolve({ success: false, error: err.message });
                        });

                        fetch.once('end', () => {
                            imap.end();
                            resolve({ success: true, emailsFetched });
                        });
                    });
                });
            });

            imap.once('error', (err) => {
                console.error('IMAP connection error:', err);
                resolve({ success: false, error: err.message });
            });

            imap.connect();
        });
    }

    /**
     * Получить письма для почтового ящика
     */
    async getEmails(mailboxId, limit = 50, offset = 0) {
        try {
            const { data, error } = await this.supabase
                .from('emails')
                .select('*')
                .eq('mailbox_id', mailboxId)
                .order('received_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            return { success: true, emails: data };
        } catch (error) {
            console.error('Error fetching emails:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Получить одно письмо по ID
     */
    async getEmail(emailId) {
        try {
            const { data, error } = await this.supabase
                .from('emails')
                .select('*')
                .eq('id', emailId)
                .single();

            if (error) throw error;

            // Помечаем письмо как прочитанное
            await this.supabase
                .from('emails')
                .update({ is_read: true })
                .eq('id', emailId);

            return { success: true, email: data };
        } catch (error) {
            console.error('Error fetching email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Пометить письмо как прочитанное/непрочитанное
     */
    async markEmailAsRead(emailId, isRead) {
        try {
            const { error } = await this.supabase
                .from('emails')
                .update({ is_read: isRead })
                .eq('id', emailId);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error marking email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Удалить письмо
     */
    async deleteEmail(emailId) {
        try {
            const { error } = await this.supabase
                .from('emails')
                .delete()
                .eq('id', emailId);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error deleting email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Отправить письмо
     */
    async sendEmail(fromMailboxId, to, subject, text, html) {
        try {
            // Получаем данные отправителя
            const { data: mailbox, error: mailboxError } = await this.supabase
                .from('mailboxes')
                .select('email, password_hash, smtp_host, smtp_port')
                .eq('id', fromMailboxId)
                .single();

            if (mailboxError) throw mailboxError;

            // Создаем транспорт для отправки
            const transporter = nodemailer.createTransport({
                host: mailbox.smtp_host,
                port: mailbox.smtp_port,
                secure: true,
                auth: {
                    user: mailbox.email,
                    pass: mailbox.password_hash // В реальном приложении нужно расшифровывать
                }
            });

            // Отправляем письмо
            const info = await transporter.sendMail({
                from: mailbox.email,
                to,
                subject,
                text,
                html
            });

            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Error sending email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Получить статистику по почтовому ящику
     */
    async getMailboxStats(mailboxId) {
        try {
            const { data: totalEmails, error: totalError } = await this.supabase
                .from('emails')
                .select('id', { count: 'exact' })
                .eq('mailbox_id', mailboxId);

            const { data: unreadEmails, error: unreadError } = await this.supabase
                .from('emails')
                .select('id', { count: 'exact' })
                .eq('mailbox_id', mailboxId)
                .eq('is_read', false);

            if (totalError || unreadError) throw totalError || unreadError;

            return {
                success: true,
                stats: {
                    total: totalEmails?.length || 0,
                    unread: unreadEmails?.length || 0
                }
            };
        } catch (error) {
            console.error('Error fetching stats:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = MailService;

