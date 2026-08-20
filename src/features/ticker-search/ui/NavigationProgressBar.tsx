'use client';

/**
 * 종목 이동이 진행 중임을 알리는 상단 진행 바.
 *
 * ## 왜 필요한가 (실측)
 *
 * 검색에서 종목을 고르면 오버레이가 즉시 닫히고 `router.replace`가 뒤에서 돈다.
 * 그런데 그 사이 화면은 **떠나온 종목 그대로**다 — Next가 알아서 전환 상태를
 * 보여주지 않는다:
 *
 * - `app/[symbol]/loading.tsx`는 `[symbol]` **자식 슬롯**을 감싼다. NVDA→AAPL은
 *   `[symbol]` 세그먼트 **자체**가 바뀌므로 서스펜스가 그 경계보다 위에서 일어난다
 *   (`app/[symbol]/layout.tsx`의 기존 주석이 같은 사실을 실측으로 기록해 두었다).
 * - 루트 `app/loading.tsx`도, `layout.tsx`의 `<Suspense>`도 없다. 경계가 없으면
 *   React는 transition 중 옛 UI를 그대로 붙들고 있는다.
 *
 * `/AAPL` RSC는 1.71MB(압축 ~340KB)이고 오버레이 행은 의도적으로 prefetch를 하지
 * 않는다(`SearchResultRow` 참고). 한국 트래픽이 Cloudflare LAX로 라우팅되는 현재
 * (RTT 165ms · 실효 128KB/s) **2~3초**가 걸린다.
 *
 * 그 2~3초 동안 아무 표시가 없으면 "전체화면이 사라졌다 = 취소됐다"로 읽혀 사용자가
 * 다시 누른다. 그래서 **피드백은 주되 아무것도 막지 않는다**.
 *
 * ## 막지 않는다는 것이 핵심이다
 *
 * 한때 오버레이를 열어둔 채 취소를 비활성화했는데 두 가지가 터졌다 — 이동이 멈추면
 * 전체화면 모달에 갇히고(WCAG 2.1.2), 하드웨어 뒤로가기는 JS 가드를 우회한다.
 * 이 바는 순수 표시라 둘 다 구조적으로 불가능하다.
 *
 * (세 번째로 의심했던 "대기 중 뒤로가기 ↔ 늦게 온 응답" 경합은 Next 16.2.12에서
 * 성립하지 않는다 — `SearchOverlay`의 `handleSelect` JSDoc 참고.)
 */
export function NavigationProgressBar() {
    return (
        <div
            role="progressbar"
            aria-label="종목 페이지 이동 중"
            // `progressbar`는 라이브 리전이 **아니다** — 마운트만으로는 아무것도
            // 읽히지 않는다. 한때 같은 요소에 `aria-live`와 sr-only 문구를 얹어
            // 때우려 했는데 그건 동작하지 않는다: `progressbar`는 ARIA의
            // "children presentational" 역할이라 자손이 접근성 트리에서 제거되고,
            // 리전이 읽을 텍스트 자체가 없어진다. 음성 고지는
            // `SearchOverlayProvider`가 **형제**로 둔 `role="status"`가 맡는다.
            // top은 `env(safe-area-inset-top)` 만큼 내린다. 앱은 `viewportFit: 'cover'`
            // + standalone PWA라, 노치 기기에서 `top-0`는 상태바 뒤에 깔린다. 56px
            // 헤더는 일부 가려도 살아남지만 2px 바는 통째로 사라져 유일한 피드백이 없어진다.
            //
            // z-80 — 오버레이(z-70)보다 위. `pointer-events-none`은 이 띠가 헤더 위
            // 2px 구간의 탭을 삼키지 않게 한다.
            className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-80 h-0.5 overflow-hidden bg-primary-900/40"
        >
            {/* motion-reduce에서는 흐르는 애니메이션 대신 정적 막대를 남긴다 —
                움직임이 아니라 "진행 중"이라는 사실이 전달되면 충분하다. */}
            <div className="h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] bg-primary-500 motion-reduce:w-full motion-reduce:animate-none" />
        </div>
    );
}
