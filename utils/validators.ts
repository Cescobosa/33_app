export function validateIBAN(iban: string): boolean {
  const s = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{9,30}$/.test(s)) return false
  const rearr = s.slice(4) + s.slice(0, 4)
  const converted = rearr.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - 55).toString())
  let remainder = 0
  for (let i = 0; i < converted.length; i += 7) {
    const part = remainder.toString() + converted.substr(i, 7)
    remainder = parseInt(part, 10) % 97
  }
  return remainder === 1
}
export const pctOK = (n: number) => n >= 0 && n <= 100
