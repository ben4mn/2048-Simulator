import { useCallback, useEffect, useState } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Minimal focus trap + Escape-to-close for a dialog/overlay element.
 * Attach the returned ref callback to the dialog's outer container. While
 * `active`, moves initial focus into the dialog, cycles Tab/Shift+Tab
 * within it, and calls `onClose` when Escape is pressed.
 *
 * Uses a callback ref (backed by state) rather than a plain useRef so the
 * effect re-attaches correctly even when the container only mounts on a
 * later render (e.g. behind a loading/conditional guard).
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean, onClose: () => void) {
  const [container, setContainer] = useState<T | null>(null);
  const containerRef = useCallback((node: T | null) => {
    setContainer(node);
  }, []);

  useEffect(() => {
    if (!active || !container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );

    const initial = getFocusable();
    (initial[0] || container).focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active, onClose, container]);

  return containerRef;
}
