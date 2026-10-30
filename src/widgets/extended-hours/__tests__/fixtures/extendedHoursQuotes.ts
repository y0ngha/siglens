/**
 * 확장 시세 위젯 테스트가 함께 쓰는 시세 픽스처.
 */
import type { ExtendedHoursQuote } from '@/entities/extended-hours/model';

/** 라이브 프로브 값: AAPL 프리마켓 346.38, 직전 종가 342.96, 07:07:12 ET. */
export const PRE_UP: ExtendedHoursQuote = {
    session: 'pre-market',
    price: 346.38,
    referenceClose: 342.96,
    change: 3.42,
    changePercent: (3.42 / 342.96) * 100,
    tradedAtMs: 1792062432000,
};

/** 애프터마켓 하락: 오늘 종가 350 → 348.25, 16:55 EDT. */
export const AFTER_DOWN: ExtendedHoursQuote = {
    session: 'after-hours',
    price: 348.25,
    referenceClose: 350,
    change: -1.75,
    changePercent: -0.5,
    tradedAtMs: Date.UTC(2026, 9, 15, 20, 55),
};

/** 체결가가 기준 종가와 같다 — 등락 0(보합). */
export const PRE_FLAT: ExtendedHoursQuote = {
    ...PRE_UP,
    price: 342.96,
    change: 0,
    changePercent: 0,
};
