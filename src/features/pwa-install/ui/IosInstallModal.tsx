'use client';

import { useTranslations } from 'next-intl';
import { ModalShell } from '@/shared/ui/ModalShell';
import { CloseIcon } from '@/shared/ui/StrokeIcons';
import Image from 'next/image';
import { LABEL_GROUP } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';

const MODAL_TITLE_ID = 'ios-modal-title';

const IOS_STEP_HEIGHTS = { step1: 70, step2: 120, step3: 80 } as const;

// 문구는 `features.pwa-install.iosStep` **키**만 담는다 — 리터럴로 두면
// `/en` 사용자가 영어 모달 안에서 한국어 설치 안내를 읽는다.
const STEPS = [
    {
        step: 1,
        titleKey: 'step1Title',
        descriptionKey: 'step1Desc',
        img: '/pwa/ios-step1.svg',
        height: IOS_STEP_HEIGHTS.step1,
    },
    {
        step: 2,
        titleKey: 'step2Title',
        descriptionKey: 'step2Desc',
        img: '/pwa/ios-step2.svg',
        height: IOS_STEP_HEIGHTS.step2,
    },
    {
        step: 3,
        titleKey: 'step3Title',
        descriptionKey: 'step3Desc',
        img: '/pwa/ios-step3.svg',
        height: IOS_STEP_HEIGHTS.step3,
    },
] as const;

interface IosInstallModalProps {
    onClose: () => void;
}

export function IosInstallModal({ onClose }: IosInstallModalProps) {
    const t = useTranslations('features.pwa-install');
    const tStep = useTranslations('features.pwa-install.iosStep');
    return (
        <ModalShell
            titleId={MODAL_TITLE_ID}
            onClose={onClose}
            className="max-w-sm border border-secondary-700 bg-secondary-800 p-5"
        >
            <div className="mb-4 flex items-center justify-between">
                <h2
                    id={MODAL_TITLE_ID}
                    className="text-base font-bold text-secondary-100"
                >
                    {t('IosInstallModal.2c8570')}
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('IosInstallModal.94b7db')}
                    // 44px 타깃을 유지하면서 음수 여백으로 제목 줄 높이는 그대로 둔다.
                    className="-my-2.5 -mr-2.5 flex size-11 items-center justify-center rounded-lg text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <CloseIcon className="size-5" />
                </button>
            </div>
            <div className="space-y-3">
                {STEPS.map(
                    ({ step, titleKey, descriptionKey, img, height }) => (
                        <div
                            key={step}
                            className="flex gap-3 rounded-lg bg-secondary-900 p-3"
                        >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                                {step}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={cn(LABEL_GROUP, 'mb-1')}>
                                    {tStep(titleKey)}
                                </p>
                                <p className="mb-2 text-xs text-secondary-400">
                                    {tStep(descriptionKey)}
                                </p>
                                <Image
                                    src={img}
                                    alt={t('IosInstallModal.stepAlt', {
                                        v0: step,
                                    })}
                                    width={300}
                                    height={height}
                                    className="w-full rounded-lg"
                                    unoptimized
                                />
                            </div>
                        </div>
                    )
                )}
            </div>
        </ModalShell>
    );
}
