import { RefObject, useLayoutEffect } from 'react';

// Mobile keyboards can shrink only the visual viewport, leaving Ionic's page
// (and its bottom composer) underneath the keyboard. Follow that visible area.
export function useVisualViewport(ref: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const page = ref.current;
    if (!page) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Keep native pinch zoom available instead of resizing the page into it.
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      const focused = page.contains(document.activeElement) &&
        document.activeElement?.matches('input, textarea, [contenteditable="true"]');
      page.style.setProperty('--room-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      // Some Safari versions retain a stale offset after keyboard dismissal.
      page.style.setProperty('--room-viewport-top', `${focused ? viewport?.offsetTop ?? 0 : 0}px`);
    };
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      page.style.removeProperty('--room-viewport-height');
      page.style.removeProperty('--room-viewport-top');
    };
  }, [ref]);
}
