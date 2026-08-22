// Dibuja la tarjeta compartible (1080×1080 — cuadrado, funciona sin recortes
// raros en WhatsApp, Instagram feed/stories, Facebook y TikTok) en un
// CanvasRenderingContext2D ya dado. Función pura sin dependencias de DOM
// — se probó exhaustivamente con node-canvas contra nombres/lugares/
// anfitriones extremadamente largos antes de integrarla (ver PR): el
// presupuesto vertical se calcula explícitamente (el footer se mide
// primero, el QR se lleva lo que sobra) y el ajuste de texto rompe también
// dentro de una palabra si hace falta, no solo entre palabras.

// Rompe también DENTRO de una palabra si no cabe entera en el ancho
// disponible (ej. una URL pegada por error, o una palabra compuesta sin
// espacios) — sin esto, una palabra más ancha que el lienzo simplemente se
// sale por los dos lados en vez de partirse.
function splitLongWord(ctx, word, maxWidth) {
  const parts = [];
  let current = '';
  for (const ch of word) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current) {
      parts.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapAndClamp(ctx, text, maxWidth, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  let truncated = false;

  outer: for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }
    // La palabra no cabe agregada a la línea actual.
    if (current) {
      lines.push(current);
      current = '';
      if (lines.length === maxLines) {
        truncated = true;
        break outer;
      }
    }
    if (ctx.measureText(w).width <= maxWidth) {
      current = w;
      continue;
    }
    // Ni siquiera la palabra sola cabe en una línea — se parte por caracteres.
    const chunks = splitLongWord(ctx, w, maxWidth);
    for (let i = 0; i < chunks.length; i++) {
      if (i === chunks.length - 1) {
        current = chunks[i];
      } else {
        lines.push(chunks[i]);
        if (lines.length === maxLines) {
          truncated = true;
          break outer;
        }
      }
    }
  }
  if (!truncated && lines.length < maxLines && current) lines.push(current);
  else if (truncated) current = '';

  if (lines.length === maxLines && (truncated || current)) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

/**
 * Tarjeta compartible 1080×1080 (cuadrado — funciona en WhatsApp, Instagram
 * feed/stories, Facebook y TikTok sin recortes raros). Presupuesto vertical
 * calculado explícitamente en mm... en px, más bien — cada bloque tiene una
 * altura MÁXIMA fija (el QR, el elemento que más importa, se lleva la
 * mayoría del espacio a propósito), no "lo que le sobre a los demás".
 */
function drawShareCard(ctx, { activity, qrImage, logoImage, size = 1080 }) {
  const S = size;
  ctx.clearRect(0, 0, S, S);
  ctx.textAlign = 'center';

  const bg = ctx.createLinearGradient(0, 0, S * 0.3, S);
  bg.addColorStop(0, '#14284f');
  bg.addColorStop(0.55, '#1a3a6b');
  bg.addColorStop(1, '#234a86');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  const glow1 = ctx.createRadialGradient(S * 0.1, S * 0.05, 0, S * 0.1, S * 0.05, S * 0.4);
  glow1.addColorStop(0, 'rgba(245,166,35,0.16)');
  glow1.addColorStop(1, 'rgba(245,166,35,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, S, S);

  ctx.strokeStyle = 'rgba(245,166,35,0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(S * 1.05, S * 1.02, S * 0.28, 0, Math.PI * 2);
  ctx.stroke();

  const ruleGrad = ctx.createLinearGradient(S * 0.1, 0, S * 0.9, 0);
  ruleGrad.addColorStop(0, '#f5a623');
  ruleGrad.addColorStop(1, '#f7c948');
  ctx.fillStyle = ruleGrad;
  ctx.fillRect(S * 0.1, S * 0.028, S * 0.8, S * 0.0035);

  let y = S * 0.075;

  // Logo — más chico que en el afiche impreso: aquí el protagonista es el QR
  const logoR = S * 0.052;
  const logoCx = S / 2;
  const logoCy = y + logoR;
  ctx.save();
  ctx.beginPath();
  ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = S * 0.015;
  ctx.shadowOffsetY = S * 0.006;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  const pad = logoR * 0.12;
  if (logoImage) ctx.drawImage(logoImage, logoCx - logoR + pad, logoCy - logoR + pad, (logoR - pad) * 2, (logoR - pad) * 2);
  ctx.restore();
  y = logoCy + logoR + S * 0.018;

  ctx.fillStyle = '#f7c948';
  ctx.font = `800 ${S * 0.0135}px Nunito, sans-serif`;
  ctx.fillText('C E N T R O   J A S   N O R O E S T E', S / 2, y);
  y += S * 0.032;

  const nameLen = activity.nombre.length;
  const nameFontPx = nameLen > 42 ? S * 0.032 : nameLen > 26 ? S * 0.038 : S * 0.044;
  ctx.font = `900 ${nameFontPx}px Nunito, sans-serif`;
  ctx.fillStyle = '#fff';
  const nameLines = wrapAndClamp(ctx, activity.nombre, S * 0.84, 2);
  for (const line of nameLines) {
    y += nameFontPx * 0.62;
    ctx.fillText(line, S / 2, y);
    y += nameFontPx * 0.5;
  }
  y += S * 0.022;

  const badgeText = `${activity.fecha}${activity.lugar ? ` · ${activity.lugar}` : ''}`;
  ctx.font = `800 ${S * 0.017}px Nunito, sans-serif`;
  const badgeTextClamped = ellipsize(ctx, badgeText, S * 0.68);
  const badgeTextW = ctx.measureText(badgeTextClamped).width;
  const badgeW = badgeTextW + S * 0.07;
  const badgeH = S * 0.036;
  const badgeGrad = ctx.createLinearGradient(S / 2 - badgeW / 2, 0, S / 2 + badgeW / 2, 0);
  badgeGrad.addColorStop(0, '#f5a623');
  badgeGrad.addColorStop(1, '#f7c948');
  ctx.fillStyle = badgeGrad;
  ctx.beginPath();
  ctx.roundRect(S / 2 - badgeW / 2, y, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.fillStyle = '#14284f';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeTextClamped, S / 2, y + badgeH / 2 + S * 0.001);
  ctx.textBaseline = 'alphabetic';
  y += badgeH + S * 0.032;

  // Footer se calcula ANTES que la tarjeta del QR, para saber cuánto
  // espacio darle al QR con lo que sobra (el QR se lleva el resto, no al
  // revés) — así nunca puede quedar aplastado por un footer inesperadamente
  // alto.
  const footerH = S * 0.028 + (activity.anfitrion ? S * 0.03 : 0) + S * 0.03;

  const cardTop = y;
  const cardBottom = S - footerH;
  const cardPad = S * 0.028;
  const instrH = S * 0.075;
  const qrSize = cardBottom - cardTop - cardPad * 2 - instrH;
  const cardW = qrSize + cardPad * 2;
  const cardH = qrSize + cardPad * 2 + instrH;
  const cardX = S / 2 - cardW / 2;
  const cardY = cardTop;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = S * 0.03;
  ctx.shadowOffsetY = S * 0.012;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, S * 0.02);
  ctx.fill();
  ctx.restore();

  if (qrImage) ctx.drawImage(qrImage, cardX + cardPad, cardY + cardPad, qrSize, qrSize);

  ctx.fillStyle = '#1a3a6b';
  ctx.font = `800 ${S * 0.02}px Nunito, sans-serif`;
  ctx.fillText('📲 Escanea para inscribirte', S / 2, cardY + cardPad + qrSize + S * 0.032);
  ctx.fillStyle = '#6b7a99';
  ctx.font = `400 ${S * 0.0135}px Lato, sans-serif`;
  ctx.fillText('Abre la cámara de tu celular', S / 2, cardY + cardPad + qrSize + S * 0.054);

  y = cardY + cardH + S * 0.032;

  ctx.fillStyle = '#fff';
  ctx.font = `800 ${S * 0.014}px Nunito, sans-serif`;
  ctx.fillText('VENTANILLA  ·  MIRAMAR  ·  PUENTE PIEDRA', S / 2, y);

  if (activity.anfitrion) {
    y += S * 0.026;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `400 ${S * 0.0135}px Lato, sans-serif`;
    ctx.fillText(ellipsize(ctx, activity.anfitrion, S * 0.7), S / 2, y);
  }
}

export { drawShareCard };
