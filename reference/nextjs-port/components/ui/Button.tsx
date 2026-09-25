// src/components/ui/Button.tsx
'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'compact';
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'default',
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base = [
    'inline-flex items-center justify-center font-semibold',
    'transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    'focus-visible:outline-[var(--gw-teal-700)]',
    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
  ].join(' ');

  const variants: Record<string, string> = {
    primary: disabled
      ? 'bg-[var(--gw-action-disabled-bg)] text-[var(--gw-action-disabled-fg)]'
      : 'bg-[var(--gw-action-bg)] text-[var(--gw-action-fg)] hover:bg-[var(--gw-action-bg-hover)] active:bg-[var(--gw-action-bg-active)]',
    secondary: disabled
      ? 'border border-[var(--gw-sand-300)] text-[var(--gw-action-disabled-fg)]'
      : 'border-[1.5px] border-[var(--gw-action-secondary-border)] text-[var(--gw-action-secondary-fg)] hover:bg-[var(--gw-action-secondary-hover)]',
    ghost: disabled
      ? 'text-[var(--gw-action-disabled-fg)]'
      : 'text-[var(--gw-action-secondary-fg)] hover:bg-[var(--gw-action-secondary-hover)]',
  };

  const sizes: Record<string, string> = {
    default: 'min-h-[var(--gw-tap-min)] px-6 text-[var(--gw-action-size)] rounded-[var(--gw-radius)]',
    compact: 'min-h-[40px] px-4 text-[15px] rounded-[var(--gw-radius-md)]',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      style={{
        transitionDuration: 'var(--gw-duration-fast)',
        transitionTimingFunction: 'var(--gw-ease)',
      }}
      {...props}
    >
      {children}
    </button>
  );
}
