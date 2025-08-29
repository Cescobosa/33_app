import React from 'react';

type Tone = 'primary' | 'neutral' | 'danger';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  icon?: React.ReactNode;
  as?: 'button' | 'a';
  href?: string;
};

const stylesBase =
  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition';
const toneClass = (tone: Tone) =>
  tone === 'primary'
    ? 'bg-[#d42842] text-white hover:opacity-90'
    : tone === 'danger'
    ? 'bg-red-600 text-white hover:opacity-90'
    : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

export default function Button({ tone = 'primary', icon, className = '', children, as='button', href, ...rest }: Props) {
  const cls = `${stylesBase} ${toneClass(tone)} ${className}`;

  if (as === 'a') {
    return (
      <a href={href} className={cls}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <button {...rest} className={cls}>
      {icon}
      {children}
    </button>
  );
}
