import 'server-only';

import { getDatabaseClient } from '@/shared/db/client';
import {
    __resetMemoryLruForTests,
    createMemoryLru,
} from '@/shared/cache/memoryLru';
import { MS_PER_MINUTE } from '@/shared/config/time';

import { listCalendarIndicatorBases } from './listCalendarIndicatorBases';
import { etDateOf } from '../lib/calendarWindow';
import {
    CALENDAR_COUNTRY,
    CALENDAR_COUNTRY_KR,
    type CalendarCountry,
} from '../lib/economyCalendarConstants';
import { INDICATOR_NAME_KO } from '../lib/indicatorNameKo';

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
 * LLM 번역 1회와 DB 행 1개가 생긴다. 화면 캘린더 창에 실제로 있는 이벤트의
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
