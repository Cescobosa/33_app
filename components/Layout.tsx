import { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function Layout({children}:{children:ReactNode}){
  return (
    <div className="container">
      <Sidebar/>
      <main className="main">{children}</main>
    </div>
  )
}
