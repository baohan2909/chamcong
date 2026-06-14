/* ════════════════════════════════════════════════════════════════════════
 *  PHÂN HỆ ĐƠN HÀNG ONLINE — MÀN CỬA HÀNG NHẬN ĐƠN  [v13.45]
 *  Polling (nhất quán app, tránh quota Realtime). Popup đếm ngược + cạnh tranh.
 *  Nhận: dh_fn_ch_nhan (atomic). Từ chối: dh_fn_ch_tu_choi (bắt lý do).
 * ════════════════════════════════════════════════════════════════════════ */

let dhNhanPollTimer = null;
let dhNhanCountdown = null;
let dhNhanSeen      = {};      // dp_id đã thấy → phát hiện đơn mới
let dhNhanMaCh      = null;    // mã CH của user (null = ADMIN xem tất cả)
let dhNhanPopupDon  = null;    // đơn đang hiện popup

const DH_LY_DO = ['Hết size', 'Hết màu', 'Hết hàng', 'Đang bận'];

// ─── Init ───────────────────────────────────────────────────────────────
window.dhNhanInit = function(){
  if (!_dhCanAccess()) {
    showToast && showToast('Phân hệ đang chạy thử — chỉ tài khoản NS00490', 'warn');
    goToPage('home'); return;
  }
  const cheDo  = _getSetting('donhang.che_do', 'demo');
  const isCH    = (SESSION && SESSION.vaiTro === 'CUA_HANG');
  // ADMIN xem tất cả (demo); CH thật lọc theo cửa hàng mình
  dhNhanMaCh = (isCH && SESSION.cuaHangMa) ? SESSION.cuaHangMa : null;

  const scope = document.getElementById('dh-nhan-scope');
  if (scope) scope.textContent = dhNhanMaCh ? ('Cửa hàng ' + dhNhanMaCh) : 'Chế độ xem tất cả (ADMIN)';

  const tag = document.getElementById('dh-nhan-demo-tag');
  if (tag) {
    if (cheDo === 'live') { tag.textContent = 'LIVE'; tag.classList.add('dh-tag-live'); }
    else { tag.textContent = 'DEMO'; tag.classList.remove('dh-tag-live'); }
  }

  dhNhanSeen = {};
  dhNhanPoll();
  if (dhNhanPollTimer) clearInterval(dhNhanPollTimer);
  dhNhanPollTimer = setInterval(dhNhanPoll, 4000);
};

window.dhNhanLeave = function(){
  if (dhNhanPollTimer) { clearInterval(dhNhanPollTimer); dhNhanPollTimer = null; }
  dhNhanClosePopup();
};

// ─── Polling: lấy đơn chờ → render list + popup nếu có đơn mới ───────────
async function dhNhanPoll(){
  try {
    const { data, error } = await supa.rpc('dh_fn_don_cho_ch', { p_ma_ch: dhNhanMaCh });
    if (error) throw error;
    const list = Array.isArray(data) ? data : [];
    dhNhanRenderList(list);

    // Phát hiện đơn mới (chưa từng thấy) → hiện popup cho đơn mới nhất
    const moi = list.filter(d => !dhNhanSeen[d.dp_id]);
    list.forEach(d => { dhNhanSeen[d.dp_id] = true; });
    if (moi.length && !dhNhanPopupDon) {
      dhNhanShowPopup(moi[0]);
    }
  } catch(e) {
    // im lặng, thử lại lần poll sau
  }
}

function _dhTien(x){ return Number(x||0).toLocaleString('vi-VN'); }

function dhNhanRenderList(list){
  const box = document.getElementById('dh-nhan-list');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = '<div class="dh-nhan-empty">Chưa có đơn nào đang chờ.</div>';
    return;
  }
  box.innerHTML = list.map(d => `
    <div class="dh-nhan-card" onclick='dhNhanShowPopupById(${d.dp_id})'>
      <div class="dh-nhan-card-top">
        <span class="dh-nhan-madon">${escHtml(d.ma_don||'')}</span>
        <span class="dh-nhan-km">${d.km!=null? Number(d.km).toFixed(1)+' km':''}</span>
      </div>
      <div class="dh-nhan-sp">${escHtml(d.sp_ten||'')}${d.sp_size?(' · '+escHtml(d.sp_size)):''} · SL ${d.so_luong||1}</div>
      <div class="dh-nhan-meta">
        <span class="dh-nhan-gt">${_dhTien(d.gia_tri)}đ</span>
        <span class="dh-nhan-pt ${d.phuong_thuc_tt==='CK_TRUOC'?'dh-pt-ck':''}">${d.phuong_thuc_tt==='CK_TRUOC'?'CK trước':'COD'}</span>
      </div>
    </div>`).join('');
  // lưu để mở popup theo id
  window._dhNhanData = {};
  list.forEach(d => { window._dhNhanData[d.dp_id] = d; });
}

window.dhNhanShowPopupById = function(dpId){
  const d = window._dhNhanData && window._dhNhanData[dpId];
  if (d) dhNhanShowPopup(d);
};

// ─── Popup nhận đơn + đếm ngược ─────────────────────────────────────────
function dhNhanShowPopup(d){
  dhNhanPopupDon = d;
  const ov = document.getElementById('dh-nhan-popup');
  if (!ov) return;

  document.getElementById('dh-pop-madon').textContent = d.ma_don || '';
  document.getElementById('dh-pop-sp').textContent = (d.sp_ten||'') + (d.sp_size? (' · Size '+d.sp_size):'');
  document.getElementById('dh-pop-sl').textContent = 'SL ' + (d.so_luong||1);
  document.getElementById('dh-pop-km').textContent = (d.km!=null? Number(d.km).toFixed(1)+' km' : '--');
  document.getElementById('dh-pop-gt').textContent = _dhTien(d.gia_tri) + 'đ';
  document.getElementById('dh-pop-pt').textContent = d.phuong_thuc_tt==='CK_TRUOC' ? 'Chuyển khoản trước' : 'COD - thu khi giao';
  document.getElementById('dh-pop-diachi').textContent = d.dia_chi_full || '';
  // ẩn modal lý do nếu đang mở
  const lydo = document.getElementById('dh-pop-lydo'); if (lydo) lydo.style.display = 'none';

  ov.style.display = 'flex';

  // Đếm ngược từ timeout setting
  let secs = parseInt(_getSetting('donhang.timeout_giay', 180)) || 180;
  const timerEl = document.getElementById('dh-pop-timer');
  const _fmt = s => Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
  if (timerEl) { timerEl.textContent = _fmt(secs); timerEl.classList.remove('dh-timer-red'); }
  if (dhNhanCountdown) clearInterval(dhNhanCountdown);
  dhNhanCountdown = setInterval(() => {
    secs--;
    if (timerEl) {
      timerEl.textContent = _fmt(Math.max(0,secs));
      if (secs <= 30) timerEl.classList.add('dh-timer-red');
    }
    if (secs <= 0) { clearInterval(dhNhanCountdown); dhNhanClosePopup(); }
  }, 1000);
}

function dhNhanClosePopup(){
  if (dhNhanCountdown) { clearInterval(dhNhanCountdown); dhNhanCountdown = null; }
  dhNhanPopupDon = null;
  const ov = document.getElementById('dh-nhan-popup');
  if (ov) ov.style.display = 'none';
}
window.dhNhanClosePopup = dhNhanClosePopup;

// ─── Nhận đơn (ATOMIC) ──────────────────────────────────────────────────
window.dhNhanAccept = async function(){
  const d = dhNhanPopupDon;
  if (!d) return;
  const btn = document.getElementById('dh-pop-btn-nhan');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang nhận...'; }
  try {
    const { data, error } = await supa.rpc('dh_fn_ch_nhan', {
      p_don_id: d.don_id, p_ma_ch: d.ma_ch, p_ten_ch: d.ten_ch
    });
    if (error) throw error;
    if (data && data.ok) {
      showToast && showToast('Đã nhận đơn ' + (d.ma_don||'') + ' — chuẩn bị hàng + lên POS', 'success');
      dhNhanClosePopup();
      dhNhanPoll();
    } else {
      showToast && showToast((data && data.error) || 'Đơn đã có cửa hàng khác nhận', 'warn');
      dhNhanClosePopup();
      dhNhanPoll();
    }
  } catch(e) {
    showToast && showToast('Lỗi: ' + (e.message||e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Nhận đơn'; }
  }
};

// ─── Từ chối: mở chọn lý do ─────────────────────────────────────────────
window.dhNhanOpenReject = function(){
  const lydo = document.getElementById('dh-pop-lydo');
  if (!lydo) return;
  lydo.innerHTML = DH_LY_DO.map(l =>
    `<button class="dh-lydo-btn" onclick="dhNhanReject('${l}')">${l}</button>`
  ).join('');
  lydo.style.display = 'flex';
};

window.dhNhanReject = async function(lyDo){
  const d = dhNhanPopupDon;
  if (!d) return;
  try {
    const { data, error } = await supa.rpc('dh_fn_ch_tu_choi', {
      p_don_id: d.don_id, p_ma_ch: d.ma_ch, p_ly_do: lyDo
    });
    if (error) throw error;
    showToast && showToast('Đã từ chối đơn (' + lyDo + ')', 'info');
    dhNhanClosePopup();
    dhNhanPoll();
  } catch(e) {
    showToast && showToast('Lỗi: ' + (e.message||e), 'error');
  }
};
