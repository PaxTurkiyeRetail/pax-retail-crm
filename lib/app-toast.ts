export type AppToastType = 'info' | 'success' | 'error' | 'loading' | 'warning';

export type AppToastPayload = {
  id?: string;
  type?: AppToastType;
  title: string;
  description?: string;
  duration?: number;
  dismiss?: boolean;
};

function emitToast(payload: AppToastPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AppToastPayload>('app-toast', { detail: payload }));
}

function createId(prefix = 'toast') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function getMessageFromError(error: unknown, fallback = 'Beklenmeyen bir hata oluştu.') {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export const appToast = {
  show: emitToast,
  info: (title: string, description?: string, duration?: number) =>
    emitToast({ type: 'info', title, description, duration }),
  success: (title: string, description?: string, duration?: number) =>
    emitToast({ type: 'success', title, description, duration }),
  warning: (title: string, description?: string, duration?: number) =>
    emitToast({ type: 'warning', title, description, duration }),
  error: (title: string, description?: string, duration?: number) =>
    emitToast({ type: 'error', title, description, duration }),
  loading: (title: string, description?: string, id = createId('loading')) => {
    emitToast({ id, type: 'loading', title, description, duration: 0 });
    return id;
  },
  update: (id: string, payload: Omit<AppToastPayload, 'id'>) =>
    emitToast({ ...payload, id }),
  dismiss: (id: string) =>
    emitToast({ id, title: '', dismiss: true }),
  async promise<T>(promise: Promise<T>, messages: {
    loading: string;
    success: string;
    error: string;
    loadingDescription?: string;
    successDescription?: string;
    errorDescription?: string;
  }) {
    const id = appToast.loading(messages.loading, messages.loadingDescription);
    try {
      const result = await promise;
      appToast.update(id, {
        type: 'success',
        title: messages.success,
        description: messages.successDescription,
        duration: 4200,
      });
      return result;
    } catch (error) {
      appToast.update(id, {
        type: 'error',
        title: messages.error,
        description: messages.errorDescription ?? getMessageFromError(error),
        duration: 7000,
      });
      throw error;
    }
  },
};

export function normalizeAppError(error: unknown, fallback?: string) {
  return getMessageFromError(error, fallback);
}
