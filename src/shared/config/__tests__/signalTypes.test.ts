import ko from '../../../../messages/ko.json';
import { SIGNAL_TYPES, isSignalType } from '@/shared/config/signalTypes';

describe('SIGNAL_TYPES', () => {
    it('ko 라벨 카탈로그(shared.enumLabel.signalType)와 같은 집합이다', () => {
        const labelKeys = Object.keys(
            ko.shared.enumLabel.signalType
        ).toSorted();
        expect([...SIGNAL_TYPES].toSorted()).toEqual(labelKeys);
    });

    it('isSignalType은 목록 멤버만 참이고 프로토타입 키는 거부한다', () => {
        expect(isSignalType('rsi_oversold')).toBe(true);
        expect(isSignalType('constructor')).toBe(false);
        expect(isSignalType(42)).toBe(false);
    });
});
