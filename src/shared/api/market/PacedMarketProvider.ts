import 'server-only';
import type { Bar, GetBarsOptions, MarketQuote } from '@y0ngha/siglens-core';
import type { StartSpacer } from '@/shared/lib/startSpacer';
import type {
    QuoteSnapshot,
    SiglensMarketProvider,
} from './marketProvider.types';

/**
 * 업스트림 호출 시작 속도를 묶는 provider 데코레이터. 모든 메서드가 호출 전에 `spacer.next()`를 기다리고,
 * 호출 수를 센다(`upstreamCalls`). 자기 오류를 더하지 않는다 — 안쪽 provider의 거절·`null`을 그대로 넘긴다.
 *
 * 캐시 provider **아래**에 놓는다(`getSignalScanMarketDataProvider`). 그래서 캐시 적중은 기다리지 않고
 * 실제 업스트림 호출만 속도 제한을 받는다.
 */
export class PacedMarketProvider implements SiglensMarketProvider {
    private readonly counter = { calls: 0 };

    constructor(
        private readonly inner: SiglensMarketProvider,
        private readonly spacer: StartSpacer
    ) {}

    /**
     * 지금까지 안쪽 provider로 내보낸 **호출 수**(속도 제한을 받은 메서드 호출). 안쪽 어댑터가 한 호출
     * 안에서 하는 HTTP 재시도(`fmpGet` 등)는 세지 않으므로 실제 요청 수는 이보다 클 수 있다.
     */
    upstreamCalls(): number {
        return this.counter.calls;
    }

    private async paced<T>(call: () => Promise<T>): Promise<T> {
        await this.spacer.next();
        this.counter.calls += 1;
        return call();
    }

    getBars(options: GetBarsOptions): Promise<Bar[]> {
        return this.paced(() => this.inner.getBars(options));
    }

    getQuote(symbol: string): Promise<MarketQuote | null> {
        return this.paced(() => this.inner.getQuote(symbol));
    }

    getTodayBar(symbol: string): Promise<Bar | null> {
        return this.paced(() => this.inner.getTodayBar(symbol));
    }

    getQuoteSnapshot(symbol: string): Promise<QuoteSnapshot> {
        return this.paced(() => this.inner.getQuoteSnapshot(symbol));
    }
}
