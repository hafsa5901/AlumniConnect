import test from 'node:test';
import assert from 'node:assert';
import { isOwnMessage, normalizeId } from '../src/utils/messageOwnership.ts';

test('normalizeId: handles null and undefined', () => {
  assert.strictEqual(normalizeId(null), null);
  assert.strictEqual(normalizeId(undefined), null);
});

test('normalizeId: handles raw string IDs with whitespace and casing', () => {
  assert.strictEqual(normalizeId('64a1b2c3d4e5f6a7b8c9d0e1'), '64a1b2c3d4e5f6a7b8c9d0e1');
  assert.strictEqual(normalizeId('  64A1B2C3D4E5F6A7B8C9D0E1  '), '64a1b2c3d4e5f6a7b8c9d0e1');
  assert.strictEqual(normalizeId(''), null);
  assert.strictEqual(normalizeId('   '), null);
});

test('normalizeId: handles objects with _id or id or userId', () => {
  assert.strictEqual(normalizeId({ _id: 'user-123' }), 'user-123');
  assert.strictEqual(normalizeId({ id: 'user-456' }), 'user-456');
  assert.strictEqual(normalizeId({ userId: 'user-789' }), 'user-789');
  assert.strictEqual(normalizeId({ id: 'primary-id', _id: 'secondary-id' }), 'primary-id');
});

test('normalizeId: handles ObjectId-like objects', () => {
  const objectIdWithToString = {
    toString: () => '507f191e810c19729de860ea',
  };
  assert.strictEqual(normalizeId(objectIdWithToString), '507f191e810c19729de860ea');

  const objectIdWithToHex = {
    toHexString: () => '507f191e810c19729de860eb',
  };
  assert.strictEqual(normalizeId(objectIdWithToHex), '507f191e810c19729de860eb');

  const nestedObjectId = {
    _id: {
      toString: () => '507f191e810c19729de860ec',
    },
  };
  assert.strictEqual(normalizeId(nestedObjectId), '507f191e810c19729de860ec');
});

test('normalizeId: ignores plain empty objects without throwing', () => {
  assert.strictEqual(normalizeId({}), null);
  assert.strictEqual(normalizeId({ name: 'Anonymous' }), null);
});

test('isOwnMessage: raw string ID match and mismatch', () => {
  const currentUserId = '64a1b2c3d4e5f6a7b8c9d0e1';
  assert.strictEqual(isOwnMessage('64a1b2c3d4e5f6a7b8c9d0e1', { id: currentUserId }), true);
  assert.strictEqual(isOwnMessage('different-user-id', { id: currentUserId }), false);
});

test('isOwnMessage: populated object with _id', () => {
  const currentUser = { id: 'user-abc' };
  const senderWithUnderscoreId = { _id: 'user-abc', name: 'Alice' };
  const senderOther = { _id: 'user-xyz', name: 'Bob' };

  assert.strictEqual(isOwnMessage(senderWithUnderscoreId, currentUser), true);
  assert.strictEqual(isOwnMessage(senderOther, currentUser), false);
});

test('isOwnMessage: populated object with id', () => {
  const currentUser = { _id: 'user-abc' };
  const senderWithId = { id: 'user-abc', name: 'Alice' };
  const senderOther = { id: 'user-xyz', name: 'Bob' };

  assert.strictEqual(isOwnMessage(senderWithId, currentUser), true);
  assert.strictEqual(isOwnMessage(senderOther, currentUser), false);
});

test('isOwnMessage: ObjectId-like versus string', () => {
  const stringId = '507f191e810c19729de860ea';
  const objectIdSender = {
    _id: {
      toString: () => '507f191e810c19729de860ea',
    },
  };
  const currentUser = { _id: stringId };

  assert.strictEqual(isOwnMessage(objectIdSender, currentUser), true);
});

test('isOwnMessage: null, undefined, and deleted senders', () => {
  const currentUser = { id: 'user-abc' };
  assert.strictEqual(isOwnMessage(null, currentUser), false);
  assert.strictEqual(isOwnMessage(undefined, currentUser), false);
  assert.strictEqual(isOwnMessage({}, currentUser), false);
  assert.strictEqual(isOwnMessage({ name: 'Deleted User' }, currentUser), false);
});

test('isOwnMessage: missing current-user ID (auth still loading or unauthenticated)', () => {
  const sender = { id: 'user-abc' };
  assert.strictEqual(isOwnMessage(sender, null), false);
  assert.strictEqual(isOwnMessage(sender, undefined), false);
  assert.strictEqual(isOwnMessage(sender, {}), false);
  assert.strictEqual(isOwnMessage(sender, { name: 'Anonymous' }), false);
});

test('isOwnMessage: current user using id versus _id', () => {
  const idValue = 'canonical-user-999';

  // Current user has only `id` (e.g. from authService.loginUser safeUser)
  const currentUserWithId = { id: idValue };
  assert.strictEqual(isOwnMessage({ id: idValue }, currentUserWithId), true);
  assert.strictEqual(isOwnMessage({ _id: idValue }, currentUserWithId), true);
  assert.strictEqual(isOwnMessage(idValue, currentUserWithId), true);

  // Current user has only `_id` (e.g. from raw Mongo doc / authService.me)
  const currentUserWithUnderscoreId = { _id: idValue };
  assert.strictEqual(isOwnMessage({ id: idValue }, currentUserWithUnderscoreId), true);
  assert.strictEqual(isOwnMessage({ _id: idValue }, currentUserWithUnderscoreId), true);
  assert.strictEqual(isOwnMessage(idValue, currentUserWithUnderscoreId), true);

  // Current user has both
  const currentUserWithBoth = { id: idValue, _id: idValue };
  assert.strictEqual(isOwnMessage({ id: idValue }, currentUserWithBoth), true);
  assert.strictEqual(isOwnMessage({ _id: idValue }, currentUserWithBoth), true);
});

test('isOwnMessage: never throws on malformed inputs', () => {
  assert.strictEqual(isOwnMessage(NaN, {}), false);
  assert.strictEqual(isOwnMessage(true, false), false);
  assert.strictEqual(isOwnMessage({ id: null }, { id: undefined }), false);
  const circular: any = {};
  circular.self = circular;
  assert.strictEqual(isOwnMessage(circular, { id: '123' }), false);
});
