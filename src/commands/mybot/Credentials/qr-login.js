import fetch from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs/promises';
import QRCode from 'qrcode';
const cookieJar = new CookieJar();
const fetchWithCookies = fetchCookie(fetch, cookieJar);
function generateZaloUUID() {
  const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  const randomUUID = uuidv4();
  const md5Hash = crypto.createHash('md5').update(userAgent).digest('hex');
  return `${randomUUID}-${md5Hash}`;
}
async function initSession() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "sec-ch-ua": "\"Not-A.Brand\";v=\"99\", \"Chromium\";v=\"124\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Linux\"",
    "origin": "https://chat.zalo.me",
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "Accept-Encoding": "gzip",
    "referer": "https://chat.zalo.me/",
    "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
  };
  const payload = new URLSearchParams({
    'continue': 'https://chat.zalo.me/',
    'v': '5.5.7'
  });

  try {
    const getUrl = `https://id.zalo.me/account?${payload.toString()}`;
    const getResponse = await fetchWithCookies(getUrl, { headers, method: 'GET' });
    if (!getResponse.ok) {
      console.error(`GET /account failed: ${getResponse.status} ${getResponse.statusText}`);
      return null;
    }
    console.log(`Cookies after GET /account: ${getResponse.headers.get('set-cookie') || 'none'}`);

    const postResponse = await fetchWithCookies("https://id.zalo.me/account/logininfo", {
      headers,
      method: 'POST',
      body: payload
    });
    if (!postResponse.ok) {
      console.error(`POST /logininfo failed: ${postResponse.status} ${postResponse.statusText}`);
      return null;
    }
    console.log(`Cookies after POST /logininfo: ${postResponse.headers.get('set-cookie') || 'none'}`);

    return { headers };
  } catch (e) {
    console.error(`Error in initSession: ${e}`);
    return null;
  }
}


async function verifyClient(session) {
  if (!session) return null;
  const veriPayload = new URLSearchParams({
    'type': 'device',
    'continue': 'https://zalo.me/pc',
    'v': '5.5.7'
  });
  const headers = {
    'accept': '*/*',
    'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
    'content-type': 'application/x-www-form-urlencoded',
    'origin': 'https://id.zalo.me',
    'priority': 'u=1, i',
    'referer': 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
    'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  };
  try {
    const response = await fetchWithCookies("https://id.zalo.me/account/verify-client", {
      headers: { ...session.headers, ...headers },
      method: 'POST',
      body: veriPayload
    });
    if (!response.ok) {
      console.error(`POST /verify-client failed: ${response.status} ${response.statusText}`);
      return null;
    }
    console.log(`Cookies after POST /verify-client: ${response.headers.get('set-cookie') || 'none'}`);
    return session;
  } catch (e) {
    console.error(`Error in verifyClient: ${e}`);
    return null;
  }
}


async function generateQRCode(session) {
  if (!session) return [false, null];
  const payload = new URLSearchParams({
    'continue': 'https://zalo.me/pc',
    'v': '5.5.7'
  });
  const headers = {
    'accept': '*/*',
    'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
    'content-type': 'application/x-www-form-urlencoded',
    'origin': 'https://id.zalo.me',
    'priority': 'u=1, i',
    'referer': 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
    'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  };
  const maxRetries = 3;
  let retries = 0;
  let currentSession = session;

  while (retries < maxRetries) {
    try {
      const response = await fetchWithCookies("https://id.zalo.me/account/authen/qr/generate", {
        headers: { ...currentSession.headers, ...headers },
        method: 'POST',
        body: payload
      });
      if (!response.ok) {
        console.error(`POST /qr/generate failed: ${response.status} ${response.statusText}`);
        const responseText = await response.text();
        console.error(`Response body: ${responseText}`);
        retries++;
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (responseText.includes('-1003')) {
          console.log('Received -1003 error, refreshing session...');
          currentSession = await initSession();
          if (!currentSession) {
            console.error('Failed to refresh session');
            return [false, null];
          }
          currentSession = await verifyClient(currentSession);
          if (!currentSession) {
            console.error('Failed to verify client after refresh');
            return [false, null];
          }
        }
        continue;
      }
      const data = await response.json();
      console.log(`QR generate response: ${JSON.stringify(data)}`);
      if (!data || !data.data || !data.data.image) {
        console.error(`Invalid QR code response: ${JSON.stringify(data)}`);
        if (data?.error_code === -1003) {
          console.log('Received -1003 error, refreshing session...');
          currentSession = await initSession();
          if (!currentSession) {
            console.error('Failed to refresh session');
            return [false, null];
          }
          currentSession = await verifyClient(currentSession);
          if (!currentSession) {
            console.error('Failed to verify client after refresh');
            return [false, null];
          }
          retries++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return [false, currentSession];
      }
      const qrCode = data.data.image;
      const code = data.data.code;
      const qrCodeData = qrCode.replace("data:image/png;base64,", "");
      const qrCodeBytes = Buffer.from(qrCodeData, 'base64');
      await fs.writeFile(".cache/qr_code.png", qrCodeBytes);
      console.log(`QR Code: ${code}`);
      return [code, currentSession];
    } catch (e) {
      console.error(`Error in generateQRCode: ${e}`);
      retries++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Error occurred, refreshing session...');
      currentSession = await initSession();
      if (!currentSession) {
        console.error('Failed to refresh session');
        return [false, null];
      }
      currentSession = await verifyClient(currentSession);
      if (!currentSession) {
        console.error('Failed to verify client after refresh');
        return [false, null];
      }
    }
  }
  console.error(`Failed to generate QR code after ${maxRetries} retries`);
  return [false, currentSession];
}


async function checkSession(session) {
  if (!session) return null;
  const headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "priority": "u=0, i",
    "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "upgrade-insecure-requests": "1",
    "Referer": "https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  try {
    const response = await fetchWithCookies("https://id.zalo.me/account/checksession?continue=https%3A%2F%2Fchat.zalo.me%2Findex.html", {
      headers: { ...session.headers, ...headers }
    });
    if (!response.ok) {
      console.error(`GET /checksession failed: ${response.status} ${response.statusText}`);
    }
    return response;
  } catch (e) {
    console.error(`Error checking session: ${e}`);
    return null;
  }
}


async function getUserInfo(session) {
  if (!session) return null;
  const headers = {
    "accept": "*/*",
    "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "priority": "u=1, i",
    "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "Referer": "https://chat.zalo.me/",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  try {
    const response = await fetchWithCookies("https://jr.chat.zalo.me/jr/userinfo", {
      headers: { ...session.headers, ...headers }
    });
    if (!response.ok) {
      console.error(`GET /userinfo failed: ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json();
  } catch (e) {
    console.error(`Error getting user info: ${e}`);
    return null;
  }
}


async function waitingConfirm(code, session) {
  if (!session || !code) return [null, null];
  const confirmPayload = new URLSearchParams({
    'code': code,
    'gToken': '',
    'gAction': 'CONFIRM_QR',
    'continue': 'https://chat.zalo.me/index.html',
    'v': '5.5.7',
  });
  const headers = {
    'accept': '*/*',
    'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
    'content-type': 'application/x-www-form-urlencoded',
    'origin': 'https://id.zalo.me',
    'priority': 'u=1, i',
    'referer': 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
    'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  };
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetchWithCookies("https://id.zalo.me/account/authen/qr/waiting-confirm", {
        headers: { ...session.headers, ...headers },
        method: 'POST',
        body: confirmPayload,
      });
      const statusData = await response.json();
      console.log(`Confirm response: ${JSON.stringify(statusData)}`);
      await checkSession(session);
      if (statusData.error_code === 0) {
        console.log("Login confirm successfully!");
        const imei = generateZaloUUID();
        const domains = ['https://chat.zalo.me', 'https://zalo.me', 'https://id.zalo.me', 'https://baomoi.com', 'https://zaloapp.com', 'https://zingmp3.vn'];
        let allCookies = [];
        for (const domain of domains) {
          const cookies = await cookieJar.getCookies(domain);
          allCookies = allCookies.concat(cookies);
        }
        console.log(`Cookies in waitingConfirm: ${JSON.stringify(allCookies, null, 2)}`);
        const zpwSekCookie = allCookies.find(cookie => cookie.key === 'zpw_sek')?.value || '';
        const data = {
          prefix: '?',
          imei,
          cookie: { zpw_sek: zpwSekCookie },
          active: false,
        };
        const rawCookies = {
          url: 'https://chat.zalo.me',
          cookies: allCookies.map(cookie => ({
            domain: cookie.domain,
            expirationDate: cookie.expires instanceof Date && !isNaN(cookie.expires.getTime()) ? Math.floor(cookie.expires.getTime() / 1000) : null,
            hostOnly: !cookie.domain.startsWith('.'),
            httpOnly: cookie.httpOnly,
            name: cookie.key,
            path: cookie.path,
            sameSite: cookie.sameSite || 'unspecified',
            secure: cookie.secure,
            session: !cookie.expires,
            storeId: '0',
            value: cookie.value
          }))
        };
        return [data, rawCookies];
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    } catch (e) {
      console.error(`Error in waitingConfirm: ${e}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
  }
  console.log("Maximum attempts reached. QR code may have expired.");
  return [null, null];
}


async function waitingScan(code, session) {
  if (!session || !code) return false;
  const checkPayload = new URLSearchParams({
    'code': code,
    'continue': 'https://chat.zalo.me/',
    'v': '5.5.7'
  });
  const headers = {
    'accept': '*/*',
    'accept-language': 'vi,en-US;q=0.9,en;q=0.8,fr-FR;q=0.7,fr;q=0.6',
    'content-type': 'application/x-www-form-urlencoded',
    'origin': 'https://id.zalo.me',
    'priority': 'u=1, i',
    'referer': 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
    'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  };
  console.log("Waiting for QR code scan...");
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetchWithCookies("https://id.zalo.me/account/authen/qr/waiting-scan", {
        headers: { ...session.headers, ...headers },
        method: 'POST',
        body: checkPayload,
      });
      const statusData = await response.json();
      console.log(`Scan response: ${JSON.stringify(statusData)}`);
      if (statusData.data && statusData.data.data) {
        console.log("Chưa quét QR code");
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
        continue;
      }
      console.log("Đã quét QR code");
      return true;
    } catch (e) {
      console.error(`Error in waitingScan: ${e}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
  }
  console.log("Maximum attempts reached. QR code may have expired.");
  return false;
}


async function authenticateZalo() {
  let session = await initSession();
  if (!session) {
    console.log("Failed to initialize session");
    return [null, null];
  }

  session = await verifyClient(session);
  if (!session) {
    console.log("Failed to verify client");
    return [null, null];
  }

  const [code, updatedSession] = await generateQRCode(session);
  session = updatedSession;
  if (!code) {
    console.log("Failed to generate QR code");
    return [null, null];
  }

  const result = await waitingScan(code, session);
  if (!result) {
    console.log("Login Failed: QR code scan not completed");
    return [null, null];
  }

  const [resultData, rawCookies] = await waitingConfirm(code, session);
  if (resultData) {
    console.log("Authentication successful!");
    console.log("IMEI:", resultData.imei);
    console.log("Raw Cookies:", JSON.stringify(rawCookies, null, 0));
    const userInfo = await getUserInfo(session);
    if (userInfo) {
      console.log(`User info: ${JSON.stringify(userInfo)}`);
    }
    return [session, rawCookies];
  }

  console.log("Login Failed: QR code confirmation not completed");
  return [null, null];
}

export { authenticateZalo, initSession, verifyClient, generateQRCode, waitingScan, waitingConfirm, getUserInfo };