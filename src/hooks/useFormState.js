import { useState, useCallback } from "react";

export const useFormState = (initialErrors = {}) => {
  const [errors, setErrors] = useState(initialErrors);
  const [loading, setLoading] = useState(false);

  // Clear a specific error field
  const clearError = useCallback((field) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Set a specific error field
  const setError = useCallback((field, message) => {
    setErrors(prev => ({
      ...prev,
      [field]: message
    }));
  }, []);

  return {
    errors,
    setErrors,
    loading,
    setLoading,
    clearError,
    clearErrors,
    setError
  };
};