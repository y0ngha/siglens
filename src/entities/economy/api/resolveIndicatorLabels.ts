import 'server-only';
import { unstable_cache } from 'next/cache';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleIndicatorTranslationRepository } from './indicatorTranslationRepository';
import { ensureIndicatorTranslatedAction } from '../actions/ensureIndicatorTranslatedAction';
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
 * 미매핑 base 이름들의 DB 캐시 행을 읽는다. ISR cold-gen 안전: `@neondatabase/serverless`
 * HTTP는 no-store라 static generate가 `DYNAMIC_SERVER_USAGE`를 throw하므로 `unstable_cache`로
 * 감싼다(src/app/CLAUDE.md 4축 축1). revalidate=24h + `economy:indicator-translation` 태그로
 * `ensureIndicatorTranslatedAction`이 on-demand 무효화 가능. DB 실패 시 빈 맵으로 graceful.
 *
 * 캐시 키에 정렬된 이름 목록을 박아 입력이 바뀌면 자연히 리프레시된다.
 */
async function readDbMap(
    unknownNames: string[]
): Promise<Record<string, string>> {
    if (unknownNames.length === 0) return {};
    const sorted = [...unknownNames].toSorted((a, b) => a.localeCompare(b));
    return unstable_cache(
        async () => {
            try {
                const { db } = getDatabaseClient();
                const repo = new DrizzleIndicatorTranslationRepository(db);
                const rows = await repo.findByNames(sorted);
                return Object.fromEntries(
                    rows.map(r => [r.normalizedName, r.koreanName])
                );
            } catch (error) {
                console.error(
                    '[resolveIndicatorLabels] DB read failed:',
                    error
                );
                return {};
            }
        },
        ['economy-indicator-translation', sorted.join('|')],
        {
            revalidate: INDICATOR_TRANSLATION_REVALIDATE_SECONDS,
            tags: [INDICATOR_TRANSLATION_CACHE_TAG],
        }
    )();
}

/**
 * 이벤트들의 raw 지표명을 표시 레이블(한국어 우선, 영어 fallback)로 매핑한 레코드를
 * 반환한다(키 = raw event명). dict-known은 즉시, 미매핑은 DB 캐시 룩업, 둘 다 miss면
 * 영어 fallback + fire-and-forget AI 트리거(다음 렌더 캐시 시드, 봇 포함).
 *
 * 그리드(client)는 이 순수 레이블 맵만 받아 표시한다 — server-only 의존성 누출 없음.
 */
export async function resolveIndicatorLabels(
    events: readonly EconomicCalendarEvent[]
): Promise<Record<string, string>> {
    const distinctRaw = [...new Set(events.map(e => e.event))];
    const baseByRaw = new Map(
        distinctRaw.map(raw => [raw, normalizeIndicatorName(raw).base])
    );

    const distinctBases = [...new Set(baseByRaw.values())];
    const unknownBases = distinctBases.filter(
        base => !(base in INDICATOR_NAME_KO)
    );

    const dbMap = await readDbMap(unknownBases);

    // 여전히 미해결인(dict X, DB X) base에 대해서만 AI 번역을 트리거 — 각 1회.
    for (const base of unknownBases) {
        if (!(base in dbMap)) {
            void ensureIndicatorTranslatedAction(base).catch((e: unknown) => {
                console.error(
                    '[resolveIndicatorLabels] ensureIndicatorTranslatedAction failed:',
                    e
                );
            });
        }
    }

    return Object.fromEntries(
        distinctRaw.map(raw => [raw, indicatorLabelKoFromMaps(raw, dbMap)])
    );
}
