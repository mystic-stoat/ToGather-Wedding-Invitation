import { Instagram } from "lucide-react";
const Footer = () => <footer className="bg-foreground text-primary-foreground py-16">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
        <div className="col-span-2 md:col-span-1">
          <p className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-4">Follow ToGather</p>
          <div className="flex gap-3">
            <a href="#" aria-label="Instagram" className="w-10 h-10 rounded-full border border-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/10 transition-colors">
              <Instagram size={18} />
            </a>
            <a href="#" aria-label="Threads" className="w-10 h-10 rounded-full border border-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/10 transition-colors text-xs font-bold">
              @
            </a>
            <a href="#" aria-label="TikTok" className="w-10 h-10 rounded-full border border-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/10 transition-colors text-xs font-bold">
              ♪
            </a>
          </div>
        </div>

        {[{
        title: "My Account",
        links: ["Sign in", "Register"]
      }, {
        title: "Help",
        links: ["FAQs", "Customer support"]
      }, {
        title: "Legal Stuff",
        links: ["Terms of use", "Privacy policy"]
      }, {
        title: "About",
        links: ["About us", "Careers"]
      }].map(col => <div key={col.title}>
            <p className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-4">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map(l => <li key={l}>
                  <a href="#" className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors">{l}</a>
                </li>)}
            </ul>
          </div>)}
      </div>

      <div className="border-t border-primary-foreground/10 pt-8">
        <p className="text-xs text-primary-foreground/40">© 2026 ToGather LLC. All Rights Reserved.</p>
      </div>
    </div>
  </footer>;
export default Footer;
