import type { SignalType } from '@y0ngha/siglens-core';
import type { GuideCategory } from '@/entities/guide/types';

/** 신호별 종목 페이지(`/market/signals/[slug]`) 하나. */
export interface SignalHub {
    /** URL 조각. 사람이 검색하는 이름에 맞춘 영문 kebab-case. */
    readonly slug: string;
    readonly signalType: SignalType;
    /** 신호 설명을 빌려 올 가이드 항목 — 제목·요약·링크(4개 로케일 번역이 이미 있다). */
    readonly guide: { readonly category: GuideCategory; readonly slug: string };
    /**
     * 소개 문단 뒤에 한 줄 정의를 붙일 신호 페이지만 가진다. 값은 `app.market.signalHub`의 명시 키라
     * 번역 추출기가 두 키를 모두 읽는다(슬러그 분기 없음).
     */
    readonly definitionKey?: 'definitionGoldenCross' | 'definitionDeathCross';
}

/**
 * 페이지를 여는 신호. 기준은 **이름으로 검색되는 신호**다 — 2026-11-15 네이버 검색 자동완성
 * (`https://ac.search.naver.com/nx/ac?q=<검색어>&st=100`의 응답 `items`)에서 "골든크로스 종목"·
 * "52주 신고가 종목"은 자동완성이 붙었고 "RSI 과매도 종목"은 붙지 않았다. 같은 계열(데드크로스·신저가·
 * RSI·MACD 교차)은 묶어서 연다. CCI·CMF 교차처럼 하루 수십 종목이 잡히지만 그 이름으로 찾는 사람이
 * 드문 신호는 열지 않는다(얇고 겹치는 페이지가 늘어난다). 늘릴 때는 같은 요청으로 "<신호> 종목"을
 * 넣어 자동완성이 붙는지 다시 확인한다.
 */
export const SIGNAL_HUBS: readonly SignalHub[] = [
    {
        slug: 'golden-cross',
        signalType: 'golden_cross',
        guide: { category: 'indicators', slug: 'ma' },
        definitionKey: 'definitionGoldenCross',
    },
    {
        slug: 'death-cross',
        signalType: 'death_cross',
        guide: { category: 'indicators', slug: 'ma' },
        definitionKey: 'definitionDeathCross',
    },
    {
        slug: '52-week-high',
        signalType: 'new_52w_high',
        guide: { category: 'strategies', slug: '52-week-high-momentum' },
    },
    {
        slug: '52-week-low',
        signalType: 'new_52w_low',
        guide: { category: 'strategies', slug: '52-week-high-momentum' },
    },
    {
        slug: 'rsi-oversold',
        signalType: 'rsi_oversold',
        guide: { category: 'indicators', slug: 'rsi' },
    },
    {
        slug: 'rsi-overbought',
        signalType: 'rsi_overbought',
        guide: { category: 'indicators', slug: 'rsi' },
    },
    {
        slug: 'macd-bullish-cross',
        signalType: 'macd_bullish_cross',
        guide: { category: 'indicators', slug: 'macd' },
    },
    {
        slug: 'macd-bearish-cross',
        signalType: 'macd_bearish_cross',
        guide: { category: 'indicators', slug: 'macd' },
    },
];

/** 신호 페이지가 보여 주는 기간(일). 사람들이 "최근 골든크로스 종목"으로 찾는 범위에 맞춘다. */
export const SIGNAL_HUB_WINDOW_DAYS = 30;

/**
 * 이만큼의 종목이 모여야 색인한다. 이력이 막 쌓이기 시작한 구간이나 드문 신호는 목록이 한두 줄이라,
 * 그런 페이지를 색인시키면 얇은 페이지(soft 404)로 읽혀 사이트 전체 평가에 해가 된다. 미만이면
 * `noindex,follow`로 두고 사이트맵에서 뺀다 — 페이지 자체는 열어 두어 내부 링크로는 볼 수 있다.
 */
export const SIGNAL_HUB_MIN_INDEXABLE_ROWS = 5;

/**
 * 신호 페이지가 시장마다 그리는 종목 수의 상한 — 가장 최근에 첫 포착된 순이다. 스캔 대상이 S&P 500 +
 * 코스피 200 + 코스닥 150으로 커지면 MACD 교차 같은 신호는 한 페이지에 수백 종목이 잡혀, 페이지 무게와
 * 크롤 예산(색인되지 않는 종목 페이지로 가는 링크 수)이 함께 커진다. 색인 판정·소개 문구의 종목 수는
 * 이 상한과 무관하게 전체 수(`countHubSymbols`)를 쓴다.
 */
export const SIGNAL_HUB_MAX_ROWS_PER_MARKET = 100;

/** 신호 페이지 경로(로케일 접두사 없음 — 링크 컴포넌트·`localizedAbsoluteUrl`이 붙인다). */
export function signalHubPath(slug: string): string {
    return `/market/signals/${slug}`;
}

/** URL 슬러그로 신호 페이지를 찾는다. 목록에 없으면 `null` — 라우트가 404를 낸다. */
export function findSignalHub(slug: string): SignalHub | null {
    return SIGNAL_HUBS.find(hub => hub.slug === slug) ?? null;
}

/** 색인할 만큼 모였는가 — 메타데이터·구조화데이터·사이트맵이 함께 쓰는 단일 판정. */
export function isSignalHubIndexable(rowCount: number): boolean {
    return rowCount >= SIGNAL_HUB_MIN_INDEXABLE_ROWS;
}
