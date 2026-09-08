import { SiInstagram } from "react-icons/si";
const Footer = () => <footer className="bg-foreground text-primary-foreground py-16">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
        <div className="col-span-2 md:col-span-1">
          <p className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-4">Follow ToGather</p>
          <div className="flex gap-3">
            <a href="https://www.instagram.com/togathernewlyweds" aria-label="Instagram" className="w-10 h-10 rounded-full border border-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/10 transition-colors" target = "_blank">
              <SiInstagram size={18} />
            </a>
            <a href="https://www.threads.com/togathernewlyweds" aria-label="Threads" className="w-10 h-10 rounded-full border border-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/10 transition-colors text-xs font-bold" target = "_blank">
              @
            </a>
            <a href="https://www.tiktok.com/togathernewlyweds" aria-label="TikTok" className="w-10 h-10 rounded-full border border-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/10 transition-colors text-xs font-bold" target = "_blank">
              ♪
            </a>
          </div>
        </div>

        {[{
        title: "My Account",
        links: [
          {name: "Sign in", href: "/Signup" }, //mapped out each name, now links may be applied for use
          {name: "Register", href : "/Signup"}
        ]
      }, {
        title: "Help",
        links: [
          {name: "FAQs", href: "#" },
          {name: "Customer Support", href : "#"}
        ]
      }, {
        title: "Legal Stuff",
        links: [
          {name: "Terms of use", href: "#" },
          {name: "Privacy policy", href : "#"}
        ]
      }, {
        title: "About",
        links: [
          {name: "About us", href: "#" },
          {name: "Careers", href : "#"}
        ]
      }].map(col => <div key={col.title}>
            <p className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-4">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map(link => ( //fixed how linking works by adjusting how key and href take in data from the map
                  <li key= {link.name}>
                  <a href= {link.href} className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors">{link.name}</a>
                </li>))}
            </ul>
          </div>)}
      </div>

      <div className="border-t border-primary-foreground/10 pt-8">
        <p className="text-xs text-primary-foreground/40">© 2026 ToGather LLC. All Rights Reserved.</p>
      </div>
    </div>
  </footer>;
export default Footer;
