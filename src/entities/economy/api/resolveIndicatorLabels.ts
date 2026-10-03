import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import 'server-only';
import { unstable_cache } from 'next/cache';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleIndicatorTranslationRepository } from './indicatorTranslationRepository';
import {
    INDICATOR_NAME_KO,
    indicatorLabelKoFromMaps,
    normalizeIndicatorName,
} from '../lib/indicatorNameKo';
import {
    INDICATOR_TRANSLATION_CACHE_TAG,
    INDICATOR_TRANSLATION_REVALIDATE_SECONDS,
} from '../lib/indicatorTranslationConstants';

/**
 * Module-level `unstable_cache` — ISR cold-gen 안전: DB 쿼리는 drizzle 로거(`noStoreQueryLogger`)의
 * `unstable_noStore`로 static generate에서 `DYNAMIC_SERVER_USAGE`를 throw하므로 `unstable_cache`로
 * 감싼다(src/app/CLAUDE.md 4축 축1). revalidate=24h + `economy:indicator-translation` 태그로
 * `ensureIndicatorTranslatedAction`이 on-demand 무효화 가능.
 *
 * **DB 실패를 여기서 잡지 않는다.** 예전에는 이 콜백 안에서 `{}`로 흡수했는데, 그러면
 * `unstable_cache`가 그 빈 맵을 정상 결과로 저장해 일시 장애 한 번이 24h 동안 영어
 * 레이블로 굳었다(2026-10-01 허브 감사). 던지면 저장을 건너뛰므로, 흡수는 바깥
 * (`readDbMap`)에서 한다 — `cacheNonEmpty`와 같은 원리다.
 *
 * `sortedNames`를 인자로 받아 Next.js가 자동으로 캐시 키에 포함시킨다
 * — 입력이 바뀌면 자연히 리프레시된다. per-call 생성 대신 module-level 호이스트로
 * `getCalendarFromDb`의 module-level 캐시 호이스트 패턴을 미러한다.
 */
const getCachedIndicatorDbMap = unstable_cache(
    async (sortedNames: string[]): Promise<Record<string, string>> => {
        const { db } = getDatabaseClient();
        const repo = new DrizzleIndicatorTranslationRepository(db);
        const rows = await repo.findByNames(sortedNames);
        return Object.fromEntries(
            rows.map(r => [r.normalizedName, r.koreanName])
        );
    },
    ['economy-indicator-translation'],
    {
        revalidate: INDICATOR_TRANSLATION_REVALIDATE_SECONDS,
        tags: [INDICATOR_TRANSLATION_CACHE_TAG],
    }
);

/**
 * 미매핑 base 이름들의 DB 캐시 행을 읽는다.
 * 캐시 키에 정렬된 이름 목록이 인자로 자동 포함되므로 입력이 바뀌면 자연히 리프레시된다.
 */
async function readDbMap(
    unknownNames: string[]
): Promise<Record<string, string>> {
    if (unknownNames.length === 0) return {};
    const sorted = [...unknownNames].toSorted((a, b) => a.localeCompare(b));
    // DB 실패는 영어 fallback으로 graceful — 캐시에는 남지 않는다(위 JSDoc).
    return getCachedIndicatorDbMap(sorted).catch((error: unknown) => {
        console.error('[resolveIndicatorLabels] DB read failed:', error);
        return {};
    });
}

/**
 * 이벤트들의 raw 지표명을 표시 레이블(한국어 우선, 영어 fallback)로 매핑한 레코드를
 * 반환한다(키 = raw event명). dict-known은 즉시, 미매핑은 DB 캐시 룩업, 둘 다 miss면
 * 영어 fallback을 반환한다(결정론적, 사이드 이펙트 없음).
 *
 * 미해결 이름의 AI 번역은 렌더 경로에서 하지 않는다 — RSC prerender/ISR cold-gen에서
 * 고아 프로미스·revalidateTag를 실행하는 렌더 부작용을 피하기 위해서다. 대신 두 곳이
 * 맡는다: 허브 프리웜 크론이 방문 전에 미리 번역하고
 * (`translateUnresolvedCalendarIndicators`), 그래도 남은 이름은 클라이언트 훅
 * (`useIndicatorTranslationTrigger`)이 마운트 시 요청한다.
 *
 * 그리드(client)는 이 순수 레이블 맵만 받아 표시한다 — server-only 의존성 누출 없음.
 */
export async function resolveIndicatorLabels(
    events: readonly EconomicCalendarEvent[],
    locale: Locale
): Promise<Record<string, string>> {
    /**
     * 비-ko는 사전을 타지 않으므로 DB 조회·AI 트리거도 필요 없다 — 원본 영문명을
     * 그대로 돌려준다. 조회를 건너뛰는 게 부수 효과가 아니라 **의도**다.
     */
    if (locale !== DEFAULT_LOCALE) {
        return Object.fromEntries(
            [...new Set(events.map(e => e.event))].map(raw => [raw, raw])
        );
    }
    const distinctRaw = [...new Set(events.map(e => e.event))];
    const baseByRaw = new Map(
        distinctRaw.map(raw => [raw, normalizeIndicatorName(raw).base])
    );

    const distinctBases = [...new Set(baseByRaw.values())];
    const unknownBases = distinctBases.filter(
        base => !Object.hasOwn(INDICATOR_NAME_KO, base)
    );

    const dbMap = await readDbMap(unknownBases);

    return Object.fromEntries(
        distinctRaw.map(raw => [
            raw,
            indicatorLabelKoFromMaps(raw, dbMap, locale),
        ])
    );
}
