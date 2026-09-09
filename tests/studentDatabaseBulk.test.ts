import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBulkUpdatePayload,
  calculateIsAllSelected,
  calculateIsIndeterminate,
  toggleSelectAllFilteredIds,
} from '../utils/studentDatabaseUtils';

describe('studentDatabaseUtils', () => {
  describe('buildBulkUpdatePayload', () => {
    it('returns empty object when all options are no_change', () => {
      const payload = buildBulkUpdatePayload({
        level: 'no_change',
        role: 'no_change',
        emailNotifications: 'no_change',
      });
      assert.deepEqual(payload, {});
    });

    it('builds payload with level only', () => {
      const payload = buildBulkUpdatePayload({
        level: 'B2',
        role: 'no_change',
        emailNotifications: 'no_change',
      });
      assert.deepEqual(payload, { level: 'B2' });
    });

    it('builds payload with role only', () => {
      const payload = buildBulkUpdatePayload({
        level: 'no_change',
        role: 'teacher',
        emailNotifications: 'no_change',
      });
      assert.deepEqual(payload, { role: 'teacher' });
    });

    it('correctly sets emailNotificationsDisabled to true when disabled', () => {
      const payload = buildBulkUpdatePayload({
        level: 'no_change',
        role: 'no_change',
        emailNotifications: 'disabled',
      });
      assert.deepEqual(payload, { emailNotificationsDisabled: true });
    });

    it('correctly sets emailNotificationsDisabled to false when enabled', () => {
      const payload = buildBulkUpdatePayload({
        level: 'C1',
        role: 'user',
        emailNotifications: 'enabled',
      });
      assert.deepEqual(payload, {
        level: 'C1',
        role: 'user',
        emailNotificationsDisabled: false,
      });
    });
  });

  describe('selection helpers', () => {
    const ids = ['u1', 'u2', 'u3'];

    it('calculates isAllSelected correctly', () => {
      assert.equal(calculateIsAllSelected(ids, new Set(['u1', 'u2'])), false);
      assert.equal(calculateIsAllSelected(ids, new Set(['u1', 'u2', 'u3'])), true);
      assert.equal(calculateIsAllSelected([], new Set(['u1'])), false);
    });

    it('calculates isIndeterminate correctly', () => {
      assert.equal(calculateIsIndeterminate(ids, new Set(['u1'])), true);
      assert.equal(calculateIsIndeterminate(ids, new Set(['u1', 'u2'])), true);
      assert.equal(calculateIsIndeterminate(ids, new Set(['u1', 'u2', 'u3'])), false);
      assert.equal(calculateIsIndeterminate(ids, new Set()), false);
    });

    it('toggleSelectAllFilteredIds selects all when some or none are selected', () => {
      const initial = new Set(['u1']);
      const updated = toggleSelectAllFilteredIds(ids, initial);
      assert.deepEqual(Array.from(updated).sort(), ['u1', 'u2', 'u3']);
    });

    it('toggleSelectAllFilteredIds deselects all when all are selected', () => {
      const initial = new Set(['u1', 'u2', 'u3', 'other_user']);
      const updated = toggleSelectAllFilteredIds(ids, initial);
      assert.deepEqual(Array.from(updated), ['other_user']);
    });
  });
});
