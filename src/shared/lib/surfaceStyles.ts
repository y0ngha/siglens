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
 * 깊이는 그림자가 아니라 **보더와 표면값**으로 낸다. 그림자는 실제로 떠 있는
 * 것(모달·시트·팝오버)에만 쓴다 — 라이트 테마에서 그림자 남용은 즉시 촌스러워진다.
 */
import { cn } from '@/shared/lib/cn';

/** 페이지 위에 놓이는 기본 카드/패널. 가장 흔한 표면. */
export const SURFACE_CARD = cn(
    'rounded-lg border border-secondary-700 bg-secondary-800'
);

/** 카드 안에 한 번 더 들어가는 중첩 블록. 보더 없이 표면값만으로 구분한다. */
export const SURFACE_NESTED = cn('rounded-lg bg-secondary-700/40');
