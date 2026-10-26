import test from 'node:test';
import assert from 'node:assert';

// Pure helper logic as implemented in frontend/src/services/announcements.ts
export function getCategoryBadgeVariant(
  category: string
): 'red' | 'blue' | 'green' | 'purple' | 'amber' | 'navy' | 'gray' {
  switch (category) {
    case 'Important':
      return 'red';
    case 'Academic':
      return 'blue';
    case 'Placements':
      return 'green';
    case 'Internships':
      return 'purple';
    case 'Workshops':
      return 'amber';
    case 'Events':
      return 'navy';
    default:
      return 'gray';
  }
}

export function validateCoverImageUrl(url: string): { valid: boolean; error?: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: true };
  }
  if (trimmed.length > 2048) {
    return { valid: false, error: 'Cover image URL must not exceed 2048 characters.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Cover image URL must use the https:// protocol.' };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'Cover image URL must not contain credentials.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Please provide a valid HTTPS URL.' };
  }
}

export function formatAnnouncementDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Unpublished Draft';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

test('validateCoverImageUrl: accepts empty or whitespace-only inputs as optional', () => {
  assert.deepStrictEqual(validateCoverImageUrl(''), { valid: true });
  assert.deepStrictEqual(validateCoverImageUrl('   '), { valid: true });
});

test('validateCoverImageUrl: accepts valid https URLs', () => {
  const result = validateCoverImageUrl('https://images.unsplash.com/photo-1523050854058-8df90110c9f1');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.error, undefined);
});

test('validateCoverImageUrl: rejects http URLs', () => {
  const result = validateCoverImageUrl('http://example.com/banner.png');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Cover image URL must use the https:// protocol.');
});

test('validateCoverImageUrl: rejects javascript and data schemes', () => {
  const jsResult = validateCoverImageUrl('javascript:alert(1)');
  assert.strictEqual(jsResult.valid, false);
  assert.strictEqual(jsResult.error, 'Cover image URL must use the https:// protocol.');

  const dataResult = validateCoverImageUrl('data:image/png;base64,iVBORw0KGgo=');
  assert.strictEqual(dataResult.valid, false);
  assert.strictEqual(dataResult.error, 'Cover image URL must use the https:// protocol.');
});

test('validateCoverImageUrl: rejects URLs with embedded credentials', () => {
  const result = validateCoverImageUrl('https://admin:secret123@example.com/img.jpg');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Cover image URL must not contain credentials.');
});

test('validateCoverImageUrl: rejects strings exceeding 2048 characters', () => {
  const longUrl = 'https://example.com/' + 'a'.repeat(2050);
  const result = validateCoverImageUrl(longUrl);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Cover image URL must not exceed 2048 characters.');
});

test('validateCoverImageUrl: rejects invalid or unparseable URLs', () => {
  const result = validateCoverImageUrl('not-a-valid-url');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Please provide a valid HTTPS URL.');
});

test('getCategoryBadgeVariant: maps all defined categories to valid badge variants', () => {
  assert.strictEqual(getCategoryBadgeVariant('Important'), 'red');
  assert.strictEqual(getCategoryBadgeVariant('Academic'), 'blue');
  assert.strictEqual(getCategoryBadgeVariant('Placements'), 'green');
  assert.strictEqual(getCategoryBadgeVariant('Internships'), 'purple');
  assert.strictEqual(getCategoryBadgeVariant('Workshops'), 'amber');
  assert.strictEqual(getCategoryBadgeVariant('Events'), 'navy');
  assert.strictEqual(getCategoryBadgeVariant('General'), 'gray');
  assert.strictEqual(getCategoryBadgeVariant('UnknownCategory'), 'gray');
});

test('formatAnnouncementDate: handles null, undefined, invalid, and valid dates', () => {
  assert.strictEqual(formatAnnouncementDate(null), 'Unpublished Draft');
  assert.strictEqual(formatAnnouncementDate(undefined), 'Unpublished Draft');
  assert.strictEqual(formatAnnouncementDate(''), 'Unpublished Draft');
  assert.strictEqual(formatAnnouncementDate('not-a-date'), 'Invalid Date');

  const formatted = formatAnnouncementDate('2026-10-26T12:00:00.000Z');
  assert.ok(formatted.includes('2026'));
  assert.ok(formatted.includes('Oct'));
});
