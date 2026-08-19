import { extractProse, applyProse } from '../lib/proseFields';
import { translateAnalysis } from '../lib/translateAnalysis';

const ANALYSIS = {
    headlineKo: '애플은 상승 추세입니다',
    integratedConclusionKo: '종합적으로 매수 우위입니다',
    riskFactorsKo: ['금리 인상', '실적 둔화'],
    // 아래는 절대 번역되면 안 되는 것들
    sentiment: 'bullish',
    confidence: 0.82,
    keyLevels: { support: 180.5, resistance: 195 },
    scenarios: [
        { name: 'bullish', priceRangeKo: '190~200달러', probability: 0.5 },
    ],
    optionsOiStale: false,
};

describe('extractProse', () => {
    /** `*Ko` 규약을 쓰면 core가 산문 필드를 추가해도 목록을 갱신할 필요가 없다. */
    it('`*Ko` 필드만 뽑는다 — 중첩·배열 포함', () => {
        expect(
            extractProse(ANALYSIS)
                .map(e => e.path)
                .sort()
        ).toEqual([
            'headlineKo',
            'integratedConclusionKo',
            'riskFactorsKo.0',
            'riskFactorsKo.1',
            'scenarios.0.priceRangeKo',
        ]);
    });

    it('빈 문자열은 건너뛴다', () => {
        expect(extractProse({ summaryKo: '   ' })).toEqual([]);
    });
});

describe('translateAnalysis', () => {
    it('산문만 바뀌고 숫자·enum·가격은 그대로다', async () => {
        const result = await translateAnalysis(ANALYSIS, async texts =>
            texts.map(t => `EN:${t}`)
        );
        expect(result.headlineKo).toBe('EN:애플은 상승 추세입니다');
        expect(result.riskFactorsKo).toEqual(['EN:금리 인상', 'EN:실적 둔화']);
        expect(result.scenarios[0]!.priceRangeKo).toBe('EN:190~200달러');
        // 사실관계는 번역 단계에서 바뀔 수 없어야 한다.
        expect(result.sentiment).toBe('bullish');
        expect(result.confidence).toBe(0.82);
        expect(result.keyLevels).toEqual({ support: 180.5, resistance: 195 });
        expect(result.scenarios[0]!.probability).toBe(0.5);
        expect(result.optionsOiStale).toBe(false);
    });

    /** 같은 분석 객체가 여러 로케일로 동시에 렌더될 수 있다. */
    it('원본을 변형하지 않는다', async () => {
        const before = JSON.stringify(ANALYSIS);
        await translateAnalysis(ANALYSIS, async texts => texts.map(() => 'X'));
        expect(JSON.stringify(ANALYSIS)).toBe(before);
    });

    /** 부분 적용은 한 화면에 두 언어가 섞이는 최악의 상태를 만든다. */
    it('번역 개수가 어긋나면 원본을 그대로 돌려준다', async () => {
        const result = await translateAnalysis(ANALYSIS, async () => ['짧음']);
        expect(result).toBe(ANALYSIS);
    });

    it('빈 번역은 원문을 남긴다 — 빈 문단이 화면에 구멍을 만든다', async () => {
        const result = await translateAnalysis(ANALYSIS, async texts =>
            texts.map((t, i) => (i === 0 ? '' : `EN:${t}`))
        );
        expect(result.headlineKo).toBe('애플은 상승 추세입니다');
        expect(result.integratedConclusionKo).toBe(
            'EN:종합적으로 매수 우위입니다'
        );
    });

    it('산문이 없으면 호출 없이 원본을 돌려준다', async () => {
        const translate = vi.fn();
        const input = { sentiment: 'neutral', score: 1 };
        expect(await translateAnalysis(input, translate)).toBe(input);
        expect(translate).not.toHaveBeenCalled();
    });
});

describe('applyProse', () => {
    it('매핑에 없는 경로는 원문을 유지한다', () => {
        const out = applyProse(ANALYSIS, new Map([['headlineKo', 'X']]));
        expect(out.headlineKo).toBe('X');
        expect(out.integratedConclusionKo).toBe('종합적으로 매수 우위입니다');
    });
});
