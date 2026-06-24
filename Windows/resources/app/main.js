const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let serverInstance = null;
let logStream = null;

function setupLogging() {
  try {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    const logPath = path.join(userData, 'app.log');
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
    
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = function(...args) {
      originalLog.apply(console, args);
      const text = `[${new Date().toISOString()}] [INFO] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
      logStream.write(text);
    };
    
    console.error = function(...args) {
      originalError.apply(console, args);
      const text = `[${new Date().toISOString()}] [ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
      logStream.write(text);
    };
    
    console.log('Logging system initialized. Log file path:', logPath);
  } catch (err) {
    console.error('Failed to setup logging:', err);
  }
}

// Config file path
const configPath = path.join(app.getPath('userData'), 'clinic_config.json');

// Default configuration
const defaultConfig = {
  mode: 'standalone', // 'standalone' (host) or 'client'
  serverIp: 'localhost',
  serverPort: 5000,
  dbType: 'sqlite', // 'sqlite' or 'mysql'
  theme: 'dark',
  clinicId: '',
  subscriptionStatus: 'active',
  subscriptionLastChecked: '',
  subscriptionOfflineGraceDays: 5,
  billingUrl: 'https://billing.datagris.com',
  mysqlConfig: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'clinic_db'
  }
};

function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading config file:', err);
  }
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
  return defaultConfig;
}

function writeConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing config file:', err);
    return false;
  }
}

// Start Express Server
async function startBackendServer(config) {
  if (config.mode === 'standalone') {
    try {
      console.log('Starting local Express server...');
      // Pass the userdata path to server so it knows where to store SQLite db
      process.env.USER_DATA_PATH = app.getPath('userData');
      process.env.PORT = config.serverPort || 5000;
      process.env.DB_TYPE = config.dbType;
      process.env.CLINIC_ID = config.clinicId;
      
      if (config.dbType === 'mysql') {
        process.env.MYSQL_HOST = config.mysqlConfig.host;
        process.env.MYSQL_PORT = config.mysqlConfig.port;
        process.env.MYSQL_USER = config.mysqlConfig.user;
        process.env.MYSQL_PASSWORD = config.mysqlConfig.password;
        process.env.MYSQL_DATABASE = config.mysqlConfig.database;
      }

      // Load server
      const { startServer } = require('./server/index.js');
      serverInstance = await startServer();
      console.log('Express server started successfully.');
    } catch (err) {
      console.error('Failed to start Express server:', err);
      dialog.showErrorBox(
        'خطأ في تشغيل الخادم المحلي',
        `فشل تشغيل خادم قاعدة البيانات المحلي: ${err.message}\nيرجى التأكد من عدم تشغيل نسخة أخرى من البرنامج أو أن المنفذ ${config.serverPort || 5000} غير مستخدم.`
      );
    }
  } else {
    console.log('Running in Client Mode. Skipping local Express server start.');
  }
}

async function checkSubscription(clinicId) {
  try {
    const config = readConfig();
    const billingUrl = config.billingUrl || 'https://billing.datagris.com';
    const res = await fetch(`${billingUrl}/api/subscription/check?clinic_id=${clinicId}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`Server returned status: ${res.status}`);
    }
    const data = await res.json();
    return { active: data.status === 'active', status: data.status };
  } catch (err) {
    console.error('Subscription check online error:', err);
    throw err;
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Clinic Operating System - نظام إدارة العيادات الطبية',
    icon: path.join(__dirname, 'public', 'logo.png'), // will be created later
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Remove default menu for clinical app feel
  mainWindow.removeMenu();

  const config = readConfig();
  let subActive = true;

  if (config.clinicId) {
    try {
      const check = await checkSubscription(config.clinicId);
      subActive = check.active;
      config.subscriptionStatus = check.status || (subActive ? 'active' : 'expired');
      config.subscriptionLastChecked = new Date().toISOString();
      writeConfig(config);
    } catch (e) {
      console.error('Offline or failed checking subscription. Relying on local cached status and grace period...');
      if (config.subscriptionStatus === 'expired') {
        subActive = false;
      } else {
        const lastCheckedStr = config.subscriptionLastChecked;
        if (!lastCheckedStr) {
          config.subscriptionLastChecked = new Date().toISOString();
          config.subscriptionStatus = 'active';
          writeConfig(config);
          subActive = true;
        } else {
          const lastCheckedDate = new Date(lastCheckedStr);
          const diffMs = Math.abs(new Date().getTime() - lastCheckedDate.getTime());
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const graceDays = config.subscriptionOfflineGraceDays || 5;
          
          if (diffDays > graceDays) {
            console.log(`Grace period exceeded (${diffDays} days since last check). Locking app.`);
            subActive = false;
          } else {
            console.log(`Running in offline mode. Grace period valid: ${diffDays}/${graceDays} days since last check.`);
            subActive = true;
          }
        }
      }
    }
  }

  const isDev = !app.isPackaged;
  if (!subActive) {
    mainWindow.loadFile(path.join(__dirname, 'lock.html'), {
      query: { clinic_id: config.clinicId }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-config', () => {
  return readConfig();
});

ipcMain.handle('set-config', (event, newConfig) => {
  const success = writeConfig(newConfig);
  if (success) {
    // If the server was running and config changed, the user will need to restart
    // Or we can stop/start it. For simplicity, the UI will request a restart.
    return { success: true };
  }
  return { success: false, error: 'Could not write config file' };
});

ipcMain.handle('select-logo', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }]
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  // Read file as base64 string
  const filePath = result.filePaths[0];
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${data.toString('base64')}`;
});

ipcMain.handle('print-prescription', async (event, { visitId, htmlContent, pageSize }) => {
  try {
    const win = new BrowserWindow({ show: false });
    
    // Load HTML content
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    const tempDir = path.join(app.getPath('temp'), 'clinic_os_prescriptions');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const pdfPath = path.join(tempDir, `prescription_${visitId}.pdf`);
    
    const size = pageSize === 'a5' ? 'A5' : 'A4';
    const pdfBuffer = await win.webContents.printToPDF({
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      pageSize: size,
      printBackground: true
    });
    
    fs.writeFileSync(pdfPath, pdfBuffer);
    win.close();
    
    // Open using system default PDF viewer
    const { shell } = require('electron');
    await shell.openPath(pdfPath);
    
    return { success: true, pdfPath };
  } catch (err) {
    console.error('Print PDF error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('print-report', async (event, { reportName, htmlContent }) => {
  try {
    const win = new BrowserWindow({ show: false });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    const tempDir = path.join(app.getPath('temp'), 'clinic_os_reports');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const safeReportName = reportName.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
    const pdfPath = path.join(tempDir, `${safeReportName}_${Date.now()}.pdf`);
    
    const pdfBuffer = await win.webContents.printToPDF({
      margins: { marginType: 'default' },
      pageSize: 'A4',
      printBackground: true
    });
    
    fs.writeFileSync(pdfPath, pdfBuffer);
    win.close();
    
    const { shell } = require('electron');
    await shell.openPath(pdfPath);
    
    return { success: true, pdfPath };
  } catch (err) {
    console.error('Print Report PDF error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup-database', async () => {
  const config = readConfig();
  if (config.mode !== 'standalone' || config.dbType !== 'sqlite') {
    return { success: false, error: 'Backup is only supported for local SQLite databases.' };
  }
  
  try {
    const dbPath = path.join(app.getPath('userData'), 'clinic.db');
    if (!fs.existsSync(dbPath)) {
      return { success: false, error: 'Database file not found.' };
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Database Backup - حفظ نسخة احتياطية',
      defaultPath: path.join(app.getPath('downloads'), `clinic_backup_${Date.now()}.db`),
      filters: [{ name: 'SQLite DB', extensions: ['db'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    fs.copyFileSync(dbPath, result.filePath);
    return { success: true, backupPath: result.filePath };
  } catch (err) {
    console.error('Backup error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('Failed to open external link:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// App lifecycle
app.on('ready', async () => {
  setupLogging();
  const config = readConfig();
  await startBackendServer(config);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
