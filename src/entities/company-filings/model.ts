export type CompanyFilingForm = '8-K' | '8-K/A' | '6-K';

/** 8-K 항목 코드와 영어 라벨. 라벨 표에 없는 코드는 `label`이 코드 그대로다. */
export interface CompanyFilingItem {
    code: string;
    label: string;
}

export interface CompanyFiling {
    /** 대시가 있는 접수번호 (`0001193125-26-461016`). */
    accession: string;
    form: CompanyFilingForm;
    /** SEC 접수일 `YYYY-MM-DD` (미국 동부 달력 날짜, 제출 목록이 주는 그대로). */
    filedAt: string;
    /** 8-K 항목. 6-K는 항목이 없어 `[]`. */
    items: CompanyFilingItem[];
    headline: string | null;
    hasPressRelease: boolean;
    /** `text`가 나오는(또는 나올) 문서의 사람이 여는 SEC 주소. */
    url: string;
}

export type CompanyFilingDocument = 'press_release' | 'primary';

export interface CompanyFilingBody extends CompanyFiling {
    document: CompanyFilingDocument;
    text: string;
    truncated: boolean;
    totalChars: number;
}

/** 제출 목록(`filings.recent`)의 한 행. 캐시에 그대로 들어가므로 JSON 직렬화 가능한 값만 가진다. */
export interface SubmissionFiling {
    accession: string;
    form: CompanyFilingForm;
    filedAt: string;
    primaryDocument: string;
    items: CompanyFilingItem[];
}

/** 공시 하나의 읽을 문서와 제목. 접수된 공시는 바뀌지 않으므로 접수번호 키로 길게 캐시한다. */
export interface FilingMeta {
    fileName: string;
    document: CompanyFilingDocument;
    headline: string | null;
}

/**
 * 공시 하나에서 문서 앞부분(head) 한 번으로 얻는 전부: 읽을 문서, 제목, 그리고 이미 잘라 둔 본문.
 * `totalChars`는 문서 전체가 아니라 **읽은 앞부분**을 정제한 길이다(문서가 head 상한보다 크면 그만큼만 안다).
 */
export interface FilingDocument extends FilingMeta {
    text: string;
    truncated: boolean;
    totalChars: number;
}
