# 종합 수정 계획 — v0.21.0 검수 (실증 + 5개 감사 + SEO)

> 작성일: 2026-06-19 / 브랜치: `feat/v0210-nav-routing-seo-audit`
> 입력: 실증(chrome+curl) / review-agent / 배포안정성×2 / 테스트커버리지 / seo-audit(R1)

## 감사 종합 결론

- **배포 안정성**: GO (블로커 0). ISR cold-gen 안전, 도메인 로직 core 분리 정상.
- **단, CI 블로커 1건**: prettier format 실패(`NewsCategoryTabs.test.tsx`) → push 전 필수 수정.
- **커버리지**: ≥90% 충족(stmt 92.7%/branch 90.1%) — 단 congress AI요약 컨테이너/에러 0%, e2e 갭.
- **SEO**: 기술 SEO 정상, 내부 링크(footer /news, 홈 CTA) 갭만.

## 수정 작업 목록 (배치별 — 파일 disjoint)

### Batch A — 카테고리 슬러그 단일화 + 탭 (news-hub / market-news / news page)
- **A1** `entities/market-news`에 순서 보존 상수 `NEWS_CATEGORY_SLUGS: readonly NewsFeedCategory[]` 추출(= `Object.keys(CATEGORY_CONFIG)` 단일 출처). barrel export. _(review R1)_
- **A2** `NewsCategoryTabs.tsx` — `CATEGORIES` 로컬 재유도 제거, `NEWS_CATEGORY_SLUGS` 소비.
- **A3** `app/news/[category]/page.tsx` `generateStaticParams` — `NEWS_CATEGORY_SLUGS` 소비(중복 유도 제거).
- **A4** `NewsCategoryTabs.test.tsx` — 탭 **순서** 단언(`getAllByRole('link').map(textContent)` toEqual) 추가 + **prettier format** 적용. _(review R2 + CI 블로커)_

### Batch B — 헤더 nav a11y + 테스트 드리프트 (widgets/layout)
- **B1** `HeaderMobileMenu.tsx` — 드로어 nav 링크에 `min-h-11` + `flex items-center`(44px 터치 타겟). _(실증 O-2)_
- **B2** `headerNavItems.test.ts` — 부정확 length 매처를 정확한 라벨 배열 단언으로 교체. _(review R3)_
- **B3** `HeaderNav.test.tsx`·`HeaderNavStatic.test.tsx`·`HeaderMobileMenu.test.tsx` — 로컬 `NAV_ITEMS`(/economy 누락) 제거하고 실제 `../headerNavItems`의 `NAV_ITEMS` import. _(커버리지 #5 드리프트)_

### Batch C — 내부 링크 발견성 (footer / home)
- **C1** `Footer` — `/news`("마켓 뉴스") 링크 추가(현재 /economy만). _(실증 O-4 + SEO 내부링크)_
- **C2** `app/page.tsx` 히어로 — 보조 퀵링크 행에 `/news`·`/economy` 추가(기존 "오늘 주목할 종목 →" 스타일 미러). _(req #6 + SEO 내부링크)_

### Batch D — congress AI요약 테스트 (widgets/congress)
- **D1** `CongressTrendSummary` 컨테이너 테스트 신규 — 5개 상태(loading/no_trades/bot_blocked/error/success) 분기 렌더 단언. _(커버리지 #1, 0%)_
- **D2** `CongressTrendSummaryError` 테스트 신규 — 메시지 fallback 3종 + 재시도 버튼. _(커버리지 #2, 0%)_

### Batch E — E2E (e2e/specs)
- **E1** `news-hub.spec.ts` — 카테고리 탭바 네비(`nav[aria-label="뉴스 카테고리"]`, aria-current, 탭 클릭→/news/crypto 이동) 추가. _(커버리지 #3)_
- **E2** `economy.spec.ts`(또는 통합) — 헤더 `미국 경제` 링크 클릭→/economy 도달 추가. _(커버리지 #4)_

### Batch F — 정직성/하위 (최소)
- **F1** `economySnapshotStaticCache.test.ts:54` 빈 `it.skip` → `// note:` 주석 전환. _(정직성)_
- **F2**(선택) factory 선택 분기 단위테스트(getEconomyProvider 54%/getCongressTradesProvider 11%) — isE2E 양방향 stub. _(branch margin 보강, 우선순위 낮음)_

## 미수정(근거 명시)
- 실증 O-1 canonical=localhost: env-baked, prod 재빌드 시 siglens.io. 코드 결함 아님.
- 실증 O-3 잘못된 ticker 200 soft-404: `[symbol]` 라우트 앱 전역 동작(신규 회귀 아님), noindex로 색인 차단. 별도 전역 결정 영역.
- congress bot-degrade: 문서화된 SEO trade-off(PR #598), self-healing. 미수정.

## 검증 (수정 후)
1. `npx prettier --check .` PASS + `npx tsc --noEmit` PASS + `yarn lint` PASS
2. `yarn test` 전수 GREEN
3. SEO 라운드 2: footer/home 내부 링크 재확인(curl)
4. prod 재빌드 → 신규 라우트 200 + 콘솔 0 재확인
