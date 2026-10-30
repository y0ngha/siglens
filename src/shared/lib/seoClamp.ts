import { truncateWithEllipsis } from '@/shared/lib/truncate';

/**
 * 한글 SERP description 안전권. Google 한국어 SERP에서 모바일은 ~80자,
 * 데스크톱은 ~120자 안팎에서 절단되므로 120자를 상한으로 둔다.
 * 현재 모든 빌더는 이미 90~115자 범위로 짧지만, 입력(displayName/sector)
 * 변화로 인한 회귀를 막기 위해 출력단에서 한 번 더 강제한다.
 *
 * **템플릿 description에만 적용한다.** 스냅샷 본문 발췌(`buildSnapshotMetaDescription`)와
 * 그 계열(공포·탐욕 사실 설명)은 문장 단위로만 자르므로 더 넉넉한
 * {@link SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH}(160)를 쓴다.
 */
export const SEO_DESCRIPTION_MAX_LENGTH = 120;

/**
 * 스냅샷 본문에서 만든 description의 상한(code point).
 *
 * 템플릿 description은 위 120자 안에서 끝나지만, 본문 발췌는 **문장 단위로만** 자르므로
 * 문장 하나가 더 들어갈 여유가 있어야 한다. 120자에서는 첫 문장이 예산을 넘겨 `…`로
 * 잘리는 일이 잦았다(2026-10-05 운영 크롤: 구분자 접두 `{displayName} {label} — `만 최대
 * 86자를 먹었다). 접두를 짧은 주어로 바꾸고 상한을 160자로 둔다.
 */
export const SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH = 160;

/**
 * 입력이 SEO_DESCRIPTION_MAX_LENGTH 이하면 그대로, 초과 시 잘라내고 말줄임표(…)를 붙인다.
 * 말줄임표는 1자로 계산해 최종 길이가 항상 SEO_DESCRIPTION_MAX_LENGTH 이하가 되게 한다.
 *
 * 길이/슬라이스는 모두 code point 기준으로 처리해 surrogate pair(이모지,
 * supplementary plane 한자 등)가 split되어 invalid UTF-16이 되는 것을 막는다.
 */
export function clampSeoDescription(text: string): string {
    return truncateWithEllipsis(text, SEO_DESCRIPTION_MAX_LENGTH, {
        trimEnd: true,
    });
}

/**
 * SERP에서 차지하는 시각적 폭을 근사한다 — 한글·전각 2, 그 외 1.
 *
 * Google 데스크톱 title 예산은 약 58~60 폭단위다. 글자 수로 재면 한글 제목의
 * 잘림을 예측할 수 없다: `AAPL 주가 분석 — 차트와 기술적 신호, 지지선·저항선 | SIGLENS`은
 * 42글자지만 58 폭단위로 이미 경계에 있다(2026-07-26 실측 — 이 함수로 직접 측정, 당시 ko
 * 접미사는 `| SIGLENS`였고 지금의 `| 시그렌즈`는 폭단위 1이 더 넓다).
 *
 * 코드포인트 기준으로 순회해 서로게이트 페어를 쪼개지 않는다
 * ({@link clampSeoDescription}과 동일한 방침).
 */
export function seoTitleWidth(text: string): number {
    return [...text].reduce(
        (width, ch) =>
            width + (isFullWidthCodePoint(ch.codePointAt(0) ?? 0) ? 2 : 1),
        0
    );
}

/**
 * 전각으로 취급할 코드포인트인지.
 *
 * 커버 범위: 한글 자모(U+1100–U+115F), 한글 음절(U+AC00–U+D7A3), CJK 통합
 * 표의문자 등(U+2E80–U+A4CF), CJK 호환 한자(U+F900–U+FAFF), CJK 호환 기호
 * (U+FE30–U+FE6F), 전각 형태(U+FF00–U+FF60, U+FFE0–U+FFE6), 그리고 이모지는
 * Miscellaneous Symbols and Pictographs(U+1F300–U+1F64F)·Supplemental
 * Symbols and Pictographs(U+1F900–U+1F9FF) 두 블록만 전각으로 취급한다.
 * 범위는 Unicode East Asian Width의 W/F 구간 중 이 서비스가 실제로 다루는
 * 것만 추렸다.
 *
 * 커버되지 않는 이모지 블록도 있다 — Transport and Map Symbols(🚀 U+1F680),
 * Miscellaneous Symbols(⭐ U+2B50), Dingbats(✅ U+2705)는 모두 1 폭단위로
 * 계산된다(실측 확인됨). 현재 12개 title 템플릿은 이모지를 쓰지 않으므로
 * 범위를 넓히지 않았다 — 넓히면 이미 실측해 둔 폭 수치가 전부 달라진다.
 *
 * Ambiguous-width 문자(`·` U+00B7, `—` U+2014, `…` U+2026)는 Unicode East
 * Asian Width 기준 Ambiguous(A) 등급이라 한국어 로케일 SERP에서는 넓게
 * 렌더링될 수 있지만, 이 함수는 의도적으로 좁은(1 폭단위) 문자로 취급한다.
 * `—`·`·`는 사실상 모든 title 템플릿에 등장해 2로 세면 12개 템플릿을 전부
 * 재조정해야 하는데, `SEO_TITLE_MAX_WIDTH`(55)는 이미 58~60 예산 대비
 * 3~5 폭단위 여유가 있어 그 재조정의 안전 이득이 작다. 게다가 Google의
 * 실제 절단은 픽셀 기준이라 어떤 유닛 모델도 근사치일 뿐이다. 이 문단은
 * 좁게 처리한 것이 실수가 아니라 의도된 선택임을 남기기 위한 것이다.
 */
function isFullWidthCodePoint(cp: number): boolean {
    return (
        (cp >= 0x1100 && cp <= 0x115f) || // 한글 자모
        (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK 부수 ~ 이(Yi)
        (cp >= 0xac00 && cp <= 0xd7a3) || // 한글 음절
        (cp >= 0xf900 && cp <= 0xfaff) || // CJK 호환 한자
        (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK 호환 기호
        (cp >= 0xff00 && cp <= 0xff60) || // 전각 형태
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f300 && cp <= 0x1f64f) || // 이모지 (Misc Symbols and Pictographs)
        (cp >= 0x1f900 && cp <= 0x1f9ff) // 이모지 (Supplemental Symbols and Pictographs)
    );
}

/**
 * title 폭 상한. Google 데스크톱 예산 58~60에서 안전 여유를 둔 값이다.
 *
 * 이 상한은 **안전망**이지 상시 절단 수단이 아니다. 정상 템플릿은 클램프 없이
 * 통과해야 하며, `ASE 테크놀로지 홀딩스(ASX)`(26 폭단위) 같은 예외적으로 긴
 * 한국어명에서만 발동한다.
 */
export const SEO_TITLE_MAX_WIDTH = 55;

/**
 * 폭 상한을 넘으면 어절 경계에서 잘라 말줄임표를 붙인다.
 *
 * 말줄임표 자체가 1 폭단위를 쓰므로 예산에서 미리 뺀다. 공백이 없어 경계를
 * 찾지 못하면 폭 기준으로 그냥 자른다(무한정 길어지는 것보다 낫다).
 *
 * `maxWidth`가 1 미만이면 말줄임표(1 폭단위)조차 담을 자리가 없으므로
 * 빈 문자열을 반환한다 — 그 외에는 예산이 0 밑으로 내려가지 않도록
 * `Math.max(0, maxWidth - 1)`로 방어한다.
 */
export function clampSeoTitle(
    title: string,
    maxWidth: number = SEO_TITLE_MAX_WIDTH
): string {
    if (seoTitleWidth(title) <= maxWidth) return title;
    if (maxWidth < 1) return '';

    const budget = Math.max(0, maxWidth - 1);
    const chars = [...title];
    let width = 0;
    let cut = 0;
    // reduce 대신 for loop을 쓰는 이유: 조기 break와 index(cut = i + 1)가
    // 핵심 로직이라 for loop을 유지한다.
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === undefined) break;
        const w = seoTitleWidth(ch);
        if (width + w > budget) break;
        width += w;
        cut = i + 1;
    }

    const head = chars.slice(0, cut).join('');
    const lastSpace = head.lastIndexOf(' ');
    const body = lastSpace > 0 ? head.slice(0, lastSpace) : head;
    return `${body.trimEnd()}…`;
}
