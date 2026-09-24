import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

// Links can't be opened on a kiosk, so a missionary's website is offered as a
// QR code for visitors' phones. Generated locally (no network).
export default function QrCode({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: 'M', color: { dark: '#06121a', light: '#f6efe4' } })
      .then((data) => !cancelled && setSrc(data))
      .catch(() => !cancelled && setSrc(null))
    return () => {
      cancelled = true
    }
  }, [url])
  if (!src) return null
  return (
    <div className="flex items-center gap-4 rounded-2xl glass-soft p-3">
      <img src={src} alt="" className="size-[clamp(84px,6vw,140px)] rounded-xl" draggable={false} />
      <p className="text-kiosk-sm text-cream/80">{label}</p>
    </div>
  )
}
