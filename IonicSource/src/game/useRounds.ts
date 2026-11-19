import { useEffect, useState } from "react";
import { onSnapshot, query, orderBy, QuerySnapshot, Unsubscribe } from "firebase/firestore";
import { typedColl } from "../firebase/firestore";
import { RoundDoc } from "../types/database";

export function useRounds(code: string) {
  const [rounds, setRounds] = useState<RoundDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!code) {
      setRounds([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const collRef = typedColl<RoundDoc>("rooms/" + code + "/rounds");
    const q = query(collRef, orderBy("roundIndex", "asc"));

    let unsubscribe: Unsubscribe | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempt = 0;

    // A Firestore listener is torn down permanently once it errors. Without a
    // re-subscribe, a transient network/permission error leaves this client
    // stuck on stale round data (white canvas) until a manual page refresh.
    const subscribe = () => {
      unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot<RoundDoc>) => {
          attempt = 0;
          const list: RoundDoc[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as RoundDoc);
          });
          setRounds(list);
          setLoading(false);
        },
        () => {
          setLoading(false);
          if (cancelled) return;
          const delay = Math.min(1000 * 2 ** attempt, 10000);
          attempt += 1;
          retryTimer = setTimeout(() => {
            if (!cancelled) subscribe();
          }, delay);
        }
      );
    };

    subscribe();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (unsubscribe) unsubscribe();
    };
  }, [code]);

  return { rounds, loading };
}
