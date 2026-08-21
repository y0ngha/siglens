/**
 * **오버레이 계열 검색 표면**(헤더 트리거·홈 히어로 트리거·오버레이 입력)의 문구·치수
 * 단일 소스.
 *
 * 이 셋은 같은 문구를 써야 한다. 리터럴로 흩어지면 한쪽만 바뀌어 "화면에 보이는 말"과
 * "접근 이름"이 어긋난다 — `assetClassNav.ts`가 같은 이유로 링크 라벨을 단일 소스로
 * 강제한다.
 *
 * 데스크톱 인라인 자동완성(`TickerAutocomplete`)은 여기 포함되지 않는다. 그쪽은
 * 자기 문구(`종목 티커 검색` / `종목 입력 (예: AAPL, 삼성전자, BTC)`)를 유지하며,
 * E2E와 기존 테스트가 그 이름으로 요소를 찾는다.
 */

/**
 * 문구는 **키만** 내보낸다 — `t()` 호출은 소비 파일에서 한다.
 *
 * 추출기는 번역자 선언이 있는 파일에서만 키를 수집한다
 * (`keysForFiles`의 `translatorNamespace.size === 0` 조기 반환). 여기서
 * `t('search.triggerLabel')`을 부르면 그 키가 클라이언트 페이로드에서 통째로
 * 빠져, 하이드레이션 후 화면에 원시 키 문자열이 뜬다 — 전 로케일에서, ko 포함.
 * `views/symbol/utils/chartPageHeading.ts`가 같은 이유로 같은 형태다.
 */

/** 아이콘 전용 트리거의 접근 이름. 보이는 텍스트가 없을 때만 쓴다. */
export const SEARCH_TRIGGER_LABEL_KEY = 'search.triggerLabel';

/** 입력 placeholder이자 홈 히어로 트리거의 **보이는** 문구. */
export const SEARCH_PLACEHOLDER_KEY = 'search.placeholder';

/**
 * 결과 행·인기 종목 행이 공유하는 껍데기 클래스. 두 목록이 한 화면에 이어 붙으므로
 * 행 높이와 좌우 여백이 어긋나면 스캔 리듬이 깨진다.
 */
export const SEARCH_ROW_CLASS =
    'flex min-h-14 w-full touch-manipulation items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary-800/60 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * Enter 직행이 허용하는 티커 형태.
 *
 * 사용자가 친 문자열을 그대로 `/{입력}`으로 삼기 때문에, 티커가 될 수 없는 값은
 * 걸러야 한다. `../`나 `/`가 섞이면 엉뚱한 라우트로 가고, 지나치게 긴 문자열은
 * 존재하지 않는 종목 페이지를 만든다.
 *
 * 실제 심볼 형태를 덮는다 — `AAPL`, `BRK.B`, `005930.KS`, `BTCUSD`.
 * 한글 판정은 `isKoreanInput`이 별도로 맡는다(회사명은 티커가 아니다).
 */
export const DIRECT_TICKER_RE = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;

/**
 * **홈 히어로**가 모바일에서 한 번에 보여줄 최근 검색 개수. 저장은 7개까지 하지만
 * (`MAX_RECENT_SEARCHES`) 첫 화면 세로가 귀해 앞의 4개만 노출하고 나머지는 `lg`부터
 * 드러낸다.
 *
 * 검색 오버레이에는 적용하지 않는다. 그쪽은 목록이 **항상 스크롤되도록** 하단 여백을
 * 두므로 세로가 제약이 아니고, 저장된 7개가 다 보여야 "최근 본 종목 사이를 오간다"는
 * 그 화면의 용도가 성립한다.
 */
export const HERO_RECENT_CHIP_LIMIT = 4;
