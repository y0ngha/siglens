/**
 * S&P 500 신호 스캔 대상 스냅샷 생성 (네트워크: Wikipedia 공개 페이지 한 번).
 *
 * 사용법: yarn signal-universe:us
 * 결과: src/shared/config/signalScanUniverse/usSp500.generated.ts 를 덮어쓴다.
 * 사용자 데이터는 보내지 않고, 일반 User-Agent만 쓴다.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    INDEX_SOURCES,
    WIKIPEDIA_MAX_BODY_BYTES,
} from '@/shared/api/wikipedia/indexConstituents';
import { readBoundedBody } from '@/shared/lib/readBoundedBody';
import { buildUsSnapshot, renderUsSnapshotFile } from './usSp500Source';

const OUTPUT = resolve(
    process.cwd(),
    'src/shared/config/signalScanUniverse/usSp500.generated.ts'
);
const COMMAND = 'yarn signal-universe:us';
const REQUEST_TIMEOUT_MS = 30_000;

async function main(): Promise<void> {
    const res = await fetch(INDEX_SOURCES.sp500.url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; universe-snapshot)',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`wikipedia ${res.status}`);
    const html = new TextDecoder('utf-8').decode(
        await readBoundedBody(res, WIKIPEDIA_MAX_BODY_BYTES)
    );
    const asOf = new Date().toISOString().slice(0, 10);
    const snapshot = buildUsSnapshot(html, asOf);
    writeFileSync(OUTPUT, renderUsSnapshotFile(snapshot, COMMAND));
    console.log(
        `[signal-universe] us: ${snapshot.symbols.length} symbols (asOf ${asOf}) -> ${OUTPUT}`
    );
}

main().catch(error => {
    console.error('[signal-universe] us failed:', error);
    process.exitCode = 1;
});
