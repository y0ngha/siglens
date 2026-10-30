/**
 * ai.siglens.io 진입 링크의 세 가지 모양. 목적지·이름 계산은 `AiNavLink`가 맡고 여기는 그리기만 한다.
 */
import { cn } from '@/shared/lib/cn';
import { BetaBadge } from '@/shared/ui/BetaBadge';

export interface AiLinkProps {
    readonly href: string;
    readonly brandLabel: string;
    readonly onAiHost: boolean;
    readonly className?: string;
}

/** 푸터 사이트맵 행의 평문 링크. 보이는 글자가 곧 제품명이라 `aria-label`을 덮어쓰지 않는다. */
export function AiTextLink({
    href,
    brandLabel,
    onAiHost,
    className,
}: AiLinkProps) {
    return (
        <a
            href={href}
            translate="no"
            aria-current={onAiHost ? 'page' : undefined}
            className={className}
        >
            {brandLabel}
        </a>
    );
}

/**
 * 로고 락업의 "AI" 반쪽. 접근 가능한 이름은 항상 "SIGLENS AI Beta"다 — 보이는 건 "AI"와
 * Beta 태그뿐이고("SIGLENS"는 바로 옆 로고), 이름이 보이는 글자를 모두 포함해야 한다
 * (WCAG 2.5.3).
 */
export function AiWordmarkLink({ href, onAiHost, className }: AiLinkProps) {
    return (
        <a
            href={href}
            translate="no"
            aria-label="SIGLENS AI Beta"
            aria-current={onAiHost ? 'page' : undefined}
            className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded px-1 font-mono text-sm font-semibold tracking-[0.15em] text-primary-400 uppercase hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                className
            )}
        >
            AI
            {/* 375px 폰의 로그인 상태 ai 호스트 헤더에는 40px 여유가 없다. 그 폭에서는
                랜딩의 eyebrow와 입력창 안내가 Beta를 대신 알린다. */}
            <BetaBadge
                className={onAiHost ? 'max-[399px]:hidden' : undefined}
            />
        </a>
    );
}

/** 모바일 드로어의 라벨 달린 알약형 항목. */
export function AiPillLink({
    href,
    brandLabel,
    onAiHost,
    className,
}: AiLinkProps) {
    return (
        <a
            href={href}
            translate="no"
            aria-label={`${brandLabel} Beta`}
            aria-current={onAiHost ? 'page' : undefined}
            className={cn(
                'inline-flex min-h-11 items-center rounded-full border border-border-control px-3 text-sm font-medium text-primary-300 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                onAiHost && 'bg-secondary-800 text-secondary-100',
                className
            )}
        >
            {brandLabel}
            <BetaBadge className="ml-1.5" />
        </a>
    );
}
