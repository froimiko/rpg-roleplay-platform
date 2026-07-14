// OtpInput.jsx — mechanically split from login-app.jsx (JSX byte-for-byte).
import React from 'react';

function OtpInput({ value, onChange, onComplete, length = 6, disabled = false, autoFocus = false, label }) {
  const inputRef = React.useRef(null);
  const completeRef = React.useRef('');
  const clean = String(value || '').replace(/\D/g, '').slice(0, length);

  React.useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  React.useEffect(() => {
    if (clean.length === length && clean !== completeRef.current) {
      completeRef.current = clean;
      onComplete?.(clean);
    }
    if (clean.length < length) completeRef.current = '';
  }, [clean, length, onComplete]);

  return (
    <div className="pl-otp" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        className="pl-otp-input"
        aria-label={label}
        type="text"
        inputMode="numeric"
        pattern={`\\d{${length}}`}
        maxLength={length}
        autoComplete="one-time-code"
        value={clean}
        disabled={disabled}
        onChange={(e) => onChange(String(e.target.value || '').replace(/\D/g, '').slice(0, length))}
        onPaste={(e) => {
          const pasted = e.clipboardData?.getData('text') || '';
          const next = pasted.replace(/\D/g, '').slice(0, length);
          if (next) {
            e.preventDefault();
            onChange(next);
          }
        }}
      />
      {Array.from({ length }).map((_, i) => (
        <div key={i} className={`pl-otp-box ${clean[i] ? 'filled' : ''}`}>
          {clean[i] || ''}
        </div>
      ))}
    </div>
  );
}

export { OtpInput };
