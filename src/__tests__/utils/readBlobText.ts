/**
 * Reads a Blob's text content using FileReader.
 * Blob.prototype.text() is not available in the jsdom version used by this project.
 */
export function readBlobText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
    });
}
