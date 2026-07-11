import 'server-only';

import { sql } from 'drizzle-orm';
import {
    boolean,
    date,
    doublePrecision,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';
import {
    LLM_PROVIDER_VALUES,
    OAUTH_PROVIDER_VALUES,
    SHAREABLE_KIND_VALUES,
    TERMS_KIND_VALUES,
    USAGE_ACTION_TYPE_VALUES,
    USER_TIER_VALUES,
} from './constants';

const EMAIL_MAX_LENGTH = 320;
const SYMBOL_MAX_LENGTH = 32;
const EXCHANGE_MAX_LENGTH = 32;
const FMP_SYMBOL_MAX_LENGTH = 64;
const NOTICE_TITLE_MAX_LENGTH = 200;

// Repositories also set updated_at explicitly via `sql`now()`` in their
// `update()` / `onConflictDoUpdate()` calls; this $onUpdateFn(nowFn) hook is
// only a safety net for direct ORM updates that forget the explicit assignment
// (Drizzle does not invoke $onUpdateFn on `onConflictDoUpdate`).
const nowFn = (): Date => new Date();

/** Postgres enum for user subscription tier. */
export const userTierEnum = pgEnum('user_tier', USER_TIER_VALUES);

/** Postgres enum for usage action types tracked in usage logs. */
export const usageActionTypeEnum = pgEnum(
    'usage_action_type',
    USAGE_ACTION_TYPE_VALUES
);

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

/** Per-request usage log for rate-limiting and analytics. */
export const usageLogs = pgTable(
    'usage_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        ipHash: text('ip_hash').notNull(),
        actionType: usageActionTypeEnum('action_type').notNull(),
        modelUsed: text('model_used').notNull(),
        date: date('date').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [
        index('usage_logs_user_id_idx').on(table.userId),
        index('usage_logs_ip_hash_date_idx').on(table.ipHash, table.date),
    ]
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

/** Korean stock ticker metadata — keyed by ticker symbol. */
export const koreanTickers = pgTable('korean_tickers', {
    symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).primaryKey(),
    koreanName: text('korean_name').notNull(),
    name: text('name').notNull(),
    exchange: varchar('exchange', { length: EXCHANGE_MAX_LENGTH }).notNull(),
    exchangeFullName: text('exchange_full_name').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdateFn(nowFn),
});

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

/** Contact form submissions from visitors. */
export const inquiries = pgTable('inquiries', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    email: varchar('email', { length: EMAIL_MAX_LENGTH }).notNull(),
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
 * (#610 그리드의 React key `${date}:${event}:${actual}`와는 의도가 다른 안정 키).
 *
 * SP-D에서 별도 마이그레이션으로 sentiment/summaryKo/interpretationKo/analyzedAt가
 * 추가된다 — SP-A 테이블에는 미포함.
 */
export const economicCalendar = pgTable(
    'economic_calendar',
    {
        id: text('id').primaryKey(),
        country: text('country').notNull(),
        // FMP 원본 'YYYY-MM-DD HH:mm:ss' (ET 벽시계). KST 변환은 표시 계층(etDateTimeToKst).
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
 *   DB 물리 삭제 크론은 아직 미구현이다(tracked follow-up: docs/reference/CRON.md §pending).
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
         * on the viewer side (spec §12 follow-up). Column is intentionally kept
         * to avoid a destructive migration once the follow-up ships.
         */
        sharerTier: userTierEnum('sharer_tier').notNull().default('free'),
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
