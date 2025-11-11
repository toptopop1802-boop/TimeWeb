# ⚡ Быстрый старт за 5 минут

## 1️⃣ Создай таблицы (1 мин)

Supabase Dashboard → SQL Editor → выполни:

```sql
-- Скопируй весь код из: dashboard/setup_stripe_accounts.sql
```

## 2️⃣ Добавь аккаунты (2 мин)

```bash
cd dashboard
node add_initial_stripe_accounts.js
```

Или вручную на https://bublickrust.ru/stripe-accounts.html:
```
hodson00737@bublickrust.ru:Qfwm8yhrkyBB
burton_9495@bublickrust.ru:cuurg!DfCFT1
feofilakt_7693@bublickrust.ru:J6KY!S)N6jWT
ceylan_4792@bublickrust.ru:@0LOB6abcW68
jeremia_7471@bublickrust.ru:oyikO0RysXaR
tailor76880@bublickrust.ru:BYN4ZAG@XahQ
thunor_4097@bublickrust.ru:!ngs92I1TjHX
morley_4639@bublickrust.ru:nf7I)o83h6@H
vitor208028@bublickrust.ru:UgHt9(x8z@WB
sjurd_0967@bublickrust.ru:kYVJkTl!TC@B
waldfried1989@bublickrust.ru:YKiOcOEgNB5t
ebbo1995@bublickrust.ru:PiL2S02wGOGg
opacity452649@bublickrust.ru:fHeoCgNdScLK
daichi_4968@bublickrust.ru:WwD3h6dK9qaK
pulsar11971@bublickrust.ru:SAv5)mwDeWyU
roldan590303@bublickrust.ru:oBQpsU7D86w4
eddine1967@bublickrust.ru:oUqeUF!v03)z
```

## 3️⃣ Переустанови расширение (1 мин)

1. `chrome://extensions/`
2. Удали старую версию
3. "Загрузить распакованное" → папка `Cursor/`

## 4️⃣ Проверь (1 мин)

```bash
# Статистика
curl https://bublickrust.ru/api/stripe-accounts/stats

# Случайный аккаунт
curl https://bublickrust.ru/api/stripe-accounts/random
```

## ✅ Готово!

Расширение теперь берет данные с сервера:
- 🌐 https://bublickrust.ru/stripe-accounts.html - управление
- 📊 Автоматическая ротация аккаунтов
- 📝 Логирование использования

---

**Подробная инструкция**: см. `ИНСТРУКЦИЯ.md` или `SETUP_STRIPE_ACCOUNTS.md`

