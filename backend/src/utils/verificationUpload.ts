import path from 'path';

export interface FileValidationResult {
  valid: boolean;
  code?: string;
  error?: string;
}

/**
 * Validates document buffer against MIME type, extension, and magic bytes.
 */
export function validateProofDocumentBuffer(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, code: 'EMPTY_FILE', error: 'Uploaded document is empty.' };
  }

  // 5MB maximum limit
  if (buffer.length > 5 * 1024 * 1024) {
    return { valid: false, code: 'FILE_TOO_LARGE', error: 'Document exceeds 5MB size limit.' };
  }

  const ext = path.extname(originalName).toLowerCase();
  const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];
  if (!allowedExts.includes(ext)) {
    return {
      valid: false,
      code: 'INVALID_FILE_EXTENSION',
      error: 'Only PDF, PNG, and JPEG documents are permitted.',
    };
  }

  const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg'];
  if (!allowedMimes.includes(mimeType)) {
    return {
      valid: false,
      code: 'INVALID_MIME_TYPE',
      error: 'Only PDF, PNG, and JPEG MIME types are permitted.',
    };
  }

  // Magic bytes inspection
  const header = buffer.subarray(0, 8);

  if (mimeType === 'application/pdf') {
    // %PDF-
    const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
    if (!isPdf) {
      return { valid: false, code: 'FILE_SIGNATURE_MISMATCH', error: 'Invalid PDF document binary signature.' };
    }
  } else if (mimeType === 'image/png') {
    // 89 50 4E 47 0D 0A 1A 0A
    const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    if (!isPng) {
      return { valid: false, code: 'FILE_SIGNATURE_MISMATCH', error: 'Invalid PNG image binary signature.' };
    }
  } else if (mimeType === 'image/jpeg') {
    // FF D8 FF
    const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (!isJpeg) {
      return { valid: false, code: 'FILE_SIGNATURE_MISMATCH', error: 'Invalid JPEG image binary signature.' };
    }
  }

  return { valid: true };
}
