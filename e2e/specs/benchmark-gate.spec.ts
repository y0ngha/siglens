import { BENCHMARK_PUBLISHED } from '@/shared/config/benchmark';
import { test, expect } from '../support/fixtures';

/**
 * `/benchmark` 공개 게이트의 실제 HTTP 상태 — 두 호스트 모두.
 *
 * 공개 전(`BENCHMARK_PUBLISHED === false`)에는 라우트가 `notFound()`를 던지고, 단위 테스트는
 * "notFound가 호출됐다"까지만 볼 수 있다. 프레임워크가 실제로 404를 내는지(soft 404가 아닌지)는
 * 프로덕션 빌드에 요청해야만 보인다. 공개 PR이 게이트를 올리면 기대값이 200으로 따라 바뀌므로
 * 이 스펙을 손볼 필요가 없다.
 *
 * ai 호스트(`ai.localhost:4300`)는 `ai` 프로젝트가 아니라 이 스펙의 `chromium` 프로젝트에서
 * 절대 URL로 연다 — `ai` 프로젝트는 agent-chat 스펙만 매칭하고, 다른 스펙을 거기에 얹으려면
 * 두 프로젝트의 testIgnore/testMatch를 함께 바꿔야 해서 설정 변경이 더 크다. Chromium은
 * `*.localhost`를 항상 루프백으로 풀고, `fixtures.ts`의 호스트 허용 목록에도 이미 들어 있다.
 */
const EXPECTED_STATUS = BENCHMARK_PUBLISHED ? 200 : 404;

const HOSTS = [
    ['main host', 'http://localhost:4300'],
    ['ai host', 'http://ai.localhost:4300'],
] as const;

test.describe('benchmark publication gate', () => {
    for (const [name, origin] of HOSTS) {
        test(`GET /benchmark on the ${name} answers ${EXPECTED_STATUS}`, async ({
            page,
        }) => {
            const response = await page.goto(`${origin}/benchmark`);
            expect(response?.status()).toBe(EXPECTED_STATUS);
        });
    }
});
