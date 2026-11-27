import type { SignalScanMarket } from '@/shared/config/signalScanUniverse/signalScanUniverse';
import type { SignalHistoryMarket } from '../../types';

/**
 * shared는 entities를 import할 수 없어 `SignalScanMarket`을 따로 선언한다. 두 타입이 같은 값 집합이어야
 * 하므로 양방향 대입 가능성을 컴파일 시점에 고정한다(어긋나면 이 파일이 typecheck에서 깨진다).
 */
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const marketsAreTheSame: Equal<SignalScanMarket, SignalHistoryMarket> = true;

describe('SignalScanMarket', () => {
    it('SignalHistoryMarket과 같은 시장 집합이다', () => {
        expect(marketsAreTheSame).toBe(true);
    });
});
