import { xmlChildText, type XmlElement } from '@/shared/lib/streamXmlElements';
import type { AmendmentType, Sec13fFilingMeta } from '../model';

export interface Sec13fDocumentNames {
    primaryDoc: string | null;
    infoTable: string | null;
}

interface FilingIndexItem {
    name?: unknown;
    size?: unknown;
}

const PRIMARY_DOC_NAME = 'primary_doc.xml';

/**
 * 제출 폴더 `index.json`에서 primary_doc.xml과 information table XML 파일명을 찾는다.
 *
 * information table 파일명은 제출 도구마다 제각각이다(`infotable.xml`, `form13fInfoTable.xml`,
 * `46994_infotable.xml` …) — primary_doc.xml이 아닌 `.xml` 중 **가장 큰 것**을 고른다
 * (폴더 루트의 `.xml`은 이 둘뿐이고, 렌더링용 XSL 결과는 하위 폴더에 있어 목록에 안 나온다).
 * 크기를 모르면(빈 문자열) 0으로 본다.
 */
export function pickSec13fDocuments(indexJson: unknown): Sec13fDocumentNames {
    const items =
        typeof indexJson === 'object' && indexJson !== null
            ? ((indexJson as { directory?: { item?: unknown } }).directory
                  ?.item ?? [])
            : [];
    if (!Array.isArray(items)) return { primaryDoc: null, infoTable: null };

    let primaryDoc: string | null = null;
    let infoTable: { name: string; size: number } | null = null;
    for (const item of items as FilingIndexItem[]) {
        if (typeof item?.name !== 'string') continue;
        const name = item.name;
        const lower = name.toLowerCase();
        if (lower === PRIMARY_DOC_NAME) {
            primaryDoc = name;
            continue;
        }
        if (!lower.endsWith('.xml')) continue;
        const size = Number(item.size);
        const bytes = Number.isFinite(size) ? size : 0;
        if (infoTable === null || bytes > infoTable.size) {
            infoTable = { name, size: bytes };
        }
    }
    return { primaryDoc, infoTable: infoTable?.name ?? null };
}

/** `MM-DD-YYYY`(13F XML 형식) 또는 `YYYY-MM-DD` → `YYYY-MM-DD`. 그 밖은 null. */
export function parseSecDate(raw: string | null): string | null {
    if (raw === null) return null;
    const us = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
    if (us !== null) return `${us[3]}-${us[1]}-${us[2]}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function toAmendmentType(raw: string | null): AmendmentType | null {
    const normalized = raw?.trim().toUpperCase().replace(/\s+/g, ' ');
    if (normalized === 'RESTATEMENT') return 'RESTATEMENT';
    if (normalized === 'NEW HOLDINGS') return 'NEW HOLDINGS';
    return null;
}

/**
 * primary_doc.xml(루트 `edgarSubmission`)에서 제출 메타를 읽는다. 필러 이름은 `filingManager/name`,
 * 분기는 `periodOfReport`(없으면 `reportCalendarOrQuarter`)다 — 제출일이 아니다.
 */
export function parseSec13fPrimaryDoc(root: XmlElement): Sec13fFilingMeta {
    const amendmentFlag = xmlChildText(
        root,
        'formData',
        'coverPage',
        'isAmendment'
    );
    return {
        submissionType:
            xmlChildText(root, 'headerData', 'submissionType') ?? '',
        period: parseSecDate(
            xmlChildText(root, 'headerData', 'filerInfo', 'periodOfReport') ??
                xmlChildText(
                    root,
                    'formData',
                    'coverPage',
                    'reportCalendarOrQuarter'
                )
        ),
        isAmendment: amendmentFlag?.toLowerCase() === 'true',
        amendmentType: toAmendmentType(
            xmlChildText(
                root,
                'formData',
                'coverPage',
                'amendmentInfo',
                'amendmentType'
            )
        ),
        filerName: xmlChildText(
            root,
            'formData',
            'coverPage',
            'filingManager',
            'name'
        ),
        reportType: xmlChildText(root, 'formData', 'coverPage', 'reportType'),
    };
}
