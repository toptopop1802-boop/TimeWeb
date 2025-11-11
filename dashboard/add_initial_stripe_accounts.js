// Скрипт для добавления начальных Stripe аккаунтов
// Использование: node add_initial_stripe_accounts.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Список аккаунтов для добавления
const accounts = [
  { email: 'hodson00737@bublickrust.ru', password: 'Qfwm8yhrkyBB' },
  { email: 'burton_9495@bublickrust.ru', password: 'cuurg!DfCFT1' },
  { email: 'feofilakt_7693@bublickrust.ru', password: 'J6KY!S)N6jWT' },
  { email: 'ceylan_4792@bublickrust.ru', password: '@0LOB6abcW68' },
  { email: 'jeremia_7471@bublickrust.ru', password: 'oyikO0RysXaR' },
  { email: 'tailor76880@bublickrust.ru', password: 'BYN4ZAG@XahQ' },
  { email: 'thunor_4097@bublickrust.ru', password: '!ngs92I1TjHX' },
  { email: 'morley_4639@bublickrust.ru', password: 'nf7I)o83h6@H' },
  { email: 'vitor208028@bublickrust.ru', password: 'UgHt9(x8z@WB' },
  { email: 'sjurd_0967@bublickrust.ru', password: 'kYVJkTl!TC@B' },
  { email: 'waldfried1989@bublickrust.ru', password: 'YKiOcOEgNB5t' },
  { email: 'ebbo1995@bublickrust.ru', password: 'PiL2S02wGOGg' },
  { email: 'opacity452649@bublickrust.ru', password: 'fHeoCgNdScLK' },
  { email: 'daichi_4968@bublickrust.ru', password: 'WwD3h6dK9qaK' },
  { email: 'pulsar11971@bublickrust.ru', password: 'SAv5)mwDeWyU' },
  { email: 'roldan590303@bublickrust.ru', password: 'oBQpsU7D86w4' },
  { email: 'eddine1967@bublickrust.ru', password: 'oUqeUF!v03)z' }
];

async function main() {
  // Проверяем переменные окружения
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Ошибка: SUPABASE_URL или SUPABASE_SERVICE_KEY не установлены в .env');
    console.log('Убедитесь что файл .env содержит:');
    console.log('  SUPABASE_URL=your-url');
    console.log('  SUPABASE_SERVICE_KEY=your-key');
    process.exit(1);
  }

  // Создаем клиент Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  console.log('🚀 Начинаем добавление аккаунтов...\n');

  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const account of accounts) {
    try {
      // Проверяем, не существует ли уже такой аккаунт
      const { data: existing } = await supabase
        .from('stripe_accounts')
        .select('id')
        .eq('email', account.email)
        .single();

      if (existing) {
        console.log(`⚠️  Пропущен (уже существует): ${account.email}`);
        skipped++;
        continue;
      }

      // Добавляем аккаунт
      const { data, error } = await supabase
        .from('stripe_accounts')
        .insert({
          email: account.email,
          password: account.password,
          account_type: 'FREE',
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Ошибка при добавлении ${account.email}:`, error.message);
        errors++;
      } else {
        console.log(`✅ Добавлен: ${account.email} (ID: ${data.id})`);
        added++;
      }

      // Небольшая задержка чтобы не перегружать API
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      console.error(`❌ Неожиданная ошибка для ${account.email}:`, err.message);
      errors++;
    }
  }

  console.log('\n📊 Результаты:');
  console.log(`   ✅ Добавлено: ${added}`);
  console.log(`   ⚠️  Пропущено: ${skipped}`);
  console.log(`   ❌ Ошибок: ${errors}`);
  console.log(`   📝 Всего обработано: ${added + skipped + errors} из ${accounts.length}`);

  if (added > 0) {
    console.log('\n🎉 Аккаунты успешно добавлены!');
    console.log('Откройте https://bublickrust.ru/stripe-accounts.html для просмотра');
  }
}

main().catch(err => {
  console.error('❌ Критическая ошибка:', err);
  process.exit(1);
});

