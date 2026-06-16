/* ═══════════════════════════════════════════════════════════════════════════
 *  NÓN SƠN — BÀN GIAO CA v1.0 — NV VIEW (Sprint 1)
 *
 *  Kế thừa HOÀN TOÀN UX/UI của module Kiểm tra cửa hàng:
 *    • Dùng class CSS chk-* có sẵn (không viết CSS mới)
 *    • Pattern: cc-hero-page banner + chk-topbar subtabs + chk-group accordion
 *    • Default item: chưa chọn → BT/VD toggle 
 *    • Nút "Tất cả bình thường" trên đầu mỗi nhóm
 *    • Item BT collapse → chỉ hiện toggle
 *    • Item VD expand → mức độ + mô tả + ảnh
 *    • Ảnh: file picker → CamScanner v2 căn chỉnh perspective
 *
 *  Backend: schema 9 bảng `ban_giao*` + `su_vu*` + 17 RPCs đã chạy SQL.
 * ═══════════════════════════════════════════════════════════════════════════ */

// ─── State module (toàn cục, prefix bg*) ─────────────────────────────────
let bgGroups = [];          // [{key, ten, type:'tien'|'taisan'|'hang'|'anh', items:[...]}]
let bgState = {};           // {itemKey: {...}}  - varies theo type
let bgCurrentCH = null;     // {ma, ten, khuVuc}
let bgSub = 'new';
let bgDanhMucCache = null;
let bgPhotos = [];          // [{ blob, dataUrl }]

// ═════════════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ═════════════════════════════════════════════════════════════════════════
async function bgInitPage(){
  // [v13.27] Skip rebuild nếu đã có state + CH không đổi
  // → Khi user qua Chấm công rồi quay lại, KHÔNG mất dữ liệu đang nhập
  if (bgCurrentCH && bgGroups.length > 0 && document.getElementById('bg-ch-info')) {
    // Refresh hiển thị CH (đề phòng đổi tài khoản, nhưng state form vẫn giữ)
    const chNameEl = document.getElementById('bg-ch-name');
    const chSubEl = document.getElementById('bg-ch-sub');
    if (chNameEl) chNameEl.textContent = bgCurrentCH.ten;
    if (chSubEl) chSubEl.textContent = bgCurrentCH.ma + (bgCurrentCH.khuVuc ? ' · ' + bgCurrentCH.khuVuc : '');
    return;
  }
  document.getElementById('bg-ch-name').textContent = 'Đang xác định cửa hàng...';
  document.getElementById('bg-ch-sub').textContent = '';
  await bgXacDinhCH();
  if (!bgCurrentCH) {
    document.getElementById('bg-ch-name').textContent = 'Chưa xác định được cửa hàng';
    document.getElementById('bg-ch-sub').textContent = 'Vui lòng chấm công vào ca trước.';
    document.getElementById('bg-groups').innerHTML = '<div class="ns-empty">Vui lòng chấm công vào ca tại cửa hàng trước.</div>';
    return;
  }
  document.getElementById('bg-ch-name').textContent = bgCurrentCH.ten;
  document.getElementById('bg-ch-sub').textContent = bgCurrentCH.ma + (bgCurrentCH.khuVuc ? ' · ' + bgCurrentCH.khuVuc : '');

  // Load danh mục 45 items master (cache)
  if (!bgDanhMucCache) {
    try {
      const { data, error } = await supa.rpc('fn_get_danh_muc_tai_san');
      if (error) throw error;
      bgDanhMucCache = data || [];
    } catch(e){
      document.getElementById('bg-groups').innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi tải danh mục: '+e.message+'</div>';
      return;
    }
  }
  bgBuildGroups();
  bgState = {};
  bgPhotos = [];
  bgRenderForm();
  bgSwitchSub('new');
}

// Xác định CH (giống chkXacDinhCH)
async function bgXacDinhCH(){
  bgCurrentCH = null;
  if (SESSION.vaiTro === 'CUA_HANG' && SESSION.cuaHangMa) {
    bgCurrentCH = { ma:SESSION.cuaHangMa, ten:SESSION.cuaHangTen||SESSION.cuaHangMa, khuVuc:SESSION.khuVuc||'' };
    return;
  }
  try {
    const now = new Date();
    const today = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
    const { data } = await supa.from('cham_cong')
      .select('ma_ch, ten_ch_snapshot, thoi_gian')
      .eq('ma_nv', SESSION.ma).eq('ngay', today).eq('loai','VAO_CA')
      .order('thoi_gian', { ascending:false }).limit(1);
    if (data && data.length) {
      const r = data[0];
      let kv = '';
      if (window.CH_LIST) { const f = CH_LIST.find(c=>c.ma===r.ma_ch); if (f) kv = f.khuVuc||''; }
      bgCurrentCH = { ma:r.ma_ch, ten:r.ten_ch_snapshot||r.ma_ch, khuVuc:kv };
      return;
    }
  } catch(e){}
  if (SESSION.cuaHangMa) {
    bgCurrentCH = { ma:SESSION.cuaHangMa, ten:SESSION.cuaHangTen||SESSION.cuaHangMa, khuVuc:SESSION.khuVuc||'' };
  }
}

// Build 6 nhóm: Tiền · KV1 · KV2 · KV4 · Hàng hóa · Ảnh
function bgBuildGroups(){
  const KV_TITLE = {
    1: 'Mặt tiền, hạ tầng',
    2: 'Quầy thu ngân & IT',
    4: 'Kho, sinh hoạt, công cụ'
  };
  bgGroups = [];

  // Group 1: Tiền mặt
  bgGroups.push({
    key:'tien', ten:'Tiền mặt & doanh thu', type:'tien',
    items: [
      { id:'tien_mat_ket', ten:'Tiền mặt trong két & trong kho' },
      { id:'tien_ban_hang', ten:'Tiền bán hàng thu trong ca' },
      { id:'tien_chi', ten:'Tiền chi trong ca' }
    ]
  });

  // Groups 2-4: Tài sản 45 items chia theo khu vực
  const taiSan = bgDanhMucCache || [];
  for (const kv of [1, 2, 4]) {
    const items = taiSan.filter(x => x.khu_vuc === kv);
    bgGroups.push({
      key:'ts_kv'+kv, ten:KV_TITLE[kv], type:'taisan',
      items: items.map(it => ({ id:'ts_'+it.stt, stt:it.stt, ten:it.ten, don_vi:it.don_vi||'', khu_vuc:kv }))
    });
  }

  // Group 5: Hàng hóa & tồn kho — render thành 3 sub-section theo khu vực
  const KV_HANG_LABEL = { 'SANH':'Trưng bày', 'KHO':'Kho', 'NIEM_PHONG':'Niêm phong' };
  const NHOM_HANG = [
    { key:'NON_VAI', ten:'Nhóm Nón Vải' },
    { key:'NON_BH',  ten:'Nhóm Nón Bảo Hiểm' },
    { key:'PHU_KIEN',ten:'Nhóm Phụ Kiện (Lưới, kính...)' }
  ];
  const hangItems = [];
  // Sắp xếp: 3 KV × 3 nhóm — KV trước, nhóm sau (anh đã yêu cầu hierarchy KV → nhóm)
  for (const kv of ['SANH','KHO','NIEM_PHONG']) {
    for (const nh of NHOM_HANG) {
      hangItems.push({
        id:'hg_'+kv+'_'+nh.key,
        khu_vuc:kv, khu_vuc_label:KV_HANG_LABEL[kv],
        nhom_hang:nh.ten, nhom_key:nh.key,
        ten: nh.ten
      });
    }
  }
  bgGroups.push({ key:'hang', ten:'Hàng hóa & tồn kho', type:'hang', items: hangItems });

  // Group 6: Ảnh biên bản giấy
  bgGroups.push({ key:'anh', ten:'Ảnh biên bản giấy đã ký', type:'anh', items:[] });
}

// ═════════════════════════════════════════════════════════════════════════
//  SUBTABS
// ═════════════════════════════════════════════════════════════════════════
function bgSwitchSub(sub){
  bgSub = sub;
  ['new','suvu','timeline'].forEach(s => {
    document.getElementById('bg-subtab-'+s).classList.toggle('active', s===sub);
    document.getElementById('bg-sub-'+s).style.display = s===sub ? '' : 'none';
  });
  if (sub==='suvu') bgRenderSuVu();
  if (sub==='timeline') bgRenderTimeline();
}
window.bgSwitchSub = bgSwitchSub;

// ═════════════════════════════════════════════════════════════════════════
//  TAB 1: TẠO BIÊN BẢN — RENDER FORM
// ═════════════════════════════════════════════════════════════════════════
function bgRenderForm(){
  let html = '';
  bgGroups.forEach((g, gi) => {
    let bodyHtml = '';
    if (g.type === 'tien') {
      bodyHtml = bgRenderGroupTien(g);
    } else if (g.type === 'taisan') {
      bodyHtml = bgRenderGroupTaiSan(g);
    } else if (g.type === 'hang') {
      bodyHtml = bgRenderGroupHang(g);
    } else if (g.type === 'anh') {
      bodyHtml = bgRenderGroupAnh(g);
    }
    const stat = g.items.length>0 ? (g.type==='anh' ? bgPhotos.length+' ảnh' : g.items.length+' mục') : '';
    html += `<div class="chk-group" id="bg-g-${g.key}" data-key="${g.key}">
      <div class="chk-group-head" onclick="bgToggleGroup('${g.key}')">
        <div class="chk-group-num" id="bg-gnum-${g.key}">${gi+1}</div>
        <div class="chk-group-title">${escHtml(g.ten)}</div>
        <div class="chk-group-status" id="bg-gstatus-${g.key}">${stat}</div>
        <svg class="chk-group-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="chk-group-body">
        ${g.type==='taisan' ? `<div class="chk-group-quick">
          <button class="chk-quick-ok" id="bg-quick-${g.key}" onclick="bgQuickOK('${g.key}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Tất cả bình thường
          </button>
        </div>` : ''}
        ${bodyHtml}
      </div>
    </div>`;
  });
  document.getElementById('bg-groups').innerHTML = html;
  document.getElementById('bg-progress-wrap').style.display = '';
  document.getElementById('bg-submit-zone').style.display = '';
  // Mở mặc định group đầu (Tiền mặt)
  document.getElementById('bg-g-tien').classList.add('open');
  bgUpdateProgress();
}

// ─── Group Tiền mặt (3 dòng input + tổng tự tính) ─────────────────────
function bgRenderGroupTien(g){
  let rows = g.items.map(it => {
    const stored = bgState[it.id]&&bgState[it.id].so_tien;
    const v = stored || 0;
    const displayVal = stored ? bgFmtVN(v) : '';  // empty khi chưa nhập (hiển thị placeholder)
    const note = (bgState[it.id]&&bgState[it.id].ghi_chu)||'';
    return `<div class="bg-tien-row" style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #F1F5F9">
      <div style="flex:1;font-size:13.5px;color:#1E293B;font-weight:500">${escHtml(it.ten)}</div>
      <input type="text" inputmode="numeric" class="bg-tien-input" id="bg-tien-${it.id}"
        style="width:130px;padding:9px 11px;text-align:right;border:1.5px solid #E2E8F0;border-radius:10px;color:#0F172A;background:#F8FAFC"
        value="${displayVal}" placeholder="0"
        onfocus="this.value=(bgState['${it.id}']&&bgState['${it.id}'].so_tien)||''; this.style.background='#fff'; this.style.borderColor='#10B981';"
        onblur="bgUpdateTien('${it.id}', this.value); this.style.background='#F8FAFC'; this.style.borderColor='#E2E8F0';">
      <button class="bg-note-btn ${note?'has':''}" onclick="bgToggleTienNote('${it.id}')" 
        style="width:36px;height:36px;border-radius:10px;border:1.5px solid ${note?'#EAB308':'#E2E8F0'};background:${note?'linear-gradient(135deg,#FDE047,#CA8A04)':'#fff'};color:${note?'#fff':'#94A3B8'};cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </button>
    </div>
    <div class="bg-tien-note" id="bg-tien-note-${it.id}" style="display:${note?'block':'none'};padding:0 0 11px">
      <textarea class="chk-vd-textarea" oninput="bgUpdateTienNote('${it.id}', this.value)" 
        placeholder="Ghi chú / giải trình (nếu lệch)..." 
        style="border-color:#EAB308;background:#FEFCE8">${escHtml(note)}</textarea>
    </div>`;
  }).join('');
  rows += `<div style="display:flex;align-items:center;padding:15px 0 5px;border-top:2px solid #D1FAE5;margin-top:6px">
    <div style="flex:1;font-size:13.5px;font-weight:700;color:#047857;letter-spacing:-0.005em">Tổng tiền bàn giao (1 + 2 − 3)</div>
    <div id="bg-tien-tong" class="bg-num-display" style="min-width:130px;text-align:right;padding:9px 11px;font-weight:800;font-size:16px;color:#fff;background:linear-gradient(135deg,#10B981,#047857);border-radius:10px;box-shadow:0 3px 10px rgba(16,185,129,.30)">0</div>
  </div>`;
  return rows;
}
function bgUpdateTienTong(){
  const a = (bgState['tien_mat_ket']&&bgState['tien_mat_ket'].so_tien)||0;
  const b = (bgState['tien_ban_hang']&&bgState['tien_ban_hang'].so_tien)||0;
  const c = (bgState['tien_chi']&&bgState['tien_chi'].so_tien)||0;
  const el = document.getElementById('bg-tien-tong');
  if (el) el.textContent = bgFmtVN(a+b-c);
}
window.bgUpdateTien = function(id, raw){
  const v = parseInt(String(raw).replace(/[^\d]/g,''), 10) || 0;
  if (!bgState[id]) bgState[id] = {};
  bgState[id].so_tien = v;
  const inp = document.getElementById('bg-tien-'+id);
  if (inp) inp.value = bgFmtVN(v);
  bgUpdateTienTong();
  bgUpdateProgress();
};
window.bgToggleTienNote = function(id){
  const el = document.getElementById('bg-tien-note-'+id);
  if (!el) return;
  el.style.display = el.style.display==='none' ? 'block' : 'none';
  if (el.style.display==='block') setTimeout(()=>{ const t = el.querySelector('textarea'); if (t) t.focus(); }, 50);
};
window.bgUpdateTienNote = function(id, val){
  if (!bgState[id]) bgState[id] = {};
  bgState[id].ghi_chu = val;
  bgUpdateProgress();
};
function bgFmtVN(n){ return (n||0).toLocaleString('vi-VN'); }

// ─── Group Tài sản (45 items, default chưa chọn, BT/VD toggle) ────────
function bgRenderGroupTaiSan(g){
  return g.items.map(it => bgItemTaiSanHtml(it)).join('');
}

function bgItemTaiSanHtml(it){
  const st = bgState[it.id] || {};
  const showDetail = st.status === 'VD';
  return `<div class="chk-item" id="bg-item-${it.id}">
    <div class="chk-item-row">
      <div class="chk-item-name">${escHtml(it.ten)}${it.don_vi?` <small style="color:#94A3B8">(${escHtml(it.don_vi)})</small>`:''}</div>
      <div class="chk-item-toggle">
        <button class="chk-tg ko ${st.status==='KO'?'active':''}" onclick="bgSetTaiSan('${it.id}','KO')">Không có</button>
        <button class="chk-tg bt ${st.status==='BT'?'active':''}" onclick="bgSetTaiSan('${it.id}','BT')">Bình thường</button>
        <button class="chk-tg vd ${st.status==='VD'?'active':''}" onclick="bgSetTaiSan('${it.id}','VD')">Có sự cố</button>
      </div>
    </div>
    <div id="bg-detail-${it.id}">${showDetail?bgItemTaiSanDetailHtml(it):''}</div>
  </div>`;
}

function bgItemTaiSanDetailHtml(it){
  const st = bgState[it.id] || {};
  const photos = (st.anh_urls||[]).map((url,i)=>`<div class="chk-photo-wrap"><img class="chk-photo-thumb" src="${url}"><div class="chk-photo-del" onclick="bgDelTaiSanPhoto('${it.id}',${i})">×</div></div>`).join('');
  return `<div class="chk-vd-detail">
    <div class="chk-mucdo-row">
      <button class="chk-mucdo nhe ${st.muc_do==='CAN_THIET'?'active':''}" onclick="bgSetMucDo('${it.id}','CAN_THIET')">Cần thiết</button>
      <button class="chk-mucdo vua ${st.muc_do==='QUAN_TRONG'?'active':''}" onclick="bgSetMucDo('${it.id}','QUAN_TRONG')">Quan trọng</button>
      <button class="chk-mucdo khan ${st.muc_do==='KHAN_CAP'?'active':''}" onclick="bgSetMucDo('${it.id}','KHAN_CAP')">Khẩn cấp</button>
    </div>
    <textarea class="chk-vd-textarea" placeholder="Mô tả vấn đề (bắt buộc)..." 
      oninput="bgUpdateTaiSanMoTa('${it.id}', this.value)">${escHtml(st.mo_ta||'')}</textarea>
    <div class="chk-photo-row">
      ${photos}
      <label class="chk-photo-add">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Ảnh
        <input type="file" accept="image/*" style="display:none" onchange="bgAddTaiSanPhoto('${it.id}', this)">
      </label>
    </div>
  </div>`;
}

window.bgSetTaiSan = function(id, status){
  if (!bgState[id]) bgState[id] = {};
  bgState[id].status = status;
  if (status === 'BT' || status === 'KO') {
    delete bgState[id].muc_do;
    delete bgState[id].mo_ta;
    delete bgState[id].anh_urls;
  } else if (!bgState[id].muc_do) {
    bgState[id].muc_do = 'CAN_THIET';
  }
  const row = document.getElementById('bg-item-'+id);
  // Tìm trong group nào để re-render item
  const g = bgGroups.find(g=>g.items.some(x=>x.id===id));
  const it = g.items.find(x=>x.id===id);
  if (row) row.outerHTML = bgItemTaiSanHtml(it);
  bgUpdateGroupStatusForItem(id);
  bgUpdateProgress();
};

window.bgSetMucDo = function(id, m){
  if (!bgState[id]) bgState[id] = { status:'VD' };
  bgState[id].muc_do = m;
  // Re-render only the muc-do row to update active state
  const g = bgGroups.find(g=>g.items.some(x=>x.id===id));
  const it = g.items.find(x=>x.id===id);
  document.getElementById('bg-detail-'+id).innerHTML = bgItemTaiSanDetailHtml(it);
};

window.bgUpdateTaiSanMoTa = function(id, v){
  if (!bgState[id]) bgState[id] = { status:'VD' };
  bgState[id].mo_ta = v;
  bgUpdateProgress();
};

window.bgAddTaiSanPhoto = function(id, input){
  const f = input.files && input.files[0];
  if (!f) return;
  // Mở CamScanner perspective crop
  if (typeof csOpenFromFile === 'function') {
    csOpenFromFile(f, {
      onComplete: blob => {
        const r = new FileReader();
        r.onload = e => {
          if (!bgState[id]) bgState[id] = { status:'VD' };
          if (!bgState[id].anh_urls) bgState[id].anh_urls = [];
          if (bgState[id].anh_urls.length >= 4) { showToast('Tối đa 4 ảnh / mục', 'warn'); return; }
          bgState[id].anh_urls.push({ blob, dataUrl: e.target.result });
          const g = bgGroups.find(g=>g.items.some(x=>x.id===id));
          const it = g.items.find(x=>x.id===id);
          document.getElementById('bg-detail-'+id).innerHTML = bgItemTaiSanDetailHtml({
            ...it,
            // attach dataUrl-only display for rendering
          });
          // Patch state: render lưu dataUrl trong anh_urls
          // Hiển thị lại detail
          const det = bgState[id].anh_urls.map((p,i)=>p.dataUrl);
          // re-render
          const it2 = it;
          const stCopy = bgState[id];
          stCopy._displayUrls = det;
          document.getElementById('bg-detail-'+id).innerHTML = (function(){
            const photos = det.map((url,i)=>`<div class="chk-photo-wrap"><img class="chk-photo-thumb" src="${url}"><div class="chk-photo-del" onclick="bgDelTaiSanPhoto('${id}',${i})">×</div></div>`).join('');
            return `<div class="chk-vd-detail">
              <div class="chk-mucdo-row">
                <button class="chk-mucdo nhe ${stCopy.muc_do==='CAN_THIET'?'active':''}" onclick="bgSetMucDo('${id}','CAN_THIET')">Cần thiết</button>
                <button class="chk-mucdo vua ${stCopy.muc_do==='QUAN_TRONG'?'active':''}" onclick="bgSetMucDo('${id}','QUAN_TRONG')">Quan trọng</button>
                <button class="chk-mucdo khan ${stCopy.muc_do==='KHAN_CAP'?'active':''}" onclick="bgSetMucDo('${id}','KHAN_CAP')">Khẩn cấp</button>
              </div>
              <textarea class="chk-vd-textarea" placeholder="Mô tả vấn đề (bắt buộc)..." 
                oninput="bgUpdateTaiSanMoTa('${id}', this.value)">${escHtml(stCopy.mo_ta||'')}</textarea>
              <div class="chk-photo-row">
                ${photos}
                <label class="chk-photo-add">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Ảnh
                  <input type="file" accept="image/*" style="display:none" onchange="bgAddTaiSanPhoto('${id}', this)">
                </label>
              </div>
            </div>`;
          })();
        };
        r.readAsDataURL(blob);
      },
      onCancel: ()=>{}
    });
  } else {
    showToast('Module CamScanner chưa tải xong', 'warn');
  }
  input.value = '';
};

window.bgDelTaiSanPhoto = function(id, idx){
  if (bgState[id] && bgState[id].anh_urls){
    bgState[id].anh_urls.splice(idx, 1);
    const g = bgGroups.find(g=>g.items.some(x=>x.id===id));
    const it = g.items.find(x=>x.id===id);
    const det = bgState[id].anh_urls.map(p=>p.dataUrl);
    const stCopy = bgState[id];
    const photos = det.map((url,i)=>`<div class="chk-photo-wrap"><img class="chk-photo-thumb" src="${url}"><div class="chk-photo-del" onclick="bgDelTaiSanPhoto('${id}',${i})">×</div></div>`).join('');
    document.getElementById('bg-detail-'+id).innerHTML = `<div class="chk-vd-detail">
      <div class="chk-mucdo-row">
        <button class="chk-mucdo nhe ${stCopy.muc_do==='CAN_THIET'?'active':''}" onclick="bgSetMucDo('${id}','CAN_THIET')">Cần thiết</button>
        <button class="chk-mucdo vua ${stCopy.muc_do==='QUAN_TRONG'?'active':''}" onclick="bgSetMucDo('${id}','QUAN_TRONG')">Quan trọng</button>
        <button class="chk-mucdo khan ${stCopy.muc_do==='KHAN_CAP'?'active':''}" onclick="bgSetMucDo('${id}','KHAN_CAP')">Khẩn cấp</button>
      </div>
      <textarea class="chk-vd-textarea" placeholder="Mô tả vấn đề (bắt buộc)..." 
        oninput="bgUpdateTaiSanMoTa('${id}', this.value)">${escHtml(stCopy.mo_ta||'')}</textarea>
      <div class="chk-photo-row">
        ${photos}
        <label class="chk-photo-add">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Ảnh
          <input type="file" accept="image/*" style="display:none" onchange="bgAddTaiSanPhoto('${id}', this)">
        </label>
      </div>
    </div>`;
  }
};

// Quick OK: tick "Bình thường" tất cả items trong nhóm tài sản
window.bgQuickOK = function(groupKey){
  const g = bgGroups.find(x=>x.key===groupKey);
  if (!g || g.type !== 'taisan') return;
  g.items.forEach(it => { bgState[it.id] = { status:'BT' }; });
  g.items.forEach(it => {
    const el = document.getElementById('bg-item-'+it.id);
    if (el) el.outerHTML = bgItemTaiSanHtml(it);
  });
  bgUpdateGroupStatus(groupKey);
  bgUpdateProgress();
  // Highlight quick button briefly
  const btn = document.getElementById('bg-quick-'+groupKey);
  if (btn){ btn.classList.add('active'); setTimeout(()=>btn.classList.remove('active'), 600); }
};

window.bgToggleGroup = function(key){
  document.getElementById('bg-g-'+key).classList.toggle('open');
};

// ─── Group Hàng hóa (3 sub-section KV × 3 nhóm hàng) ──────────────────
function bgRenderGroupHang(g){
  let html = '';
  let lastKV = null;
  g.items.forEach(it => {
    if (it.khu_vuc !== lastKV) {
      html += `<div class="bg-subhead">Khu vực: ${escHtml(it.khu_vuc_label)}</div>`;
      lastKV = it.khu_vuc;
    }
    const st = bgState[it.id] || {};
    const sl = (st.so_luong!==undefined && st.so_luong !== null) ? st.so_luong : '';
    const note = st.ghi_chu || '';
    html += `<div class="bg-hang-row" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F8FAFC">
      <div style="flex:1;font-size:13px;color:#1E293B;font-weight:500">${escHtml(it.ten)}</div>
      <input type="number" inputmode="numeric" min="0" 
        style="width:84px;padding:9px 11px;text-align:right;border:1.5px solid #E2E8F0;border-radius:10px;color:#0F172A;background:#F8FAFC"
        value="${sl}" placeholder="-"
        onfocus="this.style.background='#fff'; this.style.borderColor='#10B981';"
        onblur="this.style.background='#F8FAFC'; this.style.borderColor='#E2E8F0';"
        onchange="bgUpdateHang('${it.id}', this.value)">
      <button class="${note?'has':''}" onclick="bgToggleHangNote('${it.id}')" 
        style="width:34px;height:34px;border-radius:9px;border:1.5px solid ${note?'#EAB308':'#E2E8F0'};background:${note?'linear-gradient(135deg,#FEF9C3,#FDE047)':'#fff'};color:${note?'#854D0E':'#94A3B8'};cursor:pointer;display:flex;align-items:center;justify-content:center">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </button>
    </div>
    <div id="bg-hang-note-${it.id}" style="display:${note?'block':'none'};padding:0 0 10px">
      <textarea class="chk-vd-textarea" oninput="bgUpdateHangNote('${it.id}', this.value)"
        placeholder="Ghi chú / chênh lệch..."
        style="border-color:#EAB308;background:#FEFCE8">${escHtml(note)}</textarea>
    </div>`;
  });
  return html;
}
window.bgUpdateHang = function(id, raw){
  const v = parseInt(raw, 10);
  if (!bgState[id]) bgState[id] = {};
  bgState[id].so_luong = isNaN(v) ? null : v;
  bgUpdateProgress();
};
window.bgToggleHangNote = function(id){
  const el = document.getElementById('bg-hang-note-'+id);
  if (!el) return;
  el.style.display = el.style.display==='none' ? 'block' : 'none';
};
window.bgUpdateHangNote = function(id, v){
  if (!bgState[id]) bgState[id] = {};
  bgState[id].ghi_chu = v;
};

// ─── Group Ảnh biên bản giấy ───────────────────────────────────────────
function bgRenderGroupAnh(g){
  const photos = bgPhotos.map((p,i) => 
    `<div class="chk-photo-wrap"><img class="chk-photo-thumb" src="${p.dataUrl}" style="width:84px;height:84px"><div class="chk-photo-del" onclick="bgDelBienBanPhoto(${i})">×</div></div>`
  ).join('');
  const canAdd = bgPhotos.length < 6;
  return `<div class="chk-photo-row" id="bg-anh-row" style="padding:6px 0 4px">
    ${photos}
    ${canAdd ? `<label class="chk-photo-add" style="width:84px;height:84px;border-color:#10B981;color:#047857;background:#ECFDF5;font-weight:700;font-size:11px;border-radius:12px;border-width:2px">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span style="margin-top:4px">Chọn ảnh</span>
      <input type="file" accept="image/*" style="display:none" onchange="bgAddBienBanPhoto(this)">
    </label>` : ''}
  </div>`;
}

window.bgAddBienBanPhoto = function(input){
  const f = input.files && input.files[0];
  if (!f) return;
  if (bgPhotos.length >= 6) { showToast('Tối đa 6 ảnh biên bản', 'warn'); input.value=''; return; }
  if (typeof csOpenFromFile !== 'function') { showToast('Module xử lý ảnh chưa tải xong', 'warn'); return; }
  csOpenFromFile(f, {
    onComplete: blob => {
      const r = new FileReader();
      r.onload = e => {
        bgPhotos.push({ blob, dataUrl: e.target.result });
        document.getElementById('bg-g-anh').querySelector('.chk-group-body').innerHTML = bgRenderGroupAnh({type:'anh',items:[]});
        document.getElementById('bg-gstatus-anh').textContent = bgPhotos.length + ' ảnh';
        bgUpdateProgress();
      };
      r.readAsDataURL(blob);
    },
    onCancel: ()=>{}
  });
  input.value = '';
};
window.bgDelBienBanPhoto = function(i){
  bgPhotos.splice(i,1);
  document.getElementById('bg-g-anh').querySelector('.chk-group-body').innerHTML = bgRenderGroupAnh({type:'anh',items:[]});
  document.getElementById('bg-gstatus-anh').textContent = bgPhotos.length + ' ảnh';
  bgUpdateProgress();
};

// ═════════════════════════════════════════════════════════════════════════
//  PROGRESS & GROUP STATUS
// ═════════════════════════════════════════════════════════════════════════
function bgUpdateGroupStatusForItem(itemId){
  const g = bgGroups.find(g=>g.items.some(x=>x.id===itemId));
  if (g) bgUpdateGroupStatus(g.key);
}
function bgUpdateGroupStatus(key){
  const g = bgGroups.find(x=>x.key===key);
  if (!g || g.type !== 'taisan') return;
  const items = g.items;
  const checked = items.filter(it=>bgState[it.id] && bgState[it.id].status).length;
  const issues = items.filter(it=>bgState[it.id] && bgState[it.id].status==='VD').length;
  const gel = document.getElementById('bg-g-'+key);
  const sel = document.getElementById('bg-gstatus-'+key);
  gel.classList.remove('done-ok','done-issue');
  if (checked === items.length) {
    if (issues > 0) { gel.classList.add('done-issue'); sel.textContent = issues + ' vấn đề'; }
    else { gel.classList.add('done-ok'); sel.textContent = 'Tất cả bình thường'; }
  } else {
    sel.textContent = checked + '/' + items.length;
  }
}

function bgUpdateProgress(){
  // Đếm "phần" hoàn thành (6 groups)
  let doneCount = 0;
  let issues = 0;
  let anyHang = false; // [v13.40.1] hoist
  let anhOK = bgPhotos.length >= 1;

  // Tiền: cần nhập đủ 3 dòng tiền (>=0 cũng tính là nhập nếu user đã chạm — kiểm bằng key tồn tại)
  const tienOK = ['tien_mat_ket','tien_ban_hang','tien_chi'].every(k => bgState[k] && bgState[k].so_tien !== undefined);
  if (tienOK) doneCount++;

  // 3 nhóm tài sản: hết items đã có status (progress bar đếm; KHÔNG bắt buộc gửi)
  for (const kv of [1,2,4]) {
    const g = bgGroups.find(x=>x.key==='ts_kv'+kv);
    if (!g) continue;
    const filled = g.items.every(it=>bgState[it.id] && bgState[it.id].status);
    if (filled) doneCount++;
    issues += g.items.filter(it=>bgState[it.id] && bgState[it.id].status==='VD').length;
    bgUpdateGroupStatus(g.key);
  }

  // Hàng: cần nhập ít nhất 1 dòng (>=0)
  const hangG = bgGroups.find(x=>x.key==='hang');
  if (hangG){
    anyHang = hangG.items.some(it=>bgState[it.id] && bgState[it.id].so_luong !== undefined && bgState[it.id].so_luong !== null);
    if (anyHang) doneCount++;
  }

  // Ảnh: >= 1
  if (anhOK) doneCount++;

  const txt = document.getElementById('bg-progress-text');
  const isb = document.getElementById('bg-progress-issues');
  const fill = document.getElementById('bg-progress-fill');
  const btn = document.getElementById('bg-submit-btn');
  if (txt) txt.textContent = 'Hoàn thành '+doneCount+'/6 phần';
  if (isb) isb.textContent = issues > 0 ? (issues + ' vấn đề') : '';
  if (fill) fill.style.width = (doneCount/6*100) + '%';
  if (btn) {
    // [v13.40.1] FIX: 3 KV tài sản KHÔNG bắt buộc — hạng mục chưa chọn sẽ tự lưu 'KHÔNG CÓ'.
    // Chỉ cần Tiền + Hàng + Ảnh là gửi được.
    const required = tienOK && anyHang && anhOK;
    btn.disabled = !required;
  }
}

// ═════════════════════════════════════════════════════════════════════════
//  SUBMIT
// ═════════════════════════════════════════════════════════════════════════
async function bgSubmit(){
  const btn = document.getElementById('bg-submit-btn');
  
  // Validate items VD cần có mô tả
  const itemsVD = [];
  bgGroups.filter(g=>g.type==='taisan').forEach(g => {
    g.items.forEach(it => {
      const st = bgState[it.id];
      if (st && st.status === 'VD' && (!st.mo_ta || !st.mo_ta.trim())) {
        itemsVD.push(it.ten);
      }
    });
  });
  if (itemsVD.length > 0){
    showToast('Mục "Có vấn đề" cần nhập mô tả: '+itemsVD[0]+(itemsVD.length>1?' và '+(itemsVD.length-1)+' mục khác':''), 'warn');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Đang gửi...';

  try {
    // 1) Upload ảnh biên bản giấy
    const anhUrls = [], anhPaths = [];
    const bucket = 'bien-ban-ban-giao';
    const ngay = new Date().toISOString().slice(0,10);
    for (let i = 0; i < bgPhotos.length; i++){
      btn.innerHTML = 'Tải ảnh '+(i+1)+'/'+bgPhotos.length+'...';
      const p = bgPhotos[i];
      const path = `${bgCurrentCH.ma}/${ngay}/${Date.now()}_${i}_${SESSION.ma}.jpg`;
      const { error: ue } = await supa.storage.from(bucket).upload(path, p.blob, { contentType:'image/jpeg' });
      if (ue) throw new Error('Upload ảnh '+(i+1)+': '+ue.message);
      const { data: pub } = supa.storage.from(bucket).getPublicUrl(path);
      anhUrls.push(pub.publicUrl);
      anhPaths.push(path);
    }

    // 2) Upload ảnh per-item (chỉ items VD)
    btn.innerHTML = 'Tải ảnh hạng mục...';
    const itemAnh = {};  // {itemId: [urls]}
    for (const g of bgGroups.filter(g=>g.type==='taisan')){
      for (const it of g.items){
        const st = bgState[it.id];
        if (st && st.status === 'VD' && st.anh_urls && st.anh_urls.length){
          const urls = [];
          for (let i = 0; i < st.anh_urls.length; i++){
            const p = st.anh_urls[i];
            if (!p.blob) { urls.push(p.dataUrl || p); continue; }
            const path = `${bgCurrentCH.ma}/${ngay}/item_${it.stt}_${Date.now()}_${i}_${SESSION.ma}.jpg`;
            const { error: ue } = await supa.storage.from(bucket).upload(path, p.blob, { contentType:'image/jpeg' });
            if (!ue) {
              const { data: pub } = supa.storage.from(bucket).getPublicUrl(path);
              urls.push(pub.publicUrl);
            }
          }
          itemAnh[it.id] = urls;
        }
      }
    }

    // 3) Build chi tiết tài sản (45 items)
    btn.innerHTML = 'Đang lưu biên bản...';
    const chi_tiet_tai_san = [];
    bgGroups.filter(g=>g.type==='taisan').forEach(g => {
      g.items.forEach(it => {
        const st = bgState[it.id] || {};
        // [v13.71] "KHÔNG CÓ" chỉ khi NV bấm nút "Không có" (status KO); giữ backward các mã cũ
        const isKhongCo = st.status === 'KO' || st.status === 'K' || st.status === 'KC' || st.status === 'KHONG_CO';
        chi_tiet_tai_san.push({
          stt: it.stt, ten: it.ten, don_vi: it.don_vi, khu_vuc: it.khu_vuc,
          dat: st.status !== 'VD',
          ghi_chu: st.status==='VD' ? (st.mo_ta||null) : (isKhongCo ? 'KHÔNG CÓ' : null)
        });
      });
    });

    // 4) Build hàng
    const chi_tiet_hang = [];
    const hangG = bgGroups.find(g=>g.key==='hang');
    if (hangG){
      hangG.items.forEach(it => {
        const st = bgState[it.id] || {};
        if (st.so_luong !== undefined && st.so_luong !== null){
          chi_tiet_hang.push({
            khu_vuc: it.khu_vuc,
            nhom_hang: it.nhom_hang,
            so_luong_thuc_te: st.so_luong,
            ghi_chu: st.ghi_chu || null
          });
        }
      });
    }

    // 5) Gọi RPC tạo biên bản
    const { data: banGiaoId, error: ce } = await supa.rpc('fn_ban_giao_create', {
      p_ma_ch: bgCurrentCH.ma,
      p_ten_ch_snapshot: bgCurrentCH.ten,
      p_nguoi_ban_giao_ma_nv: SESSION.ma,
      p_nguoi_ban_giao_ten: SESSION.ten || SESSION.hoTen || '',
      p_nguoi_ban_giao_chuc_vu: SESSION.vaiTro || 'NV',
      p_ngay_ban_giao: ngay,
      p_gio_ban_giao: new Date().toTimeString().slice(0,8),
      p_thoi_gian_chot_tu: null,
      p_thoi_gian_chot_den: null,
      p_tien_mat_ket: (bgState['tien_mat_ket']&&bgState['tien_mat_ket'].so_tien)||0,
      p_tien_mat_ket_ghi_chu: (bgState['tien_mat_ket']&&bgState['tien_mat_ket'].ghi_chu)||null,
      p_tien_ban_hang: (bgState['tien_ban_hang']&&bgState['tien_ban_hang'].so_tien)||0,
      p_tien_ban_hang_ghi_chu: (bgState['tien_ban_hang']&&bgState['tien_ban_hang'].ghi_chu)||null,
      p_tien_chi: (bgState['tien_chi']&&bgState['tien_chi'].so_tien)||0,
      p_tien_chi_ghi_chu: (bgState['tien_chi']&&bgState['tien_chi'].ghi_chu)||null,
      p_ghi_chu_chung: document.getElementById('bg-ghichu').value || null,
      p_anh_urls: anhUrls,
      p_anh_storage_paths: anhPaths,
      p_chi_tiet_tai_san: chi_tiet_tai_san,
      p_chi_tiet_hang: chi_tiet_hang
    });
    if (ce) throw ce;

    // 6) Auto tạo sự vụ cho từng item VD + chênh tiền + chênh hàng
    btn.innerHTML = 'Tạo sự vụ...';
    let svCount = 0;
    for (const g of bgGroups.filter(g=>g.type==='taisan')){
      for (const it of g.items){
        const st = bgState[it.id];
        if (st && st.status === 'VD'){
          await supa.rpc('fn_su_vu_create', {
            p_ban_giao_id: banGiaoId,
            p_loai: 'TAI_SAN_KHONG_DAT',
            p_ma_ch: bgCurrentCH.ma,
            p_ten_ch_snapshot: bgCurrentCH.ten,
            p_nguoi_tao_ma_nv: SESSION.ma,
            p_nguoi_tao_ten: SESSION.ten || SESSION.hoTen || '',
            p_nguoi_tao_chuc_vu: SESSION.vaiTro || 'NV',
            p_tieu_de: it.ten,
            p_mo_ta: st.mo_ta || '',
            p_so_lieu: { stt:it.stt, khu_vuc:it.khu_vuc, nhom_hang:null },
            p_anh_urls: itemAnh[it.id] || [],
            p_muc_do: st.muc_do || 'CAN_THIET'
          });
          svCount++;
        }
      }
    }
    // Tiền lệch
    for (const k of ['tien_mat_ket','tien_ban_hang','tien_chi']){
      const note = bgState[k] && bgState[k].ghi_chu;
      if (note && note.trim()){
        const LBL = { tien_mat_ket:'Tiền két', tien_ban_hang:'Tiền bán hàng', tien_chi:'Tiền chi' }[k];
        await supa.rpc('fn_su_vu_create', {
          p_ban_giao_id: banGiaoId, p_loai:'TIEN_LECH',
          p_ma_ch: bgCurrentCH.ma, p_ten_ch_snapshot: bgCurrentCH.ten,
          p_nguoi_tao_ma_nv: SESSION.ma, p_nguoi_tao_ten: SESSION.ten||SESSION.hoTen||'',
          p_nguoi_tao_chuc_vu: SESSION.vaiTro || 'NV',
          p_tieu_de: LBL,
          p_mo_ta: note,
          p_so_lieu: { loai:k, so_tien: bgState[k].so_tien||0 },
          p_anh_urls: [], p_muc_do: (k === 'tien_chi' ? 'QUAN_TRONG' : 'KHAN_CAP')
        });
        svCount++;
      }
    }
    // Hàng có ghi chú
    if (hangG){
      for (const it of hangG.items){
        const st = bgState[it.id];
        if (st && st.ghi_chu && st.ghi_chu.trim()){
          await supa.rpc('fn_su_vu_create', {
            p_ban_giao_id: banGiaoId, p_loai:'HANG_CHENH',
            p_ma_ch: bgCurrentCH.ma, p_ten_ch_snapshot: bgCurrentCH.ten,
            p_nguoi_tao_ma_nv: SESSION.ma, p_nguoi_tao_ten: SESSION.ten||SESSION.hoTen||'',
            p_nguoi_tao_chuc_vu: SESSION.vaiTro || 'NV',
            p_tieu_de: (function(){
              var kvMap = { 'SANH':'Trưng bày', 'KHO':'Kho', 'NIEM_PHONG':'Niêm phong' };
              var nhom = (it.nhom_hang||'').replace(/^Nhóm\s+/i, '').replace(/\s*\(.+?\)\s*$/,'').trim();
              var kv = kvMap[it.khu_vuc] || it.khu_vuc || '';
              return nhom + (kv ? ' - ' + kv : '');
            })(),
            p_mo_ta: st.ghi_chu,
            p_so_lieu: { khu_vuc:it.khu_vuc, nhom:it.nhom_hang, sl:st.so_luong||0 },
            p_anh_urls: [], p_muc_do: 'QUAN_TRONG'
          });
          svCount++;
        }
      }
    }

    showToast(`✓ Đã gửi biên bản${svCount?' · '+svCount+' sự vụ':''}`, 'ok');
    // Reset
    bgState = {}; bgPhotos = [];
    document.getElementById('bg-ghichu').value = '';
    bgRenderForm();
    bgSwitchSub('today');
  } catch(e){
    console.error(e);
    showToast('⚠ ' + (e.message||'Lỗi gửi'), 'warn');
    btn.disabled = false; btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Hoàn tất & gửi';
  }
}
window.bgSubmit = bgSubmit;

// ═════════════════════════════════════════════════════════════════════════
//  TAB 2: SỰ VỤ — danh sách sự vụ phát sinh từ biên bản bàn giao
// ═════════════════════════════════════════════════════════════════════════
async function bgRenderSuVu(){
  const list = document.getElementById('bg-suvu-list');
  list.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
  if (!bgCurrentCH){ list.innerHTML = '<div class="ns-empty">Chưa xác định cửa hàng.</div>'; return; }
  try {
    const { data, error } = await supa.rpc('fn_su_vu_list', {
      p_ma_ch: bgCurrentCH.ma,
      p_limit: 100, p_offset: 0
    });
    if (error) throw error;
    const cnt = document.getElementById('bg-suvu-count');
    const opened = (data||[]).filter(s => !['HOAN_TAT','HUY'].includes(s.trang_thai));
    if (!data || data.length === 0){
      list.innerHTML = '<div class="ns-empty">Chưa có sự vụ nào.</div>';
      cnt.style.display = 'none';
      return;
    }
    if (opened.length > 0) { cnt.style.display=''; cnt.textContent = opened.length; }
    else cnt.style.display = 'none';
    list.innerHTML = data.map(bgSuVuCardHtml).join('');
  } catch(e){ list.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+e.message+'</div>'; }
}

function bgSuVuCardHtml(s){
  const mdLbl = { KHAN_CAP:'Khẩn cấp', QUAN_TRONG:'Quan trọng', CAN_THIET:'Cần thiết' }[s.muc_do]||s.muc_do;
  const mdCls = s.muc_do==='KHAN_CAP'?'khan':s.muc_do==='QUAN_TRONG'?'vua':'nhe';
  const stLbl = { MOI_TAO:'Mới tạo', DA_TIEP_NHAN:'Đã tiếp nhận', DANG_XU_LY:'Đang xử lý', DA_PHAN_HOI:'Đã phản hồi', HOAN_TAT:'Hoàn tất', HUY:'Hủy' }[s.trang_thai]||s.trang_thai;
  const isOpen = !['HOAN_TAT','HUY'].includes(s.trang_thai);
  const borderColor = s.muc_do==='KHAN_CAP'?'#DC2626':s.muc_do==='QUAN_TRONG'?'#F97316':'#1B4965';
  return `<div class="chk-rec ${isOpen?'has-issue':''}" style="border-left:4px solid ${borderColor}">
    <div class="chk-rec-head">
      <div class="chk-rec-top">
        <span class="chk-rec-time">${bgFmtDateTimeShort(s.created_at)}</span>
        <span class="chk-mucdo-tag ${mdCls}" style="font-weight:700">${mdLbl}</span>
        <span class="chk-rec-badge ${isOpen?'issue':'ok'}" style="margin-left:auto">${stLbl}</span>
      </div>
      <div style="font-weight:700;font-size:14px;color:#0F172A;margin-top:4px">${escHtml(s.tieu_de)}</div>
      <div class="chk-rec-by">Tạo: ${escHtml(s.nguoi_tao_ten||'?')}${s.nguoi_phu_trach_ten?' · Phụ trách: '+escHtml(s.nguoi_phu_trach_ten):''}</div>
      ${s.mo_ta?`<div class="chk-rec-note">${escHtml(s.mo_ta).slice(0,160)}</div>`:''}
      ${s.phan_hoi_xu_ly?`<div style="margin-top:6px;padding:8px 10px;background:#F0F7FB;border-left:3px solid #1B4965;border-radius:6px;font-size:12.5px;color:#0F2E45"><b style="color:#1B4965">Phản hồi:</b> ${escHtml(s.phan_hoi_xu_ly).slice(0,200)}</div>`:''}
    </div>
  </div>`;
}

function bgFmtDateTimeShort(s){
  if (!s) return '';
  const d = new Date(s);
  return pad(d.getDate())+'/'+pad(d.getMonth()+1)+' ' + pad(d.getHours())+':'+pad(d.getMinutes());
}

function bgRecHtml(b){
  const t = b.gio_ban_giao ? b.gio_ban_giao.slice(0,5) : '';
  const hasIssue = (b.so_su_vu||0) > 0 || (b.so_item_khong_dat||0) > 0;
  return `<div class="chk-rec ${hasIssue?'has-issue':''}">
    <div class="chk-rec-head">
      <div class="chk-rec-top">
        <span class="chk-rec-time">${t}</span>
        <span class="chk-rec-badge ${hasIssue?'issue':'ok'}">
          ${hasIssue ? ((b.so_su_vu||0) + ' sự vụ' + (b.so_su_vu_khan>0 ? ' · '+b.so_su_vu_khan+' khẩn':'')) : 'Bình thường'}
        </span>
      </div>
      <div class="chk-rec-by">${escHtml(b.nguoi_ban_giao_ten||'?')} · ${bgFmtVN(b.tien_tong||0)}đ · ${b.so_anh||0} ảnh</div>
    </div>
  </div>`;
}

// ═════════════════════════════════════════════════════════════════════════
//  TAB 3: TIMELINE — "bản tin" biên bản bàn giao
//  Filter chip: Tất cả / Có ảnh / Có sự vụ / Khẩn cấp
//  Card visual: thumbnail ảnh + tóm tắt (tiền, items VD, sự vụ)
//  Group theo ngày: Hôm nay / Hôm qua / DD/MM
// ═════════════════════════════════════════════════════════════════════════
//  [v13.26] TIMELINE NV — 2 mode Đơn/Ảnh + dropdown filter
// ═════════════════════════════════════════════════════════════════════════
let bgTimelineMode = 'don';       // 'don' | 'anh'
let bgTimelineCond = 'all';       // 'all' | 'binh_thuong' | 'co_su_vu' | 'KHAN_CAP'
let bgTimelineDay = 'all';        // 'all' | 'today' | '7d' | '30d'
let bgTimelineCache = null;

async function bgRenderTimeline(){
  const list = document.getElementById('bg-timeline-list');
  if (!bgTimelineCache) {
    list.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
    if (!bgCurrentCH){ list.innerHTML = '<div class="ns-empty">Chưa xác định cửa hàng.</div>'; return; }
    try {
      // [v13.26] fn_bg_timeline_list — JOIN ban_giao_anh để có anh_urls
      const { data, error } = await supa.rpc('fn_bg_timeline_list', {
        p_ma_ch: bgCurrentCH.ma, p_limit: 200
      });
      if (error) throw error;
      bgTimelineCache = Array.isArray(data) ? data : [];
    } catch(e){
      list.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+escHtml(e.message)+'</div>';
      return;
    }
  }
  bgRenderTimelineMode();
}

function bgRenderTimelineMode(){
  const list = document.getElementById('bg-timeline-list');
  const all = bgTimelineCache || [];

  // Apply filters
  let arr = all.slice();
  if (bgTimelineCond === 'binh_thuong') arr = arr.filter(b => (b.so_su_vu||0) === 0);
  else if (bgTimelineCond === 'co_su_vu') arr = arr.filter(b => (b.so_su_vu||0) > 0);
  else if (bgTimelineCond === 'KHAN_CAP') arr = arr.filter(b => (b.so_su_vu_khan||0) > 0);

  if (bgTimelineDay !== 'all') {
    const now = new Date(); now.setHours(0,0,0,0);
    let from;
    if (bgTimelineDay === 'today') from = now.toISOString().slice(0,10);
    else if (bgTimelineDay === '7d') {
      const d = new Date(now); d.setDate(d.getDate()-7);
      from = d.toISOString().slice(0,10);
    } else {
      const d = new Date(now); d.setDate(d.getDate()-30);
      from = d.toISOString().slice(0,10);
    }
    arr = arr.filter(b => b.ngay_ban_giao >= from);
  }

  const tongDon = all.length;
  const tongAnh = all.reduce((s, b) => s + ((b.anh_urls && b.anh_urls.length) || 0), 0);

  const header = `
    <div class="bg-tl-mode-tabs">
      <button class="bg-tl-mode ${bgTimelineMode==='don'?'active':''}" onclick="bgSetTimelineMode('don')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Đơn <span class="bg-tl-mode-c">${tongDon}</span>
      </button>
      <button class="bg-tl-mode ${bgTimelineMode==='anh'?'active':''}" onclick="bgSetTimelineMode('anh')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Ảnh <span class="bg-tl-mode-c">${tongAnh}</span>
      </button>
    </div>
    <div class="bg-tl-filters-row">
      <select class="bg-tl-dropdown" onchange="bgSetTimelineCond(this.value)">
        <option value="all"${bgTimelineCond==='all'?' selected':''}>Tình trạng: Tất cả</option>
        <option value="binh_thuong"${bgTimelineCond==='binh_thuong'?' selected':''}>Bình thường</option>
        <option value="co_su_vu"${bgTimelineCond==='co_su_vu'?' selected':''}>Có sự vụ</option>
        <option value="KHAN_CAP"${bgTimelineCond==='KHAN_CAP'?' selected':''}>Khẩn cấp</option>
      </select>
      <select class="bg-tl-dropdown" onchange="bgSetTimelineDay(this.value)">
        <option value="all"${bgTimelineDay==='all'?' selected':''}>Mọi thời gian</option>
        <option value="today"${bgTimelineDay==='today'?' selected':''}>Hôm nay</option>
        <option value="7d"${bgTimelineDay==='7d'?' selected':''}>7 ngày qua</option>
        <option value="30d"${bgTimelineDay==='30d'?' selected':''}>30 ngày qua</option>
      </select>
    </div>
  `;

  let body;
  if (bgTimelineMode === 'anh') {
    body = bgRenderTimelineAnh(arr.filter(b => b.anh_urls && b.anh_urls.length));
  } else {
    body = bgRenderTimelineDon(arr);
  }
  list.innerHTML = header + body;
}

function bgRenderTimelineDon(arr) {
  if (arr.length === 0) return '<div class="ns-empty">Không có biên bản phù hợp.</div>';
  const byDay = {};
  arr.forEach(b => {
    const d = b.ngay_ban_giao;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(b);
  });
  const days = Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
  return days.map(d => `
    <div class="bg-tl-daysep">${bgFmtDayVN(d)}</div>
    ${byDay[d].map(bgTimelineCardHtml).join('')}
  `).join('');
}

function bgRenderTimelineAnh(arr) {
  const items = [];
  arr.forEach(b => {
    if (!b.anh_urls) return;
    b.anh_urls.forEach(url => items.push({
      url, ban_giao_id: b.id, ngay: b.ngay_ban_giao,
      time: b.gio_ban_giao, by: b.nguoi_ban_giao_ten,
      khan: (b.so_su_vu_khan||0) > 0
    }));
  });
  if (items.length === 0) return '<div class="ns-empty">Không có ảnh phù hợp.</div>';
  const byDay = {};
  items.forEach(it => {
    if (!byDay[it.ngay]) byDay[it.ngay] = [];
    byDay[it.ngay].push(it);
  });
  const days = Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
  return days.map(d => `
    <div class="bg-tl-daysep">${bgFmtDayVN(d)} · ${byDay[d].length} ảnh</div>
    <div class="bg-tl-anh-grid">
      ${byDay[d].map(it => `
        <div class="bg-tl-anh-cell${it.khan?' khan':''}" onclick="bgViewImage('${it.url}')">
          <img src="${it.url}" loading="lazy">
          <div class="bg-tl-anh-meta">${(it.time||'').slice(0,5)} · ${escHtml((it.by||'?').slice(0,14))}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function bgTimelineCardHtml(b){
  const time = b.gio_ban_giao ? b.gio_ban_giao.slice(0,5) : '';
  const tien = bgFmtVN(b.tien_tong||0);
  const soAnh = b.so_anh || 0;
  const soSV = b.so_su_vu || 0;
  const soKhan = b.so_su_vu_khan || 0;
  const soKD = b.so_item_khong_dat || 0;
  const accent = soKhan > 0 ? '#DC2626' : soSV > 0 ? '#F97316' : '#10B981';
  
  let thumbsHtml = '';
  if (b.anh_urls && b.anh_urls.length > 0){
    const show = b.anh_urls.slice(0, 3);
    thumbsHtml = `<div class="bg-tl-thumbs">
      ${show.map(url => `<div class="bg-tl-thumb" onclick="event.stopPropagation(); bgViewImage('${url}')"><img src="${url}" loading="lazy"></div>`).join('')}
      ${b.anh_urls.length > 3 ? `<div class="bg-tl-thumb bg-tl-thumb-more">+${b.anh_urls.length-3}</div>` : ''}
    </div>`;
  }

  return `<div class="bg-tl-card" onclick="bgOpenBanGiaoDetail('${b.id}')" style="border-left:4px solid ${accent}">
    <div class="bg-tl-head">
      <div class="bg-tl-time">${time}</div>
      <div class="bg-tl-by">${escHtml(b.nguoi_ban_giao_ten||'?')}</div>
      ${soKhan>0?`<div class="bg-tl-tag khan">${soKhan} khẩn</div>`:''}
    </div>
    <div class="bg-tl-metrics">
      <div class="bg-tl-metric"><div class="bg-tl-metric-v">${tien}<span style="font-size:11px;font-weight:600;opacity:.7"> đ</span></div><div class="bg-tl-metric-l">Tổng tiền</div></div>
      <div class="bg-tl-metric"><div class="bg-tl-metric-v" style="${soKD>0?'color:#DC2626':''}">${soKD}</div><div class="bg-tl-metric-l">Không đạt</div></div>
      <div class="bg-tl-metric"><div class="bg-tl-metric-v" style="${soSV>0?'color:#F97316':''}">${soSV}</div><div class="bg-tl-metric-l">Sự vụ</div></div>
      <div class="bg-tl-metric"><div class="bg-tl-metric-v">${soAnh}</div><div class="bg-tl-metric-l">Ảnh</div></div>
    </div>
    ${thumbsHtml}
  </div>`;
}

window.bgSetTimelineMode = function(m){ bgTimelineMode = m; bgRenderTimelineMode(); };
window.bgSetTimelineCond = function(c){ bgTimelineCond = c; bgRenderTimelineMode(); };
window.bgSetTimelineDay = function(d){ bgTimelineDay = d; bgRenderTimelineMode(); };

window.bgViewImage = function(url){
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer';
  ov.onclick = ()=>ov.remove();
  ov.innerHTML = `<img src="${url}" style="max-width:96%;max-height:96%;object-fit:contain;border-radius:6px">`;
  document.body.appendChild(ov);
};

window.bgOpenBanGiaoDetail = async function(id){
  // Modal full-screen với loading
  const m = document.createElement('div');
  m.className = 'bgql-modal-bg bgdetail-bg';
  m.innerHTML = `<div class="bgql-modal bgdetail-modal">
    <div class="bgql-modal-head">
      <div class="bgql-modal-ttl">Chi tiết biên bản</div>
      <button class="bgql-modal-x" onclick="this.closest('.bgql-modal-bg').remove()">✕</button>
    </div>
    <div class="bgql-modal-body" id="bgdetail-body"><div class="ns-empty">⏳ Đang tải...</div></div>
  </div>`;
  document.body.appendChild(m);
  try {
    // [v13.38] Load detail + trạng thái xác nhận song song
    const [detailRes, xnRes] = await Promise.all([
      supa.rpc('fn_ban_giao_detail', { p_id: id }),
      supa.rpc('fn_bg_xac_nhan_status', { p_ids: [id] }).then(r=>r).catch(()=>({data:null}))
    ]);
    const { data, error } = detailRes;
    if (error) throw error;
    if (!data || data.ok === false) throw new Error((data&&data.error)||'Lỗi');
    const xn = (xnRes.data && xnRes.data[0]) || null;
    document.getElementById('bgdetail-body').innerHTML = bgXacNhanHtml(id, xn) + bgDetailRenderHtml(data);
  } catch(e){
    document.getElementById('bgdetail-body').innerHTML = 
      `<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message||'')}</div>`;
  }
};

// [v13.38] Section xác nhận biên bản — badge + nút cho QL
function bgXacNhanHtml(id, xn){
  const isQL = SESSION && ['ADMIN','QLNS','QLBH'].some(r => (SESSION.vaiTro||'').startsWith(r));
  const daXN = xn && xn.trang_thai === 'DA_XAC_NHAN';
  if (daXN) {
    const t = xn.thoi_gian_xac_nhan ? new Date(xn.thoi_gian_xac_nhan) : null;
    const tStr = t ? pad(t.getHours())+':'+pad(t.getMinutes())+' '+pad(t.getDate())+'/'+pad(t.getMonth()+1) : '';
    return `<div class="bgd-xn bgd-xn-ok">
      Đã xác nhận bởi <b>${escHtml(xn.nguoi_xac_nhan_ten||'QL')}</b>${tStr?' · '+tStr:''}
    </div>`;
  }
  if (isQL) {
    return `<div class="bgd-xn bgd-xn-pending">
      <span>Biên bản chưa được xác nhận</span>
      <button class="bgql-act bgql-act-primary" onclick="bgXacNhanBienBan('${id}', this)">Xác nhận đã kiểm tra</button>
    </div>`;
  }
  return `<div class="bgd-xn bgd-xn-pending"><span>Chờ quản lý xác nhận</span></div>`;
}

window.bgXacNhanBienBan = async function(id, btn){
  if (btn) { btn.disabled = true; btn.textContent = 'Đang xác nhận...'; }
  try {
    const { data, error } = await supa.rpc('fn_bg_xac_nhan', {
      p_id: id, p_ma_nv: SESSION.ma, p_ten: SESSION.ten || SESSION.hoTen || ''
    });
    if (error || (data && data.ok === false)) throw new Error((data&&data.error)||error.message);
    showToast('✓ Đã xác nhận biên bản · NV sẽ nhận thông báo', 'ok');
    // Update section tại chỗ
    const sec = document.querySelector('.bgd-xn');
    if (sec) {
      sec.className = 'bgd-xn bgd-xn-ok';
      const now = new Date();
      sec.innerHTML = `Đã xác nhận bởi <b>${escHtml(SESSION.ten||SESSION.hoTen||'')}</b> · ${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth()+1)}`;
    }
  } catch(e){
    if (btn) { btn.disabled = false; btn.textContent = 'Xác nhận đã kiểm tra'; }
    showToast('⚠ ' + e.message, 'warn');
  }
};

function bgDetailRenderHtml(d){
  const h = d.header || {};
  const dt = new Date(h.created_at);
  const dateStr = pad(dt.getDate())+'/'+pad(dt.getMonth()+1)+'/'+dt.getFullYear()
    +' · '+pad(dt.getHours())+':'+pad(dt.getMinutes());
  const fmt = n => (n||0).toLocaleString('vi-VN');
  
  // Tiền section
  const tienHtml = `<div class="bgd-section">
    <div class="bgd-section-l">Tiền mặt & doanh thu</div>
    <div class="bgd-tien-row"><span>Tiền mặt két & kho</span><b>${fmt(h.tien_mat_ket)} đ</b></div>
    ${h.tien_mat_ket_ghi_chu?`<div class="bgd-note">${escHtml(h.tien_mat_ket_ghi_chu)}</div>`:''}
    <div class="bgd-tien-row"><span>Tiền bán hàng trong ca</span><b>${fmt(h.tien_ban_hang)} đ</b></div>
    ${h.tien_ban_hang_ghi_chu?`<div class="bgd-note">${escHtml(h.tien_ban_hang_ghi_chu)}</div>`:''}
    <div class="bgd-tien-row"><span>Tiền chi trong ca</span><b>${fmt(h.tien_chi)} đ</b></div>
    ${h.tien_chi_ghi_chu?`<div class="bgd-note">${escHtml(h.tien_chi_ghi_chu)}</div>`:''}
    <div class="bgd-tien-tong"><span>Tổng bàn giao</span><b>${fmt(h.tien_tong)} đ</b></div>
  </div>`;

  // Items không đạt
  const itemsKD = Array.isArray(d.items_kd) ? d.items_kd : [];
  const KV_LABEL = { 1: 'Mặt tiền, hạ tầng', 2: 'Quầy thu ngân & IT', 4: 'Kho, sinh hoạt, công cụ' };
  const itemsHtml = itemsKD.length === 0 
    ? `<div class="bgd-section">
        <div class="bgd-section-l">Tài sản · ${d.so_item_dat||0} mục bình thường, ${d.so_item_kd||0} có vấn đề</div>
        <div class="bgd-allok">✓ Tất cả ${d.so_item_dat||0} tài sản đều bình thường</div>
       </div>`
    : `<div class="bgd-section">
        <div class="bgd-section-l">Tài sản có vấn đề · ${itemsKD.length}/${(d.so_item_dat||0)+(d.so_item_kd||0)}</div>
        ${itemsKD.map(it => `<div class="bgd-kd-row">
          <div class="bgd-kd-name">${escHtml(it.ten_hang_muc||'')}<small style="color:#94A3B8"> · ${escHtml(KV_LABEL[it.khu_vuc]||('KV'+it.khu_vuc))}</small></div>
          ${it.ghi_chu?`<div class="bgd-kd-note">${escHtml(it.ghi_chu)}</div>`:''}
        </div>`).join('')}
       </div>`;

  // Hàng hóa
  const hang = Array.isArray(d.hang) ? d.hang : [];
  let hangHtml = '';
  if (hang.length > 0) {
    const KV_L = { SANH:'Trưng bày', KHO:'Kho', NIEM_PHONG:'Niêm phong' };
    const byKV = {};
    hang.forEach(r => { if (!byKV[r.khu_vuc]) byKV[r.khu_vuc] = []; byKV[r.khu_vuc].push(r); });
    hangHtml = `<div class="bgd-section">
      <div class="bgd-section-l">Hàng hóa & tồn kho</div>
      ${Object.keys(byKV).map(kv => `
        <div class="bgd-hang-kv">${KV_L[kv]||kv}</div>
        ${byKV[kv].map(r => `<div class="bgd-tien-row">
          <span>${escHtml(r.nhom_hang||'')}</span>
          <b>${r.so_luong_thuc_te ?? '-'}</b>
        </div>${r.ghi_chu?`<div class="bgd-note">${escHtml(r.ghi_chu)}</div>`:''}`).join('')}
      `).join('')}
    </div>`;
  }

  // Ảnh
  const anhArr = Array.isArray(d.anh) ? d.anh : [];
  const anhHtml = anhArr.length === 0 ? '' : `<div class="bgd-section">
    <div class="bgd-section-l">Ảnh biên bản giấy · ${anhArr.length}</div>
    <div class="bgd-anh-grid">
      ${anhArr.map(url => `<div class="bgd-anh-cell" onclick="bgViewImage('${url}')"><img src="${url}" loading="lazy"></div>`).join('')}
    </div>
  </div>`;

  // Sự vụ
  const sv = Array.isArray(d.su_vu) ? d.su_vu : [];
  const svHtml = sv.length === 0 ? '' : `<div class="bgd-section">
    <div class="bgd-section-l">Sự vụ phát sinh · ${sv.length}</div>
    ${sv.map(s => {
      const accent = s.muc_do==='KHAN_CAP'?'#DC2626':s.muc_do==='QUAN_TRONG'?'#F97316':'#1B4965';
      const mdLbl = { KHAN_CAP:'Khẩn cấp', QUAN_TRONG:'Quan trọng', CAN_THIET:'Cần thiết' }[s.muc_do]||s.muc_do;
      const stLbl = {
        MOI_TAO:'Mới tạo', DA_TIEP_NHAN:'Đã tiếp nhận', DANG_XU_LY:'Đang xử lý',
        DA_PHAN_HOI:'Đã phản hồi', HOAN_TAT:'Hoàn tất', HUY:'Đã hủy'
      }[s.trang_thai]||s.trang_thai;
      let dl = '';
      if (s.deadline_xu_ly) {
        const ddt = new Date(s.deadline_xu_ly);
        const past = ddt < new Date() && !['HOAN_TAT','HUY'].includes(s.trang_thai);
        dl = `<div class="bgql-deadline${past?' past':''}">Deadline: ${pad(ddt.getDate())}/${pad(ddt.getMonth()+1)} ${pad(ddt.getHours())}:${pad(ddt.getMinutes())}${past?' · QUÁ HẠN':''}</div>`;
      }
      return `<div class="bgd-sv" style="border-left:3px solid ${accent}">
        <div class="bgd-sv-h"><b>${escHtml(s.tieu_de||'')}</b>
          <span style="background:${accent}15;color:${accent};font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:99px;margin-left:8px">${mdLbl}</span>
          <span style="color:#64748B;font-size:11px;margin-left:6px">· ${stLbl}</span>
        </div>
        ${s.mo_ta?`<div class="bgd-sv-mt">${escHtml(s.mo_ta)}</div>`:''}
        ${s.phan_hoi_xu_ly?`<div class="bgd-sv-rep"><b style="color:#047857">PHẢN HỒI:</b> ${escHtml(s.phan_hoi_xu_ly)}${dl}</div>`:dl}
      </div>`;
    }).join('')}
  </div>`;

  return `
    <div class="bgd-head">
      <div class="bgd-h-ch">${escHtml(h.ten_ch_snapshot||h.ma_ch||'?')}</div>
      <div class="bgd-h-by">${escHtml(h.nguoi_ban_giao_ten||'?')} · ${escHtml(h.nguoi_ban_giao_chuc_vu||'')}</div>
      <div class="bgd-h-time">${dateStr}</div>
    </div>
    ${tienHtml}
    ${itemsHtml}
    ${hangHtml}
    ${anhHtml}
    ${svHtml}
    ${h.ghi_chu_chung?`<div class="bgd-section"><div class="bgd-section-l">Ghi chú</div><div style="font-size:13px;line-height:1.5;color:#334155">${escHtml(h.ghi_chu_chung)}</div></div>`:''}
  `;
}

function bgFmtDayVN(d){
  if (!d) return '';
  const dt = new Date(d);
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  if (dt.getTime() === today.getTime()) return 'Hôm nay · ' + pad(dt.getDate()) + '/' + pad(dt.getMonth()+1);
  if (dt.getTime() === yesterday.getTime()) return 'Hôm qua · ' + pad(dt.getDate()) + '/' + pad(dt.getMonth()+1);
  return pad(dt.getDate()) + '/' + pad(dt.getMonth()+1) + '/' + dt.getFullYear();
}

// ─── Utility ──────────────────────────────────────────────────────────
// (pad, escHtml, showToast là global từ core/02-system.js)


// ═════════════════════════════════════════════════════════════════════════
//  [v13.35] CONFIRM SCREEN — tổng hợp CÓ/KHÔNG trước khi gửi
// ═════════════════════════════════════════════════════════════════════════
window.bgOpenConfirmSubmit = function(){
  // Tổng hợp items theo trạng thái
  const groupsTS = bgGroups.filter(g => g.type === 'taisan');
  const allItems = [];
  groupsTS.forEach(g => g.items.forEach(it => allItems.push({ g, it })));
  
  const itemsDat = [];     // DAT
  const itemsKhongCo = []; // KHONG_CO
  const itemsVD = [];      // VAN_DE
  const itemsChua = [];    // chưa chọn
  
  allItems.forEach(({g, it}) => {
    const st = bgState[it.id];
    if (!st || !st.status) { itemsChua.push({ g, it }); return; }
    if (st.status === 'D') itemsDat.push({ g, it });
    else if (st.status === 'K' || st.status === 'KC' || st.status === 'KHONG_CO') itemsKhongCo.push({ g, it });
    else if (st.status === 'VD' || st.status === 'KD' || st.status === 'KHONG_DAT') itemsVD.push({ g, it, mota: st.mo_ta });
  });
  
  const groupItems = items => {
    const byKV = {};
    items.forEach(({ g, it, mota }) => {
      const kv = g.khu_vuc || '?';
      if (!byKV[kv]) byKV[kv] = [];
      byKV[kv].push({ ten: it.ten, mota });
    });
    return byKV;
  };
  const datByKV = groupItems(itemsDat);
  const khongByKV = groupItems(itemsKhongCo);
  const vdByKV = groupItems(itemsVD);
  
  const kvLabel = kv => kv === 1 ? 'Khu vực 1 - Mặt tiền' 
    : kv === 2 ? 'Khu vực 2 - Quầy thu ngân' 
    : kv === 4 ? 'Khu vực 4 - Kho/Sinh hoạt' 
    : `Khu vực ${kv}`;
  
  const renderKVList = (byKV, color, showMota) => {
    if (Object.keys(byKV).length === 0) return '<div class="bg-cf-empty">Không có hạng mục nào</div>';
    return Object.keys(byKV).sort().map(kv => `
      <div class="bg-cf-kv">
        <div class="bg-cf-kv-l">${escHtml(kvLabel(parseInt(kv,10)))}</div>
        <div class="bg-cf-items">
          ${byKV[kv].map(it => `<div class="bg-cf-item" style="border-color:${color}">
            <span>${escHtml(it.ten)}</span>
            ${showMota && it.mota?`<small style="color:#991B1B">${escHtml(it.mota)}</small>`:''}
          </div>`).join('')}
        </div>
      </div>`).join('');
  };
  
  // Build modal
  const m = document.createElement('div');
  m.className = 'bgql-modal-bg';
  m.innerHTML = `
    <div class="bgql-modal bg-cf-modal">
      <div class="bgql-modal-head">
        <div class="bgql-modal-ttl">Xác nhận trước khi gửi</div>
        <button class="bgql-modal-x" onclick="this.closest('.bgql-modal-bg').remove()">✕</button>
      </div>
      <div class="bgql-modal-body bg-cf-body">
        <div class="bg-cf-summary">
          <div class="bg-cf-stat dat">
            <div class="bg-cf-stat-v">${itemsDat.length}</div>
            <div class="bg-cf-stat-l">Đạt</div>
          </div>
          <div class="bg-cf-stat khong">
            <div class="bg-cf-stat-v">${itemsKhongCo.length}</div>
            <div class="bg-cf-stat-l">Không có</div>
          </div>
          <div class="bg-cf-stat vd">
            <div class="bg-cf-stat-v">${itemsVD.length}</div>
            <div class="bg-cf-stat-l">Có vấn đề</div>
          </div>
          ${itemsChua.length>0?`<div class="bg-cf-stat chua">
            <div class="bg-cf-stat-v">${itemsChua.length}</div>
            <div class="bg-cf-stat-l">Chưa chọn</div>
          </div>`:''}
        </div>
        
        ${itemsChua.length > 0 ? `<div class="bg-cf-warn">
          ⚠ Còn ${itemsChua.length} hạng mục chưa chọn trạng thái. Vẫn có thể gửi (mặc định "Không có").
        </div>` : ''}
        
        ${itemsVD.length > 0 ? `<div class="bg-cf-sec">
          <div class="bg-cf-sec-l bg-cf-sec-vd">Hạng mục có vấn đề · ${itemsVD.length}</div>
          ${renderKVList(vdByKV, '#DC2626', true)}
        </div>` : ''}
        
        ${itemsKhongCo.length > 0 ? `<div class="bg-cf-sec">
          <div class="bg-cf-sec-l bg-cf-sec-khong">Hạng mục cửa hàng KHÔNG có · ${itemsKhongCo.length}</div>
          ${renderKVList(khongByKV, '#94A3B8', false)}
        </div>` : ''}
        
        ${itemsDat.length > 0 ? `<div class="bg-cf-sec">
          <div class="bg-cf-sec-l bg-cf-sec-dat">Hạng mục đạt · ${itemsDat.length}</div>
          ${renderKVList(datByKV, '#10B981', false)}
        </div>` : ''}
        
        <div class="bg-cf-note">
          Sau khi xác nhận, hệ thống sẽ tạo biên bản + ${itemsVD.length} sự vụ (nếu có) và thông báo cho quản lý.
        </div>
        
        <div class="bgql-modal-act">
          <button class="bgql-act bgql-act-ghost" onclick="this.closest('.bgql-modal-bg').remove()">Xem lại</button>
          <button class="bgql-act bgql-act-primary" onclick="this.closest('.bgql-modal-bg').remove(); bgSubmit()">Đồng ý gửi</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(m);
};
