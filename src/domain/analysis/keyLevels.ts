import type { KeyLevel, KeyLevels } from '@/domain/types';

function isValidKeyLevel(level: KeyLevel): boolean {
    return level.price > 0 && level.reason.trim() !== '';
}

export function validateKeyLevels(keyLevels: KeyLevels): KeyLevels {
    const support = keyLevels.support.filter(isValidKeyLevel);
    const resistance = keyLevels.resistance.filter(isValidKeyLevel);
    const poc =
        keyLevels.poc !== undefined && isValidKeyLevel(keyLevels.poc)
            ? keyLevels.poc
            : undefined;

    return { support, resistance, poc };
}
