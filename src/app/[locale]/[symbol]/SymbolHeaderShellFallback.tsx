'use client';

import { SymbolTabsSkeleton } from '@/views/symbol/SymbolTabsSkeleton';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';

/**
 * 종목 진입 골격(`SymbolEntrySkeleton`)의 헤더 자리 — `SymbolLayoutHeader`의 바깥 모양을 그대로 본뜬
 * 정적 셸이다. 콜드 로드의 첫 페인트라 사용자가 실제로 보는 화면이고, 이 셸에서 실제 헤더로 바뀔 때
 * 튀지 않게 하는 것이 존재 이유다.
 *
 * - **폭 구조가 같아야 한다.** 폭 규약이 갈리면 셸 자신의 브레드크럼과 탭이 어긋나고 전환 때 그만큼
 *   튄다. 현재 규약은 전폭 `px-4`다(근거는 `SymbolLayoutHeader` JSDoc).
 * - **행 구조가 같아야 한다.** 행 수가 다르면 전환 순간 세로로 밀린다. 지금은 양쪽 다 어느 폭에서든 한
 *   행이다 — 차트 라우트는 첫 뷰포트 세로 예산이 빠듯해 헤더가 커지면 그만큼 캔들이 줄어든다. 좁은
 *   화면에서 종목명이 잘리는 것은 감수했다(탭마다 본문 h1이 전체 이름을 갖는다). 컨트롤 크기(size-11)도 같다.
 * - 컨트롤은 **3개**다 — [☆ 관심종목][공유][설정]. 실제 헤더의 평단 칩은 회원 전용이라 게스트에겐
 *   렌더되지 않아 자리를 두지 않는다(클러스터가 우측 정렬이라 개수가 달라도 나머지 x는 안 밀린다). ☆는
 *   회원·게스트 모두에게 하이드레이션 전부터 같은 크기로 그려져 자리를 둔다.
 */
export function SymbolHeaderShellFallback() {
    // 클라이언트 그래프(`SymbolEntrySkeleton`)에서만 그려져 컨텍스트 로케일을 읽는다 —
    // 실제 헤더의 홈 마디(`brandName(locale)`)와 글자가 같아야 전환 때 폭이 튀지 않는다.
    const locale = useCurrentLocale();
    return (
        <header className="py-3" aria-hidden="true">
            <div className="flex items-center gap-2 px-4 sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {/* 실제 헤더처럼 모바일(sm 미만)에서는 브레드크럼을 감춘다. */}
                    <span className="hidden font-mono text-xs tracking-[0.2em] text-secondary-500 uppercase sm:inline">
                        {brandName(locale)}
                    </span>
                    <span className="hidden text-secondary-500 sm:inline">
                        /
                    </span>
                    <span className="inline-block h-7 w-32 animate-pulse rounded bg-secondary-700" />
                    {/* 실제 헤더는 이 자리에 데스크톱용 FearGreedHeaderChip을
                        인라인으로 둔다(모바일 인스턴스는 아래 행). 스냅샷이
                        null이어도 "공포·탐욕 데이터 부족" 칩을 렌더하므로 이
                        자리는 항상 채워진다. */}
                    <span className="hidden h-5 w-20 animate-pulse rounded bg-secondary-700 sm:inline-block" />
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                    <span className="inline-block h-6 w-16 animate-pulse rounded bg-secondary-700 sm:hidden" />
                    <div className="flex items-center gap-2">
                        <span className="inline-block size-11 animate-pulse rounded-lg bg-secondary-700" />
                        <span className="inline-block size-11 animate-pulse rounded-lg bg-secondary-700" />
                        <span className="inline-block size-11 animate-pulse rounded-lg bg-secondary-700" />
                    </div>
                </div>
            </div>
            <div className="mt-3">
                <SymbolTabsSkeleton />
            </div>
        </header>
    );
}
