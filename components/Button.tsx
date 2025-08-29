import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'neutral' | 'danger'
  icon?: React.ReactNode
}

export default function Button({ tone = 'primary', icon, children, ...rest }: Props) {
  const cls = ['btn']
  if (tone !== 'primary') cls.push(`btn-${tone}`)
  return (
    <button className={cls.join(' ')} {...rest}>
      {icon ? <span className="btn-ic">{icon}</span> : null}
      {children}
    </button>
  )
}
