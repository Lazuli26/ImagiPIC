import { useEffect, useState } from 'react';
import { typedDoc } from '../firebase/firestore';
import { RoomDoc } from '../types/database';
import { watchDocument } from './watchDocument';

export function useRoom(code: string) {
  const [current, setCurrent] = useState<{ code: string; room: RoomDoc | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setCurrent(null);
    setError(null);
    setLoading(!!code);
    if (!code) return;
    return watchDocument(typedDoc<RoomDoc>('rooms', code), snapshot => {
      setCurrent({ code, room: snapshot.exists() ? snapshot.data() : null });
      setLoading(false);
      setError(null);
    }, err => {
      setError(err);
      setLoading(false);
    });
  }, [code]);

  return { room: current?.code === code ? current.room : null, loading, error };
}
