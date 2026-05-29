const IMAGE_TYPES = new Set(["jpeg", "jpg", "png", "webp", "gif"]);

/** True when a media file type renders as an inline image thumbnail. */
export function isImage(fileType: string): boolean {
  return IMAGE_TYPES.has(fileType.toLowerCase());
}
