import { useRef, useEffect } from 'react';
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

  // Keep latest values in refs so the listeners below can be attached exactly
  // once (on mount) instead of being torn down and re-added every time
  // `enabled` (or any other option) changes.
  const enabledRef = useRef(enabled);
  const onSwipeRef = useRef(onSwipe);
  const thresholdRef = useRef(threshold);
  const maxTimeRef = useRef(maxTime);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  useEffect(() => {
    maxTimeRef.current = maxTime;
  }, [maxTime]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return;
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!enabledRef.current || !touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const dt = Date.now() - touchStart.current.time;

      touchStart.current = null;

      if (dt > maxTimeRef.current) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < thresholdRef.current && absDy < thresholdRef.current) return;

      let direction: Direction;
      if (absDx > absDy) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'down' : 'up';
      }

      onSwipeRef.current(direction);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!enabledRef.current || !touchStart.current) return;
      e.preventDefault();
    };

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
    // Intentionally empty: listeners are attached once and read live values
    // via refs, so toggling `enabled` never tears down/re-adds them.
  }, []);

  return ref;
}
