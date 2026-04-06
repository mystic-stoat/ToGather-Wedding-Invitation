import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Footer from "@/components/Footer";
import AppHeader from "@/components/AppHeader";
import ScrollReveal from "@/components/ScrollReveal";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Users, CheckCircle2, Clock, XCircle, Search, UserPlus } from "lucide-react";

const rsvpData = [
  { name: "Accepted", value: 20, color: "hsl(100, 14%, 49%)" },
  { name: "Delivered", value: 50, color: "hsl(110, 16%, 61%)" },
  { name: "Declined", value: 30, color: "hsl(350, 80%, 72%)" },
];

const mealData = [
  { name: "Fish", value: 20, color: "hsl(100, 14%, 49%)" },
  { name: "Beef", value: 50, color: "hsl(110, 16%, 61%)" },
  { name: "Chicken", value: 30, color: "hsl(350, 56%, 84%)" },
];

const guests = [
  { name: "John Smith", status: "Delivered", date: "03/15/2026", meal: "N/A", plusOne: "N/A", rehearsal: "N/A" },
  { name: "Rebecca Sanchez", status: "Opened", date: "03/14/2026", meal: "N/A", plusOne: "N/A", rehearsal: "N/A" },
  { name: "Colleen Mikulastik", status: "Accepted", date: "03/12/2026", meal: "Fish", plusOne: "Yes", rehearsal: "Yes" },
];

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    Accepted: "bg-primary/15 text-primary border-primary/20",
    Delivered: "bg-secondary/15 text-secondary border-secondary/20",
    Opened: "bg-accent/20 text-accent border-accent/20",
    Declined: "bg-destructive/15 text-destructive border-destructive/20",
  };
  return map[s] || "bg-muted text-muted-foreground border-border";
};

const summaryCards = [
  { label: "Total Guests", value: "148", icon: Users, color: "bg-primary/10 text-primary" },
  { label: "Confirmed", value: "42", icon: CheckCircle2, color: "bg-primary/10 text-primary" },
  { label: "Pending", value: "89", icon: Clock, color: "bg-accent/15 text-accent" },
  { label: "Declined", value: "17", icon: XCircle, color: "bg-destructive/10 text-destructive" },
];

const ChartCard = ({ title, data }: { title: string; data: typeof rsvpData }) => (
  <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-md shadow-foreground/[0.03]">
    <h3 className="font-heading text-base font-semibold text-foreground mb-4">{title}</h3>
    <div className="flex items-center gap-6">
      <div className="w-28 h-28 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" strokeWidth={2} stroke="hsl(24, 26%, 92%)">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0 20% 95%)",
                border: "1px solid hsl(24 16% 84%)",
                borderRadius: "0.75rem",
                fontSize: "0.8125rem",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2.5 text-sm">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.value}%</span>
            <span className="text-foreground font-medium">·</span>
            <span className="text-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [search, setSearch] = useState("");

  const filtered = guests.filter(
    (g) => g.name.toLowerCase().includes(search.toLowerCase()) || g.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Quick actions */}
      <div className="bg-card/60 border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center gap-3 overflow-x-auto">
          <Link to="/wedding-details">
            <Button variant="default" size="sm" className="rounded-xl whitespace-nowrap">Wedding Details</Button>
          </Link>
          <Link to="/create-invitation">
            <Button variant="default" size="sm" className="rounded-xl whitespace-nowrap">Create Invitation</Button>
          </Link>
          <Link to="/">
            <div className="bg-foreground rounded-xl px-4 py-1.5 ml-auto">
              <span className="font-heading text-base font-bold text-primary-foreground">ToGather</span>
            </div>
          </Link>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-6 py-10">
        {/* Welcome */}
        <ScrollReveal>
          <h1 className="font-heading text-3xl md:text-4xl font-semibold text-foreground mb-8">
            Welcome Back!
          </h1>
        </ScrollReveal>

        {/* Summary Cards */}
        <ScrollReveal delay={60}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {summaryCards.map((c) => (
              <div
                key={c.label}
                className="bg-card rounded-2xl border border-border/50 p-5 shadow-md shadow-foreground/[0.03] hover:shadow-lg transition-shadow duration-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
                    <c.icon size={20} />
                  </div>
                </div>
                <p className="font-heading text-2xl font-bold text-foreground tabular-nums">{c.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Charts */}
        <ScrollReveal delay={120}>
          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            <ChartCard title="RSVP Status" data={rsvpData} />
            <ChartCard title="Meal Preference" data={mealData} />
          </div>
        </ScrollReveal>

        {/* Guest List */}
        <ScrollReveal delay={180}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-heading text-xl font-semibold text-foreground uppercase tracking-wider">
              Guest List
            </h2>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search guests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 bg-card border-border/60 rounded-xl w-full sm:w-64"
                />
              </div>
              <Button variant="outline" size="sm" className="rounded-xl gap-2 border-border/60">
                <UserPlus size={16} /> Add Guest
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
              <Users size={40} className="mx-auto text-muted-foreground/40 mb-4" />
              <p className="font-heading text-lg text-foreground mb-1">No guests found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try a different search term" : "Start by adding your first guest"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card shadow-md shadow-foreground/[0.03]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    {["Name", "Status", "Date", "Meal Preference", "Plus One", "Rehearsal"].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors duration-150 cursor-pointer"
                    >
                      <td className="px-5 py-4 font-medium text-foreground">{g.name}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge(g.status)}`}>
                          {g.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground tabular-nums">{g.date}</td>
                      <td className="px-5 py-4 text-muted-foreground">{g.meal}</td>
                      <td className="px-5 py-4 text-muted-foreground">{g.plusOne}</td>
                      <td className="px-5 py-4 text-muted-foreground">{g.rehearsal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScrollReveal>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
