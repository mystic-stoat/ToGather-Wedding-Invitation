import { Smartphone, Users, Send, CalendarHeart, Sparkles } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const features = [
  {
    icon: Smartphone,
    title: "Mobile First",
    desc: "Design a personalized invitation, create an all-in-one registry, and experience wedding planning the way it should be.",
  },
  {
    icon: Users,
    title: "Smart Guest List",
    desc: "Design a personalized invitation, create an all-in-one registry, and experience wedding planning the way it should be.",
  },
  {
    icon: Send,
    title: "Frictionless RSVP",
    desc: "Design a personalized invitation, create an all-in-one registry, and experience wedding planning the way it should be.",
  },
  {
    icon: CalendarHeart,
    title: "Single Source of Truth",
    desc: "Calendar integration — all event info to your default app.",
  },
  {
    icon: Sparkles,
    title: "Personalization",
    desc: "Design a personalized invitation, create an all-in-one registry, and experience wedding planning the way it should be.",
  },
];

const Features = () => (
  <section id="features" className="py-24 md:py-32">
    <div className="container mx-auto px-6">
      <ScrollReveal>
        <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center text-foreground mb-4 text-balance">
          Everything you need, beautifully simple
        </h2>
        <p className="text-muted-foreground text-center max-w-xl mx-auto mb-16 text-pretty">
          From invitations to guest management, ToGather brings every detail together in one elegant platform.
        </p>
      </ScrollReveal>

      <div className="space-y-24">
        {features.map((f, i) => (
          <ScrollReveal key={f.title} delay={80}>
            <div className={`flex flex-col md:flex-row items-center gap-12 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/20">
                  <f.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">{f.title}</h3>
                <p className="text-muted-foreground max-w-md text-pretty">{f.desc}</p>
              </div>
              <div className="flex-1 w-full aspect-[4/3] rounded-2xl bg-card shadow-lg border border-border/50" />
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
