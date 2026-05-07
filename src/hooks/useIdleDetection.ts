import { useEffect, useRef, useCallback } from "react";

/**
 * Hook to detect user idle state.
 * Returns { isIdle, resetIdle }.
 * - isIdle: true when no user activity for `thresholdMs`
 * - resetIdle: manually mark user as active
 *
 * Listens to: mousemove, mousedown, keydown, touchstart, scroll
 */
export function useIdleDetection(thresholdMs: number = 5 * 60 * 1000) {
  const isIdleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resetIdle = useCallback(() => {
    if (isIdleRef.current) {
      isIdleRef.current = false;
      console.log("[DevDash] User active — resuming polling");
    }
    // Clear existing timer and start a new one
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      console.log("[DevDash] User idle — pausing polling");
    }, thresholdMs) as unknown as ReturnType<typeof setTimeout>;
  }, [thresholdMs]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

    // Start the initial timer
    resetIdle();

    // Listen for user activity
    for (const event of events) {
      window.addEventListener(event, resetIdle, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of events) {
        window.removeEventListener(event, resetIdle);
      }
    };
  }, [resetIdle]);

  return { isIdleRef, resetIdle };
}
