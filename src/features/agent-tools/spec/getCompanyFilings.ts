import {
    AGENT_TURN_CAPS,
    type AgentToolArgs,
    type AgentToolDefinition,
} from '@y0ngha/siglens-core';
import {
    AGENT_FILINGS_LIST_MAX,
    AGENT_FILINGS_WINDOW_DAYS,
    AGENT_FILING_TEXT_MAX_CHARS,
} from '@/entities/company-filings/lib/companyFilingsConstants';
import { SYMBOL_PROP } from './toolSchema';

/**
 * 공시 **본문**을 읽는 호출(`accession`이 비어 있지 않다)인가. 목록 호출은 세지 않는다 — 본문은 수천 자이고
 * 목록은 그렇지 않아서 `AGENT_TURN_CAPS.maxFilingReads`는 읽기만 센다.
 */
function isFilingRead(args: AgentToolArgs): boolean {
    return typeof args.accession === 'string' && args.accession.trim() !== '';
}

/**
 * `get_company_filings` 도구 명세: 모델이 읽는 설명과 인자 스키마, 루프가 쓰는 턴당 상한.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_COMPANY_FILINGS_SPEC: AgentToolDefinition = {
    name: 'get_company_filings',
    description: `A US-listed company's own recent SEC filings and the text of one of them: current reports (8-K, 8-K/A) and, for foreign issuers, 6-K — its earnings press release, material agreements, acquisitions, financings, executive changes and other announced events. Without \`accession\` it returns \`filings\` (newest first, up to ${AGENT_FILINGS_LIST_MAX}, from the last ${AGENT_FILINGS_WINDOW_DAYS} days): {accession, form, filedAt, items ([{code, label}]: the 8-K item codes and what each means; empty for a 6-K, whose content is told by its headline), headline (the title of the attached press release or of the report; null when it could not be read), hasPressRelease, url}. With \`accession\` (copied exactly from that list) it returns \`filing\`: the same fields plus {document (press_release or primary), text, truncated, totalChars} — the filed text itself. To read a filing, call without \`accession\` first, pick the filing whose items and headline match the question, then call again with its \`accession\` in the next step. At most ${AGENT_TURN_CAPS.maxFilingReads} filing texts can be read per turn; a further read is refused with a per-turn quota error, so answer from what you have. \`accession\` is the number exactly as listed (dashes optional); an empty value lists filings. Quote figures and wording as the text gives them, say it is the company's announcement filed with the SEC on \`filedAt\` (name the form), keep the text's own GAAP versus adjusted (non-GAAP) labels, and never present it as SIGLENS's view. When \`truncated\` is true the text is only the opening part of the filing (the first ${AGENT_FILING_TEXT_MAX_CHARS} characters): say once that the answer reads the opening part, and never state that something is absent from the filing. An empty \`filings\` list means the company filed none of these reports in the period: say so. \`available: false\` with reason no_sec_filer means the company does not file these reports with the SEC (Korean stocks, crypto): answer from the other tool results without mentioning the SEC. An error unknown_filing means the accession is not in the recent list: answer from the list you already have instead of retrying. Call for the details of what a company announced — figures, guidance or the reason behind a number in an earnings release, the terms of a contract, acquisition, share offering or financing, who was appointed or left, and "what did the company file or announce" (공시, 8-K, 보도자료 원문, 실적 발표 내용, 가이던스, 계약 조건, 인수 조건, 임원 변경). Not for analyst opinions or prices, and not for the quarterly EPS and revenue figures get_fundamentals already returns.`,
    costClass: 'cached',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: SYMBOL_PROP,
            accession: {
                type: 'string',
                description:
                    'Accession number of one filing from the list (e.g. 0001193125-26-461016); omit to list recent filings',
            },
        },
        required: ['symbol'],
        additionalProperties: false,
    },
    perTurn: { max: AGENT_TURN_CAPS.maxFilingReads, counts: isFilingRead },
};
