
// list of forbidden characters
const FORBIDDEN = /[\s/\\:'"`,;<>|?*]/;

export const validateEmail = (email) => {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) 
    return "Enter a valid email address";
  return null;
};

export const validateCreatePassword = (password) => {
  if (!password) return "Password is required";
  if (password.length < 8) return "Must be at least 8 characters";
  if (FORBIDDEN.test(password))
    return "Password contains an invalid character";
  if ((password.match(/[a-zA-Z]/g) || []).length < 7) 
    return "Must contain at least 7 letters";
  if (!/\d/.test(password)) 
    return "Must contain at least 1 number";
  return null;
};

export const validateConfirmPassword = (password, confirm) => {
  if (!confirm)
    return "Please confirm your password";
  else if (confirm != password)
    return "Passwords don't match";
  return null;
}


export const validateName = (name) => {
  if (!name.trim()) return "Full name is required";
  return null;
};