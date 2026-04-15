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
```

## 📝 File Locations

### Pages
- `src/pages/RegisterPage.jsx` - Registration form
- `src/pages/LoginPage.jsx` - Login form (placeholder)
- `src/pages/DashboardPage.jsx` - Main dashboard

### Services
- `src/services/firebase.js` - Firebase config & auth functions

### Utilities
- `src/utils/validation.js` - Form validation helpers

### Routing
- `src/App.jsx` - Main router setup

## 🔥 Firebase Setup Checklist

- [ ] Create Firebase project
- [ ] Enable Email/Password authentication
- [ ] Create Firestore database
- [ ] Copy Firebase config credentials
- [ ] Update `src/services/firebase.js` with credentials
- [ ] Test registration flow

## 🎯 Key Functions Reference

### Firebase Functions (`services/firebase.js`)
```javascript
// Register new user
await registerUser(email, password, fullName)

// Login existing user
await loginUser(email, password)

// Logout current user
await logoutUser()
```

### Validation Functions (`utils/validation.js`)
```javascript
// Validate email format
isValidEmail(email) // returns boolean

// Check password length (min 8)
isValidPassword(password) // returns boolean

// Verify passwords match
passwordsMatch(password, confirmPassword) // returns boolean

// Check full name
isValidFullName(fullName) // returns boolean

// Get friendly error message
getAuthErrorMessage(errorCode) // returns string
```

## 🎨 Color Palette

```css
/* Primary Colors */
--primary-gold: #d4a574;
--primary-gold-dark: #c99361;

/* Neutral Colors */
--text-dark: #2d2d2d;
--text-medium: #6b6b6b;
--text-light: #8b8b8b;

/* Background */
--bg-gradient: linear-gradient(135deg, #f8f3f0 0%, #fefcfb 50%, #f5ebe6 100%);
--bg-white: #ffffff;

/* Error */
--error-red: #e85d75;
--error-bg: #fff5f7;
```

## 📐 Component Structure Template

```javascript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ComponentName.css';

const ComponentName = () => {
  // State
  const [state, setState] = useState(initialValue);
  const navigate = useNavigate();

  // Handlers
  const handleAction = () => {
    // Logic here
  };

  // Render
  return (
    <div className="component-container">
      {/* JSX here */}
    </div>
  );
};

export default ComponentName;
```

## 🛣️ Current Routes

```javascript
/               → Redirects to /register
/register       → Registration page
/login          → Login page (placeholder)
/dashboard      → Dashboard (protected)
/*              → Redirects to /register
```

## 🔐 Firebase Error Codes

| Code | Meaning |
|------|---------|
| `auth/email-already-in-use` | Email taken |
| `auth/invalid-email` | Bad email format |
| `auth/weak-password` | Password < 6 chars |
| `auth/network-request-failed` | No internet |
| `auth/too-many-requests` | Rate limited |

## 🎓 Common Tasks

### Add a New Page
1. Create `src/pages/NewPage.jsx`
2. Create `src/pages/NewPage.css`
3. Add route in `src/App.jsx`:
   ```javascript
   <Route path="/new" element={<NewPage />} />
   ```

### Add Form Validation
1. Add validation function to `src/utils/validation.js`
2. Import in component
3. Call in `validateForm()` function

### Add Firebase Function
1. Add to `src/services/firebase.js`
2. Import in component
3. Call with try/catch for errors

### Update Styles
- Component styles: Edit `ComponentName.css`
- Global styles: Edit `src/index.css`
- App-wide: Edit `src/App.css`

## 🐛 Debugging Tips

### Check Browser Console
- Press F12 or Cmd+Option+I
- Look for red errors
- Check Network tab for failed requests

### Firebase Console
- Authentication tab: See registered users
- Firestore tab: See user documents
- Check security rules if permission denied

### Common Issues
```bash
# Port already in use
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Clear cache
rm -rf node_modules package-lock.json
npm install

# Clear browser cache
Hard reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

## 📦 Dependencies Overview

```json
{
  "dependencies": {
    "react": "UI library",
    "react-dom": "React renderer",
    "firebase": "Backend services",
    "react-router-dom": "Routing"
  },
  "devDependencies": {
    "vite": "Build tool",
    "@vitejs/plugin-react": "React plugin for Vite",
    "eslint": "Code linter"
  }
}
```

## 🎯 Next Implementation Steps

### Priority 1: Login Page
- [ ] Create form UI similar to register
- [ ] Add email/password inputs
- [ ] Implement `loginUser()` function
- [ ] Add error handling
- [ ] Redirect to dashboard on success

### Priority 2: Password Reset
- [ ] Add "Forgot Password?" link
- [ ] Create password reset page
- [ ] Use Firebase `sendPasswordResetEmail()`
- [ ] Show success message

### Priority 3: Protected Routes
- [ ] Create AuthContext
- [ ] Check auth state in routes
- [ ] Redirect unauthenticated users

## 💡 Pro Tips

1. **Environment Variables**: Always use `.env` for Firebase config in production
2. **Git Commits**: Make small, focused commits with clear messages
3. **Testing**: Test on both desktop and mobile viewports
4. **Security**: Never commit Firebase credentials to Git
5. **Documentation**: Comment complex logic for future reference

## 📞 Support Resources

- Firebase Documentation: https://firebase.google.com/docs
- React Documentation: https://react.dev
- Vite Documentation: https://vitejs.dev
- React Router: https://reactrouter.com

---

**Quick Reference v1.0** | ToGather Capstone Project
