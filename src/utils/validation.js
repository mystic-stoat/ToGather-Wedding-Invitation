
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

// Validate a required text field
export const validateRequiredField = (value, fieldName) => {
  if (!value || !value.trim()) {
    return `${fieldName} is required.`;
  }

  return null;
};

// Validate the wedding date
export const validateWeddingDate = (date) => {
  if (!date) {
    return "Wedding date is required.";
  }

  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Please enter a valid wedding date.";
  }

  return null;
};

// Validate the ceremony time
export const validateCeremonyTime = (time) => {
  if (!time) {
    return "Ceremony time is required.";
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return "Please enter a valid ceremony time.";
  }

  return null;
};

export const isLegacyWedding = (weddingDate) => {
  if (!weddingDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(`${weddingDate}T00:00:00`);

  return !Number.isNaN(date.getTime()) && date < today;
};