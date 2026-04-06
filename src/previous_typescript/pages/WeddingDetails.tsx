import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Footer from "@/components/Footer";
import AppHeader from "@/components/AppHeader";
import ScrollReveal from "@/components/ScrollReveal";
import { Heart, MapPin, Calendar, Save, CheckCircle2 } from "lucide-react";

const SectionCard = ({
  icon: Icon,
  title,
  children,
  delay = 0,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) => (
  <ScrollReveal delay={delay}>
    <section className="bg-card rounded-2xl border border-border/50 shadow-md shadow-foreground/[0.03] p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
          <Icon size={20} className="text-accent" />
        </div>
        <h2 className="font-heading text-xl font-semibold text-foreground italic">{title}</h2>
      </div>
      {children}
    </section>
  </ScrollReveal>
);

const FormField = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const inputCls = "h-12 bg-background border-border/60 rounded-xl transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary";

const WeddingDetails = () => {
  const [stillDeciding, setStillDeciding] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Title bar */}
      <div className="bg-card/60 border-b border-border/50">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="font-heading text-2xl font-semibold text-foreground">Wedding Details</h1>
          <Button variant="default" size="default" className="rounded-xl gap-2" onClick={handleSave}>
            {saved ? (
              <><CheckCircle2 size={16} /> Saved!</>
            ) : (
              <><Save size={16} /> Save</>
            )}
          </Button>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-6 py-10 max-w-2xl space-y-8">
        {/* Personal Info */}
        <SectionCard icon={Heart} title="Personal Info">
          <div className="space-y-6">
            <FormField label="Partner one">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="First Name" className={inputCls} />
                <Input placeholder="Middle Name" className={inputCls} />
                <Input placeholder="Last Name" className={inputCls} />
              </div>
            </FormField>

            <FormField label="Partner two">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="First Name" className={inputCls} />
                <Input placeholder="Middle Name" className={inputCls} />
                <Input placeholder="Last Name" className={inputCls} />
              </div>
            </FormField>

            <FormField label="Event Display Title">
              <Input placeholder="Jane & John" className={inputCls} />
            </FormField>
          </div>
        </SectionCard>

        {/* Wedding Details */}
        <SectionCard icon={Calendar} title="Wedding Details" delay={80}>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-1 w-full">
                <FormField label="Date">
                  <Input type="date" className={inputCls} />
                </FormField>
              </div>
              <div className="flex items-center gap-2 pb-1 sm:pb-3">
                <Checkbox
                  id="deciding"
                  checked={stillDeciding}
                  onCheckedChange={(v) => setStillDeciding(v === true)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="deciding" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                  We're still deciding
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Ceremony Time">
                <Input type="time" className={inputCls} />
              </FormField>
              <FormField label="Time Zone">
                <Select>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Central Standard Time" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="est">Eastern Standard Time</SelectItem>
                    <SelectItem value="cst">Central Standard Time</SelectItem>
                    <SelectItem value="mst">Mountain Standard Time</SelectItem>
                    <SelectItem value="pst">Pacific Standard Time</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </div>
        </SectionCard>

        {/* Venue */}
        <SectionCard icon={MapPin} title="Venue & Location" delay={160}>
          <div className="space-y-6">
            <FormField label="Event Venue">
              <Input placeholder="Wedding Gardens" className={inputCls} />
            </FormField>
            <FormField label="Reception Venue">
              <Input placeholder="Wedding Reception Gardens" className={inputCls} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="City">
                <Input className={inputCls} />
              </FormField>
              <FormField label="State">
                <Input className={inputCls} />
              </FormField>
            </div>
          </div>
        </SectionCard>
      </main>

      <Footer />
    </div>
  );
};

export default WeddingDetails;
