import { useEffect, useState } from 'react';
import { fetchNetwork, type NetworkInfo } from './network';

/** The host's addresses, refreshed every few seconds so a tunnel started later shows up by itself. */
export function useNetwork(): { info: NetworkInfo | null; loaded: boolean } {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const next = await fetchNetwork();
      if (!alive) return;
      setInfo(next);
      setLoaded(true);
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return { info, loaded };
}
