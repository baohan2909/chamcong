// ═══════════════════════════════════════════════════════════
// [v10.85] QLNS SỬA CẢNH BÁO BỔ SUNG CA (CH/ca/giờ/ngày)
// ═══════════════════════════════════════════════════════════
let _suaCBData = null;

async function moModalSuaCB(d){
  _suaCBData = d;
  const modal = document.getElementById('sua-cb-modal');
  document.getElementById('scb-err').style.display = 'none';
  // Set giá trị hiện tại
  document.getElementById('scb-ngay').value = d.ngay || '';
  document.getElementById('scb-gio').value = (d.gio || '').length === 5 ? d.gio : '';
  // Đoán loại ca từ nội dung CB
  const noiDung = (d.noiDung || '').toUpperCase();
  let loai = 'RA_CA';
  if (noiDung.includes('VAO_CA') || noiDung.includes('VÀO CA')) loai = 'VAO_CA';
  else if (noiDung.includes('RA_GIUA') || noiDung.includes('RA GIỮA')) loai = 'RA_GIUA_CA';
  else if (noiDung.includes('VAO_GIUA') || noiDung.includes('VÀO GIỮA')) loai = 'VAO_GIUA_CA';
  document.getElementById('scb-loai').value = loai;
  // Load CH list (dùng chung logic với bsc-ch)
  const selCH = document.getElementById('scb-ch');
  if (selCH.options.length <= 1) {
    try {
      const { data } = await supa.from('cua_hang')
        .select('ma_ch, ten_ch, khu_vuc')
        .eq('trang_thai', 'ĐANG HOẠT ĐỘNG')
        .order('khu_vuc').order('ten_ch');
      if (data) {
        let lastKV = '';
        data.forEach(ch => {
          if (ch.khu_vuc !== lastKV) {
            const og = document.createElement('optgroup');
            og.label = ch.khu_vuc || 'Khác';
            selCH.appendChild(og);
            lastKV = ch.khu_vuc;
          }
          const opt = document.createElement('option');
          opt.value = ch.ma_ch;
          opt.textContent = ch.ma_ch + ' · ' + ch.ten_ch;
          selCH.lastElementChild.appendChild(opt);
        });
      }
    } catch (e) {}
  }
  selCH.value = d.maCh || '';
  modal.style.display = 'flex';
}

function dongModalSuaCB(){
  document.getElementById('sua-cb-modal').style.display = 'none';
  _suaCBData = null;
}

async function luuSuaCB(){
  if (!_suaCBData) return;
  const ngay = document.getElementById('scb-ngay').value;
  const gio = document.getElementById('scb-gio').value;
  const loai = document.getElementById('scb-loai').value;
  const maCh = document.getElementById('scb-ch').value;
  const err = document.getElementById('scb-err');
  if (!ngay || !gio || !maCh) {
    err.textContent = 'Vui lòng nhập đủ ngày, giờ và cửa hàng.';
    err.style.display = 'block';
    return;
  }
  const btn = document.getElementById('scb-btn-luu');
  btn.disabled = true; btn.textContent = 'Đang lưu...';
  try {
    // 1) Sửa cảnh báo + cham_cong
    const { data: r1, error: e1 } = await supa.rpc('fn_qlns_sua_canh_bao_bo_sung', {
      p_cb_id: _suaCBData.cbId,
      p_ma_ch: maCh,
      p_loai: loai,
      p_gio: gio,
      p_ngay: ngay,
      p_nguoi: SESSION.ma
    });
    if (e1 || !r1 || !r1.success) {
      err.textContent = '⚠ ' + ((r1 && r1.error) || (e1 && e1.message) || 'Lỗi server');
      err.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Lưu & duyệt';
      return;
    }
    // 2) Duyệt luôn
    const cbId = _suaCBData.cbId;
    const maNV = _suaCBData.maNV || '';
    await supa.rpc('fn_duyet_canh_bao', {
      p_ma_nv: maNV, p_ngay: ngay, p_quyet_dinh: 'Duyệt',
      p_ma_nguoi_duyet: SESSION.ma,
      p_cb_id: cbId, p_loai_cb: null, p_gio: null
    });
    dongModalSuaCB();
    showToast('✓ Đã sửa & duyệt', 'ok');
    // Remove item khỏi UI
    if (_ycData) {
      _ycData.giaiTrinh = (_ycData.giaiTrinh||[]).filter(x => x.cbId !== cbId);
      _updateYCDayCounts();
      const rGT=(_ycData.giaiTrinh||[]).length, rDN=(_ycData.donNghi||[]).length;
      const gtB=document.getElementById('yc-gt-badge');
      if(gtB){gtB.textContent=rGT>0?String(rGT):'';gtB.style.display=rGT>0?'flex':'none';}
      const aB=document.getElementById('acc-duyetyc-badge');
      if(aB){const t=rGT+rDN;aB.textContent=t>0?String(t):'';aB.style.display=t>0?'flex':'none';}
    }
    const itemEl = document.querySelector(`[data-gtitem="${cbId}"]`);
    if (itemEl) { itemEl.style.opacity='0'; setTimeout(()=>{try{itemEl.remove();}catch(e){}},260); }
    _silentUpdateAccBadges();
  } catch(ex) {
    err.textContent = '⚠ ' + ex.message;
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Lưu & duyệt';
  }
}
let _notifList = [];
let _notifLastSince = 0;
let _notifPollTimer = null;
let _notifPanelOpen = false;

function startNotifPolling() {
  if (!SESSION) return;
  // Tải lần đầu ngay
  loadNotifications(true);
  // Poll mỗi 30 giây
  if (_notifPollTimer) clearInterval(_notifPollTimer);
  _notifPollTimer = setInterval(() => {
    if (!SESSION) return;
    // [v11.7 perf] Skip poll khi tab không visible - tiết kiệm tài nguyên & API quota
    if (document.hidden) return;
    loadNotifications(false);
  }, 30000);
}

function stopNotifPolling() {
  if (_notifPollTimer) clearInterval(_notifPollTimer);
  _notifPollTimer = null;
  _notifList = [];
  _notifLastSince = 0;
}

async function loadNotifications(reset) {
  if (!SESSION) return;
  try {
    const sinceParam = (reset || !_notifLastSince) ? null : new Date(_notifLastSince).toISOString();
    // [v12-P3] Supabase RPC
    const { data: arr, error } = await supa.rpc('fn_get_thong_bao', {
      p_ma_nv: SESSION.ma,
      p_since: sinceParam
    });
    if (error) throw error;
    // Adapt format: createdAt → ngayTao (timestamp ms), daDoc → daXem
    const newList = (arr || []).map(t => ({
      id: t.id, loai: t.loai, tieuDe: t.tieuDe, noiDung: t.noiDung,
      link: t.link, daXem: t.daDoc,
      ngayTao: t.createdAt ? new Date(t.createdAt).getTime() : 0
    }));
    if (reset) {
      _notifList = newList;
    } else if (newList.length) {
      const existIds = new Set(_notifList.map(n => n.id));
      const fresh = newList.filter(n => !existIds.has(n.id));
      if (fresh.length) {
        _notifList = [...fresh, ..._notifList].slice(0, 100);
        // Chỉ vibrate nếu có items MỚI CHƯA ĐỌC (không phải load lần đầu)
        const freshUnread = fresh.filter(n => !n.daXem);
        if(freshUnread.length) {
          try { if (navigator.vibrate) navigator.vibrate([30, 50, 30]); } catch(e){}
        }
      }
    }
    if (_notifList.length > 0) {
      _notifLastSince = Math.max(..._notifList.map(n => n.ngayTao || 0));
    }
    renderNotifBadge();
    if (_notifPanelOpen) renderNotifList();
  } catch(e) {
    console.warn('[Notif] load lỗi:', e);
  }
}

function renderNotifBadge() {
  const badge = document.getElementById('header-bell-badge');
  const badgeNew = document.getElementById('cc-header-bell-badge');
  const unreadCount = _notifList.filter(n => !n.daXem).length;
  const txt = unreadCount > 99 ? '99+' : String(unreadCount);
  if (badge) {
    if (unreadCount > 0) { badge.textContent = txt; badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  }
  if (badgeNew) {
    if (unreadCount > 0) { badgeNew.textContent = txt; badgeNew.style.display = 'flex'; }
    else badgeNew.style.display = 'none';
  }
}

function toggleNotifPanel() {
  if (_notifPanelOpen) {
    closeNotifPanel();
  } else {
    openNotifPanel();
  }
}

function openNotifPanel() {
  _notifPanelOpen = true;
  document.getElementById('notif-panel').classList.add('show');
  document.getElementById('notif-panel-bd').classList.add('show');
  // Load latest from DB (reset=true) then render
  loadNotifications(true).then(() => {
    renderNotifList();
  }).catch(() => { renderNotifList(); });
}

function closeNotifPanel() {
  _notifPanelOpen = false;
  document.getElementById('notif-panel').classList.remove('show');
  document.getElementById('notif-panel-bd').classList.remove('show');
}

// [v9.45] Drag-to-dismiss: kéo từ trên panel xuống để đóng (iOS style)
(function() {
  let _startY = 0;
  let _currentY = 0;
  let _isDragging = false;
  let _panel = null;
  
  function _attachDrag() {
    _panel = document.getElementById('notif-panel');
    if (!_panel) return;
    
    // Touch start ở vùng trên cùng (drag handle area + header — top 60px)
    _panel.addEventListener('touchstart', (e) => {
      const rect = _panel.getBoundingClientRect();
      const touchY = e.touches[0].clientY;
      // Chỉ active drag khi user touch ở vùng top 60px (handle + header area)
      if (touchY - rect.top > 60) return;
      _startY = touchY;
      _currentY = touchY;
      _isDragging = true;
      _panel.style.transition = 'none';
    }, { passive: true });
    
    _panel.addEventListener('touchmove', (e) => {
      if (!_isDragging) return;
      _currentY = e.touches[0].clientY;
      const delta = Math.max(0, _currentY - _startY);
      _panel.style.transform = `translateY(${delta}px)`;
    }, { passive: true });
    
    _panel.addEventListener('touchend', () => {
      if (!_isDragging) return;
      _isDragging = false;
      _panel.style.transition = '';
      const delta = _currentY - _startY;
      // Nếu kéo > 100px hoặc > 25% chiều cao panel → đóng
      if (delta > 100 || delta > _panel.offsetHeight * 0.25) {
        closeNotifPanel();
        // Reset transform sau khi animation đóng xong
        setTimeout(() => { _panel.style.transform = ''; }, 350);
      } else {
        _panel.style.transform = '';
      }
    });
  }
  
  // Đợi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _attachDrag);
  } else {
    _attachDrag();
  }
})();

function renderNotifList() {
  const container = document.getElementById('notif-list');
  if (!container) return;
  if (!_notifList.length) {
    container.innerHTML = '<div class="notif-empty">📭 Chưa có thông báo nào.</div>';
    return;
  }
  container.innerHTML = _notifList.map(n => {
    const iconEmoji = _notifIcon(n.loai);
    const iconCls = (n.loai || 'info').toLowerCase().replace(/_/g, '-');
    const timeTxt = _notifTimeAgo(n.ngayTao);
    return `<div class="notif-item ${n.daXem ? '' : 'unread'}" data-id="${n.id}" data-link="${n.link || ''}" onclick="onNotifClick('${n.id}','${n.link || ''}')">
      <div class="notif-item-icon ${iconCls}">${iconEmoji}</div>
      <div class="notif-item-content">
        <div class="notif-item-title">${_escTBHtml(n.tieuDe)}</div>
        <div class="notif-item-body">${_escTBHtml(n.noiDung)}</div>
        <div class="notif-item-time">${timeTxt}</div>
      </div>
      ${!n.daXem ? '<div class="notif-item-unread-dot"></div>' : ''}
    </div>`;
  }).join('');
}

function _escTBHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function _notifIcon(loai) {
  const map = {
    'DON_DUYET': '✅',
    'DON_TUCHOI': '❌',
    'DON_NGHI_MOI': '📅',
    'DON_HOAN_TAC': '↩',
    'CB_DUYET': '✅',
    'CB_TUCHOI': '❌',
    'CB_MOI': '⚠',
    'CB_HOAN_TAC': '↩',
    'GT_MOI': '📝',
    'DN_MOI': '🏖',
    'DN_DUYET': '✅',
    'DN_TUCHOI': '❌',
    'LC_MOI': '📅',
    'LICH_MOI': '📋',
    'SV_ASSIGN': '📌',
    'SV_ESCALATE': '⚠',
    'BG_XAC_NHAN': '✅',
    'AI_DIGEST': '🗒',
    'INFO': '🔔',
  };
  return map[loai] || '🔔';
}

function _notifTimeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return min + ' phút trước';
  const h = Math.floor(min / 60);
  if (h < 24) return h + ' giờ trước';
  const d = Math.floor(h / 24);
  if (d < 7) return d + ' ngày trước';
  // Format ngày/tháng
  const date = new Date(ts);
  return pad(date.getDate()) + '/' + pad(date.getMonth() + 1);
}

// [v11.5 TB-04] Click thông báo → mark đã xem + deep link đến trang
async function onNotifClick(id, link) {
  const notif = _notifList.find(n => n.id === id);
  if (notif && !notif.daXem) {
    notif.daXem = true;
    renderNotifBadge();
    renderNotifList();
    try { await supa.rpc('fn_danh_dau_da_xem_tb', { p_ids: [id] }); } catch(e){}
  }
  // [v13.39] AI_DIGEST: nội dung dài → mở modal đọc toàn văn, không deep-link
  if (notif && notif.loai === 'AI_DIGEST') {
    closeNotifPanel();
    setTimeout(() => _showDigestModal(notif), 200);
    return;
  }
  closeNotifPanel();
  if (link) {
    setTimeout(() => {
      const linkMap = {
        'duyetyc': 'duyetyc',
        'nhansu': 'nhansu',
        'donnghi-cuatoi': 'donnghi-acc',
        'lichca': 'lichca',
        'dashboard': 'dashboard',
        'giocong': 'giocong',
      };
      const page = linkMap[link] || link;
      goToPage(page);
      // [v12-FIX] Chuyển đúng sub-tab dựa vào loại thông báo
      if(page === 'duyetyc' && notif){
        const loai = notif.loai || '';
        if(loai.startsWith('GT_') || loai.startsWith('CB_')){
          setTimeout(()=>setYCTab('giaitrinh'), 300);
        } else if(loai.startsWith('DN_') || loai === 'DON_NGHI_MOI'){
          setTimeout(()=>setYCTab('donnghi'), 300);
        }
      }
    }, 100);
  }
}

async function danhDauDaXemTatCa() {
  const ids = _notifList.filter(n => !n.daXem).map(n => n.id);
  if (!ids.length) {
    showToast('Tất cả thông báo đã được đánh dấu', 'ok');
    return;
  }
  _notifList.forEach(n => { n.daXem = true; });
  renderNotifBadge();
  renderNotifList();
  try {
    await supa.rpc('fn_danh_dau_da_xem_tb', { p_ids: ids });
  } catch(e){ console.warn('Mark read error:', e); }
  showToast('✓ Đã đánh dấu ' + ids.length + ' thông báo', 'ok');
}

// ═══════════════════════════════════════════════════════════
// [v10] SILENT BADGE UPDATE cho menu Tài khoản
// ═══════════════════════════════════════════════════════════
function _silentUpdateAccBadges(){
  if(!SESSION)return;
  const isQL=SESSION.vaiTro==='QLNS'||SESSION.vaiTro==='ADMIN';
  if(isQL){
    // [v12-FIX] Badge = tổng chưa duyệt (không giới hạn tháng)
    supa.rpc('fn_get_duyet_yeu_cau', { p_tu_ngay: '2020-01-01', p_den_ngay: '2999-12-31', p_trang_thai: null })
    .then(({ data: res, error }) => {
      if(error || !res)return;
      const sDN = (res.donNghi || []).length;
      const sGT = (res.giaiTrinh || []).length;
      const tot = sDN + sGT;
      const b=document.getElementById('acc-duyetyc-badge');
      if(b){b.textContent=tot>0?String(tot):'';b.style.display=tot>0?'flex':'none';}
      const b2=document.getElementById('acc-dnp-badge');
      if(b2){b2.textContent=sDN>0?String(sDN):'';b2.style.display=sDN>0?'flex':'none';}
    }).catch(()=>{});
  } else {
    // [v12-P3] Supabase RPC - NV xem
    supa.rpc('fn_get_don_nghi_cua_toi', { p_ma_nv: SESSION.ma })
    .then(({ data: arr, error }) => {
      if(error || !Array.isArray(arr))return;
      const cho = arr.filter(d => d.trangThai === 'Chờ duyệt').length;
      const b=document.getElementById('acc-dnp-badge');
      if(b){b.textContent=cho>0?String(cho):'';b.style.display=cho>0?'flex':'none';}
    }).catch(()=>{});
  }
}

// ═══════════════════════════════════════════════════════════
// [v10.85] GIAO DIỆN — Đổi màu chủ đạo (accent)
// Đổi biến --green (màu chính), --green-m (nhạt hơn), --green-lt (rất nhạt), --green-bd (viền)
// Và <meta name="theme-color"> → iOS status bar đổi theo
// ═══════════════════════════════════════════════════════════
const MAU_MAC_DINH = '#0F6E56';

// Chuyển hex "#RRGGBB" → {r,g,b}
function _hexToRgb(hex){
  const h = hex.replace('#','').trim();
  if(h.length !== 6) return null;
  return {
    r: parseInt(h.substring(0,2),16),
    g: parseInt(h.substring(2,4),16),
    b: parseInt(h.substring(4,6),16),
  };
}
function _isHexHopLe(s){
  return /^#[0-9A-Fa-f]{6}$/.test((s||'').trim());
}
// Tạo shade: ratio dương → sáng hơn (mix với trắng); âm → tối hơn (mix với đen)
function _trayMau(hex, ratio){
  const c = _hexToRgb(hex); if(!c) return hex;
  let r,g,b;
  if(ratio>=0){
    r = Math.round(c.r + (255-c.r)*ratio);
    g = Math.round(c.g + (255-c.g)*ratio);
    b = Math.round(c.b + (255-c.b)*ratio);
  } else {
    const k = 1 + ratio; // -0.3 → 0.7
    r = Math.round(c.r*k);
    g = Math.round(c.g*k);
    b = Math.round(c.b*k);
  }
  const _hh = v => v.toString(16).padStart(2,'0');
  return '#' + _hh(r) + _hh(g) + _hh(b);
}
function _rgba(hex, a){
  const c = _hexToRgb(hex); if(!c) return hex;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function _apDungMauChinh(hex){
  if(!_isHexHopLe(hex)) hex = MAU_MAC_DINH;
  const hexLower = hex.toUpperCase();
  const mauSang  = _trayMau(hex, 0.25);
  const mauNhat  = _rgba(hex, 0.12);
  const mauVien  = _rgba(hex, 0.5);
  const mauShadow= _rgba(hex, 0.35);
  const mauToi   = _trayMau(hex, -0.1);
  const root = document.documentElement;
  root.style.setProperty('--green',        hexLower);
  root.style.setProperty('--green-m',      mauSang);
  root.style.setProperty('--green-lt',     mauNhat);
  root.style.setProperty('--green-bd',     mauVien);
  root.style.setProperty('--green-shadow', mauShadow);
  // iOS status bar + Android chrome
  const meta = document.getElementById('meta-theme-color');
  if(meta) meta.setAttribute('content', mauToi);
  // Lưu
  localStorage.setItem('_mauChinh', hexLower);
}

function chonMauChinh(hex){
  if(!_isHexHopLe(hex)){ showToast('Mã màu không hợp lệ.','err'); return; }
  _apDungMauChinh(hex);
  _capNhatGDUI();
  showToast(hex.toUpperCase()===MAU_MAC_DINH ? '✓ Đã khôi phục màu mặc định' : '🎨 Đã đổi màu chủ đạo','ok');
}

function _guiMauChinhTuHex(v){
  // Cho phép gõ có hoặc không có #
  v = (v||'').trim();
  if(v && v[0]!=='#') v = '#'+v;
  if(_isHexHopLe(v)) _apDungMauChinh(v);
  _capNhatGDUI();
}

function _capNhatGDUI(){
  const cur = (localStorage.getItem('_mauChinh') || MAU_MAC_DINH).toUpperCase();
  // Swatch preset: highlight cái đang chọn
  document.querySelectorAll('.gd-swatch').forEach(el=>{
    el.classList.toggle('selected', (el.dataset.color||'').toUpperCase()===cur);
  });
  // Picker và ô hex — đồng bộ giá trị
  const picker = document.getElementById('gd-picker');
  const hexInp = document.getElementById('gd-picker-hex');
  if(picker) picker.value = cur;
  if(hexInp && document.activeElement!==hexInp) hexInp.value = cur;
}

// Áp màu từ localStorage ngay khi parse HTML (trước khi login)
try{
  const saved = localStorage.getItem('_mauChinh');
  if(saved && _isHexHopLe(saved)) _apDungMauChinh(saved);
}catch(e){}

// ─── End giao diện ───────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════
// [v11] MODULE BÁN HÀNG
// ═══════════════════════════════════════════════════════════════════

// [v13.39] Modal đọc toàn văn AI Tổng hợp sáng
function _showDigestModal(notif){
  let modal = document.getElementById('ai-digest-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'ai-digest-modal';
  modal.className = 'ai-digest-modal-bg';
  // Giữ nguyên xuống dòng từ nội dung digest
  const safeBody = _escTBHtml(notif.noiDung).replace(/\n/g, '<br>');
  modal.innerHTML = `
    <div class="ai-digest-modal">
      <div class="ai-digest-head">
        <div class="ai-digest-ttl">${_escTBHtml(notif.tieuDe)}</div>
        <button class="ai-digest-x" onclick="document.getElementById('ai-digest-modal').remove()">✕</button>
      </div>
      <div class="ai-digest-body">${safeBody}</div>
      <div class="ai-digest-foot">Bản phân tích tạo tự động bởi AI lúc 7h sáng</div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}
