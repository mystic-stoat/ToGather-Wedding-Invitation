export const validateEmail = (email) => {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) 
    return "Enter a valid email address";
  return null;
};

export const validateCreatePassword = (password) => {
  if (!password) return "Password is required";
  if (password.length < 8) return "Must be at least 8 characters";
  if ((password.match(/[a-zA-Z]/g) || []).length < 7) 
    return "Must contain at least 7 letters";
  if (!/\d/.test(password)) 
    return "Must contain at least 1 number";
  return null;
};

export const validateName = (name) => {
  if (!name.trim()) return "Full name is required";
  return null;
};