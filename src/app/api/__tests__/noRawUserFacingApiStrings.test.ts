import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * SSE 스트림이 사용자에게 돌려주는 에러 문구에 한국어 리터럴 금지.
 *
 * ## 왜 이 가드가 필요한가
 *
 * `scripts/i18n/lib/scan.mjs`는 `src/app/api/`를 통째로 제외한다 — "서버 로그·
 * 에러 코드. 사용자에게 렌더되지 않는다"는 전제다. 이 라우트에 대해서는 그
 * 전제가 **틀렸다**: `heartbeatStream`이 거절을 SSE `error` 이벤트의
 * `{ message }`로 싣고, `useAnalysisStream` → `useAnalysis` → `ChartContent`의
 * `<ErrorBanner>`가 그대로 화면에 띄운다.
 *
 * 그래서 한국어 문구 3개가 미추출 기준선 1,671건에도 **잡히지 않은 채** 남아
 * 있었다. 일본어 사용자가 타임아웃이나 동시성 한도에 걸리면 한국어 배너를 봤고,
 * 스캐너가 제외하니 새로 추가돼도 영원히 안 걸린다.
 */
describe('SSE 사용자 노출 문구 가드', () => {
    /**
     * SSE로 사용자 문구를 만들어 내보내는 파일 전부.
     *
     * 라우트 하나만 보면 **디스패치 액션 9개가 통째로 사각지대**다 — 그 액션들이
     * 돌려주는 `{ status: 'error', error }`를 훅이 `<p role="alert">`에 그대로
     * 렌더한다. 실측: `submitMarketNewsDigestAction`이 영어 리터럴
     * `'Failed to submit digest'`를 전 로케일에 내보내고 있었는데 가드는 초록이었다.
     */
    const FILES = [
        'src/app/api/analysis/stream/route.ts',
        'src/entities/analysis/actions/runOverallAnalysisAction.ts',
        'src/entities/analysis/actions/runFundamentalAnalysisAction.ts',
        'src/entities/analysis/actions/runFinancialsAnalysisAction.ts',
        'src/entities/analysis/actions/runCongressTrendAction.ts',
        'src/entities/news-article/actions/submitNewsAnalysisAction.ts',
        'src/entities/market-news/actions/submitMarketNewsDigestAction.ts',
        'src/entities/options-chain/actions/optionsActions.ts',
        'src/entities/market-summary/actions/submitMarketBriefingAction.ts',
        'src/entities/economy/actions/submitMacroBriefingAction.ts',
    ].map(rel => join(process.cwd(), rel));

    it('주석을 뺀 소스에 한글 리터럴이 아예 없다', () => {
        /**
         * 트리거 토큰(`new Error` 등) 근처만 보면 한 단계 간접 참조로 빠져나간다
         * — 문자열을 모듈 상수로 올리고 `{ error: BUSY_TEXT }`로 쓰면 통과했다
         * (실측). 이 파일은 주석을 걷어내면 한글이 **하나도** 없어야 정상이므로,
         * 그걸 그대로 단언하는 편이 짧고 더 강하다.
         */
        const offenders: string[] = [];
        for (const file of FILES) {
            const stripped = readFileSync(file, 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/(?<![:/])\/\/.*$/gm, '');
            stripped.split('\n').forEach(line => {
                if (/[가-힣]/.test(line)) {
                    offenders.push(
                        `${file.split('/').pop()}: ${line.trim().slice(0, 70)}`
                    );
                }
            });
        }
        expect(offenders).toEqual([]);
    });

    it('양성 대조: 대상 파일을 모두 실제로 읽는다', () => {
        for (const file of FILES) {
            expect(readFileSync(file, 'utf8').length).toBeGreaterThan(500);
        }
    });

    it('사용자에게 돌려주는 문구가 전부 카탈로그를 경유한다', () => {
        /**
         * 한글만 보면 **정작 이 가드를 만든 계기를 못 잡는다** —
         * `submitMarketNewsDigestAction`의 영어 리터럴
         * `'Failed to submit digest'`가 전 로케일에 나가고 있었는데 초록이었다
         * (실측: 그 줄을 되돌려도 10,516개 통과).
         *
         * 그래서 언어가 아니라 **형태**를 본다: 화면에 뜨는 `error:` 값이 문자열
         * 리터럴이면 위반이다. 카탈로그를 경유하면 `t(...)`나
         * `await ...Message(locale)` 같은 식(識)이 오므로 걸리지 않는다.
         *
         * 제외 대상 두 부류:
         *  - **코드 sentinel** — 훅이 코드로 분기해 자체 카탈로그 문구를 만든다.
         *  - **400 진단 문구** — `useAnalysisStream`은 400 본문을 읽지 않고
         *    `messages.failed(status)`로 자체 문구를 만든다(`:124`). 잘못된
         *    요청을 보낸 개발자용 값이라 번역 대상이 아니다. 400 응답 블록을
         *    통째로 잘라내 구분한다.
         */
        const ALLOWED_SENTINELS = new Set([
            'server_error',
            'unexpected_error',
            'no_options_chains',
            'invalid_model',
            'tier_premium_blocked',
            'api_key_corrupted',
            'timeframe_not_allowed',
        ]);
        const offenders: string[] = [];
        for (const file of FILES) {
            const stripped = readFileSync(file, 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/(?<![:/])\/\/.*$/gm, '')
                // 400 응답 블록 제거 — 본문이 화면에 도달하지 않는다.
                .replace(
                    /Response\.json\([\s\S]{0,300}?\{\s*status:\s*400\s*\}\s*\)/g,
                    ''
                );
            // 앞의 `{`/`,`가 **객체 리터럴 속성** 자리임을 보장한다. 이게 없으면
            // `console.error('... error:', err)`의 문자열 **안**을 속성으로 오인한다.
            // `error:`(평면)와 `message:`(중첩) 둘 다 본다. 이 레포의 게이트
            // 에러는 `{ error: { code, message } }` 형태라 평면 스캔만으로는
            // **한 단계 깊은 영어 하드코딩을 통째로 놓친다** — 감사 실증:
            // `runCongressTrendAction`에 인라인 `{ code, message: '...' }`를
            // 넣어도 가드 3개와 263개 테스트가 전부 통과했다.
            for (const match of stripped.matchAll(
                /[{,]\s*(?:error|message):\s*(['"`])([^'"`]{2,})\1/g
            )) {
                if (!ALLOWED_SENTINELS.has(match[2]!)) {
                    offenders.push(
                        `${file.split('/').pop()}: ${match[0].slice(0, 70)}`
                    );
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
