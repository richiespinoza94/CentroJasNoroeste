import { forwardRef } from 'react';
import './Field.css';

/**
 * Label + control + inline error, wired for a11y:
 * - real <label htmlFor> (not a styled span)
 * - error text linked via aria-describedby + role="alert" so screen readers
 *   announce it the moment it appears
 * - invalid state exposed via aria-invalid, not color alone
 */
const Field = forwardRef(function Field({ id, label, optional, error, children }, ref) {
  const errorId = `${id}-error`;
  const child = children({
    id,
    ref,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? errorId : undefined,
    className: error ? 'field__control field__control--invalid' : 'field__control',
  });
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label} {!optional && <span aria-hidden="true">*</span>}
        {optional && <span className="field__label-optional"> (opcional)</span>}
      </label>
      {child}
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

export default Field;
