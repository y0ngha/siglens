import { like } from 'drizzle-orm';
import { bcryptPasswordHasher } from '@/entities/auth/lib/bcrypt';
import { economicCalendarId } from '@/entities/economy/lib/economicCalendarId';
import { addEtDays, etDateOf } from '@/entities/economy/lib/calendarWindow';
import { getDatabaseClient } from '@/shared/db/client';
import {
    assetTranslations,
    cryptoAssets,
    economicCalendar,
    marketNews,
    sharedAnalyses,
    terms,
    users,
} from '@/shared/db/schema';
import { NEWS_CATEGORY_SLUGS } from '@/entities/market-news';
import { makeFakeItems } from '@/entities/market-news/lib/FakeMarketNewsClient';
import {
    AUTH_USER_EMAIL,
    AUTH_USER_NAME,
    AUTH_USER_PASSWORD,
} from '../support/authUser';

/**
 * Minimal E2E seed: inserts a single AAPL row into `asset_translations`, plus
 * one active row each for the `privacy` and `tos` legal documents into `terms`.
 *
 * AAPL / asset_translations
 * --------------------------
 * The `[symbol]` page resolves a ticker through getAssetInfo → cache → the
 * `asset_translations` DB table → FMP. Under E2E (network-guarded, no real FMP),
 * the page calls `notFound()` when getAssetInfo returns null, so this row is the
 * thing that lets `/AAPL` render. There is no `tickers` table in this repo; the
 * authoritative lookup table for asset info is `asset_translations`.
 *
 * Columns set match every NOT-NULL column without a default:
 *   symbol (PK), name, koreanName, fmpSymbol. `updatedAt` has a defaultNow().
 * For US equities the canonical symbol equals the FMP symbol, so fmpSymbol='AAPL'.
 *
 * terms (privacy + tos)
 * ---------------------
 * `/privacy` and `/terms` are statically prerendered at build time. Each page
 * runs findActive('privacy') / findActive('tos') against the `terms` table
 * (WHERE kind = ? AND effective_date <= NOW() ORDER BY effective_date DESC).
 * In CI the prod build runs cold against the e2e Postgres, so the table must
 * not only exist (migrate) but contain an active row — otherwise the prerender
 * renders null / errors and fails the build. We seed one past-dated row each.
 *
 * Columns set match every NOT-NULL column without a default:
 *   kind, version (integer), effectiveDate (past so it is "active"), body.
 * `id` defaults to a random uuid; `createdAt` has a defaultNow().
 *
 * users (authenticated E2E account)
 * ----------------------------------
 * `/account` and `/account/delete` require a session — proxy.ts forward-guards
 * unauthenticated requests to /login, and the page itself re-checks via
 * getCurrentUser. So the authed Playwright project (storageState) needs a real
 * user to log in as. We upsert one known account (credentials live in
 * `e2e/support/authUser.ts`, shared with the auth-setup project) and store a
 * bcrypt hash via the repo's own `bcryptPasswordHasher` so the real loginUser
 * → bcryptPasswordVerifier path accepts it.
 *
 * Columns set match every NOT-NULL column without a default:
 *   email (unique, NOT NULL). passwordHash/name are nullable but required for
 *   login to succeed and for /account to show a display name. emailVerified is
 *   set true (login does not require it, but it mirrors a real account).
 *   id/tier/createdAt/updatedAt all have defaults.
 *
 * market_news (news-hub category fixtures)
 * -----------------------------------------
 * `/news/[category]` reads cards from the `market_news` table. The only runtime
 * data source under E2E is the client-triggered ingestion, whose cold-start
 * race left the first crypto-category spec flaky. We pre-seed the same fixtures
 * (`makeFakeItems`, shared with `FakeMarketNewsClient`) for all categories so the
 * pages render cards in SSR deterministically. Timestamps are `Date.now()`-relative
 * so the rows stay inside the `MARKET_NEWS_LOOKBACK_DAYS` window.
 *
 * Idempotency
 * -----------
 * The Task 1 containers persist data across runs, so every insert uses
 * `onConflictDoNothing` (asset_translations on its PK; terms on the
 * (kind, version) unique index; users on the email unique index) to stay
 * safely re-runnable. market_news is the exception: it uses delete-then-insert
 * (scoped to the E2E url prefix) so `publishedAt` is refreshed every run and
 * never rots out of the lookback window.
 *
 * Runs with E2E_TEST=1 + the .env.e2e DATABASE_URL so the postgres-js swap
 * (Task 2) writes to the local Postgres.
 */

/** Past-dated so `effective_date <= NOW()` always holds → row is "active". */
const TERMS_EFFECTIVE_DATE = new Date('2020-01-01T00:00:00Z');

async function seed(): Promise<void> {
    const { db } = getDatabaseClient();
    await db
        .insert(assetTranslations)
        .values([
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            {
                // E2E sentinel symbol for congress sparse-trades spec:
                // FakeCongressTradesProvider returns [] for EMPTYX (both chambers).
                // Seeded here so getAssetInfo resolves via DB (non-degraded) and the
                // congress page emits indexable metadata — 0 trades is a valid sparse
                // state, not a degrade condition. Without this row, getAssetInfo falls
                // through to FMP (config missing in E2E) → throw → degraded → noindex.
                //
                // name === symbol so buildDisplayName returns the bare ticker ('EMPTYX'),
                // matching the congress spec's assertion on the h1 heading.
                // koreanName: '' (empty, satisfies NOT NULL) so buildDisplayName stays in
                // the no-korean branch (falsy check), returning ticker as-is.
                symbol: 'EMPTYX',
                name: 'EMPTYX',
                koreanName: '',
                fmpSymbol: 'EMPTYX',
            },
        ])
        .onConflictDoNothing();

    // crypto_assets — seeds the crypto_assets table so getAssetInfo(BTCUSD)
    // resolves via crypto_assets membership check (getCryptoAsset) and returns
    // an AssetInfo with marketProfile:'crypto'. Without this seed, getCryptoAsset
    // returns null → getAssetInfo falls through to FMP (not available in E2E) →
    // degraded or null → /BTCUSD renders notFound(). This is the gap that let
    // crypto-specific bugs ship undetected (Rec #4 of the crypto post-audit).
    //
    // Column constraints (crypto_assets table):
    //   symbol (PK), name (NOT NULL), koreanName (nullable), circulatingSupply
    //   (nullable), updatedAt (defaultNow, NOT NULL).
    await db
        .insert(cryptoAssets)
        .values([
            {
                symbol: 'BTCUSD',
                name: 'Bitcoin USD',
                koreanName: '비트코인',
                circulatingSupply: 19_700_000,
            },
            {
                symbol: 'ETHUSD',
                name: 'Ethereum USD',
                koreanName: '이더리움',
                circulatingSupply: 120_000_000,
            },
        ])
        .onConflictDoNothing();

    console.log('e2e seed: crypto_assets ok');

    await db
        .insert(terms)
        .values([
            {
                kind: 'privacy',
                version: 1,
                effectiveDate: TERMS_EFFECTIVE_DATE,
                body: 'E2E 테스트 개인정보처리방침 본문',
            },
            {
                kind: 'tos',
                version: 1,
                effectiveDate: TERMS_EFFECTIVE_DATE,
                body: 'E2E 테스트 이용약관 본문',
            },
        ])
        .onConflictDoNothing({ target: [terms.kind, terms.version] });

    const passwordHash =
        await bcryptPasswordHasher.hashPassword(AUTH_USER_PASSWORD);
    await db
        .insert(users)
        .values({
            email: AUTH_USER_EMAIL,
            passwordHash,
            name: AUTH_USER_NAME,
            emailVerified: true,
        })
        .onConflictDoNothing({ target: users.email });

    // market_news E2E fixtures — pre-populate so `/news/[category]` renders cards
    // in SSR on the FIRST visit. Without this, the only data source is the
    // client-triggered ingestion (`ensureMarketNewsCardsAnalyzedAction`), whose
    // cold-start (+ failed AI-worker retries) doesn't finish within the spec's
    // 15s window, so the first crypto-category test (`news-hub.spec.ts:58`) flaked.
    // Delete-then-insert (not onConflictDoNothing) keeps `publishedAt` fresh across
    // persisted-container re-runs — stale rows fall outside the
    // `MARKET_NEWS_LOOKBACK_DAYS` window and get filtered out (time-rot).
    const E2E_NEWS_URL_PREFIX = 'http://localhost:4300/e2e/market-news/';
    await db
        .delete(marketNews)
        .where(like(marketNews.url, `${E2E_NEWS_URL_PREFIX}%`));
    // Seed rows are AI-enriched (sentiment + priceImpact non-null + analyzedAt)
    // so the cards render the sentiment badge in SSR. The E2E AI worker is
    // unavailable (WORKER_URL unset), so client-side analysis never completes —
    // `MarketNewsCard` treats `sentiment === null || priceImpact === null` as
    // pending (skeleton, no badge), which is what `news-hub.spec.ts:58` asserts
    // against. `titleKo` is left null so the card shows the English `titleEn`
    // that the spec matches.
    const SEED_SENTIMENTS = ['bullish', 'bearish'] as const;
    const newsRows = NEWS_CATEGORY_SLUGS.flatMap(category =>
        makeFakeItems(category).map((item, i) => ({
            id: item.id,
            symbol: item.symbol,
            source: item.source,
            url: item.url,
            publishedAt: new Date(item.publishedAt),
            titleEn: item.titleEn,
            bodyEn: item.bodyEn,
            tickers: item.tickers,
            sentiment: SEED_SENTIMENTS[i % SEED_SENTIMENTS.length],
            priceImpact: 'medium',
            summaryKo: `${category} 시장 동향 E2E 요약`,
            analyzedAt: new Date(),
        }))
    );
    await db.insert(marketNews).values(newsRows);

    // economic_calendar — Seed 3 calendar events relative to NOW so they always
    // fall within the app's ±14-day window (pastWindowStart..futureWindowEnd).
    // SP-A switched the calendar grid source from FakeEconomyProvider.getCalendar()
    // to getCalendarFromDb (reads `economic_calendar` table). Without this seed,
    // CI (clean DB) renders an empty calendar → "Fed Rate Decision" absent from
    // SSR HTML → economy.spec.ts:53 fails (local-pass/CI-fail because dev DB has rows).
    //
    // Events mirror FakeEconomyProvider.getCalendar() by name/impact/values, but
    // dateEt is computed relative to today-ET so the rows never fall out of window.
    const todayEt = etDateOf(new Date());
    const todayMinus1 = addEtDays(todayEt, -1);
    const todayPlus1 = addEtDays(todayEt, 1);

    // todayMinus2: ±14d 윈도 내에 있고 과거 날짜이므로 actual 채움이 자연스럽다.
    // 분석 결과(sentiment/summaryKo/interpretationKo/analyzedAt)를 포함해
    // SP-B(한국어 레이블)·SP-C(필터)·SP-D(sentiment 배지) e2e 검증에 사용된다.
    const todayMinus2 = addEtDays(todayEt, -2);
    // Low impact 이벤트 — 기본 필터(High+Med) OFF 상태. 낮음 칩 토글 테스트에 사용.
    const todayPlus2 = addEtDays(todayEt, 2);

    const calendarRows = [
        {
            id: economicCalendarId(
                'US',
                `${todayEt} 14:00:00`,
                'Fed Rate Decision'
            ),
            country: 'US',
            dateEt: `${todayEt} 14:00:00`,
            event: 'Fed Rate Decision',
            impact: 'High',
            estimate: 3.63,
            previous: 3.63,
            actual: null,
            unit: '%',
        },
        {
            id: economicCalendarId('US', `${todayMinus1} 12:30:00`, 'CPI YoY'),
            country: 'US',
            dateEt: `${todayMinus1} 12:30:00`,
            event: 'CPI YoY',
            impact: 'High',
            estimate: 2.3,
            previous: 2.4,
            actual: null,
            unit: '%',
        },
        {
            id: economicCalendarId(
                'US',
                `${todayPlus1} 12:30:00`,
                'Initial Jobless Claims'
            ),
            country: 'US',
            dateEt: `${todayPlus1} 12:30:00`,
            event: 'Initial Jobless Claims',
            impact: 'Medium',
            estimate: 230000,
            previous: 229000,
            actual: null,
            unit: '',
        },
        /**
         * SP-B / SP-D e2e 앵커 이벤트 — INDICATOR_NAME_KO에 등재된 'Nonfarm Payrolls'
         * (→ 비농업 고용)를 사용해 서버 한국어 레이블 해석을 검증한다.
         * actual/sentiment/summaryKo/interpretationKo/analyzedAt를 모두 채워
         * 분석 배지·요약이 SSR HTML에 박히는 것을 확인한다.
         *
         * today-2는 발표 완료 시점(과거)이므로 actual을 자연스럽게 채울 수 있고,
         * PAST_WINDOW_DAYS(14일) 이내라 getCalendarFromDb 쿼리에 반드시 포함된다.
         */
        {
            id: economicCalendarId(
                'US',
                `${todayMinus2} 12:30:00`,
                'Nonfarm Payrolls'
            ),
            country: 'US',
            dateEt: `${todayMinus2} 12:30:00`,
            event: 'Nonfarm Payrolls',
            impact: 'High',
            estimate: 185000,
            previous: 177000,
            actual: 203000,
            unit: '',
            sentiment: 'bullish',
            summaryKo:
                '비농업 고용이 예상치를 크게 상회해 노동시장 강세를 확인했습니다.',
            interpretationKo:
                '고용 호조는 연준의 금리 인하 속도를 늦출 수 있어 달러 강세 요인입니다.',
            analyzedAt: new Date(),
        },
        /**
         * SP-C 필터 테스트용 Low impact 이벤트 — 기본 필터(High+Med)에서 제외되므로
         * '낮음' 칩 클릭 전후로 이 날짜 셀의 표시 건수가 달라지는 것을 검증한다.
         * today+2는 미래(발표 예정)이므로 actual=null이 자연스럽다.
         */
        {
            id: economicCalendarId(
                'US',
                `${todayPlus2} 10:00:00`,
                'MBA Mortgage Applications'
            ),
            country: 'US',
            dateEt: `${todayPlus2} 10:00:00`,
            event: 'MBA Mortgage Applications',
            impact: 'Low',
            estimate: null,
            previous: -1.2,
            actual: null,
            unit: '%',
        },
    ];
    await db
        .insert(economicCalendar)
        .values(calendarRows)
        .onConflictDoNothing();

    console.log('e2e seed: economic_calendar ok');

    // shared_analyses — seeds one chart-kind snapshot row with a known id so
    // the E2E golden-path test can visit /share/<id> without needing the full
    // createShareSnapshotAction round-trip (heavy: requires analysis pipeline).
    //
    // The snapshot_json contains a minimal but structurally valid AnalysisResponse
    // (chart kind) so parseSnapshot() accepts it and kindPanelRegistry routes to
    // ChartSharePanel, which renders via the mocked AnalysisPanel.
    //
    // Column constraints (shared_analyses table):
    //   id (PK, text), kind (shareableKindEnum), symbol (varchar NOT NULL),
    //   contentHash (varchar NOT NULL, unique), snapshotJson (jsonb NOT NULL),
    //   sharerTier (userTierEnum default 'free'), expiresAt (timestamp NOT NULL).
    //   userId (nullable, SET NULL on delete), createdAt (defaultNow).
    //
    // expires_at is far future (2099) so the row is always found.
    // onConflictDoNothing on PK keeps the seed re-runnable (idempotent).
    const E2E_SHARE_ID = 'e2e-share-chart-aapl-fixture01';
    const chartSnapshotJson = {
        kind: 'chart',
        symbol: 'AAPL',
        context: {
            symbol: 'AAPL',
            displayName: 'Apple Inc.',
            assetClass: 'equity',
            analyzedAt: '2026-01-01T00:00:00.000Z',
        },
        result: {
            trend: 'neutral',
            summary: 'E2E 공유 스냅샷 고정 분석 요약입니다.',
            indicatorResults: [],
            riskLevel: 'medium',
            keyLevels: { support: [], resistance: [] },
            priceTargets: {
                bullish: { targets: [], condition: '' },
                bearish: { targets: [], condition: '' },
            },
            patternSummaries: [],
            strategyResults: [],
            candlePatterns: [],
            trendlines: [],
            analyzedAt: '2026-01-01T00:00:00.000Z',
        },
    };
    await db
        .insert(sharedAnalyses)
        .values({
            id: E2E_SHARE_ID,
            userId: null,
            kind: 'chart',
            symbol: 'AAPL',
            contentHash: 'e2e-fixture-chart-aapl-contenthash-seed-00000001',
            snapshotJson: chartSnapshotJson,
            sharerTier: 'free',
            expiresAt: new Date('2099-01-01T00:00:00Z'),
        })
        .onConflictDoNothing();

    console.log('e2e seed: shared_analyses ok');
    console.log('e2e seed: ok');
}

seed().then(
    () => process.exit(0),
    e => {
        console.error(e);
        process.exit(1);
    }
);
