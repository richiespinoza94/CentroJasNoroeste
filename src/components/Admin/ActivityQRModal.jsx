import { useEffect, useRef, useState } from 'react';
import Modal, { useModalClose } from '../ui/Modal.jsx';
import logoUrl from '../../assets/logo.png';
import './ActivityQRModal.css';

function registrationUrl(activityId) {
  return `${window.location.origin}${window.location.pathname}?actividad=${activityId}`;
}

/**
 * Página lista para imprimir/guardar como PDF — mismo patrón que ya probó
 * el checkin.html del Full Day para "imprimir grupos": una ventana nueva
 * con HTML autocontenido + window.print(). El navegador ya ofrece "Guardar
 * como PDF" en el diálogo de impresión, así que no hace falta agregar una
 * librería de PDF solo para esto.
 *
 * Diseño a una sola hoja A4, a sangre completa (el fondo navy llega hasta
 * el borde) — usa los mismos tokens de color/tipografía que el resto de la
 * app (navy 900→700, dorado 500, Nunito/Lato) en vez de una página en
 * blanco con el QR perdido en el centro.
 */
function buildPrintHTML(activity, qrDataUrl) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>QR — ${activity.nombre}</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Lato:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    @page{size:A4;margin:0;}
    html,body{width:210mm;height:297mm;}
    body{
      font-family:'Lato',sans-serif;
      background:
        radial-gradient(circle at 15% 8%, rgba(245,166,35,0.16), transparent 40%),
        radial-gradient(circle at 88% 92%, rgba(245,166,35,0.12), transparent 38%),
        linear-gradient(155deg, #14284f 0%, #1a3a6b 55%, #234a86 100%);
      color:#fff;
      display:flex;
      flex-direction:column;
      align-items:center;
      padding:16mm 14mm;
      position:relative;
      overflow:hidden;
    }
    body::before, body::after{
      content:"";
      position:absolute;
      width:120mm;height:120mm;
      border:1.5px solid rgba(245,166,35,0.18);
      border-radius:50%;
    }
    body::before{ top:-60mm; left:-45mm; }
    body::after{ bottom:-65mm; right:-50mm; }

    .rule{ width:100%; height:3px; background:linear-gradient(90deg,#f5a623,#f7c948); border-radius:2px; position:relative; z-index:1; }

    .header{ text-align:center; margin-top:14mm; position:relative; z-index:1; }
    .logo{ width:34mm; height:34mm; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; margin:0 auto 8mm; box-shadow:0 6mm 14mm rgba(0,0,0,0.35); padding:2mm; }
    .logo img{ width:100%; height:100%; object-fit:contain; }
    .eyebrow{ font-family:'Nunito',sans-serif; font-size:11px; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:#f7c948; margin-bottom:3mm; }
    h1{ font-family:'Nunito',sans-serif; font-size:34px; font-weight:900; line-height:1.15; max-width:150mm; margin:0 auto; }
    .badge{ display:inline-flex; align-items:center; gap:2mm; background:linear-gradient(90deg,#f5a623,#f7c948); color:#14284f; font-family:'Nunito',sans-serif; font-size:13px; font-weight:800; padding:2.5mm 8mm; border-radius:99px; margin-top:6mm; }

    .qr-stage{ flex:1; display:flex; align-items:center; justify-content:center; width:100%; position:relative; z-index:1; }
    .qr-card{ background:#fff; border-radius:8mm; padding:12mm; box-shadow:0 10mm 28mm rgba(0,0,0,0.4); display:flex; flex-direction:column; align-items:center; }
    .qr-card img{ width:90mm; height:90mm; display:block; }
    .qr-card .instr{ font-family:'Nunito',sans-serif; font-weight:800; font-size:15px; color:#1a3a6b; margin-top:6mm; }
    .qr-card .instr-sub{ font-size:11.5px; color:#6b7a99; margin-top:1.5mm; }

    .footer{ text-align:center; position:relative; z-index:1; margin-bottom:4mm; }
    .footer-title{ font-family:'Nunito',sans-serif; font-size:11px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:#fff; }
    .footer-sub{ font-size:10.5px; color:rgba(255,255,255,0.6); margin-top:1.5mm; }

    @media print{ body{ -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style></head><body>
    <div class="rule"></div>
    <div class="header">
      <div class="logo"><img src="${logoUrl}" alt="Centro JAS Noroeste"/></div>
      <div class="eyebrow">Centro JAS Noroeste</div>
      <h1>${activity.nombre}</h1>
      <div class="badge">🗓️ ${activity.fecha}${activity.lugar ? ` · ${activity.lugar}` : ''}</div>
    </div>

    <div class="qr-stage">
      <div class="qr-card">
        <img src="${qrDataUrl}" alt="Código QR de inscripción"/>
        <div class="instr">📲 Escanea para inscribirte</div>
        <div class="instr-sub">Abre la cámara de tu celular y apunta al código</div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-title">Ventanilla · Miramar · Puente Piedra</div>
      ${activity.anfitrion ? `<div class="footer-sub">${activity.anfitrion}</div>` : ''}
    </div>
    <div class="rule"></div>
  </body></html>`;
}

function QRModalBody({ activity, qrDataUrl, onShowFullscreen, onPrint }) {
  const requestClose = useModalClose();
  return (
    <div className="qr-modal">
      <div className="qr-modal__title">{activity.nombre}</div>
      <div className="qr-modal__meta">
        {activity.fecha}
        {activity.lugar ? ` · ${activity.lugar}` : ''}
      </div>

      <div className="qr-modal__canvas">{qrDataUrl ? <img src={qrDataUrl} alt="Código QR de inscripción" /> : <div className="qr-modal__loading">Generando…</div>}</div>

      <div className="qr-modal__actions">
        <button type="button" className="qr-modal__btn qr-modal__btn--primary press" disabled={!qrDataUrl} onClick={onShowFullscreen}>
          Pantalla completa
        </button>
        <button type="button" className="qr-modal__btn press" disabled={!qrDataUrl} onClick={onPrint}>
          Descargar / Imprimir
        </button>
      </div>
      <button type="button" className="qr-modal__close press" onClick={() => requestClose()}>
        Cerrar
      </button>
    </div>
  );
}

export default function ActivityQRModal({ activity, triggerRef, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    import('qrcode').then((QRCode) =>
      QRCode.toDataURL(registrationUrl(activity.id), { width: 960, margin: 1 }).then((url) => {
        if (!cancelled.current) setQrDataUrl(url);
      })
    );
    return () => {
      cancelled.current = true;
    };
  }, [activity.id]);

  function handlePrint() {
    if (!qrDataUrl) return;
    const w = window.open('', '_blank', 'width=560,height=780');
    if (!w) return;
    w.document.write(buildPrintHTML(activity, qrDataUrl));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  if (fullscreen && qrDataUrl) {
    return (
      <div className="qr-fullscreen" role="dialog" aria-modal="true" aria-label={`QR de ${activity.nombre}`}>
        <button type="button" className="qr-fullscreen__close press" onClick={() => setFullscreen(false)} aria-label="Cerrar pantalla completa">
          ✕
        </button>
        <img src={qrDataUrl} alt="Código QR de inscripción" className="qr-fullscreen__img" />
        <div className="qr-fullscreen__title">{activity.nombre}</div>
      </div>
    );
  }

  return (
    <Modal onClose={onClose} triggerRef={triggerRef} label={`QR de ${activity.nombre}`}>
      <QRModalBody activity={activity} qrDataUrl={qrDataUrl} onShowFullscreen={() => setFullscreen(true)} onPrint={handlePrint} />
    </Modal>
  );
}
