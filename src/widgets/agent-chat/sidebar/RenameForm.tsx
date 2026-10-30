'use client';

/**
 * 대화 행의 인라인 이름 바꾸기 폼 — Enter로 제출, Escape로 취소.
 */
import { useTranslations } from 'next-intl';
import type { KeyboardEvent, RefObject } from 'react';

interface RenameFormProps {
    readonly value: string;
    readonly inputRef: RefObject<HTMLInputElement | null>;
    readonly onChange: (title: string) => void;
    readonly onSubmit: () => void;
    readonly onCancel: () => void;
}

/**
 * 제목 입력 한 칸을 그린다. 서버 액션은 부모가 부르므로 JS 없는 제출 경로가 없다.
 * 취소는 명시적인 Escape만 받는다 — `onBlur` 취소는 포커스가 어떤 이유로든 움직이면
 * (스크린 리더 가상 커서 등) 사용자가 버리지 않은 편집을 버린다.
 */
export function RenameForm({
    value,
    inputRef,
    onChange,
    onSubmit,
    onCancel,
}: RenameFormProps) {
    const t = useTranslations('widgets.agent-chat');
    return (
        // react-doctor-disable-next-line react-doctor/no-prevent-default
        <form
            className="flex-1"
            onSubmit={e => {
                e.preventDefault();
                onSubmit();
            }}
        >
            <input
                ref={inputRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key !== 'Escape') return;
                    e.preventDefault();
                    onCancel();
                }}
                aria-label={t('Sidebar.586a5c')}
                className="w-full rounded border border-border-control bg-secondary-900 px-1.5 py-0.5 text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            />
        </form>
    );
}
