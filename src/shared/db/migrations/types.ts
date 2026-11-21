/** `drizzle/meta/_journal.json`의 entries 한 줄. */
export interface JournalEntry {
    readonly idx: number;
    readonly tag: string;
    readonly when: number;
}

/** 저널 항목 + 이미지에 들어 있는 SQL 파일 내용과 그 해시. */
export interface ExpectedMigration {
    readonly tag: string;
    readonly when: number;
    /** `sha256(utf-8 내용)` hex. `drizzle.__drizzle_migrations.hash`와 같은 값이다. */
    readonly hash: string;
    readonly sql: string;
}

export interface MigrationPolicy {
    /** 배포 뒤에 적용하기로 한 태그(contract 단계). 대기여도 배포를 막지 않는다. */
    readonly postDeployTags: readonly string[];
    /** 태그 -> 과거 해시. 적용 뒤 파일이 수정된 경우 옛 해시가 있어도 적용으로 센다. */
    readonly legacyHashes: Readonly<Record<string, readonly string[]>>;
}

export interface MigrationEvaluation {
    readonly expected: number;
    /** 적용되지 않았고 배포 뒤 허용 목록에도 없는 태그. 배포를 막는다. */
    readonly missing: readonly string[];
    /** 적용되지 않았지만 배포 뒤 적용으로 허용된 태그. */
    readonly postDeployPending: readonly string[];
    /** 현재 해시는 없지만 옛 해시 별칭으로 적용된 것으로 센 태그. */
    readonly legacyMatched: readonly string[];
    /** 적용 기록에는 있으나 저널의 어떤 해시와도 맞지 않는 해시 수(드리프트 힌트). */
    readonly unknownAppliedCount: number;
}

export interface PendingMigration {
    readonly tag: string;
    readonly blocksDeploy: boolean;
    readonly destructive: boolean;
}

export interface MigrationReport {
    readonly lines: readonly string[];
    readonly pending: readonly PendingMigration[];
    /** 0 = 막는 것 없음, 2 = 배포를 막을 대기 마이그레이션이 있다. */
    readonly exitCode: 0 | 2;
}
