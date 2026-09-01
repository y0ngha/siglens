import { extractProse } from '../lib/proseFields';

/**
 * **분석 타입별로 산문이 실제로 뽑히는지** 검증한다.
 *
 * 기존 테스트는 `OverallAnalysisResponse` 모양(전부 `*Ko` 접미사)만 썼고,
 * "산문이 없으면 원본을 그대로 돌려준다"를 정상 동작으로 고정하고 있었다.
 * 그런데 `technical`·`options`·`briefing`·`macroBriefing`은 접미사를 쓰지 않아
 * 바로 그 빈-산문 경로를 탔고, 결과적으로 **9개 분석 화면 중 4개**(가장 트래픽이
 * 많은 종목 메인 포함)에서 번역이 통째로 no-op이었다. 픽스처가 타입을 덮지
 * 않으면 이 클래스는 영원히 초록이다.
 */
describe('분석 타입별 산문 추출', () => {
    /**
     * ⚠️ 픽스처는 **core 0.48.0의 실제 타입 모양**이어야 한다.
     *
     * 처음 쓴 픽스처는 최상위 `signals`/`strategies`를 지어냈는데, 실제로는
     * `indicatorResults[].signals[]`·`strategyResults[]`이고 `keyLevels`는
     * `{ support[], resistance[], poc }`, `priceTargets`는
     * `{ bullish, bearish }` 컨테이너다. 모양이 다르면 화이트리스트에서
     * 필드를 빼도 테스트가 초록이라 — 실측으로 확인했다 — 이 클래스를 전혀
     * 지키지 못한다.
     */
    it('technical: 실제 응답 모양의 산문을 빠짐없이 뽑는다', () => {
        const paths = extractProse({
            summary: '전반적으로 상승 우위입니다.',
            trend: 'bullish',
            riskLevel: 'medium',
            indicatorResults: [
                {
                    indicatorName: 'RSI',
                    signals: [{ description: 'RSI가 과매도 구간입니다.' }],
                },
            ],
            keyLevels: {
                support: [
                    { price: 190, reason: '20일선이 지지로 작동했습니다.' },
                ],
                resistance: [{ price: 210, reason: '전고점 부근입니다.' }],
                poc: { price: 200, reason: '거래량 집중 구간입니다.' },
            },
            priceTargets: {
                bullish: {
                    condition: '200달러를 종가로 상회하면',
                    targets: [{ price: 220, basis: '피보나치 1.618 확장.' }],
                },
                bearish: null,
            },
            patternSummaries: [
                {
                    id: 'p1',
                    patternName: 'hammer',
                    summary: '망치형입니다.',
                    // core 프롬프트가 이 라벨을 한국어로 강제한다.
                    keyPrices: [{ label: '넥라인', price: 200 }],
                },
            ],
            strategyResults: [
                {
                    id: 's1',
                    strategyName: 'MACD',
                    summary: '골든크로스입니다.',
                },
            ],
            candlePatterns: [
                { id: 'c1', patternName: 'doji', summary: '도지입니다.' },
            ],
            actionRecommendation: {
                positionAnalysis: '현재가는 저항 아래입니다.',
                entry: '190달러 근처 분할 진입.',
                exit: '210달러 익절, 180달러 손절.',
                riskReward: '손익비 2.1입니다.',
                reconciledLevels: {
                    reason: '핵심 레벨과 액션 가격을 맞췄습니다.',
                    exit: '210달러 익절.',
                    riskReward: '손익비 2.0.',
                },
            },
            analyzedAt: '2026-08-20T00:00:00Z',
        }).map(entry => entry.path);

        expect(paths).toEqual(
            expect.arrayContaining([
                'summary',
                'indicatorResults.0.signals.0.description',
                'keyLevels.support.0.reason',
                'keyLevels.resistance.0.reason',
                'keyLevels.poc.reason',
                'priceTargets.bullish.condition',
                'priceTargets.bullish.targets.0.basis',
                'patternSummaries.0.summary',
                'patternSummaries.0.keyPrices.0.label',
                'strategyResults.0.summary',
                'candlePatterns.0.summary',
                'actionRecommendation.positionAnalysis',
                'actionRecommendation.entry',
                'actionRecommendation.exit',
                'actionRecommendation.riskReward',
                'actionRecommendation.reconciledLevels.reason',
                'actionRecommendation.reconciledLevels.exit',
                'actionRecommendation.reconciledLevels.riskReward',
            ])
        );
        // 식별자·이름·enum·날짜는 번역 대상이 아니다.
        for (const excluded of [
            'trend',
            'riskLevel',
            'analyzedAt',
            'indicatorResults.0.indicatorName',
            'strategyResults.0.strategyName',
            'patternSummaries.0.patternName',
            'patternSummaries.0.keyPrices.0.price',
            'strategyResults.0.id',
        ]) {
            expect(paths).not.toContain(excluded);
        }
    });

    it('options: summary·만기별 commentary·signal message', () => {
        const paths = extractProse({
            summary: '콜 우위입니다.',
            perExpiration: [
                {
                    expirationDate: '2026-09-19',
                    commentary: '단기 변동성 확대.',
                },
            ],
            signals: [{ message: '풋/콜 비율이 낮습니다.' }],
            analyzedAt: '2026-08-20T00:00:00Z',
        }).map(entry => entry.path);

        expect(paths).toEqual([
            'summary',
            'perExpiration.0.commentary',
            'signals.0.message',
        ]);
        // 날짜는 번역 대상이 아니다.
        expect(paths).not.toContain('perExpiration.0.expirationDate');
        expect(paths).not.toContain('analyzedAt');
    });

    it('briefing: summary·테마·섹터 설명·변동성 설명·리스크 심리', () => {
        const paths = extractProse({
            summary: '위험선호가 우세합니다.',
            dominantThemes: ['AI 반도체', '금리 인하 기대'],
            sectorAnalysis: {
                // core 0.48.0부터 **티커가 아니라 한국어 표시명**이다.
                leadingSectors: ['기술'],
                laggingSectors: ['에너지'],
                performanceDescription: '기술주가 시장을 이끌었습니다.',
            },
            volatilityAnalysis: { description: 'VIX가 낮습니다.' },
            riskSentiment: '위험선호',
        }).map(entry => entry.path);

        expect(paths).toEqual(
            expect.arrayContaining([
                'summary',
                'dominantThemes.0',
                'sectorAnalysis.performanceDescription',
                'volatilityAnalysis.description',
                'riskSentiment',
            ])
        );
        /**
         * 섹터명은 **번역 대상이 아니다** — 화면단(`BriefingCard`)이 화이트리스트
         * 대조 후 심볼로 카탈로그를 찾아 표시한다. 여기서 LLM 번역을 태우면
         * `knownSectors`의 `koreanName` 대조가 전부 실패해 섹터 행이 통째로 사라진다.
         */
        expect(paths).not.toContain('sectorAnalysis.leadingSectors.0');
        expect(paths).not.toContain('sectorAnalysis.laggingSectors.0');
    });

    it('macroBriefing: summary·highlights', () => {
        const paths = extractProse({
            summary: '연착륙 국면입니다.',
            highlights: ['고용이 견조합니다.', '물가가 둔화됐습니다.'],
        }).map(entry => entry.path);

        expect(paths).toEqual(['summary', 'highlights.0', 'highlights.1']);
    });

    it('*Ko 접미사 규약도 그대로 동작한다', () => {
        expect(
            extractProse({ headlineKo: '요약입니다.', ticker: 'AAPL' }).map(
                entry => entry.path
            )
        ).toEqual(['headlineKo']);
    });
});

/**
 * 에러 봉투는 번역하지 않는다.
 *
 * 액션 실패는 `{ status: 'error', error: { code, message } }`로 온다. `message`가
 * 산문 화이트리스트에 있어 그대로 두면 **게이트 거부 문구를 LLM에 보낸다** —
 * 거부마다 왕복이 붙고 "쉽게 쓴 에러 메시지"가 만들어진다.
 *
 * 라우트의 조기 반환(`withPlainLanguage`의 `status === 'error'` 분기)이 그걸
 * 막는데, 그 분기에는 테스트가 전혀 없었다 — 가드를 지워도 10,516개가 전부
 * 초록이었다(실측). 여기서 **추출 단계의 사실**을 고정해 왜 그 분기가 필요한지
 * 못 박는다. 분기 자체의 존재는 `localeWire.test.ts`가 소스로 고정한다.
 */
describe('에러 봉투와 산문 추출', () => {
    it('에러 봉투의 message는 산문으로 잡힌다 — 그래서 라우트가 걸러야 한다', () => {
        const paths = extractProse({
            status: 'error',
            error: { code: 'invalid_model', message: '알 수 없는 모델입니다.' },
        }).map(entry => entry.path);

        // 잡힌다는 사실 자체가 라우트 조기 반환의 존재 이유다.
        expect(paths).toEqual(['error.message']);
    });

    it('정상 결과는 그대로 산문을 내놓는다(대조군)', () => {
        expect(
            extractProse({ status: 'done', summary: '상승 우위입니다.' }).map(
                entry => entry.path
            )
        ).toEqual(['summary']);
    });
});
