const crypto = require('./crypto');
const db = require('./db');

// Compile message templates by replacing placeholders with visit/patient data
function compileTemplate(templateText, variables = {}) {
  if (!templateText) return '';
  let text = templateText;
  for (const [key, val] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    text = text.replace(new RegExp(placeholder, 'g'), val || '');
  }
  return text;
}

// Unified WhatsApp Provider Interface
class BaseWhatsAppProvider {
  constructor(config) {
    this.config = config;
  }
  async testConnection() {
    throw new Error('testConnection() not implemented');
  }
  async sendMessage(to, text) {
    throw new Error('sendMessage() not implemented');
  }
  async sendDocument(to, pdfBuffer, filename, caption) {
    throw new Error('sendDocument() not implemented');
  }
}

// Meta WhatsApp Cloud API Provider
class MetaProvider extends BaseWhatsAppProvider {
  async testConnection() {
    const accessToken = crypto.decrypt(this.config.whatsappAccessToken);
    const phoneId = this.config.whatsappPhoneNumberId;
    if (!accessToken || !phoneId) {
      throw new Error('Access Token and Phone Number ID are required.');
    }
    
    // Call Graph API to fetch phone number details
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Meta Cloud API connection test failed.');
    }
    return true;
  }

  async sendMessage(to, text) {
    const accessToken = crypto.decrypt(this.config.whatsappAccessToken);
    const phoneId = this.config.whatsappPhoneNumberId;
    
    const cleanPhone = to.replace(/[^0-9]/g, '');
    
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: text }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to send Meta WhatsApp text.');
    }
    return data;
  }

  async sendDocument(to, pdfBuffer, filename, caption) {
    const accessToken = crypto.decrypt(this.config.whatsappAccessToken);
    const phoneId = this.config.whatsappPhoneNumberId;
    const cleanPhone = to.replace(/[^0-9]/g, '');

    // 1. Upload media to Meta to get media_id
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    // Construct multi-part form data body manually to avoid external libraries
    const headerStr = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`;
    const footerStr = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n--${boundary}--`;
    
    const headerBuffer = Buffer.from(headerStr, 'utf8');
    const footerBuffer = Buffer.from(footerStr, 'utf8');
    const multipartBody = Buffer.concat([headerBuffer, pdfBuffer, footerBuffer]);

    const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: multipartBody
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadData.error?.message || 'Failed to upload PDF media to Meta Cloud.');
    }

    const mediaId = uploadData.id;

    // 2. Send document message using media_id
    const sendRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'document',
        document: {
          id: mediaId,
          filename: filename,
          caption: caption
        }
      })
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      throw new Error(sendData.error?.message || 'Failed to send Meta WhatsApp document.');
    }
    return sendData;
  }
}

// WATI Provider
class WatiProvider extends BaseWhatsAppProvider {
  async testConnection() {
    const apiEndpoint = this.config.watiApiEndpoint || 'https://live-server.wati.io'; // example endpoint
    const accessToken = crypto.decrypt(this.config.whatsappAccessToken);
    if (!accessToken) {
      throw new Error('Access Token is required.');
    }

    // Call WATI API status endpoint
    const res = await fetch(`${apiEndpoint}/api/v1/getContacts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!res.ok) {
      throw new Error('WATI API connection test failed. Verify Endpoint and Token.');
    }
    return true;
  }

  async sendMessage(to, text) {
    const apiEndpoint = this.config.watiApiEndpoint || 'https://live-server.wati.io';
    const accessToken = crypto.decrypt(this.config.whatsappAccessToken);
    const cleanPhone = to.replace(/[^0-9]/g, '');

    const res = await fetch(`${apiEndpoint}/api/v1/sendSessionMessage/${cleanPhone}?messageText=${encodeURIComponent(text)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await res.json();
    if (!res.ok || data.result === 'error') {
      throw new Error(data.info || 'Failed to send WATI message.');
    }
    return data;
  }

  async sendDocument(to, pdfBuffer, filename, caption) {
    // WATI Document sending requires sending a public URL or base64.
    // For local SQLite setup, we can simulate or upload it if WATI base64 upload is available.
    const apiEndpoint = this.config.watiApiEndpoint || 'https://live-server.wati.io';
    const accessToken = crypto.decrypt(this.config.whatsappAccessToken);
    const cleanPhone = to.replace(/[^0-9]/g, '');

    const base64Data = pdfBuffer.toString('base64');

    const res = await fetch(`${apiEndpoint}/api/v1/sendSessionFile/${cleanPhone}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileBase64: `data:application/pdf;base64,${base64Data}`,
        fileName: filename,
        caption: caption
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.info || 'Failed to send WATI document.');
    }
    return data;
  }
}

// Twilio Provider
class TwilioProvider extends BaseWhatsAppProvider {
  async testConnection() {
    const accountSid = this.config.whatsappBusinessAccountId; // mapped to Twilio Account SID
    const authToken = crypto.decrypt(this.config.whatsappAccessToken); // mapped to Twilio Auth Token
    
    if (!accountSid || !authToken) {
      throw new Error('Account SID and Auth Token are required.');
    }

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64')
      }
    });

    if (!res.ok) {
      throw new Error('Twilio connection test failed.');
    }
    return true;
  }

  async sendMessage(to, text) {
    const accountSid = this.config.whatsappBusinessAccountId;
    const authToken = crypto.decrypt(this.config.whatsappAccessToken);
    const from = this.config.whatsappPhoneNumberId; // mapped to Twilio WhatsApp sender number
    
    const cleanPhone = to.replace(/[^0-9]/g, '');
    const cleanFrom = from.replace(/[^0-9]/g, '');

    const bodyParams = new URLSearchParams({
      To: `whatsapp:+${cleanPhone}`,
      From: `whatsapp:+${cleanFrom}`,
      Body: text
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString()
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to send Twilio message.');
    }
    return data;
  }

  async sendDocument(to, pdfBuffer, filename, caption) {
    // Twilio media messaging requires hosting the file on a public URL.
    // For standalone offline deployment, we fall back to a text summary + simulated document link.
    const mockPublicUrl = `http://localhost:${process.env.PORT || 5000}/api/prescriptions/download-pdf-temp/${filename}`;
    return this.sendMessage(to, `${caption}\nPrescription PDF: ${mockPublicUrl}`);
  }
}

// 360Dialog Provider
class ThreeSixtyDialogProvider extends BaseWhatsAppProvider {
  async testConnection() {
    const apiEndpoint = this.config.threeSixtyApiEndpoint || 'https://waba.360dialog.io';
    const apiKey = crypto.decrypt(this.config.whatsappAccessToken);
    if (!apiKey) {
      throw new Error('API Key is required.');
    }

    const res = await fetch(`${apiEndpoint}/v1/configs/webhook`, {
      method: 'GET',
      headers: {
        'D360-API-KEY': apiKey
      }
    });

    if (!res.ok) {
      throw new Error('360Dialog connection test failed.');
    }
    return true;
  }

  async sendMessage(to, text) {
    const apiEndpoint = this.config.threeSixtyApiEndpoint || 'https://waba.360dialog.io';
    const apiKey = crypto.decrypt(this.config.whatsappAccessToken);
    const cleanPhone = to.replace(/[^0-9]/g, '');

    const res = await fetch(`${apiEndpoint}/v1/messages`, {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: text }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors?.[0]?.title || 'Failed to send 360Dialog message.');
    }
    return data;
  }

  async sendDocument(to, pdfBuffer, filename, caption) {
    // Requires uploading media using their media endpoint first
    const apiEndpoint = this.config.threeSixtyApiEndpoint || 'https://waba.360dialog.io';
    const apiKey = crypto.decrypt(this.config.whatsappAccessToken);
    const cleanPhone = to.replace(/[^0-9]/g, '');

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const headerStr = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`;
    const footerStr = `\r\n--${boundary}--`;
    
    const headerBuffer = Buffer.from(headerStr, 'utf8');
    const footerBuffer = Buffer.from(footerStr, 'utf8');
    const multipartBody = Buffer.concat([headerBuffer, pdfBuffer, footerBuffer]);

    const uploadRes = await fetch(`${apiEndpoint}/v1/media`, {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: multipartBody
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadData.errors?.[0]?.title || 'Failed to upload media to 360Dialog.');
    }

    const mediaId = uploadData.media?.[0]?.id;

    const res = await fetch(`${apiEndpoint}/v1/messages`, {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'document',
        document: {
          id: mediaId,
          filename: filename,
          caption: caption
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors?.[0]?.title || 'Failed to send 360Dialog document.');
    }
    return data;
  }
}

// Custom HTTP POST WhatsApp Provider
class CustomProvider extends BaseWhatsAppProvider {
  async testConnection() {
    const apiUrl = this.config.whatsappApiUrl;
    if (!apiUrl) {
      throw new Error('Custom API URL is required.');
    }
    return true;
  }

  async sendMessage(to, text) {
    const apiUrl = this.config.whatsappApiUrl;
    if (!apiUrl) {
      throw new Error('Custom API URL is required.');
    }

    const cleanPhone = to.replace(/[^0-9]/g, '');
    let headers = {
      'Content-Type': 'application/json'
    };
    if (this.config.whatsappApiHeaders) {
      try {
        headers = { ...headers, ...JSON.parse(this.config.whatsappApiHeaders) };
      } catch (e) {
        console.error('Failed to parse Custom WhatsApp API headers:', e);
      }
    }

    let bodyStr = JSON.stringify({
      to: cleanPhone,
      message: text
    });

    if (this.config.whatsappApiBody) {
      bodyStr = this.config.whatsappApiBody
        .replace(/{to}/g, cleanPhone)
        .replace(/{message}/g, JSON.stringify(text).slice(1, -1));
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: bodyStr
    });

    const data = await res.text();
    if (!res.ok) {
      throw new Error(`Custom API returned status ${res.status}: ${data}`);
    }
    return data;
  }

  async sendDocument(to, pdfBuffer, filename, caption) {
    const apiUrl = this.config.whatsappApiUrl;
    if (!apiUrl) {
      throw new Error('Custom API URL is required.');
    }

    const cleanPhone = to.replace(/[^0-9]/g, '');
    const base64Data = pdfBuffer.toString('base64');

    let headers = {
      'Content-Type': 'application/json'
    };
    if (this.config.whatsappApiHeaders) {
      try {
        headers = { ...headers, ...JSON.parse(this.config.whatsappApiHeaders) };
      } catch (e) {
        console.error('Failed to parse Custom WhatsApp API headers:', e);
      }
    }

    if (this.config.whatsappApiBody && this.config.whatsappApiBody.includes('{pdf_base64}')) {
      const bodyStr = this.config.whatsappApiBody
        .replace(/{to}/g, cleanPhone)
        .replace(/{message}/g, JSON.stringify(caption).slice(1, -1))
        .replace(/{pdf_base64}/g, base64Data)
        .replace(/{filename}/g, filename);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: bodyStr
      });

      const data = await res.text();
      if (!res.ok) {
        throw new Error(`Custom API returned status ${res.status}: ${data}`);
      }
      return data;
    } else {
      // Fallback: Send message text with temporary download URL
      const mockPublicUrl = `http://localhost:${process.env.PORT || 5000}/api/prescriptions/download-pdf-temp/${filename}`;
      return this.sendMessage(to, `${caption}\nPrescription PDF: ${mockPublicUrl}`);
    }
  }
}

// WaSender API Provider
class WasenderProvider extends BaseWhatsAppProvider {
  async testConnection() {
    const accessToken = crypto.decrypt(this.config.whatsappAccessToken);
    if (!accessToken) {
      throw new Error('Access Token is required.');
    }
    return true; // Simplified connection test
  }

  async sendMessage(to, text) {
    const accessToken = crypto.decrypt(this.config.whatsappAccessToken);
    if (!accessToken) {
      throw new Error('Access Token is required.');
    }
    const cleanPhone = to.replace(/[^0-9]/g, '');

    const res = await fetch('https://www.wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: cleanPhone,
        text: text
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to send WaSender message.');
    }
    return data;
  }

  async sendDocument(to, pdfBuffer, filename, caption) {
    const accessToken = crypto.decrypt(this.config.whatsappAccessToken);
    if (!accessToken) {
      throw new Error('Access Token is required.');
    }
    const cleanPhone = to.replace(/[^0-9]/g, '');

    // 1. Upload the PDF file to WaSender to get a temporary public URL
    const uploadRes = await fetch('https://www.wasenderapi.com/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/pdf'
      },
      body: pdfBuffer
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadData.message || uploadData.error || 'Failed to upload document to WaSender.');
    }

    const fileUrl = uploadData.url || (uploadData.data && uploadData.data.url);
    if (!fileUrl) {
      throw new Error('Failed to retrieve uploaded file URL from WaSender response.');
    }

    // 2. Send the document message using the uploaded file URL
    const res = await fetch('https://www.wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: cleanPhone,
        text: caption,
        documentUrl: fileUrl,
        fileName: filename
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to send WaSender document.');
    }
    return data;
  }
}

// Service Factory
function getWhatsAppProvider(settings) {
  let providerType = settings.whatsappProvider || 'meta';
  
  // Auto-detect WASender API key (64 hex characters)
  const token = settings.whatsappAccessToken ? crypto.decrypt(settings.whatsappAccessToken) : '';
  const cleanToken = token ? token.trim() : '';
  if (cleanToken && cleanToken.length === 64 && /^[0-9a-fA-F]+$/.test(cleanToken)) {
    providerType = 'wasender';
  }
  
  const config = {
    whatsappProvider: providerType,
    whatsappAccessToken: settings.whatsappAccessToken,
    whatsappPhoneNumberId: settings.whatsappPhoneNumberId,
    whatsappBusinessAccountId: settings.whatsappBusinessAccountId,
    watiApiEndpoint: settings.watiApiEndpoint,
    threeSixtyApiEndpoint: settings.threeSixtyApiEndpoint,
    whatsappApiUrl: settings.whatsappApiUrl,
    whatsappApiHeaders: settings.whatsappApiHeaders,
    whatsappApiBody: settings.whatsappApiBody
  };

  switch (providerType) {
    case 'meta':
      return new MetaProvider(config);
    case 'wati':
      return new WatiProvider(config);
    case 'twilio':
      return new TwilioProvider(config);
    case '360dialog':
      return new ThreeSixtyDialogProvider(config);
    case 'custom':
      return new CustomProvider(config);
    case 'wasender':
      return new WasenderProvider(config);
    default:
      throw new Error(`Unsupported WhatsApp provider: ${providerType}`);
  }
}


function formatEgyptianPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  // Egyptian local mobile numbers (11 digits starting with 01) -> prepend '20' and drop leading '0'
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return '20' + cleaned.slice(1);
  }
  // Local mobile without leading '0' (10 digits starting with 1) -> prepend '20'
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    return '20' + cleaned;
  }
  // Already formatted international Egyptian number (12 digits starting with 201)
  if (cleaned.startsWith('201') && cleaned.length === 12) {
    return cleaned;
  }
  return cleaned;
}

// Main Send WhatsApp Message Helper
async function sendWhatsApp({ settings, to, messageType, variables = {}, pdfBuffer = null, filename = '', userResponsible = 'system', customText = null }) {
  const isEnabled = settings.whatsappEnabled === 'true';
  if (!isEnabled) {
    console.log(`[WHATSAPP SKIPPED] Module disabled globally.`);
    return { success: false, status: 'skipped', error: 'WhatsApp integration is disabled globally.' };
  }

  // Load message template from settings or use custom text
  const messageText = customText || (() => {
    const templateKey = `whatsappTemplate${messageType.charAt(0).toUpperCase() + messageType.slice(1)}`;
    const templateText = settings[templateKey] || '';
    return compileTemplate(templateText, variables);
  })();

  const logDate = new Date().toISOString().split('T')[0];
  const logTime = new Date().toTimeString().split(' ')[0];
  const patientName = variables.PatientName || 'Guest';
  const formattedTo = formatEgyptianPhoneNumber(to);

  try {
    const provider = getWhatsAppProvider(settings);
    
    let result = null;
    if (pdfBuffer) {
      result = await provider.sendDocument(formattedTo, pdfBuffer, filename || 'prescription.pdf', messageText);
    } else {
      result = await provider.sendMessage(formattedTo, messageText);
    }

    // Log success
    await db.runCommand(
      `INSERT INTO whatsapp_logs (log_date, log_time, patient_name, phone_number, message_type, message_text, delivery_status, user_responsible)
       VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)`,
      [logDate, logTime, patientName, formattedTo, messageType, messageText, userResponsible]
    );

    return { success: true, status: 'sent', result };
  } catch (err) {
    console.error(`[WHATSAPP ERROR] Failed to send ${messageType} to ${formattedTo}:`, err.message);

    // Log failure in DB (Ensures normal operations continue)
    try {
      await db.runCommand(
        `INSERT INTO whatsapp_logs (log_date, log_time, patient_name, phone_number, message_type, message_text, delivery_status, error_details, user_responsible)
         VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?)`,
        [logDate, logTime, patientName, formattedTo, messageType, messageText, err.message, userResponsible]
      );
    } catch (e) {
      console.error('Failed to log WhatsApp failure in DB:', e);
    }

    return { success: false, status: 'failed', error: err.message };
  }
}

module.exports = {
  sendWhatsApp,
  getWhatsAppProvider,
  compileTemplate
};
