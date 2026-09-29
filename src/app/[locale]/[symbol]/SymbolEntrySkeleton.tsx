'use client';

import { SymbolLayoutJail } from './SymbolLayoutClient';
import { SymbolHeaderShellFallback } from './SymbolHeaderShellFallback';

/**
 * 다른 페이지에서 종목으로 들어가는 순간 루트 page slot에 그리는 골격 — 실제
 * `[symbol]` 레이아웃(헤더·탭 + 차트 영역)과 같은 틀이라 도착 때 튀지 않는다.
 *
 * `'use client'`인 이유: 루트 레이아웃이 모든 라우트에서 이 요소를 슬롯의 prop으로
 * 넘긴다. 서버 컴포넌트면 골격 마크업이 **전 라우트 RSC 페이로드에 직렬화**되고,
 * 클라이언트 컴포넌트면 모듈 참조 하나만 실린다.
 *
 * 번역 문구를 쓰지 않는다. 루트의 클라이언트 메시지는 크롬 네임스페이스만 싣고
 * (`CHROME_CLIENT_PATHS`), 종목 라우트 메시지는 도착한 뒤에야 내려온다.
 */
export function SymbolEntrySkeleton() {
    return (
        <SymbolLayoutJail>
            <SymbolHeaderShellFallback />
            <div
                aria-hidden="true"
                className="min-h-0 flex-1 animate-pulse bg-secondary-800/40 motion-reduce:animate-none md:min-h-(--symbol-chart-h)"
            />
        </SymbolLayoutJail>
    );
}
