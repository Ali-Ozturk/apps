import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncWidgets } from '../widgets/syncWidgets';

export function useStored(key, initial) {
  const [value, setValue] = useState(initial);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    let active = true;

    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active || loaded.current) return;
        if (raw) setValue(JSON.parse(raw));
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });

    return () => { active = false; };
  }, [key]);

  const update = (next) => {
    setValue((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      loaded.current = true;
      AsyncStorage.setItem(key, JSON.stringify(resolved)).then(syncWidgets).catch(() => {});
      return resolved;
    });
  };

  return [value, update];
}
