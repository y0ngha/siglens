import type { SkillCounts, SkillType } from '@y0ngha/siglens-core';

/** `shared.lib.skillStats.count`의 서브키 — 'total' 또는 SkillType. */
type SkillStatKey = SkillType | 'total';

export interface SkillStat {
    key: SkillStatKey;
    value: number;
}

// SKILL_TYPE_ORDER 키는 SkillType과 exhaustiveness가 맞아야 한다 — 새
// SkillType이 core에 추가되면 여기서 컴파일 에러로 잡힌다.
const SKILL_TYPE_ORDER = {
    indicator_guide: true,
    pattern: true,
    strategy: true,
    candlestick: true,
    support_resistance: true,
} satisfies Record<SkillType, true>;

const SKILL_TYPES = Object.keys(SKILL_TYPE_ORDER) as SkillType[];

/**
 * 분석 화면이 차트 분석에 쓴다고 말하는 스킬의 총수 — 보조지표·캔들·차트 패턴·전략·지지/저항.
 *
 * 홈 StatsBar, 종목 페이지의 분석 진행 문구, 가입 업셀이 **모두 이 값 하나**를 쓴다. 예전에는
 * 세 곳이 서로 다른 수(StatsBar 98 = 펀더멘털·뉴스 스킬까지 센 값, 업셀 32 = 패턴+전략뿐,
 * 진행 문구 "60개 이상" = 상수)를 말했다. 펀더멘털·뉴스는 차트 분석 스킬이 아니라서
 * 뺀다. 입력은 `countSkillFiles()`(frontmatter `type` 기준) 결과다.
 */
export function chartSkillTotal(counts: SkillCounts): number {
    return (
        counts.indicators +
        counts.candlesticks +
        counts.patterns +
        counts.strategies +
        counts.supportResistance
    );
}

const COUNT_BY_TYPE = {
    indicator_guide: counts => counts.indicators,
    pattern: counts => counts.patterns,
    strategy: counts => counts.strategies,
    candlestick: counts => counts.candlesticks,
    support_resistance: counts => counts.supportResistance,
} satisfies Record<SkillType, (counts: SkillCounts) => number>;

export function buildSkillStats(counts: SkillCounts): SkillStat[] {
    return [
        { key: 'total', value: chartSkillTotal(counts) },
        ...SKILL_TYPES.map(type => ({
            key: type,
            value: COUNT_BY_TYPE[type](counts),
        })),
    ];
}
