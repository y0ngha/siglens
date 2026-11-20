import { overallPeekTag } from '../overallPeekTag';

describe('overallPeekTag', () => {
    it('심볼을 대문자로 맞춘 태그를 만든다', () => {
        expect(overallPeekTag('aapl')).toBe('overall-peek:AAPL');
        expect(overallPeekTag('AAPL')).toBe('overall-peek:AAPL');
    });

    it('심볼별로 다르다', () => {
        expect(overallPeekTag('AAPL')).not.toBe(overallPeekTag('MSFT'));
    });
});
