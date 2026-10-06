import 'server-only';
import { revalidateTag } from 'next/cache';
// CORE DEPENDENCY (separate repo, user publishes): analysis-domain AI translation
// of an unmapped indicator name.
import { runIndicatorTranslation } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';
import {
    __resetMemoryLruForTests,
    createMemoryLru,
} from '@/shared/cache/memoryLru';
import { MS_PER_MINUTE } from '@/shared/config/time';

import { DrizzleEconomicCalendarRepository } from './economicCalendarRepository';
import { DrizzleIndicatorTranslationRepository } from './indicatorTranslationRepository';
import {
    isIndicatorTranslationPending,
    markIndicatorTranslationPending,
} from './indicatorTranslationFlag';
import {
    addEtDays,
    etDateOf,
    futureWindowEnd,
    pastWindowStart,
} from '../lib/calendarWindow';
import {
    CALENDAR_COUNTRY,
    CALENDAR_COUNTRY_KR,
    type CalendarCountry,
} from '../lib/economyCalendarConstants';
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
 * 화면 캘린더 창(`pastWindowStart`~`futureWindowEnd`, ET 앵커)에 걸린 이벤트의 지표명
 * base 집합. 번역 크론의 대상 수집과 방문자 번역 요청의 화이트리스트가 같은 창을 쓴다.
 *
 * `pastPaddingDays`는 화이트리스트 전용 여유다 — 방문자 화면은 묵은 렌더일 수 있어
 * 그 창이 서버의 "오늘" 창보다 이를 수 있다(값의 근거는 {@link WHITELIST_PAST_PADDING_DAYS}).
 */
async function listCalendarIndicatorBases(
    db: ReturnType<typeof getDatabaseClient>['db'],
    country: CalendarCountry,
    anchorEt: string,
    pastPaddingDays = 0
): Promise<ReadonlySet<string>> {
    const events = await new DrizzleEconomicCalendarRepository(db).listInRange(
        addEtDays(pastWindowStart(anchorEt), -pastPaddingDays),
        futureWindowEnd(anchorEt),
        country
    );
    return new Set(events.map(e => normalizeIndicatorName(e.event).base));
}

/**
 * 방문자 번역 요청 이름 길이 상한. 실제 지표 base는 수십 자다(가장 긴 축이 50자 안팎).
 * DB 조회 전에 잘라 거대한 페이로드가 조회·로그·프롬프트 어디에도 닿지 않게 한다.
 */
export const MAX_INDICATOR_NAME_LENGTH = 120;

/**
 * 묵은 화면 창을 덮는 과거 여유(일).
 *
 * 이 액션을 부르는 화면은 `EconomicCalendarGrid`뿐이고, 그 그리드를 그리는 페이지는
 * `/[locale]/economy`와 `/[locale]/economy/kr` 두 개다. 화면 창의 앵커(ET 오늘)는
 * 렌더 시점에 정해지므로, 방문자가 받는 창의 나이 = 그 HTML의 나이다:
 *
 * 1. ISR `revalidate = 86400`(두 페이지 모두) — 만료 전까지 최대 **1일**.
 * 2. 만료 뒤 첫 요청은 Next의 stale-while-revalidate로 **묵은 본문을 한 번 더** 받는다.
 *    `expireTime`을 따로 두지 않아(`next.config.ts`) 기본값(1년)이라, 방문이 뜸한
 *    로케일에서는 이 한 번이 이론상 며칠 묵을 수 있다.
 * 3. 엣지(Cloudflare)는 Next가 붙이는 `s-maxage=86400`만큼 같은 HTML을 더 들고 있을
 *    수 있다 — **+1일**.
 * 4. 데이터 캐시(`getCalendarFromDb`의 `unstable_cache`)는 앵커를 키에 넣으므로 창을
 *    더 묵게 하지 않는다. 적재 시 `revalidateTag('max')`도 다음 요청을 묵은 본문으로
 *    받게 할 뿐 (2)와 같은 경로다.
 *
 * 그래서 확정 상한은 1 + 1 = 2일이고, (2)의 드문 장기 묵음을 덮으려 여유를 7일로 둔다.
 * 넓혀도 안전한 이유: 화이트리스트에 들어오는 것은 여전히 **실제 캘린더 이벤트명**이라
 * 임의 문자열이 LLM에 닿는 구멍은 생기지 않고, 그 이름들은 대개 이미 허브 크론
 * (`translateUnresolvedCalendarIndicators`)이 자기 창에 있을 때 번역해 뒀다. 7일보다
 * 묵은 화면의 미번역 이름은 번역이 늦을 뿐(영어 표시) 비용 문제는 없다.
 */
export const WHITELIST_PAST_PADDING_DAYS = 7;

const CALENDAR_COUNTRIES: readonly CalendarCountry[] = [
    CALENDAR_COUNTRY,
    CALENDAR_COUNTRY_KR,
];

/**
 * 화이트리스트용 지표명 집합을 인스턴스 메모리에 5분 보관한다. 캘린더 화면 한 번이
 * 미해결 이름 수만큼 액션을 부르고, 각 호출이 두 나라 창을 Neon에서 읽으면 같은
 * 쿼리가 반복된다. 캘린더는 하루 몇 번 적재되므로 5분 묵은 집합으로 충분하다 —
 * 새로 들어온 이벤트명은 최대 5분 뒤부터 번역 요청이 통과한다(크론이 먼저 번역한다).
 */
const WHITELIST_CACHE_TTL_MS = 5 * MS_PER_MINUTE;
const whitelistCache = createMemoryLru<ReadonlySet<string>>(
    CALENDAR_COUNTRIES.length
);

async function cachedWhitelistBases(
    country: CalendarCountry,
    anchorEt: string
): Promise<ReadonlySet<string>> {
    const key = `${country}:${anchorEt}`;
    const hit = whitelistCache.get(key);
    if (hit !== undefined) return hit;
    const bases = await listCalendarIndicatorBases(
        getDatabaseClient().db,
        country,
        anchorEt,
        WHITELIST_PAST_PADDING_DAYS
    );
    whitelistCache.set(key, bases, WHITELIST_CACHE_TTL_MS);
    return bases;
}

/** 테스트 전용 — 화이트리스트 캐시를 비운다. */
export function __resetIndicatorWhitelistCacheForTests(): void {
    __resetMemoryLruForTests(whitelistCache);
}

/**
 * 방문자가 보낸 지표명이 번역할 자격이 있는가 — 공개 서버 액션의 화이트리스트.
 *
 * 액션 인자는 브라우저가 보낸 임의 문자열이다. 이 검사가 없으면 고유 문자열마다
 * LLM 번역 1회와 DB 행 1개가 생긴다(감사 M5). 화면 캘린더 창에 실제로 있는 이벤트의
 * base만 통과시킨다. 사전에 있는 이름은 번역이 필요 없으므로 여기서도 거절한다.
 */
export async function isTranslatableCalendarIndicator(
    name: string
): Promise<boolean> {
    if (name.length === 0 || name.length > MAX_INDICATOR_NAME_LENGTH) {
        return false;
    }
    if (Object.hasOwn(INDICATOR_NAME_KO, name)) return false;
    const anchorEt = etDateOf(new Date());
    const perCountry = await Promise.all(
        CALENDAR_COUNTRIES.map(country =>
            cachedWhitelistBases(country, anchorEt)
        )
    );
    return perCountry.some(bases => bases.has(name));
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
    const unknownBases = [
        ...(await listCalendarIndicatorBases(
            db,
            country,
            etDateOf(new Date())
        )),
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
