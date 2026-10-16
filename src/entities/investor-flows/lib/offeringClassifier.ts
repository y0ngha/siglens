import type { OfferingKind } from '../model';

/** 분류에 쓰는 본문 길이(태그를 지운 글자 수). 표지·요약 앞부분에 판매 방식이 나온다. */
export const OFFERING_CLASSIFY_WINDOW_CHARS = 10_000;
/** 표지(첫머리) — 채권 발행인지 가르는 데 쓴다. */
const COVER_WINDOW_CHARS = 2_000;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    rsquo: "'",
    lsquo: "'",
    ldquo: '"',
    rdquo: '"',
    ndash: '-',
    mdash: '-',
    shy: '',
};

/** 하이픈 계열(‐ ‑ ‒ – — −)과 줄바꿈 없는 공백 — `at‑the‑market`을 `at-the-market`으로 맞춘다. */
const HYPHEN_LIKE = /[‐-―−]/g;
const NON_BREAKING_SPACE = /[   ]/g;

const MAX_CODE_POINT = 0x10ffff;

/** 숫자 엔티티의 코드 포인트 → 글자. 범위 밖이면(`String.fromCodePoint`가 던진다) 원문을 둔다. */
function fromCodePointOr(codePoint: number, fallback: string): string {
    return Number.isInteger(codePoint) &&
        codePoint >= 0 &&
        codePoint <= MAX_CODE_POINT
        ? String.fromCodePoint(codePoint)
        : fallback;
}

function decodeEntities(text: string): string {
    return text.replace(
        /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
        (whole, body: string) => {
            if (/^#x/i.test(body)) {
                return fromCodePointOr(
                    Number.parseInt(body.slice(2), 16),
                    whole
                );
            }
            if (body.startsWith('#')) {
                return fromCodePointOr(Number(body.slice(1)), whole);
            }
            return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
        }
    );
}

/**
 * 제출 문서(제출 `.txt`의 머리 또는 `.htm`) → 본문 글자. SEC 헤더가 있으면 첫 `<TEXT>` 뒤부터 보고, 태그를 공백으로 지우고,
 * 엔티티를 풀고, 하이픈·공백 변형을 맞춘 뒤 공백을 하나로 접는다.
 */
export function offeringDocumentText(raw: string): string {
    const textStart = raw.search(/<TEXT>/i);
    const body = textStart === -1 ? raw : raw.slice(textStart);
    return decodeEntities(body.replace(/<[^>]*>/g, ' '))
        .replace(HYPHEN_LIKE, '-')
        .replace(NON_BREAKING_SPACE, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const ATM =
    /at-the-market|at the market offering|equity distribution agreement|sales agreement/i;
const UNDERWRITER = /\bunderwriters?\b/i;
const PLACEMENT_AGENT = /\bplacement agents?\b/i;
const DEBT_COVER =
    /\bnotes due\b|\bsenior notes\b|\bsubordinated notes\b|\bdebentures\b/i;
const EQUITY_COVER =
    /common stock|common shares|ordinary shares|depositary|\bunits\b|warrants/i;

/**
 * `424B5`(일괄 신고 기반 투자설명서 보충) 판매 방식 분류 — 본문 앞 `OFFERING_CLASSIFY_WINDOW_CHARS`자만 본다
 * (SEC는 Range 요청을 무시해 문서 전체가 400~700KB다 — 머리만 받는다, `fetchFilingDocumentHead`).
 *
 *  1. 표지(앞 2,000자)가 채권(`notes due`·`senior notes`·`debentures`)이고 주식 표기가 없으면 `other` — 은행·대기업 채권
 *     발행(2026-10-15 State Street 사례)은 인수단(underwriter)이 있어도 주식 희석이 아니다.
 *  2. `at-the-market`·`Equity Distribution Agreement`·`Sales Agreement` → `atm`(ATM 문서는 판매 대리인이 "underwriter로 볼 수
 *     있다"는 문구를 흔히 담으므로 먼저 본다).
 *  3. `underwriter`와 `placement agent` 중 **먼저 나오는** 쪽 → `underwritten` / `best_efforts`.
 *  4. 그 밖은 `other`.
 * 실측 4건(2026-10-15 제출): HeartSciences → atm, Recursion → underwritten, WF Holding → best_efforts, State Street(채권) → other.
 */
export function classify424B5(
    raw: string
): Extract<OfferingKind, 'atm' | 'underwritten' | 'best_efforts' | 'other'> {
    const text = offeringDocumentText(raw).slice(
        0,
        OFFERING_CLASSIFY_WINDOW_CHARS
    );
    const cover = text.slice(0, COVER_WINDOW_CHARS);
    if (DEBT_COVER.test(cover) && !EQUITY_COVER.test(cover)) return 'other';
    if (ATM.test(text)) return 'atm';
    const underwriterAt = text.search(UNDERWRITER);
    const placementAt = text.search(PLACEMENT_AGENT);
    if (underwriterAt === -1 && placementAt === -1) return 'other';
    if (placementAt === -1) return 'underwritten';
    if (underwriterAt === -1) return 'best_efforts';
    return underwriterAt < placementAt ? 'underwritten' : 'best_efforts';
}
