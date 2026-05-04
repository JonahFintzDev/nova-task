// node_modules
import gsap from 'gsap';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function modalTransitionEnter(el: Element, done: () => void): void {
  if (prefersReducedMotion()) {
    done();
    return;
  }
  const wrap = el as HTMLElement;
  const backdrop = wrap.querySelector('.modal-backdrop');
  const panel = wrap.querySelector('.modal-panel');
  if (!backdrop || !panel) {
    done();
    return;
  }
  gsap.set(backdrop, { opacity: 0 });
  gsap.set(panel, { opacity: 0, y: 16, scale: 0.98 });
  gsap
    .timeline({ onComplete: done })
    .to(backdrop, { opacity: 1, duration: 0.22, ease: 'power2.out' }, 0)
    .to(panel, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' }, 0.04);
}

export function modalTransitionLeave(el: Element, done: () => void): void {
  if (prefersReducedMotion()) {
    done();
    return;
  }
  const wrap = el as HTMLElement;
  const backdrop = wrap.querySelector('.modal-backdrop');
  const panel = wrap.querySelector('.modal-panel');
  if (!backdrop || !panel) {
    done();
    return;
  }
  gsap
    .timeline({ onComplete: done })
    .to(panel, { opacity: 0, y: 12, scale: 0.985, duration: 0.18, ease: 'power2.in' }, 0)
    .to(backdrop, { opacity: 0, duration: 0.18, ease: 'power2.in' }, 0.04);
}

export function pageEnter(el: Element, done: () => void): void {
  if (prefersReducedMotion()) {
    done();
    return;
  }
  gsap.fromTo(
    el,
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.38, ease: 'power2.out', onComplete: done },
  );
}

export function pageLeave(el: Element, done: () => void): void {
  if (prefersReducedMotion()) {
    done();
    return;
  }
  gsap.to(el, { opacity: 0, y: -8, duration: 0.22, ease: 'power2.in', onComplete: done });
}

export function dropdownEnter(el: Element, done: () => void): void {
  if (prefersReducedMotion()) {
    done();
    return;
  }
  gsap.fromTo(
    el,
    { opacity: 0, y: -6, scale: 0.98 },
    { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power2.out', onComplete: done },
  );
}

export function dropdownLeave(el: Element, done: () => void): void {
  if (prefersReducedMotion()) {
    done();
    return;
  }
  gsap.to(el, {
    opacity: 0,
    y: -4,
    scale: 0.98,
    duration: 0.15,
    ease: 'power2.in',
    onComplete: done,
  });
}

export function fadeInElement(el: HTMLElement | null): void {
  if (!el || prefersReducedMotion()) {
    return;
  }
  gsap.fromTo(
    el,
    { opacity: 0 },
    { opacity: 1, duration: 0.45, ease: 'power2.out', clearProps: 'opacity' },
  );
}

export function staggerGridItems(container: HTMLElement | null, selector = '.grid-item'): void {
  if (!container || prefersReducedMotion()) {
    return;
  }
  const items = container.querySelectorAll(selector);
  if (!items.length) {
    return;
  }
  gsap.fromTo(
    items,
    { opacity: 0, y: 14 },
    {
      opacity: 1,
      y: 0,
      duration: 0.32,
      stagger: 0.045,
      ease: 'power2.out',
    },
  );
}

/** Exit animation when marking a task complete (before it leaves the active list). */
export function animateTaskCompleteExit(el: HTMLElement | null, done: () => void): void {
  if (!el) {
    done();
    return;
  }
  if (prefersReducedMotion()) {
    done();
    return;
  }
  gsap.to(el, {
    opacity: 0,
    x: 200,
    duration: 0.5,
    border: '2px solid #199b02',
    backgroundColor: '#199b0200',
    onComplete: () => {
      // gsap.set(el, { clearProps: 'opacity,transform' });
      done();
    },
  });
}
