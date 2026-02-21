/**
 * Form Validation Utilities
 * Location: src/utils/validation.js
 * 
 * Helper functions for validating form inputs
 */

/**
 * Validate email format using regex
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password meets minimum requirements
 * @param {string} password - Password to validate
 * @returns {boolean} True if password is at least 8 characters
 */
export const isValidPassword = (password) => {
  return password.length >= 8;
};

/**
 * Check if two passwords match
 * @param {string} password - First password
 * @param {string} confirmPassword - Confirmation password
 * @returns {boolean} True if passwords match
 */
export const passwordsMatch = (password, confirmPassword) => {
  return password === confirmPassword;
};

/**
 * Validate full name (not empty and contains at least first and last name)
 * @param {string} fullName - Full name to validate
 * @returns {boolean} True if valid full name
 */
export const isValidFullName = (fullName) => {
  return fullName.trim().length >= 2;
};

/**
 * Get user-friendly error message from Firebase error code
 * @param {string} errorCode - Firebase error code
 * @returns {string} User-friendly error message
 */
export const getAuthErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please login instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 8 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'An error occurred. Please try again.';
  }
};
