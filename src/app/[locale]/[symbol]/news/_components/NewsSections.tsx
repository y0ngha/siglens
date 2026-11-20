import { getTranslations } from 'next-intl/server';

import { loadSymbolNewsList } from '@/app/[locale]/[symbol]/_lib/symbolNewsList';
import {
    getEarningsReportComparison,
    getGradeEvents,
} from '@/app/[locale]/[symbol]/news/newsData';
import { getAnalystActionHistory } from '@/entities/analyst-views/server/getAnalystActionHistory';
import { loadEarningsHintBounded } from '@/entities/analyst-views/server/loadEarningsHint';
import type { CompanyFiling } from '@/entities/company-filings/model';
import { listCompanyFilings } from '@/entities/company-filings/server/getCompanyFilings';
import { newsCacheTag } from '@/entities/news-article/lib/newsCacheTag';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';
import { SECONDS_PER_HALF_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';
import { addUtcIsoDays, toUtcIsoDate } from '@/shared/lib/isoDate';
import type { Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { withTimeout } from '@/shared/lib/withTimeout';
import { AnalystActions } from '@/widgets/news/sections/AnalystActions';
import { CompanyFilings } from '@/widgets/news/sections/CompanyFilings';
import { EventCalendar } from '@/widgets/news/sections/EventCalendar';
import { NewsList } from '@/widgets/news/sections/NewsList';
import { withNextEarnings } from '@/widgets/news/utils/withNextEarnings';
import {
    fromAnalystAction,
    fromGradesEvent,
    type AnalystActionItem,
} from '@/widgets/news/utils/analystActionItems';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * Yahoo 변경 이력(목표가 포함)을 기다리는 최대 시간. 이력은 보강이라 크롤러가 받는 본문을 이것 때문에 오래 붙잡지
 * 않는다 — 넘기면 기존 등급 목록으로 그린다.
 */
const ANALYST_HISTORY_BUDGET_MS = 2_500;
/**
 * Yahoo 이력의 최신 행이 이보다 오래됐으면 쓰지 않는다(일). 이력이 끊긴 종목에서 몇 년 전 행이 최근 등급 이벤트를
 * 밀어내지 않게 한다 — 그때는 기존 등급 목록이 더 새롭다.
 */
const ANALYST_HISTORY_MAX_AGE_DAYS = 180;
/**
 * 공시 섹션 캐시 TTL. 엔티티가 공시별 제목을 30일, 제출 목록을 30분 캐시하므로 다시 만드는 비용은 작다 — 짧게 두어
 * 일부 공시의 제목을 SEC 제한으로 못 읽은 목록(`headline: null`)이 다음 재생성까지 남지 않게 한다.
 */
const COMPANY_FILINGS_CACHE_TTL_SECONDS = SECONDS_PER_HOUR;

const TIMED_OUT = Symbol('timed-out');

/**
 * 보강 섹션 공통 로더: `staticSymbolCache`로 감싸고 `budgetMs`만 기다린다.
 * - 로더가 던지면(출처 장애) 경고만 남기고 `null` — 캐시에 남지 않고 revalidate도 낮추지 않는다. 보강 하나의 장애가
 *   페이지 전체를 5분마다 재렌더하게 만들면 안 된다.
 * - 시간 초과면 `null`이고 이번 렌더의 revalidate를 낮춘다(`shortenRevalidateForRuntimeDegrade`). 로드는 뒤에서 마저
 *   돌아 캐시를 채우므로(`withTimeout`은 취소하지 않는다) 곧 다시 그리면 섹션이 들어간다 — 낮추지 않으면 섹션이 빠진
 *   콜드 렌더가 라우트 revalidate(12시간) 동안 굳는다.
 */
async function loadBoundedOptional<T>(options: {
    key: string;
    symbol: string;
    load: () => Promise<T>;
    budgetMs: number;
    ttlSeconds: number;
    failureLog: string;
}): Promise<T | null> {
    const { key, symbol, load, budgetMs, ttlSeconds, failureLog } = options;
    const result = await withTimeout<T | null | typeof TIMED_OUT>(
        staticSymbolCache(
            [key, symbol],
            symbol,
            load,
            [newsCacheTag(symbol)],
            ttlSeconds
        ).catch((error: unknown) => {
            console.warn(failureLog, redactDbErrorForLog(error));
            return null;
        }),
        budgetMs,
        TIMED_OUT
    );
    if (result !== TIMED_OUT) return result;
    await shortenRevalidateForRuntimeDegrade();
    return null;
}

/**
 * 목표가를 함께 실은 Yahoo 이력(미국 종목). 실패·시간 초과·한국 종목·빈 이력·끊긴 이력이면 `null` — 호출부가 기존
 * 등급 목록을 쓴다.
 */
async function loadAnalystHistoryItems(
    symbol: string
): Promise<AnalystActionItem[] | null> {
    const history = await loadBoundedOptional({
        key: 'news:analyst-history',
        symbol,
        load: () => getAnalystActionHistory(symbol),
        budgetMs: ANALYST_HISTORY_BUDGET_MS,
        ttlSeconds: SECONDS_PER_HALF_DAY,
        failureLog:
            '[AnalystActionsSection] Yahoo history load failed, using grade events:',
    });
    if (history === null) return null;
    const items = history.flatMap(row => {
        const item = fromAnalystAction(row);
        return item === null ? [] : [item];
    });
    const newest = items[0]?.date;
    const cutoff = addUtcIsoDays(
        toUtcIsoDate(new Date()),
        -ANALYST_HISTORY_MAX_AGE_DAYS
    );
    return newest !== undefined && newest >= cutoff ? items : null;
}

interface SymbolSectionProps {
    /** 대문자 티커. */
    symbol: string;
}

/**
 * 뉴스 목록만 로케일을 받는다 — 본문이 DB 콘텐츠라 해석이 필요하다. 다른 섹션(캘린더·애널리스트)은
 * 로케일과 무관한 수치라 `SymbolSectionProps`를 쓴다.
 */
interface NewsListSectionProps extends SymbolSectionProps {
    locale: Locale;
}

/**
 * 뉴스 탭의 기사 목록 섹션. 페이지 본문과 같은 `loadSymbolNewsList`(요청당 1회)를 읽고, 그리지 않는
 * 행까지 RSC 페이로드로 내보내지 않도록 `NEWS_ROW_SERIALIZATION_LIMIT`로 자른다.
 */
export async function NewsListSection({
    symbol,
    locale,
}: NewsListSectionProps) {
    const items = await loadSymbolNewsList(symbol, locale);
    return (
        <NewsList
            items={items.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)}
            symbol={symbol}
        />
    );
}

interface EventCalendarSectionProps extends SymbolSectionProps {
    /**
     * 요청 시각의 KST 날짜 키(`kstDateKey`). 캐시 키에 들어가 날이 바뀌면 "다음 실적" 비교가 새로
     * 계산된다. 요청 시각은 페이지가 읽어 넘긴다 — 섹션 렌더는 순수하게 둔다.
     */
    today: string;
    /**
     * 그 종목 시장의 오늘(`earningsMarketToday`, 미국 ET·한국 KST). 다음 실적을 Yahoo 힌트와 대조할 때 "이미 지난
     * 날짜"를 시장 달력으로 가른다 — KST 날짜 키로 가르면 미국 장 마감 후 발표일이 하루 일찍 지난 것으로 보인다.
     */
    marketToday: string;
}

/** 섹션 로더가 실패해 경고 카드로 떨어졌을 때의 안내 문구. */
interface DegradedSection {
    readonly degradedMessage: string;
}

/**
 * 섹션 로더 실패의 공통 흡수 — 로그를 남기고 **이 렌더의 revalidate를 짧게 낮춘 뒤**(FMP 장애 안내가 라우트
 * revalidate 동안 굳지 않게) 경고 카드 문구를 돌려준다. FMP 오류는 사용자용 번역을, 그 밖은 섹션 기본
 * 문구를 쓴다.
 */
async function degradeSection(
    failureLog: string,
    error: unknown,
    fallbackMessage: string
): Promise<DegradedSection> {
    console.error(failureLog, redactDbErrorForLog(error));
    await shortenRevalidateForRuntimeDegrade();
    return {
        degradedMessage:
            translateFmpError(error, await getTranslations()) ??
            fallbackMessage,
    };
}

/** 정상 결과(배열)와 `degradeSection` 결과를 가른다. */
const isDegraded = <T,>(value: T | DegradedSection): value is DegradedSection =>
    typeof value === 'object' && value !== null && 'degradedMessage' in value;

/**
 * 실적 이벤트 캘린더 섹션(주식 전용). FMP 장애(렌더 예산 초과 포함)는 경고 카드로 흡수한다
 * (`degradeSection`). 다음 실적은 Yahoo 힌트(12h 캐시, 실패·2.5초 초과면 대조 없이)와 대조해 확정일·발표 시간대를
 * 싣는다 — 펀더멘털 탭·AI 분석과 같은 날짜를 말하게.
 */
export async function EventCalendarSection({
    symbol,
    today,
    marketToday,
}: EventCalendarSectionProps) {
    const t = await getTranslations('app.symbol');
    const [earningsReports, hint] = await Promise.all([
        staticSymbolCache(
            ['news:earnings', symbol, today],
            symbol,
            () => getEarningsReportComparison(symbol, today),
            [newsCacheTag(symbol)],
            SECONDS_PER_HALF_DAY
        ).catch((error: unknown) =>
            degradeSection(
                '[EventCalendarSection] earnings load failed, degrading:',
                error,
                t('page.3c87a9')
            )
        ),
        loadEarningsHintBounded(symbol),
    ]);
    if (isDegraded(earningsReports)) {
        return (
            <NewsDataServerAlert
                title={t('page.6723ea')}
                message={earningsReports.degradedMessage}
            />
        );
    }
    return (
        <EventCalendar
            earningsReports={withNextEarnings(
                earningsReports,
                hint,
                marketToday
            )}
        />
    );
}

/**
 * 애널리스트 의견 섹션(주식 전용). 미국 종목은 목표가 변화까지 담은 Yahoo 이력을 먼저 쓰고(`loadAnalystHistoryItems`),
 * 없으면 기존 등급 이벤트다. 등급 이벤트 실패 처리는 `EventCalendarSection`과 같다. 목록은 뉴스 목록과 같은
 * 이유로 자른다 — 대형주는 이벤트가 수천 건이지만 화면에 닿는 것은 앞의 몇 개뿐이다.
 */
export async function AnalystActionsSection({ symbol }: SymbolSectionProps) {
    const history = await loadAnalystHistoryItems(symbol);
    if (history !== null)
        return (
            <AnalystActions
                items={history.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)}
            />
        );
    const t = await getTranslations('app.symbol');
    const events = await staticSymbolCache(
        ['news:grades', symbol],
        symbol,
        () => getGradeEvents(symbol),
        [newsCacheTag(symbol)],
        SECONDS_PER_HALF_DAY
    ).catch((error: unknown) =>
        degradeSection(
            '[AnalystActionsSection] grades load failed, degrading:',
            error,
            t('page.5c38df')
        )
    );
    if (isDegraded(events)) {
        return (
            <NewsDataServerAlert
                title={t('page.b2cd1a')}
                message={events.degradedMessage}
            />
        );
    }
    return (
        <AnalystActions
            items={events
                .slice(0, NEWS_ROW_SERIALIZATION_LIMIT)
                .map(fromGradesEvent)}
        />
    );
}

/**
 * 최근 공시 목록을 기다리는 최대 시간. 차가운 첫 조회는 SEC 요청이 열 건 넘게 줄을 서서 몇 초 걸린다 — 보강이라
 * 본문을 오래 붙잡지 않는다.
 */
const COMPANY_FILINGS_BUDGET_MS = 4_000;

/**
 * 공시 목록 로더(`staticSymbolCache` 안). SEC·DB 실패는 던져 캐시에 남기지 않는다 — 일시 장애의 "공시 없음"이
 * 굳으면 안 된다. SEC에 공시하지 않는 종목(한국·크립토·E2E)은 정상적인 빈 목록이다.
 */
async function loadCompanyFilings(symbol: string): Promise<CompanyFiling[]> {
    const result = await listCompanyFilings(symbol);
    if (result.status === 'failed')
        throw new Error(`company filings unavailable for ${symbol}`);
    return result.status === 'ok' ? result.filings : [];
}

/**
 * 최근 공시 섹션(미국 주식). 보강이라 실패·시간 초과·빈 목록이면 그리지 않는다(`loadBoundedOptional`) — 공시가 없는
 * 종목에 빈 카드를 보이지 않는다.
 */
export async function CompanyFilingsSection({ symbol }: SymbolSectionProps) {
    const filings = await loadBoundedOptional({
        key: 'news:company-filings',
        symbol,
        load: () => loadCompanyFilings(symbol),
        budgetMs: COMPANY_FILINGS_BUDGET_MS,
        ttlSeconds: COMPANY_FILINGS_CACHE_TTL_SECONDS,
        failureLog:
            '[CompanyFilingsSection] filings load failed, omitting section:',
    });
    if (filings === null || filings.length === 0) return null;
    return <CompanyFilings filings={filings} />;
}

interface NewsDataServerAlertProps {
    title: string;
    message: string;
}

function NewsDataServerAlert({ title, message }: NewsDataServerAlertProps) {
    return (
        <section
            className="rounded-lg border border-ui-danger/30 bg-secondary-800 p-6"
            role="alert"
        >
            <h2 className={cn('mb-2', HEADING_SECTION)}>{title}</h2>
            <p className="text-sm text-ui-danger-text">{message}</p>
        </section>
    );
}
