import type { CompanyFilingItem } from '../model';

/**
 * 8-K 항목 코드 → 영어 라벨. 모델이 읽는 값이라 영어 고정이다(화면용 4개 로케일 라벨은 별개).
 * `9.01`(재무제표·첨부 목록)은 "첨부가 있다"는 뜻일 뿐 내용을 말해 주지 않아 싣지 않는다.
 */
const ITEM_LABELS: Readonly<Record<string, string>> = {
    '1.01': 'Entry into a material agreement',
    '1.02': 'Termination of a material agreement',
    '1.03': 'Bankruptcy or receivership',
    '2.01': 'Completion of an acquisition or disposition of assets',
    '2.02': 'Results of operations and financial condition',
    '2.03': 'Creation of a direct financial obligation',
    '2.05': 'Costs of exit or disposal activities',
    '2.06': 'Material impairments',
    '3.01': 'Notice of delisting or listing-rule failure',
    '3.02': 'Unregistered sales of equity securities',
    '3.03': 'Material modification to rights of security holders',
    '4.01': 'Change of certifying accountant',
    '4.02': 'Non-reliance on previously issued financial statements',
    '5.01': 'Change in control',
    '5.02': 'Departure or appointment of directors or officers',
    '5.03': 'Amendments to articles or bylaws',
    '5.07': 'Shareholder vote results',
    '7.01': 'Regulation FD disclosure',
    '8.01': 'Other events',
};

const OMITTED_ITEM_CODE = '9.01';

/** 제출 목록의 `items` 문자열(`"2.01,2.02,9.01"`)을 `{code, label}` 배열로 만든다. 빈 값(6-K)은 `[]`. */
export function filingItems(itemsCsv: string): CompanyFilingItem[] {
    return itemsCsv
        .split(',')
        .map(code => code.trim())
        .filter(code => code !== '' && code !== OMITTED_ITEM_CODE)
        .map(code => ({ code, label: ITEM_LABELS[code] ?? code }));
}
