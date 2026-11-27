/**
 * 알람 필터 셸 스크립트(`infra/aws/*.sh`)에서 읽은 필터 패턴 하나. `alarmFilterPhrases`(문구가 소스에 있는가)와
 * `alarmFilterReachability`(그 로그가 실제로 닿는가)가 같은 파서로 같은 패턴 목록을 읽는다.
 */
export interface FilterPattern {
    readonly file: string;
    readonly kind: 'terms' | 'json';
    readonly terms: readonly string[];
}

/** 주석을 지울 소스의 언어: `js`(줄·블록 주석)와 `sh`(`#` 주석). */
export type SourceLang = 'js' | 'sh';

const DQ = String.raw`"(?:[^"\\]|\\.)*"`;
const SQ = String.raw`'[^']*'`;
const BARE = String.raw`[^\s'"]+`;
const ARG = `(?:${DQ}|${SQ}|${BARE})`;

/** 호출 형태별로 패턴 인자의 위치가 다르다. 정규식의 첫 캡처 그룹이 패턴 인자다. */
const CALL_FORMS: readonly RegExp[] = [
    new RegExp(`^\\s*put_alert_filter\\s+${ARG}\\s+(${ARG})`),
    new RegExp(`^\\s*put_filter\\s+${ARG}\\s+(${ARG})`),
    new RegExp(`^\\s*put_signal_filter\\s+${ARG}\\s+${ARG}\\s+(${ARG})`),
    new RegExp(`--filter-pattern\\s+(${ARG})`),
];

/** 필터를 거는 호출처 후보. 이 줄이 `CALL_FORMS`에 안 잡히면 파서가 못 읽는 새 형태다. */
const CALL_SITE_CANDIDATE =
    /--filter-pattern\s|^\s*put_(?:alert_|signal_)?filter\s/;

const SH_TOKEN = /'[^']*'|"(?:[^"\\]|\\.)*"|(^|\s)#[^\n]*/gm;
const JS_TOKEN =
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\[\s\S])*`/g;

/**
 * 주석을 지운다. 정규식 하나가 문자열·템플릿과 주석을 **앞에서부터 한 토큰씩** 소비하므로
 * 문자열 안의 `//`(URL)·`/*`는 주석으로 오인되지 않고, 주석 안의 따옴표는 문자열을 열지 않는다.
 * 정규식 리터럴 안의 따옴표처럼 이 방식이 못 보는 구문은 최악에도 한 줄(`'`·`"`)만 영향을 준다.
 */
export function stripComments(text: string, lang: SourceLang): string {
    return lang === 'sh'
        ? text.replace(SH_TOKEN, (m, lead: string | undefined) =>
              m.startsWith("'") || m.startsWith('"') ? m : (lead ?? '')
          )
        : text.replace(JS_TOKEN, m => (m.startsWith('/') ? ' ' : m));
}

function unquote(arg: string): string {
    const first = arg[0];
    if (first === "'") return arg.slice(1, -1);
    if (first === '"') return arg.slice(1, -1).replace(/\\(.)/g, '$1');
    return arg;
}

/** 패턴 안의 따옴표로 묶인 용어. 앞뒤 따옴표는 CloudWatch 구문이라 떼어 낸다. */
function termsOf(pattern: string): string[] {
    return [...pattern.matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

/** 주석을 지우고 `\`로 이어진 줄을 한 줄로 합쳐 호출처가 줄바꿈에 흔들리지 않게 한다. */
function shLines(text: string): string[] {
    return stripComments(text, 'sh')
        .replace(/\\\n\s*/g, ' ')
        .split('\n');
}

/** `ensure_investor_flows_cron <name>` 호출에서 크론 이름을 모은다(lib-cron 템플릿 확장용). */
export function cronNames(scripts: readonly { text: string }[]): string[] {
    return scripts.flatMap(({ text }) =>
        shLines(text).flatMap(line => {
            const m = /^\s*ensure_investor_flows_cron\s+([\w-]+)\s/.exec(line);
            return m === null ? [] : [m[1]];
        })
    );
}

function patternArg(line: string): string | undefined {
    return CALL_FORMS.map(re => re.exec(line)?.[1]).find(a => a !== undefined);
}

/** 셸 스크립트 텍스트에서 필터 패턴 리터럴을 전부 뽑는다. 순수 함수라 변조한 사본으로 반증할 수 있다. */
export function parseFilterPatterns(
    scripts: ReadonlyArray<{ file: string; text: string }>
): FilterPattern[] {
    const names = cronNames(scripts);
    return scripts.flatMap(({ file, text }) =>
        shLines(text).flatMap(line => {
            const arg = patternArg(line);
            if (arg === undefined) return [];
            const raw = unquote(arg);
            // 함수 정의 안의 `"$pattern"` 같은 변수 전달은 리터럴이 아니다.
            if (raw.startsWith('$')) return [];
            const variants = raw.includes('${name}')
                ? names.map(n => raw.replaceAll('${name}', n))
                : [raw];
            return variants.map((v): FilterPattern => {
                const json = v.trimStart().startsWith('{');
                return {
                    file,
                    kind: json ? 'json' : 'terms',
                    terms: json ? [] : termsOf(v),
                };
            });
        })
    );
}

/**
 * 호출처 회계. 후보 줄 = 인식한 리터럴 호출처 + `$N`/`$var`를 넘기는 헬퍼 정의 줄이어야 하고,
 * 어느 쪽도 아닌 줄(새 호출 형태)은 `unparsed`로 이름을 붙여 돌려준다.
 */
export function accountCallSites(
    scripts: ReadonlyArray<{ file: string; text: string }>
): {
    literal: number;
    forwarding: number;
    templated: number;
    unparsed: string[];
} {
    const sites = scripts.flatMap(({ file, text }) =>
        shLines(text)
            .filter(line => CALL_SITE_CANDIDATE.test(line))
            .map(line => ({ file, line, arg: patternArg(line) }))
    );
    const raws = sites.map(s => ({
        ...s,
        raw: s.arg === undefined ? undefined : unquote(s.arg),
    }));
    return {
        literal: raws.filter(s => s.raw !== undefined && !s.raw.startsWith('$'))
            .length,
        forwarding: raws.filter(s => s.raw?.startsWith('$')).length,
        templated: raws.filter(s => s.raw?.includes('${name}')).length,
        unparsed: raws
            .filter(s => s.raw === undefined)
            .map(s => `${s.file}: ${s.line.trim()}`),
    };
}
