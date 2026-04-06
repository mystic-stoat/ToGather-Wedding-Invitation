// tailwind.config.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Configures Tailwind CSS — the utility-based styling system used throughout
//   the app. Tailwind scans your files and only includes the CSS classes you
//   actually use, keeping the bundle small.
//
// KEY SECTIONS:
//   content  → tells Tailwind which files to scan for class names
//   theme    → defines custom colors, fonts, border radius, animations
//   plugins  → adds tailwindcss-animate for smooth transitions
// ─────────────────────────────────────────────────────────────────────────────

export default {
  darkMode: ["class"],

  // ── content ───────────────────────────────────────────────────────────────
  // Tailwind scans these files to find class names like "bg-primary" or "rounded-xl"
  // IMPORTANT: Updated to .jsx and .js since we converted from TypeScript
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
  ],

  prefix: "", // no prefix on class names (e.g. "flex" not "tw-flex")

  theme: {
    container: {
      center: true,       // container is auto-centered
      padding: "2rem",    // default horizontal padding
      screens: {
        "2xl": "1400px",  // max width for large screens
      },
    },
    extend: {
      // ── Custom fonts ───────────────────────────────────────────────────────
      // Used as: className="font-heading" or className="font-body"
      // Loaded from Google Fonts in index.css
      fontFamily: {
        heading: ["Playfair Display", "Georgia", "serif"],
        body: ["DM Sans", "system-ui", "sans-serif"],
      },

      // ── Custom colors ──────────────────────────────────────────────────────
      // These use CSS variables defined in index.css so they can be themed.
      // Used as: className="bg-primary" or className="text-muted-foreground"
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",        // sage green
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",    // red for errors
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",         // muted rose
          foreground: "hsl(var(--accent-foreground))",
          light:      "hsl(var(--accent-light))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",           // warm cream card background
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT:              "hsl(var(--sidebar-background))",
          foreground:           "hsl(var(--sidebar-foreground))",
          primary:              "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:               "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:               "hsl(var(--sidebar-border))",
          ring:                 "hsl(var(--sidebar-ring))",
        },
      },

      // ── Border radius ──────────────────────────────────────────────────────
      // Uses CSS variable so radius can be changed globally from index.css
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      // ── Keyframe animations ────────────────────────────────────────────────
      // Used by shadcn/ui accordion component
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
    },
  },

  // tailwindcss-animate adds utilities like animate-fade-up used in the pages
  plugins: [require("tailwindcss-animate")],
};
