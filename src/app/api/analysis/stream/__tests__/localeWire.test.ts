import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 로케일 배선의 **판별 테스트**.
 *
 * ## 왜 이 파일이 필요한가
 *
 * 라운드 6에서 `x-siglens-locale` → 게이트 문구까지 로케일을 관통시켰는데,
 * 그 배선 전체가 **반증 불가능**했다. 감사가 실증한 두 가지:
 *  - `resolveRequestLocale`의 본문을 `return DEFAULT_LOCALE`로 바꿔 헤더를 통째로
 *    무시해도 **10,516개 테스트가 전부 통과**했다.
 *  - `gateMessage`에 `locale: 'ko'`를 하드코딩해도 1,848개가 통과했다.
 *
 * 원인은 스위트의 모든 로케일 단언이 `'ko'`(= `DEFAULT_LOCALE`)였다는 것이다.
 * 라운드 1의 "서버 액션 테스트가 ko에 고정" + 라운드 4의 "기본값이 있으면 호출부에서
 * 빠져도 통과"가 라운드 6의 수정 안에서 재발한 것이다.
 *
 * 그래서 여기서는 **비-기본 로케일로만** 단언한다.
 */
describe('로케일 배선 판별', () => {
    /**
     * 헤더 → 액션 인자 배선 자체는 `route.test.ts`의
     * "x-siglens-locale: %s가 액션 인자로 전달된다"(+ 알 수 없는 값 폴백)가
     * **행동으로** 단언한다. 소스 문자열 grep은 포맷 변경에 취약해 걷어냈다.
     * 여기서는 그 아래 계층(게이트 문구 카탈로그)만 본다.
     */
    it.each([
        ['ja', 'ja'],
        ['en', 'en'],
        ['zh', 'zh'],
    ])(
        '%s: 게이트 문구가 그 로케일 카탈로그에서 나온다',
        async (locale, catalogName) => {
            const { buildGateError } = await import('@/shared/lib/byokGate');
            const catalog = (
                await import(`../../../../../../messages/${catalogName}.json`)
            ).default as {
                shared: { lib: { byokGate: Record<string, string> } };
            };

            const err = await buildGateError(
                'tier_premium_blocked',
                locale as 'ja' | 'en' | 'zh'
            );

            expect(err.code).toBe('tier_premium_blocked');
            expect(err.message).toBe(
                catalog.shared.lib.byokGate.tier_premium_blocked
            );
            // 코드 문자열이 그대로 새면 안 된다(폴백 경로).
            expect(err.message).not.toBe('tier_premium_blocked');
            // 한국어가 섞이면 안 된다.
            expect(err.message).not.toMatch(/[가-힣]/);
        }
    );

    /**
     * core의 `timeframe_not_allowed`는 영어 문장이라 **ko 사용자에게도 영어가**
     * 나갔다. 에러 봉투는 번역 LLM에 보내지 않으므로(비용·오역 방지) 라우트가
     * 코드로 카탈로그 문구를 갈아끼운다.
     */
    it('timeframe_not_allowed 문구가 4개 로케일에 모두 있다', async () => {
        for (const locale of ['ko', 'en', 'ja', 'zh']) {
            const catalog = (
                await import(`../../../../../../messages/${locale}.json`)
            ).default as {
                app: { api: { stream: Record<string, string> } };
            };
            const message = catalog.app.api.stream.timeframeNotAllowed;
            expect(message).toBeTruthy();
            // ko를 제외한 로케일에 한국어가 섞이면 안 된다.
            if (locale !== 'ko') expect(message).not.toMatch(/[가-힣]/);
            // core의 영어 원문이 그대로 남아 있으면 안 된다.
            expect(message).not.toContain('not available for free tier');
        }
    });

    /**
     * 라우트가 에러 봉투를 번역기에 보내지 않는지 **소스로** 고정한다.
     *
     * 이 분기를 지워도 10,516개 테스트가 전부 초록이었다(실측). 런타임 단언은
     * 번역기 mock 없이는 불가능하고, 그 mock을 넣으면 이번엔 mock이 계약을
     * 대신 정의해 버린다. 분기의 존재와 조건을 소스에서 확인하는 편이 정직하다.
     * "왜 필요한가"는 `proseFields.dispatch.test.ts`가 `error.message`가 산문으로
     * 잡힌다는 사실로 뒷받침한다.
     */
    it('withLocalizedProse가 에러 봉투를 번역에서 제외한다', () => {
        const source = readFileSync(
            join(process.cwd(), 'src/app/api/analysis/stream/route.ts'),
            'utf8'
        );
        const at = source.indexOf('function withLocalizedProse');
        const fn = source.slice(at, source.indexOf('\n}', at));
        expect(fn).toContain("=== 'error'");
        expect(fn).toContain('return result');
    });
});
