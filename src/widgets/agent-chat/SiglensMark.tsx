import Image from 'next/image';
import { cn } from '@/shared/lib/cn';

/**
 * The siglens logo in a quiet tile — the assistant's avatar and the landing's
 * mark. Same `icon96.png` the header lockup renders, so the product visibly
 * belongs to siglens instead of wearing a generic "AI" circle.
 */
export function SiglensMark({
    size = 'sm',
    className,
}: {
    readonly size?: 'sm' | 'lg';
    readonly className?: string;
}) {
    const px = size === 'lg' ? 28 : 16;
    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex shrink-0 items-center justify-center rounded-lg border border-secondary-700 bg-secondary-800 select-none',
                size === 'lg' ? 'size-12' : 'size-7',
                className
            )}
        >
            <Image
                src="/icon96.png"
                alt=""
                width={px}
                height={px}
                className={size === 'lg' ? 'size-7' : 'size-4'}
            />
        </span>
    );
}
