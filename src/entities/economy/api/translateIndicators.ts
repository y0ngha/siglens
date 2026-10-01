import 'server-only';
import { revalidateTag } from 'next/cache';
// CORE DEPENDENCY (separate repo, user publishes): analysis-domain AI translation
// of an unmapped indicator name.
import { runIndicatorTranslation } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import { DrizzleIndicatorTranslationRepository } from './indicatorTranslationRepository';
import {
    isIndicatorTranslationPending,
    markIndicatorTranslationPending,
} from './indicatorTranslationFlag';
import {
    etDateOf,
    futureWindowEnd,
    pastWindowStart,
} from '../lib/calendarWindow';
import { type CalendarCountry } from '../lib/economyCalendarConstants';
import {
    INDICATOR_NAME_KO,
    normalizeIndicatorName,
} from '../lib/indicatorNameKo';
import { INDICATOR_TRANSLATION_CACHE_TAG } from '../lib/indicatorTranslationConstants';

export type TranslateIndicatorResult =
    | 'dictionary'
    | 'pending'
    | 'translated'
    | 'failed';

/**
 * 미매핑 지표명 1건을 core AI로 번역해 `economic_indicator_translations`에
 * `source:'ai'`로 캐시하고 번역 캐시 태그를 무효화한다(다음 렌더에서 한국어 반영).
 *
 * 코드 사전(`INDICATOR_NAME_KO`)에 이미 있으면 즉시 반환 — dict가 source-of-truth라
 * AI를 호출할 이유가 없다. pending-flag로 동시/연속 제출을 dedupe한다. core 실패 시
 * graceful(캐시 미기록) — pending-flag TTL 만료 후 재시도된다. E2E 단락은 호출부 몫.
 *
 * 방문자 경로(`ensureIndicatorTranslatedAction`)와 허브 프리웜 크론
 * ({@link translateUnresolvedCalendarIndicators})이 공유한다.
 */
export async function translateIndicator(
    normalizedName: string,
    logLabel: string
): Promise<TranslateIndicatorResult> {
    if (normalizedName in INDICATOR_NAME_KO) return 'dictionary';
    if (await isIndicatorTranslationPending(normalizedName)) return 'pending';
    // core 왕복 전에 마킹 — 동시 호출이 이 지점 이후 플래그를 읽으면 제출을 생략.
    await markIndicatorTranslationPending(normalizedName);

    const result = await runIndicatorTranslation(normalizedName);
    const nameKo =
        result.status === 'cached' || result.status === 'done'
            ? result.nameKo
            : null;
    if (nameKo === null || nameKo.trim() === '') {
        // null = core error; empty = core의 "번역 불가" 시그널 → 영어 유지
        if (nameKo !== null) {
            console.error(
                `[${logLabel}] empty translation for "${normalizedName}"`
            );
        }
        return 'failed';
    }

    const { db } = getDatabaseClient();
    const repo = new DrizzleIndicatorTranslationRepository(db);
    await repo.upsert({
        normalizedName,
        koreanName: nameKo.trim(),
        source: 'ai',
    });

    // 번역 캐시 태그만 무효화 — 캘린더 데이터 ISR 캐시는 무관.
    // Next 16 revalidateTag(tag, profile) — 'max'는 즉시 무효화.
    revalidateTag(INDICATOR_TRANSLATION_CACHE_TAG, 'max');
    return 'translated';
}

/**
 * 캘린더 화면에 걸릴 지표명 중 사전·DB 어디에도 없는 것을 **크론에서 미리** 번역한다.
 *
 * 예전에는 방문자 브라우저가 화면을 연 뒤에야 미해결 이름을 번역 요청했다
 * (`useIndicatorTranslationTrigger`). 그래서 첫 방문자와 크롤러는 영어 레이블을 받았다
 * (2026-10-01 허브 감사 A2). 페이지가 실제로 읽는 것과 같은 창
 * (`pastWindowStart`~`futureWindowEnd`, ET 앵커 오늘)의 이벤트에서 이름을 모은다.
 *
 * `limit`개까지만 순차 번역한다 — 허브 유닛 상한(45초) 안에 들어와야 하고, 남은
 * 이름은 다음 tick이 이어받는다(번역된 이름은 DB에서 걸러져 다시 고르지 않는다).
 *
 * @returns 이번에 실제로 번역·저장한 수.
 */
export async function translateUnresolvedCalendarIndicators(
    country: CalendarCountry,
    { limit, logLabel }: { readonly limit: number; readonly logLabel: string }
): Promise<number> {
    const { db } = getDatabaseClient();
    const anchorEt = etDateOf(new Date());
    const events = await new DrizzleEconomicCalendarRepository(db).listInRange(
        pastWindowStart(anchorEt),
        futureWindowEnd(anchorEt),
        country
    );
    const unknownBases = [
        ...new Set(events.map(e => normalizeIndicatorName(e.event).base)),
    ].filter(base => !Object.hasOwn(INDICATOR_NAME_KO, base));
    if (unknownBases.length === 0) return 0;

    const known = new Set(
        (
            await new DrizzleIndicatorTranslationRepository(db).findByNames(
                unknownBases
            )
        ).map(r => r.normalizedName)
    );
    const targets = unknownBases
        .filter(base => !known.has(base))
        .slice(0, limit);

    let translated = 0;
    // 순차 — 이름 수가 적고(보통 0~몇 건), 동시에 던지면 프로바이더 레이트리밋에 걸린다.
    for (const base of targets) {
        const outcome = await translateIndicator(base, logLabel).catch(
            (error: unknown) => {
                console.error(`[${logLabel}] translate failed: ${base}`, error);
                return 'failed' as const;
            }
        );
        if (outcome === 'translated') translated += 1;
    }
    return translated;
}
