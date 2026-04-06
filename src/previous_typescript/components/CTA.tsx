import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ScrollReveal from "./ScrollReveal";

const CTA = () => (
  <section className="py-24 md:py-32">
    <div className="container mx-auto px-6">
      <ScrollReveal>
        <div className="bg-primary rounded-3xl p-12 md:p-20 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-primary-foreground mb-4 text-balance">
            Start planning your perfect day
          </h2>
          <p className="text-primary-foreground/80 max-w-lg mx-auto mb-8 text-pretty">
            Join thousands of couples who trust ToGather to bring their wedding vision to life.
          </p>
          <Link to="/signup">
            <Button
              variant="hero-outline"
              size="xl"
              className="border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              Create your wedding — free
            </Button>
          </Link>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default CTA;
