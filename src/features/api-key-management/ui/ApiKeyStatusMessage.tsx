import { cn } from '@/shared/lib/cn';
import type { ApiKeyActionState } from '@/shared/lib/types';

type SettledStatus = Exclude<ApiKeyActionState['status'], 'idle'>;

const STATUS_TONE_CLASS: Record<SettledStatus, string> = {
    success: 'text-ui-success-text',
    error: 'text-ui-danger-text',
};

interface ApiKeyStatusMessageProps {
    /** 입력·버튼이 `aria-describedby`로 가리키는 id. */
    id: string;
    state: ApiKeyActionState;
    /** 카드 안 위치에 따른 바깥 여백. */
    className?: string;
}

/**
 * 키 저장·삭제 결과 한 줄. 결과가 없을 때도 영역은 그대로 둔다 — 라이브
 * 영역이 문구와 같은 순간에 삽입되면 보조기술이 읽지 않을 수 있다.
 */
export function ApiKeyStatusMessage({
    id,
    state,
    className,
}: ApiKeyStatusMessageProps) {
    return (
        <div
            id={id}
            role="status"
            aria-live="polite"
            className={cn('min-h-5 text-sm', className)}
        >
            {state.status === 'idle' ? null : (
                <span className={STATUS_TONE_CLASS[state.status]}>
                    {state.message}
                </span>
            )}
        </div>
    );
}
