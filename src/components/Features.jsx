import { Smartphone, Users, Send, CalendarHeart, Sparkles, MessageCircle } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import mobileFirstImage from "../assets/mobile-first-wedding-invitation.png";
import smartGuestListImage from "../assets/smart-guest-list.png";
import rsvpImage from "../assets/frictionless-rsvp-wedding-invitation.png";
import singleSourceImage from "../assets/single-source-of-truth-workspace.png";
import personalizationImage from "../assets/personalized-wedding-planning.png";
import aiAssistantImage from "../assets/ai-wedding-assistant.png";
const features = [
  {
    icon: Smartphone,
    title: "Your Invitation, Wherever They Are.",
    desc: "Create and share beautiful digital invitations that look great on any device, making it easy for guests to access your wedding details wherever they are.",
    image: mobileFirstImage
  },
  {
    icon: Users,
    title: "Every Guest, Thoughtfully Organized.",
    desc: "Keep track of your guest list, organize important information, and manage everyone you're celebrating with in one convenient place.",
    image: smartGuestListImage
  },
  {
    icon: Send,
    title: "RSVPs Made Effortless.",
    desc: "Give guests a simple way to RSVP, confirm attendance, and share meal preferences, while keeping every response organized in one place.",
    image: rsvpImage
  },
  {
    icon: CalendarHeart,
    title: "Everything Together, Beautifully Organized.",
    desc: "From the ceremony to the celebration, keep your wedding details together so everyone knows where to be and when the fun begins.",
    image: singleSourceImage
  },
  {
    icon: Sparkles,
    title: "Your Invitation, Your Aesthetic.",
    desc: "Design a wedding invitation as unique as your love story. Personalize the colors, typography, photos, and details to create something truly your own.",
    image: personalizationImage
  },
  {
    icon: MessageCircle,
    title: "Say Hello to Your AI Plus-One.",
    desc: "Chat with your AI Wedding Assistant to explore ideas, organize wedding details, and get helpful suggestions for your plans. You choose what makes the cut.",
    image: aiAssistantImage
  }
];

const Features = () => <section id="features" className="py-24 md:py-32">
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
        {features.map((f, i) => <ScrollReveal key={f.title} delay={80}>
            <div className={`flex flex-col md:flex-row items-center gap-12 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">{f.title}</h3>
                <p className="text-muted-foreground max-w-md text-pretty">{f.desc}</p>
              </div>
              <div className="flex-1 w-full aspect-[4/3] rounded-2xl bg-card shadow-lg border border-border/50 overflow-hidden">
                {f.image && (
                  <img
                    src={f.image}
                    alt={`${f.title} feature`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            </div>
          </ScrollReveal>)}
      </div>
    </div>
  </section>;
export default Features;
