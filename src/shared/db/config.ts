import { isBuildPhase, isOfflineBuild } from '@/shared/api/offlineBuild';
import type { DatabaseConfig } from './types';

/** Read `DATABASE_URL` from the environment and return a `DatabaseConfig`; throws when the variable is unset. */
export function readDatabaseConfig(): DatabaseConfig {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required');
    }
    return { databaseUrl };
}

/** Read `DATABASE_URL` from the environment; returns `null` when the variable is absent. */
export function tryReadDatabaseConfig(): DatabaseConfig | null {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return null;
    return { databaseUrl };
}

/**
 * 이 프로세스가 DB를 쓸 수 있는가 — `DATABASE_URL`이 있고 오프라인 빌드가 아니다.
 *
 * WHY: 운영 DB가 사설 AWS RDS로 옮겨 가면 GitHub Actions 러너(배포 빌드)는 닿지
 * 못한다. 그래서 배포 빌드에는 `DATABASE_URL`을 주지 않는다. `SIGLENS_OFFLINE_BUILD=1`
 * (로컬 pre-push 빌드)은 `.env.local`에 URL이 있어도 Neon 어댑터가 호출을 차단하므로
 * 마찬가지로 "DB 없음"으로 본다.
 */
export function isDatabaseConfigured(): boolean {
    return !isOfflineBuild() && tryReadDatabaseConfig() !== null;
}

/**
 * `next build`(prerender) 중이고 DB를 쓸 수 없는가.
 *
 * true면 DB-backed 페이지는 DB 없이 렌더해야 한다 — 빈/degrade 결과를 긴 revalidate로
 * 굳히지 않도록 `generateStaticParams`를 비우거나(런타임 on-demand 렌더) 짧은
 * revalidate의 fallback을 낸다. 런타임에는 항상 false다(런타임 DB 오류는 그대로
 * throw/기존 degrade 경로를 탄다).
 */
export function isDatabaseMissingAtBuild(): boolean {
    return isBuildPhase() && !isDatabaseConfigured();
}
