import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';

const BLOCK =
    'animate-pulse rounded bg-secondary-700/40 motion-reduce:animate-none';

/** 자리 블록 하나 — `id`는 같은 크기가 반복돼도 겹치지 않는 React key다. */
interface SkeletonBlock {
    id: string;
    size: string;
}

/** 본문 위쪽 두 열(게이지 열·그룹 열)의 자리. 실제 본문의 섹션 순서를 따른다. */
const TOP_COLUMNS: ReadonlyArray<{
    id: string;
    blocks: ReadonlyArray<SkeletonBlock>;
}> = [
    {
        id: 'gauge',
        blocks: [
            { id: 'heading', size: 'h-4 w-40' },
            { id: 'hero', size: 'h-48 w-full' },
            { id: 'comparison', size: 'h-16 w-full' },
        ],
    },
    {
        id: 'groups',
        blocks: [
            { id: 'group-1', size: 'h-20 w-full' },
            { id: 'group-2', size: 'h-20 w-full' },
        ],
    },
];

/** 아래쪽 추이 차트 섹션의 자리. */
const CHART_BLOCKS: ReadonlyArray<SkeletonBlock> = [
    { id: 'heading', size: 'h-4 w-32' },
    { id: 'chart', size: 'h-40 w-full' },
];

function renderBlocks(blocks: ReadonlyArray<SkeletonBlock>) {
    return blocks.map(block => (
        <div key={block.id} className={cn(block.size, BLOCK)} />
    ));
}

/** seed가 없을 때 서버·첫 클라 렌더와, 브라우저 조회가 끝나기 전의 Suspense fallback. */
export function FearGreedPageSkeleton() {
    const t = useTranslations('widgets.fear-greed');
    return (
        <div
            role="status"
            className="flex flex-col gap-6 p-4 md:p-6"
            aria-busy="true"
            aria-label={t('FearGreedPage.7da634')}
        >
            <div className="grid gap-6 md:grid-cols-2">
                {TOP_COLUMNS.map(column => (
                    <section key={column.id} className="flex flex-col gap-3">
                        {renderBlocks(column.blocks)}
                    </section>
                ))}
            </div>
            <section className="flex flex-col gap-2">
                {renderBlocks(CHART_BLOCKS)}
            </section>
        </div>
    );
}
