// ═══════════════════════════════════════════════════════════════════════════
//  HUB "ĐIỂM HỆ THỐNG" (admin) — [v17.58]
//  Danh sách điểm toàn bộ NV (hàng ngang gọn), lọc khu vực, đổi tháng,
//  bấm 1 NV → xổ chi tiết các lần trừ + nút Xóa điểm trừ (toggle).
//  RPC: fn_diem_tat_ca / fn_diem_chi_tiet / fn_toggle_mien_diem.
// ═══════════════════════════════════════════════════════════════════════════
let _diemHub = { list: [], khu: 'all', thang: null, open: new Set() };

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

function diemHubOpen() {
  let ov = document.getElementById('diem-hub-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'diem-hub-ov'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#F1F5F9;display:flex;flex-direction:column';
  _diemHub = { list: [], khu: 'all', thang: _diemThangHT(), open: new Set() };
  ov.innerHTML = `
    <div style="background:linear-gradient(135deg,#F97316,#C2410C);color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,.12)">
      <div style="font-weight:800;font-size:16px">Điểm hệ thống</div>
      <div style="display:flex;gap:8px">
        <button onclick="diemHubLoad()" style="background:rgba(255,255,255,.18);border:none;color:#fff;height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Tải lại</button>
        <button onclick="document.getElementById('diem-hub-ov').remove()" style="background:rgba(255,255,255,.18);border:none;color:#fff;width:32px;height:32px;border-radius:8px;font-size:16px;cursor:pointer">✕</button>
      </div>
    </div>
    <div style="background:#fff;border-bottom:1px solid #E6EBF0;padding:10px 12px;display:flex;flex-direction:column;gap:9px">
      <div style="display:flex;align-items:center;justify-content:center;gap:14px">
        <button onclick="diemHubThang(-1)" style="border:1px solid #E6EBF0;background:#fff;width:30px;height:30px;border-radius:9px;font-size:16px;color:#475569;cursor:pointer">‹</button>
        <div id="diem-hub-thang" style="font-size:14px;font-weight:800;color:#0F2E45;min-width:120px;text-align:center">—</div>
        <button onclick="diemHubThang(1)" style="border:1px solid #E6EBF0;background:#fff;width:30px;height:30px;border-radius:9px;font-size:16px;color:#475569;cursor:pointer">›</button>
      </div>
      <div id="diem-hub-khu" style="display:flex;gap:7px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px"></div>
    </div>
    <div id="diem-hub-body" style="flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch">
      <div style="text-align:center;color:#64748B;padding:34px">Đang tải...</div>
    </div>`;
  diemHubLoad();
}

async function diemHubLoad() {
  const body = document.getElementById('diem-hub-body');
  const thEl = document.getElementById('diem-hub-thang');
  if (!body) return;
  if (thEl) thEl.textContent = 'Tháng ' + _diemHub.thang.substring(5, 7) + '/' + _diemHub.thang.substring(0, 4);
  body.innerHTML = '<div style="text-align:center;color:#64748B;padding:34px">Đang tải...</div>';
  try {
    const { data, error } = await supa.rpc('fn_diem_tat_ca', { p_thang: _diemHub.thang });
    if (error || !data || !data.success) {
      body.innerHTML = '<div style="text-align:center;color:#DC2626;padding:34px">Lỗi tải điểm: ' + escHtml((data && data.error) || (error && error.message) || '') + '</div>';
      return;
    }
    _diemHub.list = data.danh_sach || [];
    _diemHub.open = new Set();
    _diemHubRenderKhu();
    _diemHubRender();
  } catch (e) {
    body.innerHTML = '<div style="text-align:center;color:#DC2626;padding:34px">Lỗi kết nối</div>';
  }
}

function diemHubThang(delta) {
  _diemHub.thang = _diemThangShift(_diemHub.thang, delta);
  diemHubLoad();
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

function diemHubKhu(khu) { _diemHub.khu = khu; _diemHubRenderKhu(); _diemHubRender(); }

function _diemHubRender() {
  const body = document.getElementById('diem-hub-body'); if (!body) return;
  const rows = _diemHub.list.filter(r => _diemHub.khu === 'all' || (r.khu_vuc || '—') === _diemHub.khu);
  if (!rows.length) { body.innerHTML = '<div style="text-align:center;color:#64748B;padding:34px">Không có nhân viên</div>'; return; }
  body.innerHTML = rows.map(r => {
    const m = _diemMau(r.diem);
    const kt = (r.ho_ten || '?').trim().charAt(0) || '?';
    const isOpen = _diemHub.open.has(r.ma_nv);
    return `<div style="background:#fff;border-radius:14px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.05);overflow:hidden">
      <div onclick="diemHubToggle('${escHtml(r.ma_nv)}','${escHtml((r.ho_ten || '').replace(/'/g, ''))}')" style="display:flex;align-items:center;gap:11px;padding:11px 12px;cursor:pointer">
        <div style="flex:none;width:40px;height:40px;border-radius:11px;background:${m.bg};color:${m.c};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px">${escHtml(kt)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:#0F2E45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.ho_ten || r.ma_nv)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <div style="flex:1;height:6px;background:#F1F5F9;border-radius:99px;overflow:hidden;max-width:130px"><div style="height:100%;width:${Math.max(0, (r.diem || 0)) * 10}%;background:${m.c};border-radius:99px"></div></div>
            <div style="font-size:10.5px;color:#94A3B8;white-space:nowrap">${escHtml(r.khu_vuc || '—')}${r.so_loi ? ' · ' + r.so_loi + ' lỗi' : ''}</div>
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
  // nạp chi tiết cho những dòng đang mở
  _diemHub.open.forEach(ma => _diemHubLoadCt(ma));
}

function diemHubToggle(maNv, tenNv) {
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
          <div style="font-size:13px;font-weight:700;color:#0F2E45;${off ? 'text-decoration:line-through' : ''}"><span style="color:${L.c}">${escHtml(L.t)}</span></div>
          <div style="font-size:11px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(_diemNgay(e.ngay))} · ${escHtml(e.mo_ta || '')}</div>
        </div>
        <button onclick="diemHubMien('${escHtml(maNv)}','${escHtml(e.loai)}','${escHtml((e.source_key || '').replace(/'/g, ''))}','${escHtml(e.ngay || '')}')"
          style="flex:none;border:1px solid ${off ? '#CBD5E1' : '#FCA5A5'};background:${off ? '#F8FAFC' : '#FEF2F2'};color:${off ? '#64748B' : '#DC2626'};font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:9px;cursor:pointer;white-space:nowrap">${off ? 'Khôi phục' : 'Xóa điểm trừ'}</button>
      </div>`;
    }).join('') + `<div style="font-size:11px;color:#94A3B8;text-align:center;padding:8px 0 2px">Điểm: <b style="color:#0F2E45">${data.diem}/10</b> · ${data.so_su_kien} lỗi · ${data.so_mien} đã xóa</div>`;
  } catch (e) { box.innerHTML = '<div style="color:#DC2626;font-size:12.5px;padding:8px">Lỗi kết nối</div>'; }
}

function _diemNgay(s) {
  if (!s) return '';
  const p = String(s).substring(0, 10).split('-');
  return p.length === 3 ? (p[2] + '/' + p[1]) : s;
}

async function diemHubMien(maNv, loai, sourceKey, ngay) {
  try {
    const { data, error } = await supa.rpc('fn_toggle_mien_diem', {
      p_ma_ql: SESSION.ma, p_ma_nv: maNv, p_loai: loai,
      p_source_key: sourceKey, p_ngay: ngay || null, p_ly_do: null
    });
    if (error || !data || !data.success) { showToast((data && data.error) || 'Không có quyền', 'err'); return; }
    showToast(data.da_mien ? '✓ Đã xóa điểm trừ' : '✓ Đã khôi phục điểm trừ', 'ok');
    // cập nhật điểm dòng NV trong list + nạp lại chi tiết
    const nv = _diemHub.list.find(r => r.ma_nv === maNv);
    if (nv) { nv.so_loi = (nv.so_loi || 0) + (data.da_mien ? -1 : 1); nv.diem = Math.max(0, 10 - nv.so_loi); }
    _diemHubRender();
  } catch (e) { showToast('Lỗi kết nối', 'err'); }
}

window.diemHubOpen = diemHubOpen;
window.diemHubLoad = diemHubLoad;
window.diemHubThang = diemHubThang;
window.diemHubKhu = diemHubKhu;
window.diemHubToggle = diemHubToggle;
window.diemHubMien = diemHubMien;
