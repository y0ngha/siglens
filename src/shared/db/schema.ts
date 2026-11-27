import 'server-only';

import { sql } from 'drizzle-orm';
import {
    bigint,
    boolean,
    char,
    check,
    customType,
    date,
    doublePrecision,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    primaryKey,
    smallint,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';
import type { FunnelEventContext } from '@/shared/lib/funnel/funnelEvents';
import { LOCALES } from '@/shared/i18n/locales';
import { EMAIL_MAX_LENGTH } from '@/shared/config/email';
import { LLM_PROVIDER_VALUES } from '@/shared/config/llmProviders';
import { API_KEY_NAME_MAX_LENGTH } from '@/shared/config/publicApi';
import {
    EMAIL_REPORT_CONSENT_SOURCE_VALUES,
    MAIL_ALERT_CONSENT_SOURCE_VALUES,
    MAIL_ALERT_DELIVERY_STATUS_VALUES,
    MAIL_ALERT_TOPIC_KIND_VALUES,
    OAUTH_PROVIDER_VALUES,
    PRICE_ALERT_APPROACH_VALUES,
    PRICE_ALERT_BASIS_VALUES,
    PRICE_ALERT_CONDITION_VALUES,
    PRICE_ALERT_MARKET_VALUES,
    PRICE_ALERT_STATUS_VALUES,
    SHAREABLE_KIND_VALUES,
    SIGNAL_SCAN_OUTCOME_VALUES,
    SYMBOL_MAX_LENGTH,
    TERMS_KIND_VALUES,
    USER_TIER_VALUES,
} from './constants';

const EXCHANGE_MAX_LENGTH = 32;
const FMP_SYMBOL_MAX_LENGTH = 64;
const NOTICE_TITLE_MAX_LENGTH = 200;
const API_KEY_PREFIX_MAX_LENGTH = 16;
const SHA256_HEX_LENGTH = 64;

// Repositories also set updated_at explicitly via `sql`now()`` in their
// `update()` / `onConflictDoUpdate()` calls; this $onUpdateFn(nowFn) hook is
// only a safety net for direct ORM updates that forget the explicit assignment
// (Drizzle does not invoke $onUpdateFn on `onConflictDoUpdate`).
const nowFn = (): Date => new Date();

/**
 * DB 콘텐츠 로케일 enum. `shared/i18n/locales.ts`의 `LOCALES`에서 파생한다 —
 * 로케일을 추가할 때 손댈 곳을 한 군데로 유지하기 위함이고, 값이 어긋나면
 * `schema.test.ts`가 실패한다.
 */
export const contentLocaleEnum = pgEnum('content_locale', LOCALES);

/** Postgres enum for user subscription tier. */
export const userTierEnum = pgEnum('user_tier', USER_TIER_VALUES);

/** Postgres enum for supported OAuth providers. */
export const oauthProviderEnum = pgEnum(
    'oauth_provider',
    OAUTH_PROVIDER_VALUES
);

/** Postgres enum for supported LLM providers whose API keys are stored per user. */
export const llmProviderEnum = pgEnum('llm_provider', LLM_PROVIDER_VALUES);

/** Postgres enum for shareable analysis kinds (chart, overall, news, etc.). */
export const shareableKindEnum = pgEnum(
    'shareable_kind',
    SHAREABLE_KIND_VALUES
);

/** Registered users — one row per account, keyed by UUID. */
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: EMAIL_MAX_LENGTH }).notNull().unique(),
    passwordHash: text('password_hash'),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    tier: userTierEnum('tier').notNull().default('member'),
    emailVerified: boolean('email_verified').notNull().default(false),
    /**
     * 공개 API(`/api/v1`)의 기본 모델(ModelId). `null`이면 `run_fresh_analysis`가 요청마다
     * `model`을 요구한다. 모델 ID는 core 로스터가 바뀌어도 DB 제약이 발목을 잡지 않도록 enum이
     * 아니라 varchar이고, 유효성은 `setApiDefaultModelAction`이 core 로스터로 검증한다.
     */
    apiDefaultModel: varchar('api_default_model', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdateFn(nowFn),
});

/** Auth sessions — linked to a user and expire at a fixed timestamp. */
export const sessions = pgTable(
    'sessions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        index('sessions_user_id_idx').on(table.userId),
        index('sessions_expires_at_idx').on(table.expiresAt),
    ]
);

/**
 * 방문자 1명당 하루 1행. DAU/MAU 집계용.
 *
 * 복합 PK 하나가 세 가지를 동시에 한다: 중복 방지(`ON CONFLICT DO NOTHING`의
 * 대상), DAU 조회 인덱스(`WHERE date = $1`이 PK 접두사), MAU range 스캔.
 * 별도 인덱스도 `id` 컬럼도 두지 않는다.
 *
 * ⚠️ `feat/symbol-views` 머지부터 비콘이 첫 신뢰 입력 뒤에만 나간다
 * (`shared/lib/onFirstInteraction`). 그 전 행에는 입력 없이 렌더만 한 헤드리스가
 * 섞여 있다(2026-09 실측 KR 외 1,237행 대부분) — 전환 전후 DAU는 직접 비교하지 않는다.
 */
export const visitorDays = pgTable(
    'visitor_days',
    {
        visitorHash: text('visitor_hash').notNull(),
        /**
         * KST 기준 `YYYY-MM-DD`. UTC로 하면 자정이 KST 09:00이라 한국 사용자의
         * 오전이 이틀로 쪼개진다.
         */
        date: date('date').notNull(),
        /**
         * 그날 그 방문자의 첫 접속 시각. 집계에는 쓰이지 않는다 — 시간대별
         * 트래픽 분포를 나중에 보고 싶을 때 이 컬럼이 없으면 소급이 불가능하다.
         */
        firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /**
         * 그날 그 방문자의 첫 요청 User-Agent 원문.
         *
         * 집계에는 쓰이지 않는다 — 존재 이유는 **사후 검증**이다. `isBot`을 통과한
         * 트래픽이 정말 사람인지는 UA를 보관하지 않으면 확인할 방법이 없고,
         * 봇 필터를 조일 때 "이 토큰을 막으면 며칠치 수치가 얼마나 빠지는가"를
         * 소급해서 볼 수도 없다.
         *
         * 이미 `visitorHash`의 입력이라 새로 수집하는 항목은 아니지만, 해시와 달리
         * 원문이므로 개인정보처리방침 §1의 접속 통계 항목에 명시돼 있어야 한다.
         */
        userAgent: text('user_agent'),
        /**
         * Cloudflare `cf-ipcountry` (ISO 3166-1 alpha-2). CF를 거치지 않으면 null.
         *
         * 봇 농장 판별에 가장 값싼 신호다 — 한국어 서비스에 특정 국가에서 UA가
         * 균일한 트래픽이 몰리면 사람이 아니다. IP 원문은 여전히 저장하지 않는다.
         */
        country: text('country'),
        /**
         * 비콘이 뜬 페이지의 경로. 쿼리스트링은 버린다(검색어·토큰이 섞일 수 있다).
         *
         * 비콘은 하루 한 번이므로 사실상 그날의 진입 페이지다. 어떤 페이지로
         * 들어오는지를 보는 용도.
         */
        landingPath: text('landing_path'),
        /**
         * 그날 첫 진입의 출처 분류(`EntrySource`, 예: `chatgpt`·`google`·`paid`·`email`·`share`·`other`).
         * 원본 Referer 호스트·`utm_source`·`utm_medium`·광고 클릭 식별자 값은 저장하지 않는다 — 분류는
         * `classifyEntrySource`가 수신 시점에 한다. 광고(`paid`)·메일(`email`)·공유 링크(`share`)는 v15에서
         * 더해졌고, 그 전 행의 `google` 등에는 광고 클릭이 섞여 있다. 같은 사이트 안의 이동·직접 방문은
         * null. 같은 날 다시 와도 첫 행의 값을 바꾸지 않는다. 개인정보처리방침 v15 §2 접속 통계 항목에
         * 고지돼 있어야 한다.
         */
        entrySource: text('entry_source'),
        /**
         * 비콘을 보낸 페이지의 사이트. `main`(siglens.io) 또는 `ai`(ai.siglens.io) — 원본 호스트는
         * 저장하지 않는다. 두 호스트가 같은 `/api/presence`와 같은 해시·PK를 쓰므로 한 방문자가 같은
         * 날 두 사이트를 열어도 행은 하나이고, 이 값은 **먼저 연 사이트**다(첫 행이 이긴다).
         * 도입 전 행은 null. 개인정보처리방침 v15 §2 접속 통계 항목에 고지돼 있어야 한다.
         */
        landingSite: text('landing_site'),
        /**
         * 이 브라우저에서 처음 방문한 뒤 지난 일수 구간(`new`·`d1_6`·`d7_13`·`d14_29`·`d30_89`·
         * `d90_plus`). 브라우저가 로컬 스토리지의 날짜 기록으로 계산해 구간값만 보낸다. 구간값을 못
         * 보낸 방문(저장소 차단·옛 클라이언트)과 도입 전 행은 null. 개인정보처리방침 v15 §2에 고지.
         */
        firstVisitBucket: text('first_visit_bucket'),
        /**
         * 직전 방문 뒤 지난 일수 구간(`none`·`d1`·`d2_6`·`d7_13`·`d14_29`·`d30_plus`). 같은 날 첫 행의
         * 값을 바꾸지 않는다. 개인정보처리방침 v15 §2에 고지.
         */
        lastVisitBucket: text('last_visit_bucket'),
        /**
         * 이 브라우저가 방문한 날 수 구간(`n1`·`n2`·`n3_4`·`n5_9`·`n10_19`·`n20_plus`). 개인정보처리방침
         * v15 §2에 고지.
         */
        visitDaysBucket: text('visit_days_bucket'),
        /**
         * 이번 방문이 첫 방문 다음 날(`d1`), 7~13일 뒤(`d7`), 30~36일 뒤(`d30`) 창의 **첫** 방문이면 그
         * 창, 아니면 null. 한 브라우저는 창마다 최대 한 번 채워지므로 ID 없이 D7 비율을 셀 수 있다.
         * 개인정보처리방침 v15 §2에 고지.
         */
        returnWindow: text('return_window'),
        /**
         * 비콘을 보낸 시점에 로그인한 회원이면 그 id. 회원 D7/D30 재방문율의 축이다
         * (`scripts/funnel-report.ts`). 탈퇴하면 SET NULL — 방문 행(익명 집계)은 남고 회원
         * 연결만 끊긴다. 같은 날 익명으로 먼저 왔다가 로그인하면 행이 이미 있으므로
         * `recordVisit`이 `COALESCE(user_id, excluded.user_id)`로 **한 번만** 채운다.
         */
        userId: uuid('user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
    },
    table => [
        primaryKey({ columns: [table.date, table.visitorHash] }),
        index('visitor_days_user_id_idx').on(table.userId, table.date),
    ]
);

/**
 * 가입 퍼널 이벤트 — 넛지 노출·클릭, 잠긴 요소 클릭, 가입 완료, 관심종목·리포트 설정.
 * 카탈로그와 context 형태는 `shared/lib/funnel/funnelEvents.ts`가 닫힌 유니언으로 정한다.
 * 검색어·URL·자유 문장은 넣지 않는다. 보존 400일(`visitor_days`와 같은 근거) —
 * `src/app/api/presence/funnel/route.ts`의 `RETENTION_DAYS`와 방침 §4가 같이 움직인다.
 */
export const funnelEvents = pgTable(
    'funnel_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        occurredAt: timestamp('occurred_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** `visitor_days`와 같은 해시(`buildVisitorHash`). */
        visitorHash: text('visitor_hash').notNull(),
        /** 로그인 회원이면 채운다. 탈퇴 시 cascade 삭제. */
        userId: uuid('user_id').references(() => users.id, {
            onDelete: 'cascade',
        }),
        event: text('event').notNull(),
        /** 이벤트별 소량 컨텍스트. 자유 텍스트 금지. */
        context: jsonb('context')
            .$type<FunnelEventContext>()
            .notNull()
            .default(sql`'{}'::jsonb`),
    },
    table => [
        index('funnel_events_event_time_idx').on(table.event, table.occurredAt),
        index('funnel_events_user_time_idx').on(table.userId, table.occurredAt),
    ]
);

/**
 * 종목 페이지 일자 조회수 — 인기 목록 스크립트(`update-popular-tickers.ts`·
 * `scripts/update-popular-cryptos.ts`)의 **추가 후보** 신호.
 *
 * 개인 식별 정보를 담지 않는다(IP·UA·해시·회원 id 없음) — 종목 코드·날짜별 횟수뿐이다. 그래도
 * 개인정보처리방침 v15가 §2(종목 조회수 집계)와 §4(보존 90일)에서 이 수집을 고지한다. 중복 방지는
 * 클라이언트(`SymbolViewPing`, 종목당 하루 1회, 브라우저 저장소를 쓸 수 있을 때)가 하고,
 * 봇 필터는 비콘 게이트(`onFirstInteraction`) + `isBot`이다.
 *
 * 인증 없는 비콘이라 반복 POST로 부풀릴 수 있다. 방어선은 스크립트의 시장 필터와
 * 사람의 diff 검토다.
 */
export const symbolViewsDaily = pgTable(
    'symbol_views_daily',
    {
        /** KST `YYYY-MM-DD`. */
        date: date('date').notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        views: integer('views').notNull().default(1),
    },
    table => [primaryKey({ columns: [table.date, table.symbol] })]
);

/** Linked OAuth accounts — one row per (user, provider) pair. */
export const oauthAccounts = pgTable(
    'oauth_accounts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        provider: oauthProviderEnum('provider').notNull(),
        providerAccountId: text('provider_account_id').notNull(),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        index('oauth_accounts_user_id_idx').on(table.userId),
        uniqueIndex('oauth_accounts_provider_account_uidx').on(
            table.provider,
            table.providerAccountId
        ),
    ]
);

/** User-supplied LLM API keys (at most one per user–provider pair); encrypted_api_key stores AES-256-GCM ciphertext; plaintext never persisted. */
export const userApiKeys = pgTable(
    'user_api_keys',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        provider: llmProviderEnum('provider').notNull(),
        encryptedApiKey: text('encrypted_api_key').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        index('user_api_keys_user_id_idx').on(table.userId),
        uniqueIndex('user_api_keys_user_provider_uidx').on(
            table.userId,
            table.provider
        ),
    ]
);

/**
 * SigLens public API keys (`Authorization: Bearer slk_...`) — several per member.
 * Only `sha256(raw key)` is stored (`key_hash`); the raw key is shown once at creation and
 * never persisted. `revoked_at` is a soft delete so the audit trail survives; the auth path
 * filters on `revoked_at IS NULL`. `last_used_at` is throttled to ~1 write per minute.
 */
export const siglensApiKeys = pgTable(
    'siglens_api_keys',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: API_KEY_NAME_MAX_LENGTH }).notNull(),
        keyPrefix: varchar('key_prefix', {
            length: API_KEY_PREFIX_MAX_LENGTH,
        }).notNull(),
        keyHash: char('key_hash', { length: SHA256_HEX_LENGTH })
            .notNull()
            .unique(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
    },
    table => [index('siglens_api_keys_user_id_idx').on(table.userId)]
);

/** Member portfolio holdings — one row per (user, symbol); the user inputs the average price directly (not a lot ledger). */
export const portfolioHoldings = pgTable(
    'portfolio_holdings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        companyName: text('company_name'),
        fmpSymbol: text('fmp_symbol'),
        // numeric maps to string in Drizzle; treat as decimal strings, never JS floats.
        quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
        averagePrice: numeric('average_price', {
            precision: 20,
            scale: 8,
        }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        index('portfolio_holdings_user_id_idx').on(table.userId),
        uniqueIndex('portfolio_holdings_user_symbol_uidx').on(
            table.userId,
            table.symbol
        ),
    ]
);

/**
 * 관심종목 — 보유종목(`portfolio_holdings`)과 **별도 테이블**. 두 목록은 의미가 다르고(보유 vs
 * 지켜보기) 같은 심볼이 양쪽에 있을 수 있다. 합집합은 읽는 쪽(메일 리포트)이 만든다.
 * 심볼은 대문자 정규형. `company_name`은 담을 때의 표시명 — 리포트·목록이 FMP 재조회 없이
 * 쓰고, null이면 심볼로 표시한다.
 */
export const watchlistItems = pgTable(
    'watchlist_items',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        companyName: text('company_name'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        index('watchlist_items_user_id_idx').on(table.userId),
        uniqueIndex('watchlist_items_user_symbol_uidx').on(
            table.userId,
            table.symbol
        ),
    ]
);

/**
 * 회원 정기 메일 리포트 수신 설정 — 회원당 한 행.
 *
 * 행이 없으면 "한 번도 설정하지 않음"(= 수신 안 함)이다. 발송 시각은 회원의 `timezone`
 * 기준 로컬 시(`send_hour`)라서, cron은 매시 각 행의 로컬 요일·시를 계산해 매칭한다 —
 * UTC로 미리 환산해 저장하지 않는 이유는 DST가 있는 타임존에서 환산 결과가 철마다 바뀌기 때문이다.
 */
export const emailReportSubscriptions = pgTable(
    'email_report_subscriptions',
    {
        userId: uuid('user_id')
            .primaryKey()
            .references(() => users.id, { onDelete: 'cascade' }),
        enabled: boolean('enabled').notNull().default(false),
        /** 요일 비트마스크 — bit n = `Date#getDay()`의 n(0=일요일 … 6=토요일). */
        daysOfWeek: integer('days_of_week').notNull(),
        /** 회원 로컬 시각의 시(0–23). */
        sendHour: integer('send_hour').notNull(),
        /** IANA 타임존 이름(예: `Asia/Seoul`). */
        timezone: text('timezone').notNull(),
        /** 메일 본문 로케일 — 설정을 저장한 화면의 로케일. */
        locale: contentLocaleEnum('locale').notNull().default('ko'),
        /** 마지막으로 수신을 켠 시각(수신 동의 기록). 한 번도 켜지 않았으면 null. */
        consentedAt: timestamp('consented_at', { withTimezone: true }),
        /**
         * 마지막으로 수신을 켠 화면(`settings` | `signup_email` | `signup_oauth`). `consented_at`과
         * 같은 규칙으로 꺼진 상태에서 켤 때만 바뀐다. 동의 기록이 없으면 null.
         */
        consentSource: text('consent_source', {
            enum: EMAIL_REPORT_CONSENT_SOURCE_VALUES,
        }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        check(
            'email_report_subscriptions_consent_source_check',
            sql`${table.consentSource} IS NULL OR ${table.consentSource} IN ('settings','signup_email','signup_oauth')`
        ),
    ]
);

/**
 * 가입 때 메일 리포트를 고른 회원에게 보내는 첫 리포트의 발송 기록. 회원당 한 행이라 PK가
 * "한 번만"을 보장한다. cron이 보내기 전에 행을 삽입해 선점한다.
 */
export const emailReportWelcomes = pgTable(
    'email_report_welcomes',
    {
        userId: uuid('user_id')
            .primaryKey()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** `sending`(선점) → `sent` | `failed`. */
        status: text('status', {
            enum: ['sending', 'sent', 'failed'],
        }).notNull(),
        attempts: smallint('attempts').notNull().default(1),
        error: text('error'),
        sentAt: timestamp('sent_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        check(
            'email_report_welcomes_status_check',
            sql`${table.status} IN ('sending','sent','failed')`
        ),
        index('email_report_welcomes_created_at_idx').on(table.createdAt),
    ]
);

/**
 * 메일 리포트 발송 기록 — 회원의 로컬 날짜당 한 행.
 *
 * `(user_id, local_date)` 유니크가 멱등 키다. cron은 보내기 **전에** 행을 선점(insert)하고
 * 충돌하면 건너뛴다 — 같은 시각 슬롯에 cron이 두 번 돌거나(재시도·중첩) 회원이 그날 시각을
 * 바꿔도 하루 두 통이 나가지 않는다. 발송이 끝나면 `status`를 결과로 바꾼다.
 */
export const emailReportDeliveries = pgTable(
    'email_report_deliveries',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** 회원 타임존 기준 발송 날짜(`YYYY-MM-DD`). */
        localDate: date('local_date').notNull(),
        /** `pending`(선점) → `sent` | `failed` | `skipped`(보낼 종목 없음). */
        status: text('status').notNull(),
        symbols: text('symbols')
            .array()
            .notNull()
            .default(sql`ARRAY[]::text[]`),
        error: text('error'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        uniqueIndex('email_report_deliveries_user_date_uidx').on(
            table.userId,
            table.localDate
        ),
    ]
);

/**
 * 메일 리포트에서 뺀 종목 — 회원이 보유·관심종목 중 메일에는 싣지 않기로 한 심볼.
 *
 * 보유종목·관심종목 목록 자체는 건드리지 않는다(그 목록은 다른 화면의 진실이다). 리포트
 * 선택(`selectReportSymbols`)만 이 표를 보고 해당 심볼을 건너뛴다. 심볼은 대문자 정규형이다.
 * 보유·관심종목에서 사라진 심볼의 행도 남는다 — 리포트엔 실리지 않지만 설정 화면이 "목록에서
 * 지운 종목의 제외 기록"으로 보여 주고, 회원이 지우기 전까지 제외 상한(200개)을 차지한다.
 */
export const emailReportExcludedSymbols = pgTable(
    'email_report_excluded_symbols',
    {
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [primaryKey({ columns: [table.userId, table.symbol] })]
);

/**
 * 알림 메일 구독자 — 이메일 주소당 한 행. 회원이 아니어도 만들어진다.
 *
 * 행은 6자리 인증 코드로 주소를 확인한 **뒤에만** 생긴다(이중 동의). `user_id`는 같은 주소의 회원이
 * 있을 때만 채워지고(회원 계정에 연결), 회원이 삭제되면 행도 함께 지워진다. 구독자 행을 지우는 것이
 * 곧 수신 거부다 — 받을 항목과 발송 기록은 연쇄로 사라진다. `consented_at`·`consent_source`는
 * 처음 신청한 시각·화면이며 이후 다른 항목을 더해도 옮기지 않는다.
 */
export const mailAlertSubscribers = pgTable(
    'mail_alert_subscribers',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** `normalizeEmail` 형태(소문자, 앞뒤 공백 없음). */
        email: varchar('email', { length: EMAIL_MAX_LENGTH })
            .notNull()
            .unique(),
        userId: uuid('user_id')
            .unique()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** 메일 본문 로케일 — 처음 신청한 화면의 로케일. */
        locale: contentLocaleEnum('locale').notNull().default('ko'),
        /** 회원이 고른 경우에만 켜진다: 보유종목·관심종목의 새 신호도 함께 받기. */
        includePortfolio: boolean('include_portfolio').notNull().default(false),
        consentedAt: timestamp('consented_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        consentSource: text('consent_source', {
            enum: MAIL_ALERT_CONSENT_SOURCE_VALUES,
        }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        check(
            'mail_alert_subscribers_consent_source_check',
            sql`${table.consentSource} IN ('symbol','fear_greed','signal_hub','settings','agent_chat')`
        ),
    ]
);

/**
 * 구독자가 고른 받을 항목. `(subscriber_id, kind, key)`가 기본키라 같은 항목은 한 번만 담긴다.
 * `key`는 종류별 정규형이다: `symbol`은 대문자 심볼, `signal`은 신호 유형, `fear_greed`는
 * 시장(`us` | `kr` | `crypto`). 항목 수 상한은 저장소가 구독자 행 잠금 아래에서 지킨다.
 */
export const mailAlertTopics = pgTable(
    'mail_alert_topics',
    {
        subscriberId: uuid('subscriber_id')
            .notNull()
            .references(() => mailAlertSubscribers.id, { onDelete: 'cascade' }),
        kind: text('kind', { enum: MAIL_ALERT_TOPIC_KIND_VALUES }).notNull(),
        key: varchar('key', { length: 48 }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        primaryKey({ columns: [table.subscriberId, table.kind, table.key] }),
        check(
            'mail_alert_topics_kind_check',
            sql`${table.kind} IN ('symbol','signal','fear_greed')`
        ),
        index('mail_alert_topics_kind_key_idx').on(table.kind, table.key),
    ]
);

/**
 * 알림 메일 발송 기록 — 구독자의 알림 날짜(KST)당 한 행.
 *
 * `(subscriber_id, alert_date)` 유니크가 "하루 한 통"의 멱등 키다. 발송기는 보내기 **전에** 행을
 * 선점(insert)하고 충돌하면 건너뛴다. 보낼 게 없는 날은 행을 만들지 않는다. `item_keys`는 메일에 실린
 * 항목의 키라서 이후 7일 반복 발송을 막는 데 쓴다. 구독자가 지워지면 함께 사라진다.
 */
export const mailAlertDeliveries = pgTable(
    'mail_alert_deliveries',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        subscriberId: uuid('subscriber_id')
            .notNull()
            .references(() => mailAlertSubscribers.id, { onDelete: 'cascade' }),
        /** 발송 슬롯의 한국 시간 날짜(`YYYY-MM-DD`). */
        alertDate: date('alert_date').notNull(),
        /** `pending`(선점) → `sent` | `failed`. */
        status: text('status', {
            enum: MAIL_ALERT_DELIVERY_STATUS_VALUES,
        }).notNull(),
        itemKeys: text('item_keys')
            .array()
            .notNull()
            .default(sql`ARRAY[]::text[]`),
        error: text('error'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        check(
            'mail_alert_deliveries_status_check',
            sql`${table.status} IN ('pending','sent','failed')`
        ),
        uniqueIndex('mail_alert_deliveries_subscriber_date_uidx').on(
            table.subscriberId,
            table.alertDate
        ),
        index('mail_alert_deliveries_alert_date_idx').on(table.alertDate),
    ]
);

/**
 * 가격대 알림 — 구독자(`mail_alert_subscribers`)가 가진 한 번짜리 알림 한 행. 아침 알림 메일이 완료된
 * 일봉 종가로 조건을 판정해 처음 충족한 세션에 한 줄을 싣고(`status`가 `fired`로 바뀐다) 끝난다.
 *
 * 모델이 쓴 자유 문장은 저장하지 않는다: 종목·조건·가격·기준(분석 구간, 무효화 기준, 말한 가격)만 담는다.
 * `proposal_id`는 서명된 제안 토큰에서 오며 `(subscriber_id, proposal_id)` 유니크가 더블클릭·재시도를
 * 멱등하게 만든다. `starts_after_session`은 만든 시점의 마지막 완료 세션으로, 그 뒤 종가만 센다
 * (만든 날 장중 거래가 거짓 발화를 만들지 않게). 구독자가 지워지면 알림도 함께 사라진다(수신 거부 = 구독자 삭제).
 * 조건별 모양(구간은 approach·low·high, 단일 가격은 level)은 CHECK가 지킨다.
 */
export const priceAlerts = pgTable(
    'price_alerts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        subscriberId: uuid('subscriber_id')
            .notNull()
            .references(() => mailAlertSubscribers.id, { onDelete: 'cascade' }),
        proposalId: uuid('proposal_id').notNull(),
        /** 관심종목과 같은 정규형(대문자). */
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        market: text('market', { enum: PRICE_ALERT_MARKET_VALUES }).notNull(),
        condition: text('condition', {
            enum: PRICE_ALERT_CONDITION_VALUES,
        }).notNull(),
        /** `enter_zone`에서만 값이 있다: 구간 위에서 내려오는지 아래에서 올라오는지. */
        approach: text('approach', { enum: PRICE_ALERT_APPROACH_VALUES }),
        // numeric은 Drizzle에서 문자열이다 — 십진 문자열로 다루고 JS 부동소수로 되돌릴 때만 Number로 바꾼다.
        zoneLow: numeric('zone_low', { precision: 20, scale: 6 }),
        zoneHigh: numeric('zone_high', { precision: 20, scale: 6 }),
        level: numeric('level', { precision: 20, scale: 6 }),
        basis: text('basis', { enum: PRICE_ALERT_BASIS_VALUES }).notNull(),
        /** 구간·무효화 기준을 읽어 온 AI 분석의 `analyzedAt`. 가격을 직접 말한 알림은 null. */
        analysisAt: timestamp('analysis_at', { withTimezone: true }),
        /** 카드에 보인 가격(만들 때의 시세). */
        referenceClose: numeric('reference_close', {
            precision: 20,
            scale: 6,
        }).notNull(),
        /** 만든 시점의 마지막 완료 세션 날짜. 이보다 뒤의 종가만 판정한다. */
        startsAfterSession: date('starts_after_session').notNull(),
        /** 한국 날짜. 이 날짜까지는 살아 있다(만료일 당일은 아직 active). */
        expiresOn: date('expires_on').notNull(),
        status: text('status', { enum: PRICE_ALERT_STATUS_VALUES })
            .notNull()
            .default('active'),
        firedSession: date('fired_session'),
        firedClose: numeric('fired_close', { precision: 20, scale: 6 }),
        firedAt: timestamp('fired_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        check('price_alerts_market_check', sql`${table.market} IN ('us','kr')`),
        check(
            'price_alerts_condition_check',
            sql`${table.condition} IN ('enter_zone','close_below','close_above')`
        ),
        check(
            'price_alerts_approach_check',
            sql`${table.approach} IN ('from_above','from_below')`
        ),
        check(
            'price_alerts_basis_check',
            sql`${table.basis} IN ('analysis_entry_zone','analysis_invalidation','price_level')`
        ),
        check(
            'price_alerts_status_check',
            sql`${table.status} IN ('active','fired')`
        ),
        check(
            'price_alerts_shape_check',
            sql`(${table.condition} = 'enter_zone' AND ${table.approach} IS NOT NULL AND ${table.zoneLow} IS NOT NULL AND ${table.zoneHigh} IS NOT NULL AND ${table.level} IS NULL AND ${table.zoneLow} > 0 AND ${table.zoneLow} <= ${table.zoneHigh}) OR (${table.condition} IN ('close_below','close_above') AND ${table.approach} IS NULL AND ${table.zoneLow} IS NULL AND ${table.zoneHigh} IS NULL AND ${table.level} IS NOT NULL AND ${table.level} > 0)`
        ),
        // numeric은 NaN을 저장하고 NaN은 모든 수보다 크게 비교된다 — `> 0` 검사만으로는 걸러지지 않는다.
        check(
            'price_alerts_finite_check',
            sql`${table.zoneLow} <> 'NaN' AND ${table.zoneHigh} <> 'NaN' AND ${table.level} <> 'NaN' AND ${table.referenceClose} <> 'NaN' AND ${table.firedClose} <> 'NaN'`
        ),
        check(
            'price_alerts_reference_close_check',
            sql`${table.referenceClose} > 0`
        ),
        // 한 번 알리면 끝이다: 진행 중이면 알린 흔적이 없고, 알렸으면 세 값이 모두 있다.
        check(
            'price_alerts_fired_state_check',
            sql`(${table.status} = 'active' AND ${table.firedSession} IS NULL AND ${table.firedClose} IS NULL AND ${table.firedAt} IS NULL) OR (${table.status} = 'fired' AND ${table.firedSession} IS NOT NULL AND ${table.firedClose} IS NOT NULL AND ${table.firedAt} IS NOT NULL)`
        ),
        // 분석에서 읽은 기준은 분석 시각을 가지고, 진입 구간은 구간 조건, 무효화 기준은 아래로 닫히는 조건과만 짝이다.
        check(
            'price_alerts_basis_shape_check',
            sql`(${table.basis} = 'price_level' AND ${table.analysisAt} IS NULL) OR (${table.basis} = 'analysis_entry_zone' AND ${table.analysisAt} IS NOT NULL AND ${table.condition} = 'enter_zone') OR (${table.basis} = 'analysis_invalidation' AND ${table.analysisAt} IS NOT NULL AND ${table.condition} = 'close_below')`
        ),
        uniqueIndex('price_alerts_subscriber_proposal_uidx').on(
            table.subscriberId,
            table.proposalId
        ),
        index('price_alerts_status_expires_idx').on(
            table.status,
            table.expiresOn
        ),
    ]
);

/**
 * Korean stock ticker metadata — keyed by ticker symbol.
 *
 * `delisted_at` is the listing-status column: `NULL` means currently listed.
 * Rows are **marked, never deleted** — a visitor arriving on a delisted symbol's
 * URL still needs its Korean name, and an incorrect mark costs nothing to undo.
 * Search and sitemap read only the `NULL` rows; name lookup reads all of them.
 */
export const koreanTickers = pgTable(
    'korean_tickers',
    {
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).primaryKey(),
        koreanName: text('korean_name').notNull(),
        name: text('name').notNull(),
        exchange: varchar('exchange', {
            length: EXCHANGE_MAX_LENGTH,
        }).notNull(),
        exchangeFullName: text('exchange_full_name').notNull(),
        delistedAt: timestamp('delisted_at', { withTimezone: true }),
        /**
         * 상장주식수(공공데이터포털 주식시세 V2 `lstgStCnt`, `kr-tickers` cron이 매일 갱신). 한국 수급 스냅샷의 발행주식수다.
         * 미국 행과 보충 소스를 받지 못한 날의 신규 행은 null.
         */
        listedShares: bigint('listed_shares', { mode: 'number' }),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [index('korean_tickers_delisted_at_idx').on(table.delistedAt)]
);

/**
 * Cryptocurrency asset universe — seeded from FMP `cryptocurrency-list`.
 * Mirrors `koreanTickers` shape. Membership in this table is the
 * authoritative crypto classifier (FMP's exchange field is inconsistent:
 * "CCC" in the list vs "CRYPTO" in quote/search).
 *
 * `korean_name` is nullable by design: the cryptocurrency-list seed intentionally
 * leaves it NULL; Korean names are populated lazily in a later plan, mirroring the
 * `asset_translations` lazy-translation pattern.
 */
export const cryptoAssets = pgTable('crypto_assets', {
    symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).primaryKey(),
    name: text('name').notNull(),
    koreanName: text('korean_name'),
    circulatingSupply: doublePrecision('circulating_supply'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdateFn(nowFn),
});

/**
 * Korean company description translations — one row per symbol, populated
 * lazily on first visit and persisted permanently (no TTL / no deployment eviction).
 */
export const profileDescriptionTranslations = pgTable(
    'profile_description_translations',
    {
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).primaryKey(),
        descriptionKo: text('description_ko').notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    }
);

/** Korean–English asset name translations — keyed by ticker symbol. */
export const assetTranslations = pgTable('asset_translations', {
    symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).primaryKey(),
    name: text('name').notNull(),
    koreanName: text('korean_name').notNull(),
    fmpSymbol: varchar('fmp_symbol', {
        length: FMP_SYMBOL_MAX_LENGTH,
    }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdateFn(nowFn),
});

/**
 * 평이화(쉽게보기) LLM 산출물 저장소. 예전에는 Upstash Redis에 30일 TTL로 캐시했는데,
 * LLM이 만든 텍스트라 유실되면 비용이 다시 들고 재생성 전까지 사용자는 `plain: null`을
 * 받는다 — 그래서 내구 저장소인 DB에 둔다.
 *
 * 키는 내용 주소 방식이다: `input_digest`가 프롬프트 전문의 sha256이라 같은 입력은 항상
 * 같은 키를 얻고, 입력이 조금이라도 바뀌면 다른 키가 된다. 그래서 행에 만료가 없다 —
 * 예전 TTL은 메모리를 묶어 두려는 장치였지 정합성 장치가 아니었다.
 * `prompt_version`을 올리면 옛 행이 고아가 되므로, 배포 뒤 수동으로 지운다
 * (`PLAIN_PROMPT_VERSION` 주석 참고).
 */
export const analysisPlainTexts = pgTable(
    'analysis_plain_texts',
    {
        promptVersion: text('prompt_version').notNull(),
        locale: text('locale').notNull(),
        /** 프롬프트 전문의 sha256 hex. */
        inputDigest: text('input_digest').notNull(),
        text: text('text').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        primaryKey({
            columns: [table.promptVersion, table.locale, table.inputDigest],
        }),
    ]
);

/** Contact form submissions from visitors. */
export const inquiries = pgTable('inquiries', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    // 레이더 종목 요청은 이메일이 선택이라 NULL을 허용한다. 문의 폼은 항상 채워 보낸다.
    email: varchar('email', { length: EMAIL_MAX_LENGTH }),
    answered: boolean('answered').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});

/** FMP에서 fetch한 뉴스 기사. LLM 카드 분석 전에는 titleKo/bodyKo/summaryKo/sentiment/category가 null. */
export const news = pgTable(
    'news',
    {
        id: text('id').primaryKey(),
        symbol: text('symbol').notNull(),
        source: text('source').notNull(),
        url: text('url').notNull().unique(),
        publishedAt: timestamp('published_at', {
            withTimezone: true,
        }).notNull(),
        titleEn: text('title_en').notNull(),
        titleKo: text('title_ko'),
        bodyEn: text('body_en'),
        bodyKo: text('body_ko'),
        summaryKo: text('summary_ko'),
        /** LLM-assigned sentiment: 'bullish' | 'neutral' | 'bearish' */
        sentiment: text('sentiment'),
        /** LLM-assigned category: NewsCategory value */
        category: text('category'),
        /** LLM-assigned price impact magnitude: 'high' | 'medium' | 'low' | 'negligible' */
        priceImpact: text('price_impact'),
        rawPayload: jsonb('raw_payload'),
        fetchedAt: timestamp('fetched_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        analyzedAt: timestamp('analyzed_at', { withTimezone: true }),
    },
    table => [
        index('news_symbol_published_at_idx').on(
            table.symbol,
            table.publishedAt
        ),
        index('news_published_at_idx').on(table.publishedAt),
    ]
);

/**
 * Market-wide news bucketed by feed category (sentinel symbol), isolated from the
 * per-symbol `news` table so category ingestion can never overwrite per-symbol rows.
 * `tickers` holds the article's own ticker(s) for display chips (stock/crypto/forex).
 */
export const marketNews = pgTable(
    'market_news',
    {
        id: text('id').primaryKey(),
        symbol: text('symbol').notNull(), // sentinel bucket, e.g. __NEWS_CRYPTO__
        source: text('source').notNull(),
        url: text('url').notNull().unique(),
        publishedAt: timestamp('published_at', {
            withTimezone: true,
        }).notNull(),
        titleEn: text('title_en').notNull(),
        titleKo: text('title_ko'),
        bodyEn: text('body_en'),
        bodyKo: text('body_ko'),
        summaryKo: text('summary_ko'),
        /** LLM-assigned sentiment: 'bullish' | 'neutral' | 'bearish' */
        sentiment: text('sentiment'),
        /** LLM-assigned category: NewsCategory value */
        category: text('category'),
        /** LLM-assigned price impact magnitude: 'high' | 'medium' | 'low' | 'negligible' */
        priceImpact: text('price_impact'),
        /** Article's own tickers (stock/crypto/forex) for display chips; [] when none. */
        tickers: text('tickers')
            .array()
            .notNull()
            .default(sql`ARRAY[]::text[]`),
        fetchedAt: timestamp('fetched_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        analyzedAt: timestamp('analyzed_at', { withTimezone: true }),
    },
    table => [
        index('market_news_symbol_published_at_idx').on(
            table.symbol,
            table.publishedAt
        ),
        index('market_news_published_at_idx').on(table.publishedAt),
    ]
);

/** (symbol, earnings_date) 복합키 어닝 이벤트. epsActual/revenueActual은 발표 후 채워짐. */
/** (symbol, earnings_date) 복합키 raw FMP 어닝 리포트. rawPayload는 재파싱용 전체 응답. */
export const earningsReports = pgTable(
    'earnings_reports',
    {
        symbol: text('symbol').notNull(),
        earningsDate: date('earnings_date').notNull(),
        epsActual: numeric('eps_actual'),
        epsEstimated: numeric('eps_estimated'),
        revenueActual: numeric('revenue_actual'),
        revenueEstimated: numeric('revenue_estimated'),
        lastUpdated: date('last_updated'),
        rawPayload: jsonb('raw_payload').notNull(),
        fetchedAt: timestamp('fetched_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [primaryKey({ columns: [table.symbol, table.earningsDate] })]
);

/**
 * 정규화된 FMP economic-calendar 이벤트 이력 (현재 US만 저장).
 *
 * `id`는 country+dateEt+event의 결정론적 해시(`economicCalendarId`)다. `actual`을
 * 포함하지 않으므로 발표 후 actual이 채워져도 같은 행으로 upsert돼 갱신된다
 * (그리드의 React key `${date}:${event}:${actual}`와는 의도가 다른 안정 키).
 *
 * SP-D에서 별도 마이그레이션으로 sentiment/summaryKo/interpretationKo/analyzedAt가
 * 추가된다 — SP-A 테이블에는 미포함.
 */
export const economicCalendar = pgTable(
    'economic_calendar',
    {
        id: text('id').primaryKey(),
        country: text('country').notNull(),
        // FMP 원본 'YYYY-MM-DD HH:mm:ss' — 존 마커 없는 **UTC** 벽시계다(ET 아님,
        // 2026-09-14 실측). 컬럼명 `date_et`는 예전 오인의 흔적이지만 마이그레이션
        // 없이 그대로 둔다. KST 변환은 표시 계층(fmpCalendarDateTimeToKst)에서 한다.
        dateEt: text('date_et').notNull(),
        event: text('event').notNull(),
        // 'High' | 'Medium' | 'Low' — text 저장, 읽기 경계에서 검증.
        impact: text('impact').notNull(),
        estimate: doublePrecision('estimate'),
        previous: doublePrecision('previous'),
        // 발표 전 null; ingestion 재fetch 시 채워짐.
        actual: doublePrecision('actual'),
        unit: text('unit').notNull(),
        fetchedAt: timestamp('fetched_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** core analyzeEconomicEvent 결과: 'bullish' | 'neutral' | 'bearish'. 미분석=null. */
        sentiment: text('sentiment'),
        /** 발표 내용 1~2문장 한국어 요약. 미분석=null. */
        summaryKo: text('summary_ko'),
        /** 발표의 시장 해석(왜 중요한지). 미분석=null. */
        interpretationKo: text('interpretation_ko'),
        /** 분석 완료 시각 — 멱등성 가드(IS NULL이면 미분석). */
        analyzedAt: timestamp('analyzed_at', { withTimezone: true }),
    },
    table => [
        index('economic_calendar_date_et_idx').on(table.dateEt),
        index('economic_calendar_country_date_et_idx').on(
            table.country,
            table.dateEt
        ),
        index('economic_calendar_impact_idx').on(table.impact),
        // 미분석 발표분 스캔용 — ensureEconomicEventsAnalyzedAction이 impact+analyzedAt로 필터.
        index('economic_calendar_impact_analyzed_at_idx').on(
            table.impact,
            table.analyzedAt
        ),
    ]
);

/**
 * 경제 지표명 한국어 번역 캐시 — `assetTranslations` 미러. 코드 const 사전
 * (`INDICATOR_NAME_KO`)이 source-of-truth이고, 이 테이블은 미매핑 지표명의 core AI
 * 번역 결과를 `source:'ai'`로 캐시한다(추후 코드 사전으로 승격). `normalizedName`은
 * 접미 괄호를 제거한 base 지표명(`normalizeIndicatorName`의 base).
 */
export const economicIndicatorTranslations = pgTable(
    'economic_indicator_translations',
    {
        normalizedName: text('normalized_name').primaryKey(),
        koreanName: text('korean_name').notNull(),
        // 'dict' | 'ai' — 출처. text 저장, 읽기 경계에서 검증.
        source: text('source').notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    }
);

/** Postgres enum for legal terms document kinds. */
export const termsKindEnum = pgEnum('terms_kind', TERMS_KIND_VALUES);

/** Versioned legal documents (privacy policy, terms of service).
 *  Active version = WHERE kind = ? AND effective_date <= NOW()
 *                   ORDER BY effective_date DESC LIMIT 1. */
export const terms = pgTable(
    'terms',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        kind: termsKindEnum('kind').notNull(),
        version: integer('version').notNull(),
        effectiveDate: timestamp('effective_date', {
            withTimezone: true,
        }).notNull(),
        body: text('body').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        uniqueIndex('terms_kind_version_uidx').on(table.kind, table.version),
        index('terms_kind_effective_date_idx').on(
            table.kind,
            table.effectiveDate
        ),
    ]
);

/** User agreement records — one row per (user, terms) pair.
 *  Mutable: `agreed` and `updatedAt` change if user revokes/re-grants
 *  consent (future feature for optional terms). */
export const agreements = pgTable(
    'agreements',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        termsId: uuid('terms_id')
            .notNull()
            .references(() => terms.id, { onDelete: 'restrict' }),
        agreed: boolean('agreed').notNull(),
        agreedAt: timestamp('agreed_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        uniqueIndex('agreements_user_terms_uidx').on(
            table.userId,
            table.termsId
        ),
        index('agreements_user_id_idx').on(table.userId),
        index('agreements_terms_id_idx').on(table.termsId),
    ]
);

/** 사이트 공지 팝업 — DB 직접 입력으로 운영. 활성 공지 =
 *  WHERE is_active AND (starts_at IS NULL OR starts_at <= NOW())
 *                  AND (ends_at   IS NULL OR ends_at   >= NOW())
 *  ORDER BY priority DESC, created_at DESC. */
export const notices = pgTable(
    'notices',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        title: varchar('title', { length: NOTICE_TITLE_MAX_LENGTH }).notNull(),
        body: text('body').notNull(),
        linkUrl: text('link_url'),
        linkLabel: text('link_label'),
        // null = 전역. 예: '/', '/symbol/*'. 매칭 규칙은 entities/notice/lib/matchPath.ts.
        pathPattern: text('path_pattern'),
        priority: integer('priority').notNull().default(0),
        isActive: boolean('is_active').notNull().default(true),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        index('notices_active_window_idx').on(
            table.isActive,
            table.startsAt,
            table.endsAt
        ),
    ]
);

const CONTENT_HASH_LENGTH = 64; // sha256 hex

/**
 * 공유된 분석 스냅샷 — 사용자(또는 비회원)가 공유 링크를 생성할 때 삽입.
 *
 * - `contentHash`가 동일하면 같은 분석 내용이므로 uq 제약으로 중복 저장 방지.
 * - `userId`는 SET NULL on delete — 탈퇴한 사용자의 공유 링크는 사라지지 않고
 *   익명 스냅샷으로 유지된다(링크가 살아있으면 내용은 보여야 함).
 * - `expiresAt` 만료 행은 현재 앱 레벨의 `isExpired()` 필터로 읽기 시 걸러지며,
 *   DB 물리 삭제 크론은 아직 미구현이다(후속 작업으로 남아 있다).
 *   만료 행이 누적되어도 쿼리 결과에는 노출되지 않는다.
 */
export const sharedAnalyses = pgTable(
    'shared_analyses',
    {
        id: text('id').primaryKey(),
        userId: uuid('user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        kind: shareableKindEnum('kind').notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        contentHash: varchar('content_hash', {
            length: CONTENT_HASH_LENGTH,
        }).notNull(),
        snapshotJson: jsonb('snapshot_json').notNull(),
        /**
         * Tier of the user who created the share — stored as cheap metadata.
         * Not read on the current view path; reserved for tier-based field masking
         * on the viewer side (follow-up). Column is intentionally kept
         * to avoid a destructive migration once the follow-up ships.
         */
        sharerTier: userTierEnum('sharer_tier').notNull().default('free'),
        /**
         * 생성 시점의 로케일. **사이드카가 아니라 원본 컬럼**인 이유: 저장된
         * `snapshot_json`이 그 언어로 생성된 AI 산출물이라, 나중에 다른
         * 로케일로 다시 해석할 수 있는 성질의 값이 아니다. 로케일은 이 행의
         * 정체성의 일부다.
         *
         * `content_hash` 페이로드에도 로케일이 들어간다 —
         * `lib/contentHash.ts` 참조(로케일이 빠지면 영어 사용자가 한국어
         * 스냅샷 id를 물려받는다).
         */
        locale: contentLocaleEnum('locale').notNull().default('ko'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    },
    table => [
        index('shared_analyses_user_id_idx').on(table.userId),
        index('shared_analyses_symbol_idx').on(table.symbol),
        index('shared_analyses_expires_at_idx').on(table.expiresAt),
        uniqueIndex('shared_analyses_content_uq').on(table.contentHash),
    ]
);

/**
 * SEO 분석 스냅샷 — 심볼×탭당 last-known-good 1행.
 * SSR "최근 분석 요약" 섹션의 유일한 데이터 소스. pre-warm cron만 write하고
 * 실패 시 이전 행이 유지된다(fail-open). content는 core 정규화 타입드 결과
 * (탭별 스키마 상이 — HTML 아님, 렌더러가 산문 변환).
 */
export const seoAnalysisSnapshots = pgTable(
    'seo_analysis_snapshots',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        tab: varchar('tab', { length: 16 }).notNull(),
        /**
         * 프리웜된 분석 본문의 언어. 공유 스냅샷과 같은 이유로 원본 컬럼이다 —
         * 본문이 그 언어로 **생성**된 것이라 사후 해석 대상이 아니다.
         *
         * unique 인덱스가 `(symbol, tab)`에서 `(symbol, tab, locale)`로
         * 넓어진다. 넓히지 않으면 en 프리웜이 ko 행을 덮어써서, 프리웜 순서에
         * 따라 어느 언어가 남을지가 정해진다.
         */
        locale: contentLocaleEnum('locale').notNull().default('ko'),
        content: jsonb('content').notNull(),
        /**
         * 평이화("쉽게보기") 산문. 없으면 `null`.
         *
         * 프리웜이 스냅샷을 구울 때 함께 만들어 둔다. 이 컬럼이 없던 동안
         * 쉽게보기는 차트 탭에서만 동작했다 — 나머지 여섯 탭은 스냅샷이 있으면
         * 클라이언트 AI 위젯을 아예 마운트하지 않는 XOR 게이팅이라
         * (`hasCongressProse`·`hasOverallProse` 등), 위젯에 붙어 있던 토글도
         * 함께 사라졌기 때문이다. 방문 시점에 평이화를 돌리면 그 탭들이 매
         * 방문마다 LLM 왕복을 태우게 되므로, 스냅샷과 같은 시점에 굽는다.
         *
         * `content`와 같은 행에 두는 이유: 둘은 같은 분석 결과의 두 표현이라
         * 따로 만료되면 안 된다. 원문이 갱신됐는데 평이화가 옛것으로 남으면
         * 토글이 서로 다른 분석을 오간다.
         */
        plain: text('plain'),
        model: varchar('model', { length: 64 }).notNull(),
        generatedAt: timestamp('generated_at', {
            withTimezone: true,
        }).notNull(),
        /**
         * 이 (symbol, tab, locale) 조합의 본문이 **처음** 만들어진 시각.
         *
         * `generatedAt`은 매 프리웜마다 덮이는 "최신 생성"이라 발행일로 쓸 수 없다.
         * 뉴스 탭 페이지의 `Article` 구조화데이터가 `datePublished`를 필요로 하는데,
         * 최신 생성 시각을 발행일이라 주장하면 전 종목이 매일 새로 발행된다는 거짓
         * 신선도 신호가 된다(2026-09-17 정책 감사 M2와 같은 종류의 문제).
         *
         * upsert는 INSERT에서만 채우고 `onConflictDoUpdate`에서는 건드리지 않는다.
         * 컬럼이 생기기 전 행은 `NULL`이고, 1회 백필
         * (`db/scripts/backfillSnapshotFirstGeneratedAt.ts`)이 진실한 소스가 있는
         * 탭만 채운다 — 없으면 `NULL`로 남기고 소비자가 필드를 생략한다.
         */
        firstGeneratedAt: timestamp('first_generated_at', {
            withTimezone: true,
        }),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        uniqueIndex('seo_analysis_snapshots_symbol_tab_locale_uq').on(
            table.symbol,
            table.tab,
            table.locale
        ),
        index('seo_analysis_snapshots_symbol_idx').on(table.symbol),
    ]
);

/**
 * **DB 콘텐츠 번역 사이드카.**
 *
 * 뉴스 제목·공지 본문·약관처럼 카탈로그로 옮길 수 없는 문구의 로케일별 값을
 * 한 테이블에 모은다. 기존 테이블의 원본 행은 그대로 두고, 이 테이블에 없는
 * 로케일은 원본(한국어 컬럼)으로 폴백한다(`shared/db/contentLocale.ts`).
 *
 * **왜 테이블마다 `locale` 컬럼을 더하지 않았나**
 * - 로케일 추가가 **행 추가**로 끝난다. 컬럼 방식이면 12개 테이블에 매번
 *   마이그레이션이 필요하다.
 * - `notices`는 특히 컬럼/행 분리가 위험하다. 공지 팝업의 "다시 보지 않기"가
 *   `id`를 localStorage에 저장하므로, 로케일마다 별도 행(=별도 id)을 만들면
 *   한국어로 닫은 공지가 영어로 다시 뜬다. 사이드카는 원본 `id`를 유지한다.
 * - `shared_analyses`는 `content_hash` 단독 unique로 dedupe한다. 원본 행에
 *   `locale`을 더하면 먼저 저장된 한국어 행을 영어 사용자가 물려받는다
 *   (먼저 저장된 행이 다른 로케일 사용자에게 노출된다). 사이드카는 그 제약을 건드리지 않는다.
 *
 * **한계(의도적)**
 * - 원본 행과의 FK가 없다 — `entity_id`가 테이블마다 타입이 달라(uuid/text)
 *   단일 FK를 걸 수 없다. 원본 삭제 시 고아 행이 남는다. 정리는
 *   후속 작업으로 둔다(고아 행은 조회 키가
 *   맞지 않아 화면에 새어 나오지 않는다).
 * - `field`가 문자열이다 — 오타를 막으려고 호출부는
 *   `shared/db/contentTranslationFields.ts`의 상수만 쓴다.
 */
export const contentTranslations = pgTable(
    'content_translations',
    {
        /** 원본 테이블 식별자. `TRANSLATABLE_ENTITY` 참조. */
        entity: text('entity').notNull(),
        /** 원본 행의 PK를 문자열로. uuid·text·복합키 모두 문자열로 정규화한다. */
        entityId: text('entity_id').notNull(),
        /** 번역 대상 필드명. `CONTENT_FIELD` 상수만 사용한다. */
        field: text('field').notNull(),
        locale: contentLocaleEnum('locale').notNull(),
        value: text('value').notNull(),
        /**
         * 'human' | 'ai' — 번역 출처.
         *
         * 약관처럼 인간 번역이 필수인 문서는 `source = 'human'` 행만 신뢰한다
         * (설계 §2.5). 읽기 경계에서 검증한다.
         */
        source: text('source').notNull().default('ai'),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        primaryKey({
            columns: [table.entity, table.entityId, table.field, table.locale],
        }),
        /**
         * 배치 조회용 — 읽기 경로는 항상 "이 엔티티의 이 id 목록을, 이 로케일
         * 체인으로" 형태다(카드 20장 = 쿼리 1회). PK 접두사만으로는 로케일
         * 필터가 뒤에 붙어 인덱스를 다 못 쓴다.
         */
        index('content_translations_entity_locale_idx').on(
            table.entity,
            table.locale,
            table.entityId
        ),
    ]
);

/**
 * core `AssembledPrompt`의 `stable` 절편을 콘텐츠 주소로 저장하는 블롭 테이블.
 *
 * core 계약상 `stable`은 `always_on` skill digest만 담고, 호출마다 **바이트
 * 단위로 동일**하다(캐시 가능한 요청 프리픽스로 설계됐기 때문). `always_on`
 * skill이 24개, 원본 소스 합쳐 ~199KB라 이 청크를 행마다 그대로 저장하면
 * 매 분석마다 프롬프트에서 가장 큰 덩어리를 중복 적재하게 된다. 해시로
 * 주소화하면 서로 다른 블롭당 한 행만 남는다.
 */
export const analysisPromptBlobs = pgTable('analysis_prompt_blobs', {
    /** sha256(body) hex. */
    hash: char('hash', { length: CONTENT_HASH_LENGTH }).primaryKey(),
    body: text('body').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});

/**
 * 생성된 분석 1건당 1행 — core `priorAnalyses`에 되먹임할 이력.
 *
 * **`locale`은 감사용일 뿐, 절대 읽기 필터로 쓰지 않는다.** 분석은 출력
 * 로케일마다(4개) 별도 LLM 호출로 생성되지만, core가 렌더링하는 다이제스트는
 * 숫자/enum뿐인 언어중립 요약이라 네 로케일이 이력 풀 하나를 공유한다.
 * 로케일로 필터링하면 근거 없이 데이터를 4분의 1로 깎는 꼴이다.
 *
 * **`model_id`도 마찬가지로 감사용 저장이지, 읽기는 모델 불문이다.** 모델로
 * 필터링하면 대부분의 이력이 텅 비게 되고, 과거 시장 판단은 어떤 모델이
 * 냈든 과거 시장 판단이다.
 *
 * `prompt_*_hash` 두 컬럼은 `analysis_prompt_blobs.hash`를 가리키지만 FK를
 * 걸지 않는다 — 블롭 테이블과 이 테이블의 보존 주기가 다르기 때문에(아래),
 * FK가 있으면 정리(prune)가 막힌다.
 *
 * 프롬프트 관련 컬럼은 전부 nullable이다. 프롬프트 영속화가 분석 자체를
 * 실패시켜서는 안 되므로 쓰기 경로는 best-effort이고, 실패하면 그 행의
 * 프롬프트 컬럼들이 null로 남을 뿐이다.
 *
 * 보존 기간을 일부러 나눴다: `result`는 90일 보관한다 — `'1Day'`
 * prior-analysis 윈도우가 21 거래일 ≈ 역법일 30일이라 여유가 필요하다.
 * 주봉(`'1Week'`) 이전 분석은 이 90일 상한 때문에 약 12~13주치만 남는다(`PRIOR_ANALYSIS_LIMIT` 7건 이상).
 * `prompt_dynamic`은 7일 후 비운다 — 디버깅·오프라인 평가용이라 최신성만
 * 중요하다. prior-analysis 기능은 `result`만 읽으므로 프롬프트 컬럼을
 * 비워도 그 기능에는 영향이 없다.
 */
export const analysisHistory = pgTable(
    'analysis_history',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        timeframe: varchar('timeframe', { length: 8 }).notNull(),
        /** 'technical' | 'overall' */
        tab: varchar('tab', { length: 16 }).notNull(),
        modelId: varchar('model_id', { length: 64 }).notNull(),
        /**
         * 이 분석을 **생성한** 요청의 tier(`free` | `pro` 등). 같은 종목이라도 free 프리웜과 회원
         * 분석은 스킬 세트가 달라 tier 없이는 결과를 해석할 수 없다. user enum이 아닌 varchar인
         * 이유는 `signal_events.signal_type`과 같다(tier가 늘어도 DB 제약이 막지 않게).
         * 이 컬럼이 생기기 전 행과 tier를 알리지 않은 작성자의 행은 null.
         */
        tier: varchar('tier', { length: 16 }),
        /** 감사용 — 읽기 필터 금지. 테이블 JSDoc 참조. */
        locale: contentLocaleEnum('locale').notNull(),
        /** 정규화된 AnalysisResponse. */
        result: jsonb('result').notNull(),
        /**
         * 보유 맞춤(포지션 버킷이 프롬프트에 들어간) 분석인지. 맞춤 분석은 "보유자 관점"
         * 서술과 그에 맞춘 진입·청산 계획을 담아 한 회원의 보유 상태(손익 구간)를 드러내므로,
         * 다른 사람에게 보이는 읽기는 이 값으로 거른다.
         * `null`은 이 컬럼이 생기기 전 행(알 수 없음)이다. 읽기마다 규칙이 다르다.
         * - `findRecentForPrompt`(이전 분석, 에이전트 이력 요약): `false`이거나, `null`이면서 generating
         *   tier가 `free`인 행만 읽는다(free는 버킷을 만들지 않아 맞춤일 수 없다).
         * - `findLatestShareable`: `false`인 행만 읽는다. `null`은 tier와 무관하게 쓰지 않는다.
         * - 사후 결과 라벨러(`analysis_outcomes`) 캡처: `false`인 행만 가져간다. 맞춤 분석은 회원 보유 정보에서
         *   파생된 산출물이고, `null`은 맞춤이었을 수 있다.
         */
        personalized: boolean('personalized'),
        inputFingerprint: varchar('input_fingerprint', { length: 32 }),
        promptVersion: varchar('prompt_version', { length: 32 }),
        promptStableHash: char('prompt_stable_hash', {
            length: CONTENT_HASH_LENGTH,
        }),
        promptSystemHash: char('prompt_system_hash', {
            length: CONTENT_HASH_LENGTH,
        }),
        promptDynamic: text('prompt_dynamic'),
        generatedAt: timestamp('generated_at', {
            withTimezone: true,
        }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        index('analysis_history_lookup_idx').on(
            table.symbol,
            table.timeframe,
            table.tab,
            table.generatedAt.desc()
        ),
        /**
         * 결과 사후 라벨러의 캡처 스캔(`generated_at ≥ now − 6일`)과 90일 prune이 둘 다
         * `generated_at` 단독 범위로 거른다. 복합 `analysis_history_lookup_idx`는 선두가
         * `symbol`이라 이 범위를 도울 수 없다.
         */
        index('analysis_history_generated_at_idx').on(table.generatedAt),
    ]
);

/**
 * 분석이 **말한 것**과 그 **사후 결과 라벨**을 한 행에 남기는 측정 테이블(`analysis_history`와 같은 id).
 *
 * `analysis_history`는 90일 뒤, `prompt_dynamic`은 7일 뒤 사라진다. 라벨은 분석 생성 약 한 달 뒤에야
 * 계산되고(일봉 20봉 창), 라벨 정의가 바뀌면 다시 계산해야 하므로 입력(`subject`, `bars_snapshot`)을 함께
 * 보관한다. 그래서 FK를 걸지 않고 보존 기간도 따로 둔다(`OUTCOME_RETENTION_DAYS`, `generated_at` 기준).
 *
 * **사용자 데이터가 없다.** 회원 id·비회원 식별자·IP·보유 종목·프롬프트 본문 어느 것도 담지 않는다.
 * `subject`는 core `extractOutcomeSubject`가 숫자·enum·레벨 라벨만 복사한 사본이고 `labels`·`bars_snapshot`은
 * 시장 봉에서만 나온다. 그래서 `users`를 참조하지 않으며 dev 시드 제외 목록(`EXCLUDED_TABLES`)에도 넣지 않는다.
 *
 * 이 테이블은 저장만 한다. 집계·표시는 읽는 쪽 몫이고, 읽는 쪽이 알아야 할 규칙과 체계적으로 빠지는 행은 아래와 같다.
 *
 * 읽는 규칙
 * - 라벨은 측정값이다. 비율은 항상 표본 수 `n`과 함께 쓴다.
 * - `labels->>'anchorSource' = 'generated_at'`(분석이 본 봉을 몰라 생성 시각의 봉으로 대신한 행, 기준가가 분석이
 *   본 가격이 아니다)이거나 `labels->'plan'->>'anchorBarUnobserved' = 'true'`(형성 중이던 앵커 봉의 나머지에서
 *   체결됐을 수 있는 행)이면 따로 센다.
 * - 계획 결과는 `labels->'plan'->>'recommendation'`(판정)별로 나눠 센다. `void_at_entry`는 승리가 아니다.
 * - 무작위 보행 귀무확률(`rwNullTargetFirst`)은 체결된 **모든** 계획(`target_first`, `stop_first`, `ambiguous`,
 *   `open_at_horizon`)의 `target_first` 비율과만 비교한다. 해결된 거래만의 비율과 비교하지 않는다.
 * - 패턴의 제외 사유 `target_reached`와 `target_reached_on_breakout`은 서로 다른 모집단이라 따로 센다.
 * - 출력 로케일마다 행이 하나라 같은 시점의 near-duplicate가 있다. 집계 전에 `locale`을 한 값으로 고르거나
 *   (프리웜은 항상 `ko`) (symbol, timeframe, 앵커 봉, tier)로 중복을 지운다. `input_fingerprint`는 로케일을 가로질러
 *   같은 입력을 가리키지만 현재 어떤 작성자도 채우지 않아 대부분 null이다. 채워진 행에서만 정확한 키로 쓴다.
 * - `anchor_close_basis`: 일봉에서 분석이 본 앵커 종가가 공식 종가인지 실시간 시세인지의 구분이다. 첫 라벨이 생긴 뒤
 *   `'after_close_quote'` 행 중 분할·배당이 없는 행의 `subject.anchor.close / bars_snapshot.anchorBar` 종가 비율이
 *   1에서 얼마나 벗어나는지 보면 시세와 공식 종가의 차이가 통계에 영향을 주는지 알 수 있다.
 *
 * 체계적으로 빠지거나 치우치는 행
 * - 보유 종목 맥락으로 생성한 분석(`analysis_history.personalized = true`)과 컬럼이 생기기 전에 쓴 행(null)은 캡처하지
 *   않는다. 이전 분석(prior) 조회의 규칙은 `analysis_history.personalized` JSDoc에 있다.
 * - 주봉(`1Week`)은 캡처하지 않는다(`UNCAPTURED_TIMEFRAMES`, 라벨 규칙이 일봉·분봉만 있다).
 * - 실제로 생성된 분석만 저장된다(캐시 적중은 이력을 쓰지 않는다). 프리웜 행은 항상 `ko`다. 종합(overall) 탭은
 *   캡처하지 않는다. 추론 모드(reasoning)는 기록하지 않는다.
 * - `unlabelable`: `subject_invalid`(core가 주장을 읽지 못함), `timeframe_unsupported`, `anchor_mismatch`(분할·가격
 *   기준 점프), `anchor_missing`(제공자 결측, 제공자 조회 기간보다 오래된 분봉 행), `label_error`.
 *   `forward_stalled`와 `bars_unavailable`은 거래정지·상장폐지 종목에서 나오므로 생존 편향이 있고, 실패 쪽이
 *   적게 세어질 수 있다.
 * - `generated_at` 앵커 행(`dataAsOf` 없음)은 별도 묶음이다.
 * - 캡처가 6일 안에 못 가져간 분석은 영영 못 가져온다(`capture backlog` 로그). 한국 일봉은 하루 늦게 성숙한다.
 */
export const analysisOutcomes = pgTable(
    'analysis_outcomes',
    {
        /** = `analysis_history.id`. FK 없음: 원본 행은 90일 뒤 지워지고 이 행은 더 오래 남는다. */
        analysisId: uuid('analysis_id').primaryKey(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        timeframe: varchar('timeframe', { length: 8 }).notNull(),
        /** `analysis_history.model_id` 사본. `analysis-worker` 같은 자리표시자일 수 있다. */
        modelId: varchar('model_id', { length: 64 }).notNull(),
        /** 분석을 **생성한** 요청의 tier. 옛 행·tier 미기록 작성자는 null. */
        tier: varchar('tier', { length: 16 }),
        promptVersion: varchar('prompt_version', { length: 32 }),
        /** `analysis_history.locale` 사본 — 로케일별 near-duplicate를 가르는 키. */
        locale: contentLocaleEnum('locale').notNull(),
        /** `analysis_history.input_fingerprint` 사본(없으면 null). 위 테이블 JSDoc의 중복 제거 규칙 참조. */
        inputFingerprint: varchar('input_fingerprint', { length: 32 }),
        generatedAt: timestamp('generated_at', {
            withTimezone: true,
        }).notNull(),
        /**
         * 일봉 앵커 종가의 출처. 라벨 단계에서 그룹의 세션 스펙이 풀린 뒤, 저장된 `generated_at`과 subject 앵커 봉의
         * 날짜로만 정한다(캡처는 DB만 쓰므로 여기서 정하지 않는다).
         * `'eod_published'`: 봉 날짜가 생성 시각의 `lastClosedSessionDate` 이하라 공식 종가였다.
         * `'after_close_quote'`: 세션 마감 뒤 EOD 발행 전에 생성돼 분석이 본 종가가 실시간 시세에서 왔다.
         * NULL이 되는 경우는 이것뿐이다: (1) `pending` 행, (2) 봉 창을 평가하기 전에 끝난 `unlabelable` 행
         * (`subject_invalid`, `timeframe_unsupported`, `bars_unavailable`, `label_error`, `anchor_missing`),
         * (3) subject에 앵커가 없다, (4) 분봉이다(분봉 봉은 시세로 만들지 않아 구분이 없다), (5) 생성 시각에 일봉 앵커가
         * 마감 전 형성 중이었다. 라벨된 행과 `anchor_mismatch`·`forward_stalled`로 끝난 행은 (3)~(5)가 아니면 값이 있다.
         * 종목 조회 실패로 비는 값은 없다.
         * 첫 라벨이 생긴 뒤 `'after_close_quote'` 행 중 분할·배당이 없는 행의 `subject.anchor.close /
         * bars_snapshot.anchorBar` 종가 비율을 보면 시세와 공식 종가의 차이가 통계에 영향을 주는지 알 수 있다.
         */
        anchorCloseBasis: varchar('anchor_close_basis', { length: 24 }),
        /** core `OutcomeSubject` — 캡처 시점에 `analysis_history.result`에서 복사한 분석 주장. */
        subject: jsonb('subject').notNull(),
        /** 'pending' | 'labeled' | 'unlabelable'. */
        status: varchar('status', { length: 16 }).notNull(),
        /**
         * `unlabelable`의 사유: subject_invalid, timeframe_unsupported, anchor_missing, anchor_mismatch,
         * bars_unavailable, forward_stalled, label_error. 그 밖의 상태는 null.
         */
        skipReason: varchar('skip_reason', { length: 32 }),
        /**
         * 실패 종류별 횟수는 `load_failures`, `row_errors`, `anchor_missing_seen` 세 카운터로 따로 센다. 종류마다 포기
         * 한도와 사유가 달라서(`bars_unavailable`, `label_error`, `anchor_missing`) 하나의 카운터를 나눠 쓰면 한 종류의
         * 누적이 다른 종류의 포기를 앞당긴다. 아직 봉이 모자라 미룬 횟수는 세지 않는다. 이 컬럼: 그룹 봉 로드 실패
         * (제공자 장애·종목 해석 실패·빈 봉·타임아웃).
         */
        loadFailures: integer('load_failures').notNull().default(0),
        /** 행 하나를 처리하다 던진 횟수(한도 초과 시 `label_error`). */
        rowErrors: integer('row_errors').notNull().default(0),
        /** 앵커 봉을 못 찾은 관측 횟수(앞 봉 검증 실패 포함, 한도 초과 시 `anchor_missing`). */
        anchorMissingSeen: integer('anchor_missing_seen').notNull().default(0),
        nextAttemptAt: timestamp('next_attempt_at', {
            withTimezone: true,
        }).notNull(),
        /**
         * 마지막으로 본 앵커 이후 완결 봉 수(`insufficient_forward.have`). 다음 시도에서 늘었는지 비교해
         * 상장폐지·거래정지로 더는 자라지 않는 행을 포기한다(`forward_stalled`).
         */
        forwardHave: integer('forward_have'),
        /** `forward_have`가 처음 자라지 않은 시각. 다시 자라면 null로 돌아간다. */
        stalledSince: timestamp('stalled_since', { withTimezone: true }),
        /**
         * 재라벨이 던진 행에 그 시점의 `OUTCOME_LABEL_VERSION`을 적어 둔다. 선택은 이 값이 현재 버전인 행을
         * 건너뛰므로 같은 버전에서 같은 오류를 매 실행 되풀이하지 않고, 버전이 오르면 다시 시도한다.
         * `label_version`은 건드리지 않는다(낡은 라벨이 낡았다는 사실을 가리지 않기 위해).
         */
        relabelFailedVersion: integer('relabel_failed_version'),
        labelVersion: integer('label_version'),
        /** core `AnalysisOutcomeLabels`. */
        labels: jsonb('labels'),
        /** core `OutcomeWindow` — 정의가 바뀌면 공급자 호출 없이 이 창으로 다시 라벨한다. */
        barsSnapshot: jsonb('bars_snapshot'),
        labeledAt: timestamp('labeled_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        index('analysis_outcomes_pending_idx')
            .on(table.nextAttemptAt)
            .where(sql`${table.status} = 'pending'`),
        index('analysis_outcomes_symbol_tf_idx').on(
            table.symbol,
            table.timeframe,
            table.generatedAt.desc()
        ),
        index('analysis_outcomes_generated_at_idx').on(table.generatedAt),
        /** 재라벨 후보 선택(`status = 'labeled' AND label_version < 현재`)이 후보가 없을 때도 전 행을 훑지 않게 한다. */
        index('analysis_outcomes_relabel_idx')
            .on(table.labelVersion)
            .where(sql`${table.status} = 'labeled'`),
    ]
);

/**
 * SIGLENS AI 대화(스펙 §6-1). 회원 전용. 삭제는 하드 삭제다 — 개인정보처리방침
 * (`db/seeds/terms/privacy/v4.md`)이 삭제 즉시 파기를 약속하므로,
 * `DrizzleChatConversationRepository.delete`가 행 자체를 지운다(메시지는
 * `chat_messages.conversation_id`의 `onDelete: 'cascade'`로 함께 삭제, 별도
 * 크론 불필요). soft-delete용 `deleted_at` 컬럼은 두지 않는다 — nullable
 * 컬럼에 대한 부분 인덱스(`WHERE deleted_at IS NULL`)는 `WHERE user_id = $1`
 * 같은 쿼리의 조건이 그 predicate를 함의하지 않는 한 플래너가 채택하지 않아,
 * 컬럼만 있고 아무도 쓰지 않던 상태에서 이미 인덱스가 죽어 있었다(전체
 * 테이블 스캔 + 인덱스 유지비만 지불). 향후 되돌릴 수 있는 soft-delete가
 * 필요해지면 컬럼과 predicate를 함께 다시 추가한다 — 컴파일 타임에 드러나는
 * 편이 조용히 죽은 인덱스보다 낫다.
 */
export const chatConversations = pgTable(
    'chat_conversations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        title: varchar('title', { length: 120 }).notNull(),
        locale: contentLocaleEnum('locale').notNull(),
        modelId: varchar('model_id', { length: 64 }).notNull(),
        messageCount: integer('message_count').notNull().default(0),
        lastMessageAt: timestamp('last_message_at', {
            withTimezone: true,
        }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        index('chat_conversations_user_recent_idx').on(
            table.userId,
            table.lastMessageAt.desc()
        ),
    ]
);

/**
 * 대화 메시지. tool 행의 `content`는 실행기가 4,000자로 절단한 결과 JSON 그대로.
 * `seq`는 INSERT … SELECT coalesce(max(seq),0)+n 단일 문으로 매긴다(단일 문이라
 * 트랜잭션 없이 원자적이다). 요청 간 경합은 사용자별 턴 락이 막는다.
 */
export const chatMessages = pgTable(
    'chat_messages',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => chatConversations.id, { onDelete: 'cascade' }),
        seq: integer('seq').notNull(),
        /** 'user' | 'assistant' | 'tool' */
        role: varchar('role', { length: 16 }).notNull(),
        content: text('content').notNull(),
        toolCalls: jsonb('tool_calls'),
        toolCallId: varchar('tool_call_id', { length: 64 }),
        toolName: varchar('tool_name', { length: 64 }),
        modelId: varchar('model_id', { length: 64 }),
        usage: jsonb('usage'),
        /**
         * user 행에만: 그 턴의 "## Now" 시계 메모를 만든 UTC 시각(core `runAgentTurn` 결과의 `turnAt`).
         * 사용자를 식별하는 내용이 없다. 다음 턴이 이 시각으로 같은 메모를 다시 만들어 provider의 prefix 캐시가
         * 이어진다. 브라우저로는 내보내지 않는다. timestamptz는 마이크로초까지 보존하고 Drizzle 기본 모드(Date)는
         * 밀리초 정확도라 core가 돌려준 ISO 문자열(`toISOString()`)이 그대로 왕복한다.
         */
        turnAt: timestamp('turn_at', { withTimezone: true }),
        /** tool 행에만: 그 도구가 만든 표시 전용 차트 블록(`ChatChartBlock`). 모델 기록에는 쓰이지 않는다. */
        chart: jsonb('chart'),
        /** 'complete' | 'aborted' | 'error' | 'superseded' */
        status: varchar('status', { length: 16 }).notNull().default('complete'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        uniqueIndex('chat_messages_conversation_seq_uq').on(
            table.conversationId,
            table.seq
        ),
    ]
);

/** Postgres `bytea` ↔ Node `Buffer`. drizzle-orm에 내장 bytea 컬럼이 없어 직접 정의한다. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
    dataType: () => 'bytea',
});

/**
 * 사용자 메시지에 첨부한 이미지(서버가 정규화한 WebP). 메시지(→ 대화 → 계정)가 지워지면 cascade로
 * 함께 지워진다. 행은 불변이지만 조회 라우트는 영구 캐시를 걸지 않는다 — 소유자 확인이 매 요청 돌아야 하므로
 * `private, no-cache` + ETag(304)로 재검증한다(로그아웃·계정 전환 뒤 브라우저 캐시로 남의 이미지가 보이지 않게).
 * 모델 기록에는 `data`를 읽지 않는다 — 목록·기록 조회는 `id`·크기 컬럼만 고른다.
 */
export const chatMessageImages = pgTable(
    'chat_message_images',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        messageId: uuid('message_id')
            .notNull()
            .references(() => chatMessages.id, { onDelete: 'cascade' }),
        /** 한 메시지 안의 순서(0부터, 최대 3). */
        position: smallint('position').notNull(),
        mediaType: varchar('media_type', { length: 32 }).notNull(),
        width: integer('width').notNull(),
        height: integer('height').notNull(),
        byteSize: integer('byte_size').notNull(),
        data: bytea('data').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        uniqueIndex('chat_message_images_message_position_uq').on(
            table.messageId,
            table.position
        ),
    ]
);

/**
 * 차트 가이드(`/guide`) 항목의 로케일 무관 메타 — slug당 한 행.
 *
 * 정본은 `db/seeds/guide/{category}/{slug}/ko.md`의 frontmatter이고 이 테이블은 배포 사본이다.
 * 공개 콘텐츠라 개인정보가 없다. `skills`는 이 항목이 설명하는 스킬 파일 basename이다
 * (`guideLinks.generated.ts`의 매핑 정본은 시드 파일이며, 여기 값은 에이전트·운영 조회용 사본).
 */
export const guideEntries = pgTable('guide_entries', {
    slug: text('slug').primaryKey(),
    category: text('category').notNull(),
    sortOrder: integer('sort_order').notNull(),
    related: text('related')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`),
    skills: text('skills')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`),
    /** howto 글이 다루는 용어 항목 slug. 용어 항목은 빈 배열. */
    about: text('about')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`),
    /** 라이브 종목 모듈이 섹터 스캐너에서 고를 `SignalType`. */
    signals: text('signals')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`),
    /** 데모 차트를 빌려 올 항목 slug. 없으면 null. */
    demoFrom: text('demo_from'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});

/**
 * 가이드 항목의 로케일별 본문 — (slug, locale)당 한 행.
 *
 * `content_hash`(frontmatter+본문 sha256)는 시드가 바뀐 행만 upsert하려는 비교용이다.
 * 번역 행이 없으면 읽기 경로가 ko 행으로 폴백한다.
 */
export const guideEntryContents = pgTable(
    'guide_entry_contents',
    {
        slug: text('slug')
            .notNull()
            .references(() => guideEntries.slug, { onDelete: 'cascade' }),
        locale: text('locale').notNull(),
        title: text('title').notNull(),
        aliases: text('aliases')
            .array()
            .notNull()
            .default(sql`ARRAY[]::text[]`),
        summary: text('summary').notNull(),
        seoTitle: text('seo_title').notNull(),
        seoDescription: text('seo_description').notNull(),
        demoCaption: text('demo_caption'),
        bodyMd: text('body_md').notNull(),
        /** `[{ q, a }]` */
        faq: jsonb('faq')
            .notNull()
            .default(sql`'[]'::jsonb`),
        contentHash: text('content_hash').notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [primaryKey({ columns: [table.slug, table.locale] })]
);

/**
 * Investor Flows — CUSIP↔symbol map for the US common-stock universe.
 *
 * SEC 13F information tables identify issuers by CUSIP only, so this map is the
 * universe filter of the 13F ingester (rows whose CUSIP is absent are dropped
 * while streaming). `source` records where the pairing came from: `fmp`
 * (FMP profile `cusip`) or `openfigi` (ISIN-derived CUSIP confirmed by OpenFIGI).
 * CUSIP lists must not be redistributed (licence) — internal use only, never
 * exposed through an API.
 *
 * `id` is the compact surrogate the (large) positions table stores instead of the
 * 9-char CUSIP. `created_at` (DB clock) is when the CUSIP was FIRST mapped. A filing is
 * parsed against the universe loaded at its `sec_13f_filings.universe_stamp` (also DB
 * clock), so a CUSIP mapped AFTER the earliest-parsed filing of a quarter is missing from
 * that filing's positions: that quarter has no baseline for it and its change columns stay
 * NULL (rule: `created_at <= min(universe_stamp)` of the prior quarter, see `aggregateSql.ts`).
 * `checked_at` drives the periodic re-check
 * of `fmp` mappings against the FMP profile (CUSIP changes after reverse splits etc.).
 */
export const cusipSymbolMap = pgTable(
    'cusip_symbol_map',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        cusip: char('cusip', { length: 9 }).notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        source: varchar('source', { length: 16 }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        checkedAt: timestamp('checked_at', { withTimezone: true }),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        uniqueIndex('cusip_symbol_map_cusip_uidx').on(table.cusip),
        index('cusip_symbol_map_symbol_idx').on(table.symbol),
    ]
);

/** Investor Flows — 13F filer (institution) directory, keyed by the numeric SEC CIK. */
export const sec13fFilers = pgTable('sec_13f_filers', {
    cik: integer('cik').primaryKey(),
    name: text('name').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdateFn(nowFn),
});

/**
 * Investor Flows — one row per 13F-HR / 13F-HR/A accession we have seen.
 *
 * Doubles as the idempotency ledger (`processed_at IS NOT NULL` = positions were
 * applied) and the retry queue: a failed accession keeps `processed_at NULL` and
 * counts `attempts`, so `period` is nullable (a filing can fail before its primary
 * document is parsed). `period` is the report period (`PERIODOFREPORT`), never the
 * filing date — quarters are attributed by it. `cik` is the numeric CIK (the 10-digit
 * zero-padded form is only a display format).
 */
export const sec13fFilings = pgTable(
    'sec_13f_filings',
    {
        accession: varchar('accession', { length: 20 }).primaryKey(),
        cik: integer('cik').notNull(),
        period: date('period', { mode: 'string' }),
        filingDate: date('filing_date', { mode: 'string' }).notNull(),
        submissionType: varchar('submission_type', { length: 16 }).notNull(),
        amendmentType: varchar('amendment_type', { length: 32 }),
        attempts: smallint('attempts').notNull().default(0),
        lastError: text('last_error'),
        processedAt: timestamp('processed_at', { withTimezone: true }),
        /**
         * DB-clock time of the universe snapshot (`cusip_symbol_map`) this filing was
         * parsed against. Rows for CUSIPs mapped later were filtered out of this filing,
         * so `aggregateSql.ts` baselines a CUSIP only if `created_at <= min(universe_stamp)`
         * of the prior quarter. NULL while unprocessed (and treated as "no baseline").
         */
        universeStamp: timestamp('universe_stamp', { withTimezone: true }),
    },
    table => [
        index('sec_13f_filings_cik_period_idx').on(table.cik, table.period),
        index('sec_13f_filings_filing_date_idx').on(table.filingDate),
        // Retry queue: only unprocessed rows are indexed, so it stays tiny.
        index('sec_13f_filings_pending_idx')
            .on(table.filingDate)
            .where(sql`${table.processedAt} IS NULL`),
        // "Which filers filed this period" — the filer sets behind the panel/baseline rules.
        index('sec_13f_filings_period_cik_processed_idx')
            .on(table.period, table.cik)
            .where(sql`${table.processedAt} IS NOT NULL`),
    ]
);

/**
 * Investor Flows — institutional positions restricted to the universe
 * (SH rows without put/call), kept for the 2 latest complete quarters plus the
 * in-progress one.
 *
 * COMPACT BY DESIGN (≈ 8–9M rows): fixed-width columns only, laid out so the heap
 * tuple has no padding — `shares` (8) first, then four 4-byte columns = 24 bytes of
 * data + 24 header = 48 bytes/row. `cusip_id` references `cusip_symbol_map.id` (no FK —
 * the row-level trigger cost is not worth it for an append/prune table), `cik` is the
 * numeric CIK. `value_k` is the reported value in THOUSANDS of USD, clamped to int4
 * ($2.1T per position): the dollar precision is irrelevant for the display and the
 * sums, and int4 costs nothing extra because the tuple is already 8-byte aligned.
 *
 * PK (cik, period, cusip_id): "all positions of a filer in a period" (restatement
 * delete, panel/exits) is a PK-prefix scan. (cusip_id, period) serves "all holders of an
 * issuer in a period". BRIN(period) serves the `period < floor` prune at ~zero size.
 *
 * SIZE (measured on local Postgres 17, 2.7M rows inserted incrementally): heap 52 B/row +
 * PK index 52 B/row + (cusip_id, period) index ~10 B/row (btree dedup) ≈ 112 B/row all-in,
 * BRIN 24 kB. At 3 quarters × ~2.8M universe rows ≈ 8.4M rows ≈ 0.95 GB; a one-time
 * REINDEX (removes PK bloat from non-sorted inserts) brings it to ≈ 0.75 GB. The design
 * floor for 3 quarters is ~0.65 GB (24 B data + 24 B header + a 28 B key per row), so the
 * originally approved ~0.5 GB is not reachable without keeping fewer quarters.
 */
export const sec13fPositions = pgTable(
    'sec_13f_positions',
    {
        shares: bigint('shares', { mode: 'number' }).notNull(),
        cik: integer('cik').notNull(),
        cusipId: integer('cusip_id').notNull(),
        period: date('period', { mode: 'string' }).notNull(),
        valueK: integer('value_k').notNull(),
    },
    table => [
        primaryKey({ columns: [table.cik, table.period, table.cusipId] }),
        index('sec_13f_positions_cusip_period_idx').on(
            table.cusipId,
            table.period
        ),
        index('sec_13f_positions_period_brin_idx').using('brin', table.period),
    ]
);

/**
 * Investor Flows — per (cusip, period) institutional aggregate, kept long after
 * the positions are pruned. The change columns are NULL when there is no
 * prior-quarter baseline (nothing to compare against), never 0.
 */
export const sec13fAggregates = pgTable(
    'sec_13f_aggregates',
    {
        cusip: char('cusip', { length: 9 }).notNull(),
        period: date('period', { mode: 'string' }).notNull(),
        holders: integer('holders').notNull(),
        shares: bigint('shares', { mode: 'number' }).notNull(),
        valueUsd: bigint('value_usd', { mode: 'number' }).notNull(),
        newHolders: integer('new_holders'),
        increased: integer('increased'),
        decreased: integer('decreased'),
        exited: integer('exited'),
        netShareChange: bigint('net_share_change', { mode: 'number' }),
        computedAt: timestamp('computed_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [primaryKey({ columns: [table.cusip, table.period] })]
);

/**
 * Investor Flows — durable "dirty" queue of (period, cusip) aggregates that must be
 * recomputed. Rows are written in the SAME transaction as the positions they come
 * from and deleted only after the recompute committed, so a crash/deploy/OOM between
 * the two can never lose recompute work (the next run flushes what is left).
 */
export const sec13fDirtyAggregates = pgTable(
    'sec_13f_dirty_aggregates',
    {
        period: date('period', { mode: 'string' }).notNull(),
        cusipId: integer('cusip_id').notNull(),
    },
    table => [primaryKey({ columns: [table.period, table.cusipId] })]
);

/** Investor Flows — tiny key/value state for the ingesters (last-pruned floors etc.). */
export const investorFlowsState = pgTable('investor_flows_state', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});

/**
 * Investor Flows — FINRA bi-monthly short interest (⚠ non-commercial licence;
 * ingestion is gated by `FINRA_SHORT_DATA_ENABLED`, see `shared/api/finra/finraShortDataEnabled.ts`).
 * Retained for ~2 years.
 */
export const finraShortInterest = pgTable(
    'finra_short_interest',
    {
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        settlementDate: date('settlement_date', { mode: 'string' }).notNull(),
        shortQty: bigint('short_qty', { mode: 'number' }).notNull(),
        prevShortQty: bigint('prev_short_qty', { mode: 'number' }),
        avgDailyVolume: bigint('avg_daily_volume', { mode: 'number' }),
        daysToCover: numeric('days_to_cover', { precision: 10, scale: 2 }),
    },
    table => [
        primaryKey({ columns: [table.symbol, table.settlementDate] }),
        index('finra_short_interest_settlement_date_idx').on(
            table.settlementDate
        ),
    ]
);

/**
 * Investor Flows — FINRA Reg SHO daily short sale volume, off-exchange (TRF)
 * reporting only (⚠ same non-commercial licence). Rolling 120 days.
 */
export const finraShortVolume = pgTable(
    'finra_short_volume',
    {
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        tradeDate: date('trade_date', { mode: 'string' }).notNull(),
        shortVolume: bigint('short_volume', { mode: 'number' }).notNull(),
        totalVolume: bigint('total_volume', { mode: 'number' }).notNull(),
    },
    table => [
        primaryKey({ columns: [table.symbol, table.tradeDate] }),
        index('finra_short_volume_trade_date_idx').on(table.tradeDate),
    ]
);

/**
 * Investor Flows — SEC fails-to-deliver (CNS fails), one row per (CUSIP, settlement date) for
 * universe CUSIPs only. A row exists only on days with fails (no row = no fails, not missing data).
 * `symbol` is OUR symbol resolved from `cusip_symbol_map` (the file's own SYMBOL is concatenated,
 * e.g. `BRKB`, and only used as a same-issuer fallback); readers sum by symbol because one symbol
 * can have more than one CUSIP over time. `price` is NULL when the file prints `.`. Retained ~2 years.
 */
export const secFtd = pgTable(
    'sec_ftd',
    {
        cusip: char('cusip', { length: 9 }).notNull(),
        settlementDate: date('settlement_date', { mode: 'string' }).notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        failsQty: bigint('fails_qty', { mode: 'number' }).notNull(),
        price: numeric('price', { precision: 14, scale: 4 }),
    },
    table => [
        primaryKey({ columns: [table.cusip, table.settlementDate] }),
        index('sec_ftd_symbol_settlement_date_idx').on(
            table.symbol,
            table.settlementDate
        ),
        index('sec_ftd_settlement_date_idx').on(table.settlementDate),
    ]
);

/**
 * Investor Flows — FTD half-month files (`YYYYMMa`/`YYYYMMb` key) seen by the ingester. A file's rows and
 * `processed_at` are written in ONE transaction, so `processed_at IS NOT NULL` means the file is fully
 * stored. A file that could not be stored (trailer mismatch, unreadable zip, missing link target) keeps
 * `processed_at` NULL and counts `attempts` / `last_error`, so it is retried after the healthy files and
 * given up after a few attempts instead of starving the older backfill.
 */
export const secFtdFiles = pgTable('sec_ftd_files', {
    fileKey: varchar('file_key', { length: 8 }).primaryKey(),
    rowCount: integer('row_count').notNull().default(0),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    attempts: smallint('attempts').notNull().default(0),
    lastError: text('last_error'),
});

/**
 * Investor Flows — SEC CIK → our symbol, from `www.sec.gov/files/company_tickers.json` restricted to
 * the universe (`cusip_symbol_map` symbols). One CIK can map to several universe symbols (share
 * classes). Refreshed weekly by the cusip-map cron; it is the pre-filter for Form 144 / offering rows.
 */
export const secCikSymbolMap = pgTable(
    'sec_cik_symbol_map',
    {
        cik: integer('cik').notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        primaryKey({ columns: [table.cik, table.symbol] }),
        index('sec_cik_symbol_map_symbol_idx').on(table.symbol),
    ]
);

/**
 * Investor Flows — Form 144 (notice of proposed sale), one row per accession (the same accession is
 * listed under the issuer AND the reporting person in the daily index). `symbol` is one
 * representative universe symbol of `issuer_cik`; readers resolve by `issuer_cik` through
 * `sec_cik_symbol_map` so every share class sees the filing. Amounts are summed over the filing's
 * `securitiesInformation` blocks. Retained ~1 year.
 */
export const secForm144 = pgTable(
    'sec_form144',
    {
        accession: varchar('accession', { length: 20 }).primaryKey(),
        issuerCik: integer('issuer_cik').notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        filerName: text('filer_name').notNull(),
        /** 신고자 CIK(10자리 0 패딩). 0050 이전에 저장된 행과 CIK가 없는 신고는 null — core가 이름 정규화로 센다. */
        filerCik: text('filer_cik'),
        relationships: text('relationships').array().notNull(),
        securityClass: text('security_class').notNull(),
        shares: bigint('shares', { mode: 'number' }).notNull(),
        valueUsd: bigint('value_usd', { mode: 'number' }).notNull(),
        sharesOutstanding: bigint('shares_outstanding', { mode: 'number' }),
        approxSaleDate: date('approx_sale_date', { mode: 'string' }),
        planAdoptionDate: date('plan_adoption_date', { mode: 'string' }),
        broker: text('broker'),
        formType: varchar('form_type', { length: 16 }).notNull(),
        filingDate: date('filing_date', { mode: 'string' }).notNull(),
    },
    table => [
        index('sec_form144_issuer_cik_filing_date_idx').on(
            table.issuerCik,
            table.filingDate
        ),
        index('sec_form144_filing_date_idx').on(table.filingDate),
    ]
);

/**
 * Investor Flows — capital-raising / dilution filings (S-1, S-3, F-1, F-3, 424B*, Form D …) of universe
 * issuers. Co-registrants share one accession, so the key is (accession, symbol). `kind` is derived
 * from the form (`424B5` from the document text: atm / underwritten / best_efforts / other).
 * Retained ~2 years.
 */
export const secOfferingFilings = pgTable(
    'sec_offering_filings',
    {
        accession: varchar('accession', { length: 20 }).notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        issuerCik: integer('issuer_cik').notNull(),
        formType: varchar('form_type', { length: 16 }).notNull(),
        filingDate: date('filing_date', { mode: 'string' }).notNull(),
        kind: varchar('kind', { length: 24 }).notNull(),
        url: text('url').notNull(),
    },
    table => [
        primaryKey({ columns: [table.accession, table.symbol] }),
        index('sec_offering_filings_symbol_filing_date_idx').on(
            table.symbol,
            table.filingDate
        ),
        index('sec_offering_filings_filing_date_idx').on(table.filingDate),
    ]
);

/**
 * Investor Flows — retry queue for Form 144 / 424B5 documents that failed to download or parse.
 * `cik`/`form_type`/`filing_date` carry what a retry needs outside the daily-index scan window.
 * `skipped = true` is a durable NEGATIVE marker, not a failure: the document was read and deliberately
 * not stored (a Form 144 whose issuer is outside the universe), so it is never fetched again and does
 * not count toward the failed-document backlog.
 */
export const secFilingsFailures = pgTable('sec_filings_failures', {
    accession: varchar('accession', { length: 20 }).primaryKey(),
    cik: integer('cik').notNull(),
    formType: varchar('form_type', { length: 16 }).notNull(),
    filingDate: date('filing_date', { mode: 'string' }).notNull(),
    attempts: smallint('attempts').notNull().default(0),
    lastError: text('last_error'),
    skipped: boolean('skipped').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});

/**
 * Investor Flows — 13F option rows (`putCall` present) restricted to universe CUSIPs, summed per
 * (filer, CUSIP, period, put/call). `shares` is the UNDERLYING share count (`sshPrnamt`) and
 * `value_usd` the underlying notional — not the option premium. Same amendment / restatement /
 * retention rules as `sec_13f_positions` (written in the same transaction as the filing's positions).
 */
export const sec13fOptionPositions = pgTable(
    'sec_13f_option_positions',
    {
        cik: integer('cik').notNull(),
        cusip: char('cusip', { length: 9 }).notNull(),
        period: date('period', { mode: 'string' }).notNull(),
        putCall: varchar('put_call', { length: 4 }).notNull(),
        shares: bigint('shares', { mode: 'number' }).notNull(),
        valueUsd: bigint('value_usd', { mode: 'number' }).notNull(),
    },
    table => [
        primaryKey({
            columns: [table.cik, table.cusip, table.period, table.putCall],
        }),
        index('sec_13f_option_positions_cusip_period_idx').on(
            table.cusip,
            table.period
        ),
        index('sec_13f_option_positions_period_brin_idx').using(
            'brin',
            table.period
        ),
    ]
);

/** Investor Flows — per (CUSIP, period) put/call totals across filers (recomputed with the 13F aggregates). */
export const sec13fOptionAggregates = pgTable(
    'sec_13f_option_aggregates',
    {
        cusip: char('cusip', { length: 9 }).notNull(),
        period: date('period', { mode: 'string' }).notNull(),
        putHolders: integer('put_holders').notNull(),
        putShares: bigint('put_shares', { mode: 'number' }).notNull(),
        putValueUsd: bigint('put_value_usd', { mode: 'number' }).notNull(),
        callHolders: integer('call_holders').notNull(),
        callShares: bigint('call_shares', { mode: 'number' }).notNull(),
        callValueUsd: bigint('call_value_usd', { mode: 'number' }).notNull(),
        computedAt: timestamp('computed_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [primaryKey({ columns: [table.cusip, table.period] })]
);

/**
 * Investor Flows — Reg SHO threshold-security lists (Nasdaq, NYSE, NYSE American, NYSE Arca, Cboe BZX),
 * one row per (our symbol, trade date, market) the symbol was listed. ⚠ exchange data is
 * non-commercial: ingestion is gated by `REG_SHO_THRESHOLD_DATA_ENABLED`
 * (`shared/api/exchange/regShoThresholdDataEnabled.ts`). Retained ~180 days.
 */
export const regShoThreshold = pgTable(
    'reg_sho_threshold',
    {
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        tradeDate: date('trade_date', { mode: 'string' }).notNull(),
        market: varchar('market', { length: 16 }).notNull(),
    },
    table => [
        primaryKey({
            columns: [table.symbol, table.tradeDate, table.market],
        }),
        index('reg_sho_threshold_trade_date_idx').on(table.tradeDate),
    ]
);

/**
 * Investor Flows (KR) — DART `corpCode.xml`: listed stock code (6 chars, may contain letters) → DART
 * corp code. Preferred shares are absent from the file and map to the common share's row.
 */
export const dartCorpCode = pgTable('dart_corp_code', {
    stockCode: varchar('stock_code', { length: 6 }).primaryKey(),
    corpCode: char('corp_code', { length: 8 }).notNull(),
    corpName: text('corp_name').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});

/**
 * Investor Flows (KR) — DART `majorstock.json` (5% large-holding reports). `report_form` is
 * `detailed` (일반) or `abbreviated` (약식). Quantities may be absent in the source, so they are
 * nullable. Retained ~2 years.
 */
export const dartMajorHoldings = pgTable(
    'dart_major_holdings',
    {
        rceptNo: varchar('rcept_no', { length: 14 }).notNull(),
        corpCode: char('corp_code', { length: 8 }).notNull(),
        receiptDate: date('receipt_date', { mode: 'string' }).notNull(),
        reporter: text('reporter').notNull(),
        reportForm: varchar('report_form', { length: 16 }).notNull(),
        shares: bigint('shares', { mode: 'number' }),
        sharesChange: bigint('shares_change', { mode: 'number' }),
        ratioPct: numeric('ratio_pct', { precision: 8, scale: 4 }),
        ratioChangePct: numeric('ratio_change_pct', {
            precision: 8,
            scale: 4,
        }),
        reason: text('reason'),
    },
    table => [
        primaryKey({ columns: [table.rceptNo, table.reporter] }),
        index('dart_major_holdings_corp_code_receipt_date_idx').on(
            table.corpCode,
            table.receiptDate
        ),
    ]
);

/**
 * Investor Flows (KR) — DART `elestock.json` (executive / major-shareholder ownership reports).
 * `registered` = registered executive (등기임원), `major_shareholder` = the source's relation text
 * (NULL when the source prints `-`). The source has no transaction cause. Retained ~2 years.
 */
export const dartInsiderReports = pgTable(
    'dart_insider_reports',
    {
        rceptNo: varchar('rcept_no', { length: 14 }).notNull(),
        corpCode: char('corp_code', { length: 8 }).notNull(),
        receiptDate: date('receipt_date', { mode: 'string' }).notNull(),
        reporter: text('reporter').notNull(),
        position: text('position'),
        registered: boolean('registered'),
        majorShareholder: text('major_shareholder'),
        shares: bigint('shares', { mode: 'number' }),
        sharesChange: bigint('shares_change', { mode: 'number' }),
        ratioPct: numeric('ratio_pct', { precision: 8, scale: 4 }),
        ratioChangePct: numeric('ratio_change_pct', {
            precision: 8,
            scale: 4,
        }),
    },
    table => [
        primaryKey({ columns: [table.rceptNo, table.reporter] }),
        index('dart_insider_reports_corp_code_receipt_date_idx').on(
            table.corpCode,
            table.receiptDate
        ),
    ]
);

/**
 * Investor Flows (KR) — DART `list.json` D005 rows (trading-plan reports, 거래계획보고서): only the
 * list row itself (reporter, receipt date, title) is kept; the link is derived from `rcept_no`.
 */
export const dartTradingPlans = pgTable(
    'dart_trading_plans',
    {
        rceptNo: varchar('rcept_no', { length: 14 }).primaryKey(),
        corpCode: char('corp_code', { length: 8 }).notNull(),
        receiptDate: date('receipt_date', { mode: 'string' }).notNull(),
        reporter: text('reporter').notNull(),
        title: text('title').notNull(),
    },
    table => [
        index('dart_trading_plans_corp_code_receipt_date_idx').on(
            table.corpCode,
            table.receiptDate
        ),
    ]
);

/**
 * 사용자 피드백. `kind='voc'`는 첫 AI 경험 직후의 별점(1~5) + 의견, `'ai_response'`는
 * AI 응답 하나에 대한 👍/👎와 그 시점의 결과 원문(`snapshot`)이다.
 *
 * 비회원 식별자(guest 쿠키, IP 해시)는 **저장하지 않는다** — 처리방침상 guest 쿠키
 * 용도를 넓히지 않기 위해서다. 회원이면 `user_id`로 계정과 연결되며 탈퇴(CASCADE)·
 * 대화 삭제(`conversation_id` CASCADE) 시 함께 파기된다. 365일이 지난 행은
 * `/api/cron/feedback-digest`가 삭제한다.
 * `symbol`·`target_type`은 요약 조회용 비정규화 사본이다.
 */
export const feedback = pgTable(
    'feedback',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** 'voc' | 'ai_response' */
        kind: varchar('kind', { length: 16 }).notNull(),
        /** 'siglens' | 'siglens_ai' */
        surface: varchar('surface', { length: 16 }).notNull(),
        /** voc만, 1~5 */
        rating: smallint('rating'),
        /** ai_response만, 'up' | 'down' */
        vote: varchar('vote', { length: 8 }),
        /** 👎 사유 코드 배열 */
        reasons: jsonb('reasons'),
        comment: text('comment'),
        /** 분석 종류 또는 'agent_message' */
        targetType: varchar('target_type', { length: 32 }),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }),
        context: jsonb('context').notNull(),
        /** 결과 원문 또는 대화 기록. 서버에서 256KB 상한 */
        snapshot: jsonb('snapshot'),
        userId: uuid('user_id').references(() => users.id, {
            onDelete: 'cascade',
        }),
        conversationId: uuid('conversation_id').references(
            () => chatConversations.id,
            { onDelete: 'cascade' }
        ),
        pagePath: text('page_path'),
        locale: contentLocaleEnum('locale').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        check(
            'feedback_rating_range',
            sql`${table.rating} IS NULL OR (${table.rating} BETWEEN 1 AND 5)`
        ),
        index('feedback_created_at_idx').on(table.createdAt),
        index('feedback_kind_created_at_idx').on(table.kind, table.createdAt),
    ]
);

/**
 * 섹터 스캐너가 잡은 **확정** 신호의 이력 — 신호별 종목 페이지(골든크로스·52주 신고가 등)의 원천.
 *
 * 스캐너(`getSectorSignalsStatic`)는 지금 시점 결과만 들고 있어 하루치로는 페이지가 얇다. 그래서
 * 장 마감 뒤 신호를 세션별로 남긴다. 기록은 `seo-prewarm` 크론이 한다(`recordSignalHistory`) —
 * 대상은 S&P 500·코스피 200·코스닥 150과 대시보드 스캐너 종목이고, 종목별 진행 표식
 * (`signal_scan_cursors`)으로 한 세션을 여러 실행에 걸쳐 기록한다. 판정은 스캐너와 같은 규칙을
 * 종목의 일봉에 직접 적용한다(core `confirmedSignalTimeline`).
 *
 * 한 행 = 한 종목에서 한 신호가 **이어진 구간(에피소드)**. 교차 신호는 최근 몇 개 봉 안의 교차를
 * 계속 잡고(core `CROSS_LOOKBACK_BARS`), RSI 과매도·52주 신고가 같은 상태 신호는 여러 세션
 * 이어진다. 직전 세션에도 잡혔으면 새 행 대신 `lastSeenSession`만 늘리고, 끊겼다 다시 잡히면 새
 * 행이다. 그래서 `sessionDate`는 "처음 포착된 세션"이다 — 실제 교차일보다 최대 몇 세션 늦을 수 있다.
 *
 * 처음 기록하는 종목(새로 대상이 된 종목, 진행 표식이 없는 종목)은 최근 120세션을 다시 계산해 채운다 —
 * 그래서 첫날 "처음 포착"이 한꺼번에 쏟아지지 않고, 정의가 바뀐 신호(골든·데드크로스 = 50/200일선)도
 * 새 규칙의 이력을 갖는다. 그때 다시 계산한 행의 `priceAtDetection`은 그 세션 종가다(마감 뒤 시세가 아니다).
 * 크론이 세션을 놓치거나 한 종목이 실패해도 다음 실행이 마지막 기록 이후 세션을 따라잡아(최대 120세션)
 * 끊긴 것으로 보이지 않는다.
 *
 * 한계: 세션 날짜는 거래소 달력(`sessionSpecFor`)이 맞다는 전제다 — 달력에 빠진 임시 휴장일은 거래일로
 * 읽혀 그날 옛 봉으로 기록될 수 있다(마지막 봉이 그 세션이 아니면 기록하지 않아 대부분 걸러진다).
 *
 * 개인 식별 정보가 없다(시장 데이터의 집계 결과뿐).
 */
export const signalEvents = pgTable(
    'signal_events',
    {
        /** 대시보드 범위 id(`us` | `kr`). 같은 티커 문자열이 두 시장에 있어도 섞이지 않게 키에 넣는다. */
        market: varchar('market', { length: 8 }).notNull(),
        /** 처음 포착된 세션 날짜(`YYYY-MM-DD`) — 미국은 ET, 한국은 KST 기준. */
        sessionDate: date('session_date').notNull(),
        /** 마지막으로 포착된 세션 날짜. 이어지는 동안 기록할 때마다 늘어난다. */
        lastSeenSession: date('last_seen_session').notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        /** core `SignalType`. enum이 아닌 이유: core에 신호가 늘어도 DB 제약이 막지 않게. */
        signalType: varchar('signal_type', { length: 48 }).notNull(),
        /** `bullish` | `bearish`. */
        direction: varchar('direction', { length: 8 }).notNull(),
        /** 그날 등락률(%). 목록에 함께 보여 준다. */
        changePercent: doublePrecision('change_percent').notNull(),
        /**
         * 에피소드가 처음 포착된 세션의 종가(그 세션 봉의 `close`) — 이어지는 동안 갱신하지 않는다(첫 포착
         * 가격). 단위는 그 시장의 자국 통화(`market` 컬럼으로 구분: 미국 USD, 한국 KRW)다. 다시 계산해 채운
         * 행도 같다. 가격을 알 수 없으면 null이고, 이 컬럼이 생기기 전 행도 null이다. (옛 단일 스캔이 남긴
         * 행은 마감 뒤 시세였다.)
         */
        priceAtDetection: doublePrecision('price_at_detection'),
        /** 기록 시점의 한글 종목명. 없으면 null — 목록이 이름 조회 없이 그려지게 남긴다. */
        koreanName: text('korean_name'),
        /** 스캐너 계산 시각. */
        computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        primaryKey({
            columns: [
                table.market,
                table.sessionDate,
                table.symbol,
                table.signalType,
            ],
        }),
        // 신호별 페이지: "이 신호의 최근 N일" — 신호·날짜 역순 범위 스캔.
        index('signal_events_type_date_idx').on(
            table.signalType,
            table.sessionDate.desc()
        ),
        // 이어짐 판정: "이 시장·종목·신호의 에피소드가 직전 세션까지 이어졌나".
        index('signal_events_open_episode_idx').on(
            table.market,
            table.symbol,
            table.signalType,
            table.lastSeenSession
        ),
    ]
);

/**
 * 신호 기록기가 종목별로 어디까지 기록했는지 — 한 세션을 여러 번의 실행에 걸쳐 기록하고, 놓친 세션을
 * 따라잡기 위한 영속 진행 표식이다. Redis 표식은 사라질 수 있고 "세션당 한 번"만 알려 줘서, 종목 수가
 * 늘어 한 실행에 다 못 끝내는 규모에서는 쓸 수 없다.
 *
 * 한 행 = (시장, 종목). `last_session`은 그 종목의 신호가 `signal_events`에 반영된 마지막 세션이다.
 * 아직 한 번도 성공하지 못했으면 null(처음 기록하는 종목). 실패·낡은 데이터 시도는 `attempt_session`의
 * 세션 안에서 `attempts`로 센다 — 세션이 바뀌면 다시 1부터다.
 *
 * 개인 식별 정보가 없다(시장 데이터의 처리 진행뿐).
 */
export const signalScanCursors = pgTable(
    'signal_scan_cursors',
    {
        /** 대시보드 범위 id(`us` | `kr`). */
        market: varchar('market', { length: 8 }).notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        /** `signal_events`에 반영된 마지막 세션(`YYYY-MM-DD`). 첫 성공 전에는 null. */
        lastSession: date('last_session'),
        /** 아래 `attempts`가 속한 세션. 세션이 바뀌면 시도 횟수를 다시 센다. */
        attemptSession: date('attempt_session'),
        attempts: smallint('attempts').notNull().default(0),
        /** 가장 최근 시도의 결과: 기록됨 / 조회 실패 / 마지막 봉이 그 세션이 아님. */
        lastOutcome: text('last_outcome', {
            enum: SIGNAL_SCAN_OUTCOME_VALUES,
        }).notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [
        primaryKey({ columns: [table.market, table.symbol] }),
        check(
            'signal_scan_cursors_last_outcome_check',
            sql`${table.lastOutcome} IN ('recorded','failed','stale')`
        ),
    ]
);

/**
 * 시장·세션별 기록 완료 표식 — 메일 발송기와 신호 페이지가 "그 세션이 끝까지 기록됐는가"를 읽는 영속
 * 값이다. `signal_events`의 `max(last_seen_session)`으로는 알 수 없다: 한 세션을 여러 실행에 나눠 기록하면
 * 첫 종목이 들어간 순간부터 그 값이 참이 된다.
 *
 * `completed_at`은 대상 종목이 전부 정리된(기록됐거나 한 세션에 3번 실패한) 순간에 한 번 채운다. 나머지
 * 숫자는 가장 최근 실행이 본 집계다. 개인 식별 정보가 없다.
 */
export const signalScanSessions = pgTable(
    'signal_scan_sessions',
    {
        market: varchar('market', { length: 8 }).notNull(),
        sessionDate: date('session_date').notNull(),
        /** 그 세션 시작 때의 대상 종목 수. */
        universeSize: integer('universe_size').notNull(),
        recorded: integer('recorded').notNull(),
        failed: integer('failed').notNull(),
        stale: integer('stale').notNull(),
        /** 모든 대상이 정리된 시각. 아직이면 null. */
        completedAt: timestamp('completed_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdateFn(nowFn),
    },
    table => [primaryKey({ columns: [table.market, table.sessionDate] })]
);
