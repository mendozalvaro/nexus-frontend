export type ScrollRevealAnimation = "fade-up" | "fade-in" | "slide-left" | "slide-right" | "zoom-in";

export const useScrollReveal = (options?: {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  delay?: number;
  stagger?: number;
  animation?: ScrollRevealAnimation;
}) => {
  const {
    threshold = 0.1,
    rootMargin = "0px 0px -40px 0px",
    once = true,
    delay = 0,
    stagger = 80,
    animation = "fade-up",
  } = options ?? {};

  const observedElements = ref<Element[]>([]);
  const visibleSet = reactive(new Set<Element>());

  let observer: IntersectionObserver | null = null;

  const createObserver = () => {
    if (typeof IntersectionObserver === "undefined") {
      return null;
    }

    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSet.add(entry.target);
            if (once) {
              observer?.unobserve(entry.target);
            }
          } else if (!once) {
            visibleSet.delete(entry.target);
          }
        });
      },
      { threshold, rootMargin },
    );
  };

  const observe = (el: Element | null) => {
    if (!el) {
      return;
    }

    if (!observer) {
      observer = createObserver();
    }

    observer?.observe(el);
    observedElements.value.push(el);
  };

  const isVisible = (el: Element | null | undefined, _index = 0): boolean => {
    if (!el) {
      return false;
    }

    return visibleSet.has(el);
  };

  const animationStyles: Record<ScrollRevealAnimation, { hidden: { opacity: number; transform: string }; visible: { opacity: number; transform: string } }> = {
    "fade-up": {
      hidden: { opacity: 0, transform: "translateY(24px) scale(0.98)" },
      visible: { opacity: 1, transform: "translateY(0) scale(1)" },
    },
    "fade-in": {
      hidden: { opacity: 0, transform: "translateY(0) scale(1)" },
      visible: { opacity: 1, transform: "translateY(0) scale(1)" },
    },
    "slide-left": {
      hidden: { opacity: 0, transform: "translateX(30px) scale(0.98)" },
      visible: { opacity: 1, transform: "translateX(0) scale(1)" },
    },
    "slide-right": {
      hidden: { opacity: 0, transform: "translateX(-30px) scale(0.98)" },
      visible: { opacity: 1, transform: "translateX(0) scale(1)" },
    },
    "zoom-in": {
      hidden: { opacity: 0, transform: "translateY(0) scale(0.9)" },
      visible: { opacity: 1, transform: "translateY(0) scale(1)" },
    },
  };

  const getStyle = (el: Element | null | undefined, _index = 0) => {
    const visible = isVisible(el, _index);
    const anim = animationStyles[animation];
    const baseDelay = delay + _index * stagger;
    const state = visible ? anim.visible : anim.hidden;

    return {
      opacity: state.opacity,
      transform: state.transform,
      transition: `opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${baseDelay}ms, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${baseDelay}ms`,
    };
  };

  const getParallaxStyle = (scrollY: number, rate = 0.15) => {
    return {
      transform: `translateY(${scrollY * rate}px)`,
      transition: "transform 0.1s linear",
    };
  };

  const cleanup = () => {
    observer?.disconnect();
    observer = null;
    observedElements.value = [];
  };

  onUnmounted(cleanup);

  return {
    observe,
    isVisible,
    getStyle,
    getParallaxStyle,
    cleanup,
  };
};
