const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config').then(config => ({ ...config, subscriptionPlan: 'pro', subscriptionStatus: 'active' })),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),
  selectLogo: () => ipcRenderer.invoke('select-logo'),
  printPrescription: (visitId, htmlContent, pageSize, printMode) => ipcRenderer.invoke('print-prescription', { visitId, htmlContent, pageSize, printMode }),
  printReport: (reportName, htmlContent, printMode) => ipcRenderer.invoke('print-report', { reportName, htmlContent, printMode }),
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restartApp: () => ipcRenderer.send('restart-app'),
  onQueueUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('queue-updated', subscription);
    return () => ipcRenderer.removeListener('queue-updated', subscription);
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});

// Dynamic UI Injection for SaaS indicators and modifications
let appConfig = null;
let syncStatusInterval = null;

function getBillingUrl() {
  if (appConfig && appConfig.billingUrl) {
    return appConfig.billingUrl;
  }
  return 'https://billing.datagris.com';
}

function startSyncStatusPolling() {
  if (syncStatusInterval) return; // Prevent duplicate polling intervals
  
  const dot = document.getElementById('sync-status-dot');
  const widget = document.getElementById('sync-status-widget');
  if (!dot || !widget) return;

  async function updateStatus() {
    try {
      const res = await fetch('http://localhost:5000/api/sync/status');
      if (!res.ok) throw new Error();
      const data = await res.json(); // { status, lastSyncTime, pendingCount, failedCount }

      // Color the dot/circle only
      if (data.status === 'synced') {
        dot.style.backgroundColor = '#10b981';
        dot.style.boxShadow = '0 0 10px #10b981';
        widget.title = `متصل ومزامن / Synced\n\nتفاصيل المزامنة:\n- آخر مزامنة: ${data.lastSyncTime || 'Never'}\n- المعاملات المعلقة: ${data.pendingCount}\n- المحاولات الفاشلة: ${data.failedCount}`;
      } else if (data.status === 'pending') {
        dot.style.backgroundColor = '#f59e0b';
        dot.style.boxShadow = '0 0 10px #f59e0b';
        widget.title = `معلّق / Sync Pending\n\nتفاصيل المزامنة:\n- آخر مزامنة: ${data.lastSyncTime || 'Never'}\n- المعاملات المعلقة: ${data.pendingCount}\n- المحاولات الفاشلة: ${data.failedCount}`;
      } else if (data.status === 'connected-inactive') {
        dot.style.backgroundColor = '#f59e0b';
        dot.style.boxShadow = '0 0 10px #f59e0b';
        widget.title = `متصل بالإنترنت - المزامنة غير نشطة\n(في انتظار رفع موقع الـ Billing والربط مع Supabase)\n\nالمعاملات المحلية المعلقة: ${data.pendingCount}`;
      } else {
        dot.style.backgroundColor = '#ef4444';
        dot.style.boxShadow = '0 0 10px #ef4444';
        widget.title = `غير متصل / Offline\n\nتعذر الاتصال بالخادم.`;
      }
    } catch (e) {
      dot.style.backgroundColor = '#ef4444';
      dot.style.boxShadow = '0 0 10px #ef4444';
      widget.title = 'غير متصل / Offline\n\nتعذر الاتصال بالخادم المحلي للعيادة.';
    }
  }

  updateStatus();
  syncStatusInterval = setInterval(updateStatus, 5000); // Poll status every 5 seconds
}

function applyUIModifications() {
  // 1. Check if we are on the Login Page
  const isLoginPage = !document.querySelector('.sidebar') && (
    document.querySelector('form') ||
    Array.from(document.querySelectorAll('h2')).some(h => 
      h.textContent.includes('تسجيل الدخول') || 
      h.textContent.includes('Access Platform') || 
      h.textContent.includes('Sign In')
    )
  );

  if (isLoginPage) {
    const heading = document.querySelector('.login-form-section h2');
    const isAr = heading && heading.textContent.includes('تسجيل');

    // A. Customize Username Placeholder dynamically based on language
    const userInput = document.querySelector('form input[type="text"]');
    const expectedUserPlaceholder = isAr ? "اسم المستخدم" : "Username";
    if (userInput && userInput.placeholder !== expectedUserPlaceholder) {
      userInput.placeholder = expectedUserPlaceholder;
    }

    // B. Customize Password Placeholder and Add Eye Toggle
    const passInput = document.querySelector('form input[type="password"]') || document.querySelector('input[data-is-password="true"]');
    if (passInput) {
      passInput.setAttribute('data-is-password', 'true');
      const expectedPassPlaceholder = isAr ? "كلمة المرور" : "Password";
      if (passInput.placeholder !== expectedPassPlaceholder) {
        passInput.placeholder = expectedPassPlaceholder;
      }

      const passParent = passInput.parentNode;
      if (passParent && !document.getElementById('password-toggle-eye')) {
        passParent.style.position = 'relative'; // Ensure parent has relative positioning

        const eyeBtn = document.createElement('button');
        eyeBtn.id = 'password-toggle-eye';
        eyeBtn.type = 'button';
        eyeBtn.style.position = 'absolute';
        eyeBtn.style.top = '50%';
        eyeBtn.style.transform = 'translateY(-50%)';
        eyeBtn.style.background = 'none';
        eyeBtn.style.border = 'none';
        eyeBtn.style.cursor = 'pointer';
        eyeBtn.style.display = 'flex';
        eyeBtn.style.alignItems = 'center';
        eyeBtn.style.justifyContent = 'center';
        eyeBtn.style.width = '36px';
        eyeBtn.style.height = '36px';
        eyeBtn.style.color = 'var(--text-muted)';
        eyeBtn.style.zIndex = '10';

        // Align eye icon: left for Arabic RTL, right for English LTR
        if (isAr) {
          eyeBtn.style.left = '10px';
          eyeBtn.style.right = 'auto';
        } else {
          eyeBtn.style.right = '10px';
          eyeBtn.style.left = 'auto';
        }

        const eyeSvg = `
          <svg id="eye-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
        const eyeOffSvg = `
          <svg id="eye-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        `;

        eyeBtn.innerHTML = eyeSvg;
        eyeBtn.addEventListener('click', () => {
          if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeBtn.innerHTML = eyeOffSvg;
          } else {
            passInput.type = 'password';
            eyeBtn.innerHTML = eyeSvg;
          }
        });

        passParent.appendChild(eyeBtn);
      }
    }

    // C. Add Signup / Create Account button in the form
    const loginForm = document.querySelector('form');
    if (loginForm) {
      let linkContainer = document.getElementById('create-account-container');
      if (!linkContainer) {
        linkContainer = document.createElement('div');
        linkContainer.id = 'create-account-container';
        linkContainer.style.marginTop = '16px';
        linkContainer.style.display = 'flex';
        linkContainer.style.justifyContent = 'center';
        linkContainer.style.gap = '8px';
        linkContainer.style.fontSize = '0.85rem';
        
        linkContainer.innerHTML = `
          <span style="color: var(--text-muted);"></span>
          <a id="signup-link" href="#" style="color: var(--accent, #3b82f6); font-weight: bold; text-decoration: none; cursor: pointer;"></a>
        `;
        
        linkContainer.querySelector('#signup-link').addEventListener('click', (e) => {
          e.preventDefault();
          const billingUrl = getBillingUrl();
          ipcRenderer.invoke('open-external', `${billingUrl}/signup`);
        });
        
        loginForm.appendChild(linkContainer);
      }
      
      const textSpan = linkContainer.querySelector('span');
      const linkSpan = linkContainer.querySelector('#signup-link');
      const expectedText = isAr ? 'ليس لديك حساب؟ ' : "Don't have an account? ";
      const expectedLink = isAr ? 'أنشئ حساباً الآن' : 'Create an account';
      
      if (textSpan && textSpan.textContent !== expectedText) {
        textSpan.textContent = expectedText;
      }
      if (linkSpan && linkSpan.textContent !== expectedLink) {
        linkSpan.textContent = expectedLink;
      }
    }

    // D. Add Company Intro & Overview inside the 60% side panel (sibling of .login-form-section)
    const formSection = document.querySelector('.login-form-section');
    const sidePanel = formSection ? formSection.previousElementSibling : null;
    if (sidePanel) {
      let overviewCard = document.getElementById('datagris-side-overview');
      if (!overviewCard) {
        overviewCard = document.createElement('div');
        overviewCard.id = 'datagris-side-overview';
        overviewCard.style.marginTop = '40px';
        overviewCard.style.padding = '24px';
        overviewCard.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
        overviewCard.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        overviewCard.style.borderRadius = '20px';
        overviewCard.style.backdropFilter = 'blur(12px)';
        overviewCard.style.maxWidth = '460px';
        overviewCard.style.color = '#e2e8f0';
        overviewCard.style.lineHeight = '1.8';
        overviewCard.style.fontSize = '0.9rem';
        overviewCard.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.3)';
        overviewCard.style.zIndex = '5';
        
        overviewCard.innerHTML = `
          <div style="font-weight: 800; color: var(--accent, #3b82f6); font-size: 1.25rem; margin-bottom: 8px; display: flex; align-items: center;"></div>
          <div style="font-size: 0.8rem; font-weight: 600; color: #94a3b8; margin-bottom: 16px; margin-top: -4px;">
            (Data Grid Integrated Systems)
          </div>
          <div style="font-weight: bold; color: #ffffff; margin-bottom: 8px; font-size: 1.05rem;"></div>
          <div style="color: #cbd5e1;"></div>
        `;
        sidePanel.appendChild(overviewCard);
      }
      
      // Update language content of the side card dynamically
      overviewCard.style.direction = isAr ? 'rtl' : 'ltr';
      const titleDiv = overviewCard.children[0];
      const headerDiv = overviewCard.children[2];
      const descDiv = overviewCard.children[3];
      
      const expectedTitle = `
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color: var(--accent, #3b82f6); box-shadow: 0 0 8px var(--accent, #3b82f6); margin-inline-end: 8px;"></span>
        ${isAr ? 'تقدم شركة DATAGRIS للأنظمة الرقمية' : 'DATAGRIS Systems & Digital Solutions'}
      `;
      const expectedHeader = isAr ? 'نظام DATAGRIS Clinic المتكامل' : 'DATAGRIS Clinic Integrated Platform';
      const expectedDesc = isAr ? 'نظام متكامل لإدارة العيادات والمراكز الطبية مع الدعم الكامل للعمل بدون إنترنت (Offline-First) والمزامنة التلقائية الآمنة للسحابة لإدارة الحجوزات، ملفات المرضى، المخازن والخزينة.' : 'A fully integrated medical center and clinic management platform with robust Offline-First support and automatic secure cloud sync for reservations, patient records, inventory, and finances.';
      
      if (titleDiv && titleDiv.innerHTML !== expectedTitle) {
        titleDiv.innerHTML = expectedTitle;
      }
      if (headerDiv && headerDiv.textContent !== expectedHeader) {
        headerDiv.textContent = expectedHeader;
      }
      if (descDiv && descDiv.textContent !== expectedDesc) {
        descDiv.textContent = expectedDesc;
      }
    }
  }

  // 2. Check if we are inside the main App (Sidebar exists)
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && appConfig) {
    const clinicId = appConfig.clinicId || 'Unknown';

    // A. Hide default logout button
    if (!document.getElementById('hide-default-logout-style')) {
      const style = document.createElement('style');
      style.id = 'hide-default-logout-style';
      style.innerHTML = `
        .sidebar-footer > button, .sidebar-footer > .btn-logout {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    // B. Inject Plan Status Badge above the profile card
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (sidebarFooter && !document.getElementById('plan-status-badge')) {
      const badge = document.createElement('div');
      badge.id = 'plan-status-badge';
      badge.style.margin = '0 12px 10px 12px';
      badge.style.padding = '6px 12px';
      badge.style.borderRadius = '12px';
      badge.style.fontSize = '0.75rem';
      badge.style.fontWeight = 'bold';
      badge.style.textAlign = 'center';
      badge.style.display = 'flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.style.gap = '6px';
      badge.style.border = '1px solid rgba(255, 255, 255, 0.08)';

      const status = appConfig.subscriptionStatus || 'trial';
      if (status === 'pro' || status === 'active') {
        badge.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        badge.style.color = '#10b981';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.2)';
        badge.innerHTML = `
          <span style="width: 6px; height: 6px; border-radius: 50%; background-color: #10b981; box-shadow: 0 0 6px #10b981;"></span>
          <span>الخطة الاحترافية (برو) / Pro Plan</span>
        `;
      } else if (status === 'expired') {
        badge.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        badge.style.color = '#ef4444';
        badge.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        badge.innerHTML = `
          <span style="width: 6px; height: 6px; border-radius: 50%; background-color: #ef4444; box-shadow: 0 0 6px #ef4444;"></span>
          <span>انتهى الاشتراك / Expired</span>
        `;
      } else {
        badge.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
        badge.style.color = '#f59e0b';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.2)';
        badge.innerHTML = `
          <span style="width: 6px; height: 6px; border-radius: 50%; background-color: #f59e0b; box-shadow: 0 0 6px #f59e0b;"></span>
          <span>النسخة التجريبية (7 أيام) / 7-Day Trial</span>
        `;
      }

      sidebarFooter.insertBefore(badge, sidebarFooter.firstChild);
    }

    // C. Inject Actions Container (Upgrade Button + Logout Button) in the profile card
    const profileDetails = document.querySelector('.user-profile-summary > div:last-child');
    if (profileDetails && !document.getElementById('profile-actions-container')) {
      const detailsText = profileDetails.textContent || '';
      const isAdmin = detailsText.includes('مدير') || 
                      detailsText.toLowerCase().includes('admin') ||
                      detailsText.toLowerCase().includes('administrator');

      const actionsContainer = document.createElement('div');
      actionsContainer.id = 'profile-actions-container';
      actionsContainer.style.marginTop = '10px';
      actionsContainer.style.display = 'flex';
      actionsContainer.style.flexDirection = 'column';
      actionsContainer.style.gap = '8px';
      actionsContainer.style.width = '100%';

      // 1. Upgrade button (only for Admin/Manager if not already Pro)
      const status = appConfig.subscriptionStatus || 'trial';
      const plan = appConfig.subscriptionPlan || 'trial';
      const isPro = status === 'pro' || status === 'active' || plan === 'pro';
      if (isAdmin && !isPro) {
        const upgradeBtn = document.createElement('button');
        upgradeBtn.id = 'upgrade-to-pro-btn';
        upgradeBtn.style.backgroundColor = 'var(--accent, #3b82f6)';
        upgradeBtn.style.color = '#ffffff';
        upgradeBtn.style.border = 'none';
        upgradeBtn.style.borderRadius = '8px';
        upgradeBtn.style.padding = '8px 12px';
        upgradeBtn.style.fontSize = '0.75rem';
        upgradeBtn.style.fontWeight = 'bold';
        upgradeBtn.style.cursor = 'pointer';
        upgradeBtn.style.display = 'flex';
        upgradeBtn.style.alignItems = 'center';
        upgradeBtn.style.justifyContent = 'center';
        upgradeBtn.style.gap = '6px';
        upgradeBtn.style.transition = 'all 0.2s ease';

        upgradeBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"></path>
            <path d="M5 20h14"></path>
          </svg>
          <span>الترقية للاحترافية / Upgrade to Pro</span>
        `;

        upgradeBtn.addEventListener('mouseenter', () => {
          upgradeBtn.style.opacity = '0.9';
          upgradeBtn.style.transform = 'scale(1.02)';
        });
        upgradeBtn.addEventListener('mouseleave', () => {
          upgradeBtn.style.opacity = '1';
          upgradeBtn.style.transform = 'scale(1)';
        });

        upgradeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const billingUrl = getBillingUrl();
          ipcRenderer.invoke('open-external', `${billingUrl}/checkout?clinic=${encodeURIComponent(clinicId)}&plan=pro`);
        });

        actionsContainer.appendChild(upgradeBtn);
      }

      // 2. Logout button (available for all accounts)
      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'profile-logout-btn';
      logoutBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      logoutBtn.style.color = '#ef4444';
      logoutBtn.style.border = '1px solid rgba(239, 68, 68, 0.2)';
      logoutBtn.style.borderRadius = '8px';
      logoutBtn.style.padding = '8px 12px';
      logoutBtn.style.fontSize = '0.75rem';
      logoutBtn.style.fontWeight = 'bold';
      logoutBtn.style.cursor = 'pointer';
      logoutBtn.style.display = 'flex';
      logoutBtn.style.alignItems = 'center';
      logoutBtn.style.justifyContent = 'center';
      logoutBtn.style.gap = '6px';
      logoutBtn.style.transition = 'all 0.2s ease';

      logoutBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        <span>تسجيل الخروج / Logout</span>
      `;

      logoutBtn.addEventListener('mouseenter', () => {
        logoutBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        logoutBtn.style.transform = 'scale(1.02)';
      });
      logoutBtn.addEventListener('mouseleave', () => {
        logoutBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        logoutBtn.style.transform = 'scale(1)';
      });

      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const defaultLogoutBtn = document.querySelector('.sidebar-footer > button') || document.querySelector('.sidebar-footer > .btn-logout');
        if (defaultLogoutBtn) {
          defaultLogoutBtn.click();
        }
      });

      actionsContainer.appendChild(logoutBtn);
      profileDetails.appendChild(actionsContainer);
    }

    // D. Inject Sync Status Indicator in header (Circle dot ONLY, detailed stats on hover)
    const headerControls = document.querySelector('.main-content header > div:last-child');
    if (headerControls && !document.getElementById('sync-status-widget')) {
      const widget = document.createElement('div');
      widget.id = 'sync-status-widget';
      widget.style.display = 'flex';
      widget.style.alignItems = 'center';
      widget.style.justifyContent = 'center';
      widget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
      widget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
      widget.style.width = '32px';
      widget.style.height = '32px';
      widget.style.borderRadius = '50%';
      widget.style.cursor = 'pointer';
      widget.style.transition = 'all 0.3s ease';
      
      widget.innerHTML = `
        <span id="sync-status-dot" style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ef4444; box-shadow: 0 0 8px #ef4444; transition: all 0.3s ease; animation: pulse 2.5s infinite;"></span>
      `;

      headerControls.insertBefore(widget, headerControls.firstChild);
      console.log('Successfully injected Sync Status dot in header!');
      
      startSyncStatusPolling();
    }
  }
}

// Start executing modifications
window.addEventListener('DOMContentLoaded', () => {
  // Append keyframe animations for pulsing dot
  if (!document.getElementById('sync-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'sync-pulse-style';
    style.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(0.95); opacity: 0.85; }
        50% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(0.95); opacity: 0.85; }
      }
    `;
    document.head.appendChild(style);
  }

  // Set up click outside notifications popup handler to auto-close it
  document.addEventListener('click', (event) => {
    const dropdown = Array.from(document.querySelectorAll('div')).find(el => {
      if (el.id === 'sync-status-widget' || el.id === 'datagris-system-overview') return false;
      const style = window.getComputedStyle(el);
      if (style.position !== 'absolute' && style.position !== 'fixed') return false;
      return el.textContent.includes('التنبيهات') || 
             el.textContent.includes('Notifications') || 
             el.textContent.includes('إشعارات') ||
             el.className.includes('notification') ||
             el.className.includes('dropdown');
    });

    if (dropdown) {
      if (dropdown.contains(event.target)) {
        return; // clicked inside, do nothing
      }
      
      const headerControls = document.querySelector('.main-content header > div:last-child');
      if (headerControls) {
        const clickedButton = event.target.closest('button');
        if (clickedButton && headerControls.contains(clickedButton)) {
          return; // clicked toggle trigger button, let React do the work
        }

        // Programmatically click the bell button to toggle it closed
        const bellButton = Array.from(headerControls.querySelectorAll('button')).find(btn => {
          return btn.querySelector('svg') && (
            btn.textContent.match(/\d+/) || 
            btn.querySelector('.badge') ||
            btn.innerHTML.includes('notification') ||
            btn.innerHTML.includes('bell')
          );
        }) || Array.from(headerControls.querySelectorAll('button')).find(btn => btn.contains(dropdown.parentElement));

        if (bellButton) {
          bellButton.click();
        }
      }
    }
  });

  // Apply immediately in case DOM is already parsed
  applyUIModifications();

  // Set up MutationObserver to apply modifications dynamically when React elements render
  const observer = new MutationObserver(() => {
    applyUIModifications();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});

// Load config and trigger modifications
ipcRenderer.invoke('get-config').then((config) => {
  appConfig = { ...config, subscriptionPlan: 'pro', subscriptionStatus: 'active' };
  applyUIModifications();
}).catch((err) => {
  console.error('Failed to load clinic config:', err);
});

