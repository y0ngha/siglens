import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import { assetTranslations, koreanTickers } from '../src/shared/db/schema';
import {
    describeTarget,
    formatTarget,
    guardRemoteWrite,
    requireDatabaseUrl,
} from '../db/scripts/lib/dbTarget';
import {
    classifyFmpSymbolMapping,
    planAssetTranslationCleanup,
    planOrphanedKoreanTickers,
} from './lib/assetTranslationMismatch';

/**
 * 옛 첫 US 행 폴백이 저장한 잘못된 매핑을 지운다 —
 * `yarn db:cleanup:asset-translations [--apply] [--list]`.
 *
 * 대상은 두 테이블이다(판정 규칙은 `scripts/lib/assetTranslationMismatch.ts` 머리말):
 *   - `asset_translations`: `fmp_symbol`이 다른 종목을 가리키는 행(`mismatch`). 지운 심볼은 다음
 *     방문 때 `getAssetInfo`가 정확 일치 규칙으로 다시 해석한다(일치가 없으면 404로 끝나고 저장하지 않는다).
 *   - `korean_tickers`: 같은 폴백이 함께 쓴 행 — 같은 심볼이고 영문명이 잘못된 매핑의 영문명과 정확히
 *     같은 행(`planOrphanedKoreanTickers`). 남겨 두면 한글 검색 자동완성에 다른 종목 이름으로 뜬다.
 *
 * - 기본은 **dry-run**: 대상 DB와 종류별 개수만 찍는다. `--list`를 붙이면 삭제 대상 심볼도 찍는다.
 * - `--apply`만 지운다. 두 삭제는 한 트랜잭션이다. 쓰기 스크립트라 원격 대상이면 `guardRemoteWrite`가
 *   거부한다(운영에는 `ALLOW_REMOTE_DB_WRITE=1`이 필요하다).
 * - 지운 뒤에도 `getAssetInfoStatic`(`unstable_cache` 24h), Redis 임시 항목(12h), 인스턴스의 한글 검색
 *   스냅샷에 옛 값이 남을 수 있다 — 최대 하루 뒤 저절로 풀린다.
 */
const apply = process.argv.includes('--apply');
const list = process.argv.includes('--list');
const databaseUrl = requireDatabaseUrl();

async function run(): Promise<void> {
    // guardRemoteWrite가 대상을 찍는다. dry-run은 가드를 거치지 않으므로 직접 찍는다.
    if (apply) guardRemoteWrite(databaseUrl, 'cleanup:asset-translations');
    else {
        console.log(
            `[db] target: ${formatTarget(describeTarget(databaseUrl))}`
        );
        console.log('[db] dry-run: no writes (pass --apply to delete)');
    }

    const client = postgres(databaseUrl, { max: 1 });
    try {
        const db = drizzle(client);
        const rows = await db
            .select({
                symbol: assetTranslations.symbol,
                name: assetTranslations.name,
                fmpSymbol: assetTranslations.fmpSymbol,
            })
            .from(assetTranslations)
            .where(ne(assetTranslations.symbol, assetTranslations.fmpSymbol));
        const plan = planAssetTranslationCleanup(rows);
        const mismatchedRows = rows.filter(
            row =>
                classifyFmpSymbolMapping(row.symbol, row.fmpSymbol) ===
                'mismatch'
        );
        const koreanRows =
            plan.mismatched.length === 0
                ? []
                : await db
                      .select({
                          symbol: koreanTickers.symbol,
                          name: koreanTickers.name,
                      })
                      .from(koreanTickers)
                      .where(inArray(koreanTickers.symbol, plan.mismatched));
        const korean = planOrphanedKoreanTickers(mismatchedRows, koreanRows);
        console.log(
            JSON.stringify({
                differing: plan.scanned,
                keptClassShare: plan.classShare,
                keptIndex: plan.index,
                mismatched: plan.mismatched.length,
                orphanedKoreanTickers: korean.orphaned.length,
                keptKoreanTickersDifferentName: korean.keptDifferentName,
            })
        );
        if (list) {
            if (plan.mismatched.length > 0)
                console.log(`asset_translations: ${plan.mismatched.join(' ')}`);
            if (korean.orphaned.length > 0)
                console.log(`korean_tickers: ${korean.orphaned.join(' ')}`);
        }
        if (!apply || plan.mismatched.length === 0) return;

        const badNameBySymbol = new Map(
            mismatchedRows.map(row => [row.symbol, row.name])
        );
        const deleted = await db.transaction(async tx => {
            const translations = await tx
                .delete(assetTranslations)
                .where(inArray(assetTranslations.symbol, plan.mismatched))
                .returning({ symbol: assetTranslations.symbol });
            // 조회와 삭제 사이에 다른 경로가 이름을 다시 썼으면 지우지 않도록 (심볼, 잘못된 영문명) 쌍을
            // 다시 건다. 쌍 전체를 한 DELETE 문의 OR로 묶어 루프·순차 await가 없다.
            const orphanPairs = korean.orphaned.map(symbol =>
                and(
                    eq(koreanTickers.symbol, symbol),
                    eq(koreanTickers.name, badNameBySymbol.get(symbol) ?? '')
                )
            );
            const tickers =
                orphanPairs.length === 0
                    ? []
                    : await tx
                          .delete(koreanTickers)
                          .where(or(...orphanPairs))
                          .returning({ symbol: koreanTickers.symbol });
            return {
                translations: translations.length,
                tickers: tickers.length,
            };
        });
        console.log(
            JSON.stringify({
                deletedAssetTranslations: deleted.translations,
                deletedKoreanTickers: deleted.tickers,
            })
        );
    } finally {
        await client.end();
    }
}

run().catch((error: unknown) => {
    console.error('cleanup:asset-translations failed:', error);
    process.exit(1);
});
