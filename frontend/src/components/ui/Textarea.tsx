import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      className = '',
      required,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const errorId = textareaId ? `${textareaId}-error` : undefined;
    const helperId = textareaId ? `${textareaId}-helper` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="label">
            {label} {required && <span className="text-red-600 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          required={required}
          aria-invalid={!!error}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={`input resize-y ${error ? 'input-error' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} className="error-text">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="helper-text">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
