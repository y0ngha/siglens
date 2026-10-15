import type { Sec13fIndexEntry } from '../model';

/**
 * form 형식 daily index 한 줄:
 *   `13F-HR    <회사명>      <CIK>  <YYYYMMDD>  edgar/data/<CIK>/<accession>.txt`
 * 열 너비가 고정이 아니라(회사명이 길면 밀린다) 정규식으로 뒤에서부터 고정 토큰을 맞춘다.
 */
const INDEX_LINE =
    /^(13F-HR(?:\/A)?)\s+(.*?)\s+(\d{1,10})\s+(\d{8})\s+edgar\/data\/\d+\/(\d{10}-\d{2}-\d{6})\.txt\s*$/;

/**
 * daily form index 텍스트에서 `13F-HR`·`13F-HR/A` 제출만 뽑는다. `13F-NT`(보유 없음 통지)·
 * `13F-NT/A`·`13F-CTR`·그 밖의 양식은 버린다. 같은 accession이 두 번 나오면 첫 줄만 쓴다.
 */
export function parseSec13fFormIndex(text: string): Sec13fIndexEntry[] {
    const seen = new Set<string>();
    const entries: Sec13fIndexEntry[] = [];
    for (const line of text.split('\n')) {
        const match = INDEX_LINE.exec(line);
        if (match === null) continue;
        const [, formType, companyName, cik, filed, accession] =
            match as unknown as [
                string,
                Sec13fIndexEntry['formType'],
                string,
                string,
                string,
                string,
            ];
        if (seen.has(accession)) continue;
        seen.add(accession);
        entries.push({
            formType,
            companyName: companyName.trim(),
            cik: cik.padStart(10, '0'),
            filingDate: `${filed.slice(0, 4)}-${filed.slice(4, 6)}-${filed.slice(6, 8)}`,
            accession,
        });
    }
    return entries;
}
