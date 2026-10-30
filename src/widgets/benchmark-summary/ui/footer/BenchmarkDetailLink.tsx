/** 섹션 끝의 상세 페이지 링크. */
import { cn } from '@/shared/lib/cn';

const TEXT_LINK =
    'inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface Props {
    /** 상세 페이지 절대 URL. */
    readonly href: string;
    readonly label: string;
    /** 링크를 가운데 정렬한다. */
    readonly centered: boolean;
}

/** 텍스트 링크 한 줄. 터치 영역은 44px 높이를 지킨다. */
export function BenchmarkDetailLink({ href, label, centered }: Props) {
    return (
        <p className={cn('mt-4', centered && 'text-center')}>
            <a href={href} className={TEXT_LINK}>
                {label}
            </a>
        </p>
    );
}
