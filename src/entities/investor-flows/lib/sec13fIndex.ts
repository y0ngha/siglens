import type { Sec13fIndexEntry } from '../model';
import { parseSecFormIndex } from './secFormIndex';

const SEC_13F_FORMS: ReadonlySet<Sec13fIndexEntry['formType']> = new Set([
    '13F-HR',
    '13F-HR/A',
]);

const isSec13fForm = (form: string): form is Sec13fIndexEntry['formType'] =>
    (SEC_13F_FORMS as ReadonlySet<string>).has(form);

/**
 * daily form index 텍스트에서 `13F-HR`·`13F-HR/A` 제출만 뽑는다. `13F-NT`(보유 없음 통지)·
 * `13F-NT/A`·`13F-CTR`·그 밖의 양식은 버린다. 같은 accession이 두 번 나오면 첫 줄만 쓴다.
 */
export function parseSec13fFormIndex(text: string): Sec13fIndexEntry[] {
    const seen = new Set<string>();
    return parseSecFormIndex(text, SEC_13F_FORMS).flatMap(entry => {
        if (seen.has(entry.accession) || !isSec13fForm(entry.formType))
            return [];
        seen.add(entry.accession);
        return [{ ...entry, formType: entry.formType }];
    });
}
