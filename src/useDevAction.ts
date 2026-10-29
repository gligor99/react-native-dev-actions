import { useEffect, useLayoutEffect, useRef } from 'react';
import { devActions } from './registry';
import type { DevAction } from './types';

/**
 * Registers an action while the component is mounted. The handler can use
 * the latest props/context without re-registering.
 */
export function useDevAction({ id, title, onPress }: DevAction): void {
  const onPressRef = useRef(onPress);

  useLayoutEffect(() => {
    onPressRef.current = onPress;
  });

  useEffect(
    () =>
      devActions.register({ id, title, onPress: () => onPressRef.current() }),
    [id, title]
  );
}
