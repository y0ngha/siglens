import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEPLOY_PURGE_TAGS } from '../../src/shared/config/cdnCacheTags';

const root = process.cwd();
const SCRIPT_PATH = join(root, 'scripts/purge-cdn-cache.sh');

const SUCCESS = '{"success":true,"errors":[],"result":{"id":"zone"}}';
const FAILURE =
    '{"success":false,"errors":[{"code":1134,"message":"Unauthorized"}]}';

/**
 * 진짜 Cloudflare 대신 PATH 앞에 둘 가짜 curl. `--data` 본문을 한 줄씩 기록하고, 본문
 * 종류(태그 퍼지 / purge_everything)에 따라 환경변수로 정한 응답을 돌려준다.
 */
const FAKE_CURL = `#!/usr/bin/env bash
data=''
prev=''
for arg in "$@"; do
    if [ "$prev" = '--data' ]; then data="$arg"; fi
    prev="$arg"
done
printf '%s\\n' "$data" >> "$FAKE_CURL_LOG"
case "$data" in
    *purge_everything*) printf '%s' "$FAKE_ALL_RESPONSE" ;;
    *) printf '%s' "$FAKE_TAG_RESPONSE" ;;
esac
`;

interface RunOptions {
    args?: string[];
    env?: Record<string, string>;
    tagResponse?: string;
    allResponse?: string;
}

function run({
    args = [],
    env = {},
    tagResponse = SUCCESS,
    allResponse = SUCCESS,
}: RunOptions = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'purge-cdn-'));
    try {
        const curl = join(dir, 'curl');
        writeFileSync(curl, FAKE_CURL);
        chmodSync(curl, 0o755);
        const log = join(dir, 'requests.log');
        writeFileSync(log, '');
        const result = spawnSync('bash', [SCRIPT_PATH, ...args], {
            encoding: 'utf8',
            env: {
                PATH: `${dir}:${process.env.PATH ?? ''}`,
                CF_API_TOKEN: 'token',
                CF_ZONE_ID: 'zone',
                FAKE_CURL_LOG: log,
                FAKE_TAG_RESPONSE: tagResponse,
                FAKE_ALL_RESPONSE: allResponse,
                ...env,
            },
        });
        const requests = readFileSync(log, 'utf8')
            .split('\n')
            .filter(line => line.length > 0);
        return { status: result.status, stdout: result.stdout, requests };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const TAG_MODE = { CF_TAG_PURGE_ENABLED: 'true' };

describe('purge-cdn-cache.sh', () => {
    // 태그 헤더가 붙기 전에 캐시된 엔트리는 태그 퍼지로 지워지지 않는다 — 켜기 전엔 통째로.
    it('CF_TAG_PURGE_ENABLED가 없으면(기본) 통째로 비운다', () => {
        const { status, requests } = run();
        expect(status).toBe(0);
        expect(requests).toEqual([JSON.stringify({ purge_everything: true })]);
    });

    it.each(['false', '1', 'TRUE', ''])(
        'CF_TAG_PURGE_ENABLED=%s는 켜진 것으로 보지 않는다',
        value => {
            const { requests } = run({ env: { CF_TAG_PURGE_ENABLED: value } });
            expect(requests).toEqual([
                JSON.stringify({ purge_everything: true }),
            ]);
        }
    );

    it('CF_TAG_PURGE_ENABLED=true면 배포 퍼지 태그(siglens-html)만 지운다', () => {
        const { status, requests } = run({ env: TAG_MODE });
        expect(status).toBe(0);
        expect(requests).toEqual([
            JSON.stringify({ tags: [...DEPLOY_PURGE_TAGS] }),
        ]);
    });

    it('스크립트의 기본 태그 리터럴이 cdnCacheTags.ts DEPLOY_PURGE_TAGS와 같다', () => {
        const script = readFileSync(SCRIPT_PATH, 'utf8');
        const match = /^readonly DEFAULT_PURGE_TAGS='([^']+)'$/m.exec(script);
        expect(match?.[1]).toBe(DEPLOY_PURGE_TAGS.join(' '));
    });

    it('태그 퍼지가 실패하면 purge_everything으로 폴백하고 경고를 남긴다', () => {
        const { status, stdout, requests } = run({
            env: TAG_MODE,
            tagResponse: FAILURE,
        });
        expect(status).toBe(0);
        expect(requests).toEqual([
            JSON.stringify({ tags: [...DEPLOY_PURGE_TAGS] }),
            JSON.stringify({ purge_everything: true }),
        ]);
        expect(stdout).toContain('::warning::');
        expect(stdout).toContain('purge_everything으로 폴백');
    });

    it('폴백까지 실패하면 0이 아닌 코드로 끝난다', () => {
        const { status, requests } = run({
            env: TAG_MODE,
            tagResponse: FAILURE,
            allResponse: FAILURE,
        });
        expect(status).toBe(1);
        expect(requests).toHaveLength(2);
    });

    it('인자로 받은 태그는 변수와 무관하게 그대로 퍼지한다(운영자 수동 퍼지)', () => {
        const { status, requests } = run({
            args: ['siglens-og', 'siglens-asset'],
        });
        expect(status).toBe(0);
        expect(requests).toEqual([
            JSON.stringify({ tags: ['siglens-og', 'siglens-asset'] }),
        ]);
    });

    it('JSON을 깨는 태그는 태그 퍼지 대신 purge_everything으로 간다', () => {
        const { status, requests } = run({ args: ['bad"tag'] });
        expect(status).toBe(0);
        expect(requests).toEqual([JSON.stringify({ purge_everything: true })]);
    });

    it('자격증명이 없으면 API를 부르지 않고 실패한다', () => {
        const { status, requests } = run({ env: { CF_API_TOKEN: '' } });
        expect(status).toBe(1);
        expect(requests).toEqual([]);
    });
});
