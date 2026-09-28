import type { IndexTicker, SectorEtf, SectorStock } from '@y0ngha/siglens-core';
import { CRYPTO_CATEGORIES } from './crypto-categories';

/**
 * 크립토 대시보드 scope의 티커 설정 — 미국(`dashboard-tickers.ts`)·한국
 * (`dashboard-tickers-kr.ts`)의 크립토 대응.
 *
 * **화면이 아니라 에이전트 도구만 쓴다.** `/market`·`/market/kr`과 달리
 * `/market/crypto` 페이지는 없다. 이 scope는 `get_market_overview`의
 * `market: 'crypto'`가 신호 스캔을 돌릴 대상 목록을 주기 위해 존재한다 —
 * 그 전에는 "요즘 신호 잡힌 코인" 류 질문에 내놓을 데이터가 아예 없었다.
 *
 * 심볼은 FMP의 `*USD` 표기이며 시세 소스도 FMP다(`marketDataProviderFor`는
 * `kr`이 아닌 scope를 전부 FMP로 보낸다).
 */

/** 지수 자리에 쓰는 두 메이저와 그 영문 표시명. 한국어명은 카탈로그에서 가져온다. */
const INDEX_SYMBOLS = [
    { symbol: 'BTCUSD', displayName: 'Bitcoin' },
    { symbol: 'ETHUSD', displayName: 'Ethereum' },
] as const;

/**
 * 한국어명은 `CRYPTO_CATEGORIES`가 소유한다 — 여기에 다시 적으면 같은 코인의 이름이
 * 두 파일에 존재하게 되고, 한쪽만 고쳐도 아무 곳에서도 실패하지 않는다.
 * 카탈로그에 없으면 심볼을 그대로 쓴다(이름이 빈칸으로 렌더되는 것보다 낫다).
 */
const koreanNameOf = (symbol: string): string =>
    CRYPTO_CATEGORIES.flatMap(c => c.items).find(i => i.symbol === symbol)
        ?.name ?? symbol;

/**
 * 지수 자리에 쓰는 두 메이저.
 *
 * 크립토에는 S&P 500 같은 벤치마크 지수가 없다. 시장 방향을 한 줄로 말해야 하는
 * 자리에 비트코인·이더리움을 두는 것은 업계 관행이고, 이 둘은 `POPULAR_CRYPTOS`와
 * `CRYPTO_CATEGORIES.major` 양쪽에 모두 있어 라우트 해석이 보장된다.
 */
export const CRYPTO_MARKET_INDICES: readonly IndexTicker[] = INDEX_SYMBOLS.map(
    ({ symbol, displayName }) => ({
        symbol,
        fmpSymbol: symbol,
        displayName,
        koreanName: koreanNameOf(symbol),
    })
);

/**
 * 신호 탭의 묶음. 크립토에는 섹터 ETF가 없으므로 `CRYPTO_CATEGORIES`의 큐레이션
 * 그룹(메이저·알트코인)을 **가상 테마**로 쓴다 — 미국 scope가 `QNTM`(양자)·
 * `SPACE`처럼 상장 ETF 없는 테마를 `signalSectors`에 두는 것과 같은 용법이다.
 * `symbol`은 시세를 부르지 않는 그룹 키이므로 실제 티커가 아니어도 된다.
 */
export const CRYPTO_SIGNAL_SECTORS: readonly SectorEtf[] =
    CRYPTO_CATEGORIES.map(category => ({
        symbol: category.id,
        sectorName: category.id,
        koreanName: category.label,
    }));

/**
 * 스캔 대상. `POPULAR_CRYPTOS`(수십 종, 스크립트가 누적 갱신) 전체가 아니라
 * `CRYPTO_CATEGORIES`의 큐레이션 10종만 본다 — 스캔 1회는 종목당 봉 1 + 시세 1이라
 * 목록 길이가 그대로 FMP 호출 수가 되고, 꼬리 쪽 저유동성 코인은 신호가 잡혀도
 * 답변에 쓸 만한 근거가 못 된다.
 */
export const CRYPTO_SECTOR_STOCKS: readonly SectorStock[] =
    CRYPTO_CATEGORIES.flatMap(category =>
        category.items.map(item => ({
            symbol: item.symbol,
            koreanName: item.name,
            sectorSymbol: category.id,
        }))
    );
