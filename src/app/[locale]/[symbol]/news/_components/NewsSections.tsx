import { getTranslations } from 'next-intl/server';

import { loadSymbolNewsList } from '@/app/[locale]/[symbol]/_lib/symbolNewsList';
import {
    getEarningsReportComparison,
    getGradeEvents,
} from '@/app/[locale]/[symbol]/news/newsData';
import { newsCacheTag } from '@/entities/news-article/lib/newsCacheTag';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import type { Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { AnalystActions } from '@/widgets/news/sections/AnalystActions';
import { EventCalendar } from '@/widgets/news/sections/EventCalendar';
import { NewsList } from '@/widgets/news/sections/NewsList';

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
    console.error(failureLog, error);
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
 * (`degradeSection`).
 */
export async function EventCalendarSection({
    symbol,
    today,
}: EventCalendarSectionProps) {
    const t = await getTranslations('app.symbol');
    const earningsReports = await staticSymbolCache(
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
    );
    if (isDegraded(earningsReports)) {
        return (
            <NewsDataServerAlert
                title={t('page.6723ea')}
                message={earningsReports.degradedMessage}
            />
        );
    }
    return <EventCalendar earningsReports={earningsReports} />;
}

/**
 * 애널리스트 의견 섹션(주식 전용). 실패 처리는 `EventCalendarSection`과 같다. 목록은 뉴스 목록과 같은
 * 이유로 자른다 — 대형주는 이벤트가 수천 건이지만 화면에 닿는 것은 앞의 몇 개뿐이다.
 */
export async function AnalystActionsSection({ symbol }: SymbolSectionProps) {
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
            events={events.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)}
        />
    );
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
