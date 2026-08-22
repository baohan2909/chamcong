/* ════════════════════════════════════════════════════════════════════════════
 *  Nón Sơn — [v18.63] CHI TIẾT PHẢN HỒI LIVESTREAM (Admin + QLNS)
 *
 *  Tab riêng: xem/soi TỪNG phản hồi NV kèm ảnh, + THEO DÕI BQL nào đã xem phản hồi
 *  nào (read-receipt) → Aroma kiểm soát cả Ban quản lý. Mở chi tiết = tự đánh dấu
 *  mình đã xem (fn_ls_ph_danh_dau_xem). Lọc: loại / có ảnh / CHƯA AI XEM.
 *  RPC: fn_ls_feedback (list + da_xem[]) · fn_ls_ph_danh_dau_xem.
 * ──────────────────────────────────────────────────────────────────────────── */

let _lsfTu = null, _lsfDen = null, _lsfPreset = '7d';
let _lsfFb = [], _lsfStat = {}, _lsfFilter = 'all', _lsfBusy = false;

function _lsfCoQuyen() {
  if (typeof SESSION === 'undefined' || !SESSION || !SESSION.ma) return false;
  var r = String(SESSION.vaiTro || '').toUpperCase();
  return r === 'ADMIN' || r === 'QLNS' || SESSION.ma === 'NS00490';
}
function _lsfEsc(s) { return (typeof escHtml === 'function') ? escHtml(s == null ? '' : s) : String(s == null ? '' : s); }
function _lsfPad(n) { return (n < 10 ? '0' : '') + n; }
function _lsfYmd(d) { return d.getFullYear() + '-' + _lsfPad(d.getMonth() + 1) + '-' + _lsfPad(d.getDate()); }
function _lsfColor(ma) {
  var pal = ['#1E5F63', '#D6006C', '#185FA5', '#9C6212', '#148A5C', '#7A3EA1', '#C6373C', '#0F766E'];
  var h = 0, s = String(ma || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return pal[h % pal.length];
}
function _lsfInitials(ten, ma) {
  var t = String(ten || ma || '?').trim().split(/\s+/).filter(Boolean);
  if (t.length >= 2) return (t[t.length - 2][0] + t[t.length - 1][0]).toUpperCase();
  return (t[0] || '?').substring(0, 2).toUpperCase();
}
function _lsfApplyPreset(p) {
  var now = new Date(), den = new Date(now.getFullYear(), now.getMonth(), now.getDate()), tu = new Date(den);
  if (p === 'today') {} else if (p === '30d') tu.setDate(tu.getDate() - 29); else { p = '7d'; tu.setDate(tu.getDate() - 6); }
  _lsfPreset = p; _lsfTu = _lsfYmd(tu); _lsfDen = _lsfYmd(den);
}

/* ════════════════ VÀO TRANG ════════════════ */
function lsfInitPage() {
  var root = document.getElementById('lsf-root');
  if (!root) return;
  if (!_lsfCoQuyen()) { root.innerHTML = '<div class="lsc-empty">Chức năng dành cho Quản trị &amp; Quản lý nhân sự.</div>'; return; }
  if (!_lsfTu) _lsfApplyPreset('7d');
  root.innerHTML = _lsfShellHTML();
  _lsfWire();
  lsfReload();
}
function _lsfShellHTML() {
  return '' +
    '<div class="lsc-hero">' +
      '<div class="lsc-hero-top"><span class="lsc-badge live"><span class="lsc-livedot"></span> Kiểm soát BQL</span><span class="lsc-badge">Ai đã xem phản hồi</span></div>' +
      '<h1>Chi tiết phản hồi Livestream</h1>' +
      '<p>Soi từng phản hồi nhân viên kèm ảnh, và theo dõi <b>Ban quản lý nào đã xem</b> — mở một phản hồi là hệ thống ghi nhận bạn đã duyệt.</p>' +
    '</div>' +
    '<div class="lsc-controls">' +
      '<div class="lsc-seg" id="lsf-seg"><button data-r="today">Hôm nay</button><button data-r="7d" class="on">7 ngày</button><button data-r="30d">30 ngày</button><button data-r="custom">Tùy chọn</button></div>' +
      '<div class="lsc-custom" id="lsf-custom"><input type="date" id="lsf-tu"> <span style="color:var(--ink-3)">→</span> <input type="date" id="lsf-den"> <button class="lsc-btn ghost" id="lsf-apply" style="padding:6px 12px">Xem</button></div>' +
      '<span class="lsc-spacer"></span>' +
      '<button class="lsc-btn ghost" id="lsf-refresh"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/></svg> Làm mới</button>' +
    '</div>' +
    '<div id="lsf-filter" class="lsc-fb-filter" style="padding:0 0 12px"></div>' +
    '<div id="lsf-list"></div>' +
    '<div class="lsc-modal-ov" id="lsf-modal-ov"></div>' +
    '<div class="lsc-lightbox" id="lsf-lightbox"><button class="x" onclick="lsfCloseAnh()">×</button><img id="lsf-lightbox-img" src="" alt=""></div>';
}
function _lsfWire() {
  var seg = document.getElementById('lsf-seg');
  if (seg) seg.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { lsfSetRange(b.getAttribute('data-r')); }); });
  var ap = document.getElementById('lsf-apply'); if (ap) ap.addEventListener('click', lsfApplyCustom);
  var rf = document.getElementById('lsf-refresh'); if (rf) rf.addEventListener('click', lsfReload);
  var lb = document.getElementById('lsf-lightbox'); if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) lsfCloseAnh(); });
}
function lsfSetRange(r) {
  var seg = document.getElementById('lsf-seg');
  if (seg) seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-r') === r); });
  var cus = document.getElementById('lsf-custom');
  if (r === 'custom') { if (cus) cus.classList.add('show'); var it = document.getElementById('lsf-tu'), id = document.getElementById('lsf-den'); if (it && !it.value) it.value = _lsfTu; if (id && !id.value) id.value = _lsfDen; return; }
  if (cus) cus.classList.remove('show');
  _lsfApplyPreset(r); lsfReload();
}
function lsfApplyCustom() {
  var it = document.getElementById('lsf-tu'), id = document.getElementById('lsf-den');
  if (!it || !id || !it.value || !id.value) { if (typeof showToast === 'function') showToast('Chọn đủ 2 ngày', 'warn'); return; }
  var tu = it.value, den = id.value; if (tu > den) { var t = tu; tu = den; den = t; }
  _lsfTu = tu; _lsfDen = den; _lsfPreset = 'custom'; lsfReload();
}

/* ════════════════ TẢI ════════════════ */
async function lsfReload() {
  if (_lsfBusy) return; _lsfBusy = true;
  var list = document.getElementById('lsf-list');
  if (list) list.innerHTML = '<div class="lsc-loading">⏳ Đang tải phản hồi…</div>';
  try {
    var r = await supa.rpc('fn_ls_feedback', { p_ma_admin: SESSION.ma, p_tu: _lsfTu, p_den: _lsfDen, p_ma_ch: null, p_limit: 300 });
    if (r.error) throw r.error;
    var d = r.data || {};
    if (d.ok === false) { if (list) list.innerHTML = '<div class="lsc-err">' + _lsfEsc(d.error || 'Không có quyền') + '</div>'; _lsfBusy = false; return; }
    _lsfFb = d.ds || []; _lsfStat = d.thong_ke || {};
    _lsfRenderFilter(); _lsfRenderList();
  } catch (e) {
    if (list) list.innerHTML = '<div class="lsc-err">Lỗi tải: ' + _lsfEsc((e && e.message) || '') + '</div>';
  }
  _lsfBusy = false;
}
function _lsfRenderFilter() {
  var el = document.getElementById('lsf-filter'); if (!el) return;
  var s = _lsfStat || {};
  var tong = (s.UU_DIEM || 0) + (s.KHUYET_DIEM || 0) + (s.CAI_THIEN || 0) + (s.KHAC || 0);
  var chips = [
    ['all', 'Tất cả', tong, 0], ['__CHUA', 'Chưa ai xem', s.CHUA_XEM || 0, 1],
    ['UU_DIEM', 'Ưu điểm', s.UU_DIEM || 0, 0], ['KHUYET_DIEM', 'Khuyết điểm', s.KHUYET_DIEM || 0, 0],
    ['CAI_THIEN', 'Cải thiện', s.CAI_THIEN || 0, 0], ['__ANH', 'Có ảnh', s.CO_ANH || 0, 0]
  ];
  var html = '';
  chips.forEach(function (c) {
    var on = _lsfFilter === c[0];
    html += '<button class="lsc-fchip' + (c[3] ? ' alert' : '') + (on ? ' on' : '') + '" data-f="' + c[0] + '">' + _lsfEsc(c[1]) + ' <span class="b">' + c[2] + '</span></button>';
  });
  el.innerHTML = html;
  el.querySelectorAll('.lsc-fchip').forEach(function (b) { b.addEventListener('click', function () { lsfFilter(b.getAttribute('data-f')); }); });
}
function lsfFilter(f) { _lsfFilter = f || 'all'; _lsfRenderFilter(); _lsfRenderList(); }

function _lsfMatch(p) {
  if (_lsfFilter === 'all') return true;
  if (_lsfFilter === '__ANH') return !!p.anh_url;
  if (_lsfFilter === '__CHUA') return (p.so_xem || 0) === 0;
  return p.loai === _lsfFilter;
}
function _lsfSeenHTML(p) {
  var av = p.da_xem || [];
  if (!av.length) return '<div class="lsc-seen"><span class="lsc-seen-lbl">BQL đã xem</span><span class="lsc-seen-none">Chưa ai xem</span></div>';
  var avs = '';
  av.slice(0, 4).forEach(function (v) {
    avs += '<span class="lsc-seen-av" style="background:' + _lsfColor(v.ma_ql) + '" title="' + _lsfEsc(v.ho_ten || v.ma_ql) + ' · ' + _lsfEsc(v.luc || '') + '">' + _lsfEsc(_lsfInitials(v.ho_ten, v.ma_ql)) + '</span>';
  });
  var more = av.length > 4 ? '<span class="lsc-seen-more">+' + (av.length - 4) + '</span>' : '';
  return '<div class="lsc-seen"><span class="lsc-seen-lbl">BQL đã xem</span><span class="lsc-seen-avs">' + avs + '</span>' + more + '</div>';
}
function _lsfRenderList() {
  var el = document.getElementById('lsf-list'); if (!el) return;
  var ds = _lsfFb.filter(_lsfMatch);
  if (!ds.length) { el.innerHTML = '<div class="lsc-card"><div class="lsc-empty">Không có phản hồi phù hợp bộ lọc.</div></div>'; return; }
  var TAG = { UU_DIEM: ['uu', 'Ưu điểm'], KHUYET_DIEM: ['khuyet', 'Khuyết điểm'], CAI_THIEN: ['cai', 'Cải thiện'] };
  var html = '<div class="lsc-card"><div class="lsc-fb-grid" style="padding:14px">';
  ds.slice(0, 200).forEach(function (p) {
    var tg = TAG[p.loai] || ['khac', 'Khác'];
    var unseen = (p.so_xem || 0) === 0;
    html += '<div class="lsc-fb' + (unseen ? ' unseen' : '') + '" style="cursor:pointer" onclick="lsfOpenDetail(' + Number(p.id) + ')">';
    if (p.anh_url) html += '<div class="lsc-fb-thumb"><img loading="lazy" src="' + _lsfEsc(p.anh_url) + '"></div>';
    html += '<div class="lsc-fb-body"><div class="lsc-fb-top"><b>' + _lsfEsc(p.ten_nv || p.ma_nv) + '</b>' +
      '<span class="lsc-fb-tag ' + tg[0] + '">' + tg[1] + '</span><span class="lsc-fb-meta">' + _lsfEsc(p.ngay || '') + ' ' + _lsfEsc(p.gio || '') + '</span></div>' +
      '<div class="lsc-fb-txt">' + _lsfEsc(p.noi_dung || '') + '</div>' +
      '<div class="lsc-fb-ch"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> ' + _lsfEsc(p.ten_ch || p.ma_ch || '—') + ' · ' + _lsfEsc(p.ma_nv) + '</div>' +
      _lsfSeenHTML(p) + '</div></div>';
  });
  html += '</div></div>';
  el.innerHTML = html;
}

/* ─── Mở chi tiết + ĐÁNH DẤU đã xem ─── */
async function lsfOpenDetail(id) {
  var p = null; for (var i = 0; i < _lsfFb.length; i++) if (Number(_lsfFb[i].id) === Number(id)) { p = _lsfFb[i]; break; }
  if (!p) return;
  var ov = document.getElementById('lsf-modal-ov'); if (!ov) return;
  _lsfRenderDetail(ov, p);
  ov.classList.add('show');
  ov.onclick = function (e) { if (e.target === ov) lsfCloseDetail(); };
  // Đánh dấu BQL hiện tại đã xem (không chặn UI)
  try {
    var r = await supa.rpc('fn_ls_ph_danh_dau_xem', { p_ma_ql: SESSION.ma, p_id_ph: Number(id) });
    if (r && r.data && r.data.ok) {
      var me = String(SESSION.ma), exist = (p.da_xem || []).some(function (v) { return String(v.ma_ql) === me; });
      if (!exist) {
        p.da_xem = (p.da_xem || []).concat([{ ma_ql: me, ho_ten: SESSION.ten || me, luc: 'vừa xong' }]);
        p.so_xem = (p.so_xem || 0) + 1;
        if (_lsfStat.CHUA_XEM && (p.so_xem === 1)) { _lsfStat.CHUA_XEM--; _lsfStat.DA_XEM = (_lsfStat.DA_XEM || 0) + 1; }
        _lsfRenderFilter(); _lsfRenderList(); _lsfRenderDetail(ov, p); // cập nhật lại
      }
    }
  } catch (e) {}
}
function lsfCloseDetail() { var ov = document.getElementById('lsf-modal-ov'); if (ov) { ov.classList.remove('show'); ov.innerHTML = ''; } }
function _lsfRenderDetail(ov, p) {
  var TAG = { UU_DIEM: ['uu', 'Ưu điểm'], KHUYET_DIEM: ['khuyet', 'Khuyết điểm'], CAI_THIEN: ['cai', 'Cải thiện'] };
  var tg = TAG[p.loai] || ['khac', 'Khác'];
  var h = '<div class="lsc-modal"><div class="lsc-modal-hero"><button class="lsc-modal-x" onclick="lsfCloseDetail()">×</button>' +
    '<div class="lsc-modal-prof"><span class="av">' + _lsfEsc(_lsfInitials(p.ten_nv, p.ma_nv)) + '</span>' +
      '<div><div class="nm">' + _lsfEsc(p.ten_nv || p.ma_nv) + '</div><div class="mt">' + _lsfEsc(p.ma_nv) + ' · ' + _lsfEsc(p.ten_ch || p.ma_ch || '—') + '</div></div></div></div>';
  h += '<div class="lsc-modal-sec" style="padding-top:14px">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span class="lsc-fb-tag ' + tg[0] + '">' + tg[1] + '</span>' +
    '<span class="lsc-fb-meta">' + _lsfEsc(p.ngay || '') + ' ' + _lsfEsc(p.gio || '') + (p.kenh ? ' · ' + _lsfEsc(p.kenh) : '') + '</span></div>' +
    '<div style="font-size:14px;line-height:1.6;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px 14px">' + _lsfEsc(p.noi_dung || '') + '</div>';
  if (p.anh_url) h += '<div style="margin-top:12px"><img src="' + _lsfEsc(p.anh_url) + '" onclick="lsfOpenAnh(\'' + _lsfEsc(p.anh_url).replace(/'/g, "\\'") + '\')" style="width:100%;border-radius:12px;cursor:pointer;border:1px solid var(--line)"></div>';
  h += '</div>';
  // Ai đã xem
  var av = p.da_xem || [];
  h += '<div class="lsc-modal-sec"><h3>Ban quản lý đã xem (' + av.length + ')</h3>';
  if (!av.length) h += '<div class="lsc-seen-none" style="padding:6px 2px">Chưa có BQL nào xem phản hồi này</div>';
  av.forEach(function (v) {
    h += '<div class="lsc-day"><span class="lsc-seen-av" style="background:' + _lsfColor(v.ma_ql) + ';margin:0">' + _lsfEsc(_lsfInitials(v.ho_ten, v.ma_ql)) + '</span>' +
      '<span class="mt" style="font-weight:700;color:var(--ink)">' + _lsfEsc(v.ho_ten || v.ma_ql) + '</span>' +
      '<span style="font-size:11px;color:var(--ink-3)">' + _lsfEsc(v.luc || '') + '</span></div>';
  });
  h += '</div></div>';
  ov.innerHTML = h;
  ov.onclick = function (e) { if (e.target === ov) lsfCloseDetail(); };
}
function lsfOpenAnh(url) { var lb = document.getElementById('lsf-lightbox'), im = document.getElementById('lsf-lightbox-img'); if (lb && im) { im.src = url; lb.classList.add('show'); } }
function lsfCloseAnh() { var lb = document.getElementById('lsf-lightbox'); if (lb) lb.classList.remove('show'); }

/* Globals */
window.lsfInitPage = lsfInitPage;
window.lsfSetRange = lsfSetRange;
window.lsfApplyCustom = lsfApplyCustom;
window.lsfReload = lsfReload;
window.lsfFilter = lsfFilter;
window.lsfOpenDetail = lsfOpenDetail;
window.lsfCloseDetail = lsfCloseDetail;
window.lsfOpenAnh = lsfOpenAnh;
window.lsfCloseAnh = lsfCloseAnh;
