// ════════════════════════════════════════════════════════════════════════
// PWA Service Worker registration + update flow
// ════════════════════════════════════════════════════════════════════════
(function() {
  if (!('serviceWorker' in navigator)) return;
  
  let _newWorker = null;
  let _swReg = null;
  
  // Helper: trigger check update
  function _checkForUpdate() {
    if (_swReg && _swReg.update) {
      _swReg.update().catch(()=>{});
    }
  }
  
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .then(reg => {
        _swReg = reg;
        console.log('[PWA] SW registered');
        
        // Check update mỗi 30 phút (background) + có nút manual check ở tab Tài khoản
        setInterval(_checkForUpdate, 30 * 60 * 1000);
        
        // Check update khi tab quay lại visible (user mở lại app)
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            console.log('[PWA] Tab visible — checking update');
            _checkForUpdate();
          }
        });
        
        // Check update khi mạng quay lại online
        window.addEventListener('online', () => {
          console.log('[PWA] Network online — checking update');
          _checkForUpdate();
        });
        
        // Check update khi focus vào window
        window.addEventListener('focus', _checkForUpdate);
        
        // Listen cho SW mới
        reg.addEventListener('updatefound', () => {
          _newWorker = reg.installing;
          if (!_newWorker) return;
          
          _newWorker.addEventListener('statechange', () => {
            // CHỈ hiện banner khi:
            // 1. SW state = installed
            // 2. CÓ controller cũ (= không phải lần install đầu tiên)
            if (_newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setTimeout(() => {
                const b = document.getElementById('pwa-update-banner');
                if (b) b.classList.add('show');
              }, 1500);
            }
          });
        });
      })
      .catch(err => console.warn('[PWA] SW register failed:', err));
    
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
  
  window.pwaApplyUpdate = function() {
    const b = document.getElementById('pwa-update-banner');
    if (b) {
      b.querySelector('.pwa-title').textContent = 'Đang cập nhật...';
      b.querySelector('.pwa-sub').textContent = 'App sẽ tự khởi động lại';
      const btn = b.querySelector('.pwa-action');
      if (btn) btn.style.display = 'none';
    }
    if (_newWorker) {
      _newWorker.postMessage({ action: 'skipWaiting' });
    } else {
      window.location.reload();
    }
  };
  
  // [v9.45] Manual check update — gọi từ nút "Kiểm tra" ở tab Tài khoản
  window.pwaManualCheckUpdate = async function() {
    const btn = document.getElementById('btn-check-update');
    if (!btn) return;
    
    // UI: disable + đổi text
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.textContent = 'Đang kiểm tra...';
    
    if (!_swReg) {
      _showCheckToast('Không thể kiểm tra, vui lòng tải lại trang', 'error');
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = originalText;
      return;
    }
    
    try {
      // Snapshot SW hiện tại để compare sau update()
      const hadWaitingBefore = !!_swReg.waiting;
      const hadInstallingBefore = !!_swReg.installing;
      
      // Force check
      await _swReg.update();
      
      // Đợi browser process update event (1.5s đủ để statechange fire nếu có bản mới)
      await new Promise(r => setTimeout(r, 1500));
      
      // Check: có SW mới (installing/waiting/banner đã show) không?
      const banner = document.getElementById('pwa-update-banner');
      const bannerShown = banner && banner.classList.contains('show');
      const hasNewSW = !!(_swReg.waiting || _swReg.installing || bannerShown);
      
      if (hasNewSW) {
        _showCheckToast('🎉 Đã tìm thấy bản mới! Bấm "Cập nhật" trên banner', 'success');
        // Show banner nếu chưa
        if (banner && !bannerShown) banner.classList.add('show');
      } else {
        _showCheckToast('✓ Bạn đang dùng bản mới nhất', 'info');
      }
    } catch (err) {
      console.warn('[PWA] Manual check failed:', err);
      _showCheckToast('Không thể kiểm tra. Vui lòng thử lại sau', 'error');
    } finally {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = originalText;
    }
  };
  
  // Toast nhỏ feedback
  function _showCheckToast(msg, type) {
    // Reuse existing toast nếu có, hoặc tạo mới
    let t = document.getElementById('_pwa-check-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = '_pwa-check-toast';
      t.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);left:50%;transform:translateX(-50%);background:#0F172A;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:500;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.25);max-width:90vw;text-align:center;opacity:0;transition:opacity .25s;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",system-ui,sans-serif;';
      document.body.appendChild(t);
    }
    if (type === 'success') t.style.background = '#059669';
    else if (type === 'error') t.style.background = '#DC2626';
    else t.style.background = '#0F172A';
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
  }
})();

// ════════════════════════════════════════════════════════════════════════
// PWA Install Prompt (Android Chrome / Edge)
// ════════════════════════════════════════════════════════════════════════
(function() {
  let _deferredPrompt = null;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    const dismissedDate = dismissed ? new Date(parseInt(dismissed)) : null;
    const daysSince = dismissedDate ? (Date.now() - dismissedDate) / (1000*60*60*24) : Infinity;
    
    if (daysSince < 7) return;
    
    setTimeout(() => {
      const b = document.getElementById('pwa-install-banner');
      if (b) b.classList.add('show');
    }, 3000);
  });
  
  window.pwaInstall = async function() {
    const b = document.getElementById('pwa-install-banner');
    if (b) b.classList.remove('show');
    if (!_deferredPrompt) return;
    
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    if (outcome === 'accepted') {
      localStorage.removeItem('pwa_install_dismissed');
    }
    _deferredPrompt = null;
  };
  
  window.pwaDismissInstall = function() {
    const b = document.getElementById('pwa-install-banner');
    if (b) b.classList.remove('show');
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };
  
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Installed');
    localStorage.removeItem('pwa_install_dismissed');
  });
})();
