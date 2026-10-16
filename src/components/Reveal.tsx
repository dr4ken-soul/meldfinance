import { useEffect, useRef, type PropsWithChildren } from 'react';

export function Reveal({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      element.classList.remove('is-pending');
      element.classList.add('is-visible');
      observer.disconnect();
    }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });

    if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add('is-pending');
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`reveal ${className}`.trim()}>{children}</div>;
}
