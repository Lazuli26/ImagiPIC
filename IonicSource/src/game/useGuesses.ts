import { useEffect, useState } from "react";
import { onSnapshot, query, orderBy, QuerySnapshot } from "firebase/firestore";
import { typedColl } from "../firebase/firestore";
import { GuessDoc } from "../types/database";

export function useGuesses(code: string, roundId: string) {
  const [guesses, setGuesses] = useState<GuessDoc[]>([]);

  useEffect(() => {
    setGuesses([]);
    if (!code || !roundId) {
      setGuesses([]);
      return;
    }

    const collRef = typedColl<GuessDoc>(
      "rooms/" + code + "/rounds/" + roundId + "/guesses"
    );
    const q = query(collRef, orderBy("submittedAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<GuessDoc>) => {
        const list: GuessDoc[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as GuessDoc);
        });
        setGuesses(list);
      }
    );

    return () => unsubscribe();
  }, [code, roundId]);

  return { guesses };
}
