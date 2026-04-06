import { useEffect, useRef, useState } from "react";
const ScrollReveal = ({
  children,
  className = "",
  delay = 0
}) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVisible(true);
    }, {
      threshold: 0.15
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`transition-all duration-700 ${className}`} style={{
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    filter: visible ? "blur(0)" : "blur(4px)",
    transitionDelay: `${delay}ms`,
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)"
  }}>
      {children}
    </div>;
};
export default ScrollReveal;
