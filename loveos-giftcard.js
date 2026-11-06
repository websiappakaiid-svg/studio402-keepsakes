/**
 * Heart-Shaped QR Code Generator for OurPage LoveOS
 * Generates an iconic, camera-scannable Heart QR Code on pure white canvas
 * Primary Color: #E63946 (Crimson Rose)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LoveOSGiftCard = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Load image safely with timeout
  function loadImage(src, timeoutMs = 4000) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; resolve(null); }
      }, timeoutMs);

      img.onload = () => {
        if (!done) { done = true; clearTimeout(timer); resolve(img); }
      };
      img.onerror = () => {
        if (!done) { done = true; clearTimeout(timer); resolve(null); }
      };
      img.src = src;
    });
  }

  // Draw Heart QR Code on Canvas
  async function generateCanvas(data, targetUrl) {
    const coupleData = data || {};
    const partnerName = coupleData.partnerName || 'Mia';
    const creatorName = coupleData.creatorName || 'Alex';
    const slug = coupleData.slug || 'alex-mia';
    const anniversary = coupleData.anniversaryDate || '2024-10-14';

    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://studio402-keepsakes.vercel.app';
    const finalUrl = targetUrl || `${origin}/u/${slug}`;

    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1150;
    const ctx = canvas.getContext('2d');

    // 1. Clean Warm Alabaster Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1000, 1150);

    // Subtle outer card frame
    ctx.strokeStyle = '#F0ECE8';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, 952, 1102);

    // 2. Top Header Typography (US Editorial Natural)
    ctx.save();
    ctx.textAlign = 'center';

    // Subtitle pill
    ctx.fillStyle = '#E63946';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText('OUR TINY PHONE • PRIVATE ARCHIVE', 500, 75);

    // Title
    ctx.fillStyle = '#141115';
    ctx.font = 'ital 52px "Instrument Serif", Georgia, serif';
    ctx.fillText(`for ${partnerName}`, 500, 130);

    ctx.fillStyle = '#71717A';
    ctx.font = '400 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('every little moment led me to you', 500, 160);
    ctx.restore();

    // 3. Heart-Shaped QR Construction
    // Fetch live high-resolution scannable QR Code (ECC Level High = 30% error tolerance)
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(finalUrl)}&color=230-57-70&bgcolor=255-255-255&margin=2&ecc=H`;
    const qrImg = await loadImage(qrApiUrl);

    const centerX = 500;
    const centerY = 560;
    const qrSize = 440; // Diamond QR square size

    // Draw the two heart lobes on top (left lobe & right lobe) with decorative QR pixel modules
    const moduleSize = 16;
    ctx.fillStyle = '#E63946';

    function drawPixel(gx, gy, w = 1, h = 1) {
      ctx.fillRect(gx, gy, w * moduleSize, h * moduleSize);
    }

    // A. Left Heart Lobe Decorative QR Grid
    const leftLobeX = 220;
    const leftLobeY = 250;
    
    // Outer arc of left lobe
    ctx.save();
    ctx.beginPath();
    ctx.arc(360, 410, 170, Math.PI * 0.75, Math.PI * 1.95, false);
    ctx.lineTo(500, 420);
    ctx.closePath();
    ctx.clip();

    // Left lobe QR modules & finder pattern motif
    // Concentric square motif at left top
    ctx.fillRect(250, 290, 7 * moduleSize, 7 * moduleSize);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(250 + moduleSize, 290 + moduleSize, 5 * moduleSize, 5 * moduleSize);
    ctx.fillStyle = '#E63946';
    ctx.fillRect(250 + 2 * moduleSize, 290 + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);

    // Pixel patterns in left lobe
    const leftPixels = [
      [220, 360], [240, 380], [260, 360], [280, 420], [300, 400], [320, 380],
      [360, 270], [380, 270], [400, 270], [420, 290], [380, 310], [400, 330],
      [340, 350], [360, 370], [380, 390], [420, 370], [440, 350], [460, 330],
      [370, 440], [390, 420], [410, 440], [430, 420], [450, 400], [470, 380],
      [240, 430], [260, 450], [280, 470], [300, 490], [320, 510],
      [350, 310], [350, 330], [410, 350], [430, 310], [450, 290], [470, 310],
      [300, 350], [320, 330], [340, 310], [280, 370], [290, 390],
      [420, 450], [440, 430], [460, 450], [480, 430], [470, 460]
    ];
    leftPixels.forEach(([px, py]) => ctx.fillRect(px, py, moduleSize, moduleSize));
    ctx.restore();

    // B. Right Heart Lobe Decorative QR Grid
    ctx.save();
    ctx.beginPath();
    ctx.arc(640, 410, 170, Math.PI * 1.05, Math.PI * 0.25, false);
    ctx.lineTo(500, 420);
    ctx.closePath();
    ctx.clip();

    // Right lobe concentric square motif
    ctx.fillRect(630, 290, 7 * moduleSize, 7 * moduleSize);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(630 + moduleSize, 290 + moduleSize, 5 * moduleSize, 5 * moduleSize);
    ctx.fillStyle = '#E63946';
    ctx.fillRect(630 + 2 * moduleSize, 290 + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);

    // Pixel patterns in right lobe
    const rightPixels = [
      [540, 270], [560, 270], [580, 270], [600, 290], [560, 310], [580, 330],
      [520, 350], [540, 370], [560, 390], [600, 370], [620, 350], [640, 330],
      [510, 440], [530, 420], [550, 440], [570, 420], [590, 400], [610, 380],
      [720, 360], [740, 380], [760, 360], [700, 420], [680, 400], [660, 380],
      [740, 430], [720, 450], [700, 470], [680, 490], [660, 510],
      [530, 310], [550, 330], [590, 350], [610, 310], [630, 290], [650, 310],
      [680, 350], [660, 330], [640, 310], [700, 370], [710, 390],
      [520, 450], [540, 430], [560, 450], [580, 430], [530, 460]
    ];
    rightPixels.forEach(([px, py]) => ctx.fillRect(px, py, moduleSize, moduleSize));
    ctx.restore();

    // C. Center Rotated Diamond QR Code (Scannable Core)
    ctx.save();
    ctx.translate(centerX, centerY + 40);
    ctx.rotate(45 * Math.PI / 180);

    if (qrImg) {
      // Draw actual scannable QR code in diamond orientation
      ctx.drawImage(qrImg, -qrSize / 2, -qrSize / 2, qrSize, qrSize);
    } else {
      // Fallback: draw diamond QR structure
      ctx.fillStyle = '#E63946';
      ctx.fillRect(-qrSize / 2, -qrSize / 2, qrSize, qrSize);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-qrSize / 2 + 16, -qrSize / 2 + 16, qrSize - 32, qrSize - 32);
      ctx.fillStyle = '#E63946';
      // 3 Finder patterns
      const fs = 70;
      ctx.fillRect(-qrSize / 2 + 20, -qrSize / 2 + 20, fs, fs);
      ctx.fillRect(qrSize / 2 - 20 - fs, -qrSize / 2 + 20, fs, fs);
      ctx.fillRect(-qrSize / 2 + 20, qrSize / 2 - 20 - fs, fs, fs);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-qrSize / 2 + 32, -qrSize / 2 + 32, fs - 24, fs - 24);
      ctx.fillRect(qrSize / 2 - 20 - fs + 12, -qrSize / 2 + 32, fs - 24, fs - 24);
      ctx.fillRect(-qrSize / 2 + 32, qrSize / 2 - 20 - fs + 12, fs - 24, fs - 24);
      ctx.fillStyle = '#E63946';
      ctx.fillRect(-qrSize / 2 + 42, -qrSize / 2 + 42, fs - 44, fs - 44);
      ctx.fillRect(qrSize / 2 - 20 - fs + 22, -qrSize / 2 + 42, fs - 44, fs - 44);
      ctx.fillRect(-qrSize / 2 + 42, qrSize / 2 - 20 - fs + 22, fs - 44, fs - 44);
    }
    ctx.restore();

    // 4. Subtle Outer Heart Cutout Mask / Contour (Ensures crisp heart silhouette)
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    // Clear any modules protruding outside the heart silhouette
    // Bottom tip cleanup
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(100, 600);
    ctx.lineTo(500, 920);
    ctx.lineTo(100, 920);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(900, 600);
    ctx.lineTo(500, 920);
    ctx.lineTo(900, 920);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 5. Bottom Instructions (US Minimalist)
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = '#141115';
    ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('scan with phone camera to open', 500, 990);

    const dateFormatted = anniversary ? new Date(anniversary).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'October 14, 2024';
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillText(`since ${dateFormatted} • /u/${slug}`, 500, 1025);

    ctx.fillStyle = '#D4D4D8';
    ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('ourpage loveos', 500, 1060);
    ctx.restore();

    return canvas;
  }

  // Trigger file download
  async function downloadGiftCard(data, targetUrl, customFileName) {
    const coupleData = data || {};
    const partnerName = (coupleData.partnerName || 'Valentine').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = customFileName || `Heart-QR-${partnerName}.png`;

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
    downloadGiftCard,
    generateHeartQRCanvas: generateCanvas,
    downloadHeartQR: downloadGiftCard
  };
});
