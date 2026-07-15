// ═══════════════════════════════════════════════════════════════════════════
//  QUẢN LÝ MỤC KIỂM TRA BÀN GIAO (admin/QLNS) — thêm/xóa mục tùy chỉnh
//  Mục lưu vào danh_muc_tai_san_chuan (la_tuy_chinh=true) → TỰ hiện trong biên bản
//  bàn giao như mục tài sản (Đạt / Có vấn đề + mô tả + ảnh → tạo sự vụ). Store-side KHÔNG đổi.
//  RPC: fn_bg_muc_list / fn_bg_muc_them / fn_bg_muc_xoa (guard _check_role_admin_qlns).
// ═══════════════════════════════════════════════════════════════════════════
const MUCBG_KV = { 1: 'Mặt tiền, hạ tầng', 2: 'Quầy thu ngân & IT', 4: 'Kho, sinh hoạt, công cụ' };

async function mucBGOpen() {
  let ov = document.getElementById('mucbg-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'mucbg-ov'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;inset:0;z-index:9200;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center';
  ov.onclick = function (e) { if (e.target === ov) mucBGClose(); };
  ov.innerHTML = `
    <div style="background:#fff;width:100%;max-width:520px;max-height:90vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden">
      <div style="flex:none;padding:16px 18px;background:linear-gradient(135deg,#1D9E75,#0F6E56);color:#fff">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div>
            <div style="font-size:10px;font-weight:800;letter-spacing:1px;opacity:.85">BÀN GIAO</div>
            <div style="font-size:18px;font-weight:800;margin-top:2px">Mục kiểm tra tùy chỉnh</div>
            <div style="font-size:11.5px;opacity:.9;margin-top:2px;line-height:1.4">Thêm mục cho cửa hàng kiểm tra khi bàn giao (vd: dột nước mùa mưa). Mục "Có vấn đề" tự tạo sự vụ như tài sản.</div>
          </div>
          <button onclick="mucBGClose()" style="flex:none;border:none;background:rgba(255,255,255,.22);color:#fff;width:32px;height:32px;border-radius:8px;font-size:16px;cursor:pointer">✕</button>
        </div>
      </div>
      <div style="flex:none;padding:14px 18px;border-bottom:1px solid #F1F5F9">
        <input id="mucbg-ten" type="text" placeholder="Tên mục (vd: Kiểm tra dột nước mái)" autocomplete="off"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #E2E8F0;border-radius:10px;font-size:14px;margin-bottom:8px">
        <div style="display:flex;gap:8px">
          <select id="mucbg-kv" style="flex:1;min-width:0;padding:10px 8px;border:1px solid #E2E8F0;border-radius:10px;font-size:13px;background:#fff;color:#0F2E45">
            <option value="1">Nhóm: Mặt tiền, hạ tầng</option>
            <option value="2">Nhóm: Quầy thu ngân & IT</option>
            <option value="4">Nhóm: Kho, sinh hoạt, công cụ</option>
          </select>
          <button onclick="mucBGThem()" id="mucbg-btn-them" style="flex:none;padding:0 18px;border:none;background:#0F6E56;color:#fff;font-weight:800;border-radius:10px;font-size:14px;cursor:pointer">Thêm</button>
        </div>
      </div>
      <div id="mucbg-list" style="flex:1;overflow-y:auto;padding:12px 16px 20px;-webkit-overflow-scrolling:touch">
        <div style="text-align:center;color:#94A3B8;padding:24px">Đang tải...</div>
      </div>
    </div>`;
  mucBGLoad();
}
function mucBGClose() { const o = document.getElementById('mucbg-ov'); if (o) o.remove(); }

async function mucBGLoad() {
  const box = document.getElementById('mucbg-list'); if (!box) return;
  try {
    const { data, error } = await supa.rpc('fn_bg_muc_list');
    if (error) throw error;
    const list = Array.isArray(data) ? data : [];
    if (!list.length) {
      box.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:26px;font-size:13px">Chưa có mục tùy chỉnh nào.<br>Thêm mục ở ô trên — mục sẽ hiện trong biên bản bàn giao của cửa hàng.</div>';
      return;
    }
    box.innerHTML = list.map(m => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #EEF2F6;border-radius:12px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:#0F2E45">${escHtml(m.ten)}</div>
          <div style="font-size:11px;color:#94A3B8;margin-top:1px">${escHtml(MUCBG_KV[m.khu_vuc] || ('Nhóm ' + m.khu_vuc))}</div>
        </div>
        <button onclick="mucBGXoa(${m.stt})" style="flex:none;border:1px solid #FCA5A5;background:#FEF2F2;color:#DC2626;font-size:12px;font-weight:700;padding:6px 12px;border-radius:9px;cursor:pointer">Xóa</button>
      </div>`).join('');
  } catch (e) {
    box.innerHTML = '<div style="text-align:center;color:#DC2626;padding:24px">Lỗi tải: ' + escHtml(e.message || '') + '</div>';
  }
}

async function mucBGThem() {
  const ten = (document.getElementById('mucbg-ten').value || '').trim();
  const kv = parseInt(document.getElementById('mucbg-kv').value, 10) || 1;
  if (!ten) { showToast('Nhập tên mục', 'warn'); return; }
  const btn = document.getElementById('mucbg-btn-them');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const { data, error } = await supa.rpc('fn_bg_muc_them', { p_admin: SESSION.ma, p_ten: ten, p_khu_vuc: kv, p_don_vi: '' });
    if (error || !data || !data.ok) throw new Error((data && data.error) || (error && error.message) || 'Lỗi');
    showToast('✓ Đã thêm mục kiểm tra', 'ok');
    document.getElementById('mucbg-ten').value = '';
    mucBGLoad();
  } catch (e) { showToast('Lỗi: ' + (e.message || e), 'err'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Thêm'; } }
}

async function mucBGXoa(stt) {
  if (!window.confirm('Xóa mục này khỏi biên bản bàn giao?\nBiên bản CŨ không bị ảnh hưởng.')) return;
  try {
    const { data, error } = await supa.rpc('fn_bg_muc_xoa', { p_admin: SESSION.ma, p_stt: stt });
    if (error || !data || !data.ok) throw new Error((data && data.error) || (error && error.message) || 'Lỗi');
    showToast('✓ Đã xóa mục', 'ok');
    mucBGLoad();
  } catch (e) { showToast('Lỗi: ' + (e.message || e), 'err'); }
}

window.mucBGOpen = mucBGOpen;
window.mucBGClose = mucBGClose;
window.mucBGThem = mucBGThem;
window.mucBGXoa = mucBGXoa;
