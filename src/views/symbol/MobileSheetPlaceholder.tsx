import type { CSSProperties } from 'react';
import { MOBILE_SHEET_PEEK_BAND_SVH } from './constants/mobileSheet';

/**
 * 모바일 바텀시트의 **서버 렌더 껍데기**. 실제 vaul 시트가 마운트되기 전까지만 보인다.
 *
 * ## 왜 필요한가 (2026-08-20 실측)
 *
 * 실제 시트(`MobileAnalysisSheet`)는 `dynamic(..., { ssr: false })`이고
 * `SymbolPageClient`의 `isHydrated && isMobileViewport` 게이트 뒤에 있다. 그래서
 * 초기 번들에 없고, 프리로드도 안 되며, **하이드레이션이 끝나야 비로소 청크를
 * 요청한다**. iPhone 390×844 / CPU 4배 스로틀 실측:
 *
 * ```
 *    392ms  탭 렌더
 *  4,322ms  차트 캔버스
 *  4,593ms  시트 청크 요청 시작   ← 여기까지 화면 하단이 비어 있다
 *  4,783ms  청크 도착 (다운로드는 190ms뿐)
 *  4,947ms  시트 등장
 * ```
 *
 * 네트워크가 아니라 **요청 시작까지의 4.6초**가 병목이다. 이 컴포넌트는 그 구간을
 * 시각적으로 메운다. `SymbolPageClient`는 `useSearchParams`로 CSR-bailout되어
 * SSR HTML에 아무것도 남기지 않으므로(실증: `AI 분석 보기` 문자열이 SSR HTML에 0회),
 * 껍데기는 **반드시 서버 컴포넌트 쪽(app 라우트)에서** 렌더해야 한다.
 *
 * ## 사라지는 방식
 *
 * JS로 걷어내지 않는다. `globals.css`의
 * `body:has([data-vaul-drawer]) [data-mobile-sheet-placeholder] { display: none }`
 * 규칙이 실제 시트가 DOM에 들어오는 순간 CSS만으로 숨긴다. 타이머도 상태도 없어
 * 교체 레이스가 원천적으로 없다. `:has()` 미지원 브라우저에서는 껍데기가 남지만
 * 실제 시트가 `z-50`으로 위에 있고 불투명해 PEEK 위치에서는 가려진다.
 *
 * ## 레이아웃 시프트
 *
 * 껍데기와 실제 시트 모두 `position: fixed`라 문서 흐름 밖이다. 같은 위치에서
 * 교체되므로 CLS에 기여하지 않는다.
 *
 * 장식 전용이라 `aria-hidden`이다 — 하이드레이션 전에는 탭해도 열리지 않으므로
 * 스크린리더에 동작하지 않는 컨트롤을 노출하지 않는다. 실제 시트가 뜨면 그쪽이
 * 접근성 트리를 담당한다.
 */
export function MobileSheetPlaceholder() {
    return (
        <div
            data-mobile-sheet-placeholder=""
            aria-hidden="true"
            // 실제 Drawer.Content와 같은 표면: rounded-t-2xl / border-t / bg / shadow.
            // 높이만 다르다 — 실제 시트는 h-[97svh]를 translateY로 밀어 PEEK 띠만
            // 보이지만, 껍데기는 그 띠 높이를 그대로 갖는다.
            className="fixed inset-x-0 bottom-0 z-40 flex h-(--peek-band) flex-col overflow-hidden rounded-t-2xl border-t border-secondary-700 bg-secondary-900 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.6)] md:hidden"
            // 높이는 상수에서 계산되므로 정적 Tailwind 클래스가 될 수 없다. MISTAKES.md #19에
            // 따라 raw `style` 대신 CSS 커스텀 프로퍼티 + arbitrary value로 넘긴다.
            style={
                {
                    '--peek-band': `${MOBILE_SHEET_PEEK_BAND_SVH}svh`,
                } as CSSProperties
            }
        >
            {/* vaul `[data-vaul-handle]`의 기본 지오메트리를 그대로 복제한다
                (32×5, opacity .7, #e2e2e4, border-radius 1rem, 좌우 auto 마진).
                교체 순간 손잡이가 튀지 않도록 하기 위함이다. */}
            <div className="mx-auto h-[5px] w-8 shrink-0 rounded-2xl bg-[#e2e2e4] opacity-70" />
            <div className="min-h-0 flex-1 px-4 pt-3">
                <p className="text-sm font-medium text-secondary-400">
                    AI 분석
                </p>
            </div>
        </div>
    );
}
