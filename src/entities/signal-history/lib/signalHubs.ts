import type { SignalType } from '@y0ngha/siglens-core';
import type { GuideCategory } from '@/entities/guide/types';

/** 신호별 종목 페이지(`/market/signals/[slug]`) 하나. */
export interface SignalHub {
    /** URL 조각. 사람이 검색하는 이름에 맞춘 영문 kebab-case. */
    readonly slug: string;
    readonly signalType: SignalType;
    /** 신호 설명을 빌려 올 가이드 항목 — 제목·요약·링크(4개 로케일 번역이 이미 있다). */
    readonly guide: { readonly category: GuideCategory; readonly slug: string };
}

/**
 * 페이지를 여는 신호. 기준은 **이름으로 검색되는 신호**다 — 2026-11-15 네이버 자동완성에
 * "골든크로스 종목"·"52주 신고가 종목"이 붙었고, 같은 계열(데드크로스·신저가·RSI·MACD 교차)을 함께
 * 연다. CCI·CMF 교차처럼 하루 수십 종목이 잡히지만 그 이름으로 찾는 사람이 드문 신호는 열지 않는다
 * (얇고 겹치는 페이지가 늘어난다). 늘릴 때는 같은 방법으로 수요를 확인한다.
 */
export const SIGNAL_HUBS: readonly SignalHub[] = [
    {
        slug: 'golden-cross',
        signalType: 'golden_cross',
        guide: { category: 'indicators', slug: 'ma' },
    },
    {
        slug: 'death-cross',
        signalType: 'death_cross',
        guide: { category: 'indicators', slug: 'ma' },
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

export function signalHubPath(slug: string): string {
    return `/market/signals/${slug}`;
}

export function findSignalHub(slug: string): SignalHub | null {
    return SIGNAL_HUBS.find(hub => hub.slug === slug) ?? null;
}

/** 색인할 만큼 모였는가 — 메타데이터·구조화데이터·사이트맵이 함께 쓰는 단일 판정. */
export function isSignalHubIndexable(rowCount: number): boolean {
    return rowCount >= SIGNAL_HUB_MIN_INDEXABLE_ROWS;
}
