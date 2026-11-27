import path from 'node:path';
import {
    PING_TIMEOUT_MS,
    PingTimeoutError,
    withTimeout,
} from '@/app/api/ready/_lib/checkDependencies';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { evaluateMigrations } from '@/shared/db/migrations/evaluateMigrations';
import { readMigrationJournal } from '@/shared/db/migrations/migrationJournal';
import { MIGRATION_POLICY } from '@/shared/db/migrations/migrationPolicy';
import {
    readAppliedHashes,
    type AppliedHashes,
} from '@/shared/db/migrations/readAppliedHashes';
import type { ExpectedMigration } from '@/shared/db/migrations/types';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * `/api/ready/migrations`가 응답 본문 `status`에 싣는 값. 온박스 게이트
 * (`siglens-wait-migrations.sh`)가 같은 문자열을 읽으므로 이름을 바꾸면
 * `src/__tests__/guards/migrationGateContract.test.ts`가 실패한다.
 */
export const MIGRATION_GATE_STATUS = {
    ok: 'ok',
    missing: 'missing',
    report: 'report',
    skipped: 'skipped',
    unknown: 'unknown',
    manifestUnavailable: 'manifest_unavailable',
} as const;

/** `unknown` 응답의 사유. 접속 문자열·호스트가 섞일 수 있는 원본 메시지는 싣지 않는다. */
export const MIGRATION_UNKNOWN_REASON = {
    unreachable: 'unreachable',
    timeout: 'timeout',
    notConfigured: 'not_configured',
} as const;

/** `MIGRATION_GATE` env 값. 비어 있거나 모르는 값은 `enforce`(닫힌 쪽)로 처리한다. */
export const MIGRATION_GATE_MODE = {
    enforce: 'enforce',
    report: 'report',
    off: 'off',
} as const;

type GateMode = (typeof MIGRATION_GATE_MODE)[keyof typeof MIGRATION_GATE_MODE];

/** 응답 본문은 개수만 싣는다. 이 라우트는 터널로 공개돼 있어 태그 이름은 서버 로그에만 남긴다. */
export type MigrationGateBody =
    | {
          readonly status: 'ok';
          readonly expected: number;
          readonly postDeployPending: number;
      }
    | { readonly status: 'missing'; readonly missing: number }
    | { readonly status: 'report'; readonly missing: number }
    | { readonly status: 'skipped' }
    | {
          readonly status: 'unknown';
          readonly error: (typeof MIGRATION_UNKNOWN_REASON)[keyof typeof MIGRATION_UNKNOWN_REASON];
      }
    | { readonly status: 'manifest_unavailable' };

export interface MigrationGateResult {
    readonly httpStatus: 200 | 503;
    readonly body: MigrationGateBody;
}

/** 확정되지 못한 결과(missing·unknown·manifest 등)를 다시 계산하지 않고 재사용하는 시간(ms). */
export const NON_OK_CACHE_MS = 5_000;

interface GateState {
    /** `ok`는 마이그레이션이 되돌려지지 않으므로 프로세스 수명 동안 기억한다. */
    okResult: MigrationGateResult | null;
    /** 이미지는 프로세스 수명 동안 바뀌지 않으므로 저널·해시는 한 번만 읽는다(실패는 기억하지 않는다). */
    expected: readonly ExpectedMigration[] | null;
    /** `ok`가 아닌 결과의 짧은 캐시. 게이트가 5초 간격으로 폴링해도 DB 조회가 겹치지 않게 한다. */
    recent: {
        readonly mode: GateMode;
        readonly at: number;
        readonly result: MigrationGateResult;
    } | null;
    warnedMode: boolean;
}

const state: GateState = {
    okResult: null,
    expected: null,
    recent: null,
    warnedMode: false,
};

/** 번들에 넣는 `drizzle/`가 아니라 이미지의 `/app/drizzle`(Dockerfile이 복사)을 읽는다. */
function drizzleRoot(): string {
    return path.join(process.cwd(), 'drizzle');
}

function resolveMode(raw: string | undefined): GateMode {
    if (
        raw === undefined ||
        raw === '' ||
        raw === MIGRATION_GATE_MODE.enforce
    ) {
        return MIGRATION_GATE_MODE.enforce;
    }
    if (raw === MIGRATION_GATE_MODE.report) return MIGRATION_GATE_MODE.report;
    if (raw === MIGRATION_GATE_MODE.off) return MIGRATION_GATE_MODE.off;
    if (!state.warnedMode) {
        state.warnedMode = true;
        console.warn(
            `[migrations] unknown MIGRATION_GATE value, treating as ${MIGRATION_GATE_MODE.enforce}`
        );
    }
    return MIGRATION_GATE_MODE.enforce;
}

function unknownResult(
    error: (typeof MIGRATION_UNKNOWN_REASON)[keyof typeof MIGRATION_UNKNOWN_REASON]
): MigrationGateResult {
    return {
        httpStatus: 503,
        body: { status: MIGRATION_GATE_STATUS.unknown, error },
    };
}

/** 저널·SQL 해시를 프로세스당 한 번만 읽는다. 읽지 못하면 null(캐시하지 않는다). */
function loadExpected(): readonly ExpectedMigration[] | null {
    if (state.expected !== null) return state.expected;
    try {
        state.expected = readMigrationJournal(drizzleRoot());
        return state.expected;
    } catch (error) {
        console.error(
            '[migrations] manifest unavailable:',
            redactDbErrorForLog(error)
        );
        return null;
    }
}

/** 적용된 해시를 읽는다. DB에 닿지 못하면 사유(`unknown` 응답용)를 돌려준다. */
async function loadApplied(
    client: NonNullable<ReturnType<typeof tryGetDatabaseClient>>
): Promise<AppliedHashes | MigrationGateResult> {
    try {
        return await withTimeout(
            readAppliedHashes(
                () =>
                    client.sql<
                        { hash: string }[]
                    >`SELECT hash FROM drizzle.__drizzle_migrations`
            ),
            PING_TIMEOUT_MS
        );
    } catch (error) {
        console.error(
            '[migrations] applied hashes read failed:',
            redactDbErrorForLog(error)
        );
        return unknownResult(
            error instanceof PingTimeoutError
                ? MIGRATION_UNKNOWN_REASON.timeout
                : MIGRATION_UNKNOWN_REASON.unreachable
        );
    }
}

function isGateResult(
    value: AppliedHashes | MigrationGateResult
): value is MigrationGateResult {
    return 'httpStatus' in value;
}

async function evaluateOnce(mode: GateMode): Promise<MigrationGateResult> {
    const expected = loadExpected();
    if (expected === null) {
        return {
            httpStatus: 503,
            body: { status: MIGRATION_GATE_STATUS.manifestUnavailable },
        };
    }

    const client = tryGetDatabaseClient();
    if (client === null) {
        return unknownResult(MIGRATION_UNKNOWN_REASON.notConfigured);
    }

    const applied = await loadApplied(client);
    if (isGateResult(applied)) return applied;

    const evaluation = evaluateMigrations(
        expected,
        applied.hashes,
        MIGRATION_POLICY
    );
    if (evaluation.missing.length === 0) {
        return {
            httpStatus: 200,
            body: {
                status: MIGRATION_GATE_STATUS.ok,
                expected: evaluation.expected,
                postDeployPending: evaluation.postDeployPending.length,
            },
        };
    }

    const detail = `missing ${evaluation.missing.length}: ${evaluation.missing.join(', ')}`;
    if (mode === MIGRATION_GATE_MODE.report) {
        console.warn(`[migrations] gate mode report: ${detail}`);
        return {
            httpStatus: 200,
            body: {
                status: MIGRATION_GATE_STATUS.report,
                missing: evaluation.missing.length,
            },
        };
    }
    console.error(`[migrations] ${detail}`);
    return {
        httpStatus: 503,
        body: {
            status: MIGRATION_GATE_STATUS.missing,
            missing: evaluation.missing.length,
        },
    };
}

/**
 * 이미지가 기대하는 마이그레이션이 DB에 모두 적용됐는지 확인한다. 적용하지는 않는다.
 *
 * 판정은 해시로 한다(`evaluateMigrations`). 누락이 **확정**이면 503(`enforce`)이고, DB에 닿지 못한 경우는
 * 판정할 수 없으므로 `unknown`을 돌려 호출자(온박스 게이트)가 열린 쪽으로 처리한다.
 * 저널·SQL을 읽지 못하면 이미지 결함이라 닫힌 쪽(`manifest_unavailable`)이다.
 *
 * 부하: 저널 해시는 프로세스당 한 번, `ok`는 영구, 그 밖의 결과는 `NON_OK_CACHE_MS` 동안 재사용한다.
 */
export async function checkMigrations(): Promise<MigrationGateResult> {
    const mode = resolveMode(process.env.MIGRATION_GATE);
    if (mode === MIGRATION_GATE_MODE.off) {
        return {
            httpStatus: 200,
            body: { status: MIGRATION_GATE_STATUS.skipped },
        };
    }
    if (state.okResult !== null) return state.okResult;

    const { recent } = state;
    if (
        recent !== null &&
        recent.mode === mode &&
        Date.now() - recent.at < NON_OK_CACHE_MS
    ) {
        return recent.result;
    }

    const result = await evaluateOnce(mode);
    if (
        result.body.status === MIGRATION_GATE_STATUS.ok &&
        result.httpStatus === 200
    ) {
        state.okResult = result;
    } else {
        state.recent = { mode, at: Date.now(), result };
    }
    return result;
}
