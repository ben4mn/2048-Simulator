import { useRef, useEffect, useCallback } from 'react';
import type { Direction } from '../engine/types';

interface UseSwipeOptions {
  onSwipe: (direction: Direction) => void;
  enabled?: boolean;
  threshold?: number;
  maxTime?: number;
}

export function useSwipe({
  onSwipe,
  enabled = true,
  threshold = 30,
  maxTime = 500,
}: UseSwipeOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    },
    [enabled]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const dt = Date.now() - touchStart.current.time;

      touchStart.current = null;

      if (dt > maxTime) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < threshold && absDy < threshold) return;

      let direction: Direction;
      if (absDx > absDy) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'down' : 'up';
      }

      onSwipe(direction);
    },
    [enabled, onSwipe, threshold, maxTime]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchStart.current) return;
      e.preventDefault();
    },
    [enabled]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return ref;
}
