/** 항목 페이지(`GuideEntryPage`)가 카탈로그에서 끌어오는 값 — 데모 출처와 패턴 제목표. */
import type { GuideEntry } from '@/entities/guide/types';
import { guideEntryPath } from '@/shared/lib/guidePaths';

/**
 * 데모를 그릴 항목. howto는 자기 데모가 없어 `demoFrom`이 가리키는 용어 항목의 데모를 빌린다
 * (캡션은 자기 것). 가리킨 항목이 카탈로그에 없으면 자기 자신이다.
 */
export function resolveDemoSource(
    entry: GuideEntry,
    catalog: readonly GuideEntry[]
): GuideEntry {
    if (entry.demoFrom === null) return entry;
    return catalog.find(item => item.slug === entry.demoFrom) ?? entry;
}

/** 차트 패턴 항목의 가이드 경로 → 제목. 라이브 종목 행이 어떤 패턴에 맞았는지 적는 데 쓴다. */
export function patternTitlesByPath(
    catalog: readonly GuideEntry[]
): Readonly<Record<string, string>> {
    return Object.fromEntries(
        catalog
            .filter(item => item.category === 'chart-patterns')
            .map(item => [guideEntryPath(item.category, item.slug), item.title])
    );
}
