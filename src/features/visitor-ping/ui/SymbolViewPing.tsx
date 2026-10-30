'use client';

import { useEffect } from 'react';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { postBeacon, sendOnHumanInteraction } from '@/shared/lib/beacon';
import {
    SYMBOL_VIEWS_STORAGE_KEY,
    parseSentSymbols,
    serializeSentSymbols,
} from '../lib/sentSymbols';

/** 오늘 보낸 심볼 목록. 프라이빗 모드처럼 저장소를 못 읽으면 빈 목록 — 한 번 더 보낼 뿐이다. */
function readSent(today: string): string[] {
    try {
        return parseSentSymbols(
            window.localStorage.getItem(SYMBOL_VIEWS_STORAGE_KEY),
            today
        );
    } catch {
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
            window.localStorage.setItem(
                SYMBOL_VIEWS_STORAGE_KEY,
                serializeSentSymbols(today, readSent(today), symbol)
            );
        },
    });
}

/** 종목 레이아웃(`[symbol]/layout.tsx`)이 라우트에서 넘기는 값. */
interface SymbolViewPingProps {
    /** 하루에 한 번만 보내도록 중복을 거르는 키. 라우트가 정규화한 티커를 그대로 쓴다. */
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
