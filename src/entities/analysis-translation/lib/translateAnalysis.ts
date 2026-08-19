import { applyProse, extractProse } from './proseFields';

/**
 * 문자열 묶음을 대상 언어로 옮기는 함수. 실제 LLM 호출은 `api.ts`가 주입한다.
 *
 * 입력 순서와 출력 순서·길이가 같아야 한다. 어긋나면 번역이 엉뚱한 필드에 붙는다.
 */
export type TranslateBatch = (texts: readonly string[]) => Promise<string[]>;

/**
 * 분석 응답의 산문 필드만 번역한 **새 객체**를 만든다.
 *
 * core는 프롬프트도 캐시 키도 로케일을 모른다(public API에 파라미터가 없다).
 * 로케일별로 분석을 다시 돌리면 LLM 비용이 로케일 수만큼 곱해지고, 프롬프트
 * 15개 파일 + 교차 레포 릴리스가 필요하다. 대신 한국어로 한 번 생성한 결과의
 * **산문만** 저가 모델로 옮긴다 — 숫자·enum·가격은 손대지 않으므로 분석의
 * 사실관계가 번역 단계에서 바뀔 수 없다.
 *
 * 번역 결과 개수가 입력과 다르면 **원본을 그대로 돌려준다.** 부분 적용은
 * 한 화면에 두 언어가 섞이는 최악의 상태를 만든다 — 차라리 전부 한국어가 낫고,
 * 그 상태는 `SYMBOL_INDEXABLE_LOCALES` 게이트가 색인에서 막는다.
 */
export async function translateAnalysis<T>(
    analysis: T,
    translate: TranslateBatch
): Promise<T> {
    const entries = extractProse(analysis);
    if (entries.length === 0) return analysis;

    const translated = await translate(entries.map(entry => entry.text));
    if (translated.length !== entries.length) return analysis;

    const map = new Map<string, string>();
    entries.forEach((entry, index) => {
        const value = translated[index];
        // 빈 번역은 버리고 원문을 남긴다 — 빈 문단이 화면에 구멍을 만든다.
        if (typeof value === 'string' && value.trim())
            map.set(entry.path, value);
    });
    return applyProse(analysis, map);
}
