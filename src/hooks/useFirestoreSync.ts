import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useFirestoreSync<T>(docId: string, initialValue: T) {
  const [data, setData] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'app_state', docId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const val = docSnap.data().data;
        setData(val);
        try {
          localStorage.setItem(docId, typeof val === 'string' ? val : JSON.stringify(val));
        } catch (e) {}
      } else {
        // Try to migrate from localStorage if available
        let localData = initialValue;
        try {
          const saved = localStorage.getItem(docId);
          if (saved) {
            localData = typeof initialValue === 'string' ? (saved as any) : JSON.parse(saved);
          }
        } catch (e) {}
        
        setDoc(docRef, { data: JSON.parse(JSON.stringify(localData)) }).catch(console.error);
        setData(localData);
        try {
          localStorage.setItem(docId, typeof localData === 'string' ? localData : JSON.stringify(localData));
        } catch (e) {}
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore sync error for", docId, error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [docId]);

  const updateData = (newData: T | ((prev: T) => T)) => {
    setData((prevData) => {
      const nextDataRaw = typeof newData === 'function' ? (newData as any)(prevData) : newData;
      const nextData = JSON.parse(JSON.stringify(nextDataRaw));
      setDoc(doc(db, 'app_state', docId), { data: nextData }).catch(console.error);
      try {
        localStorage.setItem(docId, typeof nextData === 'string' ? nextData : JSON.stringify(nextData));
      } catch (e) {}
      return nextData;
    });
  };

  return [data, updateData, isLoading] as const;
}
