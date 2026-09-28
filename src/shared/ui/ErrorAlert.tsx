import type { ReactNode } from 'react';

interface ErrorAlertProps {
    message: ReactNode;
}

/** 폼 상단의 제출 실패 배너. 필드별 오류는 각 필드가 자기 `aria-describedby`로 단다. */
export function ErrorAlert({ message }: ErrorAlertProps) {
    return (
        <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-ui-danger/30 bg-ui-danger/5 p-3 text-sm text-ui-danger-text"
        >
            <span aria-hidden>⚠</span>
            <p>{message}</p>
        </div>
    );
}
