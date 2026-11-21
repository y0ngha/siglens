'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { isMailAlertLaunched } from '@/entities/mail-alert/lib/mailAlertConstants';
import type { MailAlertTopic } from '@/entities/mail-alert/model';
import { cn } from '@/shared/lib/cn';
import { MailIcon } from '@/shared/ui/StrokeIcons';

// 대화상자는 누른 사람만 내려받는다: 폼·서버 액션 호출 코드가 첫 화면 번들에 들어가지 않게 한다.
const MailAlertDialog = dynamic(
    () => import('./MailAlertDialog').then(m => m.MailAlertDialog),
    { ssr: false }
);

interface MailAlertButtonProps {
    readonly topic: MailAlertTopic;
    /** 대화상자 제목에 들어가는 종목 표시명. */
    readonly name: string;
}

/**
 * 종목 헤더 컨트롤 줄의 "메일로 받기". 다른 컨트롤(☆·공유·설정)과 같은 `size-11` 아이콘형이고 이름은
 * `aria-label`이다. 글자를 두지 않는 이유: 로케일마다 글자 폭이 달라 컨트롤 줄이 로케일별로 밀리고, 첫 페인트
 * 폴백이 자리를 정확히 잡지 못한다. 공개 전(`isMailAlertLaunched`)에는 아무것도 그리지 않는다 — 크립토·지수 같은 대상 판정은 호출자가 한다.
 */
export function MailAlertButton({ topic, name }: MailAlertButtonProps) {
    const t = useTranslations('features.mail-alert');
    const [isOpen, setIsOpen] = useState(false);
    if (!isMailAlertLaunched()) return null;

    return (
        <>
            <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={t('button')}
                onClick={() => setIsOpen(true)}
                className={cn(
                    'inline-flex size-11 touch-manipulation items-center justify-center rounded-lg border border-border-control text-secondary-300 transition-colors',
                    'hover:border-primary-500 hover:bg-secondary-700/30 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
                )}
            >
                <MailIcon className="size-5 shrink-0" />
            </button>
            {isOpen && (
                <MailAlertDialog
                    topic={topic}
                    title={t('titleSymbol', { name })}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
