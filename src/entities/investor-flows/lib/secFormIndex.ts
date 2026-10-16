import type { SecFormIndexEntry } from '../model';

/**
 * form 형식 daily index(`form.YYYYMMDD.idx`) 한 줄:
 *   `<양식>    <회사명>      <CIK>  <YYYYMMDD>  edgar/data/<CIK>/<accession>.txt`
 * 열 너비가 고정이 아니라(회사명이 길면 밀린다) 정규식으로 뒤에서부터 고정 토큰을 맞춘다. 양식 이름은 첫 공백까지다 —
 * `SC 13D`처럼 공백이 든 양식은 첫 토큰(`SC`)만 잡혀 어떤 허용 목록에도 걸리지 않는다(여기서 쓰는 양식에는 공백이 없다).
 */
const INDEX_LINE =
    /^(\S+)\s+(.*?)\s+(\d{1,10})\s+(\d{8})\s+edgar\/data\/\d+\/(\d{10}-\d{2}-\d{6})\.txt\s*$/;

/**
 * daily form index에서 `forms`에 든 양식의 줄만 뽑는다. **accession을 합치지 않는다** — 같은 제출이 발행사·보고자
 * (Form 144)나 공동 등록인(증자 공시) CIK마다 한 줄씩 나오고, 호출부가 그중 유니버스 CIK를 고른다.
 */
export function parseSecFormIndex(
    text: string,
    forms: ReadonlySet<string>
): SecFormIndexEntry[] {
    return text.split('\n').flatMap(line => {
        const match = INDEX_LINE.exec(line);
        if (match === null) return [];
        const [, formType, companyName, cik, filed, accession] =
            match as unknown as [
                string,
                string,
                string,
                string,
                string,
                string,
            ];
        if (!forms.has(formType)) return [];
        return [
            {
                formType,
                companyName: companyName.trim(),
                cik: cik.padStart(10, '0'),
                filingDate: `${filed.slice(0, 4)}-${filed.slice(4, 6)}-${filed.slice(6, 8)}`,
                accession,
            },
        ];
    });
}
