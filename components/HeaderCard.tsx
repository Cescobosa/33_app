import Image from 'next/image'

export default function HeaderCard({
  photoUrl,
  title,
}: { photoUrl?: string|null, title: string }) {
  return (
    <div className="module" style={{display:'flex', alignItems:'center', gap:16}}>
      <div style={{width:72, height:72, position:'relative', borderRadius:12, overflow:'hidden', background:'#f3f4f6'}}>
        {photoUrl ? (
          <Image src={photoUrl} alt={title} fill style={{objectFit:'cover'}} />
        ) : (
          <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af'}}>—</div>
        )}
      </div>
      <h1 style={{margin:0}}>{title}</h1>
    </div>
  )
}
