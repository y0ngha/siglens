# QA · 검증 문서군

테스트·실증·릴리스 검증·안정성 감사 노하우. 다음 세션에서도 그대로 재참조할 수 있도록 정리한다.

| 문서 | 내용 |
|---|---|
| [E2E.md](./E2E.md) | Playwright E2E 하니스 구조, 로컬/CI 실행, 스펙 작성 가이드 |
| [QA_ENV_SETUP.md](./QA_ENV_SETUP.md) | **범용 QA 환경 셋업** — docker(Postgres+Redis+SRH), `.env.local` 전환·원복, prod-like 빌드, 멀티브라우저 설치, 워크트리 주의, prod DB 미접촉, 종료 체크리스트 |
| [TEST_SHEET_AUTHORING.md](./TEST_SHEET_AUTHORING.md) | 테스트 시트 작성 — 변경면 분석→케이스 도출, 누락 방지 체크리스트(마크다운/긴 입력/Safari/모바일/캐시/a11y) |
| [MULTI_ENV_TESTING.md](./MULTI_ENV_TESTING.md) | Chrome/Safari × Desktop/Mobile 매트릭스, 도구 매핑(claude-in-chrome=Chrome, Playwright webkit/iPhone14), `@webkit` 태그 전략 |
| [EMPIRICAL_VERIFICATION.md](./EMPIRICAL_VERIFICATION.md) | 실증 프로세스 — 적용 전 실증, 리뷰봇 주장 검증, trace/로그 ground truth, CI flake 판별 |
| [PR_REVIEW_LOOP.md](./PR_REVIEW_LOOP.md) | 외부 리뷰봇 자동 반영 루프 — 폴링→검증→반영/반려→Draft토글 재리뷰/CI→머지 |
| [RELEASE_VERIFICATION.md](./RELEASE_VERIFICATION.md) | 버전범위 실증 검증 플레이북(curl+Chrome 이중) + 재사용 프롬프트 |
| [STABILITY_AUDIT.md](./STABILITY_AUDIT.md) | 5 fresh-context 안정성 감사(코드/배포×2/SEO/커버리지) + 재사용 프롬프트 |

관련: 에이전트 워크플로우는 [../workflows/](../workflows/), 코딩/테스트 규약은 [../conventions/CONVENTIONS.md](../conventions/CONVENTIONS.md).
