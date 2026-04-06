import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-wedding.jpg";
import { useEffect, useRef, useState } from "react";
const Hero = () => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), {
      threshold: 0.2
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return <section ref={ref} className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16">
      <img src={heroImg} alt="Elegant wedding table setting" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-foreground/40" />
      <div className={`relative z-10 text-center max-w-2xl mx-auto px-6 transition-all duration-700 ${visible ? "animate-fade-up" : "opacity-0"}`}>
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.1] text-balance mb-6" style={{
        textShadow: '0 2px 20px rgba(0,0,0,0.3)'
      }}>
          Invite to your life
        </h1>
        <p className="text-white/90 text-lg md:text-xl font-body max-w-lg mx-auto mb-10 text-pretty" style={{
        textShadow: '0 1px 8px rgba(0,0,0,0.3)'
      }}>
          Design a personalized invitation, create an all-in-one registry, and experience wedding planning the way it should be.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup"><Button variant="hero" size="xl">Get started free</Button></Link>
          <a href="#features">
            <Button variant="hero-outline" size="xl" className="border-white/80 text-white hover:bg-white hover:text-foreground">
              See how it works
            </Button>
          </a>
        </div>
      </div>
    </section>;
};
export default Hero;
