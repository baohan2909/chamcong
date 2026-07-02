// ═══════════════════════════════════════════════════════════════════════════
//  HUB "ĐIỂM HỆ THỐNG" (admin) — [v17.63] Redesign
//  Banner cam gradient + hình tròn nền · tìm khu vực/cửa hàng/NV có gợi ý ·
//  sort thông minh · thẻ "Kiểm soát điểm trừ" (tổng quan + thống kê loại lỗi,
//  bấm loại để lọc) · danh sách NV bấm để xổ chi tiết + Xóa điểm trừ.
//  RPC: fn_diem_tat_ca (đã thêm ma_ch/ten_ch/cac_loai/thong_ke_loai) / fn_diem_chi_tiet / fn_toggle_mien_diem.
// ═══════════════════════════════════════════════════════════════════════════
let _diemHub = { list: [], tk: {}, khu: 'all', ch: null, nv: null, loai: null, sort: 'diem_asc', thang: null, open: new Set() };
let _diemSearchTimer;

function _diemThangHT() {
  const d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}
function _diemThangShift(thang, delta) {
  let y = parseInt(thang.substring(0, 4), 10), m = parseInt(thang.substring(5, 7), 10) + delta;
  while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
  return y + '-' + ('0' + m).slice(-2);
}
function _diemMau(diem) {
  if (diem == null) return { c: '#64748B', bg: '#F1F5F9' };
  if (diem >= 10) return { c: '#16A34A', bg: '#DCFCE7' };
  if (diem >= 7)  return { c: '#D97706', bg: '#FEF3C7' };
  return { c: '#DC2626', bg: '#FEE2E2' };
}
function _diemLoai(loai) {
  return ({
    QUEN_RA:       { t: 'Quên ra ca',    c: '#DC2626' },
    QUEN_VAO:      { t: 'Quên vào ca',   c: '#D97706' },
    THIEU_LICH:    { t: 'Thiếu lịch',    c: '#7C3AED' },
    THIEU_ANH:     { t: 'Thiếu ảnh',     c: '#0EA5E9' },
    THIEU_BANGIAO: { t: 'Thiếu bàn giao',c: '#C2410C' },
    BO_SUNG:       { t: 'Bổ sung ca',    c: '#0D9488' }
  })[loai] || { t: loai, c: '#64748B' };
}
function _diemNgay(s) {
  if (!s) return '';
  const p = String(s).substring(0, 10).split('-');
  return p.length === 3 ? (p[2] + '/' + p[1]) : s;
}

function diemHubOpen() {
  let ov = document.getElementById('diem-hub-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'diem-hub-ov'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#F1F5F9;display:flex;flex-direction:column';
  _diemHub = { list: [], tk: {}, khu: 'all', ch: null, nv: null, loai: null, sort: 'diem_asc', thang: _diemThangHT(), open: new Set() };
  ov.innerHTML = `
    <div style="position:relative;overflow:hidden;background:linear-gradient(135deg,#FDBA74,#F97316,#C2410C);color:#fff;padding:15px 16px;box-shadow:0 2px 10px rgba(194,65,18,.22)">
      <div style="position:absolute;top:-34px;right:-16px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.10)"></div>
      <div style="position:absolute;bottom:-42px;right:52px;width:88px;height:88px;border-radius:50%;background:rgba(255,255,255,.07)"></div>
      <div style="position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div style="min-width:0">
          <div style="font-size:10.5px;font-weight:700;letter-spacing:.6px;opacity:.85">ĐIỂM PHONG ĐỘ</div>
          <div style="font-size:20px;font-weight:800;margin-top:1px">Điểm hệ thống</div>
          <div style="font-size:11.5px;opacity:.8;margin-top:2px">Toàn bộ nhân viên · trừ điểm theo lỗi</div>
        </div>
        <div style="display:flex;gap:8px;flex:none">
          <button onclick="diemHubLoad()" style="background:rgba(255,255,255,.2);border:none;color:#fff;height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Tải lại</button>
          <button onclick="document.getElementById('diem-hub-ov').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:32px;height:32px;border-radius:8px;font-size:16px;cursor:pointer">✕</button>
        </div>
      </div>
    </div>
    <div id="diem-hub-controls" style="background:#fff;border-bottom:1px solid #E6EBF0;padding:10px 12px;display:flex;flex-direction:column;gap:9px"></div>
    <div id="diem-hub-body" style="flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch">
      <div style="text-align:center;color:#64748B;padding:34px">Đang tải...</div>
    </div>`;
  diemHubLoad();
}

function _diemHubControlsHtml() {
  const thLabel = 'Tháng ' + _diemHub.thang.substring(5, 7) + '/' + _diemHub.thang.substring(0, 4);
  const hasSearch = _diemHub.ch || _diemHub.nv;
  const btn = (dir, ch) => `<button onclick="diemHubThang(${dir})" style="flex:none;border:1px solid #E6EBF0;background:#fff;width:30px;height:30px;border-radius:9px;font-size:16px;color:#475569;cursor:pointer">${ch}</button>`;
  const sortOpt = (v, t) => `<option value="${v}"${_diemHub.sort === v ? ' selected' : ''}>${t}</option>`;
  return `
    <div style="display:flex;align-items:center;gap:8px">
      ${btn(-1, '‹')}
      <div style="flex:1;text-align:center;font-size:14px;font-weight:800;color:#0F2E45">${thLabel}</div>
      ${btn(1, '›')}
    </div>
    <div style="display:flex;gap:8px">
      <div style="flex:1;position:relative">
        <input type="text" value="${escHtml(diemSearchLabel())}" oninput="diemSearchInput(this.value)" onfocus="diemSearchInput(this.value)"
          placeholder="Tìm khu vực / cửa hàng / tên NV" autocomplete="off"
          style="width:100%;box-sizing:border-box;padding:9px 30px 9px 11px;border:1px solid #E2E8F0;border-radius:10px;font-size:13px;color:#0F2E45;background:#F8FAFC">
        <div id="diem-search-dd" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #E2E8F0;border-radius:11px;box-shadow:0 8px 22px rgba(15,46,69,.14);max-height:260px;overflow-y:auto;z-index:20;padding:4px"></div>
        ${hasSearch ? `<button onclick="diemSearchClear()" style="position:absolute;top:50%;right:6px;transform:translateY(-50%);border:none;background:#E2E8F0;color:#475569;width:20px;height:20px;border-radius:50%;font-size:12px;line-height:1;cursor:pointer">✕</button>` : ''}
      </div>
      <select onchange="diemHubSort(this.value)" style="flex:none;padding:9px 8px;border:1px solid #E2E8F0;border-radius:10px;font-size:12.5px;color:#0F2E45;background:#fff;max-width:130px">
        ${sortOpt('diem_asc', 'Điểm thấp→cao')}
        ${sortOpt('diem_desc', 'Điểm cao→thấp')}
        ${sortOpt('loi_desc', 'Lỗi nhiều→ít')}
        ${sortOpt('ten', 'Tên A→Z')}
      </select>
    </div>
    <div id="diem-hub-khu" style="display:flex;gap:7px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px"></div>`;
}

async function diemHubLoad() {
  const body = document.getElementById('diem-hub-body');
  const ctr = document.getElementById('diem-hub-controls');
  if (!body) return;
  if (ctr) ctr.innerHTML = _diemHubControlsHtml();
  body.innerHTML = '<div style="text-align:center;color:#64748B;padding:34px">Đang tải...</div>';
  try {
    const { data, error } = await supa.rpc('fn_diem_tat_ca', { p_thang: _diemHub.thang });
    if (error || !data || !data.success) {
      body.innerHTML = '<div style="text-align:center;color:#DC2626;padding:34px">Lỗi tải điểm: ' + escHtml((data && data.error) || (error && error.message) || '') + '</div>';
      return;
    }
    _diemHub.list = data.danh_sach || [];
    _diemHub.tk = data.thong_ke_loai || {};
    _diemHub.open = new Set();
    _diemHubPaint();
  } catch (e) {
    body.innerHTML = '<div style="text-align:center;color:#DC2626;padding:34px">Lỗi kết nối</div>';
  }
}

function diemHubThang(delta) {
  _diemHub.thang = _diemThangShift(_diemHub.thang, delta);
  _diemHub.khu = 'all'; _diemHub.ch = null; _diemHub.nv = null; _diemHub.loai = null;
  diemHubLoad();
}

function _diemHubPaint() {
  const ctr = document.getElementById('diem-hub-controls');
  if (ctr) ctr.innerHTML = _diemHubControlsHtml();
  _diemHubRenderKhu();
  const body = document.getElementById('diem-hub-body');
  if (!body) return;
  body.innerHTML = _diemHubAnalyticsHtml() + '<div id="diem-hub-list"></div>';
  _diemHubRender();
}

function _diemHubRenderKhu() {
  const el = document.getElementById('diem-hub-khu'); if (!el) return;
  const khus = Array.from(new Set(_diemHub.list.map(r => r.khu_vuc || '—'))).sort();
  const mk = (val, label) => {
    const on = _diemHub.khu === val;
    return `<button onclick="diemHubKhu('${escHtml(val)}')" style="flex:none;border:1px solid ${on ? '#C2410C' : '#E6EBF0'};background:${on ? '#FFF7ED' : '#fff'};color:${on ? '#C2410C' : '#475569'};font-weight:${on ? 800 : 600};font-size:12.5px;padding:6px 13px;border-radius:99px;cursor:pointer;white-space:nowrap">${escHtml(label)}</button>`;
  };
  el.innerHTML = mk('all', 'Tất cả (' + _diemHub.list.length + ')') + khus.map(k => mk(k, k)).join('');
}

function diemHubKhu(khu) { _diemHub.khu = khu; _diemHub.ch = null; _diemHub.nv = null; _diemHubPaint(); }
function diemHubSort(v) { _diemHub.sort = v || 'diem_asc'; _diemHubRender(); }
function diemHubLoai(loai) { _diemHub.loai = (_diemHub.loai === loai) ? null : loai; _diemHubPaint(); }

function _diemHubAnalyticsHtml() {
  const rows = _diemHub.list;
  const biTru = rows.filter(r => (r.so_loi || 0) > 0).length;
  const tongLoi = rows.reduce((s, r) => s + (r.so_loi || 0), 0);
  const diemTb = rows.length ? (rows.reduce((s, r) => s + (r.diem || 0), 0) / rows.length) : 0;
  const tk = _diemHub.tk || {};
  const keys = Object.keys(tk).filter(k => tk[k] > 0).sort((a, b) => tk[b] - tk[a]);
  const maxCnt = keys.length ? Math.max(...keys.map(k => tk[k])) : 1;
  const mini = (v, l, c) => `<div style="flex:1;text-align:center"><div style="font-size:19px;font-weight:800;color:${c};line-height:1">${v}</div><div style="font-size:10px;color:#94A3B8;margin-top:3px">${l}</div></div>`;
  const bars = keys.map(k => {
    const L = _diemLoai(k);
    const on = _diemHub.loai === k;
    const pct = Math.max(6, Math.round(tk[k] / maxCnt * 100));
    return `<div onclick="diemHubLoai('${k}')" style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:9px;cursor:pointer;background:${on ? '#FFF7ED' : 'transparent'};border:1px solid ${on ? '#FED7AA' : 'transparent'}">
      <div style="flex:none;width:88px;font-size:12px;font-weight:700;color:${L.c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(L.t)}</div>
      <div style="flex:1;height:8px;background:#F1F5F9;border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${L.c};border-radius:99px"></div></div>
      <div style="flex:none;font-size:12.5px;font-weight:800;color:#334155;min-width:26px;text-align:right">${tk[k]}</div>
    </div>`;
  }).join('');
  const loaiFilterNote = _diemHub.loai ? `<div style="font-size:11px;color:#C2410C;margin-top:6px">Đang lọc: <b>${escHtml(_diemLoai(_diemHub.loai).t)}</b> · bấm lại để bỏ</div>` : '';
  return `<div style="background:#fff;border-radius:14px;padding:13px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.05)">
    <div style="font-size:13px;font-weight:800;color:#0F2E45;margin-bottom:10px">Kiểm soát điểm trừ · ${escHtml('Tháng ' + _diemHub.thang.substring(5,7))}</div>
    <div style="display:flex;gap:6px;padding-bottom:11px;border-bottom:1px solid #F1F5F9;margin-bottom:9px">
      ${mini(biTru, 'NV bị trừ', '#C2410C')}
      ${mini(tongLoi, 'Tổng lỗi', '#DC2626')}
      ${mini(diemTb.toFixed(1), 'Điểm TB', '#059669')}
    </div>
    ${keys.length ? `<div style="font-size:11px;color:#94A3B8;margin-bottom:4px">Lỗi thường gặp (bấm để lọc)</div>${bars}` : '<div style="font-size:12.5px;color:#16A34A;text-align:center;padding:6px">Chưa có lỗi nào trong tháng</div>'}
    ${loaiFilterNote}
  </div>`;
}

function _diemHubFiltered() {
  let rows = _diemHub.list.slice();
  if (_diemHub.khu !== 'all') rows = rows.filter(r => (r.khu_vuc || '—') === _diemHub.khu);
  if (_diemHub.ch) rows = rows.filter(r => r.ma_ch === _diemHub.ch);
  if (_diemHub.nv) rows = rows.filter(r => r.ma_nv === _diemHub.nv);
  if (_diemHub.loai) rows = rows.filter(r => Array.isArray(r.cac_loai) && r.cac_loai.indexOf(_diemHub.loai) >= 0);
  const s = _diemHub.sort;
  const byName = (a, b) => (a.ho_ten || '').localeCompare(b.ho_ten || '', 'vi');
  rows.sort((a, b) => {
    if (s === 'diem_asc') return ((a.diem || 0) - (b.diem || 0)) || byName(a, b);
    if (s === 'diem_desc') return ((b.diem || 0) - (a.diem || 0)) || byName(a, b);
    if (s === 'loi_desc') return ((b.so_loi || 0) - (a.so_loi || 0)) || byName(a, b);
    if (s === 'ten') return byName(a, b);
    return 0;
  });
  return rows;
}

function _diemHubRender() {
  const list = document.getElementById('diem-hub-list'); if (!list) return;
  const rows = _diemHubFiltered();
  if (!rows.length) { list.innerHTML = '<div style="text-align:center;color:#64748B;padding:28px">Không có nhân viên phù hợp</div>'; return; }
  list.innerHTML = rows.map(r => {
    const m = _diemMau(r.diem);
    const kt = (r.ho_ten || '?').trim().charAt(0) || '?';
    const isOpen = _diemHub.open.has(r.ma_nv);
    return `<div style="background:#fff;border-radius:14px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.05);overflow:hidden">
      <div onclick="diemHubToggle('${escHtml(r.ma_nv)}')" style="display:flex;align-items:center;gap:11px;padding:11px 12px;cursor:pointer">
        <div style="flex:none;width:40px;height:40px;border-radius:11px;background:${m.bg};color:${m.c};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px">${escHtml(kt)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:#0F2E45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.ho_ten || r.ma_nv)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <div style="flex:1;height:6px;background:#F1F5F9;border-radius:99px;overflow:hidden;max-width:120px"><div style="height:100%;width:${Math.max(0, (r.diem || 0)) * 10}%;background:${m.c};border-radius:99px"></div></div>
            <div style="font-size:10.5px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${escHtml(r.ten_ch || r.khu_vuc || '—')}${r.so_loi ? ' · ' + r.so_loi + ' lỗi' : ''}</div>
          </div>
        </div>
        <div style="flex:none;text-align:right">
          <div style="font-size:22px;font-weight:900;color:${m.c};line-height:1">${r.diem == null ? '—' : r.diem}<span style="font-size:12px;color:#CBD5E1;font-weight:700">/10</span></div>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2.4" style="width:16px;height:16px;flex:none;transform:rotate(${isOpen ? 90 : 0}deg);transition:transform .15s"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div id="diem-ct-${escHtml(r.ma_nv)}" style="display:${isOpen ? 'block' : 'none'};border-top:1px solid #F1F5F9;padding:${isOpen ? '10px 12px' : '0'}">${isOpen ? '<div style="color:#94A3B8;font-size:12.5px;text-align:center;padding:8px">Đang tải...</div>' : ''}</div>
    </div>`;
  }).join('');
  _diemHub.open.forEach(ma => _diemHubLoadCt(ma));
}

function diemHubToggle(maNv) {
  if (_diemHub.open.has(maNv)) _diemHub.open.delete(maNv);
  else _diemHub.open.add(maNv);
  _diemHubRender();
}

async function _diemHubLoadCt(maNv) {
  const box = document.getElementById('diem-ct-' + maNv); if (!box) return;
  try {
    const { data, error } = await supa.rpc('fn_diem_chi_tiet', { p_ma_nv: maNv, p_thang: _diemHub.thang });
    if (error || !data || !data.success) { box.innerHTML = '<div style="color:#DC2626;font-size:12.5px;padding:8px">Lỗi tải chi tiết</div>'; return; }
    const sk = data.su_kien || [];
    if (!sk.length) { box.innerHTML = '<div style="color:#16A34A;font-size:12.5px;text-align:center;padding:10px 8px">Không có lỗi nào trong tháng</div>'; return; }
    box.innerHTML = sk.map(e => {
      const L = _diemLoai(e.loai);
      const off = e.da_mien;
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid #F5F7FA">
        <div style="flex:none;width:8px;height:8px;border-radius:50%;background:${off ? '#CBD5E1' : L.c}"></div>
        <div style="flex:1;min-width:0;${off ? 'opacity:.5' : ''}">
          <div style="font-size:13px;font-weight:700;${off ? 'text-decoration:line-through' : ''}"><span style="color:${L.c}">${escHtml(L.t)}</span></div>
          <div style="font-size:11px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(_diemNgay(e.ngay))} · ${escHtml(e.mo_ta || '')}</div>
        </div>
        <button onclick="diemHubMien('${escHtml(maNv)}','${escHtml(e.loai)}','${escHtml((e.source_key || '').replace(/'/g, ''))}','${escHtml(e.ngay || '')}')"
          style="flex:none;border:1px solid ${off ? '#CBD5E1' : '#FCA5A5'};background:${off ? '#F8FAFC' : '#FEF2F2'};color:${off ? '#64748B' : '#DC2626'};font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:9px;cursor:pointer;white-space:nowrap">${off ? 'Khôi phục' : 'Xóa điểm trừ'}</button>
      </div>`;
    }).join('') + `<div style="font-size:11px;color:#94A3B8;text-align:center;padding:8px 0 2px">Điểm: <b style="color:#0F2E45">${data.diem}/10</b> · ${data.so_su_kien} lỗi · ${data.so_mien} đã xóa</div>`;
  } catch (e) { box.innerHTML = '<div style="color:#DC2626;font-size:12.5px;padding:8px">Lỗi kết nối</div>'; }
}

// ── Tìm kiếm gợi ý: khu vực / cửa hàng / nhân viên ──
function diemSearchLabel() {
  if (_diemHub.nv) { const r = _diemHub.list.find(x => x.ma_nv === _diemHub.nv); return r ? (r.ho_ten || r.ma_nv) : _diemHub.nv; }
  if (_diemHub.ch) { const r = _diemHub.list.find(x => x.ma_ch === _diemHub.ch); return r ? ('CH: ' + (r.ten_ch || r.ma_ch)) : _diemHub.ch; }
  return '';
}
window.diemSearchInput = function (kw) {
  clearTimeout(_diemSearchTimer);
  const dd = document.getElementById('diem-search-dd'); if (!dd) return;
  if (!kw || kw.length < 1) { dd.style.display = 'none'; return; }
  _diemSearchTimer = setTimeout(() => {
    const low = kw.toLowerCase();
    const list = _diemHub.list;
    const kvs = [...new Set(list.map(r => r.khu_vuc).filter(k => k && k.toLowerCase().includes(low)))].slice(0, 3);
    const chMap = new Map();
    list.forEach(r => { if (r.ma_ch && !chMap.has(r.ma_ch)) { const t = r.ten_ch || r.ma_ch; if (t.toLowerCase().includes(low) || String(r.ma_ch).toLowerCase().includes(low)) chMap.set(r.ma_ch, t); } });
    const chs = [...chMap.entries()].slice(0, 5);
    const nvs = list.filter(r => (r.ho_ten || '').toLowerCase().includes(low) || String(r.ma_nv).toLowerCase().includes(low)).slice(0, 6);
    const lbl = t => `<div style="font-size:10.5px;font-weight:700;color:#94A3B8;padding:6px 8px 3px">${t}</div>`;
    const it = (act, html) => `<div onclick="${act}" style="padding:8px 9px;border-radius:8px;cursor:pointer;font-size:13px;color:#0F2E45" onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='transparent'">${html}</div>`;
    let html = '';
    if (kvs.length) html += lbl('Khu vực') + kvs.map(k => it(`diemPickKhu('${escHtml(k)}')`, escHtml(k))).join('');
    if (chs.length) html += lbl('Cửa hàng') + chs.map(([m, t]) => it(`diemPickCh('${escHtml(String(m))}')`, `<b>${escHtml(t)}</b> <small style="color:#94A3B8">${escHtml(String(m))}</small>`)).join('');
    if (nvs.length) html += lbl('Nhân viên') + nvs.map(r => it(`diemPickNv('${escHtml(String(r.ma_nv))}')`, `<b>${escHtml(r.ho_ten || r.ma_nv)}</b> <small style="color:#94A3B8">${escHtml(r.khu_vuc || '')}</small>`)).join('');
    if (!html) html = '<div style="padding:10px;color:#94A3B8;font-size:12.5px">Không tìm thấy</div>';
    dd.innerHTML = html; dd.style.display = '';
  }, 160);
};
window.diemPickKhu = function (k) { _diemHub.khu = k; _diemHub.ch = null; _diemHub.nv = null; _diemHub.loai = null; _diemHubPaint(); };
window.diemPickCh = function (m) { _diemHub.ch = m; _diemHub.nv = null; _diemHub.khu = 'all'; _diemHub.loai = null; _diemHubPaint(); };
window.diemPickNv = function (m) { _diemHub.nv = m; _diemHub.ch = null; _diemHub.loai = null; _diemHubPaint(); };
window.diemSearchClear = function () { _diemHub.ch = null; _diemHub.nv = null; _diemHubPaint(); };

async function diemHubMien(maNv, loai, sourceKey, ngay) {
  try {
    const { data, error } = await supa.rpc('fn_toggle_mien_diem', {
      p_ma_ql: SESSION.ma, p_ma_nv: maNv, p_loai: loai,
      p_source_key: sourceKey, p_ngay: ngay || null, p_ly_do: null
    });
    if (error || !data || !data.success) { showToast((data && data.error) || 'Không có quyền', 'err'); return; }
    showToast(data.da_mien ? '✓ Đã xóa điểm trừ' : '✓ Đã khôi phục điểm trừ', 'ok');
    const nv = _diemHub.list.find(r => r.ma_nv === maNv);
    if (nv) { nv.so_loi = Math.max(0, (nv.so_loi || 0) + (data.da_mien ? -1 : 1)); nv.diem = Math.max(0, 10 - nv.so_loi); }
    _diemHubLoadCt(maNv);
    _diemHubRenderKhu();
  } catch (e) { showToast('Lỗi kết nối', 'err'); }
}

window.diemHubOpen = diemHubOpen;
window.diemHubLoad = diemHubLoad;
window.diemHubThang = diemHubThang;
window.diemHubKhu = diemHubKhu;
window.diemHubSort = diemHubSort;
window.diemHubLoai = diemHubLoai;
window.diemHubToggle = diemHubToggle;
window.diemHubMien = diemHubMien;
