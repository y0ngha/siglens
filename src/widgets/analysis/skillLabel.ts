/**
 * 스킬 표시명(패턴·전략·지표) → 로케일 문구.
 *
 * 이름은 `skills/**.md` front-matter의 `name`이고, core가 그대로 응답에 싣는다.
 * 36개가 한국어라 영어 페이지에서 아코디언 **제목만** 한국어로 남았다.
 *
 * LLM 번역으로는 못 고친다 — 같은 문자열이 `AnalysisPanel`에서 **dedupe 키**로도
 * 쓰여, 번역하면 중복 제거가 깨진다. 그래서 값은 그대로 두고 표시 시점에만 바꾼다.
 *
 * 카탈로그에 없는 이름(영문 스킬 45종, 신규 스킬)은 원문으로 떨어진다.
 */
export function skillLabel(
    t: { (key: string): string; has(key: string): boolean },
    name: string
): string {
    const key = `skillName.${name}`;
    return t.has(key) ? t(key) : name;
}
