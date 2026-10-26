/**
 * Pure helper for normalizing IDs and determining message ownership.
 *
 * Handles all sender and currentUser shapes:
 * - Raw string IDs (e.g. "64abc...")
 * - Populated objects with `_id` or `id` or `userId`
 * - Populated objects with nested ObjectId-like instances
 * - Direct ObjectId instances with `.toHexString()` or custom `.toString()`
 * - Null, undefined, empty, or deleted user objects
 *
 * Guarantees:
 * - Never throws.
 * - Pure with no side effects.
 * - Always returns boolean.
 */

export function normalizeId(target: unknown): string | null {
  if (target == null) {
    return null;
  }

  // Raw primitive string or number
  if (typeof target === 'string') {
    const trimmed = target.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : null;
  }
  if (typeof target === 'number') {
    return String(target);
  }

  // Object shape
  if (typeof target === 'object') {
    const obj = target as Record<string, unknown>;

    // 1. Explicit ID properties: id, _id, userId
    const rawId = obj.id ?? obj._id ?? obj.userId;
    if (rawId != null) {
      return normalizeId(rawId);
    }

    // 2. ObjectId instance with toHexString() (e.g., BSON / Mongoose Types.ObjectId)
    if (typeof obj.toHexString === 'function') {
      try {
        const hex = (obj.toHexString as () => unknown)();
        if (typeof hex === 'string' && hex.length > 0) {
          return hex.trim().toLowerCase();
        }
      } catch {
        // Fall through safely
      }
    }

    // 3. Object with custom toString (avoiding default [object Object])
    if (typeof obj.toString === 'function' && obj.toString !== Object.prototype.toString) {
      try {
        const str = obj.toString();
        if (typeof str === 'string' && str !== '[object Object]' && str.trim().length > 0) {
          return str.trim().toLowerCase();
        }
      } catch {
        // Fall through safely
      }
    }
  }

  return null;
}

/**
 * Determines whether a message belongs to the currently authenticated user.
 *
 * @param sender - The message sender (raw string, populated object with id/_id, null/undefined)
 * @param currentUser - The current authenticated user (with id or _id, null/undefined)
 * @returns boolean - True if both IDs are present and match; false otherwise.
 */
export function isOwnMessage(sender: unknown, currentUser: unknown): boolean {
  try {
    const senderId = normalizeId(sender);
    const currentUserId = normalizeId(currentUser);

    if (!senderId || !currentUserId) {
      return false;
    }

    return senderId === currentUserId;
  } catch {
    return false;
  }
}
