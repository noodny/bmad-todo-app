import { useEffect } from "react";

export function useConnectivity(onChange: (online: boolean) => void) {
  useEffect(() => {
    const update = () => onChange(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [onChange]);
}
