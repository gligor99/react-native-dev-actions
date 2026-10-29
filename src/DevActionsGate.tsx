import { useEffect, useState, type ReactNode } from 'react';

type Initializable = {
  init(): Promise<void>;
  ready(): boolean;
};

/**
 * Renders `fallback` until every item in `wait` (env, flags) has read its
 * stored state. With sync storage (MMKV) children render immediately.
 */
export function DevActionsGate({
  wait,
  children,
  fallback = null,
}: {
  wait: Initializable[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [ready, setReady] = useState(() => wait.every((item) => item.ready()));

  useEffect(() => {
    if (ready) return;
    let mounted = true;
    Promise.all(wait.map((item) => item.init())).then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [ready, wait]);

  return <>{ready ? children : fallback}</>;
}
