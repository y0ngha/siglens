export function makeFormData(values: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, value] of Object.entries(values)) {
        fd.set(key, value);
    }
    return fd;
}
