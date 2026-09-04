import { useEffect } from "react";

const FormError = ({ message, field, clearError, className = "" }) => {
  // Auto-clear error when user starts typing (if field is provided)
  useEffect(() => {
    if (field && clearError) {
      const handler = (e) => {
        if (e.target.name === field) {
          clearError(field);
        }
      };
      
      // Add event listener to document for auto-clearing
      document.addEventListener('input', handler);
      return () => document.removeEventListener('input', handler);
    }
  }, [field, clearError]);

  if (!message) return null;

  return (
    <div className={`bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 mb-1.5 ${className}`}>
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
};

export default FormError;