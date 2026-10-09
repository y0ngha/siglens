'use client';

import { useEffect } from 'react';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { postBeacon, sendOnHumanInteraction } from '@/shared/lib/beacon';

/** 오늘(KST) 이미 보낸 심볼 목록. 날짜가 바뀌면 버린다. */
const STORAGE_KEY = 'siglens:symbol-views';

interface SentToday {
    date: string;
    symbols: string[];
}

function isSentToday(value: unknown): value is SentToday {
    if (typeof value !== 'object' || value === null) return false;
    const { date, symbols } = value as Partial<SentToday>;
    return typeof date === 'string' && Array.isArray(symbols);
}

function readSent(today: string): string[] {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return [];
        const parsed: unknown = JSON.parse(raw);
        return isSentToday(parsed) && parsed.date === today
            ? parsed.symbols
            : [];
    } catch {
        // 프라이빗 모드·깨진 값 — 보낸다. 중복은 임계값이 흡수한다.
        return [];
    }
}

function sendView(symbol: string): void {
    const today = kstDateKey(new Date());
    if (readSent(today).includes(symbol)) return;

    postBeacon({
        url: '/api/presence/symbol',
        body: { symbol },
        onDelivered: () => {
            // 쓰기 직전에 다시 읽는다 — 다른 탭이 그사이 덧붙였을 수 있다.
            const next: SentToday = {
                date: today,
                symbols: [...readSent(today), symbol],
            };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        },
    });
}

interface SymbolViewPingProps {
    symbol: string;
}

/**
 * 종목 페이지 조회를 종목당 하루 한 번 알린다. 인기 목록 스크립트의 추가 후보 신호다.
 *
 * `VisitorPing`과 같은 봇 필터(`sendOnHumanInteraction`)를 쓴다: `navigator.webdriver`
 * 차단 + 첫 신뢰 입력 게이트. `@/entities/symbol-view/api`는 `server-only`라
 * import하지 않는다 — 이 컴포넌트는 URL만 안다.
 */
export function SymbolViewPing({ symbol }: SymbolViewPingProps): null {
    useEffect(() => sendOnHumanInteraction(() => sendView(symbol)), [symbol]);

    return null;
}
