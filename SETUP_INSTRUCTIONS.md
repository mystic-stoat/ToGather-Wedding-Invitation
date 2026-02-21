# ToGather - Registration System Setup Instructions

This guide will help you set up the complete registration system for the ToGather wedding invitation management platform.

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Firebase account (free tier is sufficient)

## 🚀 Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This installs:
- React & React DOM
- Firebase SDK
- React Router DOM
- Vite and build tools

### 2. Firebase Setup

#### A. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard
4. Enable Google Analytics (optional)

#### B. Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get Started"
3. Go to **Sign-in method** tab
4. Enable **Email/Password** authentication
5. Click "Save"

#### C. Set Up Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose **Start in test mode** (for development)
4. Select a location close to your users
5. Click "Enable"

**Security Rules for Production:**
After testing, update Firestore rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

#### D. Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the **Web** icon (`</>`)
4. Register your app with a nickname (e.g., "ToGather Web")
5. Copy the `firebaseConfig` object values

### 3. Configure Environment Variables

#### Option A: Using Environment Variables (Recommended for Production)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Firebase credentials in `.env`:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=togather-12345.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=togather-12345
   VITE_FIREBASE_STORAGE_BUCKET=togather-12345.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

3. Update `src/services/firebase.js` to use environment variables:
   ```javascript
   const firebaseConfig = {
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
     appId: import.meta.env.VITE_FIREBASE_APP_ID
   };
   ```

#### Option B: Direct Configuration (For Quick Testing)

1. Open `src/services/firebase.js`
2. Replace the placeholder values in `firebaseConfig`:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_ACTUAL_API_KEY",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

**⚠️ Important:** If using Option B, never commit `firebase.js` with real credentials to version control!

### 4. Update .gitignore

Add to `.gitignore` if not already present:
```
.env
.env.local
.env.production
```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

The app will start at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
src/
├── pages/
│   ├── RegisterPage.jsx       # Registration page component
│   ├── RegisterPage.css        # Registration page styles
│   ├── LoginPage.jsx           # Login page (placeholder)
│   ├── LoginPage.css           # Login page styles
│   ├── DashboardPage.jsx       # Dashboard after login
│   └── DashboardPage.css       # Dashboard styles
├── services/
│   └── firebase.js             # Firebase configuration and auth functions
├── utils/
│   └── validation.js           # Form validation helpers
├── App.jsx                     # Main app with routing
└── main.jsx                    # React entry point
```

## ✅ Testing the Registration Flow

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. You'll be redirected to `/register`
4. Fill in the registration form:
   - Full Name: John Doe
   - Email: test@example.com
   - Password: password123
   - Confirm Password: password123
5. Click "Create Account"
6. If successful, you'll be redirected to `/dashboard`
7. Check Firebase Console > Authentication to see the new user
8. Check Firebase Console > Firestore to see user document

## 🔧 Troubleshooting

### "Firebase not configured" error
- Verify you've updated `firebase.js` with your actual Firebase credentials
- Check that you've enabled Email/Password authentication in Firebase Console

### "Permission denied" error in Firestore
- Verify Firestore is initialized in your Firebase project
- Check security rules allow write access (in test mode, this should work)

### Network errors
- Check your internet connection
- Verify Firebase project is active
- Check browser console for specific error messages

### Module not found errors
- Run `npm install` to ensure all dependencies are installed
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

## 🎨 Customization

### Styling
- All styles use CSS modules for easy customization
- Main color scheme is wedding-themed with soft gold/beige tones
- Update color variables in CSS files to match your brand

### Validation Rules
- Edit `src/utils/validation.js` to modify validation logic
- Current requirements:
  - Password: minimum 8 characters
  - Email: valid format
  - Full name: minimum 2 characters

### Firebase Rules
- Remember to update Firestore security rules before production deployment
- Example rules are provided in this document

## 🚢 Deployment

### Deploying to Firebase Hosting

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project:
   ```bash
   firebase init
   ```
   - Select "Hosting"
   - Choose your Firebase project
   - Set build directory to `dist`
   - Configure as single-page app: Yes
   - Don't overwrite index.html

4. Build and deploy:
   ```bash
   npm run build
   firebase deploy
   ```

## 📝 Next Steps

1. Implement the Login page (similar structure to Register page)
2. Add password reset functionality
3. Add email verification
4. Implement protected routes with auth guards
5. Add user profile management
6. Build out dashboard features

## 🤝 Support

For issues or questions:
- Check Firebase Console for error logs
- Review browser console for client-side errors
- Verify all dependencies are installed correctly

---

**Built with React + Vite + Firebase**

Good luck with your Capstone Project! 🎓
