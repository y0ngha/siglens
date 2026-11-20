import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanErrorLogs, type ErrorLogSite } from './support/errorLogScan';
import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';
import { buildImportGraph, fileImports } from './support/importGraph';

/**
 * **DB 에러 로그 가드** (`docs/conventions/SERVER.md#SA-26`).
 *
 * drizzle은 실패한 쿼리의 바인딩 파라미터를 에러 메시지에 넣는다(`Failed query: … params: …`). 파라미터는 세션
 * 토큰(세션 ID가 곧 쿠키 토큰이다), 비밀번호 해시, 이메일, 인증·재설정 토큰, API 키 해시, 보유종목이다.
 * `console.error(tag, error)`는 그것을 서버 로그로 보낸다.
 *
 * 어떤 catch가 DB 에러를 받는지는 정적으로 알 수 없다. 저장소 포트(`UserRepository` 같은 인터페이스)를 주입받는
 * 코드는 DB를 import하지 않고도 DB 에러를 받는다. 그래서 import 그래프로 "DB를 만지는 파일"을 가르지 않고, **서버 코드
 * 전체**에서 잡은 에러를 찍는 모든 `console.*`가 `redactDbErrorForLog`(DB 에러일 때만 지우고 아니면 그대로 둔다)를
 * 거치게 한다. 비DB 에러의 로그 내용은 바뀌지 않으므로 비용은 호출 한 겹이다.
 *
 * 이 가드가 **못 보는 것**은 스캐너(`support/errorLogScan.ts`)의 머리 주석에 있다. 요약: `x.reason`은 보지만
 * 거절 사유를 다른 변수에 옮긴 뒤 찍는 경우, 에러를 다른 이름 변수로 옮긴 뒤 찍는 경우, 에러를 로거 함수
 * (`deps.log`)에 넘기는 경우(`warnWithDetail`은 싱크에서 막는다), 메시지를 문자열로 옮겨 담아 다시 던진 에러.
 */
const SRC = path.resolve(__dirname, '../..');

interface Allowance {
    /** 이 항목이 덮는 새는 호출의 정확한 개수. 늘거나 줄면 가드가 실패한다. */
    readonly count: number;
    readonly reason: string;
}

/**
 * 가공 없이 에러를 찍어도 되는 호출. 키는 `경로::첫 인자 원문`이다. 같은 파일에서 같은 첫 인자를 쓰는 호출이
 * 하나 더 생기면 `count`가 어긋나 실패한다(항목이 새 호출까지 덮지 않는다). 호출이 사라져도 실패한다(낡은 항목).
 */
const ALLOWED_RAW_LOGS: Readonly<Record<string, Allowance>> = {
    "shared/api/economy/OfficialTreasuryEconomyProvider.ts::'[economy] treasury.gov read failed'":
        {
            count: 1,
            reason: '거절 사유를 errorSummary가 이름과 HTTP 상태로만 줄여 찍는다. treasury.gov fetch라 DB가 없다',
        },
    "shared/api/economy/OfficialTreasuryEconomyProvider.ts::'[economy] FMP treasury-rates read failed'":
        {
            count: 1,
            reason: '거절 사유를 errorSummary가 이름과 HTTP 상태로만 줄여 찍는다. FMP fetch라 DB가 없다',
        },
    'entities/options-chain/server/optionsDataCache.ts::`[optionsDataCache] last-good unavailable for ${symbol.toUpperCase()} reason=${lastGood.reason} — serving stale snapshot`':
        {
            count: 1,
            reason: '`reason`은 last-good 조회 결과의 상태 코드 문자열이지 에러가 아니다',
        },
    "shared/i18n/request.ts::'[i18n]'": {
        count: 1,
        reason: 'next-intl 번역 키 누락 에러의 message만 찍는다. 이 스코프에 DB 호출이 없다',
    },
};

/**
 * 브라우저에서만 도는 모듈. `'use client'` 지시문이 없어 스캔에 잡히지만 서버가 import하지 않으므로 DB 에러를 받을
 * 수 없다. 가드가 import 그래프로 확인한다: 이 파일에서 위로 거슬러 올라가는 모든 길이 `'use client'` 파일에서 끝나야 한다.
 * 키는 경로, `count`는 그 파일의 새는 호출 수다.
 */
const BROWSER_ONLY_FILES: Readonly<Record<string, Allowance>> = {
    'features/pwa-install/lib/installPrompt.ts': {
        count: 1,
        reason: 'beforeinstallprompt 처리, 브라우저 전용',
    },
    'features/pwa-install/lib/registerServiceWorker.ts': {
        count: 1,
        reason: '서비스워커 등록, 브라우저 전용',
    },
    'widgets/notice-popup/utils/noticeStorage.ts': {
        count: 1,
        reason: 'localStorage 읽기·쓰기, 브라우저 전용',
    },
    'widgets/replay/utils/replayPlayer.ts': {
        count: 1,
        reason: '재생 타이머, 브라우저 전용',
    },
    'widgets/financials/utils/financialsPeriodUtils.ts': {
        count: 1,
        reason: '재무 기간 선택 UI 상태, 브라우저 전용',
    },
};

/** `console.warn`을 값으로 넘기는 형태. 인식 못 한 형태 규칙(TE-63)의 예외로 이유를 적는다. */
const ALLOWED_CONSOLE_VALUES: Readonly<Record<string, string>> = {
    'entities/email-report/server.ts':
        '라벨 누락 안내 문구(문자열)만 받는 로거 콜백이다. 에러 객체가 오지 않는다',
};

const isProductionSource = (rel: string): boolean =>
    !/(^|\/)__tests__\//.test(rel) &&
    !/(^|\/)__integration__\//.test(rel) &&
    !/\.(test|spec|stories)\.tsx?$/.test(rel) &&
    !rel.endsWith('.d.ts');

interface ScannedFile {
    readonly rel: string;
    readonly source: string;
    readonly sites: readonly ErrorLogSite[];
    readonly unparsed: readonly string[];
}

const scanned: readonly ScannedFile[] = sourceFiles(SRC)
    .map(file => path.relative(SRC, file).split(path.sep).join('/'))
    .filter(isProductionSource)
    .sort()
    .flatMap(rel => {
        const source = readFileSync(path.join(SRC, rel), 'utf8');
        const scan = scanErrorLogs(source, rel);
        // 'use client' 파일은 서버 액션 호출 결과로 DB 에러를 받을 수 없다(Next가 메시지를 지운다).
        return scan.directive === 'use client'
            ? []
            : [{ rel, source, sites: scan.sites, unparsed: scan.unparsed }];
    });

const allowKey = (rel: string, site: ErrorLogSite): string =>
    `${rel}::${site.tag}`;

interface LeakReport {
    /** 허용 목록에 없는 새는 호출. */
    readonly offenders: readonly string[];
    /** 허용 개수와 실제 개수가 다른 항목(새 호출이 늘었거나 낡았다). */
    readonly countMismatches: readonly string[];
}

/** 새는 호출을 허용 목록·브라우저 전용 목록에 대조한다. 순수 함수라 합성 입력으로도 시험한다. */
function evaluateLeaks(
    files: readonly ScannedFile[],
    allowed: Readonly<Record<string, Allowance>>,
    browserOnly: Readonly<Record<string, Allowance>>
): LeakReport {
    const leaks = files.flatMap(({ rel, sites }) =>
        sites
            .filter(site => site.leaking)
            .map(site => ({ rel, site, key: allowKey(rel, site) }))
    );
    const countOf = (
        match: (leak: (typeof leaks)[number]) => boolean
    ): number => leaks.filter(match).length;
    const mismatch = (
        label: string,
        entries: Readonly<Record<string, Allowance>>,
        match: (key: string) => (leak: (typeof leaks)[number]) => boolean
    ): string[] =>
        Object.entries(entries)
            .filter(([key, { count }]) => countOf(match(key)) !== count)
            .map(
                ([key, { count }]) =>
                    `${label} ${key}: 허용 ${count}, 실제 ${countOf(match(key))}`
            );
    return {
        offenders: leaks
            .filter(
                ({ rel, key }) => !(key in allowed) && !(rel in browserOnly)
            )
            .map(({ rel, site }) => `src/${rel}:${site.line} ${site.tag}`),
        countMismatches: [
            ...mismatch('허용 목록', allowed, key => leak => leak.key === key),
            ...mismatch(
                '브라우저 전용',
                browserOnly,
                rel => leak => leak.rel === rel
            ),
        ],
    };
}

describe('DB 에러 로그 가드 (SERVER.md#SA-26)', () => {
    it(
        '잡은 에러를 찍는 console 호출은 redactDbErrorForLog를 거친다',
        () => {
            const report = evaluateLeaks(
                scanned,
                ALLOWED_RAW_LOGS,
                BROWSER_ONLY_FILES
            );
            expect(report.offenders).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it('허용 목록의 개수가 실제와 같다(낡은 항목도, 같은 첫 인자를 재사용한 새 호출도 잡는다)', () => {
        expect(
            evaluateLeaks(scanned, ALLOWED_RAW_LOGS, BROWSER_ONLY_FILES)
                .countMismatches
        ).toEqual([]);
    });

    it('인식하지 못한 형태가 없다(TE-63)', () => {
        const unparsed = scanned.flatMap(({ rel, unparsed: messages }) =>
            messages
                .filter(
                    message =>
                        !(
                            rel in ALLOWED_CONSOLE_VALUES &&
                            message.includes('값으로 쓴다')
                        )
                )
                .map(message => `src/${rel} ${message}`)
        );
        expect(unparsed).toEqual([]);
    });

    it('콘솔 값 허용 목록의 항목은 아직 그 형태가 있고, 모든 허용에는 이유가 있다', () => {
        const liveValueFiles = new Set(
            scanned
                .filter(({ unparsed }) =>
                    unparsed.some(message => message.includes('값으로 쓴다'))
                )
                .map(({ rel }) => rel)
        );
        const staleValues = Object.keys(ALLOWED_CONSOLE_VALUES).filter(
            rel => !liveValueFiles.has(rel)
        );
        const noReason = [
            ...Object.entries(ALLOWED_RAW_LOGS).map(
                ([key, { reason }]) => [key, reason] as const
            ),
            ...Object.entries(BROWSER_ONLY_FILES).map(
                ([key, { reason }]) => [key, reason] as const
            ),
            ...Object.entries(ALLOWED_CONSOLE_VALUES),
        ]
            .filter(([, reason]) => reason.trim() === '')
            .map(([key]) => key);
        expect({ staleValues, noReason }).toEqual({
            staleValues: [],
            noReason: [],
        });
    });

    it(
        '브라우저 전용 파일은 실재하고 지시문이 없으며, 위로 거슬러 올라가는 모든 길이 use client에서 끝난다',
        () => {
            const graph = buildImportGraph();
            const importers = new Map<string, string[]>();
            graph.edges
                .filter(edge => !edge.typeOnly)
                .forEach(edge =>
                    importers.set(edge.to, [
                        ...(importers.get(edge.to) ?? []),
                        edge.from,
                    ])
                );
            const isClient = (rel: string): boolean =>
                fileImports(path.join(SRC, rel)).directive === 'use client';
            /** `use client` 파일에 막히지 않고 꼭대기(importer 없음)까지 닿는 파일. */
            const escapes = (
                rel: string,
                seen: ReadonlySet<string>
            ): string[] => {
                if (seen.has(rel)) return [];
                const parents = importers.get(rel) ?? [];
                if (parents.length === 0) return [rel];
                return parents
                    .filter(parent => !isClient(parent))
                    .flatMap(parent =>
                        escapes(parent, new Set([...seen, rel]))
                    );
            };
            const problems = Object.keys(BROWSER_ONLY_FILES).flatMap(rel =>
                !graph.files.includes(rel)
                    ? [`${rel}: 파일이 없다`]
                    : isClient(rel)
                      ? [`${rel}: 이미 'use client'다(목록에서 뺀다)`]
                      : escapes(rel, new Set()).map(
                            top => `${rel}: 서버 쪽 ${top}까지 닿는다`
                        )
            );
            expect(problems).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '헬퍼를 벗기면 모든 보호된 호출을 가드가 다시 잡는다(TE-62)',
        () => {
            const targets = scanned.flatMap(({ rel, source, sites }) =>
                sites
                    .filter(site => !site.leaking)
                    .flatMap(site =>
                        site.sanitizerCalls.map(call => ({
                            rel,
                            source,
                            site,
                            call,
                        }))
                    )
            );
            // 가드가 사이트를 하나도 못 읽는 회귀(0개 통과)를 막는다. 2026-11-20 실측: 보호된 호출 280여 곳.
            expect(targets.length).toBeGreaterThan(200);

            const survivors = targets
                .filter(({ rel, source, site, call }) => {
                    const stripped =
                        source.slice(0, call.start) +
                        source.slice(call.argStart, call.argEnd) +
                        source.slice(call.end);
                    return !scanErrorLogs(stripped, rel).sites.some(
                        candidate =>
                            candidate.leaking && candidate.line === site.line
                    );
                })
                .map(({ rel, site }) => `src/${rel}:${site.line} ${site.tag}`);
            expect(survivors).toEqual([]);
        },
        SCAN_TIMEOUT_MS * 4
    );
});

describe('스캐너가 알아보는 형태', () => {
    const leaks = (source: string): number =>
        scanErrorLogs(source, 'x.ts').sites.filter(site => site.leaking).length;

    it('날 에러를 찍으면 새는 것으로 본다', () => {
        expect(
            leaks("try { f(); } catch (e) { console.error('[t]', e); }")
        ).toBe(1);
    });

    it('catch 매개변수 이름이 자유로워도 잡는다', () => {
        expect(
            leaks(
                "try { f(); } catch (dbFailure) { console.warn('[t]', dbFailure); }"
            )
        ).toBe(1);
    });

    it('.catch 콜백 매개변수와 error라는 이름의 함수 매개변수를 잡는다', () => {
        expect(leaks("p.catch(boom => console.error('[t]', boom));")).toBe(1);
        expect(
            leaks(
                "function report(error: unknown) { console.error('[t]', error); }"
            )
        ).toBe(1);
    });

    it('error.message·String(error)·템플릿·{ error } 줄임 속성도 새는 것으로 본다', () => {
        expect(
            leaks("try { f(); } catch (e) { console.error('[t]', e.message); }")
        ).toBe(1);
        expect(
            leaks('try { f(); } catch (e) { console.error(String(e)); }')
        ).toBe(1);
        expect(
            leaks('try { f(); } catch (e) { console.error(`[t] ${e}`); }')
        ).toBe(1);
        const shorthand = scanErrorLogs(
            "try { f(); } catch (error) { console.error('[t]', { error }); }",
            'x.ts'
        ).sites[0];
        expect(shorthand?.leakingRanges[0]?.shorthand).toBe(true);
    });

    it('헬퍼 호출 인자와 name·code·status·instanceof·typeof는 안전하다', () => {
        expect(
            leaks(
                "try { f(); } catch (e) { console.error('[t]', redactDbErrorForLog(e)); }"
            )
        ).toBe(0);
        expect(
            leaks(
                "try { f(); } catch (e) { console.error('[t]', e instanceof Error ? e.name : typeof e, e.code, e.status); }"
            )
        ).toBe(0);
    });

    it('헬퍼 밖에 남은 같은 에러가 하나라도 있으면 새는 것이다', () => {
        expect(
            leaks(
                "try { f(); } catch (e) { console.error('[t]', redactDbErrorForLog(e), e); }"
            )
        ).toBe(1);
    });

    it("'use client' 지시문을 읽는다", () => {
        expect(
            scanErrorLogs("'use client';\nconsole.error('[t]', error);", 'x.ts')
                .directive
        ).toBe('use client');
    });

    it('catch 구조분해와 console 메서드의 값 사용은 인식 실패로 센다', () => {
        expect(
            scanErrorLogs(
                'try { f(); } catch ({ message }) { console.error(message); }',
                'x.ts'
            ).unparsed
        ).toHaveLength(1);
        expect(
            scanErrorLogs('p.catch(console.error);', 'x.ts').unparsed
        ).toHaveLength(1);
        expect(
            scanErrorLogs("console[level]('[t]');", 'x.ts').unparsed
        ).toHaveLength(1);
    });

    it('에러와 무관한 인자는 사이트로 세지 않는다', () => {
        expect(
            scanErrorLogs(
                "console.log('[t]', count, JSON.stringify(x));",
                'x.ts'
            ).sites
        ).toEqual([]);
    });

    it('구조분해한 거절 핸들러 매개변수는 인식 실패로 센다(TE-63)', () => {
        expect(
            scanErrorLogs(
                "p.catch(({ message }) => console.error('[t]', message));",
                'x.ts'
            ).unparsed
        ).toHaveLength(1);
        expect(
            scanErrorLogs(
                "p.then(ok, ({ message }) => console.error('[t]', message));",
                'x.ts'
            ).unparsed
        ).toHaveLength(1);
        expect(
            scanErrorLogs(
                "p.catch(boom => console.error('[t]', redactDbErrorForLog(boom)));",
                'x.ts'
            ).unparsed
        ).toEqual([]);
    });
});

describe('허용 목록 대조(evaluateLeaks)', () => {
    const file = (source: string, rel = 'a/b.ts'): ScannedFile => {
        const scan = scanErrorLogs(source, rel);
        return { rel, source, sites: scan.sites, unparsed: scan.unparsed };
    };
    const call = "try { f(); } catch (e) { console.warn('[t]', e); }\n";
    const allowed = (count: number): Record<string, Allowance> => ({
        "a/b.ts::'[t]'": { count, reason: '시험용' },
    });

    it('개수가 맞는 허용 항목은 통과한다', () => {
        expect(evaluateLeaks([file(call)], allowed(1), {})).toEqual({
            offenders: [],
            countMismatches: [],
        });
    });

    it('허용된 첫 인자를 재사용한 두 번째 새는 호출은 실패한다', () => {
        const report = evaluateLeaks([file(call + call)], allowed(1), {});
        expect(report.offenders).toEqual([]);
        expect(report.countMismatches).toHaveLength(1);
    });

    it('호출이 사라진 낡은 항목도 실패한다', () => {
        const report = evaluateLeaks([file('const x = 1;\n')], allowed(1), {});
        expect(report.countMismatches).toHaveLength(1);
    });

    it('허용되지 않은 호출은 위반으로 보고한다', () => {
        const report = evaluateLeaks([file(call)], {}, {});
        expect(report.offenders).toEqual(["src/a/b.ts:1 '[t]'"]);
    });

    it('브라우저 전용 파일의 개수가 어긋나면 실패한다', () => {
        const browser = { 'a/b.ts': { count: 0, reason: '시험용' } };
        expect(evaluateLeaks([file(call)], {}, browser)).toMatchObject({
            offenders: [],
        });
        expect(
            evaluateLeaks([file(call)], {}, browser).countMismatches
        ).toHaveLength(1);
    });
});
