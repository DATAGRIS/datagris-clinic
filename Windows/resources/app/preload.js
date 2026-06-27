const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
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

function openSubscriptionModal() {
  const existingModal = document.getElementById('subscription-details-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'subscription-details-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  modal.style.backdropFilter = 'blur(8px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '999999';

  const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const plan = appConfig.subscriptionPlan || 'trial';
  const status = appConfig.subscriptionStatus || 'trial';
  const start = appConfig.subscriptionStartDate || '';
  const end = appConfig.subscriptionEndDate || '';
  
  let daysRemaining = 0;
  if (end) {
    daysRemaining = Math.max(0, Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24)));
  }

  const isTrial = plan === 'trial';
  const isBasic = plan === 'basic';
  
  let planTitleAr = 'النسخة التجريبية (7 أيام)';
  if (plan === 'pro') {
    planTitleAr = 'الخطة الاحترافية (برو)';
  } else if (plan === 'basic') {
    planTitleAr = 'الخطة الأساسية (بيزك)';
  }

  modal.innerHTML = `
    <div style="background: var(--bg-card, #1e293b); border: 1px solid var(--border-color, #334155); border-radius: 16px; padding: 24px; max-width: 480px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3); color: var(--text-main, #f8fafc); font-family: 'Cairo', sans-serif; direction: rtl; box-sizing: border-box;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color, #334155); padding-bottom: 12px;">
        <h3 style="margin: 0; font-size: 1.1rem; color: var(--primary, #3b82f6); font-weight: 800;">تفاصيل الاشتراك / Subscription Details</h3>
        <button id="close-sub-modal-btn" style="background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; font-size: 1.2rem; font-weight: bold; padding: 4px;">✕</button>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.9rem; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted, #94a3b8);">نوع الباقة / Plan:</span>
          <span style="font-weight: 700;">${planTitleAr}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted, #94a3b8);">حالة الاشتراك / Status:</span>
          <span style="font-weight: 700; color: ${status === 'active' || status === 'pro' ? '#10b981' : '#f59e0b'}">${status === 'active' || status === 'pro' ? 'نشط / Active' : 'تجريبي / Trial'}</span>
        </div>
        ${start ? `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted, #94a3b8);">تاريخ البدء / Start Date:</span>
          <span style="font-weight: 600; direction: ltr;">${formatDate(start)}</span>
        </div>
        ` : ''}
        ${end ? `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted, #94a3b8);">تاريخ الانتهاء / End Date:</span>
          <span style="font-weight: 600; direction: ltr;">${formatDate(end)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; background: rgba(59, 130, 246, 0.08); padding: 8px 12px; border-radius: 8px; border: 1px dashed rgba(59, 130, 246, 0.2); margin-top: 4px;">
          <span style="color: var(--text-muted, #94a3b8);">الوقت المتبقي / Time Left:</span>
          <span style="font-weight: 700; color: var(--primary, #3b82f6);">${daysRemaining} يوم / days</span>
        </div>
        ` : ''}
      </div>

      ${(isTrial || isBasic) ? `
      <div style="margin-top: 24px; text-align: center;">
        <button id="upgrade-modal-action-btn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); transition: transform 0.2s;">
          ترقية الاشتراك للباقة الاحترافية (برو) / Upgrade to Pro
        </button>
      </div>
      ` : ''}
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#close-sub-modal-btn').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.remove();
    }
  });

  const upgradeBtn = modal.querySelector('#upgrade-modal-action-btn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      const clinicId = appConfig.clinicId || 'Unknown';
      ipcRenderer.invoke('open-external', `https://clinic.billing.datagris.com/checkout?clinic=${encodeURIComponent(clinicId)}&plan=pro`);
      modal.remove();
    });
  }
}

function applyUIModifications() {
  if (appConfig && !appConfig.subscriptionPlan) {
    fetch('http://localhost:5000/api/settings')
      .then(res => res.json())
      .then(settings => {
        appConfig = { ...appConfig, ...settings };
        applyUIModifications();
      })
      .catch(() => {});
  }
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

    // B. Inject Stacked Footer Actions (Subscription + Logout buttons)
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (sidebarFooter && !document.getElementById('premium-footer-actions')) {
      const oldBadge = document.getElementById('plan-status-badge');
      if (oldBadge) oldBadge.remove();
      const oldActions = document.getElementById('profile-actions-container');
      if (oldActions) oldActions.remove();

      const profileDetails = document.querySelector('.user-profile-summary > div:last-child');
      const detailsText = profileDetails ? (profileDetails.textContent || '') : '';
      const isAdmin = detailsText.includes('مدير') || 
                      detailsText.toLowerCase().includes('admin') ||
                      detailsText.toLowerCase().includes('administrator');

      const container = document.createElement('div');
      container.id = 'premium-footer-actions';
      container.style.width = '100%';
      container.style.marginTop = '12px';
      container.style.boxSizing = 'border-box';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';

      // 1. Subscription Card Button
      const subCard = document.createElement('div');
      subCard.className = 'premium-card-btn';
      
      const plan = appConfig.subscriptionPlan || 'trial';
      const status = appConfig.subscriptionStatus || 'trial';
      
      if (plan === 'pro' || status === 'active' || status === 'pro') {
        subCard.className += ' premium-pro-card';
        subCard.innerHTML = `
          <span>خطة برو الاحترافية / Pro Plan</span>
        `;
      } else if (plan === 'basic') {
        subCard.className += ' premium-basic-card';
        subCard.innerHTML = `
          <span>خطة بيزك الأساسية / Basic Plan</span>
        `;
      } else {
        subCard.className += ' premium-trial-card';
        subCard.innerHTML = `
          <span>النسخة التجريبية / Free Trial</span>
        `;
      }

      // Add info button only if admin
      if (isAdmin) {
        const infoBtn = document.createElement('button');
        infoBtn.className = 'info-icon-btn';
        infoBtn.title = 'تفاصيل الاشتراك / Subscription Details';
        infoBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        `;
        infoBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openSubscriptionModal();
        });
        subCard.appendChild(infoBtn);
      }

      container.appendChild(subCard);

      // 2. Logout Button
      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'premium-logout-btn';
      logoutBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        <span>تسجيل الخروج / Logout</span>
      `;
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const defaultLogoutBtn = document.querySelector('.sidebar-footer > button') || document.querySelector('.sidebar-footer > .btn-logout');
        if (defaultLogoutBtn) {
          defaultLogoutBtn.click();
        }
      });
      container.appendChild(logoutBtn);

      sidebarFooter.appendChild(container);
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
      
      .premium-pro-card {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%) !important;
        border: 1px solid #10b981 !important;
        color: #10b981 !important;
        box-shadow: 0 0 15px rgba(16, 185, 129, 0.25) !important;
        animation: proGlow 4s infinite ease-in-out !important;
      }
      
      @keyframes proGlow {
        0% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.2); border-color: #10b981; }
        50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.4); border-color: #3b82f6; }
        100% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.2); border-color: #10b981; }
      }
      
      .premium-basic-card {
        background: rgba(59, 130, 246, 0.08) !important;
        border: 1px solid rgba(59, 130, 246, 0.3) !important;
        color: #3b82f6 !important;
      }
      
      .premium-trial-card {
        background: rgba(245, 158, 11, 0.05) !important;
        border: 1px solid rgba(245, 158, 11, 0.25) !important;
        color: #f59e0b !important;
      }
      
      .premium-card-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 700;
        font-family: 'Cairo', sans-serif;
        box-sizing: border-box;
        margin-bottom: 8px;
        text-decoration: none;
        cursor: default;
        transition: all 0.3s ease;
      }
      
      .premium-logout-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 700;
        font-family: 'Cairo', sans-serif;
        box-sizing: border-box;
        background-color: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.2);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .premium-logout-btn:hover {
        background-color: rgba(239, 68, 68, 0.2);
        transform: scale(1.02);
      }
      
      .info-icon-btn {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border-radius: 4px;
        transition: background 0.2s;
      }
      
      .info-icon-btn:hover {
        background: rgba(255, 255, 255, 0.12);
      }
    `;
    document.head.appendChild(style);
  }

  // Set up click outside notifications popup handler to auto-close it
  document.addEventListener('click', (event) => {
    const dropdown = document.querySelector('.notifications-dropdown');
    if (dropdown) {
      const button = dropdown.previousElementSibling;
      if (!dropdown.contains(event.target) && (!button || !button.contains(event.target))) {
        if (button) {
          button.click();
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
  appConfig = config;
  applyUIModifications();
}).catch((err) => {
  console.error('Failed to load clinic config:', err);
});

