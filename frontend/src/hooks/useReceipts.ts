import { useEffect, useRef } from 'react';
import { api, Receipt } from '../api/client';

interface PollingOptions {
  onReady: (receipt: Receipt) => void;
  resetKey?: number;
}

const PENDING_STATUSES: Receipt['status'][] = ['uploaded', 'processing'];
const MAX_POLLS = 60;

export function useReceiptPolling(id: string, { onReady, resetKey = 0 }: PollingOptions) {
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
      } catch {
        // ignore transient errors
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
  }, [id, onReady, resetKey]);
}
