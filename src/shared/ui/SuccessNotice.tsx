'use client';

import { useEffect, useRef } from 'react';

interface SuccessNoticeProps {
    /** `true`가 되면 패널을 채우고 포커스를 옮긴다. 호출부는 같은 값으로 폼을 내린다. */
    show: boolean;
    title: string;
    /** 제목 아래 안내 문단들. */
    messages: readonly string[];
}

/**
 * 제출이 끝나 폼이 통째로 사라지는 자리의 성공 안내.
 *
 * **포커스와 알림을 명시적으로 다룬다.** 성공 패널만 조건부로 반환하면 (1) 포커스를
 * 쥐고 있던 제출 버튼이 언마운트돼 포커스가 `<body>`로 떨어지고, (2) `aria-live`
 * 영역이 내용과 같은 순간에 삽입돼 보조기술에 따라 아무것도 읽지 않는다.
 * 그래서 라이브 영역은 `show`와 무관하게 늘 렌더하고 안쪽만 바꾸며, 패널이 채워지면
 * 포커스를 패널로 옮긴다.
 */
export function SuccessNotice({ show, title, messages }: SuccessNoticeProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (show) panelRef.current?.focus();
    }, [show]);

    return (
        <div role="status" aria-live="polite">
            {show ? (
                <div
                    ref={panelRef}
                    tabIndex={-1}
                    className="space-y-2 rounded-lg border border-secondary-700 bg-secondary-900/60 p-4 text-sm focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <p className="font-semibold text-secondary-100">{title}</p>
                    {messages.map(message => (
                        <p key={message} className="text-secondary-300">
                            {message}
                        </p>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
