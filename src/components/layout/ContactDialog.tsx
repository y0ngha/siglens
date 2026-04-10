'use client';

import { useState, useRef, useEffect } from 'react';
import { useOnClickOutside } from '@/components/layout/hooks/useOnClickOutside';
import { useEscapeKey } from '@/components/layout/hooks/useEscapeKey';

const EMAIL = 'stock.siglens@gmail.com';
const GITHUB_ISSUES_URL = 'https://github.com/y0ngha/siglens/issues/new/choose';

interface ContactDialogProps {
    triggerLabel?: string;
    triggerClassName?: string;
}

export function ContactDialog({
    triggerLabel = '오류 제보하기',
    triggerClassName,
}: ContactDialogProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useOnClickOutside([dialogRef], () => setOpen(false));
    useEscapeKey(() => setOpen(false));

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current !== null) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

    const copyEmail = async () => {
        if (copyTimeoutRef.current !== null) {
            clearTimeout(copyTimeoutRef.current);
        }
        await navigator.clipboard.writeText(EMAIL);
        setCopied(true);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={triggerClassName}
            >
                {triggerLabel}
            </button>

            {open && (
                <div
                    className="bg-secondary-950/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                    role="presentation"
                >
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="contact-dialog-title"
                        className="border-secondary-700 bg-secondary-800 w-full max-w-md rounded-xl border shadow-2xl"
                    >
                        <div className="border-secondary-700 flex items-start justify-between border-b px-6 py-5">
                            <div>
                                <h2
                                    id="contact-dialog-title"
                                    className="text-secondary-100 text-base font-semibold"
                                >
                                    문의하기 · 오류 제보
                                </h2>
                                <p className="text-secondary-400 mt-1 text-sm">
                                    어떤 방법으로 연락하시겠어요?
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="닫기"
                                className="text-secondary-500 hover:text-secondary-300 -mt-1 -mr-1 rounded p-1 transition-colors"
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

                        <div className="space-y-3 p-6">
                            <div className="border-secondary-700 bg-secondary-900/60 rounded-lg border p-4">
                                <div className="mb-3 flex items-center gap-3">
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="text-primary-400 shrink-0"
                                        aria-hidden="true"
                                    >
                                        <rect
                                            width="20"
                                            height="16"
                                            x="2"
                                            y="4"
                                            rx="2"
                                        />
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                    <div>
                                        <p className="text-secondary-100 text-sm font-medium">
                                            이메일
                                        </p>
                                        <p className="text-secondary-500 text-xs">
                                            계정 없이 바로 문의
                                        </p>
                                    </div>
                                </div>
                                <div className="border-secondary-600 bg-secondary-800 flex items-center justify-between rounded-md border px-3 py-2">
                                    <span className="text-secondary-300 font-mono text-sm">
                                        {EMAIL}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={copyEmail}
                                        aria-label={
                                            copied
                                                ? '이메일 주소가 복사되었습니다'
                                                : '이메일 주소 복사'
                                        }
                                        aria-live="polite"
                                        className="text-secondary-500 hover:text-primary-400 ml-3 shrink-0 text-xs transition-colors"
                                    >
                                        {copied ? '복사됨' : '복사'}
                                    </button>
                                </div>
                            </div>

                            <a
                                href={GITHUB_ISSUES_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="border-secondary-700 bg-secondary-900/60 hover:border-secondary-600 hover:bg-secondary-900 flex items-center gap-3 rounded-lg border p-4 transition-all"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="text-secondary-400 shrink-0"
                                    aria-hidden="true"
                                >
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-secondary-100 text-sm font-medium">
                                        GitHub 이슈
                                    </p>
                                    <p className="text-secondary-500 text-xs">
                                        GitHub 계정으로 이슈 등록
                                    </p>
                                </div>
                                <span className="text-secondary-600 text-sm">
                                    →
                                </span>
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
