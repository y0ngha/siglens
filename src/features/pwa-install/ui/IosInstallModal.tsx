'use client';

import { useTranslations } from 'next-intl';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import Image from 'next/image';
import { useRef } from 'react';

const MODAL_TITLE_ID = 'ios-modal-title';

const IOS_STEP_HEIGHTS = { step1: 70, step2: 120, step3: 80 } as const;

const STEPS = [
    {
        step: 1,
        title: 'Safari 하단 공유 버튼을 탭하세요',
        description: '화면 아래 가운데에 있는 위쪽 화살표 모양 아이콘입니다',
        img: '/pwa/ios-step1.svg',
        height: IOS_STEP_HEIGHTS.step1,
    },
    {
        step: 2,
        title: "'홈 화면에 추가'를 선택하세요",
        description: '공유 메뉴를 아래로 스크롤하면 나타납니다',
        img: '/pwa/ios-step2.svg',
        height: IOS_STEP_HEIGHTS.step2,
    },
    {
        step: 3,
        title: "우측 상단 '추가'를 탭하면 완료!",
        description: 'SigLens 아이콘이 홈 화면에 추가됩니다',
        img: '/pwa/ios-step3.svg',
        height: IOS_STEP_HEIGHTS.step3,
    },
] as const;

interface IosInstallModalProps {
    onClose: () => void;
}

export function IosInstallModal({ onClose }: IosInstallModalProps) {
    const t = useTranslations('features.pwa-install');
    const dialogRef = useRef<HTMLDivElement>(null);
    useEscapeKey(onClose, true);
    useFocusTrap(dialogRef, true);

    return (
        <div
            // 배경은 장식용(role="presentation")이고 닫기 경로는 Escape(useEscapeKey)와
            // 닫기 버튼이 담당한다. 배경 클릭은 편의 기능이라 target 비교로 처리해
            // 내부 클릭에 stopPropagation 핸들러를 달지 않는다.
            role="presentation"
            data-testid="ios-modal-backdrop"
            className="fixed inset-0 z-9999 flex items-center justify-center bg-secondary-950/80 px-4 backdrop-blur-sm"
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                data-testid="ios-modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby={MODAL_TITLE_ID}
                className="w-full max-w-sm rounded-2xl border border-secondary-700 bg-secondary-800 p-5"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2
                        id={MODAL_TITLE_ID}
                        className="text-base font-bold text-secondary-100"
                    >
                        {t('IosInstallModal.2c8570')}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label={t('IosInstallModal.94b7db')}
                        className="text-xl leading-none text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>
                <div className="space-y-3">
                    {STEPS.map(({ step, title, description, img, height }) => (
                        <div
                            key={step}
                            className="flex gap-3 rounded-xl bg-secondary-900 p-3"
                        >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                                {step}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="mb-1 text-sm font-semibold text-secondary-200">
                                    {title}
                                </p>
                                <p className="mb-2 text-xs text-secondary-400">
                                    {description}
                                </p>
                                <Image
                                    src={img}
                                    alt={`${step}단계 안내`}
                                    width={300}
                                    height={height}
                                    className="w-full rounded-lg"
                                    unoptimized
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
