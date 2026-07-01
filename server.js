const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'match-code-payment' });
});

const merchantPA = process.env.MERCHANT_PA || '6383617697@fam';
const merchantName = process.env.MERCHANT_NAME || 'Match Code Digital';
const amount = process.env.PRODUCT_AMOUNT || '19.00';
const currency = 'INR';
const note = process.env.PRODUCT_NOTE || '100+ Premium Lightroom Presets';
const downloadRedirectUrl = process.env.DOWNLOAD_URL || 'https://drive.google.com/file/d/16Rax3I-RVXKZg-XFgcAkoaiA0hlESSJ-/view';

const adminUser = {
  username: process.env.ADMIN_USERNAME || 'ADMIN',
  password: process.env.ADMIN_PASSWORD || 'marsh'
};

const sessions = new Map();
const authCookieName = 'adminAuth';

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'orders.json');

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ orders: [], stats: { paymentsVerified: 0, downloads: 0 } }, null, 2));
  }
}

function loadDatabase() {
  ensureDataStore();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    stats: parsed.stats || { paymentsVerified: 0, downloads: 0 }
  };
}

function saveDatabase(orders, stats) {
  ensureDataStore();
  fs.writeFileSync(DB_FILE, JSON.stringify({ orders: Array.from(orders.values()), stats }, null, 2));
}

const db = loadDatabase();
const orders = new Map(db.orders.map(order => [order.orderId, order]));
const stats = {
  paymentsVerified: Number(db.stats.paymentsVerified || 0),
  downloads: Number(db.stats.downloads || 0)
};

function persistState() {
  saveDatabase(orders, stats);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((cookies, pair) => {
    const [name, ...rest] = pair.trim().split('=');
    if (!name) return cookies;
    cookies[name] = rest.join('=');
    return cookies;
  }, {});
}

function getAuthToken(req) {
  const cookies = parseCookies(req);
  return cookies[authCookieName] || null;
}

function authMiddleware(req, res, next) {
  const token = getAuthToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
  }
  next();
}

function generateId(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

function createUpiUri(orderId) {
  const params = new URLSearchParams({
    pa: merchantPA,
    pn: merchantName,
    tn: note,
    am: amount,
    cu: currency,
    tr: orderId
  });
  return `upi://pay?${params.toString()}`;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.socket.remoteAddress ||
         'Unknown';
}

function parseUserAgent(userAgent) {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };

  const ua = userAgent.toLowerCase();
  let browser = 'Unknown', os = 'Unknown', device = 'Unknown';

  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';

  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) device = 'Mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) device = 'Tablet';
  else device = 'Desktop';

  return { browser, os, device };
}

async function getGeolocation(ip) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,isp`).catch(() => null);
    if (response && response.ok) {
      const data = await response.json();
      return {
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
        isp: data.isp || 'Unknown'
      };
    }
  } catch (e) {
    // Geolocation is optional, so failures are ignored.
  }
  return { country: 'Unknown', city: 'Unknown', isp: 'Unknown' };
}

app.post('/api/create-payment', (req, res) => {
  const orderId = generateId(8);
  const token = generateId(12);
  const expiresAt = Date.now() + 15 * 60 * 1000;

  const order = {
    orderId,
    token,
    amount,
    note,
    verified: false,
    downloadCount: 0,
    createdAt: Date.now(),
    expiresAt,
    accessEvents: []
  };

  orders.set(orderId, order);
  persistState();

  return res.json({
    success: true,
    orderId,
    upiUri: createUpiUri(orderId),
    amount,
    note,
    expiresAt
  });
});

app.post('/api/verify-payment', async (req, res) => {
  const { orderId, transactionRef, email } = req.body;

  if (!orderId || !transactionRef) {
    return res.status(400).json({ success: false, message: 'orderId and transactionRef are required.' });
  }

  const order = orders.get(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }

  if (Date.now() > order.expiresAt) {
    return res.status(410).json({ success: false, message: 'Payment session expired. Please create a new payment request.' });
  }

  if (order.verified) {
    return res.json({
      success: true,
      message: 'Payment already verified.',
      downloadUrl: `/download/${orderId}?token=${order.token}`,
      stats
    });
  }

  if (typeof transactionRef !== 'string' || transactionRef.trim().length < 4) {
    return res.status(400).json({ success: false, message: 'Enter a valid transaction reference or UPI ID.' });
  }

  let validEmail = null;
  if (email && typeof email === 'string' && email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email.trim())) {
      validEmail = email.trim().toLowerCase();
    }
  }

  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const deviceInfo = parseUserAgent(userAgent);
  const geolocation = await getGeolocation(clientIP);
  const verificationTime = Date.now();
  const timeToVerify = verificationTime - order.createdAt;

  order.verified = true;
  order.verifiedAt = verificationTime;
  order.transactionRef = transactionRef.trim();
  order.email = validEmail;
  order.clientIP = clientIP;
  order.userAgent = userAgent;
  order.deviceInfo = deviceInfo;
  order.geolocation = geolocation;
  order.timeToVerifyMs = timeToVerify;
  order.timeToVerifyMin = Math.round(timeToVerify / 60000 * 10) / 10;
  order.accessEvents = order.accessEvents || [];
  order.accessEvents.push({
    type: 'payment_verified',
    at: verificationTime,
    ip: clientIP,
    userAgent
  });

  orders.set(orderId, order);
  stats.paymentsVerified += 1;
  persistState();

  return res.json({
    success: true,
    message: 'Payment verification accepted. You may now download your presets.',
    downloadUrl: `/download/${orderId}?token=${order.token}`,
    stats
  });
});

app.get('/download/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { token } = req.query;

  const order = orders.get(orderId);
  if (!order || !token || token !== order.token) {
    return res.status(403).send('Unauthorized download request.');
  }

  if (!order.verified) {
    return res.status(402).send('Payment not verified yet.');
  }

  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  order.downloadCount += 1;
  order.lastDownloadAt = Date.now();
  order.lastDownloadIP = clientIP;
  order.accessEvents = order.accessEvents || [];
  order.accessEvents.push({
    type: 'downloaded',
    at: Date.now(),
    ip: clientIP,
    userAgent
  });
  orders.set(orderId, order);
  stats.downloads += 1;
  persistState();

  return res.redirect(downloadRedirectUrl);
});

app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username !== adminUser.username || password !== adminUser.password) {
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { createdAt: Date.now() });
  res.setHeader('Set-Cookie', `${authCookieName}=${token}; HttpOnly; Path=/; SameSite=Lax`);

  return res.json({ success: true, message: 'Login successful.' });
});

app.post('/api/admin-logout', authMiddleware, (req, res) => {
  const token = getAuthToken(req);
  if (token) {
    sessions.delete(token);
  }
  res.setHeader('Set-Cookie', `${authCookieName}=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`);
  return res.json({ success: true, message: 'Logged out.' });
});

app.get('/api/stats', authMiddleware, (req, res) => {
  return res.json({
    success: true,
    stats: {
      paymentsVerified: stats.paymentsVerified,
      downloads: stats.downloads,
      activeOrders: orders.size
    }
  });
});

app.get('/api/orders', authMiddleware, (req, res) => {
  const orderList = Array.from(orders.values()).map(order => ({
    orderId: order.orderId,
    verified: order.verified,
    transactionRef: order.transactionRef || null,
    downloadCount: order.downloadCount,
    createdAt: order.createdAt,
    verifiedAt: order.verifiedAt || null,
    expiresAt: order.expiresAt,
    email: order.email || null,
    clientIP: order.clientIP || null,
    deviceInfo: order.deviceInfo || { browser: 'Unknown', os: 'Unknown', device: 'Unknown' },
    geolocation: order.geolocation || { country: 'Unknown', city: 'Unknown', isp: 'Unknown' },
    timeToVerifyMin: order.timeToVerifyMin || null,
    userAgent: order.userAgent || null,
    lastDownloadAt: order.lastDownloadAt || null,
    lastDownloadIP: order.lastDownloadIP || null,
    accessEvents: order.accessEvents || []
  }));

  return res.json({
    success: true,
    orders: orderList
  });
});

app.get('/admin', authMiddleware, (req, res) => {
  return res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', authMiddleware, (req, res) => {
  return res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(path.join(__dirname, '.')));

function startServer() {
  return app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Open index.html through the server or use the browser to visit the page after starting the backend.');
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
