import type { ApiToolArgument } from '@/entities/siglens-api-key/model';
import { cn } from '@/shared/lib/cn';
import { formatEnumValues, splitEnumPreview } from '../../lib/toolReference';
import type { DevelopersTranslator } from '../../types';
import {
    TABLE,
    TABLE_BODY_ROW,
    TABLE_HEAD_ROW,
    TABLE_ROW_HEADER,
    TABLE_SCROLL_REGION,
} from '../developersStyles';

const TYPE_CLASS =
    'mt-0.5 block font-mono text-xs break-words text-secondary-400';

interface ArgumentTypeProps {
    readonly arg: ApiToolArgument;
    readonly t: DevelopersTranslator;
}

/**
 * 인자 타입 칸. 긴 열거형은 앞부분만 보이고 나머지는 네이티브 disclosure로 접는다 — 키보드·스크린리더 동작을 브라우저가
 * 맡고, JS 없이도 본문이 크롤된다. 칸 안의 줄은 CSS(`block`)로만 갈리므로 사이에 공백 텍스트를 둔다.
 */
function ArgumentType({ arg, t }: ArgumentTypeProps) {
    const split = splitEnumPreview(arg.enumValues);
    if (split === null) return <span className={TYPE_CLASS}>{arg.type}</span>;
    return (
        <>
            <span className={TYPE_CLASS}>
                {arg.array === true ? 'array of ' : ''}
                {formatEnumValues(split.preview)}
            </span>{' '}
            <details className="mt-0.5">
                <summary className="cursor-pointer text-xs text-secondary-300 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none">
                    {t('tools.enumMore', { count: split.rest.length })}
                </summary>{' '}
                <span className="mt-1 block font-mono text-xs break-words text-secondary-400">
                    {formatEnumValues(split.rest)}
                </span>
            </details>
        </>
    );
}

interface Props {
    readonly t: DevelopersTranslator;
    readonly toolName: string;
    readonly args: readonly ApiToolArgument[];
}

/**
 * 도구 하나의 인자 표. 이름 칸에 타입과 필수 여부를 함께 담는다 — 열을 셋으로 나누면 열거형 타입이 긴 도구
 * (`get_news`의 `category`)가 좁은 화면에서 표를 가로로 밀어낸다. 인자 설명은 코어가 쓴 영어 원문이라 `lang="en"`이다.
 * 인자가 없으면 빈 표 대신 그렇다고 적는다.
 */
export function ArgumentTable({ t, toolName, args }: Props) {
    if (args.length === 0)
        return (
            <p className="mt-2 text-sm text-secondary-400">
                {t('tools.noArgs')}
            </p>
        );
    const caption = t('tools.argsCaption', { name: toolName });
    return (
        <div
            role="region"
            aria-label={caption}
            tabIndex={0}
            className={cn('mt-2', TABLE_SCROLL_REGION)}
        >
            <table className={TABLE}>
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr className={TABLE_HEAD_ROW}>
                        <th
                            scope="col"
                            className="w-2/5 py-2 pr-3 font-semibold"
                        >
                            {t('tools.colArgument')}
                        </th>
                        <th scope="col" className="py-2 font-semibold">
                            {t('tools.colDescription')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {args.map(arg => (
                        <tr key={arg.name} className={TABLE_BODY_ROW}>
                            <th scope="row" className={TABLE_ROW_HEADER}>
                                <code className="font-mono text-[13px] font-semibold text-secondary-100">
                                    {arg.name}
                                </code>{' '}
                                <ArgumentType arg={arg} t={t} />{' '}
                                <span className="mt-0.5 block text-xs text-secondary-400">
                                    {arg.required
                                        ? t('tools.required')
                                        : t('tools.optional')}
                                </span>
                            </th>
                            <td
                                lang="en"
                                className="max-w-prose py-2.5 pl-1 leading-6 break-words text-secondary-300"
                            >
                                {arg.description}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
