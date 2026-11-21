'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SignalType } from '@y0ngha/siglens-core';
import type {
    MailAlertFearGreedMarket,
    MailAlertTopic,
} from '@/entities/mail-alert/model';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { MailIcon } from '@/shared/ui/StrokeIcons';

const MailAlertDialog = dynamic(
    () => import('./MailAlertDialog').then(m => m.MailAlertDialog),
    { ssr: false }
);

/** 카드가 걸리는 화면: 공포 탐욕 지수 허브(시장 이름을 받는다) 또는 신호별 종목 허브(신호 이름을 받는다). */
type MailAlertCardTarget =
    | {
          readonly kind: 'fear_greed';
          readonly market: MailAlertFearGreedMarket;
          /** 서버가 번역한 시장 이름(미국·한국·크립토). */
          readonly marketLabel: string;
      }
    | {
          readonly kind: 'signal';
          readonly signalType: SignalType;
          /** 서버가 번역한 신호 이름. */
          readonly hubName: string;
      };

interface MailAlertCardProps {
    readonly target: MailAlertCardTarget;
}

function topicOf(target: MailAlertCardTarget): MailAlertTopic {
    return target.kind === 'fear_greed'
        ? { kind: 'fear_greed', market: target.market }
        : { kind: 'signal', signalType: target.signalType };
}

/**
 * 공포 탐욕·신호별 종목 화면의 한 줄 카드: 문구 한 줄과 버튼. 서버 렌더되는 정적 텍스트라 크롤러가 읽지만
 * 링크는 담지 않는다(버튼은 대화상자를 여는 `<button>`). 대화상자는 누를 때 내려받는다. 데이터 읽기·쿠키
 * 접근이 없어 정적 페이지를 동적으로 만들지 않는다.
 */
export function MailAlertCard({ target }: MailAlertCardProps) {
    const t = useTranslations('features.mail-alert');
    const [isOpen, setIsOpen] = useState(false);
    const topic = topicOf(target);
    const line =
        target.kind === 'fear_greed'
            ? t('cardFearGreed')
            : t('cardSignalHub', { hubName: target.hubName });
    const title =
        target.kind === 'fear_greed'
            ? t('titleFearGreed', { market: target.marketLabel })
            : t('titleSignalHub', { hubName: target.hubName });

    return (
        <>
            <div
                className={cn(
                    SURFACE_CARD,
                    'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'
                )}
            >
                <p className="flex items-start gap-2 text-sm leading-relaxed text-secondary-200">
                    <MailIcon className="mt-0.5 size-4 shrink-0 text-secondary-400" />
                    <span>{line}</span>
                </p>
                <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(true)}
                    className={cn(
                        BUTTON_OUTLINE,
                        'h-11 shrink-0 px-4 text-sm whitespace-nowrap'
                    )}
                >
                    {t('button')}
                </button>
            </div>
            {isOpen && (
                <MailAlertDialog
                    topic={topic}
                    title={title}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
