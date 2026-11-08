'use client';

import { useTranslations } from 'next-intl';
import { TextField } from '@/shared/ui/TextField';

interface ContactEmailFieldProps {
    /** 로그인 사용자 조회가 아직 안 끝났다 — 입력 대신 자리만 잡는다. */
    isPending: boolean;
    defaultValue: string;
    error?: string;
    /** 입력 id. 한 페이지에 두 폼이 있을 때 겹치지 않게 호출자가 정한다. */
    id?: string;
    /** 라벨. 생략하면 문의 폼의 "이메일". */
    label?: string;
    /** 필수 여부. 문의 폼은 필수, 종목 요청 폼은 선택이다. */
    required?: boolean;
    placeholder?: string;
    /** 입력 아래에 붙는 안내 문구. */
    hint?: string;
}

/**
 * 문의 폼의 이메일 칸. 비제어 입력이라 첫 마운트의 `defaultValue`가 굳으므로,
 * 로그인 조회가 끝나기 전에는 스켈레톤만 두고 조회가 끝난 뒤 입력을 마운트한다 —
 * 그래야 로그인 이메일이 채워지고, 다른 필드는 리마운트되지 않아 입력이 보존된다.
 */
export function ContactEmailField({
    isPending,
    defaultValue,
    error,
    id = 'contact-email',
    label,
    required = true,
    placeholder = 'answer@example.com',
    hint,
}: ContactEmailFieldProps) {
    const t = useTranslations('features.contact-form');
    const resolvedLabel = label ?? t('ContactForm.3c3776');

    if (isPending) {
        return (
            <div className="space-y-2" aria-busy="true">
                <span className="block text-sm font-medium text-secondary-200">
                    {resolvedLabel}
                </span>
                <div
                    aria-hidden
                    className="h-12 w-full animate-pulse rounded-lg border border-border-control bg-secondary-950"
                />
            </div>
        );
    }

    const field = (
        <TextField
            id={id}
            name="email"
            label={resolvedLabel}
            type="email"
            autoComplete="email"
            required={required}
            placeholder={placeholder}
            defaultValue={defaultValue}
            error={error}
        />
    );
    if (hint === undefined) return field;

    return (
        <div className="space-y-2">
            {field}
            <p className="text-xs text-secondary-400">{hint}</p>
        </div>
    );
}
