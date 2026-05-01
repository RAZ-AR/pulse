# PULSE — Техническая спецификация для Claude Code

**Версия:** 0.3 (welcome bonus переработан на rate-limit модель)
**Автор концепции:** Armen
**Цель документа:** Спецификация для разработки MVP в Claude Code

---

## 0. Принятые решения (зафиксированы основателем)

| # | Решение | Значение |
|---|---|---|
| 1 | Юр. структура | Новый entity (отдельное юр. лицо под PULSE) |
| 2 | Курс скана чека / партнёрский курс | **1:10** (партнёр в 10 раз выгоднее) |
| 3 | Минимум баллов для конвертации | 100 баллов |
| 4 | Курс своих заведений (Café Willow, JAN) | **1:8** к скану чека (промежуточный) |
| 5 | Срок жизни баллов | 12 месяцев бездействия → сгорают |
| 6 | Хостинг | Vercel + Supabase |
| 7 | Brand colors | Розовый + голубой + зелёный + градиенты (playful), нейтральная палитра для venue cards |
| 8 | Welcome bonus | 500 баллов, доступны сразу, лимит 100/раз + 1/день, срок жизни 90 дней |
| 9 | Модель погашения | Двойная: rewards (100%) + discounts (до X%, X задаёт venue) |

**Конкретные курсы (примеры):**
- Скан чека (везде): `1 балл = 1000 RSD` (минимальный, базовый)
- Средний партнёр: `1 балл = 100 RSD` (1:10 к скану)
- Café Willow / JAN: `1 балл = 125 RSD` (1:8 к скану — промежуточный)
- Топовый партнёр: `1 балл = 80 RSD` (выше среднего, агрессивная щедрость)

Эти числа — **стартовые ориентиры**, заведения сами устанавливают свой курс.

---

## 0.1. Контекст и предупреждения для разработчика (читать до старта)

Этот документ описывает **полный скоуп MVP**, как он сложился в брейнсторме. Реалистичная оценка трудозатрат соло-разработчика с Claude Code: **5-8 месяцев** до приличного качества всех модулей.

**Если ты (Armen) хочешь запуститься быстрее — режь скоуп по приоритетам в разделе 12 (Приоритизация модулей).**

**Три блока, которые нельзя выкидывать ни при какой урезке:**
1. Юридическая консультация (раздел 11) — до запуска, не после
2. Anti-fraud для скана чеков (раздел 8.3) — иначе мошенники убьют экономику
3. OCR-точность с верификацией (раздел 8.2) — иначе споры с юзерами съедят время

---

## 1. Концепция продукта

### 1.1 Позиционирование

**PULSE** — программа лояльности нового типа, где:
- Заведения **публично конкурируют курсом баллов** за клиента
- Юзер копит баллы **везде** (через скан чека или у партнёров), тратит — **только у партнёров**
- Геймификация (стрики, бейджи, челленджи, рефералка) — слой удержания

### 1.2 Ключевые отличия от существующих программ

| Аспект | Классические (Plazius, Spasibo) | PULSE |
|---|---|---|
| Курс баллов | Фиксированный, скрытый | Динамический, публичный |
| Где зарабатывать | Только у партнёров | Везде (через OCR чека) |
| Где тратить | Только у партнёров | Только у партнёров |
| Конкуренция за юзера | Нет | Встроена через прозрачность курса |

### 1.3 Целевая аудитория

- **Юзеры:** глобал, но плотный beachhead — Белград (потом Ереван и далее)
- **Языки в MVP:** EN, RU, SR (i18n с первого дня)
- **Заведения:** HoReCa, кофейни, локальные ритейлеры, сервисы

---

## 2. Архитектура высокого уровня

### 2.1 Стек

```
┌────────────────────────────────────────────────────────────┐
│  Mobile App (iOS + Android)                                │
│  React Native + Expo                                       │
│  - Zustand для state                                       │
│  - i18next для локализации (EN/RU/SR)                      │
│  - React Query для API                                     │
└────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / REST + WebSocket
                            │
┌────────────────────────────────────────────────────────────┐
│  Backend API                                               │
│  Next.js 15 App Router (как в Rayve)                       │
│  - tRPC для типобезопасных API                             │
│  - NextAuth для auth (passwordless email + OAuth)          │
│  - Prisma ORM                                              │
└────────────────────────────────────────────────────────────┘
                            │
                            │
┌────────────────────────────────────────────────────────────┐
│  PostgreSQL (Supabase или self-hosted)                     │
│  + Redis (сессии, rate limiting, leaderboards)             │
│  + S3-compatible storage (фото чеков, фото мест)           │
└────────────────────────────────────────────────────────────┘
                            │
                            │
┌────────────────────────────────────────────────────────────┐
│  Внешние сервисы                                           │
│  - OCR: Google Vision API или GPT-4o vision                │
│  - AI verification: Anthropic API (Claude Sonnet)          │
│  - Push: Firebase Cloud Messaging                          │
│  - Maps: Mapbox или Google Maps                            │
│  - Payments: Stripe (subscription) + локальный для Сербии  │
└────────────────────────────────────────────────────────────┘
```

### 2.2 Два приложения, один backend

- **PULSE Mobile** (iOS + Android) — для юзеров
- **PULSE Merchant** (Web) — кабинет заведения, Next.js на том же backend

---

## 3. Модель данных (Prisma schema, ключевые сущности)

```prisma
// === Юзеры ===
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  phone           String?  @unique
  name            String
  avatarUrl       String?
  homeCity        String?  // для лидербордов района
  language        Locale   @default(EN)
  createdAt       DateTime @default(now())

  // Два кошелька баллов (см. раздел 4.6)
  earnedPoints      Int       @default(0)   // заработанные обычным способом
  welcomePoints     Int       @default(500) // welcome bonus, остаток
  welcomeExpiresAt  DateTime?                // регистрация + 90 дней
  lastWelcomeUsedAt DateTime?                // для 24-часового лимита

  // Lifetime метрики
  totalEarnedLifetime Int    @default(0)   // всего заработано за всю жизнь
  spentPoints         Int    @default(0)   // lifetime spent

  // Геймификация
  currentStreak   Int      @default(0)
  longestStreak   Int      @default(0)
  lastCheckinAt   DateTime?

  // Шаги (опционально, синхронизация с HealthKit/Google Fit)
  stepsToday      Int      @default(0)
  stepsTotal      Int      @default(0)

  // Анти-фрод (для welcome bonus)
  deviceFingerprint String?  // hash device id при регистрации
  emailVerified     Boolean  @default(false)
  phoneVerified     Boolean  @default(false)

  // Социалка
  referralCode    String   @unique
  referredById    String?
  referredBy      User?    @relation("Referrals", fields: [referredById], references: [id])
  referrals       User[]   @relation("Referrals")

  // Связи
  transactions    Transaction[]
  checkins        Checkin[]
  badges          UserBadge[]
  challenges      UserChallenge[]
  reviews         Review[]
  pointsGifts     PointsGift[] @relation("Sender")
  pointsReceived  PointsGift[] @relation("Receiver")
}

// === Заведения ===
model Venue {
  id              String   @id @default(cuid())
  name            String
  category        VenueCategory  // CAFE, RESTAURANT, RETAIL, SERVICE
  description     String?
  address         String
  city            String
  country         String
  lat             Float
  lng             Float
  photos          String[] // S3 URLs
  workingHours    Json     // { mon: "08:00-22:00", ... }

  // Партнёрство
  isPartner       Boolean  @default(false)
  partnerSince    DateTime?
  subscriptionTier SubscriptionTier? // BASIC, PRO, FEATURED
  subscriptionUntil DateTime?

  // Курс баллов (только для партнёров)
  pointsPerCurrency Float? // например 0.01 = 1 балл за 100 динар
  currency        String?  // RSD, EUR, AMD, RUB
  boostUntil      DateTime? // временный буст курса
  boostMultiplier Float?    // например 2.0 = курс x2 на период

  // Внешние рейтинги (агрегатор — пост-MVP, но поля готовим)
  googleRating    Float?
  googleReviews   Int?
  yandexRating    Float?
  woltRating      Float?

  // Связи
  owner           Merchant? @relation(fields: [ownerId], references: [id])
  ownerId         String?
  transactions    Transaction[]
  checkins        Checkin[]
  rewards         Reward[]
  reviews         Review[]
  challenges      Challenge[]

  @@index([city, category])
  @@index([lat, lng])
}

// === Кабинет заведения ===
model Merchant {
  id              String   @id @default(cuid())
  email           String   @unique
  name            String
  phone           String?
  passwordHash    String
  venues          Venue[]
  createdAt       DateTime @default(now())
}

// === Транзакции (заработок баллов) ===
model Transaction {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  venueId         String?  // null если venue не определён (чек из не-партнёра без venue в БД)
  venue           Venue?   @relation(fields: [venueId], references: [id])

  type            TransactionType  // PARTNER_PURCHASE, RECEIPT_SCAN, CHECKIN_PHOTO, REFERRAL, CHALLENGE_COMPLETE, BONUS
  amount          Float?   // сумма чека (для PARTNER_PURCHASE и RECEIPT_SCAN)
  currency        String?
  pointsEarned    Int

  // OCR-данные (для RECEIPT_SCAN)
  receiptImageUrl String?
  ocrRawData      Json?    // распознанный текст и метаданные
  ocrConfidence   Float?
  receiptHash     String?  // SHA-256 для anti-fraud (один и тот же чек не пройдёт дважды)

  // Верификация
  status          TransactionStatus // PENDING, VERIFIED, REJECTED, DISPUTED
  rejectionReason String?
  verifiedAt      DateTime?

  createdAt       DateTime @default(now())

  @@index([userId, createdAt])
  @@index([receiptHash])
}

// === Чекины (фото-верификация места) ===
model Checkin {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  venueId         String
  venue           Venue    @relation(fields: [venueId], references: [id])

  photoUrl        String
  lat             Float
  lng             Float
  distanceFromVenue Float  // метры — для anti-fraud
  aiVerification  Json?    // результат AI-верификации фото
  status          CheckinStatus  // PENDING, VERIFIED, REJECTED
  pointsEarned    Int

  createdAt       DateTime @default(now())

  @@index([userId, createdAt])
}

// === Награды у партнёра ===
model Reward {
  id              String   @id @default(cuid())
  venueId         String
  venue           Venue    @relation(fields: [venueId], references: [id])
  title           String   // "Бесплатный кофе"
  description     String?
  pointsCost      Int
  imageUrl        String?
  isActive        Boolean  @default(true)
  redemptions     Redemption[]
  stockLimit      Int?     // null = unlimited
  redeemedCount   Int      @default(0)
  createdAt       DateTime @default(now())
}

model Redemption {
  id              String   @id @default(cuid())
  userId          String
  rewardId        String
  reward          Reward   @relation(fields: [rewardId], references: [id])
  pointsSpent     Int
  redemptionCode  String   @unique // QR-код, который юзер показывает в заведении
  status          RedemptionStatus // ACTIVE, USED, EXPIRED
  usedAt          DateTime?
  expiresAt       DateTime
  createdAt       DateTime @default(now())
}

// === Челленджи ===
model Challenge {
  id              String   @id @default(cuid())
  title           String
  description     String
  type            ChallengeType  // VISIT_N_VENUES, SPEND_AMOUNT, WALK_STEPS, COMBO
  rules           Json     // конкретные параметры
  pointsReward    Int
  badgeId         String?
  startDate       DateTime
  endDate         DateTime
  isGlobal        Boolean  // глобальный или для конкретного venue/города
  venueId         String?
  venue           Venue?   @relation(fields: [venueId], references: [id])
  participants    UserChallenge[]
}

model UserChallenge {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  challengeId     String
  challenge       Challenge @relation(fields: [challengeId], references: [id])
  progress        Int      @default(0)
  isCompleted     Boolean  @default(false)
  completedAt     DateTime?

  @@unique([userId, challengeId])
}

// === Бейджи ===
model Badge {
  id              String   @id @default(cuid())
  name            String
  description     String
  iconUrl         String
  rarity          BadgeRarity  // COMMON, RARE, EPIC, LEGENDARY
  unlockCondition Json
  users           UserBadge[]
}

model UserBadge {
  userId          String
  badgeId         String
  user            User     @relation(fields: [userId], references: [id])
  badge           Badge    @relation(fields: [badgeId], references: [id])
  unlockedAt      DateTime @default(now())

  @@id([userId, badgeId])
}

// === Отзывы (упрощённо, для MVP — текст + рейтинг) ===
model Review {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  venueId         String
  venue           Venue    @relation(fields: [venueId], references: [id])
  rating          Int      // 1-5
  text            String?
  createdAt       DateTime @default(now())

  @@unique([userId, venueId])
}

// === Подарки баллов между юзерами ===
model PointsGift {
  id              String   @id @default(cuid())
  senderId        String
  sender          User     @relation("Sender", fields: [senderId], references: [id])
  receiverId      String
  receiver        User     @relation("Receiver", fields: [receiverId], references: [id])
  amount          Int
  message         String?
  createdAt       DateTime @default(now())
}

// === Enums ===
enum Locale { EN RU SR }
enum VenueCategory { CAFE RESTAURANT RETAIL SERVICE OTHER }
enum SubscriptionTier { BASIC PRO FEATURED }
enum TransactionType { PARTNER_PURCHASE RECEIPT_SCAN CHECKIN_PHOTO REFERRAL CHALLENGE_COMPLETE BONUS GIFT_RECEIVED GIFT_SENT REWARD_REDEEMED }
enum TransactionStatus { PENDING VERIFIED REJECTED DISPUTED }
enum CheckinStatus { PENDING VERIFIED REJECTED }
enum RedemptionStatus { ACTIVE USED EXPIRED }
enum ChallengeType { VISIT_N_VENUES SPEND_AMOUNT WALK_STEPS COMBO STREAK }
enum BadgeRarity { COMMON RARE EPIC LEGENDARY }
```

---

## 4. Core механики (все три, как ты выбрал)

### 4.1 Механика 1 — Траты (Polar source of points)

**Два пути заработка:**

**A) У партнёра (полный курс):**
1. Юзер заходит в партнёрское заведение
2. На кассе официант сканирует QR юзера (из приложения) или вводит ID юзера
3. Официант вводит сумму чека в Merchant Web App
4. Backend считает баллы по формуле: `points = amount × venue.pointsPerCurrency × (boostMultiplier ?? 1)`
5. Юзер получает push-уведомление с начислением

**B) Скан чека из не-партнёра (ограниченный курс):**
1. Юзер фоткает чек в любом заведении
2. OCR извлекает: продавца, сумму, дату, hash чека
3. Backend проверяет: не было ли этого чека ранее, разумна ли дата, есть ли venue в БД
4. Если всё OK — начисляет баллы по **глобальному курсу скана** (например, 1 балл за 500 RSD — намеренно хуже партнёрского курса)
5. Если venue нет в БД — создаётся placeholder с рейтингом 0 партнёров (потенциальный лид для B2B-сейлса!)

**Критично — формула курса:**
```
PARTNER_RATE  = venue.pointsPerCurrency × boost  (например, 0.01 → 1 балл/100 RSD)
SCAN_RATE     = GLOBAL_CONSTANT (например, 0.002 → 1 балл/500 RSD)

PARTNER_RATE / SCAN_RATE >= 5  // партнёр должен быть минимум в 5 раз выгоднее
```

### 4.2 Механика 2 — Чекины (фото места + геолокация)

1. Юзер открывает приложение в месте
2. Геолокация определяет ближайшие venues (радиус 100м)
3. Юзер выбирает venue, делает фото витрины/блюда/интерьера
4. Backend проверяет:
   - Геопозиция совпадает с venue (distanceFromVenue < 100м)
   - Время съёмки = текущее (EXIF-данные)
   - AI-верификация фото (см. 8.4)
5. Если OK — начисляет фиксированное количество баллов (например, 5 баллов за чекин в день, лимит 1 чекин/venue/день)

**Важно:** чекин-фото даёт **меньше** баллов, чем покупка. Это вторичный источник.

### 4.3 Механика 3 — Шаги

1. Опционально, при первом запуске запрос разрешения на HealthKit/Google Fit
2. Раз в день backend получает суммарные шаги
3. **Шаги — мультипликатор**, а не самостоятельный источник:
   - Прошёл < 5000 шагов: множитель × 1.0
   - 5000-10000: × 1.1
   - 10000-15000: × 1.2
   - 15000+: × 1.3
4. Множитель применяется к следующей покупке/чекину дня

**Альтернатива (если не хочешь мультипликатор):** прямые баллы — например, 1 балл за каждые 1000 шагов сверх 5000, лимит 10 баллов/день.

### 4.4 Механика 4 — Челленджи

Еженедельные (генерятся по понедельникам), три типа на каждую неделю:
- **Простой** ("Посети 3 кофейни на неделе") — общий, для всех
- **Региональный** ("Попробуй новую кухню в Враћаре") — для города
- **Партнёрский** ("Купи в Café Willow на 1500 RSD за неделю") — спонсируется партнёром (платный модуль)

Награда — баллы + бейдж (для редких).

### 4.5 Механика 5 — Рефералка

1. У каждого юзера есть `referralCode` (короткий, 6 символов)
2. Новый юзер вводит код при регистрации
3. **Награда:** реферер получает 100 баллов **после первой покупки** реферала (не после регистрации — anti-fraud)
4. Реферал получает 50 баллов сразу (в дополнение к welcome bonus)

### 4.6 Welcome bonus с лимитом скорости траты

**Решение основателя:** юзер должен иметь возможность сразу попробовать продукт, но не может «спустить» все 500 баллов в один заход и уйти. Это балансирует мгновенное удовлетворение и retention.

**Механика:**
1. Новый юзер регистрируется → получает 500 welcome-баллов в отдельном «кошельке» со статусом `WELCOME`
2. Welcome-баллы **доступны к трате с момента регистрации**
3. **Лимит 1:** максимум 100 welcome-баллов на одну транзакцию (награда или скидка)
4. **Лимит 2:** максимум одна welcome-транзакция в 24 часа (от момента предыдущей)
5. **Срок жизни:** 90 дней с момента регистрации, после — сгорают
6. **Порядок траты:** при погашении сначала списываются `earned` баллы, потом `welcome` (так welcome растягивается дольше → больше дней с приложением)
7. Welcome **нельзя дарить** другому юзеру и **нельзя выводить** в подарочные коды

**Эффект:** юзер может прямо в день регистрации зайти в партнёрское заведение и потратить 100 баллов на эспрессо. Это первый «осязаемый момент» с продуктом. Чтобы добрать ещё 400 — нужно вернуться 4 раза в разные дни. Это и есть встроенный retention-механизм.

**Партнёрское требование (валидация при онбординге venue):**
- Каждый партнёр обязан иметь хотя бы одну **starter reward** стоимостью ≤ 100 баллов (эспрессо, маленький кофе, печенье и т.д.)
- Либо включить Discount-модель с `maxDiscountPercent ≥ 10%` (тогда 100 баллов = ~50% скидка на чек 200 RSD)
- Если партнёр не выполняет это требование, его venue **не показывается** в фильтре «доступно для welcome bonus»

**UX-формулировка:**
- На главном экране при первом запуске:
  > 🎁 **500 приветственных баллов!**
  > Можно потратить до 100 за раз — растяни удовольствие
  > Сгорают через 90 дней
- В catalog rewards: фильтр «доступно за welcome» (≤ 100 баллов)
- При попытке потратить 150 welcome за раз: «Welcome-баллы — до 100 за раз. Используй 100 сейчас или соверши покупку, чтобы заработать обычных баллов»
- При попытке second welcome-транзакции в день: «Следующая welcome-награда доступна завтра в 14:30. А пока — заработай ещё баллов!»

**Anti-fraud:**
- Welcome-баллы — только для аккаунтов с верифицированной почтой ИЛИ телефоном
- Один welcome-bonus на одного человека (детект через email + phone + device fingerprint)
- Если юзер удалил аккаунт и регистрируется снова — welcome не выдаётся (по device + phone hash)

**Поля в БД (обновлены):**
```prisma
model User {
  ...
  // Два кошелька баллов
  earnedPoints       Int       @default(0)   // заработанные обычным способом
  welcomePoints      Int       @default(500) // welcome bonus, остаток
  welcomeExpiresAt   DateTime?                // дата сгорания welcome (regDate + 90 days)
  lastWelcomeUsedAt  DateTime?                // для проверки 24-часового лимита

  // Совместимость / удобство
  totalPoints        Int       @default(0)   // earnedPoints + welcomePoints (computed/cached)
  spentPoints        Int       @default(0)   // lifetime spent
}

model Transaction {
  ...
  // Откуда списались баллы при погашении (для analytics)
  pointsFromEarned   Int       @default(0)
  pointsFromWelcome  Int       @default(0)
}
```

**Логика списания при погашении (псевдокод):**
```typescript
function spendPoints(user: User, amount: number, venueId: string): SpendResult {
  // 1. Проверяем доступность welcome-баллов
  const canUseWelcome = (
    user.welcomePoints > 0 &&
    user.welcomeExpiresAt > now() &&
    (user.lastWelcomeUsedAt === null || hoursSince(user.lastWelcomeUsedAt) >= 24)
  );

  let fromEarned = Math.min(amount, user.earnedPoints);
  let remaining = amount - fromEarned;
  let fromWelcome = 0;

  if (remaining > 0 && canUseWelcome) {
    fromWelcome = Math.min(remaining, user.welcomePoints, 100); // лимит 100 за раз
    remaining -= fromWelcome;
  }

  if (remaining > 0) {
    return { error: "INSUFFICIENT_POINTS_OR_WELCOME_LIMIT" };
  }

  return { fromEarned, fromWelcome, total: amount };
}
```


### 4.7 Подарок баллов другу

Юзер может отправить любому другому юзеру PULSE свои баллы. Лимиты:
- Можно дарить только UNLOCKED баллы (welcome bonus не дарится)
- Максимум 500 баллов в день
- Минимум 50 баллов за раз
- Anti-money-laundering: лог всех переводов, ограничение на абсолютные объёмы

### 4.8 Двойная модель погашения баллов (КРИТИЧНО)

Заведение **выбирает**, как юзеры могут тратить баллы у него — одна из двух моделей или обе одновременно:

**Модель A — Rewards (100% покрытие, фиксированные награды):**
- Заведение создаёт каталог: «Бесплатный латте за 200 баллов», «Сэндвич за 350 баллов»
- Юзер выбирает награду в приложении → активирует → получает QR-код
- В заведении показывает QR → официант сканирует → выдаёт без оплаты
- **UX-восприятие:** «Я что-то выиграл» (эмоциональная награда)

**Модель B — Discount (баллы как валюта при оплате, лимит % от чека):**
- Заведение задаёт `maxDiscountPercent` (например, 50%)
- Юзер на кассе: «Хочу применить баллы»
- Официант в Merchant App: вводит сумму чека → видит «у юзера 800 баллов = 800 RSD, максимум 50% = 600 RSD»
- Применяется минимум из (доступные баллы × курс конвертации, maxDiscountPercent от чека)
- **UX-восприятие:** «Скидка» (транзакционная выгода)

**Конверсия баллов в RSD при модели B:**
```
1 балл = (venue.pointsPerCurrency)⁻¹

Если venue даёт 1 балл за 100 RSD → 1 балл стоит 100 RSD при погашении
Если venue даёт 1 балл за 80 RSD → 1 балл стоит 80 RSD при погашении
```

**Важно:** курс заработка = курс траты у одного venue. Это означает, что заработанные у щедрого venue баллы стоят меньше денежной ценности при трате там же — но **больше**, чем если бы юзер заработал их у скупого venue. Это создаёт стимул возвращаться именно к щедрым партнёрам.

**Заведение задаёт в кабинете:**
- `enableRewards: boolean` — каталог наград
- `enableDiscount: boolean` — оплата баллами в счёт чека
- `maxDiscountPercent: 0..100` — максимум % чека, который покрывается баллами (если enableDiscount)

**Рекомендации в Merchant App при онбординге:**
- Кофейни / маленькие заведения → **Rewards** (бесплатный кофе — простая модель)
- Рестораны / средний чек > 1000 RSD → **Discount 30-50%** (юзеру выгода, заведение получает кэш)
- Premium-заведения → **обе модели одновременно**

**Поля в БД (дополняют ранее описанные):**
```prisma
model Venue {
  ...
  enableRewards      Boolean @default(true)
  enableDiscount     Boolean @default(false)
  maxDiscountPercent Int     @default(0)  // 0..100
}

model Reward {
  ...
  redemptionType  RedemptionType  // FULL_FREE, PERCENT_OFF, FIXED_AMOUNT_OFF
}

enum RedemptionType {
  FULL_FREE        // бесплатно (модель A)
  PERCENT_OFF      // x% скидка
  FIXED_AMOUNT_OFF // -X RSD
}
```

---

## 5. Геймификация (слой удержания)

### 5.1 Стрики

- **Streak** = количество дней подряд с минимум одной транзакцией (любого типа)
- Сохраняется до 36 часов после полуночи (forgiveness window)
- Бонусные баллы за milestone-стрики: 7 дней (+50), 30 дней (+200), 100 дней (+1000)
- Push-уведомление в 21:00, если стрик под угрозой

### 5.2 Бейджи

Категории:
- **Первооткрыватель** — первый чекин в venue (получает только первый юзер; супер-редкий)
- **Постоялец** — 10 чекинов в одном venue
- **Гурман** — посетил 5 разных категорий (кафе, ресторан, ритейл и т.д.)
- **Марафонец** — 30-дневный стрик
- **Местный** — 50 чекинов в одном городе
- **Глобал** — чекины в 3+ странах

### 5.3 Лидерборды

- **Городской** — топ-100 юзеров в городе по баллам за неделю/месяц
- **Районный** (если есть гео-разметка) — топ-10 в районе
- **Глобальный** — топ-100 в мире по lifetime points

Лидерборды реализуются на Redis ZSET для производительности.

---

## 6. Кабинет заведения (Merchant Web App)

### 6.1 Функции

- **Дашборд:**
  - Сегодня/неделя/месяц: новые юзеры, повторные посетители, оборот, начислено баллов, погашено наград
  - Сравнение курса с соседями (анонимизированно)
  - Воронка: посмотрели → пришли → купили → вернулись

- **Управление курсом:**
  - Базовый курс (например, 1 балл за 100 RSD)
  - Временные бусты (× 2 на эту неделю)
  - Расписание (по дням недели)

- **Управление наградами:**
  - Создание (название, описание, фото, стоимость в баллах, лимит запасов)
  - Активация/деактивация
  - Шаблоны (бесплатный кофе, скидка 10%, мерч и т.д.)

- **Транзакции:**
  - История начислений (дата, юзер-ID, сумма чека, баллы)
  - История погашений (юзер пришёл с QR-наградой)

- **Сейлс-инструменты:**
  - Партнёрский челлендж (платный)
  - Featured-показ (платный)
  - Промо-периоды

### 6.2 Подписочные тарифы

| Тариф | Цена/мес | Что входит |
|---|---|---|
| **Basic** | €30 | Базовый курс, до 5 наград, дашборд |
| **Pro** | €80 | + Кастомные челленджи, безлимит наград, аналитика, бусты курса |
| **Featured** | €150 | + Топ-выдача в районе, push-уведомления юзерам, премиум-плашка |

**Доп. услуги:**
- Спонсорский челлендж: €50 разовый
- Promoted-показ на неделю: €30

### 6.3 Интеграция с кассой (MVP)

- **Простой путь:** официант открывает Merchant Web App на планшете, сканирует QR юзера, вводит сумму чека
- **Продвинутый путь (после MVP):** интеграция с популярными POS-системами в Сербии (например, ESir, Geek+)

---

## 7. Mobile App — экраны

### 7.1 Список экранов (нумерация для удобства Claude Code)

1. **Onboarding** — приветствие, выбор языка, регистрация (email/phone)
2. **Home** — баланс баллов, стрик, рекомендации мест рядом, активные челленджи
3. **Map** — карта venues с маркерами (партнёры выделены, фильтр по категории)
4. **Venue Detail** — фото, описание, **курс баллов** (большим шрифтом!), доступные награды, отзывы
5. **Earn Points** — три кнопки: "Сканировать чек", "Чекин-фото", "Шаги" (синхронизация)
6. **Receipt Scan** — камера, OCR-результат с возможностью редактировать, подтверждение
7. **Checkin Photo** — камера, выбор venue (по геолокации), отправка
8. **Rewards** — каталог наград партнёров, фильтр по дистанции
9. **Reward Detail** — описание, "Активировать" (генерится QR-код для официанта)
10. **Challenges** — текущие челленджи, прогресс
11. **Leaderboard** — городской/районный/глобальный
12. **Profile** — аватар, бейджи, стрик, история транзакций, рефералка
13. **Friends** — список друзей, лента их активности, подарок баллов
14. **Settings** — язык, нотификации, привязка HealthKit/Google Fit, выход

### 7.2 Дизайн-принципы

Используй **ux-ui-designer skill** перед каждым экраном — генерируй два варианта.

**Тон:** energetic, social, gamified — но не cartoonish. Похоже на Strava + Beli + Letterboxd.

### 7.3 Brand identity и палитра

**Двойная палитра** — чтобы продукт работал и для playful-юзера, и для premium-заведений.

**Playful palette (для гейм-механик):**
- Pink: `#FF4D8F` (баллы, награды, стрики)
- Sky blue: `#3DBEFF` (чекины, социалка)
- Mint green: `#1FE3A0` (success-states, выполненные челленджи)
- Gradient pink→blue: `linear-gradient(135deg, #FF4D8F 0%, #3DBEFF 100%)` (главный CTA, hero-sections)
- Gradient blue→green: `linear-gradient(135deg, #3DBEFF 0%, #1FE3A0 100%)` (achievement-states)

**Neutral palette (для venue cards и контента):**
- Background: `#FFFFFF` (light) / `#0F1115` (dark)
- Text primary: `#0F1115` (light) / `#FFFFFF` (dark)
- Text secondary: `#6B7280`
- Border: `#E5E7EB` (light) / `#1F2937` (dark)
- Card background: `#F9FAFB` (light) / `#181B23` (dark)

**Где что использовать:**
- Главный экран (баланс, стрики, бейджи) → playful
- Карта и список venues → neutral (с цветными акцентами для статусов)
- Venue detail → neutral основа + playful акценты на курсе баллов
- Profile → playful
- Merchant Web App → **только neutral**, никакого розового (это professional-инструмент)

**Шрифты:**
- Mobile: SF Pro Display (iOS native), Inter (Android)
- Web: Inter
- Display (для крупных цифр баллов и курсов): Space Grotesk или Geist

**Темная тема:** обязательна с первого дня. Многие чекины происходят вечером.

---

## 8. Критичные технические детали

### 8.1 Anti-fraud для скана чеков (НЕ ВЫРЕЗАТЬ)

Проблема: юзеры будут пытаться накручивать баллы.

**Защита:**

1. **Receipt Hash:** SHA-256 от нормализованных полей чека (продавец + дата + время + сумма + последние 4 цифры номера чека). Дубликаты блокируются на уровне БД (unique index).

2. **Date validation:**
   - Чек должен быть не старше 7 дней
   - Чек не может быть из будущего

3. **Amount validation:**
   - Если сумма > 10000 RSD (~85 EUR) — отправлять на ручную модерацию
   - Если в день один юзер сканирует > 5 чеков — флаг подозрительной активности

4. **Image fingerprinting:**
   - Перцептивный хеш (pHash) фото чека
   - Сравнение с предыдущими — если идентичная картинка из соцсетей или другого юзера, блок

5. **Rate limits:**
   - Максимум 10 сканов/день/юзер
   - Максимум 3 сканы/час/юзер

6. **AI-проверка чека:**
   - Claude Sonnet с промптом: "Это реальное фото чека из заведения, или это: скриншот, фото с экрана, фейковый чек, чек из интернета?"
   - Низкая уверенность → ручная модерация

### 8.2 OCR для чеков

**Стек:**
- Primary: GPT-4o Vision (он лучше с кириллицей и плохой печатью, чем Google Vision)
- Fallback: Google Vision API
- Структурированный output: `{ vendor: string, total: number, currency: string, date: ISO, time: string, items?: [...] }`

**Промпт для OCR (псевдокод):**
```
Ты обрабатываешь фото чека из заведения в Сербии/России/Армении.
Извлеки:
- Название заведения
- Сумму к оплате (итоговую, не промежуточную)
- Валюту (RSD/EUR/AMD/RUB)
- Дату и время
- Номер чека (если есть)

Если что-то не разобрать — поставь null. Не выдумывай.
Верни JSON.
```

**Confidence threshold:** если конфиденс OCR < 0.85 — показать юзеру результат на редактирование.

### 8.3 AI-верификация фото-чекинов

**Промпт для Claude Sonnet (вижн):**
```
На фото должно быть [интерьер/блюдо/витрина] заведения "{venue.name}".
Координаты съёмки совпадают с заведением.
Проверь:
1. Это настоящее фото (не скриншот, не рендер)?
2. Это похоже на [категория venue]?
3. Есть ли признаки, что фото из интернета (логотипы поверх, кропы как в Pinterest)?

Верни JSON: { is_authentic: boolean, confidence: 0-1, reason: string }
```

### 8.4 Геолокация и обход накрутки

- Используй высокую точность GPS (HighAccuracyMode)
- Записывай accuracy radius — если > 50м, не доверяй чекину
- Сохраняй IP юзера, сравнивай с предыдущими чекинами (резкий перескок страны → флаг)
- Mock location detection (особенно на Android) — если включено, отказ

### 8.5 i18n архитектура

```
/locales
  /en
    common.json
    home.json
    earn.json
    ...
  /ru
    ...
  /sr
    ...
```

- Все strings в JSON, не хардкод
- Даты, числа, валюты через `Intl` API
- RTL не нужен (EN/RU/SR все LTR)

---

## 9. API endpoints (tRPC routers)

### 9.1 user

- `user.me` — текущий юзер
- `user.updateProfile` — обновить имя, аватар, родной город
- `user.getStreak` — текущий стрик и история
- `user.getReferrals` — список приглашённых

### 9.2 venue

- `venue.list` — список venues с фильтрами (город, категория, isPartner, near)
- `venue.detail` — детали venue
- `venue.search` — поиск по названию/категории
- `venue.nearby` — venues в радиусе X от координат

### 9.3 transaction

- `transaction.scanReceipt` — отправить фото чека на OCR
- `transaction.confirmReceipt` — подтвердить распознанные данные
- `transaction.partnerPurchase` — (вызывается мерчантом) начислить баллы за покупку
- `transaction.history` — история юзера

### 9.4 checkin

- `checkin.create` — отправить чекин с фото и геопозицией
- `checkin.history` — история чекинов

### 9.5 reward

- `reward.list` — каталог наград (фильтр по venue, по дистанции, по стоимости)
- `reward.redeem` — активировать награду, получить QR-код
- `reward.validate` — (для мерчанта) проверить QR-код

### 9.6 challenge

- `challenge.active` — активные челленджи юзера
- `challenge.join` — вступить в челлендж
- `challenge.progress` — прогресс по челленджу

### 9.7 social

- `social.gift` — подарить баллы юзеру
- `social.friends` — список друзей
- `social.feed` — лента активности друзей

### 9.8 leaderboard

- `leaderboard.city` — топ города
- `leaderboard.global` — глобальный топ

### 9.9 merchant (отдельный router, отдельный auth)

- `merchant.dashboard` — данные дашборда
- `merchant.updateRate` — обновить курс баллов
- `merchant.createReward` — создать награду
- `merchant.transactions` — история транзакций venue

---

## 10. Beachhead — план запуска

### 10.1 Месяц 1-2 (pre-launch, B2B)

**Цель:** 10-15 партнёров в одном районе Белграда (например, Враћар или Дорћол).

**Партнёры:**
- Café Willow (свой)
- JAN (свой)
- 8-13 дружественных кафе/ресторанов через HoReCa-network

**Критерий запуска для consumer-приложения:** минимум 10 партнёров в радиусе 1км.

### 10.2 Месяц 3 (soft launch)

- Запуск в одном районе Белграда
- 100-200 ранних юзеров через свой network
- Закрытое тестирование, fix bugs, optimize OCR

### 10.3 Месяц 4-6 (Belgrade rollout)

- Расширение на весь Белград
- Цель: 50+ партнёров, 2000+ MAU

### 10.4 Месяц 7+ (Ереван и далее)

- Запуск в Ереване (русскоязычная аудитория, там у тебя армянские связи)
- Потом — глобал по запросам

---

## 11. Юридические требования (НЕ ВЫРЕЗАТЬ — до запуска)

### 11.1 До MVP

- **Консультация с юристом в Сербии:** проверить, попадает ли система баллов под регулирование "stored value" или AML
- **Privacy Policy + Terms of Service:** на трёх языках
- **GDPR-compliance:** хранение данных, право на удаление, экспорт данных
- **Структура entity:** нужно ли регистрировать отдельное юр. лицо под продукт (под Perk Up d.o.o. или новое)

### 11.2 До public launch

- **Налоговая проработка:** как баллы у юзера учитываются (доход или скидка?)
- **Договоры с заведениями:** шаблон партнёрского соглашения
- **Bank/payment processing:** как принимать подписки от заведений (Stripe, локальный процессинг)

---

## 12. Приоритизация модулей (если режешь скоуп)

### Tier 1 — без этого не запустить (must-have для MVP)

1. Auth + регистрация юзера (1 неделя)
2. Venue model + список + карта (1 неделя)
3. Скан чека + OCR + начисление баллов (3 недели)
4. **Partner purchase** flow (Merchant Web App минимум: ввод суммы → начисление) (2 недели)
5. Награды у партнёра + QR-погашение (2 недели)
6. Anti-fraud для скана чеков (1 неделя)
7. Базовый профиль юзера (1 неделя)
8. i18n EN/RU/SR (1 неделя)

**Итого Tier 1: ~12 недель / 3 месяца соло-разработки**

### Tier 2 — даёт продукту "зубы" (целиться на месяц 4-5)

9. Чекины с фото и AI-верификацией (3 недели)
10. Стрики + базовые бейджи (1 неделя)
11. Рефералка (1 неделя)
12. Merchant Dashboard (аналитика) (2 недели)
13. Подписочные тарифы + Stripe (2 недели)

### Tier 3 — рост и удержание (целиться на месяц 6+)

14. Челленджи (2 недели)
15. Лидерборды (1 неделя)
16. Шаги (HealthKit/Google Fit) (2 недели)
17. Подарок баллов (1 неделя)
18. Друзья + лента (3 недели)
19. Отзывы (1 неделя)
20. Featured-показ + spons. challenges (2 недели)

### Tier 4 — пост-MVP (после первой 1000 MAU)

21. Агрегатор внешних рейтингов (Google/Yandex/Wolt) — большой технический проект
22. POS-интеграции с кассами заведений
23. Web-версия для юзеров

**Совет:** не пытайся делать Tier 1 + Tier 2 + Tier 3 параллельно. Закончи Tier 1, запусти на 100 юзерах, потом следующий tier. Иначе через 3 месяца у тебя будет 60% готовности по всем фронтам и 0% работающего продукта.

---

## 13. Метрики успеха

### MVP (месяц 3-4)

- 10+ партнёров в Белграде
- 500+ зарегистрированных юзеров
- 30%+ юзеров сделали хотя бы 1 транзакцию
- D7 retention > 20%

### После Tier 2 (месяц 5-6)

- 30+ партнёров
- 2000+ MAU
- D30 retention > 15%
- 5+ партнёров на платных тарифах (€500+/мес recurring)

### После Tier 3 (месяц 8-9)

- 50+ партнёров
- 5000+ MAU
- 15+ платных партнёров (€1500+/мес recurring)
- Запуск в Ереване

---

## 14. Что отложено (out of scope для первого года)

- Web-версия для юзеров
- Android Wear / Apple Watch app
- Marketplace для брендов (бренды покупают рекламу через бейджи)
- Crypto/Web3-интеграции
- AI-рекомендации мест на основе истории
- Социальный граф (follows, лайки, комменты)
- Видео-отзывы
- Live-челленджи (real-time)

---

## 15. Промпт для запуска в Claude Code

```
Я делаю PULSE — программу лояльности с конкурентным курсом баллов между заведениями.
Юзеры зарабатывают баллы через скан чеков (везде, базовый курс) или у партнёров
(в 10 раз лучший курс), тратят — только у партнёров. Заведения сами устанавливают
свой курс щедрости и публично конкурируют за клиента.

Стек: Next.js 15 App Router + tRPC + Prisma + PostgreSQL (Supabase) + React Native + Expo.
Хостинг: Vercel + Supabase.

Сейчас работаем над Tier 1 (см. PULSE_SPEC.md, раздел 12).
Начинаем с шага 1: Auth + регистрация юзера.

План утверждён. Работай автономно до результата.

Требования к шагу 1:
- Email + phone passwordless через NextAuth
- Поддержка EN/RU/SR с первого экрана (i18next)
- Welcome bonus 500 баллов в отдельном кошельке `welcomePoints`,
  доступен к трате сразу (раздел 4.6)
- Лимит траты welcome: 100 за раз, 1 транзакция в 24 часа
- Срок жизни welcome: 90 дней с регистрации (поле welcomeExpiresAt)
- При погашении сначала тратятся earnedPoints, потом welcomePoints
- Реферальный код опционально при регистрации (раздел 4.5)
- Реферал получает +50 баллов в earnedPoints сразу при регистрации с кодом
- Структура папок как в Rayve (multi-domain Next.js)
- БД: модель User с полями earnedPoints, welcomePoints, welcomeExpiresAt,
  lastWelcomeUsedAt, language, referralCode, referredById (раздел 3 + 4.6)

Спека в @PULSE_SPEC.md. Если есть вопросы по архитектуре — задавай ДО старта.
Anti-fraud для welcome bonus: один welcome на email + phone + device fingerprint.
```

---

## 16. Финальные решения (закрыто)

Все ключевые решения зафиксированы в разделе 0 — см. начало документа.

**Что осталось сделать ДО старта Claude Code (не блокеры разработки, но обязательны до launch):**

1. **Юридическая консультация в Сербии** (раздел 11) — структура нового entity, налогообложение баллов, AML-комплаенс, GDPR. Можно делать параллельно с разработкой Tier 1, но обязательно до public launch.

2. **Logo и финальный визуальный гайд** — палитра решена (раздел 7.3), но нужен логотип. Можно поручить дизайнеру либо нагенерить варианты в Figma + ux-ui-designer skill.

3. **Pricing page для Merchant** — финальные цены тарифов (раздел 6.2 — стартовые ориентиры €30/€80/€150). Финальные цифры подтвердить в первых 5 разговорах с заведениями.

4. **Шаблон партнёрского договора** — юридический документ, подписывается с каждым заведением. Готовится с юристом.

---

## 17. Первый шаг в Claude Code

После прочтения этой спеки начинаем с **Tier 1, шаг 1** — Auth + регистрация юзера.

Используй промпт из раздела 15.

**Дальше план движения:**
1. Tier 1 шаги 1-8 (~3 месяца) → soft launch на 100 юзерах в одном районе Белграда
2. Tier 2 шаги 9-13 (~2 месяца) → расширение по Белграду
3. Tier 3 шаги 14-20 (~3 месяца) → запуск в Ереване
4. Tier 4 — после первой 1000 MAU

**Критерий перехода между tier'ами:** не «всё готово», а «работает у реальных юзеров и метрики из раздела 13 достигнуты».

