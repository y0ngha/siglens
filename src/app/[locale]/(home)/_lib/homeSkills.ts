import { cache } from 'react';
import type { Skill, SkillCounts } from '@y0ngha/siglens-core';
import { countSkillFiles, loadShowcaseSkills } from '@/entities/skill/api';

/**
 * 스킬 개수를 읽지 못했을 때 홈이 대신 쓰는 값. 히어로 카피와 `StatsBar`가 같은 객체를 받는다.
 */
export const EMPTY_SKILL_COUNTS: SkillCounts = {
    indicators: 0,
    candlesticks: 0,
    patterns: 0,
    strategies: 0,
    supportResistance: 0,
    fundamental: 0,
    news: 0,
};

/**
 * 홈 히어로·`StatsBar`의 스킬 개수. 파일시스템 읽기가 실패하면 0으로 폴백한다 — 던지면 ISR이
 * 빈 응답(0-byte HTML)을 캐시에 박아 다음 재생성까지 홈이 빈 문서로 남는다.
 */
export function loadSkillCounts(): Promise<SkillCounts> {
    return countSkillFiles().catch((error: unknown) => {
        console.error('[Home] countSkillFiles failed:', error);
        return EMPTY_SKILL_COUNTS;
    });
}

/**
 * 홈 쇼케이스 스킬 목록(`_core/` 모델용 요약 제외 — `countSkillFiles`와 같은 기준). 실패하면
 * 빈 목록으로 폴백해 `loadSkillCounts`와 같은 이유로 렌더를 계속한다. 요청 스코프 `cache`라
 * 한 렌더 안에서 여러 번 불러도 한 번만 읽는다.
 */
export const loadShowcase = cache(async (): Promise<Skill[]> => {
    try {
        return await loadShowcaseSkills();
    } catch (error) {
        console.error('[Home] loadShowcaseSkills failed:', error);
        return [];
    }
});
