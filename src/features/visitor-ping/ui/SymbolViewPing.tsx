'use client';

import { useEffect } from 'react';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { onFirstInteraction } from '@/shared/lib/onFirstInteraction';

/** 오늘(KST) 이미 보낸 심볼 목록. 날짜가 바뀌면 버린다. */
const STORAGE_KEY = 'siglens:symbol-views';

/** VisitorPing과 같은 이유로 짧게 — 화면에 영향 없는 요청이 커넥션을 붙잡지 않게. */
const BEACON_TIMEOUT_MS = 5000;

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

    void fetch('/api/presence/symbol', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol }),
        signal: AbortSignal.timeout(BEACON_TIMEOUT_MS),
    })
        .then(response => {
            if (!response.ok) return;
            try {
                // 쓰기 직전에 다시 읽는다 — 다른 탭이 그사이 덧붙였을 수 있다.
                const next: SentToday = {
                    date: today,
                    symbols: [...readSent(today), symbol],
                };
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // 기록 실패는 다음 로드에서 한 번 더 보내는 것으로 끝난다.
            }
        })
        .catch(() => {
            // 차단기·오프라인·타임아웃. 집계 하나 놓치는 편이 낫다.
        });
}

/**
 * 종목 페이지 조회를 종목당 하루 한 번 알린다. 인기 목록 스크립트의 추가 후보 신호다.
 *
 * `VisitorPing`과 같은 봇 필터를 쓴다: `navigator.webdriver` 차단 + 첫 신뢰 입력
 * 게이트(`onFirstInteraction`). `@/entities/symbol-view` barrel은 `server-only`라
 * import하지 않는다 — 이 컴포넌트는 URL만 안다.
 */
export function SymbolViewPing({ symbol }: { symbol: string }): null {
    useEffect(() => {
        if (navigator.webdriver) return;
        return onFirstInteraction(() => sendView(symbol));
    }, [symbol]);

    return null;
}
