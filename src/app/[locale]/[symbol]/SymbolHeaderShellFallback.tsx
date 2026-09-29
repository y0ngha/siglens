import { SymbolTabsSkeleton } from '@/views/symbol/SymbolTabsSkeleton';

// Static shell mirroring SymbolLayoutHeader's outer shape. Used as the Suspense
// fallback while params resolve and the bars prefetch completes.
//
// 폭 구조도 실제 헤더와 **같아야 한다**. 둘의 폭 규약이 갈리면 폴백 자신의
// 브레드크럼과 탭이 어긋나고(과거 1920px에서 436px), 폴백에서 실제 헤더로
// 넘어갈 때도 그만큼 튄다. 콜드 로드의 첫 페인트라 사용자가 실제로 보는
// 화면이다. 현재 규약은 전폭 `px-4` — 근거는 `SymbolLayoutHeader` JSDoc.
//
// **행 구조도 같아야 한다.** 한쪽만 행 수가 다르면 폴백에서 실제 헤더로 바뀌는
// 순간 세로로 밀린다 — 예전에 폴백이 한 행, 실제가 640px 미만에서 두 행이라
// 109px 대 160px로 갈렸고 전환 시 51px이 튀었다. 폴백의 존재 이유가 바로 그
// 밀림을 막는 것이다.
//
// 지금은 **양쪽 다 어느 폭에서든 한 행**이다. 모바일에서 두 행으로 쌓던 것을
// 없앤 이유는 세로 예산 때문이다 — 차트 라우트는 jail이 첫 뷰포트를 고정하므로
// 헤더가 36px 커지면 그만큼 캔들이 줄어든다(실측: 헤더 160→124px에서 가격
// pane 170→196px). 종목명이 좁은 화면에서 잘리는 것은 감수한 트레이드오프이며,
// 탭마다 본문 h1이 전체 이름을 갖고 있어 정보가 사라지지는 않는다
// (`애플, Apple Inc. (AAPL) 차트 분석` 등 9개 탭 전부 확인).
// 컨트롤 크기(size-11)도 실제 헤더와 같아야 한다.
//
// 컨트롤은 **2개**만 둔다. 실제 헤더의 세 번째 칩(`PortfolioChipMounted`)은
// 회원 전용이라 게스트에겐 아예 렌더되지 않는다(`useCurrentUser` null → null).
// 클러스터가 우측 정렬이라 개수가 달라도 공유·설정 버튼의 x는 안 밀린다
// (375px 실측: 폴백 2·3번이 [263,307]·[315,359], 실제 2개도 같은 좌표).
// 그래서 남는 문제는 "뜬 자리가 사라지느냐 생기느냐"뿐이고, 다수인 게스트
// 기준으로 팬텀이 없는 2개가 맞다 — 회원은 칩 하나가 클러스터 왼쪽에 붙을 뿐
// 나머지 둘은 그대로다.
export function SymbolHeaderShellFallback() {
    return (
        <header className="py-3" aria-hidden="true">
            <div className="flex items-center gap-2 px-4 sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="font-mono text-xs tracking-[0.2em] text-secondary-500 uppercase">
                        SIGLENS
                    </span>
                    <span className="text-secondary-500">/</span>
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
                    </div>
                </div>
            </div>
            <div className="mt-3">
                <SymbolTabsSkeleton />
            </div>
        </header>
    );
}
