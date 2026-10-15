'use client';

import { useTranslations } from 'next-intl';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';

type CopyState = 'copied' | 'failed' | 'idle';

function copyStateOf(copied: boolean, failed: boolean): CopyState {
    if (copied) return 'copied';
    if (failed) return 'failed';
    return 'idle';
}

interface CodeBlockProps {
    /** 복사되는 원문이자 화면에 그대로 보이는 텍스트. */
    readonly code: string;
    /** 블록 이름(스크롤 영역의 접근성 이름) — 예: `curl 예시`. */
    readonly label: string;
    /** 막대에 보이는 언어 표지(`bash`, `json`). 번역하지 않는 기술 식별자다. */
    readonly language?: string;
}

/**
 * 복사 버튼이 달린 코드 블록. 코드는 서버 렌더 텍스트라 JS 없이도 읽히고, 버튼만 하이드레이션 뒤에 동작한다.
 *
 * 긴 줄은 줄바꿈하지 않고 가로 스크롤한다(curl의 `\` 이음이 깨지지 않게). 스크롤 영역(`pre`)은 키보드로
 * 닿아야 해서 이름 붙은 `region`에 `tabIndex={0}`을 둔다. 복사 결과는 `role="status"` 영역으로 알린다 — 버튼 글자만
 * 바뀌면 스크린리더가 변화를 말하지 않는다.
 */
export function CodeBlock({ code, label, language }: CodeBlockProps) {
    const t = useTranslations('shared.ui');
    const { copied, failed, copy } = useCopyToClipboard();
    // 결과가 버튼 글자와 상태 영역에 같이 나가야 보는 사람과 듣는 사람이 같은 결과를 안다.
    const status = {
        copied: t('CodeBlock.copied'),
        failed: t('CodeBlock.copyFailed'),
        idle: '',
    }[copyStateOf(copied, failed)];
    const actionText = status === '' ? t('CodeBlock.copy') : status;
    return (
        <div className="overflow-hidden rounded-lg border border-border-control bg-secondary-950">
            <div className="flex items-center justify-between gap-2 border-b border-secondary-700 py-1.5 pr-1.5 pl-3">
                <span className="font-mono text-xs text-secondary-400">
                    {language}
                </span>
                <button
                    type="button"
                    onClick={() => void copy(code)}
                    // 한 페이지에 복사 버튼이 수십 개라 이름이 같으면 구분할 수 없다 — 어느 블록의 버튼인지 이름에 싣는다.
                    // 보이는 글자(`복사`·`복사됨`)로 시작해 label-in-name을 지킨다.
                    aria-label={t('CodeBlock.buttonLabel', {
                        action: actionText,
                        label,
                    })}
                    className={cn(BUTTON_OUTLINE, 'h-8 px-3 text-xs')}
                >
                    {actionText}
                </button>
            </div>
            <pre
                // 가로 스크롤 영역이 키보드로 닿아야 한다(WCAG 2.1.1) — 저장소 규약대로 `region` + `tabIndex={0}`.
                role="region"
                aria-label={label}
                tabIndex={0}
                className="overflow-x-auto px-3 py-3 font-mono text-xs leading-6 text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none focus-visible:ring-inset"
            >
                <code>{code}</code>
            </pre>
            <span role="status" aria-live="polite" className="sr-only">
                {status}
            </span>
        </div>
    );
}
