/**
 * 표기가 갈리던 종목의 **정본 한글명** — DB 번역보다 우선한다.
 *
 * ## 왜 필요한가 — 같은 종목이 화면마다 다른 이름이었다
 *
 * 2026-08-24 프로덕션 전수 대조(큐레이션 상수 126종 × 세 소스): 홈 디스커버리
 * 카드(`TICKER_CATEGORIES`), 마켓 대시보드(`SECTOR_STOCKS`), 종목 페이지 제목
 * (DB `asset_translations`)이 서로 다른 이름을 쓰는 종목이 **55종**이었다.
 * 예: `LAES`가 세알시큐리티 / SEALSQ / 씰스큐로 세 갈래.
 *
 * ## 무엇을 담고 무엇을 담지 않는가
 *
 * **오류만 담는다** — 오역, 잘못된 사명, 외래어 표기법 위반. 55종 전부를 담지
 * 않는 이유는 차이의 상당수가 **의도된 것**이기 때문이다: 대시보드는 좁은 섹터
 * 카드 그리드라 짧은 라벨(`기술`)을 쓰고 DB는 완전한 이름(`기술 섹터 ETF`)을
 * 쓴다. 그건 길이 예산의 문제지 오류가 아니다. 여기에 넣어 강제하면 대시보드
 * 카드가 말줄임으로 뭉개진다.
 *
 * ## 이 맵이 이기는 범위 — 적용 지점이 둘이다
 *
 * 한글명 저장소가 **두 개**라 각각 덮어야 한다. 하나만 덮으면 종목 페이지엔
 * `실스큐`, 검색 드롭다운엔 `씰스큐`가 뜬다(리뷰가 잡은 실제 우회 경로).
 *
 * 1. `getAssetInfo` **출구**(`withCanonicalKoreanName`) — `asset_translations` +
 *    Redis 캐시 경로. 종목 페이지 제목·OG·JSON-LD·관련 종목 칩이 여기서 온다.
 *    ⚠️ DB 읽기 지점이 아니라 출구다 — 이유는 그 함수 JSDoc 참고(캐시가 먼저
 *    반환해서 DB 경로 오버라이드가 통째로 무효였다).
 * 2. `getKoreanNames`(`koreanNameStore.ts`) — `korean_tickers` 테이블 경로.
 *    검색 자동완성과 뉴스가 여기서 이름을 받는다.
 *
 * 홈·대시보드는 각자 상수를 직접 읽으므로 그쪽도 같은 값으로 맞춰 두었다
 * (`popular-tickers.ts`, `dashboard-tickers.ts`) —
 * `canonical-korean-names.test.ts`가 그 정합을 고정한다.
 *
 * ## 표기 원칙
 *
 * 1. **외래어 표기법** — `쉐`는 없다(sh+e=셰), Exxon=엑슨, SEAL /siːl/=실.
 *    원어의 띄어쓰기를 보존한다(Quantum Computing → `퀀텀 컴퓨팅`).
 * 2. **정식 사명** — 줄여 부르지 않는다(Rigetti Computing → `리게티 컴퓨팅`).
 * 3. **예외는 검색어** — 한국 사용자가 실제로 치는 말이 이긴다. `IBM`은 영문
 *    그대로 쓰고(`아이비엠` 아님), `알파벳(구글)`은 구글 키워드를 남긴다.
 */
export const CANONICAL_KOREAN_NAMES: ReadonlyMap<string, string> = new Map([
    // --- 외래어 표기법 ---
    // Exxon Mobil — Exxon은 '엑슨'. 언론 표준 표기도 엑슨모빌.
    ['XOM', '엑슨모빌'],
    // Chevron — 외래어 표기법에 '쉐'가 없다(sh + e = 셰).
    ['CVX', '셰브론'],
    // SEALSQ — /siːl/이라 '실'. DB에 '씰스큐', 홈에 '세알시큐리티'(SEAL+Security로
    // 잘못 읽은 오역)가 있었다.
    ['LAES', '실스큐'],
    // 아래 5종은 원어 띄어쓰기 보존 문제다.
    ['QUBT', '퀀텀 컴퓨팅'], // Quantum Computing Inc.
    ['ASTS', 'AST 스페이스모바일'], // AST SpaceMobile (SpaceMobile은 한 단어)
    ['LUNR', '인튜이티브 머신스'], // Intuitive Machines
    ['PL', '플래닛 랩스'], // Planet Labs
    ['SPCE', '버진 갤럭틱'], // Virgin Galactic

    // --- 정식 사명 ---
    // 같은 양자컴퓨팅 카테고리 안에서 '리게티'/'디웨이브'만 줄여 부르면
    // `퀀텀 컴퓨팅`(QUBT)과 층위가 어긋난다.
    ['RGTI', '리게티 컴퓨팅'], // Rigetti Computing
    ['QBTS', '디웨이브 퀀텀'], // D-Wave Quantum (DB엔 'D-Wave퀀텀'으로 영문이 섞여 있었다)

    // --- 검색어 우선 ---
    // 한국에서도 영문 약어 그대로 쓴다. 검색도 "IBM 주가".
    ['IBM', 'IBM'],
    // 한국 사용자는 "구글 주가"로 검색한다 — 그 키워드를 버리지 않는다.
    ['GOOGL', '알파벳(구글)'],
]);
