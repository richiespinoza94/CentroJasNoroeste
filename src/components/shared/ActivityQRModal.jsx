import { useEffect, useRef, useState } from 'react';
import Modal, { useModalClose } from '../ui/Modal.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { drawShareCard, drawPrintFlyer } from '../../domain/shareCard.js';
import { ShareIcon } from '../ui/Icon.jsx';
import logoUrl from '../../assets/logo.png';
import nunito800 from '@fontsource/nunito/files/nunito-latin-800-normal.woff2?url';
import nunito900 from '@fontsource/nunito/files/nunito-latin-900-normal.woff2?url';
import lato400 from '@fontsource/lato/files/lato-latin-400-normal.woff2?url';
import './ActivityQRModal.css';

function registrationUrl(activityId) {
  return `${window.location.origin}${window.location.pathname}?actividad=${activityId}`;
}

// El resto de la app carga Nunito hasta el peso 800 (ver index.html) — el
// título del QR necesita el 900 ("black"), que nadie más pide. Sin
// registrarlo explícito, el navegador podría resolverlo a cualquier peso
// disponible al dibujar en <canvas> sin avisar (a diferencia del CSS normal,
// que sí hace "negrita sintética" de forma más predecible). Se registran
// los tres pesos exactos que se usan, desde los mismos archivos ya
// empaquetados con la app — no hay segunda fuente de verdad que se pueda
// desincronizar.
let fontsReadyPromise = null;
function ensureCanvasFonts() {
  if (!fontsReadyPromise) {
    fontsReadyPromise = Promise.all([
      new FontFace('Nunito', `url(${nunito800})`, { weight: '800' }).load().then((f) => document.fonts.add(f)),
      new FontFace('Nunito', `url(${nunito900})`, { weight: '900' }).load().then((f) => document.fonts.add(f)),
      new FontFace('Lato', `url(${lato400})`, { weight: '400' }).load().then((f) => document.fonts.add(f)),
    ]).catch((err) => {
      // Las fuentes son cosméticas: si no cargan, el canvas cae a la fuente
      // de respaldo del sistema y la imagen igual sale bien. Antes esto no
      // tenía catch, así que una falla de red convertía la promesa cacheada
      // en una promesa RECHAZADA — y como se cachea a nivel de módulo, ese
      // rechazo quedaba pegado para siempre: compartir y descargar fallaban
      // en cada intento posterior de esa sesión, aunque la red ya se
      // hubiera recuperado. Se resuelve igual, y se limpia la caché para
      // que el próximo intento pueda volver a probar.
      console.warn('[qr] no se pudieron cargar las fuentes del canvas, se usará la de respaldo:', err);
      fontsReadyPromise = null;
    });
  }
  return fontsReadyPromise;
}

function QRModalBody({ activity, qrDataUrl, sharing, downloading, onShare, onDownload, onShowFullscreen }) {
  const requestClose = useModalClose();
  return (
    <div className="qr-modal">
      <div className="qr-modal__title">{activity.nombre}</div>
      <div className="qr-modal__meta">
        {activity.fecha}
        {activity.lugar ? ` · ${activity.lugar}` : ''}
      </div>

      <div className="qr-modal__canvas">{qrDataUrl ? <img src={qrDataUrl} alt="Código QR de inscripción" /> : <div className="qr-modal__loading">Generando…</div>}</div>

      <button type="button" className="qr-modal__share press" disabled={!qrDataUrl || sharing} onClick={onShare}>
        <ShareIcon width={18} height={18} />
        {sharing ? 'Preparando…' : 'Compartir'}
      </button>

      <div className="qr-modal__actions">
        <button type="button" className="qr-modal__btn press" disabled={!qrDataUrl} onClick={onShowFullscreen}>
          Pantalla completa
        </button>
        <button type="button" className="qr-modal__btn press" disabled={!qrDataUrl || downloading} onClick={onDownload}>
          {downloading ? 'Generando…' : 'Descargar afiche'}
        </button>
      </div>
      <button type="button" className="qr-modal__close press" onClick={() => requestClose()}>
        Cerrar
      </button>
    </div>
  );
}

export default function ActivityQRModal({ activity, triggerRef, onClose }) {
  const toast = useToast();
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cancelled = useRef(false);
  // La tarjeta compartible se genera EN SEGUNDO PLANO apenas el QR está
  // listo, no cuando la persona toca "Compartir".
  //
  // Motivo (iOS): Safari exige que navigator.share() se llame con
  // "transient user activation" — dentro de la misma tanda del gesto que lo
  // originó. Generar la imagen en ese momento implica varios `await`
  // (cargar logo, cargar fuentes, canvas.toBlob), y si alguno tarda más que
  // la ventana de activación, iOS rechaza la llamada con NotAllowedError.
  // Eso hacía que compartir fallara de forma INTERMITENTE en iPhone: andaba
  // si todo estaba en caché y rápido, fallaba si algo tardaba. Teniendo el
  // blob listo de antes, navigator.share() se llama de inmediato.
  const shareBlobRef = useRef(null);

  useEffect(() => {
    cancelled.current = false;
    shareBlobRef.current = null;
    import('qrcode').then((QRCode) =>
      QRCode.toDataURL(registrationUrl(activity.id), { width: 960, margin: 1, errorCorrectionLevel: 'H' }).then((url) => {
        if (!cancelled.current) setQrDataUrl(url);
      })
    );
    return () => {
      cancelled.current = true;
    };
  }, [activity.id]);

  // Precalienta la tarjeta compartible en cuanto haya QR — sin bloquear la
  // interfaz ni molestar si falla (si no llega a estar lista, handleShare
  // igual la genera al vuelo como respaldo).
  useEffect(() => {
    if (!qrDataUrl) return;
    let stale = false;
    buildShareBlob()
      .then((blob) => {
        if (!stale) shareBlobRef.current = blob;
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrDataUrl, activity.id]);

  function loadImageEl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function fileNameSlug(suffix) {
    const base = activity.nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `qr-${base}${suffix ? `-${suffix}` : ''}.png`;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // Firefox (y algunos navegadores móviles) ignoran .click() en un
    // elemento que no está insertado en el documento — la descarga no
    // ocurría y no había ningún error que lo delatara. Insertarlo, hacer
    // click y quitarlo es el patrón que funciona en todos.
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function buildShareBlob() {
    const [logoImage, qrImage] = await Promise.all([loadImageEl(logoUrl), loadImageEl(qrDataUrl), ensureCanvasFonts()]);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    drawShareCard(ctx, { activity, qrImage, logoImage, size: 1080 });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar la imagen.');
    return blob;
  }

  /**
   * Comparte por la Web Share API nativa, que abre el selector del sistema
   * (WhatsApp, Instagram, Facebook, TikTok, lo que el celular tenga
   * instalado) — sin agregar ninguna librería, es lo que el navegador ya
   * trae.
   *
   * Usa el blob PRE-GENERADO (ver shareBlobRef arriba) para que la llamada
   * a navigator.share() ocurra sin ningún await de por medio — requisito de
   * iOS. Solo si todavía no estuviera listo se genera al vuelo, aceptando
   * que en ese caso puntual iOS podría rechazarlo.
   *
   * No todos los navegadores soportan compartir ARCHIVOS (algunos solo
   * texto/enlaces, y varios de escritorio no soportan nada de esto) — si no
   * hay soporte, se descarga la imagen en vez de fallar en silencio.
   */
  async function handleShare() {
    if (!qrDataUrl || sharing) return;
    const shareText = `¡Inscríbete a ${activity.nombre}! 📲\n${registrationUrl(activity.id)}`;

    // Camino rápido: el blob ya está listo → nada de await antes de share().
    const ready = shareBlobRef.current;
    if (ready) {
      const file = new File([ready], fileNameSlug(), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: activity.nombre, text: shareText });
        } catch (err) {
          if (err?.name !== 'AbortError') toast('No se pudo compartir. Intenta de nuevo.', 'error');
        }
        return;
      }
    }

    setSharing(true);
    try {
      const blob = ready || (await buildShareBlob());
      shareBlobRef.current = blob;
      const file = new File([blob], fileNameSlug(), { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: activity.nombre, text: shareText });
      } else if (navigator.share) {
        // Este navegador comparte texto/enlaces pero no archivos — comparte
        // el link igual, y además descarga la imagen para que la puedan
        // adjuntar a mano si quieren.
        triggerDownload(blob, fileNameSlug());
        await navigator.share({ title: activity.nombre, text: shareText, url: registrationUrl(activity.id) });
      } else {
        triggerDownload(blob, fileNameSlug());
        toast('Tu navegador no puede abrir el selector de compartir — se descargó la imagen para que la compartas a mano.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        // AbortError = la persona cerró el selector de compartir sin elegir nada — no es un error real.
        console.error('[qr] share failed:', err);
        toast('No se pudo compartir. Intenta de nuevo.', 'error');
      }
    } finally {
      setSharing(false);
    }
  }

  /**
   * Descarga el afiche A4 como imagen — en vez de una página HTML lista
   * para "Guardar como PDF" (que era el diseño original). En Android, el
   * sistema de impresión/guardado-como-PDF no respeta de forma confiable
   * el CSS que fuerza a imprimir colores de fondo (print-color-adjust): el
   * navy y el dorado desaparecían y quedaba solo blanco, aunque en Chrome
   * de escritorio se viera perfecto. Un <canvas> rasteriza los colores
   * directo en los píxeles de la imagen — no depende de que ningún sistema
   * operativo "respete" nada. Para imprimir en papel de verdad, la persona
   * abre la imagen descargada desde su galería/Fotos e imprime desde ahí
   * (esa ruta sí usa el motor de impresión de imágenes del sistema, que es
   * confiable — el problema era específico de imprimir HTML con CSS).
   */
  async function handleDownload() {
    if (!qrDataUrl || downloading) return;
    setDownloading(true);
    try {
      const [logoImage, qrImage] = await Promise.all([loadImageEl(logoUrl), loadImageEl(qrDataUrl), ensureCanvasFonts()]);

      const canvas = document.createElement('canvas');
      canvas.width = 1240;
      canvas.height = 1754;
      const ctx = canvas.getContext('2d');
      drawPrintFlyer(ctx, { activity, qrImage, logoImage, formUrl: registrationUrl(activity.id), width: 1240, height: 1754 });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo generar la imagen.');
      triggerDownload(blob, fileNameSlug('afiche'));
    } catch {
      toast('No se pudo generar el afiche. Intenta de nuevo.', 'error');
    } finally {
      setDownloading(false);
    }
  }

  // La vista de pantalla completa es un modal propio (no usa ui/Modal.jsx,
  // porque necesita ocupar todo el viewport sin la tarjeta ni el backdrop)
  // — así que necesita su propio Escape y bloqueo de scroll, que ui/Modal
  // sí trae de fábrica. Sin esto, quedaba como la única superficie modal de
  // la app sin salida por teclado, y con el fondo desplazándose detrás.
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e) {
      if (e.key === 'Escape') setFullscreen(false);
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

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
      <QRModalBody
        activity={activity}
        qrDataUrl={qrDataUrl}
        sharing={sharing}
        downloading={downloading}
        onShare={handleShare}
        onDownload={handleDownload}
        onShowFullscreen={() => setFullscreen(true)}
      />
    </Modal>
  );
}
