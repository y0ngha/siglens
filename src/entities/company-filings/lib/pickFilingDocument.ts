import type { CompanyFilingDocument } from '../model';

export interface PickedFilingDocument {
    fileName: string;
    document: CompanyFilingDocument;
}

const HTML_FILE = /\.html?$/i;
const FILING_INDEX_PAGE = /-index(?:-headers)?\.html?$/i;
/** XBRL 뷰어가 만드는 `R1.htm`, `R2.htm`… 화면 조각. */
const XBRL_VIEWER_PAGE = /^R\d+\.html?$/i;
const EXHIBIT_99 = /ex(?:hibit)?[-_]?99[-_.]?(\d*)/i;
/** 99번이 아닌 다른 첨부(`ex10_1`, `ex3-1`, `exhibit101`) — 보도자료가 아니다. */
const OTHER_EXHIBIT = /(?:^|[^a-z])ex(?:hibit)?[-_ ]?\d/i;

function itemNames(indexJson: unknown): string[] {
    const directory = (indexJson as { directory?: { item?: unknown } } | null)
        ?.directory;
    const items = directory?.item;
    if (!Array.isArray(items)) return [];
    return items.flatMap(item => {
        const name = (item as { name?: unknown } | null)?.name;
        return typeof name === 'string' && name !== '' ? [name] : [];
    });
}

/** 파일명의 `ex99-<n>`에서 n(없으면 0). 숫자가 작을수록 앞 — `ex99-1`이 `ex99-2`보다 먼저다. */
function exhibitNumber(name: string): number {
    const digits = EXHIBIT_99.exec(name)?.[1];
    return digits ? Number(digits) : 0;
}

/**
 * 제출 폴더의 `index.json`에서 읽을 문서를 고른다.
 *
 * 후보는 주 문서가 아닌 `.htm`/`.html`(색인 페이지·XBRL 뷰어 조각 제외). 우선순위:
 * 1. `ex99` 이름의 첨부(보도자료) — 번호가 낮은 것부터.
 * 2. 다른 첨부(`ex10_1`·`ex5_1` 등 99번이 아닌 번호)를 뺀 후보가 **하나뿐**이면 그것(실측: NVDA 8-K의
 *    `nvidiaannouncesceotransiti.htm`처럼 번호 없는 이름의 보도자료). 계약서·법률의견서 같은 단독 첨부는 보도자료가 아니다.
 * 3. 그 밖에는 주 문서. 후보가 둘 이상인데 ex99가 없으면 어느 것이 본문인지 알 수 없으므로 추측하지 않는다.
 */
export function pickFilingDocument(
    indexJson: unknown,
    primaryDocument: string
): PickedFilingDocument {
    const candidates = itemNames(indexJson).filter(
        name =>
            HTML_FILE.test(name) &&
            name !== primaryDocument &&
            !FILING_INDEX_PAGE.test(name) &&
            !XBRL_VIEWER_PAGE.test(name)
    );
    const exhibits = candidates
        .filter(name => EXHIBIT_99.test(name))
        .toSorted(
            (a, b) => exhibitNumber(a) - exhibitNumber(b) || a.localeCompare(b)
        );
    if (exhibits.length > 0)
        return { fileName: exhibits[0], document: 'press_release' };
    const unnamed = candidates.filter(name => !OTHER_EXHIBIT.test(name));
    if (unnamed.length === 1)
        return { fileName: unnamed[0], document: 'press_release' };
    return { fileName: primaryDocument, document: 'primary' };
}
