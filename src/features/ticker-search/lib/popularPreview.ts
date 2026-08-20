import type { TickerItem } from '@/shared/lib/types';

/**
 * 검색 오버레이의 "인기 종목" 미리보기 — **입력 전에도 쓸 게 있어야 한다**는
 * 이 화면의 전제를 떠받치는 목록이다.
 *
 * ## 왜 미국 메가캡만 담지 않는가
 *
 * 첫 초안은 `TICKER_CATEGORIES[0]`(메가캡·지수)만 잘라 썼는데, 그러면 애플·마이크로소프트·
 * 엔비디아처럼 **미국 종목만** 뜬다. 사이트는 미국·한국·암호화폐를 1차 축으로 끌어올린
 * 상태고(`shared/config/assetClassNav.ts`), 한국 주식이나 코인을 주로 보는 사용자에게는
 * 그 목록이 "볼 게 있다"에 해당하지 않는다. 세 자산군에서 고루 뽑는다.
 *
 * ## 왜 config를 import하지 않고 값을 적어 두는가
 *
 * 두 번째 초안은 `TICKER_CATEGORIES`·`CRYPTO_CATEGORIES`를 import해 `id`로 찾아 잘랐다.
 * 단일 소스라는 점은 좋았지만 비용이 붙었다 — 이 슬라이스 배럴은 헤더와 root layout이
 * 소비해 **33개 전 라우트의 first-load 청크**에 들어가고, `package.json`에 `sideEffects`가
 * 없어 미사용 항목이 제거되지 않는다. 실측: 9행을 그리려고 **gzip 2,017B**의 config가
 * 전 라우트에 실렸고, 쓰지도 않는 `altcoin` 카테고리와 `popular-tickers`의
 * `CURATED_KOREAN_NAMES` 계산(`flatMap`)까지 매 페이지 로드마다 따라왔다.
 *
 * 그래서 값만 여기 둔다. 드리프트는 import가 아니라 **테스트**가 막는다 —
 * `__tests__/popularPreview.test.ts`가 원본 config를 (테스트 쪽에서만, 번들 비용 0으로)
 * 읽어 여기 심볼이 전부 그 안에 있는지 확인한다. 원본에서 종목이 빠지면 테스트가
 * 먼저 깨지므로 손으로 적었다는 사실이 위험이 되지 않는다.
 */

export interface PopularPreviewGroup {
    /** 섹션 제목. 자산군을 이름으로 드러내 사용자가 자기 영역을 바로 찾게 한다. */
    label: string;
    items: readonly TickerItem[];
}

/**
 * 자산군별 3개씩. 키보드가 올라온 390×844 화면에서 미국·한국이 접히는 선 위에 들어오고
 * 암호화폐는 살짝 아래 걸치는 분량이다 — 섹션 제목이 있어 스크롤 단서는 남는다.
 *
 * 심볼은 `shared/config/popular-tickers.ts`(megacap · kr-semiconductor)와
 * `shared/config/crypto-categories.ts`(major)에서 가져왔다. 위 JSDoc 참고.
 */
export const POPULAR_PREVIEW_GROUPS: readonly PopularPreviewGroup[] = [
    {
        label: '미국',
        items: [
            { symbol: 'AAPL', name: '애플' },
            { symbol: 'MSFT', name: '마이크로소프트' },
            { symbol: 'NVDA', name: '엔비디아' },
        ],
    },
    {
        label: '한국',
        items: [
            { symbol: '005930.KS', name: '삼성전자' },
            { symbol: '000660.KS', name: 'SK하이닉스' },
            { symbol: '006400.KS', name: '삼성SDI' },
        ],
    },
    {
        label: '암호화폐',
        items: [
            { symbol: 'BTCUSD', name: '비트코인' },
            { symbol: 'ETHUSD', name: '이더리움' },
            { symbol: 'XRPUSD', name: '리플' },
        ],
    },
];
