'use client';

import { useEffect } from 'react';
import Image from 'next/image';

const STEPS = [
    {
        step: 1,
        title: 'Safari 하단 공유 버튼을 탭하세요',
        description: '화면 아래 가운데에 있는 위쪽 화살표 모양 아이콘입니다',
        img: '/pwa/ios-step1.svg',
    },
    {
        step: 2,
        title: "'홈 화면에 추가'를 선택하세요",
        description: '공유 메뉴를 아래로 스크롤하면 나타납니다',
        img: '/pwa/ios-step2.svg',
    },
    {
        step: 3,
        title: "우측 상단 '추가'를 탭하면 완료!",
        description: 'SigLens 아이콘이 홈 화면에 추가됩니다',
        img: '/pwa/ios-step3.svg',
    },
] as const;

interface IosInstallModalProps {
    onClose: () => void;
}

export function IosInstallModal({ onClose }: IosInstallModalProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            data-testid="ios-modal-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/80 px-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                data-testid="ios-modal-content"
                className="w-full max-w-sm rounded-2xl border border-secondary-700 bg-secondary-800 p-5"
                onClick={e => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-bold text-secondary-100">
                        홈 화면에 추가하기
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="닫기"
                        className="text-xl leading-none text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        ×
                    </button>
                </div>
                <div className="space-y-3">
                    {STEPS.map(({ step, title, description, img }) => (
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
                                    height={120}
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
