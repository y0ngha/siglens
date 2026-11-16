'use client';

/**
 * 뉴스 탭 목록의 "더보기" 버튼 — 애널리스트 의견·최근 공시가 같은 모양·포커스 링을 쓰도록 한 곳에 둔다.
 */
interface ShowMoreButtonProps {
    label: string;
    onClick: () => void;
}

export function ShowMoreButton({ label, onClick }: ShowMoreButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full rounded-lg border border-border-control py-2 text-sm text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
        >
            {label}
        </button>
    );
}
