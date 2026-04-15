# ToGather - Registration System Architecture

## 🏗️ Architecture Overview

This document explains the architecture and design decisions for the ToGather registration system.

## 📐 Design Patterns

### Component Architecture
- **Functional Components**: Using React hooks for state management
- **Single Responsibility**: Each component has one clear purpose
- **Separation of Concerns**: UI, business logic, and services are separated

### File Organization
```
src/
├── pages/          # Page-level components (routes)
├── components/     # Reusable UI components (to be added)
├── services/       # External service integrations (Firebase)
├── utils/          # Helper functions and utilities
├── hooks/          # Custom React hooks (to be added)
└── App.jsx         # Root component with routing
```

## 🔐 Authentication Flow

### Registration Process

```
User fills form → Client-side validation → Firebase Auth → Firestore Write → Dashboard
     ↓                      ↓                    ↓               ↓              ↓
  Input data         Validate format      Create user    Save metadata   Auto-login
```

#### Step-by-step:
1. **User Input**: Form captures full name, email, and password
2. **Client Validation**: 
   - Check required fields
   - Validate email format
   - Verify password length (min 8 chars)
   - Confirm passwords match
3. **Firebase Authentication**: 
   - Call `createUserWithEmailAndPassword()`
   - Firebase creates auth user
4. **Firestore Write**: 
   - Save additional user data (fullName, createdAt)
   - Store in `users/{uid}` document
5. **Auto Redirect**: 
   - User automatically logged in
   - Redirect to dashboard

### Error Handling Strategy

```javascript
try {
  await registerUser(email, password, fullName);
  // Success path
} catch (error) {
  // Map Firebase errors to user-friendly messages
  const message = getAuthErrorMessage(error.code);
  setErrors({ submit: message });
}
```

**Error Types Handled:**
- `auth/email-already-in-use`: Email taken
- `auth/invalid-email`: Invalid format
- `auth/weak-password`: Password too weak
- `auth/network-request-failed`: Connection issues
- `auth/too-many-requests`: Rate limiting

## 🎨 UI/UX Design Philosophy

### Wedding-Themed Aesthetics
- **Color Palette**: Soft beige/gold tones (#d4a574)
- **Typography**: Serif headers (Georgia), sans-serif body
- **Spacing**: Generous padding for elegance
- **Shadows**: Soft, subtle depth
- **Animations**: Smooth, gentle transitions

### Responsive Design
- **Desktop First**: Optimized for desktop viewing
- **Mobile Adaptive**: Fully responsive breakpoints
- **Touch Friendly**: Large input fields and buttons on mobile

### Accessibility
- **Semantic HTML**: Proper label associations
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus States**: Clear visual focus indicators
- **Color Contrast**: WCAG AA compliant

## 🔧 Service Layer

### Firebase Service (`services/firebase.js`)

**Responsibilities:**
- Initialize Firebase app
- Export auth and Firestore instances
- Provide authentication helper functions

**Functions:**
```javascript
registerUser(email, password, fullName)
  // Creates auth user + Firestore document

loginUser(email, password)
  // Signs in existing user

logoutUser()
  // Signs out current user
```

**Why separate service layer?**
- Centralized Firebase configuration
- Easy to mock for testing
- Single source of truth for API calls
- Simplified component code

## ✅ Validation Layer

### Validation Utilities (`utils/validation.js`)

**Pure Functions:**
```javascript
isValidEmail(email)           // Email format check
isValidPassword(password)     // Min length check
passwordsMatch(p1, p2)        // Comparison check
isValidFullName(fullName)     // Presence check
getAuthErrorMessage(code)     // Error mapping
```

**Benefits:**
- **Reusable**: Use across multiple components
- **Testable**: Pure functions, easy to unit test
- **Maintainable**: Update validation rules in one place
- **Readable**: Clear, self-documenting function names

## 🎯 State Management

### Local Component State
Using `useState` for:
- Form data (fullName, email, password, confirmPassword)
- UI state (loading, showPassword)
- Error messages (field-specific and global)

**Why local state?**
- Registration is isolated, doesn't need global state
- Simple and performant
- Easy to reason about

**State Structure:**
```javascript
formData = {
  fullName: string,
  email: string,
  password: string,
  confirmPassword: string
}

errors = {
  fullName?: string,
  email?: string,
  password?: string,
  confirmPassword?: string,
  submit?: string  // Global form error
}
```

## 🛡️ Security Considerations

### Client-Side Security
✅ **Implemented:**
- Password validation before submission
- Input sanitization through controlled inputs
- Disabled buttons during loading (prevent double-submit)
- Environment variables for Firebase config

⚠️ **Important Notes:**
- Client-side validation is for UX only
- Firebase handles actual security
- Never trust client-side data alone

### Firebase Security
✅ **Firebase handles:**
- Password hashing (bcrypt)
- Session management
- HTTPS encryption
- CSRF protection

🔒 **Firestore Rules (Production):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Users can only read/write their own data
      allow read, write: if request.auth != null 
                         && request.auth.uid == userId;
    }
  }
}
```

## 🚀 Performance Optimizations

### Bundle Size
- Only import needed Firebase modules
- Tree-shaking enabled through Vite
- No heavy dependencies

### Loading States
- Show loading spinner during async operations
- Disable form during submission
- Prevent double submissions

### Code Splitting (Future)
```javascript
// Lazy load pages
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
```

## 🧪 Testing Strategy

### Unit Tests (Recommended)
```javascript
// Validation tests
describe('isValidEmail', () => {
  it('should accept valid email', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });
  
  it('should reject invalid email', () => {
    expect(isValidEmail('invalid')).toBe(false);
  });
});
```

### Integration Tests
- Test form submission flow
- Mock Firebase calls
- Test error handling

### E2E Tests (Cypress/Playwright)
- Full registration flow
- Error scenarios
- Redirect behavior

## 🔄 Future Enhancements

### Immediate Next Steps
1. ✅ Registration (Complete)
2. 🔄 Login page implementation
3. 🔄 Password reset functionality
4. 🔄 Email verification

### Advanced Features
- Social login (Google, Facebook)
- Two-factor authentication
- Profile image upload
- Account settings page
- Email templates for verification

### Performance
- Lazy load routes
- Image optimization
- PWA capabilities
- Offline support

### Developer Experience
- Add PropTypes or TypeScript
- ESLint configuration
- Prettier formatting
- Pre-commit hooks (Husky)
- Unit test coverage

## 📚 Technology Stack

### Core
- **React 19**: UI library
- **Vite**: Build tool and dev server
- **React Router 6**: Client-side routing

### Backend/Services
- **Firebase Auth**: Authentication
- **Firestore**: NoSQL database
- **Firebase SDK**: JavaScript library

### Styling
- **CSS Modules**: Scoped styling
- **Responsive Design**: Mobile-first approach
- **CSS3 Animations**: Smooth transitions

## 🎓 Learning Resources

### Firebase
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firestore Docs](https://firebase.google.com/docs/firestore)

### React
- [React Hooks](https://react.dev/reference/react)
- [React Router](https://reactrouter.com/)

### Best Practices
- [React Security Best Practices](https://snyk.io/blog/10-react-security-best-practices/)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

---

**Architecture Version**: 1.0  
**Last Updated**: February 2026  
**Capstone Project**: ToGather Wedding Invitation Platform
