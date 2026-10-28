import { gunzipSync } from "node:zlib";

/**
 * Decompress a gzip payload with a hard output cap enforced during expansion.
 * This prevents a small compressed upload from allocating an unbounded output.
 */
export function decompressGzipCapped(
  compressed: Buffer,
  maxOutputBytes: number,
): Buffer {
  if (
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes < 1
  ) {
    throw new Error(
      "The archive output limit must be a positive integer.",
    );
  }

  return gunzipSync(compressed, {
    maxOutputLength: maxOutputBytes,
  });
}

/** The only archive filename patterns implemented by the server extractor. */
export function isSupportedTarArchiveName(
  fileName: string,
): boolean {
  const name = fileName.toLowerCase();

  return (
    name.endsWith(".tar") ||
    name.endsWith(".tar.gz") ||
    name.endsWith(".tgz")
  );
}