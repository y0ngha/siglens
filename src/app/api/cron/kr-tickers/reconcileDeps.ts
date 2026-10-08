import 'server-only';
import { revalidateTag } from 'next/cache';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { tryGetDatabaseClient } from '@/shared/db/client';
import {
    DrizzleAssetTranslationRepository,
    DrizzleKoreanTickerRepository,
    DrizzleProfileDescriptionTranslationRepository,
} from '@/entities/ticker/api';
import { invalidateKoreanTickerCache } from '@/entities/ticker/lib/koreanNameStore';
import { translateCompanyNames } from '@/entities/ticker/lib/koreanTranslator';
import type { ReconcileUsTickerNamesDeps } from '@/entities/ticker/lib/reconcileUsTickerNames';

/**
 * `reconcileUsTickerNames`의 실제 의존을 만든다. I/O 구성(DB 클라이언트·FMP·태그 무효화)을
 * entity `lib/`가 아니라 이 호출자에 둔다 — `lib/`는 주입받은 것만 부른다(EN-1).
 *
 * DB 클라이언트가 없으면 던진다(cron 로그에 `reconcile failed`로 남는다).
 */
export function createReconcileDeps(): ReconcileUsTickerNamesDeps {
    const client = tryGetDatabaseClient();
    if (!client) throw new Error('[ticker-names] database unavailable');

    return {
        koreanTickerRepo: new DrizzleKoreanTickerRepository(client.db),
        assetTranslationRepo: new DrizzleAssetTranslationRepository(client.db),
        descriptionRepo: new DrizzleProfileDescriptionTranslationRepository(
            client.db
        ),
        fetchStockList: () => fmpGet<unknown>('stock-list'),
        translate: translateCompanyNames,
        revalidateSymbol: symbol =>
            revalidateTag(`symbol:${symbol.toUpperCase()}`, 'max'),
        invalidateSearchSnapshot: invalidateKoreanTickerCache,
    };
}
