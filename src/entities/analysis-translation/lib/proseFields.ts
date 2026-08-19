/**
 * core 분석 응답에서 **산문 필드만** 골라내고 되돌려 넣는 순수 유틸.
 *
 * ## 왜 필드 목록을 손으로 적지 않는가
 *
 * core의 응답 타입은 산문 필드를 **`*Ko` 접미사**로 일관되게 표시한다
 * (`headlineKo`, `integratedConclusionKo`, `riskFactorsKo` … 21종). 이 규약을
 * 쓰면 core가 새 산문 필드를 추가해도 목록을 갱신할 필요가 없다 — 손 목록은
 * 반드시 뒤처지고, 뒤처지면 그 필드만 조용히 한국어로 남는다.
 *
 * ## 왜 산문만 건드리는가
 *
 * 숫자·가격·enum(`sentiment`, `riskLevel`, `direction`)·티커·`keyLevels`는
 * 절대 넘기지 않는다. 번역 모델이 숫자를 바꾸는 사고를 **구조적으로** 막는 것이
 * 프롬프트로 부탁하는 것보다 확실하다. `*Ko`가 아닌 필드는 애초에 후보가 아니다.
 */

/** 번역 대상 문자열 하나의 위치. `path`는 `a.b.0.c` 형태의 점 경로. */
export interface ProseEntry {
    readonly path: string;
    readonly text: string;
}

const KO_SUFFIX = 'Ko';

/** 이 키가 산문 필드인가. */
function isProseKey(key: string): boolean {
    return key.endsWith(KO_SUFFIX) && key !== KO_SUFFIX;
}

/**
 * 응답 객체에서 번역 대상 문자열을 전부 뽑는다(배열·중첩 객체 포함).
 *
 * 빈 문자열과 공백만 있는 값은 건너뛴다 — 번역 호출만 늘고 결과가 같다.
 */
export function extractProse(value: unknown, prefix = ''): ProseEntry[] {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) =>
            extractProse(item, `${prefix}${prefix ? '.' : ''}${index}`)
        );
    }
    if (typeof value !== 'object' || value === null) return [];

    const out: ProseEntry[] = [];
    for (const [key, child] of Object.entries(value)) {
        const path = `${prefix}${prefix ? '.' : ''}${key}`;
        if (isProseKey(key)) {
            if (typeof child === 'string') {
                if (child.trim()) out.push({ path, text: child });
            } else if (Array.isArray(child)) {
                child.forEach((item, index) => {
                    if (typeof item === 'string' && item.trim()) {
                        out.push({ path: `${path}.${index}`, text: item });
                    }
                });
            }
            continue;
        }
        out.push(...extractProse(child, path));
    }
    return out;
}

/**
 * 뽑아낸 자리에 번역문을 되돌려 넣은 **새 객체**를 만든다.
 *
 * 원본을 변형하지 않는다 — 같은 분석 객체가 여러 로케일로 동시에 렌더될 수 있고,
 * 캐시된 원본이 오염되면 그 뒤로 모든 요청이 틀린 언어를 받는다.
 */
export function applyProse<T>(value: T, translations: Map<string, string>): T {
    return applyAt(value, '', translations) as T;
}

function applyAt(
    value: unknown,
    prefix: string,
    translations: Map<string, string>
): unknown {
    if (Array.isArray(value)) {
        return value.map((item, index) =>
            applyAt(item, `${prefix}${prefix ? '.' : ''}${index}`, translations)
        );
    }
    if (typeof value !== 'object' || value === null) return value;

    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        const path = `${prefix}${prefix ? '.' : ''}${key}`;
        if (isProseKey(key)) {
            if (typeof child === 'string') {
                out[key] = translations.get(path) ?? child;
            } else if (Array.isArray(child)) {
                out[key] = child.map((item, index) =>
                    typeof item === 'string'
                        ? (translations.get(`${path}.${index}`) ?? item)
                        : item
                );
            } else {
                out[key] = child;
            }
            continue;
        }
        out[key] = applyAt(child, path, translations);
    }
    return out;
}
