import { useEffect, useState } from 'react';
import { typedDoc } from '../firebase/firestore';
import { RoundDoc } from '../types/database';
import { watchDocument } from './watchDocument';

export function useCurrentRound(code: string, roundIndex: number | null) {
  const [current, setCurrent] = useState<{ code: string; round: RoundDoc | null } | null>(null);

  useEffect(() => {
    setCurrent(null);
    if (!code || roundIndex === null) return;
    const roundRef = typedDoc<RoundDoc>('rooms', code, 'rounds', `round-${roundIndex}`);
    return watchDocument(roundRef, snapshot => {
      setCurrent({ code, round: snapshot.exists() ? snapshot.data({ serverTimestamps: 'estimate' }) : null });
    }, error => console.warn('Round synchronization failed:', error));
  }, [code, roundIndex]);

  return current?.code === code && current.round?.roundIndex === roundIndex ? current.round : null;
}
