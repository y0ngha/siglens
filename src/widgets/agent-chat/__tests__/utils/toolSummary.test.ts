import { toolResultError } from '@/widgets/agent-chat/utils/toolSummary';

describe('toolResultError', () => {
    it('returns the error string from valid JSON', () => {
        expect(toolResultError('{"error":"login_required"}')).toBe(
            'login_required'
        );
    });

    it('returns null when valid JSON has no error field', () => {
        expect(toolResultError('{"ok":true}')).toBeNull();
    });

    it('returns null when error field is not a string', () => {
        expect(toolResultError('{"error":123}')).toBeNull();
    });

    it('returns null for truncated JSON', () => {
        expect(toolResultError('{"error":"login_req')).toBeNull();
    });

    it('returns null for non-JSON text', () => {
        expect(toolResultError('not json at all')).toBeNull();
    });

    it('returns null for undefined', () => {
        expect(toolResultError(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(toolResultError('')).toBeNull();
    });
});
