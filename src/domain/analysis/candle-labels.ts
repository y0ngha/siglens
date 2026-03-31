import type {
    CandlePattern,
    MultiCandlePattern,
} from '@/domain/analysis/candle';

// ─── Single Candle Pattern Labels ─────────────────────────────────────────────

export const CANDLE_PATTERN_LABELS: Record<CandlePattern, string> = {
    flat: '보합',
    gravestone_doji: '비석형 도지',
    dragonfly_doji: '잠자리형 도지',
    doji: '도지',
    bullish_marubozu: '상승 마루보즈',
    bearish_marubozu: '하락 마루보즈',
    shooting_star: '슈팅스타',
    inverted_hammer: '역망치형',
    hammer: '망치형',
    hanging_man: '교수형',
    bullish_belt_hold: '상승 벨트홀드',
    bearish_belt_hold: '하락 벨트홀드',
    spinning_top: '팽이형',
    bullish: '양봉',
    bearish: '음봉',
};

// ─── Multi Candle Pattern Labels ──────────────────────────────────────────────

export const MULTI_CANDLE_PATTERN_LABELS: Record<MultiCandlePattern, string> = {
    bullish_engulfing: '상승 장악형',
    bullish_harami: '상승 잉태형',
    bullish_harami_cross: '상승 잉태 십자형',
    piercing_line: '관통형',
    bullish_counterattack_line: '상승 반격형',
    morning_star: '샛별형',
    morning_doji_star: '샛별 도지형',
    bullish_abandoned_baby: '상승 버려진 아기형',
    three_white_soldiers: '적삼병',
    three_inside_up: '쓰리 인사이드 업',
    three_outside_up: '쓰리 아웃사이드 업',
    bullish_triple_star: '상승 삼성형',
    ladder_bottom: '사다리 바닥형',
    tweezers_bottom: '집게 바닥형',
    downside_gap_two_rabbits: '하방갭 두 토끼형',
    bearish_engulfing: '하락 장악형',
    bearish_harami: '하락 잉태형',
    bearish_harami_cross: '하락 잉태 십자형',
    dark_cloud_cover: '먹구름형',
    bearish_counterattack_line: '하락 반격형',
    evening_star: '저녁별형',
    evening_doji_star: '저녁 도지 별형',
    bearish_abandoned_baby: '하락 버려진 아기형',
    three_black_crows: '흑삼병',
    three_inside_down: '쓰리 인사이드 다운',
    three_outside_down: '쓰리 아웃사이드 다운',
    bearish_triple_star: '하락 삼성형',
    advance_block: '전진 블록형',
    tweezers_top: '집게 천장형',
    upside_gap_two_crows: '상방갭 두 까마귀형',
    upside_gap_tasuki: '상방갭 타스키형',
    downside_gap_tasuki: '하방갭 타스키형',
    on_neck: '온넥형',
    in_neck: '인넥형',
};

// ─── Label Accessor Functions ─────────────────────────────────────────────────

export function getCandlePatternLabel(pattern: CandlePattern): string {
    return CANDLE_PATTERN_LABELS[pattern];
}

export function getMultiCandlePatternLabel(
    pattern: MultiCandlePattern
): string {
    return MULTI_CANDLE_PATTERN_LABELS[pattern];
}

export function findCandlePatternLabel(patternName: string): string {
    if (patternName in CANDLE_PATTERN_LABELS) {
        return CANDLE_PATTERN_LABELS[patternName as CandlePattern];
    }
    if (patternName in MULTI_CANDLE_PATTERN_LABELS) {
        return MULTI_CANDLE_PATTERN_LABELS[patternName as MultiCandlePattern];
    }
    return patternName;
}
