import { useState, useEffect, useRef } from 'react'

/**
 * Przycisk z inline potwierdzeniem zamiast window.confirm.
 *
 * Props:
 *   onConfirm()     — wywołane po kliknięciu "Tak"
 *   label           — treść przycisku (domyślnie "Usuń")
 *   confirmLabel    — tekst pytania (domyślnie "Czy jesteś pewien?")
 *   btnStyle        — style dla przycisku
 *   disabled        — zablokowanie przycisku
 */
export default function ConfirmButton({
  onConfirm,
  label = 'Usuń',
  confirmLabel = 'Czy jesteś pewien?',
  btnStyle = {},
  btnClass = '',
  disabled = false,
}) {
  const [asking, setAsking] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!asking) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setAsking(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [asking])

  if (!asking) {
    return (
      <button
        disabled={disabled}
        onClick={() => setAsking(true)}
        className={btnClass}
        style={btnStyle}
      >
        {label}
      </button>
    )
  }

  return (
    <span ref={ref} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
      <span style={{ fontSize: 10, color: '#ccc', whiteSpace: 'nowrap' }}>{confirmLabel}</span>
      <button
        onClick={() => { setAsking(false); onConfirm() }}
        style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(231,76,60,0.2)', border: '1px solid #c0392b', color: '#e74c3c', borderRadius: 3, cursor: 'pointer' }}
      >
        Tak
      </button>
      <button
        onClick={() => setAsking(false)}
        style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid #444', color: '#aaa', borderRadius: 3, cursor: 'pointer' }}
      >
        Nie
      </button>
    </span>
  )
}
