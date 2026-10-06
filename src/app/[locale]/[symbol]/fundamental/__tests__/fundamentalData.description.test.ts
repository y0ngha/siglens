/**
 * `getProfileDescription`의 `ko` 번역 경로 — 음성 캐시와 요청 사이 single-flight.
 *
 * 2026-10 비용 감사 L5: 번역 실패는 아무것도 남기지 않아 같은 심볼의 다음 SSR마다 같은
 * 번역을 다시 불렀고, 동시에 콜드 렌더된 같은 심볼은 렌더마다 따로 번역했다.
 */
const {
    findBySymbol,
    upsert,
    translate,
    getProfileMock,
    hasFailed,
    markFailed,
    translatorConfig,
} = vi.hoisted(() => ({
    findBySymbol: vi.fn(),
    upsert: vi.fn(),
    translate: vi.fn(),
    getProfileMock: vi.fn(),
    hasFailed: vi.fn(),
    markFailed: vi.fn(),
    translatorConfig: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/config', () => ({
    tryReadTranslatorConfig: () => translatorConfig(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/entities/ticker/api', () => ({
    DrizzleProfileDescriptionTranslationRepository: class {
        findBySymbol = findBySymbol;
        upsert = upsert;
    },
}));
vi.mock('@/entities/ticker/lib/koreanTranslator', () => ({
    translateCompanyDescription: (d: string) => translate(d),
}));
vi.mock('@/entities/ticker/lib/descriptionTranslationFailure', () => ({
    hasDescriptionTranslationFailed: (s: string) => hasFailed(s),
    markDescriptionTranslationFailed: (s: string) => markFailed(s),
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: () => ({ getProfile: getProfileMock }),
}));
vi.mock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return {
        ...actual,
        cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
    };
});

import { getProfileDescription } from '@/app/[locale]/[symbol]/fundamental/fundamentalData';

describe('getProfileDescription (ko 번역)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findBySymbol.mockResolvedValue(null);
        upsert.mockResolvedValue(undefined);
        getProfileMock.mockResolvedValue({ description: 'An apple company.' });
        translate.mockResolvedValue('사과 회사.');
        hasFailed.mockResolvedValue(false);
        markFailed.mockResolvedValue(undefined);
        translatorConfig.mockReturnValue({ apiKey: 'k', model: 'm' });
    });

    it('번역기가 미설정이면 번역도 실패 표시도 하지 않는다 (설정 문제는 실패가 아니다)', async () => {
        translatorConfig.mockReturnValue(null);
        expect(await getProfileDescription('AAPL', 'ko')).toBeNull();
        expect(translate).not.toHaveBeenCalled();
        expect(markFailed).not.toHaveBeenCalled();
    });

    it('번역에 성공하면 저장하고 실패 표시를 남기지 않는다', async () => {
        expect(await getProfileDescription('AAPL', 'ko')).toBe('사과 회사.');
        expect(upsert).toHaveBeenCalledWith({
            symbol: 'AAPL',
            descriptionKo: '사과 회사.',
        });
        expect(markFailed).not.toHaveBeenCalled();
    });

    it('번역이 실패하면(null) 실패를 표시하고 저장하지 않는다', async () => {
        translate.mockResolvedValue(null);
        expect(await getProfileDescription('AAPL', 'ko')).toBeNull();
        expect(markFailed).toHaveBeenCalledWith('AAPL');
        expect(upsert).not.toHaveBeenCalled();
    });

    it('실패 표시가 있으면 번역을 부르지 않는다', async () => {
        hasFailed.mockResolvedValue(true);
        expect(await getProfileDescription('AAPL', 'ko')).toBeNull();
        expect(translate).not.toHaveBeenCalled();
        expect(getProfileMock).not.toHaveBeenCalled();
    });

    it('원문 설명이 없으면 번역도 실패 표시도 하지 않는다', async () => {
        getProfileMock.mockResolvedValue({ description: null });
        expect(await getProfileDescription('AAPL', 'ko')).toBeNull();
        expect(translate).not.toHaveBeenCalled();
        expect(markFailed).not.toHaveBeenCalled();
    });

    it('이미 저장된 번역이 있으면 음성 캐시를 보지도 않는다', async () => {
        findBySymbol.mockResolvedValue({ descriptionKo: '저장된 설명' });
        expect(await getProfileDescription('AAPL', 'ko')).toBe('저장된 설명');
        expect(hasFailed).not.toHaveBeenCalled();
        expect(translate).not.toHaveBeenCalled();
    });

    it('같은 심볼의 동시 렌더는 번역을 한 번만 부른다', async () => {
        let release: (text: string) => void = () => {};
        translate.mockReturnValue(
            new Promise<string>(resolve => {
                release = resolve;
            })
        );
        const a = getProfileDescription('MSFT', 'ko');
        const b = getProfileDescription('MSFT', 'ko');
        await vi.waitFor(() => expect(translate).toHaveBeenCalledOnce());
        release('마이크로소프트 설명');
        expect(await a).toBe('마이크로소프트 설명');
        expect(await b).toBe('마이크로소프트 설명');
        expect(translate).toHaveBeenCalledOnce();
    });
});
