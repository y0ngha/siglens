/**
 * Task 9 stub — 실제 배치 구현은 Task 9에서 대체된다.
 * Task 8(route.ts)이 import할 수 있도록 타입/시그니처만 먼저 고정한다.
 */
export interface PrewarmBatchCounts {
    submitted: number;
    harvested: number;
    revalidated: number;
    remaining: number;
    fmpBudgetUsed: number;
}

export async function runPrewarmBatch(): Promise<PrewarmBatchCounts> {
    throw new Error('not implemented — Task 9');
}
