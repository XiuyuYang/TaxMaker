import { useEffect, useRef } from 'react';
import { api, Receipt } from '../api/client';

interface PollingOptions {
  onReady: (receipt: Receipt) => void;
  onError?: (err: Error) => void;
  resetKey?: number;
}

const PENDING_STATUSES: Receipt['status'][] = ['uploaded', 'processing'];
const MAX_POLLS = 60;

// Errors that indicate the resource is permanently inaccessible — no point retrying
const isPermanentError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('not found') || msg.includes('not authenticated')
    || msg.includes('401') || msg.includes('403') || msg.includes('404');
};

export function useReceiptPolling(id: string, { onReady, onError, resetKey = 0 }: PollingOptions) {
  const pollCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    if (!id) return;
    pollCount.current = 0;
    stopped.current = false;

    const poll = async () => {
      if (stopped.current) return;
      try {
        const receipt = await api.receipts.get(id);
        if (!PENDING_STATUSES.includes(receipt.status)) {
          stopped.current = true;
          onReady(receipt);
          return;
        }
      } catch (err) {
        // Permanent errors (404/401): stop polling and report
        if (isPermanentError(err)) {
          stopped.current = true;
          onError?.(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        // Transient network errors: silently retry
      }
      pollCount.current++;
      if (pollCount.current >= MAX_POLLS) {
        stopped.current = true;
        return;
      }
      if (!stopped.current) {
        timer.current = setTimeout(poll, 2000);
      }
    };

    poll();

    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, onReady, onError, resetKey]);
}
