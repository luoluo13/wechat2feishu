export type FeishuSyncErrorCode =
  | 'FEISHU_BIND_REQUIRED'
  | 'FEISHU_REAUTHORIZE_REQUIRED';

export class FeishuSyncError extends Error {
  code: FeishuSyncErrorCode;

  constructor(code: FeishuSyncErrorCode, message: string) {
    super(message);
    this.name = 'FeishuSyncError';
    this.code = code;
  }
}

export function isFeishuSyncError(error: unknown): error is FeishuSyncError {
  return (
    error instanceof Error &&
    error.name === 'FeishuSyncError' &&
    'code' in error
  );
}
