// Быстрая проверка наличия Stripe аккаунтов в базе
// Использование: node check_stripe_accounts.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Ошибка: SUPABASE_URL или SUPABASE_SERVICE_KEY не установлены в .env');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  console.log('🔍 Проверяем наличие Stripe аккаунтов в базе...\n');

  // Общая статистика
  const { count: total } = await supabase
    .from('stripe_accounts')
    .select('*', { count: 'exact', head: true });

  const { count: active } = await supabase
    .from('stripe_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { count: pro } = await supabase
    .from('stripe_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('account_type', 'PRO');

  const { count: free } = await supabase
    .from('stripe_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('account_type', 'FREE');

  console.log('📊 Статистика:');
  console.log(`   Всего аккаунтов: ${total || 0}`);
  console.log(`   Активных: ${active || 0}`);
  console.log(`   PRO: ${pro || 0}`);
  console.log(`   FREE: ${free || 0}\n`);

  if (!total || total === 0) {
    console.log('⚠️  В базе НЕТ аккаунтов!');
    console.log('\n📝 Добавьте аккаунты:');
    console.log('   1. node add_initial_stripe_accounts.js');
    console.log('   2. Или откройте https://bublickrust.ru/stripe-accounts.html\n');
    process.exit(1);
  }

  if (!active || active === 0) {
    console.log('⚠️  НЕТ активных аккаунтов!');
    console.log('\n📝 Активируйте аккаунты:');
    console.log('   Откройте https://bublickrust.ru/stripe-accounts.html');
    console.log('   и активируйте нужные аккаунты\n');
    process.exit(1);
  }

  // Показываем несколько аккаунтов
  const { data: accounts } = await supabase
    .from('stripe_accounts')
    .select('email, account_type, is_active, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('✅ Активные аккаунты (первые 5):');
  accounts.forEach((acc, idx) => {
    console.log(`   ${idx + 1}. ${acc.email} (${acc.account_type})`);
  });

  console.log('\n🎉 Всё в порядке! Расширение может получать аккаунты с сервера.');
  console.log('\n🧪 Тест API:');
  console.log('   curl https://bublickrust.ru/api/stripe-accounts/random\n');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

