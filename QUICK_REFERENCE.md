# ToGather - Quick Reference Guide

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration:auth
npm run test:integration:firestore
npm run test:all
npm run test:watch
````

## 📝 File Locations

### Pages

- `src/pages/Index.jsx` - Landing page with hero, features, CTA, and footer
- `src/pages/Login.jsx` - Login form for existing users
- `src/pages/Signup.jsx` - Registration form for new users
- `src/pages/Dashboard.jsx` - Main dashboard
- `src/pages/WeddingDetails.jsx` - Wedding information management
- `src/pages/CreateInvitation.jsx` - Invitation creation tool
- `src/pages/GuestList.jsx` - Guest list management
- `src/pages/RSVP.jsx` - RSVP form for guests

### Services

- `src/lib/firebase.js` - Firebase config & auth functions

### Contexts

- `src/contexts/AuthContext.jsx` - Authentication provider and hooks

### Utilities

- `src/utils/validation.js` - Form validation helpers

### Routing

- `src/App.jsx` - Main router setup

### Hooks

- `src/hooks/use-toast.js` - Toast notification hook
- `src/hooks/useFormState.js` - Form state management hook

## 🎯 Key Functions Reference

### Authentication Functions (`contexts/AuthContext.jsx`)

```javascript
// Register new user
await signup(email, password, fullName)

// Login existing user
await login(email, password)

// Logout current user
await logout()

// Reset password
await resetPassword(email)
```

### Validation Functions (`utils/validation.js`)

```javascript
// Validate email format
validateEmail(email)

// Check password length (min 8)
validateCreatePassword(password) // returns boolean

// Verify passwords match
validateConfirmPassword(password, confirmPassword) // returns boolean

// Check full name
validateName(naem) // returns boolean
```

## ️ Current Routes

```javascript
/               → Public landing page
/login          → Login page (public)
/signup          → Registration page (public)
/dashboard       → Dashboard (protected)
/wedding-details   → Wedding details management (protected)
/create-invitation → Invitation creation (protected)
/guest-list    → Guest list management (protected)
/rsvp/:inviteeId/:token → RSVP form (public)

/*              → 404 Not Found page
```
## 📦 Dependencies Overview

```json
{
  "dependencies": {
    "react": "UI library",
    "react-dom": "React renderer",
    "firebase": "Backend services",
    "react-router-dom": "Routing",
    "@tanstack/react-query": "Data fetching",
    "react-hook-form": "Form handling",
    "zod": "Validation",
    "@radix-ui/react-accordion": "UI component",
    "@radix-ui/react-alert-dialog": "UI component",
    "@radix-ui/react-aspect-ratio": "UI component",
    "@radix-ui/react-avatar": "UI component",
    "@radix-ui/react-checkbox": "UI component",
    "@radix-ui/react-collapsible": "UI component",
    "@radix-ui/react-context-menu": "UI component",
    "@radix-ui/react-dialog": "UI component",
    "@radix-ui/react-dropdown-menu": "UI component",
    "@radix-ui/react-hover-card": "UI component",
    "@radix-ui/react-label": "UI component",
    "@radix-ui/react-menubar": "UI component",
    "@radix-ui/react-navigation-menu": "UI component",
    "@radix-ui/react-popover": "UI component",
    "@radix-ui/react-progress": "UI component",
    "@radix-ui/react-radio-group": "UI component",
    "@radix-ui/react-scroll-area": "UI component",
    "@radix-ui/react-select": "UI component",
    "@radix-ui/react-separator": "UI component",
    "@radix-ui/react-slider": "UI component",
    "@radix-ui/react-slot": "UI component",
    "@radix-ui/react-switch": "UI component",
    "@radix-ui/react-tabs": "UI component",
    "@radix-ui/react-toast": "UI component",
    "@radix-ui/react-toggle": "UI component",
    "@radix-ui/react-toggle-group": "UI component",
    "@radix-ui/react-tooltip": "UI component",
    "sonner": "Toast notifications",
    "tailwind-merge": "Tailwind CSS utility",
    "class-variance-authority": "CSS class management"
  },
  "devDependencies": {
    "vite": "Build tool",
    "@vitejs/plugin-react-swc": "React plugin for Vite",
    "eslint": "Code linter",
    "@testing-library/react": "Testing library",
    "@testing-library/jest-dom": "Jest DOM matchers",
    "@vitest/ui": "Vitest UI",
    "jsdom": "DOM implementation",
    "vitest": "Testing framework"
  }
}
```

## 📞 Support Resources

- Firebase Documentation: https://firebase.google.com/docs
- React Documentation: https://react.dev
- Vite Documentation: https://vitejs.dev
- React Router: https://reactrouter.com
- Tailwind CSS: https://tailwindcss.com
- React Query: https://tanstack.com/query/latest