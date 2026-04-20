import type { StockSignalResult } from '@/domain/types';

export interface ConflictInfo {
    readonly bullishCount: number;
    readonly bearishCount: number;
}

export type StockWithConflict = StockSignalResult & {
    readonly conflict?: ConflictInfo;
};
