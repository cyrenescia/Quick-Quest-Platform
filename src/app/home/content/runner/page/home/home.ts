import { useEffect, useState } from "react";
import { getRunnerHomeSeed, fetchRunnerTierStatus } from "./home.service";

export function useRunnerHomeVM() {
  const [vm] = useState(getRunnerHomeSeed());
  const [tierStatus, setTierStatus] = useState<any>(null);

  useEffect(() => {
    fetchRunnerTierStatus()
      .then((res) => {
        if (res) setTierStatus(res);
      })
      .catch(() => null);
  }, []);

  return { vm, tierStatus };
}
