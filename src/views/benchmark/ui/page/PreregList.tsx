/**
 * 사전 등록 기록(해시·gist·OpenTimestamps 증명) 정의 목록.
 */
import type { ReactNode } from 'react';
import type { BenchmarkPrereg } from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { BENCHMARK_TEXT_LINK } from './benchmarkPageStyles';

/** 항목 이름과 링크 문구(번역됨). */
export interface PreregText {
    readonly hash: string;
    readonly gist: string;
    readonly ots: string;
    readonly otsLink: string;
}

interface Props {
    readonly prereg: BenchmarkPrereg;
    readonly text: PreregText;
}

/** 항목마다 이름(dt)과 값(dd). 해시는 고정폭, gist·증명 파일은 링크다. */
export function PreregList({ prereg, text }: Props) {
    const rows: readonly {
        readonly key: string;
        readonly term: string;
        readonly value: ReactNode;
    }[] = [
        {
            key: 'hash',
            term: text.hash,
            value: (
                <dd className="font-mono text-xs break-all text-secondary-200">
                    {prereg.combinedSha256}
                </dd>
            ),
        },
        {
            key: 'gist',
            term: text.gist,
            value: (
                <dd>
                    <a
                        href={prereg.gistUrl}
                        rel="noopener"
                        className={cn(BENCHMARK_TEXT_LINK, 'break-all')}
                    >
                        {prereg.gistUrl}
                    </a>
                </dd>
            ),
        },
        {
            key: 'ots',
            term: text.ots,
            value: (
                <dd>
                    <a href={prereg.otsPath} className={BENCHMARK_TEXT_LINK}>
                        {text.otsLink}
                    </a>
                </dd>
            ),
        },
    ];
    return (
        <dl className={cn(SURFACE_CARD, 'grid gap-3 p-4 sm:p-5')}>
            {rows.map(row => (
                <div
                    key={row.key}
                    className="grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)]"
                >
                    <dt className="text-xs font-semibold text-secondary-400">
                        {row.term}
                    </dt>
                    {row.value}
                </div>
            ))}
        </dl>
    );
}
