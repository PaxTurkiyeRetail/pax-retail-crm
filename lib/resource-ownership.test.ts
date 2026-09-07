import { describe, expect, it } from 'vitest';
import { isResourceOwner } from './resource-ownership';

const user = { id: 'user-1', email: 'owner@example.com', full_name: 'Ali Yılmaz' };

describe('resource ownership identity precedence', () => {
  it('uses the canonical user ID even if legacy contact details changed', () => {
    expect(isResourceOwner(user, { owner_user_id: user.id, owner_email: 'old@example.com' })).toBe(true);
  });
  it('does not grant access to a different user with the same display name or email', () => {
    expect(isResourceOwner(user, { owner_user_id: 'user-2', owner_email: user.email, owner_name: user.full_name })).toBe(false);
  });
  it('does not override a different legacy email with a matching name', () => {
    expect(isResourceOwner(user, { owner_email: 'other@example.com', owner_name: user.full_name })).toBe(false);
  });
  it('preserves legacy email and name ownership when stronger identifiers are missing', () => {
    expect(isResourceOwner(user, { owner_email: ' OWNER@example.com ' })).toBe(true);
    expect(isResourceOwner(user, { sorumlu: ' Ali Yılmaz ' })).toBe(true);
    expect(isResourceOwner(user, {})).toBe(false);
  });
});
