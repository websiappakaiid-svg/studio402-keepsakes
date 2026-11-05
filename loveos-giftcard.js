/**
 * LoveOS Keepsake QR Gift Card Generator (1080x1350px Portrait IG / Print)
 * Pure HTML5 Canvas • Luxury Obsidian & Rose Gold Liquid Glass Aesthetic
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LoveOSGiftCard = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Helper: Draw rounded rectangle path
  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Load image safely with timeout and CORS
  function loadImage(src, timeoutMs = 3500) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, timeoutMs);

      img.onload = () => {
        if (!timedOut) {
          clearTimeout(timer);
          resolve(img);
        }
      };
      img.onerror = () => {
        if (!timedOut) {
          clearTimeout(timer);
          resolve(null);
        }
      };
      img.src = src;
    });
  }

  // Generate canvas (1080 x 1350)
  async function generateCanvas(data, targetUrl) {
    const coupleData = data || {};
    const partnerName = coupleData.partnerName || 'Mia';
    const creatorName = coupleData.creatorName || 'Alex';
    const slug = coupleData.slug || 'alex-mia';
    const anniversary = coupleData.anniversaryDate || '2024-10-14';

    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://studio402-keepsakes.vercel.app';
    const finalUrl = targetUrl || `${origin}/v/${slug}`;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    // 1. Base Obsidian Background
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, 1080, 1350);

    // 2. Ambient Studio Lighting (Rose & Amber Radial Glows)
    const glow1 = ctx.createRadialGradient(240, 260, 20, 240, 260, 480);
    glow1.addColorStop(0, 'rgba(244, 63, 94, 0.18)');
    glow1.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 1080, 1350);

    const glow2 = ctx.createRadialGradient(840, 1100, 20, 840, 1100, 520);
    glow2.addColorStop(0, 'rgba(245, 158, 11, 0.14)');
    glow2.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, 1080, 1350);

    // 3. Delicate Liquid Glass Outer Frame
    ctx.save();
    roundRect(ctx, 48, 48, 984, 1254, 44);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 4. Top Header Badge: "LOVEOS PRIVATE ARCHIVE"
    ctx.save();
    const badgeW = 440;
    const badgeH = 38;
    const badgeX = (1080 - badgeW) / 2;
    const badgeY = 90;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 19);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fda4af';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '3px';
    ctx.fillText('✦ LOVEOS PRIVATE ARCHIVE ✦', 540, badgeY + badgeH / 2 + 1);
    ctx.restore();

    // 5. Title & Subtitle
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 74px "Instrument Serif", Georgia, serif';
    ctx.fillText(`For ${partnerName}`, 540, 198);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('“Every little moment led me to you.”', 540, 242);
    ctx.restore();

    // 6. Polaroid Photo Frame (Tactile #faf8f5 Warm Paper with slight tilt)
    ctx.save();
    const polaroidW = 560;
    const polaroidH = 540;
    const polaroidX = (1080 - polaroidW) / 2;
    const polaroidY = 280;

    // Subtle tilt
    ctx.translate(540, polaroidY + polaroidH / 2);
    ctx.rotate(-1.2 * Math.PI / 180);
    ctx.translate(-540, -(polaroidY + polaroidH / 2));

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 16;

    // Paper background
    roundRect(ctx, polaroidX, polaroidY, polaroidW, polaroidH, 18);
    ctx.fillStyle = '#faf8f5';
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 211, 209, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Reset shadow for image
    ctx.shadowColor = 'transparent';

    // Photo Box Inside Polaroid
    const photoW = 504;
    const photoH = 390;
    const photoX = polaroidX + (polaroidW - photoW) / 2;
    const photoY = polaroidY + 28;

    roundRect(ctx, photoX, photoY, photoW, photoH, 10);
    ctx.save();
    ctx.clip();

    const photoObj = (coupleData.polaroidPhotos && coupleData.polaroidPhotos[0]) ? coupleData.polaroidPhotos[0] : null;
    const photoImg = photoObj ? await loadImage(photoObj.imageUrl) : null;

    if (photoImg) {
      // Draw image cover-fitted
      const imgRatio = photoImg.width / photoImg.height;
      const boxRatio = photoW / photoH;
      let drawW, drawH, drawX, drawY;
      if (imgRatio > boxRatio) {
        drawH = photoH;
        drawW = photoH * imgRatio;
        drawX = photoX - (drawW - photoW) / 2;
        drawY = photoY;
      } else {
        drawW = photoW;
        drawH = photoW / imgRatio;
        drawX = photoX;
        drawY = photoY - (drawH - photoH) / 2;
      }
      ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
    } else {
      // Sunset Gradient Fallback with Heart
      const fallGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
      fallGrad.addColorStop(0, '#f43f5e');
      fallGrad.addColorStop(0.6, '#fb7185');
      fallGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = fallGrad;
      ctx.fillRect(photoX, photoY, photoW, photoH);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', photoX + photoW / 2, photoY + photoH / 2 + 16);
    }

    // Photo Date Overlay (bottom right corner of photo)
    if (photoObj && photoObj.date) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(photoObj.date, photoX + photoW - 14, photoY + photoH - 14);
    }
    ctx.restore();

    // Polaroid Bottom Handwritten Caption
    ctx.fillStyle = '#1c1917';
    ctx.font = '600 32px "Caveat", cursive';
    ctx.textAlign = 'left';
    const captionText = (photoObj && photoObj.caption) ? photoObj.caption : 'Our golden hour';
    ctx.fillText(captionText, photoX + 4, polaroidY + polaroidH - 45);

    // Location / Signoff on right
    ctx.fillStyle = '#78716c';
    ctx.font = '500 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const locText = (photoObj && photoObj.location) ? photoObj.location : `With love, ${creatorName}`;
    ctx.fillText(locText, photoX + photoW - 4, polaroidY + polaroidH - 45);

    ctx.restore(); // Restore tilt

    // 7. Mini Vinyl Music Bar Widget
    ctx.save();
    const musicW = 740;
    const musicH = 82;
    const musicX = (1080 - musicW) / 2;
    const musicY = 865;

    roundRect(ctx, musicX, musicY, musicW, musicH, 22);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Vinyl Disc
    const discX = musicX + 46;
    const discY = musicY + musicH / 2;
    ctx.beginPath();
    ctx.arc(discX, discY, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(discX, discY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    // Track Title & Artist
    const songData = coupleData.songData || {};
    const songTitle = songData.title || '2:14 AM in Your Car';
    const songArtist = songData.artist || `Late Night Tape — ${creatorName} & ${partnerName}`;

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(songTitle, musicX + 88, musicY + 36);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '400 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(songArtist, musicX + 88, musicY + 59);

    // Waveform bars on the right
    const waveX = musicX + musicW - 54;
    const waveY = musicY + musicH / 2;
    ctx.fillStyle = '#f43f5e';
    const barHeights = [14, 26, 34, 20, 28, 16];
    barHeights.forEach((h, i) => {
      roundRect(ctx, waveX - (barHeights.length - i) * 7, waveY - h / 2, 3.5, h, 2);
      ctx.fill();
    });
    ctx.restore();

    // 8. Bottom QR Code & Keepsake Unlock Card
    ctx.save();
    const qrCardW = 740;
    const qrCardH = 240;
    const qrCardX = (1080 - qrCardW) / 2;
    const qrCardY = 975;

    roundRect(ctx, qrCardX, qrCardY, qrCardW, qrCardH, 28);
    ctx.fillStyle = 'rgba(16, 16, 20, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // QR Code Frame (Pure White for Instant Camera Recognition)
    const qrBoxSize = 180;
    const qrBoxX = qrCardX + 30;
    const qrBoxY = qrCardY + (qrCardH - qrBoxSize) / 2;

    roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Load QR Code Image from clean high-res API (or fallback canvas generator)
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(finalUrl)}&margin=1`;
    const qrImg = await loadImage(qrApiUrl);

    if (qrImg) {
      ctx.drawImage(qrImg, qrBoxX + 10, qrBoxY + 10, qrBoxSize - 20, qrBoxSize - 20);
    } else {
      // Fallback: draw stylish placeholder QR block
      ctx.fillStyle = '#09090b';
      // Corners
      ctx.fillRect(qrBoxX + 16, qrBoxY + 16, 42, 42);
      ctx.fillRect(qrBoxX + qrBoxSize - 58, qrBoxY + 16, 42, 42);
      ctx.fillRect(qrBoxX + 16, qrBoxY + qrBoxSize - 58, 42, 42);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrBoxX + 24, qrBoxY + 24, 26, 26);
      ctx.fillRect(qrBoxX + qrBoxSize - 50, qrBoxY + 24, 26, 26);
      ctx.fillRect(qrBoxX + 24, qrBoxY + qrBoxSize - 50, 26, 26);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(qrBoxX + 30, qrBoxY + 30, 14, 14);
      ctx.fillRect(qrBoxX + qrBoxSize - 44, qrBoxY + 30, 14, 14);
      ctx.fillRect(qrBoxX + 30, qrBoxY + qrBoxSize - 44, 14, 14);
      // Center Scan Icon
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize / 2 + 6);
    }

    // Right Column Text beside QR Code
    const textX = qrBoxX + qrBoxSize + 28;
    ctx.textAlign = 'left';

    // Badge
    ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText('LIVE INTERACTIVE KEEPSAKE', textX, qrCardY + 58);

    // Call to action
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Scan with phone camera', textX, qrCardY + 95);
    ctx.fillText('to unlock our tiny phone', textX, qrCardY + 125);

    // Meta details (Anniversary & Slug)
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 14px "JetBrains Mono", monospace';
    const dateFormatted = anniversary ? new Date(anniversary).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'October 14, 2024';
    ctx.fillText(`Since ${dateFormatted} • /v/${slug}`, textX, qrCardY + 168);

    ctx.fillStyle = '#71717a';
    ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Made with care on OurPage LoveOS', textX, qrCardY + 195);

    ctx.restore();

    return canvas;
  }

  // Trigger file download
  async function downloadGiftCard(data, targetUrl, customFileName) {
    const coupleData = data || {};
    const partnerName = (coupleData.partnerName || 'Keepsake').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = customFileName || `LoveOS-Gift-Card-${partnerName}.png`;

    const canvas = await generateCanvas(coupleData, targetUrl);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve(true);
        }, 300);
      }, 'image/png');
    });
  }

  return {
    generateCanvas,
    downloadGiftCard
  };
});

