import { DocumentReference, DocumentSnapshot, getDocFromServer, onSnapshot } from 'firebase/firestore';

// Listeners normally deliver every transition. A visible client also checks the
// server so a stalled connection recovers without requiring a page reload.
export function watchDocument<T>(
  reference: DocumentReference<T>,
  next: (snapshot: DocumentSnapshot<T>) => void,
  error: (error: Error) => void = () => {},
) {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let revision = 0;
  let serverSeen = false;
  let pendingWrites = false;
  let refreshing = false;

  const accept = (snapshot: DocumentSnapshot<T>) => {
    if (cancelled) return;
    const cached = snapshot.metadata.fromCache;
    const pending = snapshot.metadata.hasPendingWrites;
    if (cached && serverSeen && !pending && !pendingWrites) return;
    if (!cached) serverSeen = true;
    pendingWrites = pending;
    revision += 1;
    next(snapshot);
  };
  const subscribe = () => {
    if (cancelled) return;
    unsubscribe?.();
    unsubscribe = onSnapshot(reference, { includeMetadataChanges: true }, snapshot => {
      attempts = 0;
      accept(snapshot);
    }, err => {
      if (cancelled) return;
      error(err);
      retryTimer = setTimeout(subscribe, Math.min(1000 * 2 ** attempts++, 10000));
    });
  };
  const refresh = () => {
    if (cancelled || refreshing || document.visibilityState === 'hidden') return;
    refreshing = true;
    const requestedRevision = revision;
    getDocFromServer(reference).then(snapshot => {
      // Never overwrite a listener update or an optimistic write with an older
      // read that was already in flight when that update arrived.
      if (revision === requestedRevision && !pendingWrites) accept(snapshot);
    }).catch(err => { if (!cancelled) error(err); }).finally(() => { refreshing = false; });
  };

  subscribe();
  const poll = setInterval(refresh, 10000);
  window.addEventListener('online', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  return () => {
    cancelled = true;
    unsubscribe?.();
    clearTimeout(retryTimer);
    clearInterval(poll);
    window.removeEventListener('online', refresh);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}
