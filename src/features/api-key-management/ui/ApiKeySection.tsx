'use client';

import { useTranslations } from 'next-intl';
import { ProviderCard } from './ProviderCard';
import {
    LLM_PROVIDER_VALUES,
    type LlmProvider,
} from '@/shared/config/llmProviders';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { useState } from 'react';

/** 포커스를 이어받을 카드. 카드 `key`와 같은 두 값으로 집는다. */
interface FocusTarget {
    provider: LlmProvider;
    isRegistered: boolean;
}

interface ApiKeySectionProps {
    /** 서버가 읽은 등록 프로바이더. 저장·삭제 후 `revalidatePath`로 다시 내려온다. */
    registeredProviders: LlmProvider[];
}

/**
 * `/account`의 "AI 모델 API 키"(BYOK) 섹션. 프로바이더마다 카드 하나를 그린다.
 *
 * 카드 `key`에 등록 여부를 넣어, 저장·삭제로 등록 여부가 바뀌면 카드를 새로
 * 마운트한다(편집 상태 초기화). 그 재마운트가 조작하던 버튼을 없애므로, 성공한
 * 카드가 알려 준 "바뀐 뒤의 카드"(프로바이더 + 새 등록 여부)를 여기서 기억해 그
 * 카드가 포커스를 이어받게 한다.
 *
 * 프로바이더만이 아니라 새 등록 여부까지 맞아야 이어받는다. 그래서 액션 성공이
 * 목록 갱신보다 먼저 커밋돼도 옛 카드는 요청을 가져가지 않고, 나중에 커밋돼도
 * 이미 마운트된 새 카드가 가져간다. 새 카드가 포커스를 넘겨받으면 요청을 지워,
 * 이후 이 카드의 조작과 무관한 재마운트(다른 탭에서 바꾼 뒤의 갱신 등)는
 * 포커스를 빼앗지 않는다.
 */
export function ApiKeySection({ registeredProviders }: ApiKeySectionProps) {
    const t = useTranslations('features.api-key-management');
    const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
    const registeredSet = new Set(registeredProviders);

    const handleRegistrationChange = (
        provider: LlmProvider,
        isRegistered: boolean
    ): void => setFocusTarget({ provider, isRegistered });
    // 넘겨받은 카드의 요청일 때만 지운다. 그사이 다른 카드가 새 요청을 남겼으면 둔다.
    const clearFocusTarget = (
        provider: LlmProvider,
        isRegistered: boolean
    ): void =>
        setFocusTarget(current =>
            current?.provider === provider &&
            current.isRegistered === isRegistered
                ? null
                : current
        );

    return (
        <div className="space-y-4">
            <div>
                <h2 className={HEADING_SECTION}>{t('ApiKeySection.64f90b')}</h2>
                <p className="mt-1 text-sm text-secondary-400">
                    {t('ApiKeySection.017638')}
                </p>
            </div>
            {LLM_PROVIDER_VALUES.map(provider => {
                const isRegistered = registeredSet.has(provider);
                return (
                    <ProviderCard
                        key={`${provider}-${String(isRegistered)}`}
                        provider={provider}
                        isRegistered={isRegistered}
                        restoreFocus={
                            focusTarget?.provider === provider &&
                            focusTarget.isRegistered === isRegistered
                        }
                        onFocusRestored={() =>
                            clearFocusTarget(provider, isRegistered)
                        }
                        onRegistrationChange={handleRegistrationChange}
                    />
                );
            })}
        </div>
    );
}
