'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';
import { SURFACE_FLOATING } from '@/shared/lib/surfaceStyles';
import { CloseIcon } from '@/shared/ui/StrokeIcons';

// 폼(react-query 훅·서버 액션 참조·입력 컴포넌트)은 홈 첫 로드에 싣지 않는다 — 다이얼로그가
// 열릴 때만 마운트되므로 SSR이 필요 없다.
const RadarRequestForm = dynamic(
    () => import('./RadarRequestForm').then(m => m.RadarRequestForm),
    { ssr: false }
);

/** 다이얼로그 제목 요소 id. `<dialog>`의 `aria-labelledby`가 가리킨다. */
const RADAR_REQUEST_DIALOG_TITLE_ID = 'radar-request-dialog-title';

const TRIGGER_BASE_CLASS =
    'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

interface RadarRequestDialogProps {
    readonly triggerLabel: string;
    readonly triggerClassName?: string;
}

/**
 * 종목 요청 폼을 여는 트리거 버튼 + 네이티브 모달 `<dialog>`.
 *
 * 네이티브 모달이라 포커스 트랩·Esc·비활성 배경이 브라우저 기본 동작이고, 배경 클릭 닫기는
 * `useDialog`가 처리한다. 내용은 열려 있는 동안에만 마운트한다.
 */
export function RadarRequestDialog({
    triggerLabel,
    triggerClassName,
}: RadarRequestDialogProps) {
    const t = useTranslations('features.radar-request');
    const { isOpen, open, close, dialogRef, triggerRef } = useDialog();

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={open}
                className={cn(TRIGGER_BASE_CLASS, triggerClassName)}
            >
                {triggerLabel}
            </button>

            <dialog
                ref={dialogRef}
                aria-labelledby={RADAR_REQUEST_DIALOG_TITLE_ID}
                onClose={close}
                className={cn(
                    SURFACE_FLOATING,
                    'max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto p-0 text-left shadow-2xl backdrop:bg-secondary-950/80 backdrop:backdrop-blur-sm'
                )}
            >
                {isOpen && (
                    <div>
                        <div className="flex items-start justify-between border-b border-secondary-700 px-6 py-5">
                            <div>
                                <h2
                                    id={RADAR_REQUEST_DIALOG_TITLE_ID}
                                    className="text-base font-semibold text-secondary-100"
                                >
                                    {t('dialogTitle')}
                                </h2>
                                <p className="mt-1 text-sm text-secondary-400">
                                    {t('dialogDescription')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={close}
                                aria-label={t('close')}
                                className="-mt-1 -mr-1 rounded p-1 text-secondary-400 transition-colors hover:text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                <CloseIcon />
                            </button>
                        </div>

                        <div className="p-6">
                            <RadarRequestForm />
                        </div>
                    </div>
                )}
            </dialog>
        </>
    );
}
