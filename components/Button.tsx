// components/Button.tsx
import * as React from 'react';

type Tone = 'primary' | 'neutral' | 'danger';

type Common = {
  tone?: Tone;
  icon?: 'plus' | 'trash' | 'archive' | 'edit' | 'restore' | 'link' | 'warning';
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

type BtnProps =
  | (Common & React.ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button'; href?: never })
  | (Common & React.AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a'; href: string });

function cls(tone: Tone = 'primary') {
  const base =
    'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors';
  const map: Record<Tone, string> = {
    primary: 'bg-[#d42842] text-white hover:opacity-90',
    neutral: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return `${base} ${map[tone]}`;
}

function Icon({ name }: { name?: string }) {
  if (!name) return null;
  const map: Record<string, string> = {
    plus: '➕',
    trash: '🗑️',
    archive: '🗄️',
    edit: '✏️',
    restore: '♻️',
    link: '🔗',
    warning: '⚠️',
  };
  return <span aria-hidden>{map[name] ?? ''}</span>;
}

export default function Button(props: BtnProps) {
  const { tone, icon, className, children, style, ...rest } = props as any;
  const classNames = `${cls(tone)} ${className ?? ''}`;

  if (props.as === 'a') {
    const aProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a {...aProps} className={classNames} style={style}>
        <Icon name={icon} />
        {children}
      </a>
    );
  }

  const bProps = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button {...bProps} className={classNames} style={style}>
      <Icon name={icon} />
      {children}
    </button>
  );
}
