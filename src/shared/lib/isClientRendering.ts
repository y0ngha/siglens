export function isClientRendering(): boolean {
    return typeof window !== 'undefined';
}
