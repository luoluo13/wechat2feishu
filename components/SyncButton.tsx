'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  UploadCloud,
} from 'lucide-react';

interface SyncButtonProps {
  articleId: string;
  initialStatus: string;
  feishuUrl?: string | null;
}

interface SyncErrorPayload {
  code?: string;
  error?: string;
  userMessage?: string;
  detail?: string;
  actionUrl?: string | null;
  actionLabel?: string;
}

function isExternalActionUrl(url?: string | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

export default function SyncButton({
  articleId,
  initialStatus,
  feishuUrl,
}: SyncButtonProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<SyncErrorPayload | null>(null);
  const router = useRouter();
  const actionIsExternal = isExternalActionUrl(syncError?.actionUrl);

  const handleSync = async () => {
    setIsLoading(true);
    setSyncError(null);

    try {
      const res = await fetch(`/api/articles/${articleId}/sync`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setSyncError({
          code: data.code,
          error: data.error,
          userMessage: data.userMessage || '同步失败，请稍后重试。',
          detail: data.detail,
          actionUrl: data.actionUrl,
          actionLabel: data.actionLabel,
        });
        return;
      }

      setStatus('synced');
      router.refresh();

      if (data.feishuUrl) {
        window.open(data.feishuUrl, '_blank');
      }
    } catch (error) {
      console.error('Sync failed', error);
      setSyncError({
        userMessage: '同步失败，请检查网络连接后重试。',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderErrorCard = () => {
    if (!syncError) {
      return null;
    }

    return (
      <div className="max-w-[360px] rounded-2xl border border-[#FFB800]/20 bg-[#FFF9ED] px-4 py-3 text-left text-[13px] text-black/70 shadow-sm">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
          <div className="space-y-2">
            <p className="font-medium text-black/80">{syncError.userMessage}</p>
            {syncError.detail && <p className="text-black/55">{syncError.detail}</p>}
            {syncError.actionUrl && (
              <a
                href={syncError.actionUrl}
                target={actionIsExternal ? '_blank' : undefined}
                rel={actionIsExternal ? 'noreferrer' : undefined}
                className="inline-flex items-center gap-1 font-medium text-[#B45309] hover:text-[#92400E]"
              >
                {syncError.actionLabel || '去处理'}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (status === 'synced' || status === 'completed') {
    return (
      <div className="flex flex-col items-end gap-3">
        <a
          href={feishuUrl || '#'}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-[#F5F5F7] px-4 py-2 text-sm font-medium text-black/60 transition-colors hover:bg-[#E5E5E5]"
        >
          <CheckCircle className="h-4 w-4 text-green-500" />
          已同步至飞书
        </a>
        {renderErrorCard()}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <button
        onClick={handleSync}
        disabled={isLoading || status === 'syncing'}
        className="relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-black px-5 py-2.5 text-sm font-semibold tracking-wide text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            同步中...
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4" />
            推送到飞书
          </>
        )}
      </button>

      {renderErrorCard()}
    </div>
  );
}
