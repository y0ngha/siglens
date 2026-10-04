'use client';

import { cn } from '@/shared/lib/cn';

/** 질문(오른쪽 말풍선)과 답변(왼쪽 본문)이 번갈아 오는 대화의 첫 화면 모양. */
const ROWS = [
    { side: 'user', widths: ['w-2/5'] },
    { side: 'assistant', widths: ['w-full', 'w-11/12', 'w-4/5', 'w-2/3'] },
    { side: 'user', widths: ['w-1/3'] },
    { side: 'assistant', widths: ['w-full', 'w-5/6', 'w-3/5'] },
] as const;

const BAR = 'h-4 rounded bg-secondary-700 motion-safe:animate-pulse';

/**
 * 사이드바에서 다른 대화를 누른 순간 본문 자리에 그리는 골격.
 *
 * 대화 전환은 서버가 그 대화를 렌더해 보낼 때까지 커밋되지 않는다(`Sidebar`의
 * `router.push` 전환). 예전에는 그동안 누른 줄만 흐려지고 본문에는 **떠나온 대화가**
 * 그대로 남아 있었다. 메시지 목록과 같은 폭·여백(`MessageList`)으로 그려 도착할 때
 * 좌우로 튀지 않게 한다. 글자가 없는 장식이고, 진행 상태는 사이드바의 상태 문구가 알린다.
 */
export function ConversationSkeleton() {
    return (
        <div
            aria-hidden="true"
            data-conversation-skeleton=""
            className="relative min-h-0 flex-1"
        >
            <div className="absolute inset-0 overflow-hidden">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-8">
                    {ROWS.map((row, i) =>
                        row.side === 'user' ? (
                            <div key={i} className="flex justify-end">
                                <div
                                    className={cn(
                                        'h-10 rounded-lg bg-secondary-800 motion-safe:animate-pulse',
                                        row.widths[0]
                                    )}
                                />
                            </div>
                        ) : (
                            <div key={i} className="space-y-2">
                                {row.widths.map(width => (
                                    <div
                                        key={width}
                                        className={cn(BAR, width)}
                                    />
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
