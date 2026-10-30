import { cn } from '@/shared/lib/cn';
import type { InfoRow } from '../../types';
import {
    TABLE,
    TABLE_BODY_ROW,
    TABLE_HEAD_ROW,
    TABLE_ROW_HEADER,
    TABLE_SCROLL_REGION,
} from '../developersStyles';

interface Props {
    readonly caption: string;
    readonly termHeading: string;
    readonly bodyHeading: string;
    readonly rows: readonly InfoRow[];
    /** 설명 칸이 페이지 언어와 다를 때(영어 원문 오류 설명) 그 언어. */
    readonly bodyLang?: string;
}

/**
 * 이름-설명 두 열 표. 첫 열이 행 머리(`th scope="row"`)라 스크린리더가 행을 이름으로 읽는다.
 * 좁은 화면에서는 가로 스크롤되는 표라 키보드로 닿도록 이름 붙은 `region` + `tabIndex={0}`으로 감싼다.
 */
export function InfoTable({
    caption,
    termHeading,
    bodyHeading,
    rows,
    bodyLang,
}: Props) {
    return (
        <div
            role="region"
            aria-label={caption}
            tabIndex={0}
            className={cn('mt-4', TABLE_SCROLL_REGION)}
        >
            <table className={TABLE}>
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr className={TABLE_HEAD_ROW}>
                        <th
                            scope="col"
                            className="w-1/2 py-2 pr-3 font-semibold sm:w-2/5"
                        >
                            {termHeading}
                        </th>
                        <th scope="col" className="py-2 font-semibold">
                            {bodyHeading}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.term} className={TABLE_BODY_ROW}>
                            <th scope="row" className={TABLE_ROW_HEADER}>
                                <code className="font-mono text-xs font-semibold break-words text-secondary-100 sm:text-[13px]">
                                    {row.term}
                                </code>
                            </th>
                            <td className="py-2.5 leading-6 text-secondary-300">
                                <span lang={bodyLang}>{row.body}</span>
                                {/* 보충 문장은 CSS로만 줄이 갈린다 — 공백이 없으면 텍스트(크롤러·복사)에서 앞 문장과 붙는다. */}
                                {row.note ? (
                                    <>
                                        {' '}
                                        <span className="mt-1 block text-xs text-secondary-400">
                                            {row.note}
                                        </span>
                                    </>
                                ) : null}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
