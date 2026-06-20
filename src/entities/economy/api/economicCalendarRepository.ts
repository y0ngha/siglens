import 'server-only';
import {
    and,
    asc,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    lte,
    sql,
} from 'drizzle-orm';
import type {
    CalendarImpact,
    EconomicCalendarEvent,
    EconomicEventAnalysis,
} from '@y0ngha/siglens-core';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { economicCalendar } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { economicCalendarId } from '../lib/economicCalendarId';
import { toEventSentiment } from '../lib/economicEventAnalysisGuard';
import type { EconomicCalendarEventWithAnalysis } from '../model';

/** 읽기 경계에서 검증하는 impact 정규값 — 미지값은 'Low'로 강등(graceful). */
const IMPACT_RECORD: Record<CalendarImpact, true> = {
    High: true,
    Medium: true,
    Low: true,
};
function toImpact(value: string): CalendarImpact {
    // `in` 멤버십 검사가 value가 CalendarImpact임을 보장하므로 타입 단언은 안전하다.
    return value in IMPACT_RECORD ? (value as CalendarImpact) : 'Low';
}

interface CalendarDbRow {
    dateEt: string;
    event: string;
    impact: string;
    actual: number | null;
    estimate: number | null;
    previous: number | null;
    unit: string;
    sentiment: string | null;
    summaryKo: string | null;
    interpretationKo: string | null;
    analyzedAt: Date | null;
}

function toEvent(row: CalendarDbRow): EconomicCalendarEventWithAnalysis {
    return {
        date: row.dateEt,
        event: row.event,
        impact: toImpact(row.impact),
        actual: row.actual,
        estimate: row.estimate,
        previous: row.previous,
        unit: row.unit,
        sentiment: toEventSentiment(row.sentiment),
        summaryKo: row.summaryKo,
        interpretationKo: row.interpretationKo,
        analyzedAt: row.analyzedAt,
    };
}

/** ensure가 core submitEconomicEventAnalysis에 넘기는 입력 + 행 식별 id. */
export interface UnanalyzedAnnouncedEvent {
    id: string;
    event: string;
    impact: CalendarImpact;
    /** actual IS NOT NULL로 필터되므로 number 보장. */
    actual: number;
    estimate: number | null;
    previous: number | null;
    unit: string;
}

export class DrizzleEconomicCalendarRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 이벤트를 upsert하고 행이 실제로 삽입/변경됐는지 반환한다. 재fetch가 동일
     * 내용을 만들면 `setWhere IS DISTINCT FROM`이 UPDATE를 막아 false를 반환하므로
     * 호출자가 `revalidateTag`를 건너뛸 수 있다(`market_news` upsert와 동일).
     *
     * `id`는 country+dateEt+event 해시라 발표 후 actual/estimate/previous가 바뀌면
     * 같은 행에 UPDATE된다. `country`/`dateEt`/`event`는 키 구성요소라 `set`에서 제외.
     */
    async upsertEvent(
        country: string,
        event: EconomicCalendarEvent
    ): Promise<boolean> {
        const id = economicCalendarId(country, event.date, event.event);
        const changed = await withRetry(
            () =>
                this.db
                    .insert(economicCalendar)
                    .values({
                        id,
                        country,
                        dateEt: event.date,
                        event: event.event,
                        impact: event.impact,
                        estimate: event.estimate,
                        previous: event.previous,
                        actual: event.actual,
                        unit: event.unit,
                    })
                    .onConflictDoUpdate({
                        target: economicCalendar.id,
                        set: {
                            impact: sql`excluded.impact`,
                            estimate: sql`excluded.estimate`,
                            previous: sql`excluded.previous`,
                            actual: sql`excluded.actual`,
                            unit: sql`excluded.unit`,
                            fetchedAt: sql`now()`,
                        },
                        setWhere: sql`
                            ${economicCalendar.impact} IS DISTINCT FROM excluded.impact OR
                            ${economicCalendar.estimate} IS DISTINCT FROM excluded.estimate OR
                            ${economicCalendar.previous} IS DISTINCT FROM excluded.previous OR
                            ${economicCalendar.actual} IS DISTINCT FROM excluded.actual OR
                            ${economicCalendar.unit} IS DISTINCT FROM excluded.unit
                        `,
                    })
                    .returning({ id: economicCalendar.id }),
            NEON_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    /**
     * `[fromEt, toEt]` 범위(경계 포함)의 이벤트를 dateEt 오름차순으로 읽는다.
     * dateEt는 'YYYY-MM-DD HH:mm:ss'라 문자열 비교가 시간순과 일치한다. 경계는
     * 'YYYY-MM-DD' 날짜키 — `from`은 그대로(<= 그날 00:00:00 포함), `to`는 그날
     * 23:59:59까지 포함하도록 ' 23:59:59'를 덧붙인다.
     *
     * SP-D: AI 분석 컬럼(sentiment/summaryKo/interpretationKo/analyzedAt)도 함께 반환한다.
     * `sentiment`는 읽기 경계에서 `toEventSentiment`로 검증 — 미지값은 null로 강등.
     */
    async listInRange(
        fromEt: string,
        toEt: string
    ): Promise<EconomicCalendarEventWithAnalysis[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        dateEt: economicCalendar.dateEt,
                        event: economicCalendar.event,
                        impact: economicCalendar.impact,
                        actual: economicCalendar.actual,
                        estimate: economicCalendar.estimate,
                        previous: economicCalendar.previous,
                        unit: economicCalendar.unit,
                        sentiment: economicCalendar.sentiment,
                        summaryKo: economicCalendar.summaryKo,
                        interpretationKo: economicCalendar.interpretationKo,
                        analyzedAt: economicCalendar.analyzedAt,
                    })
                    .from(economicCalendar)
                    .where(
                        and(
                            gte(economicCalendar.dateEt, fromEt),
                            lte(economicCalendar.dateEt, `${toEt} 23:59:59`)
                        )
                    )
                    .orderBy(asc(economicCalendar.dateEt)),
            NEON_TRANSIENT_RETRY
        );
        return rows.map(toEvent);
    }

    /**
     * 분석 결과를 write-once로 기록한다 — `analyzed_at IS NULL` 가드로 재분석/덮어쓰기를
     * 막는다(market-news `attachAnalysis` 미러). 동시 분석 경합에서 한 호출만 승리한다.
     */
    async attachEventAnalysis(
        id: string,
        analysis: EconomicEventAnalysis
    ): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .update(economicCalendar)
                    .set({
                        sentiment: analysis.sentiment,
                        summaryKo: analysis.summaryKo,
                        interpretationKo: analysis.interpretationKo,
                        analyzedAt: new Date(),
                    })
                    .where(
                        and(
                            eq(economicCalendar.id, id),
                            isNull(economicCalendar.analyzedAt)
                        )
                    ),
            NEON_TRANSIENT_RETRY
        );
    }

    /**
     * 분석 대상 행을 읽는다: impact ∈ impacts AND actual IS NOT NULL AND analyzed_at IS NULL.
     * 발표된(actual 채워진) Medium+ 미분석 이벤트만 반환해 ensure가 core에 넘긴다.
     */
    async listUnanalyzedAnnounced(
        impacts: readonly CalendarImpact[]
    ): Promise<UnanalyzedAnnouncedEvent[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        id: economicCalendar.id,
                        event: economicCalendar.event,
                        impact: economicCalendar.impact,
                        actual: economicCalendar.actual,
                        estimate: economicCalendar.estimate,
                        previous: economicCalendar.previous,
                        unit: economicCalendar.unit,
                    })
                    .from(economicCalendar)
                    .where(
                        and(
                            inArray(economicCalendar.impact, [...impacts]),
                            isNotNull(economicCalendar.actual),
                            isNull(economicCalendar.analyzedAt)
                        )
                    ),
            NEON_TRANSIENT_RETRY
        );
        return rows.map(r => ({
            id: r.id,
            event: r.event,
            impact: toImpact(r.impact),
            // WHERE isNotNull(actual) guarantees non-null at runtime; Drizzle's select type doesn't narrow it.
            actual: r.actual!,
            estimate: r.estimate,
            previous: r.previous,
            unit: r.unit,
        }));
    }
}
