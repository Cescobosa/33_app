import React from 'react';

type Tone = 'primary' | 'neutral' | 'danger';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  icon?: React.ReactNode;
};

export default function Button({ tone = 'primary', icon, className = '', children, ...rest }: Props) {
  const base =
    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition';
  const color =
    tone === 'primary'
      ? 'bg-[#d42842] text-white hover:opacity-90'
      : tone === 'danger'
      ? 'bg-red-600 text-white hover:opacity-90'
      : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

  return (
    <button {...rest} className={`${base} ${color} ${className}`}>
      {icon}
      {children}
    </button>
  );
}
