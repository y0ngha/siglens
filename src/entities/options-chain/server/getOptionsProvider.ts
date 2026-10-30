import { isE2E } from '@/shared/api/e2eEnv';
import type { SlottedOptionsDataProvider } from '../lib/optionsSlots';
import { YahooOptionsAdapter } from './YahooOptionsAdapter';

let cached: SlottedOptionsDataProvider | null = null;

/**
 * 앱의 옵션 데이터 provider 싱글턴 — 프로덕션은 Yahoo, `E2E_TEST`에서는 fake다.
 * `optionsDataCache`가 모듈 적재 시점에 한 번 호출한다.
 */
export function getOptionsProvider(): SlottedOptionsDataProvider {
    if (cached !== null) return cached;
    if (isE2E()) {
        // 동기 팩토리라 동적 import를 쓸 수 없어 fake를 가드된 require로 적재한다.
        // 서버 전용이며 E2E_TEST 미설정 시 죽은 분기다(Turbopack은 서버 출력에 여전히 번들한다).
        const { FakeOptionsDataProvider } =
            require('./FakeOptionsDataProvider') as typeof import('./FakeOptionsDataProvider');
        cached = new FakeOptionsDataProvider();
        return cached;
    }
    cached = new YahooOptionsAdapter();
    return cached;
}
