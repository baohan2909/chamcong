/* ════════════════════════════════════════════════════════════════════════════
 *  Nón Sơn — [v18.62] TRUNG TÂM KIỂM SOÁT LIVESTREAM (Admin + QLNS)
 *
 *  Tab riêng cho Quản trị & QLNS: toàn cảnh tham gia theo KHOẢNG NGÀY, báo cáo
 *  TẦN SUẤT từng NV, tường PHẢN HỒI kèm ảnh (xem/đánh giá), xếp hạng cửa hàng.
 *  Dữ liệu: fn_ls_control_tong_quan / fn_ls_control_tan_suat / fn_ls_control_phan_hoi
 *  (SQL v18.62 — đã chặn quyền server-side bằng fn_ls_xem_bc).
 * ──────────────────────────────────────────────────────────────────────────── */

/* ─── State ─── */
let _lscTu = null, _lscDen = null, _lscPreset = '7d';
let _lscMaCh = null, _lscKv = null;
let _lscTQ = null, _lscTrend = [], _lscCH = [];
let _lscTS = [];                 // tần suất NV (mảng gốc để sort/xuất)
let _lscTSSort = { col: 'tong_luot', dir: -1 };
let _lscFb = [];                 // phản hồi (mảng gốc để lọc client)
let _lscFbLoai = null, _lscFbCoAnh = false, _lscFbTheoLoai = {};
let _lscBusy = false;

function _lscCoQuyen() {
  if (typeof SESSION === 'undefined' || !SESSION || !SESSION.ma) return false;
  var r = String(SESSION.vaiTro || '').toUpperCase();
  return r === 'ADMIN' || r === 'QLNS' || SESSION.ma === 'NS00490';
}
function _lscEsc(s) { return (typeof escHtml === 'function') ? escHtml(s == null ? '' : s) : String(s == null ? '' : s); }
function _lscNum(n) { return Number(n || 0).toLocaleString('vi-VN'); }
function _lscPad(n) { return (n < 10 ? '0' : '') + n; }
function _lscYmd(d) { return d.getFullYear() + '-' + _lscPad(d.getMonth() + 1) + '-' + _lscPad(d.getDate()); }
function _lscAvColor(ma) {
  var pal = ['#0F766E', '#B01E62', '#185FA5', '#9C6212', '#0F6E56', '#7A3EA1', '#A32D2D', '#1D7A8C'];
  var h = 0, s = String(ma || '');
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return pal[h % pal.length];
}
function _lscInitials(ten, ma) {
  var t = String(ten || ma || '?').trim().split(/\s+/).filter(Boolean);
  if (t.length >= 2) return (t[t.length - 2][0] + t[t.length - 1][0]).toUpperCase();
  return (t[0] || '?').substring(0, 2).toUpperCase();
}

/* ─── Khoảng ngày ─── */
function _lscApplyPreset(p) {
  var now = new Date();
  var den = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var tu = new Date(den);
  if (p === 'today') { /* tu=den */ }
  else if (p === '30d') tu.setDate(tu.getDate() - 29);
  else { p = '7d'; tu.setDate(tu.getDate() - 6); }
  _lscPreset = p; _lscTu = _lscYmd(tu); _lscDen = _lscYmd(den);
}

/* ════════════════ VÀO TRANG ════════════════ */
function lscInitPage() {
  var root = document.getElementById('lsc-root');
  if (!root) return;
  if (!_lscCoQuyen()) {
    root.innerHTML = '<div class="lsc-empty">Chức năng dành cho Quản trị &amp; Quản lý nhân sự.</div>';
    return;
  }
  if (!_lscTu) _lscApplyPreset('7d');
  root.innerHTML = _lscShellHTML();
  _lscWireControls();
  lscReload();
}

function _lscShellHTML() {
  return '' +
    '<div class="lsc-hero">' +
      '<div class="lsc-hero-top">' +
        '<span class="lsc-badge"><span class="lsc-livedot"></span> Giám sát trực tiếp</span>' +
        '<span class="lsc-badge">Quản trị · QLNS</span>' +
      '</div>' +
      '<h1>Trung tâm Kiểm soát Livestream</h1>' +
      '<p>Toàn cảnh tham gia, tần suất nhân viên và phản hồi thực địa. Dữ liệu realtime từ phiên xem TikTok đi–về.</p>' +
    '</div>' +
    '<div class="lsc-controls">' +
      '<div class="lsc-seg" id="lsc-seg">' +
        '<button data-r="today">Hôm nay</button>' +
        '<button data-r="7d" class="on">7 ngày</button>' +
        '<button data-r="30d">30 ngày</button>' +
        '<button data-r="custom">Tùy chọn</button>' +
      '</div>' +
      '<div class="lsc-custom" id="lsc-custom">' +
        '<input type="date" id="lsc-tu"> <span style="color:var(--text-lt)">→</span> <input type="date" id="lsc-den">' +
        '<button class="lsc-btn ghost" id="lsc-apply" style="padding:6px 12px">Xem</button>' +
      '</div>' +
      '<span class="lsc-inp"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
        '<select id="lsc-kv"><option value="">Toàn khu vực</option></select></span>' +
      '<span class="lsc-spacer"></span>' +
      '<button class="lsc-btn" id="lsc-export"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg> Xuất CSV</button>' +
    '</div>' +
    '<div id="lsc-kpis" class="lsc-kpis"></div>' +
    '<div class="lsc-card"><div class="lsc-card-h"><span class="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></span><h2>Xu hướng theo ngày</h2><span class="cnt">Lượt &amp; Phản hồi</span></div>' +
      '<div id="lsc-trend"></div></div>' +
    '<div class="lsc-card"><div class="lsc-card-h"><span class="ic mag"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span><h2>Tần suất nhân viên</h2><span class="cnt" id="lsc-ts-cnt">—</span></div>' +
      '<div class="lsc-tblwrap" id="lsc-ts"></div></div>' +
    '<div class="lsc-grid2">' +
      '<div class="lsc-card"><div class="lsc-card-h"><span class="ic mag"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span><h2>Tường phản hồi</h2><span class="cnt" id="lsc-fb-cnt">—</span></div>' +
        '<div id="lsc-fb-filter" class="lsc-fb-filter"></div><div id="lsc-fb" class="lsc-fb-grid"></div></div>' +
      '<div class="lsc-card"><div class="lsc-card-h"><span class="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg></span><h2>Xếp hạng cửa hàng</h2></div>' +
        '<div id="lsc-ch" class="lsc-rank"></div></div>' +
    '</div>' +
    '<div class="lsc-modal-ov" id="lsc-modal-ov"></div>' +
    '<div class="lsc-lightbox" id="lsc-lightbox"><button class="x" onclick="lscCloseAnh()">×</button><img id="lsc-lightbox-img" src="" alt=""></div>';
}

function _lscWireControls() {
  var seg = document.getElementById('lsc-seg');
  if (seg) seg.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { lscSetRange(b.getAttribute('data-r')); });
  });
  var ap = document.getElementById('lsc-apply');
  if (ap) ap.addEventListener('click', lscApplyCustom);
  var kv = document.getElementById('lsc-kv');
  if (kv) kv.addEventListener('change', function () { _lscKv = kv.value || null; lscReload(); });
  var ex = document.getElementById('lsc-export');
  if (ex) ex.addEventListener('click', lscExportCsv);
  var lb = document.getElementById('lsc-lightbox');
  if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) lscCloseAnh(); });
}

function lscSetRange(r) {
  var seg = document.getElementById('lsc-seg');
  if (seg) seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-r') === r); });
  var cus = document.getElementById('lsc-custom');
  if (r === 'custom') {
    if (cus) cus.classList.add('show');
    var it = document.getElementById('lsc-tu'), id = document.getElementById('lsc-den');
    if (it && !it.value) it.value = _lscTu; if (id && !id.value) id.value = _lscDen;
    return; // chờ bấm "Xem"
  }
  if (cus) cus.classList.remove('show');
  _lscApplyPreset(r);
  lscReload();
}
function lscApplyCustom() {
  var it = document.getElementById('lsc-tu'), id = document.getElementById('lsc-den');
  if (!it || !id || !it.value || !id.value) { if (typeof showToast === 'function') showToast('Chọn đủ 2 ngày', 'warn'); return; }
  var tu = it.value, den = id.value;
  if (tu > den) { var t = tu; tu = den; den = t; }
  _lscTu = tu; _lscDen = den; _lscPreset = 'custom';
  lscReload();
}

/* ════════════════ TẢI DỮ LIỆU ════════════════ */
async function lscReload() {
  if (_lscBusy) return;
  _lscBusy = true;
  var elK = document.getElementById('lsc-kpis');
  if (elK) elK.innerHTML = '<div class="lsc-loading" style="grid-column:1/-1">⏳ Đang tải báo cáo…</div>';
  var args = { p_ma_admin: SESSION.ma, p_tu: _lscTu, p_den: _lscDen, p_ma_ch: _lscMaCh, p_kv: _lscKv };
  try {
    var r = await Promise.all([
      supa.rpc('fn_ls_control_tong_quan', args),
      supa.rpc('fn_ls_control_tan_suat', args),
      supa.rpc('fn_ls_control_phan_hoi', { p_ma_admin: SESSION.ma, p_tu: _lscTu, p_den: _lscDen, p_ma_ch: _lscMaCh, p_limit: 200 })
    ]);
    var tq = (r[0].data) || {}, ts = (r[1].data) || {}, fb = (r[2].data) || {};
    if (r[0].error) throw r[0].error;
    if (tq.ok === false) { if (elK) elK.innerHTML = '<div class="lsc-err" style="grid-column:1/-1">' + _lscEsc(tq.error || 'Không có quyền') + '</div>'; _lscBusy = false; return; }
    _lscTQ = tq.tong_quan || {}; _lscTrend = tq.xu_huong || []; _lscCH = tq.theo_ch || [];
    _lscTS = (ts && ts.ds) || [];
    _lscFb = (fb && fb.ds) || []; _lscFbTheoLoai = (fb && fb.theo_loai) || {};
    _lscRenderKPI(); _lscRenderTrend(); _lscRenderTS(); _lscRenderCH();
    _lscRenderFbFilter(); _lscRenderFb();
    _lscFillKvOptions();
  } catch (e) {
    if (elK) elK.innerHTML = '<div class="lsc-err" style="grid-column:1/-1">Lỗi tải: ' + _lscEsc((e && e.message) || '') + '</div>';
  }
  _lscBusy = false;
}

function _lscFillKvOptions() {
  var sel = document.getElementById('lsc-kv');
  if (!sel || sel.dataset.filled) return;
  var kvs = {};
  _lscCH.forEach(function (c) { if (c.khu_vuc) kvs[c.khu_vuc] = 1; });
  var keys = Object.keys(kvs).sort();
  if (!keys.length) return;
  keys.forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o); });
  sel.dataset.filled = '1';
}

/* ─── KPI ─── */
function _lscRenderKPI() {
  var t = _lscTQ || {}, el = document.getElementById('lsc-kpis');
  if (!el) return;
  var soNV = t.so_nv_xem || 0, soDat = t.so_nv_dat || 0;
  var pctDat = soNV ? Math.round(soDat * 100 / soNV) : 0;
  var tbLuot = soNV ? (Math.round((t.tong_luot || 0) * 10 / soNV) / 10) : 0;
  var pctPh = soNV ? Math.round((t.so_nv_co_ph || 0) * 100 / soNV) : 0;
  el.innerHTML =
    _lscKpi('', 'NV tham gia', _lscNum(soNV), (t.so_ngay_ky || 0) + ' ngày') +
    _lscKpi('k-green', 'Đạt KPI ' + (t.so_lan_ngay || 10) + ' lượt', _lscNum(soDat), pctDat + '% tổng NV') +
    _lscKpi('k-mag', 'Tổng lượt xem', _lscNum(t.tong_luot || 0), 'TB ' + String(tbLuot).replace('.', ',') + ' lượt/NV') +
    _lscKpi('', 'Phút TikTok', _lscNum(t.tong_phut || 0), '≈ ' + _lscNum(Math.round((t.tong_phut || 0) / 60)) + ' giờ') +
    _lscKpi('k-mag', 'Phản hồi', _lscNum(t.tong_phan_hoi || 0), (t.ph_co_anh || 0) + ' kèm ảnh') +
    _lscKpi('k-red', 'Tỉ lệ có phản hồi', pctPh + '%', (t.so_nv_co_ph || 0) + ' NV');
}
function _lscKpi(cls, lbl, val, sub) {
  return '<div class="lsc-kpi ' + cls + '"><div class="lbl">' + _lscEsc(lbl) + '</div>' +
    '<div class="val lsc-num">' + _lscEsc(val) + '</div><div class="sub">' + _lscEsc(sub) + '</div></div>';
}

/* ─── Xu hướng ─── */
function _lscRenderTrend() {
  var el = document.getElementById('lsc-trend');
  if (!el) return;
  var arr = _lscTrend || [];
  if (!arr.length) { el.innerHTML = '<div class="lsc-empty">Chưa có dữ liệu trong kỳ.</div>'; return; }
  var maxL = 1, maxP = 1, n = arr.length;
  arr.forEach(function (d) { maxL = Math.max(maxL, d.tong_luot || 0); maxP = Math.max(maxP, d.so_ph || 0); });
  var step = n <= 8 ? 1 : Math.ceil(n / 8);
  var dows = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var todayYmd = _lscYmd(new Date());
  var html = '<div class="lsc-trend">';
  arr.forEach(function (d, i) {
    var h1 = Math.round((d.tong_luot || 0) / maxL * 100);
    var h2 = Math.round((d.so_ph || 0) / maxP * 42);
    var isToday = d.ngay === todayYmd;
    var lbl = '';
    if (isToday) lbl = 'Nay';
    else if (i % step === 0 || i === n - 1) {
      var parts = String(d.ngay).split('-');
      lbl = n <= 8 ? dows[new Date(d.ngay + 'T00:00:00').getDay()] : (parts[2] + '/' + parts[1]);
    }
    html += '<div class="lsc-tbar' + (isToday ? ' hot' : '') + '" title="' + _lscEsc(d.ngay) + ': ' + (d.tong_luot || 0) + ' lượt · ' + (d.so_ph || 0) + ' phản hồi">' +
      '<div class="stack"><div class="b1" style="height:' + h1 + '%"></div><div class="b2" style="height:' + h2 + '%"></div></div>' +
      '<span class="d">' + lbl + '</span></div>';
  });
  html += '</div><div class="lsc-legend"><span><i style="background:var(--green)"></i>Lượt xem hợp lệ</span><span><i style="background:var(--lsc-mag)"></i>Phản hồi</span></div>';
  el.innerHTML = html;
}

/* ─── Tần suất NV (sắp xếp được) ─── */
function _lscRenderTS() {
  var el = document.getElementById('lsc-ts');
  if (!el) return;
  var cnt = document.getElementById('lsc-ts-cnt');
  if (cnt) cnt.textContent = _lscTS.length + ' NV';
  if (!_lscTS.length) { el.innerHTML = '<div class="lsc-empty">Chưa có nhân viên nào tham gia trong kỳ.</div>'; return; }
  _lscSortTSData();
  var cols = [
    { k: 'ten_nv', t: 'Nhân viên', r: 0 }, { k: 'ten_ch', t: 'Cửa hàng', r: 0 },
    { k: 'so_ngay_tham_gia', t: 'Ngày TG', r: 1 }, { k: 'tong_luot', t: 'Tổng lượt', r: 1 },
    { k: 'tb_luot', t: 'TB/ngày', r: 1 }, { k: 'tong_phut', t: 'Phút TT', r: 1 },
    { k: 'so_phan_hoi', t: 'Phản hồi', r: 1 }, { k: 'muc_do', t: 'Mức độ', r: 0 }
  ];
  var thead = '<thead><tr>';
  cols.forEach(function (c) {
    var sorted = _lscTSSort.col === c.k;
    var ar = sorted ? (_lscTSSort.dir < 0 ? '▼' : '▲') : '↕';
    thead += '<th class="' + (c.r ? 'r ' : '') + (sorted ? 'sorted' : '') + '" data-col="' + c.k + '">' + _lscEsc(c.t) + ' <span class="ar">' + ar + '</span></th>';
  });
  thead += '</tr></thead>';
  var sngay = (_lscTQ && _lscTQ.so_ngay_ky) || 7;
  var caret = '<svg class="lsc-caret" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 18l6-6-6-6"/></svg>';
  var body = '<tbody>';
  _lscTS.forEach(function (n) {
    var md = n.muc_do === 'TICH_CUC' ? ['ok', 'Tích cực'] : n.muc_do === 'IT' ? ['low', 'Ít tham gia'] : ['mid', 'Trung bình'];
    body += '<tr class="clk" data-nv="' + _lscEsc(n.ma_nv) + '" title="Xem chi tiết ' + _lscEsc(n.ten_nv || n.ma_nv) + '">' +
      '<td><div class="lsc-nv"><span class="lsc-av" style="background:' + _lscAvColor(n.ma_nv) + '">' + _lscEsc(_lscInitials(n.ten_nv, n.ma_nv)) + '</span>' +
        '<div><div class="nm">' + _lscEsc(n.ten_nv || n.ma_nv) + '</div><div class="mc">' + _lscEsc(n.ma_nv) + '</div></div></div></td>' +
      '<td class="lsc-td-ch">' + _lscEsc(n.ten_ch || '—') + '</td>' +
      '<td class="r"><span class="lsc-big">' + (n.so_ngay_tham_gia || 0) + '</span><span style="color:var(--ink-3)">/' + sngay + '</span></td>' +
      '<td class="r lsc-big">' + _lscNum(n.tong_luot || 0) + '</td>' +
      '<td class="r lsc-num">' + String(n.tb_luot || 0).replace('.', ',') + '</td>' +
      '<td class="r lsc-num">' + _lscNum(n.tong_phut || 0) + '′</td>' +
      '<td class="r ' + ((n.so_phan_hoi || 0) === 0 ? '' : 'lsc-big') + '"' + ((n.so_phan_hoi || 0) === 0 ? ' style="color:#C6373C"' : '') + '>' + (n.so_phan_hoi || 0) + '</td>' +
      '<td><span style="display:inline-flex;align-items:center;gap:6px"><span class="lsc-chip ' + md[0] + '">' + md[1] + '</span>' + caret + '</span></td>' +
      '</tr>';
  });
  body += '</tbody>';
  el.innerHTML = '<table class="lsc-tbl">' + thead + body + '</table>';
  el.querySelectorAll('th[data-col]').forEach(function (th) {
    th.addEventListener('click', function () { lscSortTS(th.getAttribute('data-col')); });
  });
  el.querySelectorAll('tr.clk').forEach(function (tr) {
    tr.addEventListener('click', function () { lscOpenNV(tr.getAttribute('data-nv')); });
  });
}
function _lscSortTSData() {
  var c = _lscTSSort.col, dir = _lscTSSort.dir;
  var txt = (c === 'ten_nv' || c === 'ten_ch' || c === 'muc_do');
  var mdOrder = { TICH_CUC: 3, TRUNG_BINH: 2, IT: 1 };
  _lscTS.sort(function (a, b) {
    var va = a[c], vb = b[c];
    if (c === 'muc_do') { va = mdOrder[va] || 0; vb = mdOrder[vb] || 0; return (va - vb) * dir; }
    if (txt) { va = String(va || ''); vb = String(vb || ''); return va.localeCompare(vb, 'vi') * dir; }
    return ((Number(va) || 0) - (Number(vb) || 0)) * dir;
  });
}
function lscSortTS(col) {
  if (_lscTSSort.col === col) _lscTSSort.dir *= -1;
  else { _lscTSSort.col = col; _lscTSSort.dir = (col === 'ten_nv' || col === 'ten_ch') ? 1 : -1; }
  _lscRenderTS();
}

/* ─── Tường phản hồi ─── */
function _lscRenderFbFilter() {
  var el = document.getElementById('lsc-fb-filter');
  if (!el) return;
  var tl = _lscFbTheoLoai || {};
  var tong = (tl.UU_DIEM || 0) + (tl.KHUYET_DIEM || 0) + (tl.CAI_THIEN || 0) + (tl.KHAC || 0);
  var chips = [
    ['', 'Tất cả', tong], ['UU_DIEM', 'Ưu điểm', tl.UU_DIEM || 0],
    ['KHUYET_DIEM', 'Khuyết điểm', tl.KHUYET_DIEM || 0], ['CAI_THIEN', 'Cải thiện', tl.CAI_THIEN || 0],
    ['__ANH', 'Có ảnh', tl.CO_ANH || 0]
  ];
  var html = '';
  chips.forEach(function (c) {
    var on = (c[0] === '__ANH') ? _lscFbCoAnh : (!_lscFbCoAnh && _lscFbLoai === (c[0] || null));
    html += '<button class="lsc-fchip' + (on ? ' on' : '') + '" data-l="' + c[0] + '">' + _lscEsc(c[1]) + ' <span class="b">' + c[2] + '</span></button>';
  });
  el.innerHTML = html;
  el.querySelectorAll('.lsc-fchip').forEach(function (b) {
    b.addEventListener('click', function () { lscFilterFb(b.getAttribute('data-l')); });
  });
  var cnt = document.getElementById('lsc-fb-cnt');
  if (cnt) cnt.textContent = tong + ' trong kỳ';
}
function lscFilterFb(l) {
  if (l === '__ANH') { _lscFbCoAnh = !_lscFbCoAnh; _lscFbLoai = null; }
  else { _lscFbLoai = l || null; _lscFbCoAnh = false; }
  _lscRenderFbFilter(); _lscRenderFb();
}
function _lscRenderFb() {
  var el = document.getElementById('lsc-fb');
  if (!el) return;
  var ds = _lscFb.filter(function (p) {
    if (_lscFbCoAnh) return !!p.anh_url;
    if (_lscFbLoai) return p.loai === _lscFbLoai;
    return true;
  });
  if (!ds.length) { el.innerHTML = '<div class="lsc-empty" style="grid-column:1/-1">Không có phản hồi phù hợp.</div>'; return; }
  var TAG = { UU_DIEM: ['uu', 'Ưu điểm'], KHUYET_DIEM: ['khuyet', 'Khuyết điểm'], CAI_THIEN: ['cai', 'Cải thiện'] };
  var html = '';
  ds.slice(0, 120).forEach(function (p) {
    var tg = TAG[p.loai] || ['khac', 'Khác'];
    html += '<div class="lsc-fb">';
    if (p.anh_url) html += '<div class="lsc-fb-thumb" onclick="lscOpenAnh(\'' + _lscEsc(p.anh_url).replace(/'/g, "\\'") + '\')"><img loading="lazy" src="' + _lscEsc(p.anh_url) + '" alt=""></div>';
    html += '<div class="lsc-fb-body"><div class="lsc-fb-top"><b>' + _lscEsc(p.ten_nv || p.ma_nv) + '</b>' +
      '<span class="lsc-fb-tag ' + tg[0] + '">' + tg[1] + '</span>' +
      '<span class="lsc-fb-meta">' + _lscEsc(p.ngay || '') + ' ' + _lscEsc(p.gio || '') + '</span></div>' +
      '<div class="lsc-fb-txt">' + _lscEsc(p.noi_dung || '') + '</div>' +
      '<div class="lsc-fb-ch"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> ' +
      _lscEsc(p.ten_ch || p.ma_ch || '—') + ' · ' + _lscEsc(p.ma_nv) + '</div></div></div>';
  });
  el.innerHTML = html;
}
function lscOpenAnh(url) {
  var lb = document.getElementById('lsc-lightbox'), im = document.getElementById('lsc-lightbox-img');
  if (!lb || !im) return; im.src = url; lb.classList.add('show');
}
function lscCloseAnh() { var lb = document.getElementById('lsc-lightbox'); if (lb) lb.classList.remove('show'); }

/* ─── Xếp hạng cửa hàng ─── */
function _lscRenderCH() {
  var el = document.getElementById('lsc-ch');
  if (!el) return;
  var arr = _lscCH || [];
  if (!arr.length) { el.innerHTML = '<div class="lsc-empty">Chưa có hoạt động.</div>'; return; }
  var maxL = 1; arr.forEach(function (c) { maxL = Math.max(maxL, c.tong_luot || 0); });
  var html = '';
  arr.slice(0, 20).forEach(function (c, i) {
    var w = Math.round((c.tong_luot || 0) / maxL * 100);
    html += '<div class="lsc-rrow' + (i < 3 ? ' top' + (i + 1) : '') + '"><span class="lsc-rnum">' + (i + 1) + '</span>' +
      '<div class="lsc-rname">' + _lscEsc(c.ten_ch || c.ma_ch || '—') + '<small>' + (c.so_nv || 0) + ' NV · ' + (c.so_dat || 0) + ' đạt KPI</small></div>' +
      '<div class="lsc-rbar"><i style="width:' + w + '%"></i></div>' +
      '<div class="lsc-rstat"><div class="n lsc-num">' + _lscNum(c.tong_luot || 0) + '</div><div class="l">lượt</div></div></div>';
  });
  el.innerHTML = html;
}

/* ─── Xuất CSV (báo cáo tần suất) ─── */
function lscExportCsv() {
  if (!_lscTS.length) { if (typeof showToast === 'function') showToast('Chưa có dữ liệu để xuất', 'warn'); return; }
  var head = ['Mã NV', 'Tên NV', 'Cửa hàng', 'Khu vực', 'Ngày tham gia', 'Tổng lượt', 'TB lượt/ngày', 'Phút TikTok', 'Phản hồi', 'Ngày đạt KPI', 'Mức độ'];
  var mdTxt = { TICH_CUC: 'Tích cực', TRUNG_BINH: 'Trung bình', IT: 'Ít tham gia' };
  var rows = _lscTS.map(function (n) {
    return [n.ma_nv, n.ten_nv, n.ten_ch, n.khu_vuc || '', n.so_ngay_tham_gia, n.tong_luot, n.tb_luot, n.tong_phut, n.so_phan_hoi, n.so_ngay_dat, mdTxt[n.muc_do] || n.muc_do];
  });
  var csv = [head].concat(rows).map(function (r) {
    return r.map(function (v) { var s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
  }).join('\r\n');
  var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'tan-suat-livestream_' + _lscTu + '_' + _lscDen + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  if (typeof showToast === 'function') showToast('✓ Đã xuất ' + _lscTS.length + ' NV ra CSV', 'ok');
}

/* ─── Chi tiết 1 nhân viên (bấm dòng bảng tần suất) ─── */
async function lscOpenNV(maNV) {
  var ov = document.getElementById('lsc-modal-ov');
  if (!ov || !maNV) return;
  ov.innerHTML = '<div class="lsc-modal"><div class="lsc-loading">⏳ Đang tải hồ sơ…</div></div>';
  ov.classList.add('show');
  ov.onclick = function (e) { if (e.target === ov) lscCloseNV(); };
  try {
    var r = await supa.rpc('fn_ls_control_nv', { p_ma_admin: SESSION.ma, p_ma_nv: maNV, p_tu: _lscTu, p_den: _lscDen });
    if (r.error) throw r.error;
    var d = r.data || {};
    if (d.ok === false) { ov.querySelector('.lsc-modal').innerHTML = '<div class="lsc-err">' + _lscEsc(d.error || 'Lỗi') + '</div>'; return; }
    _lscRenderNVModal(ov, d);
  } catch (e) {
    var m = ov.querySelector('.lsc-modal'); if (m) m.innerHTML = '<div class="lsc-err">Lỗi tải: ' + _lscEsc((e && e.message) || '') + '</div>';
  }
}
function lscCloseNV() { var ov = document.getElementById('lsc-modal-ov'); if (ov) { ov.classList.remove('show'); ov.innerHTML = ''; } }
function _lscMStat(v, l) { return '<div><b>' + _lscEsc(v) + '</b><span>' + _lscEsc(l) + '</span></div>'; }
function _lscRenderNVModal(ov, d) {
  var nv = d.nv || {}, ngay = d.theo_ngay || [], ph = d.phan_hoi || [];
  var TAG = { UU_DIEM: ['uu', 'Ưu điểm'], KHUYET_DIEM: ['khuyet', 'Khuyết điểm'], CAI_THIEN: ['cai', 'Cải thiện'] };
  var h = '<div class="lsc-modal">' +
    '<div class="lsc-modal-hero"><button class="lsc-modal-x" onclick="lscCloseNV()">×</button>' +
      '<div class="lsc-modal-prof"><span class="av">' + _lscEsc(_lscInitials(nv.ten_nv, nv.ma_nv)) + '</span>' +
        '<div><div class="nm">' + _lscEsc(nv.ten_nv || nv.ma_nv) + '</div>' +
        '<div class="mt">' + _lscEsc(nv.ma_nv) + (nv.chuc_vu ? ' · ' + _lscEsc(nv.chuc_vu) : '') + (nv.khu_vuc ? ' · ' + _lscEsc(nv.khu_vuc) : '') + '</div></div></div>' +
    '</div>' +
    '<div class="lsc-modal-stat">' +
      _lscMStat(nv.so_ngay_tham_gia || 0, 'Ngày TG') + _lscMStat(_lscNum(nv.tong_luot || 0), 'Tổng lượt') +
      _lscMStat(_lscNum(nv.tong_phut || 0) + '′', 'Phút TT') + _lscMStat(nv.so_ngay_dat || 0, 'Ngày đạt') +
    '</div>';
  h += '<div class="lsc-modal-sec"><h3>Theo ngày</h3>';
  if (!ngay.length) h += '<div class="lsc-empty" style="padding:12px">Không có ngày tham gia trong kỳ.</div>';
  ngay.forEach(function (g) {
    h += '<div class="lsc-day"><span class="dd">' + _lscEsc(g.ngay) + '</span>' +
      '<span class="mt">' + (g.luot || 0) + ' lượt · ' + (g.phut || 0) + '′ · ' + (g.phan_hoi || 0) + ' PH</span>' +
      '<span class="dt ' + (g.dat ? 'ok' : 'no') + '">' + (g.dat ? 'Đạt' : 'Chưa') + '</span></div>';
  });
  h += '</div><div class="lsc-modal-sec"><h3>Phản hồi (' + ph.length + ')</h3>';
  if (!ph.length) h += '<div class="lsc-empty" style="padding:12px">Chưa có phản hồi trong kỳ.</div>';
  ph.forEach(function (p) {
    var tg = TAG[p.loai] || ['khac', 'Khác'];
    h += '<div class="lsc-fb" style="background:#fff;margin-bottom:8px">';
    if (p.anh_url) h += '<div class="lsc-fb-thumb" onclick="lscOpenAnh(\'' + _lscEsc(p.anh_url).replace(/'/g, "\\'") + '\')"><img loading="lazy" src="' + _lscEsc(p.anh_url) + '"></div>';
    h += '<div class="lsc-fb-body"><div class="lsc-fb-top"><span class="lsc-fb-tag ' + tg[0] + '">' + tg[1] + '</span>' +
      '<span class="lsc-fb-meta">' + _lscEsc(p.khi || '') + '</span></div>' +
      '<div class="lsc-fb-txt">' + _lscEsc(p.noi_dung || '') + '</div>' +
      '<div class="lsc-fb-ch">' + _lscEsc(p.ten_ch || '—') + '</div></div></div>';
  });
  h += '</div></div>';
  ov.innerHTML = h;
  ov.onclick = function (e) { if (e.target === ov) lscCloseNV(); };
}

/* Globals */
window.lscInitPage = lscInitPage;
window.lscOpenNV = lscOpenNV;
window.lscCloseNV = lscCloseNV;
window.lscSetRange = lscSetRange;
window.lscApplyCustom = lscApplyCustom;
window.lscReload = lscReload;
window.lscSortTS = lscSortTS;
window.lscFilterFb = lscFilterFb;
window.lscOpenAnh = lscOpenAnh;
window.lscCloseAnh = lscCloseAnh;
window.lscExportCsv = lscExportCsv;
