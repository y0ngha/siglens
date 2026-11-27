import type { Tier } from '@y0ngha/siglens-core';
import type { ConversationAnalysis } from '@/entities/chat-conversation/server/conversationAnalyses';
import type { Locale } from '@/shared/i18n/locales';
import { guestSubject } from '@/shared/lib/guestSubject';
import { listAsset } from './boundary';
import type { SeriesSpec } from './syntheticMarket';

/**
 * 골든 사례 하나: 도구 이름, 인자, 고정 시각, 호출자, 경계 준비. 사례마다 두 실행기 설정(에이전트·공개 API)으로 돌린
 * 결과가 `golden/<tool>.<name>.json` 한 파일에 담긴다.
 */
export interface GoldenCase {
    tool: string;
    /** 파일 이름에 쓰는 kebab-case. 도구 안에서 고유하다. */
    name: string;
    /** `vi.setSystemTime`에 넣는 시각(ISO). */
    now: string;
    args: Record<string, unknown>;
    /** 기본 `member`. */
    caller?: GoldenCaller;
    /** 기본 `ko`. */
    locale?: Locale;
    /** 이 대화의 이전 턴에 본 일봉 분석(`sinceEarlier`). 에이전트 실행기에만 넘긴다(공개 API는 저장된 대화가 없다). */
    earlierAnalyses?: readonly ConversationAnalysis[];
    /** `ctx.claimWebSearchUnit`(공개 API 경로에는 없다 — 그쪽은 v1 라우트가 따로 센다). */
    webSearchClaim?: 'ok' | 'refused';
    /** `world`·`fakes`를 이 사례에 맞게 준비한다. */
    arrange?: () => void;
}

export type GoldenCaller = 'member' | 'free' | 'pro' | 'guest';

const MEMBER_ID = '6f1d2c3b-4a59-4e7d-9c10-2b3a4c5d6e7f';

export const CALLERS: Readonly<
    Record<GoldenCaller, { userId: string; tier: Tier }>
> = {
    member: { userId: MEMBER_ID, tier: 'member' },
    free: { userId: 'b4e0f8a2-91c3-4d55-8e6f-0a1b2c3d4e5f', tier: 'free' },
    pro: { userId: 'c7d1e9b3-02f4-4a66-9f70-1b2c3d4e5f60', tier: 'pro' },
    guest: { userId: guestSubject('golden-guest-7a1c'), tier: 'free' },
};

/**
 * 고정 시각. 2026-11은 미국 서머타임이 끝난 뒤(ET = UTC-5)이고, `usDst`만 서머타임 안(EDT = UTC-4)이다
 * (TESTING.md#TE-59).
 */
export const CLOCKS = {
    /** 수요일 10:30 ET — 미국 정규장 진행 중(일봉 형성 중). */
    usOpen: '2026-11-18T15:30:00.000Z',
    /** 수요일 17:30 ET — 미국 장 마감 뒤. */
    usClosed: '2026-11-18T22:30:00.000Z',
    /** 토요일 11:00 ET — 주말. */
    weekend: '2026-11-21T16:00:00.000Z',
    /** 목요일 11:00 KST — 한국 정규장 진행 중(미국은 전날 마감 뒤). */
    krSession: '2026-11-19T02:00:00.000Z',
    /** 일요일 03:00 UTC — 크립토만 열려 있다. */
    crypto: '2026-11-22T03:00:00.000Z',
    /** 수요일 10:00 EDT — 서머타임 중 미국 정규장. */
    usDst: '2026-07-15T14:00:00.000Z',
} as const;

/** 합성 종목. 실제 상장 종목과 겹치지 않는 이름만 쓴다. */
export const SYMBOLS = {
    us: 'GLDNX',
    us2: 'QRTZ',
    us3: 'VLMR',
    etf: 'GLDX',
    kr: '900110.KS',
    kr2: '900220.KQ',
    crypto: 'ZETAUSD',
    index: 'GLDIDX',
} as const;

/** 미국 대형주 모양의 합성 종목. 가격대는 저장된 실제 분석 픽스처(약 240달러)에 맞췄다. */
export function listUsStock(over: Partial<SeriesSpec> = {}): void {
    listAsset(
        {
            symbol: SYMBOLS.us,
            name: 'Goldenrod Systems Inc.',
            koreanName: '골든로드 시스템즈',
        },
        {
            base: 92,
            drift: 0.00038,
            seed: 11,
            volume: 48_000_000,
            decimals: 2,
            ...over,
        }
    );
}

export function listSecondUsStock(over: Partial<SeriesSpec> = {}): void {
    listAsset(
        { symbol: SYMBOLS.us2, name: 'Quartzline Holdings' },
        {
            base: 41,
            drift: 0.0005,
            seed: 23,
            volume: 9_500_000,
            decimals: 2,
            ...over,
        }
    );
}

export function listThirdUsStock(over: Partial<SeriesSpec> = {}): void {
    listAsset(
        {
            symbol: SYMBOLS.us3,
            name: 'Velmora Therapeutics',
            koreanName: '벨모라 테라퓨틱스',
        },
        {
            base: 18,
            drift: -0.0002,
            seed: 37,
            volume: 3_200_000,
            decimals: 2,
            ...over,
        }
    );
}

export function listKrStock(over: Partial<SeriesSpec> = {}): void {
    listAsset(
        {
            symbol: SYMBOLS.kr,
            name: 'Hanbit Precision',
            koreanName: '한빛정밀',
            marketProfile: 'kr-equity',
        },
        {
            base: 41_000,
            drift: 0.0004,
            seed: 53,
            volume: 2_100_000,
            decimals: 0,
            ...over,
        }
    );
}

export function listSecondKrStock(over: Partial<SeriesSpec> = {}): void {
    listAsset(
        {
            symbol: SYMBOLS.kr2,
            name: 'Daon Bio',
            koreanName: '다온바이오',
            marketProfile: 'kr-equity',
        },
        {
            base: 12_500,
            drift: 0.0006,
            seed: 61,
            volume: 640_000,
            decimals: 0,
            ...over,
        }
    );
}

export function listCrypto(over: Partial<SeriesSpec> = {}): void {
    listAsset(
        {
            symbol: SYMBOLS.crypto,
            name: 'Zeta Coin USD',
            koreanName: '제타코인',
            marketProfile: 'crypto',
        },
        {
            base: 7_200,
            drift: 0.0011,
            seed: 71,
            volume: 31_000,
            decimals: 2,
            ...over,
        }
    );
}

/** 지수처럼 공급자 심볼이 다른 종목(`resolvedSymbol`). */
export function listIndexLike(over: Partial<SeriesSpec> = {}): void {
    listAsset(
        {
            symbol: SYMBOLS.index,
            name: 'Golden 500 Index',
            fmpSymbol: '^GLD500',
        },
        {
            base: 3_250,
            drift: 0.0004,
            seed: 83,
            volume: 0,
            decimals: 2,
            ...over,
        }
    );
}
