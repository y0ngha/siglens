import 'server-only';
import { getTranslations } from 'next-intl/server';
import {
    signalHubPath,
    type SignalHub,
} from '@/entities/signal-history/lib/signalHubs';
import { clampSeoDescription } from '@/shared/lib/seoClamp';

/** 신호 페이지 하나의 문구 — 메타데이터·본문·구조화데이터가 같은 값을 쓴다. */
export interface SignalHubCopy {
    readonly path: string;
    /** 신호 이름(예: "골든크로스"). */
    readonly signalLabel: string;
    readonly title: string;
    readonly description: string;
    readonly keywords: readonly string[];
    readonly itemListName: string;
}

/**
 * 신호 이름은 `shared.enumLabel.signalType.*`에서 온다 — 시장 페이지 배지와 같은 이름이라 사이트 안에서
 * 같은 신호가 다른 이름으로 불리지 않는다. 그 네임스페이스는 i18n 추출기의 보존 목록
 * (`messages/_meta/manualKeys.json` preserve)에 있어 변수 키 조회가 안전하다(I18N.md#I18-18의 예외).
 *
 * 번역자는 문자열 네임스페이스(`getTranslations('…')`)로 연다 — 객체 형태(`{ locale, namespace }`)는
 * i18n 추출기가 네임스페이스를 읽지 못해 키를 "쓰이지 않음"으로 보고 지운다. 로케일은 라우트가
 * `enterLocale`로 요청 단위로 정해 둔다.
 */
export async function signalHubCopy(hub: SignalHub): Promise<SignalHubCopy> {
    const [t, tLabel] = await Promise.all([
        getTranslations('app.market.signalHub'),
        getTranslations('shared.enumLabel'),
    ]);
    const signalLabel = tLabel(`signalType.${hub.signalType}`);
    return {
        path: signalHubPath(hub.slug),
        signalLabel,
        title: t('title', { signal: signalLabel }),
        description: clampSeoDescription(
            t('description', { signal: signalLabel })
        ),
        keywords: [
            t('keywordStocks', { signal: signalLabel }),
            t('keywordRecent', { signal: signalLabel }),
            t('keywordToday', { signal: signalLabel }),
        ],
        itemListName: t('itemListName', { signal: signalLabel }),
    };
}
