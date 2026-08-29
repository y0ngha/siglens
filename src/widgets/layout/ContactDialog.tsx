'use client';

import { useTranslations } from 'next-intl';
import { ContactForm } from '@/features/contact-form';
import { useEffect } from 'react';
import { applyStoredTheme } from '@/shared/lib/theme';
import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';

const TRIGGER_BASE_CLASS =
    'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

interface ContactDialogProps {
    triggerLabel?: string;
    triggerClassName?: string;
}

export function ContactDialog({
    triggerLabel,
    triggerClassName,
}: ContactDialogProps) {
    const tMisc = useTranslations('shared.ui.misc');
    const t = useTranslations('widgets.layout');
    const resolvedTriggerLabel = triggerLabel ?? tMisc('contact');
    /*
     * **에러 셸의 테마를 여기서 메운다.** 동적 세그먼트에서 `notFound()`를
     * 부르면 Next는 루트 레이아웃을 거치지 않는 `<html id="__next_error__">`
     * 셸을 내보낸다. 그 `<head>`에는 인라인 스크립트가 하나도 없어 `data-theme`이
     * 아예 안 찍히고, 라이트를 고른 사용자가 어두운 404를 본다.
     *
     * 왜 하필 이 컴포넌트인가: 전용 컴포넌트를 만들어 `not-found.tsx`에서
     * 렌더했더니 **홈 라우트 first-load가 17.3KB 늘었다**(실측 +20,803 B,
     * 스크립트 태그 18개 대 17개). not-found 경계에 모듈이 하나 추가되면
     * turbopack이 그 경계가 끌고 오는 홈 위젯 묶음을 "이 모듈을 포함한 판"과
     * "안 포함한 판" 두 벌로 갈라 내보내고, 홈이 둘 다 받는다. 서버 컴포넌트에서
     * `next/dynamic`을 써도 RSC가 이미 클라이언트 경계에서 분할하므로 바뀌지
     * 않는다(두 변형 모두 바이트 동일로 확인). 이미 그 경계에 있는 클라이언트
     * 컴포넌트에 얹으면 모듈이 늘지 않아 비용이 337 B로 떨어진다.
     *
     * 다른 라우트에서는 `<head>` 스크립트가 이미 같은 값을 찍어둔 뒤라 무해하다.
     */
    useEffect(() => {
        applyStoredTheme();
    }, []);

    const { isOpen, open, close, dialogRef, triggerRef } = useDialog();

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={open}
                className={cn(TRIGGER_BASE_CLASS, triggerClassName)}
            >
                {resolvedTriggerLabel}
            </button>

            {/* 네이티브 모달: 포커스 트랩·Esc·비활성 배경이 브라우저 기본 동작이고,
                배경 클릭 닫기는 useDialog가 dialog에 직접 리스너를 붙여 처리한다. */}
            <dialog
                ref={dialogRef}
                aria-labelledby="contact-dialog-title"
                onClose={close}
                className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-secondary-700 bg-secondary-800 p-0 text-left shadow-2xl backdrop:bg-secondary-950/80 backdrop:backdrop-blur-sm"
            >
                {isOpen && (
                    <div>
                        <div className="flex items-start justify-between border-b border-secondary-700 px-6 py-5">
                            <div>
                                <h2
                                    id="contact-dialog-title"
                                    className="text-base font-semibold text-secondary-100"
                                >
                                    {t('ContactDialog.531f6a')}
                                </h2>
                                <p className="mt-1 text-sm text-secondary-400">
                                    {t('ContactDialog.79bb9f')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={close}
                                aria-label={t('ContactDialog.94b7db')}
                                className="-mt-1 -mr-1 rounded p-1 text-secondary-400 transition-colors hover:text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            <ContactForm />
                        </div>
                    </div>
                )}
            </dialog>
        </>
    );
}
