import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'ghost' | 'danger'
  icon?: 'plus' | 'edit' | 'archive' | 'restore' | 'trash' | 'save' | 'link'
  as?: 'button' | 'a'
  href?: string
}

function Icon({ name }: { name: NonNullable<Props['icon']> }) {
  const common = { width: 16, height: 16, style: { marginRight: 8 } }
  switch (name) {
    case 'plus': return <svg {...common} viewBox="0 0 24 24"><path fill="currentColor" d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z"/></svg>
    case 'edit': return <svg {...common} viewBox="0 0 24 24"><path fill="currentColor" d="m3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83l3.75 3.75l1.84-1.82z"/></svg>
    case 'archive': return <svg {...common} viewBox="0 0 24 24"><path fill="currentColor" d="M20.54 5.23L19.15 3.5H4.85L3.46 5.23V7h17.08V5.23zM5 20h14a1 1 0 0 0 1-1V8H4v11a1 1 0 0 0 1 1zm4-7h6v2H9v-2z"/></svg>
    case 'restore': return <svg {...common} viewBox="0 0 24 24"><path fill="currentColor" d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7v4l5-5l-5-5v4z"/></svg>
    case 'trash': return <svg {...common} viewBox="0 0 24 24"><path fill="currentColor" d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z"/></svg>
    case 'save': return <svg {...common} viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14V7l-2-4zM7 5h8v6H7V5zm10 14H5V13h12v6z"/></svg>
    case 'link': return <svg {...common} viewBox="0 0 24 24"><path fill="currentColor" d="M3.9 12a5 5 0 0 1 5-5h3v2h-3a3 3 0 1 0 0 6h3v2h-3a5 5 0 0 1-5-5Zm7-1h2v2h-2v-2Zm4.2-4h-3v2h3a3 3 0 1 1 0 6h-3v2h3a5 5 0 0 0 0-10Z"/></svg>
  }
  return null
}

export default function Button({ tone='primary', icon, as='button', href, children, ...rest }: Props) {
  const base = {
    fontWeight: 600,
    borderRadius: 10,
    padding: '8px 14px',
    display: 'inline-flex',
    alignItems: 'center',
    textDecoration: 'none',
    border: '1px solid transparent',
    cursor: 'pointer',
  } as const

  const tones: Record<NonNullable<Props['tone']>, React.CSSProperties> = {
    primary: { background: '#d42842', color: '#fff' },
    ghost: { background: '#fff', color: '#111827', border: '1px solid #e5e7eb' },
    danger: { background: '#ef4444', color: '#fff' },
  }

  if (as === 'a') {
    return (
      <a href={href} style={{ ...base, ...tones[tone] }}>
        {icon && <Icon name={icon} />}{children}
      </a>
    )
  }
  return (
    <button {...rest} style={{ ...base, ...tones[tone] }}>
      {icon && <Icon name={icon} />}{children}
    </button>
  )
}
