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
 */
function buildPrintHTML(activity, qrDataUrl) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>QR — ${activity.nombre}</title>
  <style>
    body{font-family:sans-serif;background:#fff;color:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:40px;text-align:center;}
    img.logo{width:96px;height:96px;object-fit:contain;margin-bottom:18px;}
    h1{font-size:24px;color:#1a3a6b;margin-bottom:6px;}
    .meta{font-size:15px;color:#4a5c7a;margin-bottom:28px;}
    img.qr{width:320px;height:320px;border:1px solid #e8eef9;border-radius:12px;padding:16px;}
    .instr{margin-top:22px;font-size:14px;color:#4a5c7a;font-weight:700;}
    @media print{@page{size:A5;margin:12mm;}}
  </style></head><body>
  <img class="logo" src="${logoUrl}" alt="Centro JAS Noroeste"/>
  <h1>${activity.nombre}</h1>
  <div class="meta">${activity.fecha}${activity.lugar ? ` · ${activity.lugar}` : ''}</div>
  <img class="qr" src="${qrDataUrl}" alt="Código QR de inscripción"/>
  <div class="instr">📲 Escanea para inscribirte</div>
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
      QRCode.toDataURL(registrationUrl(activity.id), { width: 480, margin: 1 }).then((url) => {
        if (!cancelled.current) setQrDataUrl(url);
      })
    );
    return () => {
      cancelled.current = true;
    };
  }, [activity.id]);

  function handlePrint() {
    if (!qrDataUrl) return;
    const w = window.open('', '_blank', 'width=500,height=650');
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
