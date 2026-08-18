import { ApiError } from '@/lib/http/api-error';
import type { AllowedUser } from '@/lib/authz';
import { userHasPermission } from '@/lib/permissions';

export type RequestResource = {
  requester_id?: string | null;
  assignee_id?: string | null;
};

export function isRequestParticipant(user: AllowedUser, request: RequestResource) {
  return request.requester_id === user.id || request.assignee_id === user.id;
}

export function canReadRequest(user: AllowedUser, request: RequestResource) {
  return userHasPermission(user, 'request.read.all') ||
    (userHasPermission(user, 'request.read.own') && isRequestParticipant(user, request));
}

export function assertCanReadRequest(user: AllowedUser, request: RequestResource) {
  if (!canReadRequest(user, request)) {
    throw new ApiError('NOT_FOUND', 'Talep bulunamadı veya erişim yetkiniz yok.', 404);
  }
}

export function assertCanManageRequest(user: AllowedUser) {
  if (!userHasPermission(user, 'request.manage')) {
    throw new ApiError('FORBIDDEN', 'Bu talebi yönetme yetkiniz yok.', 403);
  }
}

export function assertCanCommentRequest(user: AllowedUser, request: RequestResource) {
  if (userHasPermission(user, 'request.comment.all')) return;
  if (userHasPermission(user, 'request.comment.own') && isRequestParticipant(user, request)) return;
  throw new ApiError('NOT_FOUND', 'Talep bulunamadı veya erişim yetkiniz yok.', 404);
}
