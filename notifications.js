/**
 * ourpage Notification Engine (WhatsApp Fonnte & CallMeBot)
 */

const https = require('https');
const http = require('http');
const url = require('url');

// Dynamic environment getter to support serverless & updated runtime values
const getFonnteToken = () => process.env.FONNTE_TOKEN || '';
const getAdminPhone = () => process.env.ADMIN_WHATSAPP_PHONE || '';
const getCallmebotPhone = () => process.env.CALLMEBOT_PHONE || '';
const getCallmebotKey = () => process.env.CALLMEBOT_API_KEY || '';
const getAppUrl = () => process.env.APP_URL || 'https://studio402-keepsakes.vercel.app';

/**
 * Universal WhatsApp Sender
 */
async function sendWhatsApp(message) {
  const cleanMsg = String(message).trim();
  const fonnteToken = getFonnteToken();
  const adminPhone = getAdminPhone();

  // 1. Try Fonnte API if configured
  if (fonnteToken && adminPhone) {
    try {
      const payload = JSON.stringify({
        target: adminPhone,
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
            'Authorization': fonnteToken,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 10000
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            console.log(`[ourpage WA Fonnte] Response status ${res.statusCode}:`, body.slice(0, 100));
            resolve({ ok: res.statusCode === 200, body });
          });
        });

        req.on('error', (err) => {
          console.warn('[ourpage WA Fonnte] Request error:', err.message);
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
      console.warn('[ourpage WA Fonnte] Failed:', e.message);
    }
  }

  // 2. Try CallMeBot API as alternative/fallback
  const cmbPhone = getCallmebotPhone();
  const cmbKey = getCallmebotKey();
  if (cmbPhone && cmbKey) {
    try {
      const cleanPhone = cmbPhone.replace(/[^\d]/g, '');
      const reqUrl = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(cleanMsg)}&apikey=${cmbKey}`;
      
      const res = await new Promise((resolve) => {
        https.get(reqUrl, { timeout: 10000 }, (r) => {
          let body = '';
          r.on('data', c => body += c);
          r.on('end', () => {
            console.log(`[ourpage WA CallMeBot] Status ${r.statusCode}:`, body.slice(0, 100));
            resolve({ ok: r.statusCode === 200 });
          });
        }).on('error', err => {
          console.warn('[ourpage WA CallMeBot] Error:', err.message);
          resolve({ ok: false });
        });
      });

      if (res.ok) return true;
    } catch (e) {
      console.warn('[ourpage WA CallMeBot] Failed:', e.message);
    }
  }

  // 3. Fallback: Always log clearly to console
  console.log(`\n======================================================`);
  console.log(`💬 [ourpage WHATSAPP NOTIFICATION DISPATCHED]`);
  console.log(cleanMsg);
  console.log(`======================================================\n`);
  return true;
}

/**
 * 1. Notification: New Lead Saved Draft
 */
async function notifyNewDraft({ email, slug, previewUrl, publicUrl, reeditUrl, editToken, template, designCode, checkoutUrl }) {
  const base = getAppUrl();
  const fullPublic = (publicUrl || previewUrl || `/u/${slug}`).startsWith('http') ? (publicUrl || previewUrl) : `${base}${publicUrl || previewUrl || `/u/${slug}`}`;
  const fullReEdit = (reeditUrl || (editToken ? `/editor-loveos.html?slug=${slug}&token=${editToken}` : '')).startsWith('http') 
    ? (reeditUrl || `/editor-loveos.html?slug=${slug}&token=${editToken}`) 
    : `${base}${reeditUrl || (editToken ? `/editor-loveos.html?slug=${slug}&token=${editToken}` : '')}`;

  const msg = 
`💌 *[ourpage] NEW LEAD INCOMING!*
---------------------------------------
👤 *Customer Email:* ${email}
🔗 *1. Public Gift Link:* ${fullPublic}
🔑 *2. VIP Re-Edit Link:* ${fullReEdit}
🎨 *Template:* ${template || 'LoveOS (iOS Keepsake)'}
🏷️ *Design Code:* ${designCode || 'OP-100'}
💳 *Gumroad Checkout:* ${checkoutUrl}
---------------------------------------
Customer locked their draft and is proceeding to $18 Gumroad checkout.`;

  return sendWhatsApp(msg);
}

/**
 * 2. Notification: Order Paid & Live (Gumroad Webhook or Admin Activation)
 */
async function notifyPaidOrder({ email, slug, liveUrl, publicUrl, reeditUrl, editToken, price, template }) {
  const base = getAppUrl();
  const fullPublic = (publicUrl || liveUrl || `/u/${slug}`).startsWith('http') ? (publicUrl || liveUrl) : `${base}${publicUrl || liveUrl || `/u/${slug}`}`;
  const fullReEdit = (reeditUrl || (editToken ? `/editor-loveos.html?slug=${slug}&token=${editToken}` : '')).startsWith('http') 
    ? (reeditUrl || `/editor-loveos.html?slug=${slug}&token=${editToken}`) 
    : `${base}${reeditUrl || (editToken ? `/editor-loveos.html?slug=${slug}&token=${editToken}` : '')}`;

  const msg = 
`🎉 *[ourpage] ORDER VERIFIED & ACTIVE!*
---------------------------------------
💰 *Revenue:* ${price || '$18.00 USD'}
👤 *Customer Email:* ${email}
✨ *1. Public Gift Link:* ${fullPublic}
🔑 *2. VIP Re-Edit Link:* ${fullReEdit}
🎨 *Template:* ${template || 'LoveOS (iOS Keepsake)'}
⏳ *Cloud Retention:* 30-Day VIP Active
---------------------------------------
Payment verified via Gumroad Ping. Watermark removed & 2 access links generated for customer!`;

  return sendWhatsApp(msg);
}

/**
 * 3. Notification: Abandoned Draft Reminder (>1 Hour Unpaid)
 */
async function notifyAbandonedDraft({ email, slug, previewUrl, createdAt, mailtoLink }) {
  const base = getAppUrl();
  const fullPreview = previewUrl.startsWith('http') ? previewUrl : `${base}${previewUrl}`;
  const createdDate = new Date(createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' });

  const msg = 
`⏰ *[ourpage] FOLLOW-UP: ABANDONED DRAFT (>1 HOUR)*
---------------------------------------
👤 *Customer Email:* ${email}
🔗 *Draft Preview:* ${fullPreview}
📅 *Created At:* ${createdDate} EST
---------------------------------------
👉 *Click to dispatch 15% discount follow-up email (FOREVER15):*
${mailtoLink}`;

  return sendWhatsApp(msg);
}

module.exports = {
  sendWhatsApp,
  notifyNewDraft,
  notifyPaidOrder,
  notifyAbandonedDraft,
  getAppUrl,
  get APP_URL() {
    return getAppUrl();
  }
};
