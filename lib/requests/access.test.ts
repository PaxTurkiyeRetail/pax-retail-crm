import { describe, expect, it } from 'vitest';
import type { AllowedUser } from '@/lib/authz';
import { canReadRequest, isRequestParticipant } from './access';

function user(role: AllowedUser['role'], id = 'user-1'): AllowedUser {
  return { id, email: `${id}@example.com`, full_name: id, role };
}

describe('request ownership', () => {
  it('recognizes requester and assignee as participants', () => {
    expect(isRequestParticipant(user('user'), { requester_id: 'user-1' })).toBe(true);
    expect(isRequestParticipant(user('user'), { assignee_id: 'user-1' })).toBe(true);
  });

  it('does not expose unrelated requests to a basic user', () => {
    expect(canReadRequest(user('user'), { requester_id: 'someone-else' })).toBe(false);
  });

  it('allows operational roles to read all requests', () => {
    expect(canReadRequest(user('itsm'), { requester_id: 'someone-else' })).toBe(true);
  });

  it('uses database-provided permissions over static role defaults', () => {
    const restrictedItsm: AllowedUser = { ...user('itsm'), permissions: ['request.read.own'] };
    expect(canReadRequest(restrictedItsm, { requester_id: 'someone-else' })).toBe(false);

    const delegatedUser: AllowedUser = { ...user('user'), permissions: ['request.read.all'] };
    expect(canReadRequest(delegatedUser, { requester_id: 'someone-else' })).toBe(true);
  });
});
