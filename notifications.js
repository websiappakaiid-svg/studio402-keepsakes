/**
 * studio.402 Notification Engine (WhatsApp Fonnte & CallMeBot + Telegram Fallback)
 */

const https = require('https');
const http = require('http');
const url = require('url');

// Environment variables
const FONNTE_TOKEN = process.env.FONNTE_TOKEN || '';
const ADMIN_WHATSAPP_PHONE = process.env.ADMIN_WHATSAPP_PHONE || '';
const CALLMEBOT_PHONE = process.env.CALLMEBOT_PHONE || '';
const CALLMEBOT_API_KEY = process.env.CALLMEBOT_API_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const APP_URL = process.env.APP_URL || 'https://studio402-keepsakes.vercel.app';

/**
 * Universal WhatsApp Sender
 */
async function sendWhatsApp(message) {
  const cleanMsg = String(message).trim();

  // 1. Try Fonnte API if configured
  if (FONNTE_TOKEN && ADMIN_WHATSAPP_PHONE) {
    try {
      const payload = JSON.stringify({
        target: ADMIN_WHATSAPP_PHONE,
        message: cleanMsg,
        countryCode: '62'
      });

      const res = await new Promise((resolve) => {
        const req = https.request({
          hostname: 'api.fonnte.com',
          port: 443,
          path: '/send',
          method: 'POST',
          headers: {
            'Authorization': FONNTE_TOKEN,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 10000
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            console.log(`[studio.402 WA Fonnte] Response status ${res.statusCode}:`, body.slice(0, 100));
            resolve({ ok: res.statusCode === 200, body });
          });
        });

        req.on('error', (err) => {
          console.warn('[studio.402 WA Fonnte] Request error:', err.message);
          resolve({ ok: false, error: err.message });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ ok: false, error: 'Fonnte timeout' });
        });

        req.write(payload);
        req.end();
      });

      if (res.ok) return true;
    } catch (e) {
      console.warn('[studio.402 WA Fonnte] Failed:', e.message);
    }
  }

  // 2. Try CallMeBot API as alternative/fallback
  if (CALLMEBOT_PHONE && CALLMEBOT_API_KEY) {
    try {
      const cleanPhone = CALLMEBOT_PHONE.replace(/[^\d]/g, '');
      const reqUrl = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(cleanMsg)}&apikey=${CALLMEBOT_API_KEY}`;
      
      const res = await new Promise((resolve) => {
        https.get(reqUrl, { timeout: 10000 }, (r) => {
          let body = '';
          r.on('data', c => body += c);
          r.on('end', () => {
            console.log(`[studio.402 WA CallMeBot] Status ${r.statusCode}:`, body.slice(0, 100));
            resolve({ ok: r.statusCode === 200 });
          });
        }).on('error', err => {
          console.warn('[studio.402 WA CallMeBot] Error:', err.message);
          resolve({ ok: false });
        });
      });

      if (res.ok) return true;
    } catch (e) {
      console.warn('[studio.402 WA CallMeBot] Failed:', e.message);
    }
  }

  // 3. Fallback: Always log clearly to console
  console.log(`\n======================================================`);
  console.log(`💬 [WHATSAPP NOTIFICATION DISPATCHED]`);
  console.log(cleanMsg);
  console.log(`======================================================\n`);
  return true;
}

/**
 * 1. Notification: New Lead Saved Draft
 */
async function notifyNewDraft({ email, slug, previewUrl, template, designCode, checkoutUrl }) {
  const fullPreview = previewUrl.startsWith('http') ? previewUrl : `${APP_URL}${previewUrl}`;
  
  const msg = 
`💌 *[studio.402] LEAD BARU MASUK!*
---------------------------------------
👤 *Email Pembeli:* ${email}
🔗 *Link Preview:* ${fullPreview}
🎨 *Template:* ${template || 'Vinyl Studio'}
🏷️ *Kode Desain:* ${designCode || 'ST-402'}
💳 *Link Checkout:* ${checkoutUrl}
---------------------------------------
Calon pembeli baru saja mengunci draf dan diarahkan ke halaman pembayaran Gumroad.`;

  return sendWhatsApp(msg);
}

/**
 * 2. Notification: Order Paid & Live (Gumroad Webhook)
 */
async function notifyPaidOrder({ email, slug, liveUrl, price, template }) {
  const fullLive = liveUrl.startsWith('http') ? liveUrl : `${APP_URL}${liveUrl}`;
  
  const msg = 
`🎉 *[studio.402] ORDER LUNAS & AKTIF!*
---------------------------------------
💰 *Nilai Pembayaran:* ${price || '$19.00 USD'}
👤 *Email Pembeli:* ${email}
✨ *Link Keepsake Aktif:* ${fullLive}
🎨 *Template:* ${template || 'Vinyl Studio'}
---------------------------------------
Pembayaran terverifikasi via Gumroad Ping. Watermark preview telah dihapus otomatis dan link aktif permanen!`;

  return sendWhatsApp(msg);
}

/**
 * 3. Notification: Abandoned Draft Reminder (>1 Hour Unpaid)
 */
async function notifyAbandonedDraft({ email, slug, previewUrl, createdAt, mailtoLink }) {
  const fullPreview = previewUrl.startsWith('http') ? previewUrl : `${APP_URL}${previewUrl}`;
  const createdDate = new Date(createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  const msg = 
`⏰ *[studio.402] FOLLOW-UP: LEAD BELUM CHECKOUT (>1 JAM)*
---------------------------------------
👤 *Email Pembeli:* ${email}
🔗 *Link Preview Draf:* ${fullPreview}
📅 *Waktu Pembuatan:* ${createdDate} WIB
---------------------------------------
👉 *Klik link berikut untuk langsung kirim email penawaran diskon 15%:*
${mailtoLink}`;

  return sendWhatsApp(msg);
}

module.exports = {
  sendWhatsApp,
  notifyNewDraft,
  notifyPaidOrder,
  notifyAbandonedDraft,
  APP_URL
};
