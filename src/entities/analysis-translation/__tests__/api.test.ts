const { mockCall, mockGet, mockSet, mockConfig } = vi.hoisted(() => ({
    mockCall: vi.fn(),
    mockGet: vi.fn(),
    mockSet: vi.fn(),
    mockConfig: vi.fn(),
}));
vi.mock('@y0ngha/siglens-core', () => ({
    createCacheProvider: () => ({ get: mockGet, set: mockSet }),
}));
vi.mock('@/entities/llm-provider', () => ({
    callDeepseekChat: mockCall,
    parseJsonResponse: (text: string) => JSON.parse(text),
}));
vi.mock('@/entities/ticker', () => ({
    tryReadTranslatorConfig: mockConfig,
}));

import { translateAnalysisForLocale } from '../api';

const ANALYSIS = {
    headlineKo: '상승 추세입니다',
    riskFactorsKo: ['금리'],
    sentiment: 'bullish',
    confidence: 0.9,
};

describe('translateAnalysisForLocale', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockResolvedValue(null);
        mockSet.mockResolvedValue(undefined);
        mockConfig.mockReturnValue({ apiKey: 'k', model: 'deepseek-v4-flash' });
    });

    it('기본 로케일은 모델을 부르지 않고 원본을 돌려준다', async () => {
        expect(await translateAnalysisForLocale(ANALYSIS, 'ko')).toBe(ANALYSIS);
        expect(mockCall).not.toHaveBeenCalled();
    });

    it('산문만 번역하고 숫자·enum은 그대로 둔다', async () => {
        mockCall.mockResolvedValue('["Uptrend","Rates"]');
        const out = await translateAnalysisForLocale(ANALYSIS, 'en');
        expect(out.headlineKo).toBe('Uptrend');
        expect(out.riskFactorsKo).toEqual(['Rates']);
        expect(out.sentiment).toBe('bullish');
        expect(out.confidence).toBe(0.9);
    });

    it('캐시에 있으면 모델을 부르지 않는다', async () => {
        mockGet.mockResolvedValue(['Uptrend', 'Rates']);
        const out = await translateAnalysisForLocale(ANALYSIS, 'ja');
        expect(mockCall).not.toHaveBeenCalled();
        expect(out.headlineKo).toBe('Uptrend');
    });

    /** 부분 적용은 한 화면에 두 언어가 섞이는 최악의 상태다. */
    it('개수가 어긋나면 원본을 돌려주고 캐시에 쓰지 않는다', async () => {
        mockCall.mockResolvedValue('["only one"]');
        expect(await translateAnalysisForLocale(ANALYSIS, 'en')).toBe(ANALYSIS);
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('모델이 실패하면 원본을 돌려준다', async () => {
        mockCall.mockRejectedValue(new Error('boom'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(await translateAnalysisForLocale(ANALYSIS, 'zh')).toBe(ANALYSIS);
        // 조용히 삼키면 비-ko 전원이 한국어로 되돌아가는데 화면엔 아무 신호가 없다.
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('번역기 설정이 없으면 원본을 돌려준다', async () => {
        mockConfig.mockReturnValue(null);
        expect(await translateAnalysisForLocale(ANALYSIS, 'en')).toBe(ANALYSIS);
        expect(mockCall).not.toHaveBeenCalled();
    });

    /** 같은 문장이면 어느 분석에서 왔든 번역이 같다 — 내용 주소화 캐시. */
    it('캐시 키는 원문과 로케일에만 의존한다', async () => {
        mockCall.mockResolvedValue('["Uptrend","Rates"]');
        await translateAnalysisForLocale(ANALYSIS, 'en');
        await translateAnalysisForLocale(
            { ...ANALYSIS, sentiment: 'bearish' },
            'en'
        );
        // 두 번째 쓰기가 사라지는 순간 `?? [keyA]` 폴백이 단언을 항등식으로
        // 만들어 조용히 통과했다. 호출 횟수를 먼저 못박아 반증 가능하게 둔다.
        expect(mockSet).toHaveBeenCalledTimes(2);
        const [keyA] = mockSet.mock.calls[0]!;
        const [keyB] = mockSet.mock.calls[1]!;
        expect(keyB).toBe(keyA);
    });
});
