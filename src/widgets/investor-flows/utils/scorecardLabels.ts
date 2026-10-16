import type { InvestorFlowsLabel } from '@y0ngha/siglens-core';

/**
 * 점수표 라벨 → 카탈로그 키(`widgets.investor-flows.label` 네임스페이스 기준 상대 키). 색이 아니라 **글자·기호로도** 방향을
 * 전하기 위한 테이블이다(`DESIGN.md` 문구 규약: 색에만 의미를 싣지 않는다).
 */
export const LABEL_KEY: Record<InvestorFlowsLabel, string> = {
    strong_bullish: 'strongBullish',
    bullish: 'bullish',
    neutral: 'neutral',
    bearish: 'bearish',
    strong_bearish: 'strongBearish',
    insufficient: 'insufficient',
};

/** 색과 별개로 붙는 방향 기호. `insufficient`는 중립과 구분되도록 별도 기호다. */
export const LABEL_MARK: Record<InvestorFlowsLabel, string> = {
    strong_bullish: '▲▲',
    bullish: '▲',
    neutral: '■',
    bearish: '▼',
    strong_bearish: '▼▼',
    insufficient: '–',
};

/** 소형 텍스트 배지 색(`ui-*-text` AA 변형, `DESIGN.md` "AA Text-Variant Tokens"). */
export const LABEL_CLASS: Record<InvestorFlowsLabel, string> = {
    strong_bullish: 'bg-ui-success/10 text-ui-success-text',
    bullish: 'bg-ui-success/10 text-ui-success-text',
    neutral: 'bg-secondary-700 text-secondary-300',
    bearish: 'bg-ui-danger/10 text-ui-danger-text',
    strong_bearish: 'bg-ui-danger/10 text-ui-danger-text',
    insufficient: 'bg-secondary-700 text-secondary-300',
};

/** 초기 수집 중인 축의 기호 — 점수가 없는 `insufficient`(–)와 구분되도록 말줄임표를 쓴다. 색이 아니라 글자·기호로도 전한다. */
export const COLLECTING_MARK = '…';
