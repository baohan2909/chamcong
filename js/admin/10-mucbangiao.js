// ═══════════════════════════════════════════════════════════════════════════
//  CẤU HÌNH MỤC BÀN GIAO (admin/QLNS) — editor trực quan GIỐNG biên bản bàn giao
//  Hiện các nhóm + mục như lúc bàn giao. Thêm mục trong nhóm · tạo nhóm mới · xóa
//  mục/nhóm TỰ THÊM. 45 mục lõi + 3 nhóm gốc KHÓA (không xóa được).
//  Mục lưu ở danh_muc_tai_san_chuan (la_tuy_chinh), nhóm ở bg_nhom_taisan.
//  RPC: fn_bg_cauhinh / fn_bg_muc_them / fn_bg_muc_xoa / fn_bg_nhom_them / fn_bg_nhom_xoa.
// ═══════════════════════════════════════════════════════════════════════════
let _mucBGCfg = { nhom: [], muc: [] };

async function mucBGOpen() {
  let ov = document.getElementById('mucbg-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'mucbg-ov'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;inset:0;z-index:9200;background:#f4f3ef;display:flex;flex-direction:column';
  ov.innerHTML = `
    <div style="flex:none;padding:12px 14px 2px">
      <div style="position:relative;overflow:hidden;border-radius:22px;background:linear-gradient(100deg,#0F6E56,#149C74,#34D399);color:#fff;padding:14px 18px;box-shadow:0 12px 30px -12px rgba(15,110,86,.5)">
        <div style="position:absolute;right:-20px;top:-20px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.12)"></div>
        <div style="position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div style="min-width:0">
            <div style="font-size:10px;font-weight:700;letter-spacing:.6px;opacity:.9">BÀN GIAO</div>
            <div style="font-size:20px;font-weight:800;margin-top:1px">Cấu hình mục kiểm tra</div>
            <div style="font-size:11.5px;opacity:.9;margin-top:2px">Thêm mục / tạo nhóm — cửa hàng sẽ thấy y như biên bản bàn giao</div>
          </div>
          <button onclick="document.getElementById('mucbg-ov').remove()" style="flex:none;background:rgba(255,255,255,.22);border:none;color:#fff;width:32px;height:32px;border-radius:8px;font-size:16px;cursor:pointer">✕</button>
        </div>
      </div>
    </div>
    <div id="mucbg-body" style="flex:1;overflow-y:auto;padding:8px 14px 24px;-webkit-overflow-scrolling:touch">
      <div style="text-align:center;color:#64748B;padding:34px">Đang tải...</div>
    </div>`;
  mucBGLoad();
}

async function mucBGLoad() {
  const body = document.getElementById('mucbg-body'); if (!body) return;
  try {
    const { data, error } = await supa.rpc('fn_bg_cauhinh');
    if (error) throw error;
    _mucBGCfg = { nhom: (data && data.nhom) || [], muc: (data && data.muc) || [] };
    mucBGRender();
  } catch (e) {
    body.innerHTML = '<div style="text-align:center;color:#DC2626;padding:30px">Lỗi tải cấu hình: ' + escHtml(e.message || '') + '<br><span style="font-size:12px;color:#94A3B8">Đã chạy SQL Việc 3 (bảng bg_nhom_taisan + RPC) chưa?</span></div>';
  }
}

function mucBGRender() {
  const body = document.getElementById('mucbg-body'); if (!body) return;
  const nhom = _mucBGCfg.nhom.slice();
  const muc = _mucBGCfg.muc || [];

  const groupHtml = nhom.map(nh => {
    const items = muc.filter(m => m.khu_vuc === nh.khu_vuc);
    const laGoc = !nh.la_tuy_chinh;
    const rows = items.length ? items.map(m => {
      const custom = m.la_tuy_chinh;
      return `<div style="display:flex;align-items:center;gap:9px;padding:8px 2px;border-top:1px solid #F1F5F9">
        <div style="flex:none;width:6px;height:6px;border-radius:50%;background:${custom ? '#0F6E56' : '#CBD5E1'}"></div>
        <div style="flex:1;min-width:0;font-size:13px;color:#0F2E45">${escHtml(m.ten)}${m.don_vi ? ' <span style="color:#94A3B8;font-size:11px">('+escHtml(m.don_vi)+')</span>' : ''}</div>
        ${custom
          ? `<button onclick="mucBGXoaMuc(${m.stt})" style="flex:none;border:1px solid #FCA5A5;background:#FEF2F2;color:#DC2626;font-size:11px;font-weight:700;padding:4px 9px;border-radius:8px;cursor:pointer">Xóa</button>`
          : `<span style="flex:none;font-size:10px;color:#CBD5E1;font-weight:700">gốc</span>`}
      </div>`;
    }).join('') : '<div style="font-size:12px;color:#94A3B8;padding:8px 2px;border-top:1px solid #F1F5F9">Chưa có mục nào trong nhóm này</div>';

    return `<div style="background:#fff;border-radius:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.05);overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;background:#F8FAFC;border-bottom:1px solid #EEF2F6">
        <div style="flex:1;min-width:0;font-size:14px;font-weight:800;color:#0F2E45">${escHtml(nh.ten)}
          ${laGoc ? '<span style="font-size:9px;color:#94A3B8;font-weight:700;margin-left:6px;vertical-align:middle">NHÓM GỐC</span>' : ''}</div>
        ${!laGoc ? `<button onclick="mucBGXoaNhom(${nh.khu_vuc})" style="flex:none;border:1px solid #FCA5A5;background:#FEF2F2;color:#DC2626;font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;cursor:pointer">Xóa nhóm</button>` : ''}
      </div>
      <div style="padding:4px 14px 10px">${rows}
        <div style="display:flex;gap:6px;margin-top:10px">
          <input id="mucbg-add-${nh.khu_vuc}" type="text" placeholder="Thêm mục vào nhóm này..." autocomplete="off"
            onkeydown="if(event.key==='Enter')mucBGThemMuc(${nh.khu_vuc})"
            style="flex:1;min-width:0;padding:8px 11px;border:1px solid #E2E8F0;border-radius:9px;font-size:13px">
          <button onclick="mucBGThemMuc(${nh.khu_vuc})" style="flex:none;padding:0 14px;border:none;background:#0F6E56;color:#fff;font-weight:800;border-radius:9px;font-size:13px;cursor:pointer">+ Thêm</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const taoNhom = `<div style="background:#fff;border:1.5px dashed #CBD5E1;border-radius:16px;padding:14px;margin-top:4px">
    <div style="font-size:13px;font-weight:800;color:#0F2E45;margin-bottom:8px">Tạo nhóm mới</div>
    <div style="display:flex;gap:6px">
      <input id="mucbg-nhom-ten" type="text" placeholder="Tên nhóm (vd: An toàn PCCC)" autocomplete="off"
        onkeydown="if(event.key==='Enter')mucBGThemNhom()"
        style="flex:1;min-width:0;padding:9px 11px;border:1px solid #E2E8F0;border-radius:9px;font-size:13px">
      <button onclick="mucBGThemNhom()" style="flex:none;padding:0 16px;border:none;background:#0F2E45;color:#fff;font-weight:800;border-radius:9px;font-size:13px;cursor:pointer">Tạo</button>
    </div>
  </div>`;

  body.innerHTML = groupHtml + taoNhom
    + '<div style="font-size:11px;color:#94A3B8;text-align:center;margin-top:14px">Mục "Có vấn đề" khi bàn giao sẽ tự tạo sự vụ. Chỉ nhóm/mục tự thêm mới xóa được.</div>';
}

async function mucBGThemMuc(khuVuc) {
  const inp = document.getElementById('mucbg-add-' + khuVuc);
  const ten = (inp && inp.value || '').trim();
  if (!ten) { showToast('Nhập tên mục', 'warn'); return; }
  try {
    const { data, error } = await supa.rpc('fn_bg_muc_them', { p_admin: SESSION.ma, p_ten: ten, p_khu_vuc: khuVuc, p_don_vi: '' });
    if (error || !data || !data.ok) throw new Error((data && data.error) || (error && error.message) || 'Lỗi');
    showToast('✓ Đã thêm mục', 'ok');
    mucBGLoad();
  } catch (e) { showToast('Lỗi: ' + (e.message || e), 'err'); }
}

async function mucBGXoaMuc(stt) {
  if (!window.confirm('Xóa mục này? Biên bản cũ không ảnh hưởng.')) return;
  try {
    const { data, error } = await supa.rpc('fn_bg_muc_xoa', { p_admin: SESSION.ma, p_stt: stt });
    if (error || !data || !data.ok) throw new Error((data && data.error) || (error && error.message) || 'Lỗi');
    showToast('✓ Đã xóa mục', 'ok');
    mucBGLoad();
  } catch (e) { showToast('Lỗi: ' + (e.message || e), 'err'); }
}

async function mucBGThemNhom() {
  const inp = document.getElementById('mucbg-nhom-ten');
  const ten = (inp && inp.value || '').trim();
  if (!ten) { showToast('Nhập tên nhóm', 'warn'); return; }
  try {
    const { data, error } = await supa.rpc('fn_bg_nhom_them', { p_admin: SESSION.ma, p_ten: ten });
    if (error || !data || !data.ok) throw new Error((data && data.error) || (error && error.message) || 'Lỗi');
    showToast('✓ Đã tạo nhóm', 'ok');
    mucBGLoad();
  } catch (e) { showToast('Lỗi: ' + (e.message || e), 'err'); }
}

async function mucBGXoaNhom(khuVuc) {
  if (!window.confirm('Xóa nhóm này và MỌI mục tự thêm trong nhóm?\nBiên bản cũ không ảnh hưởng.')) return;
  try {
    const { data, error } = await supa.rpc('fn_bg_nhom_xoa', { p_admin: SESSION.ma, p_khu_vuc: khuVuc });
    if (error || !data || !data.ok) throw new Error((data && data.error) || (error && error.message) || 'Lỗi');
    showToast('✓ Đã xóa nhóm', 'ok');
    mucBGLoad();
  } catch (e) { showToast('Lỗi: ' + (e.message || e), 'err'); }
}

window.mucBGOpen = mucBGOpen;
window.mucBGThemMuc = mucBGThemMuc;
window.mucBGXoaMuc = mucBGXoaMuc;
window.mucBGThemNhom = mucBGThemNhom;
window.mucBGXoaNhom = mucBGXoaNhom;
