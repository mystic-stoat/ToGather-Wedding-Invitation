# ToGather Wedding Invitation - Project Navigation Guide

## Project Overview

ToGather is a React-based wedding invitation management application designed for the UNT Computer Science Capstone Spring-Fall 2026 Semester. The primary goal of this application is to manage wedding planning and design wedding invitations using modern web technologies.

## Technology Stack

- **Frontend**: React, Vite
- **State Management**: React Context API with Firebase Authentication
- **Routing**: React Router v6
- **Database**: Firebase Authentication and Firestore
- **Styling**: Tailwind CSS with shadcn/ui components
- **Data Fetching**: React Query (TanStack)

## Project Structure
```

src/ ├── App.jsx # Root component with routing ├── main.jsx # Entry point ├── components/ # Reusable UI components │ ├── Navbar.jsx # Navigation bar │ ├── Hero.jsx # Hero section │ ├── Features.jsx # Features section │ ├── CTA.jsx # Call to action section\
│ ├── Footer.jsx # Footer component │ ├── AppHeader.jsx # Application header │ ├── NavLink.jsx # Navigation link component │ ├── ScrollReveal.jsx # Scroll animation component │ └── ui/ # shadcn/ui components (not shown in detail) ├── contexts/ # Authentication context │ └── AuthContext.jsx # Authentication provider and hooks ├── pages/ # Page-level components (routes) │ ├── Index.jsx # Landing page │ ├── Login.jsx # Login page │ ├── Signup.jsx # Registration page\
│ ├── Dashboard.jsx # User dashboard │ ├── WeddingDetails.jsx # Wedding details management │ ├── CreateInvitation.jsx # Invitation creation │ ├── GuestList.jsx # Guest list management │ ├── RSVP.jsx # RSVP form │ └── NotFound.jsx # 404 page ├── lib/ # Firebase configuration and utilities │ └── firebase.js # Firebase initialization └── assets/ # Static assets

```

## Key Components and Their Purposes

### Authentication Context (`src/contexts/AuthContext.jsx`)
- **Purpose**: Manages user authentication state across the entire application
- **Functions**: login, signup, logout, resetPassword
- **Usage**: Any component can call `useAuth()` to access user data and auth functions
- **Data**: User object, loading state, and profile data from Firestore

### Routing Structure (`src/App.jsx`)
- **Public Routes** (accessible without login):
  - `/` - Landing page
  - `/login` - Login page
  - `/signup` - Registration page  
  - `/rsvp/:inviteeId/:token` - RSVP form (public)
- **Protected Routes** (require login):
  - `/dashboard` - User dashboard
  - `/wedding-details` - Wedding details management
  - `/create-invitation` - Invitation creation
  - `/guest-list` - Guest list management

### Main Pages and Their Functions

1. **Index.jsx** (`/`) - Landing page with hero, features, CTA, and footer
2. **Login.jsx** (`/login`) - Login form for existing users  
3. **Signup.jsx** (`/signup`) - Registration form for new users
4. **Dashboard.jsx** (`/dashboard`) - Main user dashboard
5. **WeddingDetails.jsx** (`/wedding-details`) - Wedding information management
6. **CreateInvitation.jsx** (`/create-invitation`) - Invitation creation tool
7. **GuestList.jsx** (`/guest-list`) - Guest list management
8. **RSVP.jsx** (`/rsvp/:inviteeId/:token`) - RSVP form for guests

## Authentication Flow

1. **Login Process**: 
   - User navigates to `/login`
   - Enters email and password
   - `signInWithEmailAndPassword()` is called
   - Firebase authentication state changes triggers context update
   - Redirected to dashboard

2. **Signup Process**:
   - User navigates to `/signup`
   - Enters name, email, and password
   - `createUserWithEmailAndPassword()` creates account
   - `updateProfile()` sets display name
   - Firestore profile document is created
   - User automatically logged in and redirected to dashboard

3. **Logout Process**:
   - User clicks logout button
   - `signOut()` is called
   - Firebase authentication state changes to null
   - Protected routes redirect to `/login`

## Database Integration

### Firebase Services Used
- **Firebase Authentication**: User authentication and session management
- **Firestore**: Storage of user profiles, wedding details, and guest information

### Firestore Data Structure
```

bethrothed/ (collection) └── {userId} (document) ├── fullName ├── email\
├── weddingDetails ├── guests └── createdAt

```

## Navigation Guide

### For Finding Specific Functionality:

1. **User Authentication**:
   - Login: `/login` page
   - Signup: `/signup` page
   - Logout: Dashboard component with logout button

2. **Dashboard Management**:
   - Main dashboard: `/dashboard`
   - Wedding details: `/wedding-details`
   - Invitation creation: `/create-invitation`
   - Guest list: `/guest-list`

3. **Public Pages**:
   - Landing page: `/`
   - RSVP form: `/rsvp/:inviteeId/:token` (parameterized URL)

4. **Navigation Components**:
   - Navbar.jsx: Main navigation bar
   - NavLink.jsx: Individual navigation links

### For Making Changes:

1. **Page-level changes**: Modify files in `src/pages/`
2. **UI components**: Modify files in `src/components/`
3. **Authentication logic**: Modify `src/contexts/AuthContext.jsx`
4. **Routing**: Modify `src/App.jsx`
5. **Firebase integration**: Modify `src/lib/firebase.js`

## Key Concepts

### Protected Routes
- Pages wrapped with `ProtectedRoute` component require authentication
- Non-authenticated users are redirected to `/login`

### Public Routes  
- Pages wrapped with `PublicRoute` component are accessible when NOT logged in
- Logged-in users are automatically redirected to `/dashboard`

### Context Usage
- All components can access auth state using `useAuth()` hook
- No need for each page to check Firebase separately

## Common Development Tasks

1. **Adding a new page**: Create file in `src/pages/`, add route in `App.jsx`
2. **Adding UI component**: Create component in `src/components/`
3. **Modifying authentication**: Update logic in `AuthContext.jsx` 
4. **Changing routing**: Modify routes in `App.jsx`
5. **Adding Firestore data**: Use Firebase SDK in context or page components

## Testing Strategy

- Unit tests for validation functions and helper utilities
- Integration tests for form submission flows  
- End-to-end tests for full user journeys
- Mock Firebase calls during testing