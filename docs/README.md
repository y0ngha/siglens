# Siglens 문서 인덱스

문서는 목적별 폴더로 구성된다. (역사적 설계 spec·플랜은 `superpowers/`, 에이전트 전용은 `__agents_only__/`.)

## product/ — 제품·도메인
- [SERVICE.md](./product/SERVICE.md) — 서비스 개요, 대상 사용자, 기술 스택, Skills 시스템
- [DOMAIN.md](./product/DOMAIN.md) — 지표 계산 명세, 캔들 패턴, Skills, 비즈니스 규칙
- [AUTH.md](./product/AUTH.md) — 인증/세션/OAuth/이메일 토큰 흐름

## architecture/ — 구조·범위
- [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) — FSD 레이어 구조, 의존 방향, 폴더 레이아웃
- [SCOPE.md](./architecture/SCOPE.md) — siglens vs siglens-core 분담(결정 트리, 안티패턴)
- [PERFORMANCE_BASELINE.md](./architecture/PERFORMANCE_BASELINE.md) — 성능 baseline & 액션 플랜
- [ISR_REVALIDATE.md](./architecture/ISR_REVALIDATE.md) — ISR revalidate 정책(페이지별 값·근거, Fast Origin Transfer 절감)

## conventions/ — 작성 규칙
- [CONVENTIONS.md](./conventions/CONVENTIONS.md) — 코딩 컨벤션, 네이밍, 타입, 테스트 커버리지
- [FF.md](./conventions/FF.md) — FF 4원칙(Readability/Predictability/Cohesion/Coupling)
- [GIT_CONVENTIONS.md](./conventions/GIT_CONVENTIONS.md) — 브랜치/커밋/PR 규칙
- [DESIGN.md](./conventions/DESIGN.md) — 컬러 시스템, Tailwind v4 `@theme`, 차트 컬러 상수

## reference/ — 레퍼런스
- [API.md](./reference/API.md) — FMP/AI/worker API 엔드포인트, 환경변수
- [CRON.md](./reference/CRON.md) — 크론/스케줄 패턴

## workflows/ — 에이전트 프로세스
- [ISSUE_IMPL_FLOW.md](./workflows/ISSUE_IMPL_FLOW.md) — 이슈 구현 플로우
- [PR_FIX_FLOW.md](./workflows/PR_FIX_FLOW.md) — PR 수정 플로우
- [MISTAKES.md](./workflows/MISTAKES.md) — 반복 실수와 방지 규칙

## qa/ — 테스트·검증
- [qa/README.md](./qa/README.md) — QA 문서군 인덱스 (환경 셋업, 테스트 시트, 멀티환경, 실증, PR 리뷰 루프, 릴리스 검증, 안정성 감사, E2E)
