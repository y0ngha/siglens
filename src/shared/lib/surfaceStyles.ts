/**
 * 표면(카드·패널) 공통 클래스.
 *
 * 리디자인 전 코드베이스에는 `rounded-xl border border-secondary-700
 * bg-secondary-800` 문자열이 **83곳에 그대로 복제**돼 있었고, 반경은 6종,
 * 표면 틴트는 20종이 뒤섞여 있었다. 페이지마다 다른 템플릿을 이어붙인 인상의
 * 가장 큰 원인이라 여기로 모은다.
 *
 * 컴포넌트가 아니라 **문자열 상수**인 이유: 83곳을 컴포넌트로 감싸면 DOM 구조가
 * 바뀌어 E2E 로케이터와 SEO 텍스트 위치에 회귀 위험이 생긴다. 클래스만 교체하면
 * 렌더 결과의 구조는 그대로다.
 *
 * 반경은 3단계로 고정한다:
 *   `rounded`(4px) 칩·배지·입력 · `rounded-lg`(8px) 카드·패널·버튼 · `rounded-full` 알약
 * 깊이는 장식 선이 아니라 **면의 밝기와 빛**으로 낸다(`.surface-raised`, `globals.css`
 * 표면 블록). 카드마다 1px 선으로 갈라지면 화면이 표처럼 딱딱해졌다(2026-10 사용자
 * 피드백: "엑셀 같다"). 다크는 한 단계 밝은 면 + 윗변 하이라이트, 라이트는 위가 밝은
 * 그라데이션 + 얕은 낙하 그림자다. 크게 떠 있는 것(모달·시트·팝오버)만 `shadow-lg`
 * 이상을 더한다 — `shadow-*` 유틸리티는 표면 그림자를 덮어쓰고 하이라이트는 남긴다.
 */
import { cn } from '@/shared/lib/cn';

/**
 * 페이지 위에 놓이는 기본 카드/패널. 가장 흔한 표면.
 *
 * 경계 폭(`border border-transparent`)은 남긴다. 강조 카드가 `border-ui-danger/30`·
 * `hover:border-primary-500/50`처럼 경계 **색만** 덮어 쓰는 자리가 있어서, 폭이 없으면
 * 그 강조가 사라지고 폭이 생기면 레이아웃이 1px 밀린다. 면은 경계 밑까지 칠해진다
 * (`.surface-raised`의 `background-origin: border-box`).
 *
 * `bg-*`로 면 색을 덮지 않는다 — 라이트의 그라데이션은 `background-image`라
 * `bg-*` 색 유틸리티 위에 그대로 그려진다. 다른 면이 필요하면 다른 표면이다.
 */
export const SURFACE_CARD = cn(
    'surface-raised rounded-lg border border-transparent'
);

/**
 * 화면 위에 떠서 다른 카드를 덮는 메뉴·드롭다운·다이얼로그·배너.
 *
 * 카드와 같은 면이지만 **경계선을 되살린다**. 다크에서는 아래에 깔리는 카드도 같은
 * `.surface-raised` 면이고 거의 검은 페이지 위에서 `shadow-lg`가 보이지 않아, 선이 없으면
 * 메뉴가 밑의 카드와 한 덩어리로 녹는다. 크게 뜬 정도는 호출부가 `shadow-*`로 덧붙인다.
 */
export const SURFACE_FLOATING = cn(SURFACE_CARD, 'border-secondary-700');

/** 카드 안에 한 번 더 들어가는 중첩 블록. 보더 없이 표면값만으로 구분한다. */
export const SURFACE_NESTED = cn('rounded-lg bg-secondary-700/40');

/**
 * 로딩 자리표시자를 **어느 표면 위에 얹는지** 보고 고른다.
 *
 * 습관대로 고르면 안 되는 이유가 라이트 테마에 있다. 중립 램프의 위쪽이
 * 촘촘해서 `secondary-700`(#e6e8ec)이 인셋 면(#eff0f3)과 거의 같다 —
 * 페이지별 감사가 서로 다른 네 화면에서 1.05~1.23을 독립적으로 보고했다.
 *
 * 측정값(자리표시자 대 컨테이너, 다크 / 라이트):
 *
 *   컨테이너         s700            s600
 *   카드(raised)     1.218 / 1.175   1.543 / 1.438
 *   페이지(900)      1.400 / 1.154   —
 *   인셋(950)        1.433 / 1.077   1.814 / 1.318
 *
 * 인셋 면(`bg-secondary-950`을 쓰는 인증·계정·포트폴리오 화면) 위에서는
 * `s700`이 라이트에서 1.077까지 떨어져 로딩 화면이 통째로 백지로 읽힌다.
 * 그 자리에는 `PLACEHOLDER_ON_INSET`을 쓴다.
 *
 * 카드 면은 `.surface-raised`라 다크는 800보다 한 단계 밝고(700 40% 혼합), 라이트는
 * 아래로 갈수록 900 쪽으로 옅어진다 — 표의 카드 행은 그 면(라이트는 더 낮은 아랫변)
 * 기준이다. 경계선 시절(800 위 1.336 / 1.227)과 비슷한 대역이라 그대로 둔다 — 여기서
 * 램프 값을 건드리면 `border-secondary-700` 465곳이 함께 움직인다.
 */
export const PLACEHOLDER_ON_CARD = 'bg-secondary-700';
export const PLACEHOLDER_ON_INSET = 'bg-secondary-600';
