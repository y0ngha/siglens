import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * 프로세스에 이미 설치했는지 표시하는 `console` 위의 전역 키. `register()` 재호출(dev HMR, 번들이 같은 모듈을 둘
 * 이상 평가하는 경우)에도 래퍼가 겹쳐 쌓이지 않게 한다.
 */
const INSTALLED_KEY = Symbol.for('siglens.consoleDbErrorRedactionInstalled');

const PATCHED_METHODS = ['error', 'warn', 'log', 'info', 'debug'] as const;

type ConsoleMethod = (typeof PATCHED_METHODS)[number];

type ConsoleWithMarker = Console & { [INSTALLED_KEY]?: true };

/**
 * `console.error(err)` 계열 호출의 인자 중 데이터베이스 에러를 이름·코드만 남긴 문자열로 바꾸는 래퍼를
 * `console`에 설치한다. 비DB 인자는 그대로 통과한다(`redactDbErrorForLog`).
 *
 * 왜 `console`인가: 처리되지 않은 DB 에러가 Next까지 올라오면 Next가 `console.error(err)`(RSC·라우트 핸들러·
 * Server Action 모두, `next start`에서는 `_log.error`가 `console[method]`를 호출한다)로 에러 전체를 찍는다.
 * 메시지에 drizzle의 `Failed query: … params: …`가 들어 있어 바인딩 값(세션 토큰, 이메일, 보유종목)이 로그로 샌다.
 * `instrumentation.onRequestError`는 그 로그를 **찍은 뒤** 관찰용으로만 불려 막을 수 없다(`route-module.js`의
 * `onRequestError`: 로그 → `instrumentationOnRequestError` 순서). 우리 코드의 로그는 SA-26 가드가 막지만 프레임워크가
 * 직접 찍는 줄은 가드가 못 본다. 에러를 던지는 쪽을 바꾸면 에러 클래스·`code` 분기에 닿으므로 던져진 에러는 건드리지 않고
 * 출력 경계만 지운다.
 *
 * 한계: 인자로 직접 넘긴 에러(와 그 `cause`·`errors` 체인)만 본다. 다른 객체 안에 중첩된 에러는 보지 않는다.
 * `console.dir`·`trace`·`table`·`assert`는 감싸지 않고, `process.stderr.write` 같은 직접 쓰기도 덮지 못한다.
 * 이 래퍼는 안전망이지 SA-26을 대신하지 않는다: 우리 호출부는 여전히 `redactDbErrorForLog`를 거쳐야 한다.
 */
export function installConsoleDbErrorRedaction(
    target: Console = console
): void {
    const marked = target as ConsoleWithMarker;
    if (marked[INSTALLED_KEY]) return;
    marked[INSTALLED_KEY] = true;

    for (const method of PATCHED_METHODS) {
        const original: Console[ConsoleMethod] = target[method];
        target[method] = (...args: unknown[]): void => {
            original.apply(
                target,
                args.map(arg => redactDbErrorForLog(arg))
            );
        };
    }
}
