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
 * Diseño a una sola hoja A4, a sangre completa, con los mismos tokens de
 * color/tipografía que el resto de la app (navy 900→700, dorado 500,
 * Nunito/Lato). Estructura en CSS Grid a propósito (`auto 1fr auto`) en vez
 * de flex con alturas intrínsecas — así el total SIEMPRE suma exactamente
 * 297mm sin importar cuánto midan el header o el footer, eliminando el
 * riesgo de desborde a una segunda página en blanco.
 */
function buildPrintHTML(activity, qrDataUrl, formUrl) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>QR — ${activity.nombre}</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Lato:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    @page{size:A4;margin:0;}
    html,body{width:210mm;height:297mm;overflow:hidden;} /* overflow:hidden = red de seguridad: si algo se pasa por milímetros, se recorta en vez de crear una página 2 en blanco */
    body{
      font-family:'Lato',sans-serif;
      background:
        radial-gradient(circle at 12% 6%, rgba(245,166,35,0.18), transparent 42%),
        radial-gradient(circle at 90% 96%, rgba(245,166,35,0.14), transparent 40%),
        linear-gradient(155deg, #14284f 0%, #1a3a6b 55%, #234a86 100%);
      color:#fff;
      display:grid;
      grid-template-rows:auto 1fr auto;
      justify-items:center;
      padding:13mm 16mm;
      position:relative;
    }
    body::before, body::after{
      content:"";
      position:absolute;
      width:130mm;height:130mm;
      border:1.5px solid rgba(245,166,35,0.16);
      border-radius:50%;
    }
    body::before{ top:-65mm; left:-50mm; }
    body::after{ bottom:-70mm; right:-55mm; }

    .rule{ width:100%; height:3px; background:linear-gradient(90deg,#f5a623,#f7c948); border-radius:2px; }

    .header{ text-align:center; width:100%; position:relative; z-index:1; padding-top:6mm; }
    .logo{ width:28mm; height:28mm; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; margin:0 auto 5mm; box-shadow:0 5mm 11mm rgba(0,0,0,0.35); padding:1.8mm; }
    .logo img{ width:100%; height:100%; object-fit:contain; }
    .eyebrow{ font-family:'Nunito',sans-serif; font-size:10.5px; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:#f7c948; margin-bottom:2.5mm; }
    /* Máximo 2 líneas garantizado (line-clamp), sin importar qué tan largo
       sea el nombre real de la actividad — así el header nunca puede crecer
       sin límite y robarle espacio al QR. word-break evita que una palabra
       sola sin espacios (rara en español, pero posible en una URL pegada
       por error) rompa el ancho. */
    h1{
      font-family:'Nunito',sans-serif; font-weight:900; line-height:1.15; max-width:165mm; margin:0 auto;
      font-size:${activity.nombre.length > 42 ? '24px' : activity.nombre.length > 26 ? '28px' : '32px'};
      display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden;
      word-break:break-word; overflow-wrap:break-word;
    }
    /* Fecha+lugar en una sola línea con elipsis — un "lugar" largo (una
       dirección completa, por ejemplo) no debe poder ensanchar el badge
       más allá del ancho de la hoja ni partirlo en varias líneas. */
    .badge{
      display:inline-flex; align-items:center; gap:2mm; background:linear-gradient(90deg,#f5a623,#f7c948); color:#14284f;
      font-family:'Nunito',sans-serif; font-size:12.5px; font-weight:800; padding:2.3mm 7mm; border-radius:99px; margin-top:5mm;
      max-width:170mm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }

    .qr-stage{ display:flex; align-items:center; justify-content:center; width:100%; position:relative; z-index:1; min-height:0; }
    .qr-card{ background:#fff; border-radius:9mm; padding:9mm; box-shadow:0 9mm 24mm rgba(0,0,0,0.4); display:flex; flex-direction:column; align-items:center; }
    .qr-card img{ width:92mm; height:92mm; display:block; }
    .qr-card .instr{ font-family:'Nunito',sans-serif; font-weight:800; font-size:16px; color:#1a3a6b; margin-top:5.5mm; }
    .qr-card .instr-sub{ font-size:11px; color:#6b7a99; margin-top:1.5mm; }

    .footer{ text-align:center; width:100%; position:relative; z-index:1; padding-bottom:5mm; }
    .footer-title{ font-family:'Nunito',sans-serif; font-size:11px; font-weight:800; letter-spacing:2px; text-transform:uppercase; }
    /* Mismo criterio: el nombre del anfitrión puede ser cualquier texto que
       alguien escriba en Admin → Actividades — una línea con elipsis, nunca
       varias líneas que empujen el layout. */
    .footer-sub{ font-size:10px; color:rgba(255,255,255,0.62); margin-top:1.5mm; max-width:170mm; margin-left:auto; margin-right:auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .footer-url{ font-size:9.5px; color:rgba(255,255,255,0.4); margin-top:3mm; max-width:170mm; margin-left:auto; margin-right:auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    @media print{ body{ -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style></head><body>
    <div class="header">
      <div class="rule" style="margin-bottom:8mm;"></div>
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
      <div class="footer-url">¿No puedes escanear? Ingresa a: ${formUrl}</div>
      <div class="rule" style="margin-top:6mm;"></div>
    </div>
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
    w.document.write(buildPrintHTML(activity, qrDataUrl, registrationUrl(activity.id)));
    w.document.close();
    w.focus();

    // Imprimir antes de que Nunito termine de descargarse usa la fuente de
    // respaldo del sistema para calcular el layout — más ancha/alta que
    // Nunito, lo suficiente para desbordar la hoja y crear una página 2 en
    // blanco. document.fonts.ready espera a que la fuente esté realmente
    // lista; el setTimeout es solo una red de seguridad por si ese API no
    // resuelve en algún navegador viejo.
    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      w.print();
    };
    if (w.document.fonts?.ready) {
      w.document.fonts.ready.then(doPrint).catch(doPrint);
    }
    setTimeout(doPrint, 1200);
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
