'use client';

import {
    type AbstractIntlMessages,
    NextIntlClientProvider,
    useMessages,
} from 'next-intl';
import { type ReactNode, useMemo } from 'react';
import { mergeMessages } from './messageDiff';

interface MergedIntlProviderProps {
    readonly locale: string;
    /** 상위 프로바이더에 없는 메시지만(`omitMessages`). */
    readonly messages: AbstractIntlMessages;
    readonly children: ReactNode;
}

/**
 * 상위 프로바이더의 메시지를 이어받아 이 서브트리의 차이만 덧붙인다.
 *
 * `NextIntlClientProvider`를 그대로 중첩하면 부모 메시지가 **교체**되므로, 서버가 라우트마다
 * 크롬 키를 다시 보내야 했다(`RouteMessages` JSDoc). 합치기는 클라이언트에서 한 번만 한다 —
 * 부모 메시지와 서버가 보낸 차이는 둘 다 렌더 사이에 참조가 바뀌지 않으므로 memo가 유지된다.
 */
export function MergedIntlProvider({
    locale,
    messages,
    children,
}: MergedIntlProviderProps) {
    const parentMessages = useMessages();
    const merged = useMemo(
        () => mergeMessages(parentMessages, messages),
        [parentMessages, messages]
    );
    return (
        <NextIntlClientProvider locale={locale} messages={merged}>
            {children}
        </NextIntlClientProvider>
    );
}
