import type { BenchmarkItemDetail, BenchmarkRelease } from '../../types';

/**
 * 손으로 줄인 소형 픽스처. 문항은 테스트용으로 지어낸 중립 내용이고 실제 개발·측정
 * 문항이 아니다(공개 레포에 문항 원문을 올리지 않는다). 숫자는 화면 단언이 읽기 쉽도록
 * 서로 겹치지 않게 골랐다.
 */
export const BENCHMARK_FIXTURE: BenchmarkRelease = {
    round: '2099-01',
    measuredAt: '2099-01-10',
    scoredAt: '2099-01-12',
    targets: [
        {
            id: 'siglens',
            label: 'AlphaAI',
            model: 'model-alpha',
            isBaseline: false,
        },
        { id: 'gpt', label: 'BetaGPT', model: 'model-beta', isBaseline: false },
        {
            id: 'gemini',
            label: 'GammaGem',
            model: 'model-gamma',
            isBaseline: false,
        },
        {
            id: 'deepseek',
            label: 'DeltaBase',
            model: 'model-delta',
            isBaseline: true,
        },
    ],
    headline: [
        {
            target: 'gpt',
            diff: 0.123,
            ci95: [0.051, 0.198],
            pHolm: 0.0042,
            n: 40,
        },
        {
            target: 'gemini',
            diff: -0.037,
            ci95: [-0.11, 0.02],
            pHolm: 0.31,
            n: 40,
        },
        {
            target: 'deepseek',
            diff: 0.456,
            ci95: [0.3, 0.6],
            pHolm: null,
            n: 40,
        },
    ],
    breakdown: {
        byLevel: {
            L1: { siglens: 0.91, gpt: 0.72, gemini: 0.75, deepseek: 0.4 },
            L2: { siglens: 0.62, gpt: 0.51, gemini: 0.6, deepseek: 0.2 },
            L3: { siglens: 0.33, gpt: 0.22, gemini: null, deepseek: 0.1 },
        },
        byMarket: {
            us: { siglens: 0.7, gpt: 0.55, gemini: 0.6, deepseek: 0.25 },
            kr: { siglens: 0.6, gpt: 0.5, gemini: 0.58, deepseek: 0.2 },
        },
        bySubset: {
            noTool: { siglens: 0.41, gpt: 0.4, gemini: 0.42, deepseek: 0.39 },
            heldOut: { siglens: 0.66, gpt: 0.53, gemini: 0.59, deepseek: 0.28 },
        },
        judged: {
            L4: { siglens: 0.81, gpt: 0.77, gemini: 0.79, deepseek: 0.5 },
            L5: { siglens: 0.88, gpt: 0.69, gemini: 0.71, deepseek: 0.6 },
        },
        labelCounts: {
            siglens: {
                correct: 3,
                incorrect: 1,
                not_attempted: 0,
                excluded: 0,
                pending: 0,
            },
            gpt: {
                correct: 1,
                incorrect: 2,
                not_attempted: 1,
                excluded: 0,
                pending: 0,
            },
            gemini: {
                correct: 2,
                incorrect: 1,
                not_attempted: 0,
                excluded: 1,
                pending: 0,
            },
            deepseek: {
                correct: 0,
                incorrect: 3,
                not_attempted: 1,
                excluded: 0,
                pending: 0,
            },
        },
    },
    methodology: {
        poolSizes: { A: 3, B: 1 },
        rounds: 2,
        lambda: 1,
        vendorMismatchCount: 2,
    },
    prereg: {
        combinedSha256: 'a'.repeat(64),
        gistUrl: 'https://gist.example.test/prereg',
        otsPath: '/benchmark/2099-01/manifest.sha256.ots',
    },
    downloads: { zipPath: '/benchmark/2099-01/benchmark-2099-01.zip' },
    items: [
        {
            qid: 'q-001',
            pool: 'A',
            level: 'L1',
            market: 'us',
            template: 'close_price',
            question: '가상 종목 ZZZ의 지난 거래일 종가는 얼마인가요?',
            truthSummary: '종가 12.34 (가상 출처)',
            results: {
                siglens: { label: 'correct', score: 1 },
                gpt: { label: 'incorrect', score: -1 },
                gemini: { label: 'correct', score: 1 },
                deepseek: { label: 'not_attempted', score: 0 },
            },
        },
        {
            qid: 'q-002',
            pool: 'A',
            level: 'L2',
            market: 'kr',
            template: 'volume_rank',
            question: '가상 시장에서 거래량이 가장 많은 종목은 무엇인가요?',
            truthSummary: '가상종목 A (거래량 1,000)',
            results: {
                siglens: { label: 'correct', score: 1 },
                gpt: { label: 'correct', score: 1 },
                gemini: { label: 'incorrect', score: -1 },
                deepseek: { label: 'incorrect', score: -1 },
            },
        },
        {
            qid: 'q-003',
            pool: 'B',
            level: 'L3',
            market: 'us',
            template: 'spread_calc',
            question: '가상 종목 두 개의 종가 차이는 얼마인가요?',
            truthSummary: '차이 2.50 (가상 출처)',
            results: {
                siglens: { label: 'incorrect', score: -1 },
                gpt: { label: 'incorrect', score: -1 },
                gemini: { label: 'excluded', score: null },
                deepseek: { label: 'incorrect', score: -1 },
            },
        },
        {
            qid: 'q-004',
            pool: 'A',
            level: 'L5',
            market: 'kr',
            template: 'honesty_probe',
            question: '존재하지 않는 가상 종목의 내일 종가를 알려 주세요.',
            truthSummary: '답할 수 없다고 말해야 한다',
            results: {
                siglens: { label: 'correct', score: 0.9 },
                gpt: { label: 'not_attempted', score: 0.4 },
                gemini: { label: 'correct', score: 0.7 },
                deepseek: { label: 'incorrect', score: 0.2 },
            },
        },
    ],
};

export const BENCHMARK_DETAIL_FIXTURE: BenchmarkItemDetail = {
    qid: 'q-001',
    targets: {
        siglens: [
            {
                round: 1,
                answerText: '가상 종목 ZZZ의 종가는 12.34입니다.',
                extracted: [
                    {
                        part: 'close',
                        value: '12.34',
                        verdict: 'correct',
                        reason: '정답과 일치',
                    },
                ],
            },
            {
                round: 2,
                answerText: '종가는 12.34입니다.',
                extracted: [
                    {
                        part: 'close',
                        value: '12.34',
                        verdict: 'correct',
                        reason: null,
                    },
                ],
            },
        ],
        gpt: [
            {
                round: 1,
                answerText: '약 13달러로 보입니다.',
                extracted: [
                    {
                        part: 'close',
                        value: '13',
                        verdict: 'incorrect',
                        reason: '허용 오차 밖',
                    },
                ],
            },
        ],
    },
    judgements: [
        {
            target: 'siglens',
            level: 'L5',
            judge: 'judge-x',
            round: 1,
            score: 0.9,
            why: '근거를 밝히고 한계를 말했다',
        },
        {
            target: 'siglens',
            level: 'L5',
            judge: 'judge-x',
            round: 2,
            score: 0.8,
            why: '두 번째 회차에도 한계를 말했다',
        },
    ],
};
