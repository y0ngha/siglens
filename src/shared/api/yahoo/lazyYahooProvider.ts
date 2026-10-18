import type { YahooMarketProvider } from './YahooMarketProvider';

let providerPromise: Promise<YahooMarketProvider> | null = null;

/**
 * `YahooMarketProvider` 인스턴스를 처음 쓸 때 한 번만 만든다(호출마다 동적 import + new 방지).
 *
 * **동적 import인 이유**: `YahooMarketProvider`는 `server-only`이고 `yahoo-finance2`는
 * `child_process`/`dns` 같은 Node 전용 모듈을 요구한다. 이 getter를 부르는 모듈(종목명·호가표
 * 조회)은 클라이언트 번들 그래프에 닿는 체인에 있어, 정적 import면 yahoo가 클라이언트 번들로
 * 끌려간다. 타입만 정적으로 가져온다.
 */
export function loadYahooProvider(): Promise<YahooMarketProvider> {
    providerPromise ??= import('./YahooMarketProvider').then(
        m => new m.YahooMarketProvider()
    );
    return providerPromise;
}
