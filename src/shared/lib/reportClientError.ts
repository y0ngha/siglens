/**
 * 클라이언트 예외를 서버 로그로 흘려보낸다. CloudWatch 메트릭 필터가 `[client-error]`
 * 리터럴을 집계한다(`infra/aws/07-alarms.sh`).
 *
 * **의존성 0개로 유지할 것.** import가 없으면 서버 전용 SDK가 이 파일을 타고 클라이언트
 * 번들로 샐 경로 자체가 없다(v0.58.0 배럴 누출 재발 방지). 같은 이유로 `shared/lib`
 * 배럴에 넣지 않는다 — 소비자는 이 경로로 deep import한다.
 *
 * 페이지 로드당 상한이 이 모듈의 핵심이다. v0.53.1 무한 렌더 루프는 한 세션에서 400렌더를
 * 찍었는데, 상한이 없으면 그게 그대로 400개의 비콘이 되어 사고 대응 중에 로그를 덮는다.
 */
const MAX_REPORTS_PER_LOAD = 5;

/** 스택은 첫 프레임 몇 개면 원인 파악에 충분하다. 라우트의 4KB 상한도 지켜야 한다. */
const MAX_STACK_CHARS = 1200;

/** 메시지 상한. 스택과 합쳐도 라우트의 4KB 안에 들어간다. */
const MAX_MESSAGE_CHARS = 500;

let sent = 0;

/**
 * URL의 쿼리스트링을 지운다. `path`에 적용하는 규칙과 같은 규칙을 message/stack에도 건다 —
 * 실패한 fetch의 URL이 그대로 메시지에 박히는 경우가 흔하고, 거기에 토큰·이메일이 실린다.
 *
 * 완전한 PII 스크러버가 아니다. URL이 아닌 형태로 사용자 입력을 품은 메시지
 * (검증 에러가 이메일을 그대로 되뇌는 등)는 여전히 통과한다. 이 로그는 앱 로그와
 * 같은 CloudWatch 그룹에 남으므로 보존정책도 같다.
 *
 * ⚠️ **반드시 잘라낸 뒤에 호출할 것.** 이 정규식은 긴 입력에서 2차식으로 느려진다
 * (실측: 공백 없는 `https://a` 반복 360KB에 약 4.8초). `unhandledrejection`의
 * `reason`은 서드파티가 만든 임의 길이 문자열일 수 있으므로, 상한 없이 넣으면
 * 보고 한 번이 메인 스레드를 수 초간 잡는다 — `MAX_REPORTS_PER_LOAD`가 손쓰기도 전에.
 */
function stripQueryStrings(text: string): string {
    return text.replace(/(https?:\/\/[^\s)'"]*?)\?[^\s)'"]*/g, '$1');
}

/**
 * 값을 **실행 없이** 문자열로 좁힌다.
 *
 * `String(value)`를 쓰지 않는 게 핵심이다. 그건 값의 `Symbol.toPrimitive`/`toString`/
 * `valueOf`를 호출하는데, `unhandledrejection`의 `reason`은 서드파티 스크립트가 만든
 * 임의 객체일 수 있다 — 비싼 `toString`이나 끝나지 않는 루프를 넣으면 길이 상한을
 * 걸어 볼 기회조차 없이 메인 스레드가 멈춘다. 상한은 이미 실행된 비용을 되돌리지 못한다.
 *
 * 그래서 문자열만 통과시키고 나머지는 `typeof`만 적어 보낸다. 잃는 건 이름 없는
 * reject 값의 내용이고, 얻는 건 "보고 코드가 남의 코드를 절대 실행하지 않는다"는 보장이다.
 */
function safeString(value: unknown): string {
    return typeof value === 'string' ? value : `[non-string: ${typeof value}]`;
}

/** `unhandledrejection`의 reason은 Error가 아닐 수 있다(문자열, 객체, undefined). */
function describe(error: unknown): { message: string; stack?: string } {
    // 자르기 → 스크럽 순서가 중요하다(위 경고 참조). 반대로 하면 상한이 무의미해진다.
    //
    // `instanceof Error`를 통과해도 `name`/`message`/`stack`이 게터로 재정의돼 있을 수
    // 있으므로 여기서도 `safeString`을 통과시킨다 — 읽기 자체는 막을 수 없지만,
    // 문자열이 아닌 값을 이어 붙이며 다시 `toString`을 부르는 일은 없어진다.
    if (error instanceof Error) {
        const name = safeString(error.name);
        const message = safeString(error.message);
        const stack = error.stack;
        return {
            message: stripQueryStrings(
                `${name}: ${message}`.slice(0, MAX_MESSAGE_CHARS)
            ),
            stack:
                typeof stack === 'string'
                    ? stripQueryStrings(stack.slice(0, MAX_STACK_CHARS))
                    : undefined,
        };
    }
    return {
        message: stripQueryStrings(
            safeString(error).slice(0, MAX_MESSAGE_CHARS)
        ),
    };
}

/**
 * `context`는 발생 지점 라벨이다(예: `'RootRoute'`, `'unhandledrejection'`).
 * `digest`는 Next가 서버 에러에 붙이는 해시로, 클라이언트 로그를 서버 로그와 잇는다.
 */
export function reportClientError(
    error: unknown,
    context: string,
    digest?: string
): void {
    if (
        typeof navigator === 'undefined' ||
        typeof navigator.sendBeacon !== 'function'
    )
        return;
    if (sent >= MAX_REPORTS_PER_LOAD) return;
    sent += 1;

    const body = JSON.stringify({
        context,
        digest,
        // 쿼리스트링은 버린다 — 개인정보가 실릴 수 있고 집계에 쓰지도 않는다.
        path: window.location.pathname,
        ...describe(error),
    });

    try {
        navigator.sendBeacon(
            '/api/client-error',
            new Blob([body], { type: 'application/json' })
        );
    } catch {
        // 보고 실패가 사용자 화면을 더 망가뜨리면 안 된다. 삼킨다.
    }
}

/** 테스트 격리용 — 모듈 상태(전송 카운터)를 되돌린다. */
export function __resetReportCountForTests(): void {
    sent = 0;
}
