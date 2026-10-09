'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { BUTTON_GHOST } from '@/shared/lib/buttonStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { CloseIcon } from '@/shared/ui/StrokeIcons';

export interface ToastLink {
    href: string;
    label: string;
}

export interface ToastContent {
    message: string;
    /** 둘째 줄 보조 문장(병합 토스트의 "M개는 제외했어요"). */
    detail?: string;
    link?: ToastLink;
}

interface ToastProps {
    toast: ToastContent | null;
    onDismiss: () => void;
    /** 호버·포커스가 토스트 안에 있는 동안 true — 자동 닫힘 타이머를 멈추는 데 쓴다. */
    onPauseChange?: (paused: boolean) => void;
}

/*
 * 모바일: 하단 안전 영역 위 전폭. sm 이상: 우하단 w-96. PWA 배너(`z-65`, 좌하단)·Ask-AI
 * FAB(우하단)보다 위(`z-70`)지만 모달(`z-9999`) 아래다.
 * 검색 오버레이·모바일 메뉴도 `z-70`이지만 둘은 `document.body`로 포털되어 앱 루트보다 뒤에
 * 붙으므로, 열려 있는 동안에는 토스트가 그 아래에 깔린다(의도: 전면 메뉴가 토스트를 가린다). `ModalShell` 안에서 띄운 토스트는 모달 백드롭 아래에 깔리니, 모달이 열린
 * 채로 알려야 하는 결과는 모달을 닫은 뒤에 띄운다. 뜨는 것(토스트)이라 그림자를 쓴다 —
 * `surfaceStyles` JSDoc의 그림자 규칙. 등장 애니메이션은 `motion-safe:`로만 걸어
 * `prefers-reduced-motion`을 존중한다(globals.css의 전역 축소 규칙도 함께 적용된다).
 */
const VIEWPORT =
    'pointer-events-none fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-70 flex justify-center sm:inset-x-auto sm:right-4 sm:w-96';
const TOAST_CARD = cn(
    'pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-secondary-700 bg-secondary-900 p-4 text-sm text-secondary-100 shadow-2xl',
    'motion-safe:animate-[fade-in_150ms_ease-out]'
);
const CLOSE_BUTTON = cn(BUTTON_GHOST, 'size-8 shrink-0 rounded');

/**
 * 라이브 영역은 토스트가 없어도 **늘 마운트**한다 — 내용과 같은 순간에 삽입된 `aria-live`
 * 영역은 보조기술이 읽지 않는다(`SuccessNotice`와 같은 이유). 안쪽만 바뀐다.
 */
export function Toast({ toast, onDismiss, onPauseChange }: ToastProps) {
    const t = useTranslations('shared.ui');
    return (
        <div role="status" aria-live="polite" className={VIEWPORT}>
            {toast !== null && (
                <div
                    className={TOAST_CARD}
                    data-testid="toast"
                    onMouseEnter={() => onPauseChange?.(true)}
                    onMouseLeave={() => onPauseChange?.(false)}
                    onFocus={() => onPauseChange?.(true)}
                    onBlur={event => {
                        // 카드 안에서 포커스가 옮겨 다니는 동안(링크 → 닫기)은 멈춘 채로 둔다.
                        if (
                            !event.currentTarget.contains(event.relatedTarget)
                        ) {
                            onPauseChange?.(false);
                        }
                    }}
                >
                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium">
                            {toast.message}
                            {toast.link && (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className="text-secondary-500"
                                    >
                                        {' '}
                                        ·{' '}
                                    </span>
                                    <Link
                                        href={toast.link.href}
                                        prefetch={false}
                                        onClick={onDismiss}
                                        className="font-semibold text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                    >
                                        {toast.link.label}
                                    </Link>
                                </>
                            )}
                        </p>
                        {toast.detail && (
                            <p className="text-secondary-400">{toast.detail}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label={t('toast.close')}
                        className={CLOSE_BUTTON}
                    >
                        <CloseIcon className="size-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
