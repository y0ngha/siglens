/**
 * IndexNow 1회성 백필 — 색인에서 빠졌거나 noindex로 바뀐 URL을 Bing·Naver에 알린다.
 *
 * DB·Redis를 쓰지 않는다. removal sitemap(`REMOVAL_SITEMAP_KINDS` 다섯 종)을 운영에서 GET하고
 * (읽기 전용) 상수·설정 목록에서 URL을 더해 한 벌로 만든다. **기본은 dry-run**이다 — 건수와
 * 표본만 찍고 아무것도 보내지 않는다.
 *
 *   node_modules/.bin/tsx scripts/indexnow-backfill.ts                     # dry-run
 *   node_modules/.bin/tsx scripts/indexnow-backfill.ts --save urls.txt     # 목록만 저장하고 종료
 *   node_modules/.bin/tsx scripts/indexnow-backfill.ts --from-file urls.txt          # 저장 목록으로 dry-run
 *   node_modules/.bin/tsx scripts/indexnow-backfill.ts --submit            # 10,000개씩 청크 제출
 *   node_modules/.bin/tsx scripts/indexnow-backfill.ts --submit --from-file urls.txt --from-chunk 3
 *
 * removal sitemap은 언제든 410으로 바뀔 수 있다. 그 뒤에는 sitemap을 받을 수 없으므로 **먼저
 * `--save`로 목록을 고정**해 두고 `--from-file`로 제출한다 — 청크 번호와 재개(`--from-chunk`)가
 * 같은 목록 위에서 움직인다.
 *
 * sitemap 하나라도 못 받으면(비-OK 응답·네트워크 오류) **실행을 중단한다** — 조용히 건너뛰면
 * 목록이 줄어든 채 "성공"으로 끝난다. 청크가 실패하면 그 번호와 재개 명령을 출력하고 멈춘다
 * (앞 청크는 이미 접수됐다).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
    INDEXNOW_ENDPOINTS,
    INDEXNOW_KEY,
    INDEXNOW_KEY_LOCATION,
} from '../src/shared/config/indexNow';
import { POPULAR_CRYPTOS } from '../src/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '../src/shared/config/popular-tickers';
import {
    BACKFILL_CHUNK_SIZE,
    REMOVAL_SITEMAP_KINDS,
    alwaysNoindexTabUrls,
    chunkUrls,
    formatUrlList,
    normalizeBackfillUrls,
    parseBackfillArgs,
    parseSitemapLocs,
    parseUrlList,
    removalSitemapUrl,
    removedSegmentUrls,
} from './lib/indexNowBackfill';

const HOST = 'siglens.io';
const SAMPLE_SIZE = 10;
const ACCEPTED_STATUSES = new Set([200, 202]);

/** 한 sitemap이라도 못 받으면 던진다 — 부분 목록으로 진행하지 않는다. */
async function fetchRemovalUrls(): Promise<string[]> {
    const collected: string[] = [];
    for (const kind of REMOVAL_SITEMAP_KINDS) {
        const url = removalSitemapUrl(kind);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`removal sitemap ${kind}: HTTP ${response.status}`);
        }
        const locs = parseSitemapLocs(await response.text());
        console.log(`removal sitemap ${kind}: ${locs.length} URLs`);
        collected.push(...locs);
    }
    return collected;
}

/** 던지지 않는다 — 실패(비-OK·네트워크 오류)는 `false`로 돌려 호출부가 번호와 재개 명령을 찍게 한다. */
async function submitChunk(urlList: readonly string[]): Promise<boolean> {
    for (const endpoint of INDEXNOW_ENDPOINTS) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                    host: HOST,
                    key: INDEXNOW_KEY,
                    keyLocation: INDEXNOW_KEY_LOCATION,
                    urlList,
                }),
            });
            if (!ACCEPTED_STATUSES.has(response.status)) {
                console.error(`${endpoint} → HTTP ${response.status}`);
                return false;
            }
        } catch (error) {
            console.error(`${endpoint} → request failed`, error);
            return false;
        }
    }
    return true;
}

async function loadUrls(fromFile: string | null): Promise<string[]> {
    if (fromFile !== null) {
        const urls = parseUrlList(readFileSync(fromFile, 'utf8'));
        console.log(`loaded ${urls.length} URLs from ${fromFile}`);
        return urls;
    }
    return normalizeBackfillUrls([
        ...(await fetchRemovalUrls()),
        ...removedSegmentUrls(),
        ...alwaysNoindexTabUrls([...POPULAR_TICKERS, ...POPULAR_CRYPTOS]),
    ]);
}

async function main(): Promise<void> {
    const args = parseBackfillArgs(process.argv.slice(2));
    if ('error' in args) {
        console.error(args.error);
        process.exit(1);
    }
    const { submit, fromChunk, saveFile, fromFile } = args;

    const urls = await loadUrls(fromFile);
    const chunks = chunkUrls(urls, BACKFILL_CHUNK_SIZE);
    console.log(`total ${urls.length} URLs in ${chunks.length} chunk(s)`);
    console.log(urls.slice(0, SAMPLE_SIZE).join('\n'));

    if (saveFile !== null) {
        writeFileSync(saveFile, formatUrlList(urls));
        console.log(`saved ${urls.length} URLs to ${saveFile} — nothing sent.`);
        return;
    }
    if (!submit) {
        console.log('dry-run — nothing sent. Pass --submit to send.');
        return;
    }

    const fileFlag = fromFile === null ? '' : ` --from-file ${fromFile}`;
    for (let index = fromChunk - 1; index < chunks.length; index += 1) {
        const number = index + 1;
        if (!(await submitChunk(chunks[index]))) {
            console.error(
                `chunk ${number}/${chunks.length} failed — resume with: ` +
                    `node_modules/.bin/tsx scripts/indexnow-backfill.ts --submit${fileFlag} --from-chunk ${number}`
            );
            process.exit(1);
        }
        console.log(`chunk ${number}/${chunks.length} accepted`);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
