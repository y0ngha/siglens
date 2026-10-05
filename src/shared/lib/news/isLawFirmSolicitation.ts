/**
 * 원고 측 로펌의 "투자자 모집" 보도자료 판별.
 *
 * FMP 시장 뉴스(`general`/`stock`)는 `ROSEN, A LEADING INVESTOR RIGHTS FIRM,
 * Encourages … Investors to Secure Counsel Before Deadline` 같은 로펌 홍보 문구가
 * 피드를 통째로 채운다. 사건 보도가 아니라 집단소송 원고 모집 광고라서 독자에게
 * 정보가 없고, 카드 분석 LLM 호출과 지면만 쓴다.
 *
 * 판정은 **두 조건의 곱**이다. 한쪽만 보면 오탐이 난다 —
 * - 로펌 이름만: `Rosenblatt`·`Bernstein` 같은 증권사 리서치 기사가 걸린다
 *   (그래서 이름은 단어 경계로 매칭한다).
 * - 소송 용어만: `Boeing settles shareholder class action` 같은 **정상 사건 보도**가 걸린다.
 *
 * A1 + B. 알려진 원고 측 로펌 **이름**(문자 그대로 로펌 형태 — `Portnoy`가 아니라
 *    `Portnoy Law`) + 소송 용어(집단소송·원고 모집 등)
 * A2 + B'. 투자자·주주를 향한 권유 동사 + **로펌 영업 문구**(`secure counsel`·`lead
 *    plaintiff`·`investor counsel`·`law firm`). 권유 동사 경로는 일반 소송 용어
 *    (`class action`, `securities fraud`)와는 곱하지 않는다 — 규제기관·언론 기사가 걸린다.
 *
 * **영문 원제목에만 쓴다.** 번역된 제목(`titleKo`)에는 이 정규식이 맞지 않는다 —
 * 호출부는 FMP 원본(`title`)이나 DB의 `title_en`을 넘겨야 한다.
 *
 * 종목별 뉴스(`entities/news-article`)에는 적용하지 않는다: 그 종목 보유자에게는
 * 소송 소식이 정보일 수 있다.
 */
const KNOWN_PLAINTIFF_FIRM =
    /\b(ROSEN|POMERANTZ|LEVI\s*&\s*KORSINSKY|BRAGAR\s+EAGEL|FARUQI\s*&\s*FARUQI|BRONSTEIN,?\s+GEWIRTZ|GLANCY\s+PRONGAY|KESSLER\s+TOPAZ|ROBBINS\s+GELLER|SCHALL\s+LAW|GROSS\s+LAW|PORTNOY\s+LAW|KIRBY\s+MCINERNEY|BERNSTEIN\s+LIEBHARD|JOHNSON\s+FISTEL|BLOCK\s*&\s*LEVITON|HOLZER\s*&\s*HOLZER|FRANK\s+R\.?\s+CRUZ|HOWARD\s+G\.?\s+SMITH|KAHN\s+SWICK)\b/i;

const SOLICITATION_TO_INVESTORS =
    /\b(encourages|reminds|urges|alerts|notifies|invites)\b.{0,120}\b(investors|shareholders)\b/i;

/** 소송 용어 전반 — 알려진 로펌 이름(A1)과 함께일 때만 쓴다. */
const LITIGATION_TERM =
    /\b(class\s+action|lead\s+plaintiff|secure\s+counsel|investor\s+counsel|law\s+firm|securities\s+(fraud|litigation))\b/i;

/**
 * 로펌 **영업 문구** 전용 용어. 권유 동사(A2)는 규제기관·펀드·언론 문장에도 흔해서
 * (`SEC alerts investors to securities fraud scheme`, `Regulator urges shareholders to
 * join class action settlement`) 일반 소송 용어와 곱하면 정상 기사가 걸린다. 원고 모집
 * 광고에만 나오는 표현으로 좁힌다.
 */
const FIRM_SOLICITATION_TERM =
    /\b(secure\s+counsel|lead\s+plaintiff|investor\s+counsel|law\s+firm)\b/i;

export function isLawFirmSolicitation(title: string): boolean {
    const byKnownFirm =
        KNOWN_PLAINTIFF_FIRM.test(title) && LITIGATION_TERM.test(title);
    const byVerb =
        SOLICITATION_TO_INVESTORS.test(title) &&
        FIRM_SOLICITATION_TERM.test(title);
    return byKnownFirm || byVerb;
}
