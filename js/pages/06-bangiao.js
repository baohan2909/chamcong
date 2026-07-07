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

// [B1] Cơ động = NV có phạm vi khu vực (chức danh CDxx) → xem sự vụ cả VÙNG
function _bgLaCoDong(){
  return (typeof SESSION!=='undefined' && SESSION && SESSION.vaiTro==='NV' &&
          window.SESSION_PHAMVI==='khuvuc' && Array.isArray(window.SESSION_KVPT) && window.SESSION_KVPT.length>0)
      || /^CD/.test(window.SESSION_CHUCDANH||'');
}
// Cơ động: ẩn tab "Tạo bàn giao" + "Timeline", chỉ chừa "Sự vụ"
function _bgApDungTabCoDong(){
  const co = _bgLaCoDong();
  const tNew = document.getElementById('bg-subtab-new');
  const tTl  = document.getElementById('bg-subtab-timeline');
  if (tNew) tNew.style.display = co ? 'none' : '';
  if (tTl)  tTl.style.display  = co ? 'none' : '';
  return co;
}

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
    document.getElementById('bg-ch-sub').textContent = 'Chấm công vào ca để lập biên bản. Sự vụ được giao cho bạn xem ở tab Sự vụ.';
    document.getElementById('bg-groups').innerHTML = '<div class="ns-empty">Cần chấm công vào ca tại cửa hàng để bàn giao.<br>Sự vụ được giao cho bạn vẫn xem được ở tab <b>Sự vụ</b> bên trên.</div>';
    // [v15.8] Cơ động không có cửa hàng cố định → vẫn cho xem sự vụ được giao xử lý cho mình
    try { _bgApDungTabCoDong(); bgSwitchSub('suvu'); bgRenderSuVu(); } catch(e){}
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
  if (_bgApDungTabCoDong()) { bgSwitchSub('suvu'); } else { bgSwitchSub('new'); }
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
    key:'tien', ten:'Tiền mặt', type:'tien',
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
    const stat = g.items.length>0 ? (g.type==='anh' ? _bgAnhStatusText() : g.items.length+' mục') : '';
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
          if (bgState[id].anh_urls.length >= 20) { showToast('Tối đa 20 ảnh / mục', 'warn'); return; }
          bgState[id].anh_urls.push({ blob, dataUrl: e.target.result });
          const g = bgGroups.find(g=>g.items.some(x=>x.id===id));
          const it = g.items.find(x=>x.id===id);
          bgWarnAnhLe(bgState[id].anh_urls.length, 'Ảnh mục "' + it.ten + '"');
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
    bgWarnAnhLe(bgState[id].anh_urls.length, 'Ảnh mục "' + it.ten + '"');
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
  bgState[id].so_luong = isNaN(v) ? null : Math.max(0, v);   // không cho số lượng âm
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

// [chan-le] Số ảnh biên bản phải CHẴN (2,4,6...) để in 2 mặt đúng. Helper cảnh báo dùng chung.
function bgWarnAnhLe(count, label){
  if (count > 0 && count % 2 !== 0){
    showToast(label + ': đang ' + count + ' ảnh (số lẻ) — thêm/bớt 1 ảnh để in 2 mặt đúng.', 'warn');
  }
}
// [chan-le] Text hiển thị số ảnh biên bản kèm indicator chẵn/lẻ
function _bgAnhStatusText(){
  if (!bgPhotos.length) return '0 ảnh';
  return bgPhotos.length + ' ảnh' + (bgPhotos.length % 2 !== 0 ? ' · lẻ' : '');
}

window.bgAddBienBanPhoto = function(input){
  const f = input.files && input.files[0];
  if (!f) return;
  if (bgPhotos.length >= 50) { showToast('Tối đa 50 ảnh biên bản', 'warn'); input.value=''; return; }
  if (typeof csOpenFromFile !== 'function') { showToast('Module xử lý ảnh chưa tải xong', 'warn'); return; }
  csOpenFromFile(f, {
    onComplete: blob => {
      const r = new FileReader();
      r.onload = e => {
        bgPhotos.push({ blob, dataUrl: e.target.result });
        document.getElementById('bg-g-anh').querySelector('.chk-group-body').innerHTML = bgRenderGroupAnh({type:'anh',items:[]});
        document.getElementById('bg-gstatus-anh').textContent = _bgAnhStatusText();
        bgUpdateProgress();
        bgWarnAnhLe(bgPhotos.length, 'Ảnh biên bản');
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
  document.getElementById('bg-gstatus-anh').textContent = _bgAnhStatusText();
  bgUpdateProgress();
  bgWarnAnhLe(bgPhotos.length, 'Ảnh biên bản');
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

  // [v16.3] Biên bản giấy phải up SỐ CHẴN (2,4,6...) — mỗi tờ gồm 2 mặt
  if (bgPhotos.length === 0 || bgPhotos.length % 2 !== 0){
    showToast('Số ảnh biên bản phải chẵn (2, 4, 6...). Hiện có ' + bgPhotos.length + ' ảnh — vui lòng up đủ cả 2 mặt mỗi tờ.', 'warn');
    return;
  }
  // [chan-le] Mỗi mục "Có vấn đề" nếu có ảnh thì SỐ ẢNH cũng phải chẵn (in 2 mặt hàng loạt)
  const itemsAnhLe = [];
  bgGroups.filter(g=>g.type==='taisan').forEach(g => {
    g.items.forEach(it => {
      const st = bgState[it.id];
      if (st && st.status === 'VD' && st.anh_urls && st.anh_urls.length > 0 && st.anh_urls.length % 2 !== 0){
        itemsAnhLe.push({ ten: it.ten, n: st.anh_urls.length });
      }
    });
  });
  if (itemsAnhLe.length > 0){
    const first = itemsAnhLe[0];
    const them = itemsAnhLe.length > 1 ? ' (và ' + (itemsAnhLe.length - 1) + ' mục khác)' : '';
    showToast('Ảnh mục "' + first.ten + '" đang ' + first.n + ' (lẻ)' + them + '. Cần chẵn để in 2 mặt.', 'warn');
    return;
  }

  if (window._bgSubmitting) return;   // chống gửi biên bản đúp (double-submit)
  window._bgSubmitting = true;
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
    let svTrung = 0;
    let svFail = 0;
    const _demSv = (r)=>{ if (!r || r.error || !r.data) { svFail++; return; } if (r.data.trung) svTrung++; else svCount++; };
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
          }).then(_demSv);
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
        }).then(_demSv);
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
          }).then(_demSv);
        }
      }
    }

    let _svMsg = '✓ Đã gửi biên bản';
    if (svCount) _svMsg += ' · ' + svCount + ' sự vụ mới';
    if (svTrung) _svMsg += ' · ' + svTrung + ' cập nhật vào sự vụ đang mở';
    if (svFail)  _svMsg += ' · ⚠ ' + svFail + ' sự vụ TẠO LỖI';
    showToast(_svMsg, svFail ? 'warn' : 'ok');
    // Reset
    bgState = {}; bgPhotos = [];
    document.getElementById('bg-ghichu').value = '';
    bgRenderForm();
    bgSwitchSub('timeline');
    window._bgSubmitting = false;
  } catch(e){
    console.error(e);
    window._bgSubmitting = false;
    showToast('⚠ ' + (e.message||'Lỗi gửi'), 'warn');
    btn.disabled = false; btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Hoàn tất & gửi';
  }
}
window.bgSubmit = bgSubmit;

// ═════════════════════════════════════════════════════════════════════════
//  TAB 2: SỰ VỤ — danh sách sự vụ phát sinh từ biên bản bàn giao
// ═════════════════════════════════════════════════════════════════════════
// [v16.4] Chế độ xem: 'dang' = đang xử lý | 'lichsu' = đã hoàn tất/hủy (kiểm soát tập trung)
let _bgSuVuViewMode = 'dang';
window.bgSuVuSetView = function(mode){
  _bgSuVuViewMode = mode;
  if (window._bgSuVuCache) bgSuVuRenderFromCache(); else bgRenderSuVu();
};
async function bgRenderSuVu(){
  const list = document.getElementById('bg-suvu-list');
  list.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
  const ma = (typeof SESSION!=='undefined' && SESSION) ? SESSION.ma : '';
  try {
    // [Lớp 1] Đội cơ động cùng nhóm (nạp 1 lần) — để hiện tên ở stepper + lộ trình
    if (_bgLaCoDong() && !window._bgCoDongNhom){
      try { const _r = await supa.rpc('fn_co_dong_cung_nhom', { p_ma_nv: ma }); window._bgCoDongNhom = (Array.isArray(_r.data)?_r.data:[]).map(x=>x.ho_ten).filter(Boolean); }
      catch(_e){ window._bgCoDongNhom = []; }
    }
    // [B1] Cơ động: lấy CẢ KHU VỰC (mọi sự vụ đang mở) — ai trong vùng cũng xử lý được
    let reqs;
    if (_bgLaCoDong()){
      reqs = [ supa.rpc('fn_su_vu_co_dong_all', { p_ma_nv: ma }) ];
    } else {
      // Nguồn 1: sự vụ ĐƯỢC GIAO XỬ LÝ cho mình (mọi cửa hàng)
      reqs = [ supa.rpc('fn_su_vu_list', { p_nguoi_xu_ly: ma, p_limit: 1000000, p_offset: 0 }) ];
      // Nguồn 2: sự vụ của CỬA HÀNG mình (nếu có cửa hàng)
      if (bgCurrentCH && bgCurrentCH.ma) {
        reqs.push(supa.rpc('fn_su_vu_list', { p_ma_ch: bgCurrentCH.ma, p_limit: 1000000, p_offset: 0 }));
      }
    }
    const results = await Promise.all(reqs);
    let merged = [];
    results.forEach(r => { if (!r.error && Array.isArray(r.data)) merged = merged.concat(r.data); });
    // Gộp trùng theo id
    const seen = new Set(); const data = [];
    merged.forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); data.push(s); } });
    // Sắp xếp: đang mở trước, rồi mới nhất trước
    data.sort((a,b)=>{
      const oa = ['HOAN_TAT','HUY'].includes(a.trang_thai)?1:0;
      const ob = ['HOAN_TAT','HUY'].includes(b.trang_thai)?1:0;
      if (oa!==ob) return oa-ob;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    window._bgSuVuCache = data;   // [Lớp 1] để popup chi tiết tra theo id
    bgSuVuRenderFromCache();
  } catch(e){ list.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+e.message+'</div>'; }
}

// [v17.21] Render danh sách + áp bộ lọc. ẨN sự vụ ĐÃ HỦY ở mọi tài khoản.
// Cơ động: dùng bộ lọc đầy đủ (giống admin), bỏ tab đang/lịch sử. NV thường: giữ tab.
function bgSuVuRenderFromCache(){
  const list = document.getElementById('bg-suvu-list');
  if (!list) return;
  const all = (window._bgSuVuCache || []).filter(s => s.trang_thai !== 'HUY');  // ẩn hủy
  const laCD = _bgLaCoDong();
  const cnt = document.getElementById('bg-suvu-count');
  const openCnt = all.filter(s => s.trang_thai !== 'HOAN_TAT').length;
  if (cnt){ if (openCnt>0){ cnt.style.display=''; cnt.textContent = openCnt; } else cnt.style.display='none'; }

  if (all.length === 0){
    list.innerHTML = '<div class="ns-empty">Chưa có sự vụ nào.</div>';
    bgSuVuStopTimer();
    return;
  }

  if (laCD){
    const filterBar = bgSvFilterBarHtml();
    let data = bgSvSortData(bgSvApplyFilter(all));
    if (data.length === 0){
      list.innerHTML = filterBar + '<div class="ns-empty">Không có sự vụ phù hợp bộ lọc.</div>';
      bgSuVuStopTimer();
      return;
    }
    list.innerHTML = filterBar + data.map(bgSuVuCardHtml).join('');
    bgSuVuStartTimer();
    return;
  }

  // NV thường: giữ tab Đang xử lý / Lịch sử
  const opened = all.filter(s => s.trang_thai !== 'HOAN_TAT');
  const closed = all.filter(s => s.trang_thai === 'HOAN_TAT');
  const viewData = (_bgSuVuViewMode==='lichsu') ? closed : opened;
  const toggleHtml = `<div class="bg-sv-viewtabs">
      <button class="bg-sv-vtab${_bgSuVuViewMode!=='lichsu'?' active':''}" onclick="bgSuVuSetView('dang')">Đang xử lý${opened.length?' ('+opened.length+')':''}</button>
      <button class="bg-sv-vtab${_bgSuVuViewMode==='lichsu'?' active':''}" onclick="bgSuVuSetView('lichsu')">Lịch sử${closed.length?' ('+closed.length+')':''}</button>
    </div>`;
  if (viewData.length === 0){
    list.innerHTML = toggleHtml + '<div class="ns-empty">'+(_bgSuVuViewMode==='lichsu'?'Chưa có sự vụ đã hoàn tất.':'Chưa có sự vụ đang xử lý.')+'</div>';
    bgSuVuStopTimer();
    return;
  }
  list.innerHTML = toggleHtml + viewData.map(bgSuVuCardHtml).join('');
  bgSuVuStartTimer();
}

// ── Helper "trễ" / "sắp hết hạn" (port từ bộ lọc admin) ──
function bgLaTre(s){
  if (!s || ['DA_XU_LY_XONG','HOAN_TAT','HUY'].includes(s.trang_thai)) return false;
  if (!s.deadline_xu_ly) return false;
  return new Date(s.deadline_xu_ly).getTime() < Date.now();
}
function bgSapHetHan(s){
  if (!s || ['DA_XU_LY_XONG','HOAN_TAT','HUY'].includes(s.trang_thai)) return false;
  if (!s.deadline_xu_ly) return false;
  const now = Date.now();
  const dl = new Date(s.deadline_xu_ly).getTime();
  if (dl <= now) return false;
  const conGio = (dl - now)/3600000;
  const nguong = s.muc_do==='KHAN_CAP' ? 6 : s.muc_do==='QUAN_TRONG' ? 12 : 24;
  return conGio <= nguong;
}

// [v17.21] Bộ lọc đầy đủ giống admin: mức độ · trạng thái · thời gian · cửa hàng/khu vực
function bgSvApplyFilter(data, opts){
  const f = window._bgSvFilter || {};
  let out = data;
  const ma = (typeof SESSION!=='undefined' && SESSION) ? SESSION.ma : '';
  if (f.scope === 'mine') out = out.filter(s => (s.nguoi_xu_ly_ma||'') === ma);
  else if (f.scope === 'done') out = out.filter(s => s.trang_thai === 'HOAN_TAT');
  if (f.muc_do && f.muc_do !== 'all') out = out.filter(s => s.muc_do === f.muc_do);
  if (!(opts && opts.skipStatus)){
    const tt = Array.isArray(f.trang_thai) ? f.trang_thai : [];
    if (tt.length) out = out.filter(s => tt.some(o => bgSvMatchStatusOpt(s, o)));
  }
  if (f.time && f.time !== 'all'){
    const now = new Date();
    let from=null, to=null;
    if (f.time==='today') from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (f.time==='7d') from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    else if (f.time==='30d') from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    else if (f.time==='custom'){ if (f.from) from = new Date(f.from+'T00:00:00'); if (f.to) to = new Date(f.to+'T23:59:59'); if (from && to && from > to){ const _t=from; from=to; to=_t; } }
    if (from) out = out.filter(s => new Date(s.created_at) >= from);
    if (to) out = out.filter(s => new Date(s.created_at) <= to);
  }
  if (f.store && f.store.trim()){
    const q = f.store.trim().toLowerCase();
    out = out.filter(s => ((s.ten_ch_snapshot||'')+' '+(s.ma_ch||'')+' '+(s.khu_vuc||'')).toLowerCase().includes(q));
  }
  return out;
}

function bgSvSortData(data){
  const sort = (window._bgSvFilter||{}).sort || 'muc_do';
  const arr = data.slice();
  if (sort === 'cua_hang'){
    arr.sort((a,b)=>{ const c=(a.ten_ch_snapshot||a.ma_ch||'').localeCompare(b.ten_ch_snapshot||b.ma_ch||'','vi'); return c!==0?c:(new Date(b.created_at)-new Date(a.created_at)); });
  } else if (sort === 'thoi_gian'){
    arr.sort((a,b)=> new Date(b.created_at)-new Date(a.created_at));
  } else if (sort === 'thoi_han'){
    arr.sort((a,b)=>{ const da=a.deadline_xu_ly?new Date(a.deadline_xu_ly).getTime():Infinity, db=b.deadline_xu_ly?new Date(b.deadline_xu_ly).getTime():Infinity; return da!==db?da-db:(new Date(b.created_at)-new Date(a.created_at)); });
  } else {
    // [v17.47] "Mức độ" = ưu tiên theo hạn: việc CÒN HẠN lên đầu; ĐÃ XONG / Chờ CH xuống cuối
    const now = Date.now();
    const md = { KHAN_CAP:0, QUAN_TRONG:1, CAN_THIET:2 };
    const done = s => ['DA_XU_LY_XONG','HOAN_TAT'].includes(s.trang_thai);
    arr.sort((a,b)=>{ const ad=done(a), bd=done(b); if(ad!==bd) return ad?1:-1; if(!ad){ const ra=a.deadline_xu_ly?(new Date(a.deadline_xu_ly).getTime()-now):Infinity, rb=b.deadline_xu_ly?(new Date(b.deadline_xu_ly).getTime()-now):Infinity; if(ra!==rb) return ra-rb; } const da=(md[a.muc_do]??9), db=(md[b.muc_do]??9); return da!==db?da-db:(new Date(b.created_at)-new Date(a.created_at)); });
  }
  return arr;
}

function bgSvFilterBarHtml(){
  const f = window._bgSvFilter = window._bgSvFilter || { scope:'all', muc_do:'all', trang_thai:[], time:'all', from:'', to:'', store:'', sort:'muc_do' };
  const all = (window._bgSuVuCache || []).filter(s => s.trang_thai !== 'HUY');
  const _c = fn => all.filter(fn).length;
  const cMoi=_c(s=>s.trang_thai==='MOI_TAO'), cXuLy=_c(s=>['DA_TIEP_NHAN','DANG_XU_LY','DA_PHAN_HOI'].includes(s.trang_thai)), cChoXN=_c(s=>s.trang_thai==='DA_XU_LY_XONG'), cXong=_c(s=>s.trang_thai==='HOAN_TAT'), cTre=_c(bgLaTre), cSap=_c(bgSapHetHan);
  const sel = 'flex:1;min-width:0;border:1px solid #D1D5DB;border-radius:9px;padding:8px 10px;font-size:12.5px;background:#fff;color:#334155;cursor:pointer';
  const o = (v,cur,lbl)=>`<option value="${v}"${cur===v?' selected':''}>${lbl}</option>`;
  const _stMap = {tre:'Quá hạn',dang_xu_ly:'Đang xử lý',cho_ch_xac_nhan:'Chờ CH xác nhận',hoan_tat:'Hoàn tất',huy:'Đã hủy'};
  const _stSel = Array.isArray(f.trang_thai) ? f.trang_thai : [];
  const _stLbl = !_stSel.length ? ('Tất cả ('+all.length+')') : (_stSel.length===1 ? (_stMap[_stSel[0]]||_stSel[0]) : (_stSel.length+' trạng thái'));
  const rangeRow = f.time==='custom' ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input type="date" value="${escHtml(f.from||'')}" onchange="bgSvSetField('from',this.value)" style="border:1px solid #D1D5DB;border-radius:8px;padding:6px 9px;font-size:12.5px">
      <span style="color:#94A3B8;font-size:12px">đến</span>
      <input type="date" value="${escHtml(f.to||'')}" onchange="bgSvSetField('to',this.value)" style="border:1px solid #D1D5DB;border-radius:8px;padding:6px 9px;font-size:12.5px">
    </div>` : '';
  return `<div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;gap:8px">
      <select onchange="bgSvSetField('scope',this.value)" style="${sel}">${o('all',f.scope,'Tất cả sự vụ')}${o('mine',f.scope,'Sự vụ của tôi')}${o('done',f.scope,'Sự vụ hoàn tất')}</select>
    </div>
    <div style="display:flex;gap:8px">
      <select onchange="bgSvSetField('muc_do',this.value)" style="${sel}">${o('all',f.muc_do,'Mức độ: Tất cả')}${o('KHAN_CAP',f.muc_do,'Khẩn cấp')}${o('QUAN_TRONG',f.muc_do,'Quan trọng')}${o('CAN_THIET',f.muc_do,'Cần thiết')}</select>
      <button class="bgql-nhom-toggle${window._bgSvStPanelOpen?' open':''}" id="bg-sv-st-toggle" onclick="bgSvToggleStatusPanel()" style="flex:1;min-width:0;justify-content:center">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        <span>${_stLbl}</span>
        <span class="bgql-nhom-badge" id="bg-sv-st-badge"${_stSel.length?'':' style="display:none"'}>${_stSel.length?bgSvApplyFilter(all).length:''}</span>
        <svg class="bgql-nhom-caret" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>
    <div class="bgql-nhom-panel" id="bg-sv-st-panel" style="display:${window._bgSvStPanelOpen?'flex':'none'}">
      ${bgSvRenderStatusPanel()}
      <button class="bgql-nhom-done" onclick="bgSvToggleStatusPanel()">Xong</button>
    </div>
    <div style="display:flex;gap:8px">
      <select onchange="bgSvSetField('time',this.value)" style="${sel}">${o('all',f.time,'Mọi lúc')}${o('today',f.time,'Hôm nay')}${o('7d',f.time,'7 ngày qua')}${o('30d',f.time,'30 ngày qua')}${o('custom',f.time,'Khoảng ngày')}</select>
      <select onchange="bgSvSetField('sort',this.value)" style="${sel}">${o('muc_do',f.sort,'Sắp: Mức độ')}${o('cua_hang',f.sort,'Sắp: Cửa hàng')}${o('thoi_gian',f.sort,'Sắp: Ngày gửi')}${o('thoi_han',f.sort,'Sắp: Thời hạn')}</select>
    </div>
    ${rangeRow}
    <div style="display:flex;gap:6px;align-items:center">
      <div style="flex:1;position:relative">
        <input id="bg-sv-store-inp" value="${escHtml(f.store||'')}" oninput="bgSvSearchInput(this.value)" onchange="bgSvSetField('store',this.value)" onfocus="bgSvSearchInput(this.value)" placeholder="Cửa hàng / khu vực (gõ để gợi ý)…" autocomplete="off" style="width:100%;box-sizing:border-box;border:1px solid #D1D5DB;border-radius:9px;padding:8px 11px;font-size:13px">
        <div id="bg-sv-search-dd" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #E2E8F0;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.18);max-height:240px;overflow-y:auto;z-index:30;padding:4px"></div>
      </div>
      ${f.store?`<button onclick="bgSvSetField('store','')" style="border:1px solid #D1D5DB;background:#fff;color:#64748B;padding:8px 12px;border-radius:9px;font-size:12.5px;cursor:pointer">Xóa</button>`:''}
    </div>
  </div>`;
}

window.bgSvSetField = function(k,v){ (window._bgSvFilter=window._bgSvFilter||{})[k]=v; bgSuVuRenderFromCache(); };
// [nhóm C] Typeahead cửa hàng/khu vực cho Sự vụ (thay datalist native — đồng bộ kiểu Chấm công)
let _bgSvSearchTimer = null;
window.bgSvSearchInput = function(kw){
  clearTimeout(_bgSvSearchTimer);
  const dd = document.getElementById('bg-sv-search-dd'); if(!dd) return;
  if(!kw || !kw.trim()){ dd.style.display='none'; return; }
  _bgSvSearchTimer = setTimeout(()=>{
    const all = (window._bgSuVuCache||[]).filter(s=>s.trang_thai!=='HUY');
    const low = kw.toLowerCase();
    const kvs = [...new Set(all.map(s=>s.khu_vuc).filter(k=>k && k.toLowerCase().includes(low)))].slice(0,3);
    const chMap = new Map();
    all.forEach(s=>{ if(s.ma_ch && !chMap.has(s.ma_ch)){ const t=s.ten_ch_snapshot||s.ma_ch; if(t.toLowerCase().includes(low)||String(s.ma_ch).toLowerCase().includes(low)) chMap.set(s.ma_ch,t); }});
    const chs = [...chMap.entries()].slice(0,6);
    const lbl = t=>`<div style="font-size:10.5px;font-weight:700;color:#94A3B8;padding:6px 8px 3px">${t}</div>`;
    const it = (val,main,sub)=>`<div onmousedown="event.preventDefault(); bgSvPickStore('${escHtml(val)}')" style="padding:8px 9px;border-radius:8px;cursor:pointer;font-size:13px;color:#0F6E56" onmouseover="this.style.background='#E1F5EE'" onmouseout="this.style.background='transparent'"><b>${escHtml(main)}</b>${sub?` <small style="color:#94A3B8">${escHtml(sub)}</small>`:''}</div>`;
    let html='';
    if(kvs.length) html += lbl('Khu vực') + kvs.map(k=>it(k,k,'')).join('');
    if(chs.length) html += lbl('Cửa hàng') + chs.map(([m,t])=>it(t,t,m)).join('');
    if(!html) html = '<div style="padding:10px;color:#94A3B8;font-size:12.5px">Không tìm thấy</div>';
    dd.innerHTML=html; dd.style.display='';
  }, 180);
};
window.bgSvPickStore = function(val){
  const dd = document.getElementById('bg-sv-search-dd'); if(dd) dd.style.display='none';
  bgSvSetField('store', val);
};
// [v17.50] Bộ lọc trạng thái chọn nhiều cho cơ động — giống QL bàn giao
function bgSvMatchStatusOpt(s, opt){
  switch(opt){
    case 'tre': return bgLaTre(s);
    case 'dang_xu_ly': return ['MOI_TAO','DA_TIEP_NHAN','DANG_XU_LY','DA_PHAN_HOI'].includes(s.trang_thai);
    case 'cho_ch_xac_nhan': return s.trang_thai === 'DA_XU_LY_XONG';
    case 'hoan_tat': return s.trang_thai === 'HOAN_TAT';
    case 'huy': return s.trang_thai === 'HUY';
    default: return true;
  }
}
function bgSvRenderStatusPanel(){
  const cache = window._bgSuVuCache || [];
  const base = bgSvApplyFilter(cache.filter(s=>s.trang_thai!=='HUY'), { skipStatus:true });
  const sel = Array.isArray((window._bgSvFilter||{}).trang_thai) ? window._bgSvFilter.trang_thai : [];
  const opts = [
    ['dang_xu_ly','Đang xử lý', base.filter(s=>['MOI_TAO','DA_TIEP_NHAN','DANG_XU_LY','DA_PHAN_HOI'].includes(s.trang_thai)).length],
    ['cho_ch_xac_nhan','Chờ CH xác nhận', base.filter(s=>s.trang_thai==='DA_XU_LY_XONG').length],
    ['tre','Quá hạn', base.filter(bgLaTre).length],
    ['hoan_tat','Hoàn tất', base.filter(s=>s.trang_thai==='HOAN_TAT').length],
    ['huy','Đã hủy', cache.filter(s=>s.trang_thai==='HUY').length],
  ];
  return opts.map(([v,lbl,cnt]) =>
    `<label class="bgql-hm-con"><input type="checkbox" ${sel.includes(v)?'checked':''} onchange="bgSvToggleStatusOpt('${v}')"><span>${lbl} (${cnt})</span></label>`
  ).join('');
}
window.bgSvToggleStatusPanel = function(){
  window._bgSvStPanelOpen = !window._bgSvStPanelOpen;
  const p = document.getElementById('bg-sv-st-panel');
  const t = document.getElementById('bg-sv-st-toggle');
  if (p) p.style.display = window._bgSvStPanelOpen ? 'flex' : 'none';
  if (t) t.classList.toggle('open', window._bgSvStPanelOpen);
};
window.bgSvToggleStatusOpt = function(v){
  const f = window._bgSvFilter = window._bgSvFilter || {};
  if (!Array.isArray(f.trang_thai)) f.trang_thai = [];
  const i = f.trang_thai.indexOf(v);
  if (i >= 0) f.trang_thai.splice(i,1); else f.trang_thai.push(v);
  bgSuVuRenderFromCache();
};
// Tương thích lời gọi cũ (nếu còn nơi khác gọi)
window.bgSvSetDate  = function(d){ bgSvSetField('time', d); };
window.bgSvSetRange = function(k,v){ bgSvSetField(k, v); };
window.bgSvSetStore = function(v){ bgSvSetField('store', v); };

// [Điểm 2] Thẻ cơ động dạng STEPPER ngang — tên đội ở bước Xử lý
function bgSuVuCardCoDong(s){
  const mdLbl = { KHAN_CAP:'Khẩn cấp', QUAN_TRONG:'Quan trọng', CAN_THIET:'Cần thiết' }[s.muc_do]||s.muc_do;
  const mdCls = s.muc_do==='KHAN_CAP'?'khan':s.muc_do==='QUAN_TRONG'?'vua':'nhe';
  const accent = s.muc_do==='KHAN_CAP'?'#DC2626':s.muc_do==='QUAN_TRONG'?'#D97706':'#1B4965';
  const stLbl = { MOI_TAO:'Mới tạo', DA_TIEP_NHAN:'Đã tiếp nhận', DANG_XU_LY:'Đang xử lý', DA_PHAN_HOI:'Đã phản hồi', DA_XU_LY_XONG:'Chờ cửa hàng xác nhận', HOAN_TAT:'Hoàn tất', HUY:'Hủy' }[s.trang_thai]||s.trang_thai;
  const isOpen = !['HOAN_TAT','HUY'].includes(s.trang_thai);
  const tenCH = escHtml(s.ten_ch_snapshot||s.ma_ch||'');
  const desc = (s.mo_ta||'').replace(/\s+/g,' ').trim();
  const descShort = desc.length>72 ? desc.slice(0,72)+'…' : desc;
  const baoLai = (s.so_lan_bao_lai>1) ? `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:#DC2626;font-size:11px;font-weight:600;white-space:nowrap">Đã gửi ${s.so_lan_bao_lai} lần</span>` : '';
  return `<div class="chk-rec ${isOpen?'has-issue':''}" style="border-left:3px solid ${accent};cursor:pointer" onclick="bgSuVuOpenDetail('${s.id}')">
    <div class="chk-rec-head">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">
        <span class="chk-mucdo-tag ${mdCls}">${mdLbl}</span>
        ${bgSuVuCountChip(s)}
        <span class="chk-rec-badge ${isOpen?'issue':'ok'}" style="margin-left:auto">${stLbl}</span>
      </div>
      <div style="font-weight:600;font-size:15.5px;line-height:1.25;margin-bottom:2px;background:linear-gradient(135deg,#1D9E75,#0F6E56);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#0F6E56">${tenCH}</div>
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:6px">
        <span style="color:#0F6E56;font-weight:600;font-size:12.5px">${bgFmtDateTimeShort(s.created_at)}</span>
        <span style="color:#CBD5E1">·</span>
        <span style="color:#334155;font-weight:600;font-size:13px">${escHtml(s.tieu_de||'')}</span>
        ${s.ma_sv?`<span style="color:#94A3B8;font-size:11px">#${escHtml(s.ma_sv)}</span>`:''}
      </div>
      ${descShort?`<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:9px">
        <div style="flex:1;min-width:0;font-size:12.5px;color:#475569;line-height:1.45"><span style="color:#94A3B8">Chi tiết:</span> ${escHtml(descShort)}</div>
        ${baoLai}
      </div>`:(baoLai?`<div style="margin-bottom:9px">${baoLai}</div>`:'')}
      ${bgSuVuStepperHtml(s)}
      ${isOpen?`<button onclick="event.stopPropagation();bgSuVuOpenDetail('${s.id}')" style="width:100%;margin-top:11px;background:linear-gradient(135deg,#1D9E75,#0F6E56);color:#fff;border:none;padding:11px;border-radius:10px;font-weight:600;font-size:14.5px;cursor:pointer">Phản hồi / Đã xử lý</button>`:''}
    </div>
  </div>`;
}

function bgSuVuStepperHtml(s){
  const team = window._bgCoDongNhom || [];
  const tt = s.trang_thai;
  const hoanTat = tt==='HOAN_TAT';
  const xuLyXong = tt==='DA_XU_LY_XONG' || hoanTat;
  const xlNames = s.nguoi_xu_ly_ten ? [s.nguoi_xu_ly_ten] : (team.length ? team : ['Cơ động khu vực']);
  const htName = hoanTat ? (s.nguoi_dong_ten || s.nguoi_xu_ly_ten || '') : '';
  const steps = [
    { lbl:'Người tạo', names:[s.nguoi_tao_ten||'—'], reached:true },
    { lbl:'Giao việc', names:['Ban quản lý'],        reached:true },
    { lbl:'Xử lý',     names:xlNames,                reached:true, active:!xuLyXong },
    { lbl:'Hoàn tất',  names:htName?[htName]:['—'],  reached:hoanTat }
  ];
  return `<div style="display:flex;margin-top:12px;border-top:1px solid #EEF2F6;padding-top:12px">
    ${steps.map((st,i)=>{
      const last = i===steps.length-1;
      const dotColor = st.reached ? (st.active ? '#D97706' : '#1D9E75') : '#CBD5E1';
      const leftLine = i===0 ? 'transparent' : (steps[i].reached ? '#1D9E75' : '#E2E8F0');
      const rightLine = last ? 'transparent' : (steps[i+1].reached ? '#1D9E75' : '#E2E8F0');
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0">
        <div style="display:flex;align-items:center;width:100%">
          <div style="flex:1;height:2px;background:${leftLine}"></div>
          <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};flex:none"></div>
          <div style="flex:1;height:2px;background:${rightLine}"></div>
        </div>
        <div style="font-size:11px;font-weight:600;color:${st.reached?'#0F2E45':'#94A3B8'};margin-top:5px">${st.lbl}</div>
        <div style="margin-top:3px;display:flex;flex-direction:column;gap:1px">${st.names.map(n=>`<span style="font-size:10.5px;color:#475569;line-height:1.3;word-break:break-word">${escHtml(n)}</span>`).join('')}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function bgSuVuCardHtml(s){
  if (_bgLaCoDong()) return bgSuVuCardCoDong(s);
  const mdLbl = { KHAN_CAP:'Khẩn cấp', QUAN_TRONG:'Quan trọng', CAN_THIET:'Cần thiết' }[s.muc_do]||s.muc_do;
  const mdCls = s.muc_do==='KHAN_CAP'?'khan':s.muc_do==='QUAN_TRONG'?'vua':'nhe';
  const stLbl = { MOI_TAO:'Mới tạo', DA_TIEP_NHAN:'Đã tiếp nhận', DANG_XU_LY:'Đang xử lý', DA_PHAN_HOI:'Đã phản hồi', DA_XU_LY_XONG:'Chờ cửa hàng xác nhận', HOAN_TAT:'Hoàn tất', HUY:'Hủy' }[s.trang_thai]||s.trang_thai;
  const isOpen = !['HOAN_TAT','HUY'].includes(s.trang_thai);
  const borderColor = s.muc_do==='KHAN_CAP'?'#DC2626':s.muc_do==='QUAN_TRONG'?'#F97316':'#1B4965';
  const ma = (typeof SESSION!=='undefined' && SESSION) ? SESSION.ma : '';
  const laNguoiXuLy = s.nguoi_xu_ly_ma && s.nguoi_xu_ly_ma === ma;
  // [v16.74] Quyền đóng: chỉ Ban Quản lý (ADMIN/QLNS/QLBH...) hoặc tài khoản cửa hàng
  const _V = (typeof SESSION!=='undefined' && SESSION) ? (SESSION.vaiTro||'') : '';
  const laBanQuanLy = _V==='ADMIN' || _V==='ADMINBH' || _V==='QLNS' || /^QLBH/.test(_V);
  const laCuaHang = _V==='CUA_HANG';

  // Nút hành động theo vai trò trong luồng
  let actBtns = '';
  const laCD = _bgLaCoDong();
  if (isOpen && laCD){
    // Cơ động: mở popup chi tiết để phản hồi / gia hạn / hoàn tất
    actBtns += `<button class="bg-sv-btn bg-sv-btn-done" onclick="event.stopPropagation();bgSuVuOpenDetail('${s.id}')">Phản hồi / Hoàn tất</button>`;
  } else if (isOpen && laNguoiXuLy && s.trang_thai !== 'DA_XU_LY_XONG'){
    actBtns += `<button class="bg-sv-btn bg-sv-btn-done" onclick="bgSuVuXacNhanXong('${s.id}')">✓ Đã xử lý xong</button>`;
  }
  // [v16.89] Nhân sự đang trực đúng cửa hàng của sự vụ cũng được đóng
  const laNhanSuCHNay = !!(bgCurrentCH && bgCurrentCH.ma && s.ma_ch && s.ma_ch === bgCurrentCH.ma);
  if (isOpen && (laBanQuanLy || laCuaHang || laNhanSuCHNay)){
    actBtns += `<button class="bg-sv-btn bg-sv-btn-close" onclick="bgSuVuDong('${s.id}')">Hoàn tất - Đóng sự vụ</button>`;
  }
  const xlChip = s.nguoi_xu_ly_ten
    ? `<span class="bg-sv-xl-chip">Người xử lý: ${escHtml(s.nguoi_xu_ly_ten)}${laNguoiXuLy?' (bạn)':''}</span>`
    : (laCD ? `<span class="bg-sv-xl-chip">Điều phối: Ban quản lý</span>` : '');

  return `<div class="chk-rec ${isOpen?'has-issue':''}"${laCD?` style="border-left:3px solid ${borderColor};cursor:pointer" onclick="bgSuVuOpenDetail('${s.id}')"`:` style="border-left:3px solid ${borderColor}"`}>
    <div class="chk-rec-head">
      <div class="chk-rec-top">
        <span class="chk-rec-time">${bgFmtDateTimeShort(s.created_at)}</span>
        <span class="chk-mucdo-tag ${mdCls}">${mdLbl}</span>
        <span class="chk-rec-badge ${isOpen?'issue':'ok'}" style="margin-left:auto">${stLbl}</span>
      </div>
      <div style="font-weight:600;font-size:15px;color:#0F172A;margin-top:5px">${escHtml(s.ten_ch_snapshot||s.ma_ch||'')}</div>
      <div style="font-weight:600;font-size:13.5px;color:#334155;margin-top:1px">${escHtml(s.tieu_de)}${s.ma_sv?` <span style="font-weight:500;color:#94A3B8;font-size:11px">#${escHtml(s.ma_sv)}</span>`:''}</div>
      <div class="chk-rec-by">Tạo: ${escHtml(s.nguoi_tao_ten||'?')}</div>
      ${xlChip}
      ${s.so_lan_bao_lai > 1 ? `<div class="bg-sv-baolai">🔁 Cửa hàng đã báo lại <b>${s.so_lan_bao_lai} lần</b> · đây là cùng một sự vụ đang xử lý, không tạo mới</div>` : ''}
      ${bgSuVuDeadlineHtml(s)}
      ${s.mo_ta?`<div class="chk-rec-note">${escHtml(s.mo_ta).slice(0,160)}</div>`:''}
      ${s.phan_hoi_xu_ly?`<div style="margin-top:6px;padding:8px 10px;background:#F0F7FB;border-left:3px solid #1B4965;border-radius:6px;font-size:12.5px;color:#0F2E45"><b style="color:#1B4965">Phản hồi:</b> ${escHtml(s.phan_hoi_xu_ly).slice(0,200)}</div>`:''}
      ${laCD ? '' : bgSuVuLoTrinh(s)}
      ${actBtns?`<div class="bg-sv-acts">${actBtns}</div>`:''}
    </div>
  </div>`;
}

// Lộ trình xử lý — dựng từ các mốc thời gian trong bảng su_vu
function bgSuVuLoTrinh(s){
  const steps = [];
  steps.push({ lbl:'Tạo sự vụ', who:s.nguoi_tao_ten, t:s.created_at });
  if (s.thoi_gian_tiep_nhan)     steps.push({ lbl:'Tiếp nhận', who:s.nguoi_phu_trach_ten, t:s.thoi_gian_tiep_nhan });
  if (s.thoi_gian_bat_dau_xu_ly) steps.push({ lbl:'Bắt đầu xử lý', who:s.nguoi_phu_trach_ten, t:s.thoi_gian_bat_dau_xu_ly });
  if (s.thoi_gian_phan_hoi)      steps.push({ lbl:'Phản hồi'+(s.nguoi_xu_ly_ten?' · giao '+s.nguoi_xu_ly_ten:''), t:s.thoi_gian_phan_hoi });
  if (s.thoi_gian_xu_ly_xong)    steps.push({ lbl:'Đã xử lý xong', who:s.nguoi_xu_ly_ten, t:s.thoi_gian_xu_ly_xong, hi:true });
  if (s.thoi_gian_dong)          steps.push({ lbl:'Hoàn tất · đóng', who:s.nguoi_dong_ten, t:s.thoi_gian_dong, hi:true });
  if (steps.length <= 1) return '';
  return `<div class="bg-sv-lotrinh">
    <div class="bg-sv-lt-title">Lộ trình xử lý</div>
    ${steps.map((st,i)=>`<div class="bg-sv-step${st.hi?' hi':''}${i===steps.length-1?' last':''}">
      <span class="bg-sv-dot"></span>
      <span class="bg-sv-step-lbl">${escHtml(st.lbl)}${st.who?' · '+escHtml(st.who):''}</span>
      <span class="bg-sv-step-t">${bgFmtDateTimeShort(st.t)}</span>
    </div>`).join('')}
  </div>`;
}

// ─── [v16.4] Đếm ngược deadline xử lý — đồng hồ chạy cho cơ động/người xử lý ───
// Deadline hiệu lực: ưu tiên giá trị lưu; thiếu thì tính từ created_at + cấp độ
function _bgEffDeadline(s){
  if (s.deadline_xu_ly) return s.deadline_xu_ly;
  if (!s.created_at) return null;
  const hrs = s.muc_do==='KHAN_CAP'?24:s.muc_do==='QUAN_TRONG'?48:168;
  return new Date(new Date(s.created_at).getTime() + hrs*3600000).toISOString();
}

// Chip đồng hồ đếm ngược — gọn, tự đổi màu theo độ gấp (xanh→cam→đỏ), đồng bộ mọi thẻ
function bgSuVuCountChip(s){
  if (['DA_XU_LY_XONG','HOAN_TAT','HUY'].includes(s.trang_thai)) return '';
  const dl = _bgEffDeadline(s);
  if (!dl) return '';
  return `<span class="bg-sv-deadline" style="display:inline-flex;align-items:center;gap:5px;margin:0;padding:3px 10px;border-left-width:1px;border-radius:20px"><span style="font-size:11px;line-height:1">⏱</span><span class="bg-sv-dl-count" data-deadline="${escHtml(dl)}">—</span></span>`;
}

function bgSuVuDeadlineHtml(s){
  if (['DA_XU_LY_XONG','HOAN_TAT','HUY'].includes(s.trang_thai)) return '';
  const dl = _bgEffDeadline(s);
  if (!dl) return '';
  return `<div class="bg-sv-deadline">
    <span class="bg-sv-dl-icon">⏱</span>
    <span class="bg-sv-dl-main">
      <span class="bg-sv-dl-label">Hạn xử lý: <b>${bgFmtDateTimeShort(dl)}</b></span>
      <span class="bg-sv-dl-count" data-deadline="${escHtml(dl)}">—</span>
    </span>
  </div>`;
}

function _bgFmtConLai(ms){
  const tot = Math.floor(Math.abs(ms)/1000);
  const p2 = n => String(n).padStart(2,'0');
  // >48 giờ: hiện theo NGÀY. ≤48 giờ: chạy đồng hồ giờ:phút:giây (giờ tính tổng, KHẨN=24, QUAN_TRONG=48)
  if (tot > 48*3600) return Math.round(tot/86400) + ' ngày';
  const h = Math.floor(tot/3600);
  const m = Math.floor((tot%3600)/60);
  const sec = tot%60;
  return p2(h)+':'+p2(m)+':'+p2(sec);
}

function bgSuVuTickCountdowns(){
  const now = Date.now();
  const els = document.querySelectorAll('.bg-sv-dl-count');
  if (!els.length) { bgSuVuStopTimer(); return; }
  els.forEach(el=>{
    const dl = el.getAttribute('data-deadline');
    if (!dl) return;
    const diff = new Date(dl).getTime() - now;
    const box = el.closest('.bg-sv-deadline');
    if (diff <= 0){
      el.textContent = 'QUÁ HẠN ' + _bgFmtConLai(diff);
      if (box){ box.classList.add('overdue'); box.classList.remove('soon'); }
    } else {
      el.textContent = 'còn ' + _bgFmtConLai(diff);
      if (box){
        box.classList.remove('overdue');
        box.classList.toggle('soon', diff < 2*3600*1000); // < 2 giờ → cảnh báo cam
      }
    }
  });
}

let _bgSuVuTimer = null;
function bgSuVuStartTimer(){
  bgSuVuStopTimer();
  bgSuVuTickCountdowns();
  _bgSuVuTimer = setInterval(bgSuVuTickCountdowns, 1000);
}
function bgSuVuStopTimer(){
  if (_bgSuVuTimer){ clearInterval(_bgSuVuTimer); _bgSuVuTimer = null; }
}

// ═════════════════════════════════════════════════════════════════════════
//  [Lớp 1] POPUP CHI TIẾT SỰ VỤ (cơ động) — lộ trình + ảnh + phản hồi/hoàn tất
// ═════════════════════════════════════════════════════════════════════════
window.bgSuVuOpenDetail = function(id){
  const s = (window._bgSuVuCache||[]).find(x => x.id === id);
  if (!s){ showToast('Không tìm thấy sự vụ', 'warn'); return; }
  let ov = document.getElementById('bgsv-detail');
  if (!ov){ ov = document.createElement('div'); ov.id='bgsv-detail'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center';
  ov.onclick = bgSuVuCloseDetail;
  ov.innerHTML = bgSuVuDetailHtml(s);
  bgSuVuStartTimer();
};
window.bgSuVuCloseDetail = function(){ const o=document.getElementById('bgsv-detail'); if(o) o.remove(); };

function bgSuVuDetailHtml(s){
  const mdLbl = { KHAN_CAP:'Khẩn cấp', QUAN_TRONG:'Quan trọng', CAN_THIET:'Cần thiết' }[s.muc_do]||s.muc_do;
  const accent = s.muc_do==='KHAN_CAP'?'#DC2626':s.muc_do==='QUAN_TRONG'?'#D97706':'#1B4965';
  const stLbl = { MOI_TAO:'Mới tạo', DA_TIEP_NHAN:'Đã tiếp nhận', DANG_XU_LY:'Đang xử lý', DA_PHAN_HOI:'Đã phản hồi', DA_XU_LY_XONG:'Chờ cửa hàng xác nhận', HOAN_TAT:'Hoàn tất', HUY:'Hủy' }[s.trang_thai]||s.trang_thai;
  const isOpen = !['HOAN_TAT','HUY'].includes(s.trang_thai);
  const laCD = _bgLaCoDong();

  let imgs = '';
  if (Array.isArray(s.anh_urls) && s.anh_urls.length){
    imgs = `<div style="margin-top:14px"><div style="font-size:12px;font-weight:600;color:#64748B;margin-bottom:7px">Ảnh đính kèm (${s.anh_urls.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${s.anh_urls.map(u=>`<img src="${escHtml(u)}" loading="lazy" onclick="bgSuVuLightbox('${escHtml(u)}')" style="width:84px;height:84px;object-fit:cover;border-radius:10px;cursor:zoom-in;border:1px solid #E2E8F0">`).join('')}</div></div>`;
  }
  const baoLai = s.so_lan_bao_lai>1 ? `<div style="margin-top:12px;padding:8px 11px;background:#FEF3C7;border-radius:8px;font-size:12.5px;color:#92400E">Cửa hàng đã báo lại <b>${s.so_lan_bao_lai} lần</b> · cùng một sự vụ, không tạo mới</div>` : '';
  const phanHoiCu = s.phan_hoi_xu_ly ? `<div style="margin-top:12px;padding:10px 12px;background:#F0F7FB;border-left:3px solid #1B4965;border-radius:8px;font-size:13px;color:#0F2E45"><b style="color:#1B4965">Phản hồi gần nhất:</b> ${escHtml(s.phan_hoi_xu_ly)}</div>` : '';

  let coDongActs = '';
  if (laCD && isOpen){
    coDongActs = `<div style="margin-top:16px;border-top:1px solid #EEF2F6;padding-top:14px">
        <div style="font-size:13px;font-weight:600;color:#0F2E45;margin-bottom:8px">Trao đổi với cửa hàng (tùy chọn)</div>
        <textarea id="bgsv-ph-noidung" rows="3" placeholder="Nhập nội dung phản hồi nếu cần..." style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:10px;padding:10px;font-size:14px;font-family:inherit;resize:vertical"></textarea>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
          <span style="font-size:12.5px;color:#64748B">Gia hạn đến:</span>
          <input type="datetime-local" id="bgsv-ph-deadline" style="border:1px solid #CBD5E1;border-radius:8px;padding:7px 10px;font-size:13px;font-family:inherit">
        </div>
        <button id="bgsv-ph-btn" onclick="bgSuVuDetailPhanHoi('${s.id}')" style="width:100%;margin-top:10px;background:#1B4965;color:#fff;border:none;padding:11px;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer">Gửi phản hồi</button>
        <button onclick="bgSuVuDetailHoanTat('${s.id}')" style="width:100%;margin-top:8px;background:linear-gradient(135deg,#1D9E75,#0F6E56);color:#fff;border:none;padding:12px;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer">Đã xử lý</button>
      </div>`;
  }

  return `<div class="bgsv-detail-sheet" onclick="event.stopPropagation()" style="background:#fff;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;border-radius:16px 16px 0 0;padding:18px 16px 22px;-webkit-overflow-scrolling:touch">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="background:${accent};color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px">${mdLbl}</span>
        <span style="font-size:12px;color:#64748B;font-weight:600">${stLbl}</span>
      </div>
      <button onclick="bgSuVuCloseDetail()" style="background:#F1F5F9;border:none;width:32px;height:32px;border-radius:9px;font-size:16px;cursor:pointer;color:#475569">✕</button>
    </div>
    <div style="font-weight:600;font-size:17px;color:#0F172A">${escHtml(s.ten_ch_snapshot||s.ma_ch||'')}</div>
    <div style="font-weight:600;font-size:14px;color:#334155;margin-top:2px">${escHtml(s.tieu_de||'')}${s.ma_sv?` <span style="color:#94A3B8;font-size:11px;font-weight:500">#${escHtml(s.ma_sv)}</span>`:''}</div>
    ${bgSuVuDeadlineHtml(s)}
    ${s.mo_ta?`<div style="margin-top:12px;font-size:14px;color:#1E293B;line-height:1.5;white-space:pre-wrap">${escHtml(s.mo_ta)}</div>`:''}
    ${baoLai}
    ${imgs}
    ${bgSuVuDetailFlow(s)}
    ${phanHoiCu}
    ${coDongActs}
  </div>`;
}

// Lộ trình kết nối: tạo → điều phối → tiếp nhận → phản hồi → xong → hoàn tất
function bgSuVuDetailFlow(s){
  const team = window._bgCoDongNhom || [];
  const steps = [];
  steps.push({ lbl:'Cửa hàng tạo sự vụ', who:s.nguoi_tao_ten, t:s.created_at });
  steps.push({ lbl:'Điều phối', who:'Ban quản lý', t:null });
  const xlWho = s.nguoi_xu_ly_ten || (team.length ? team.join(', ') : 'Cơ động khu vực');
  steps.push({ lbl: s.thoi_gian_xu_ly_xong ? 'Đã xử lý xong' : 'Đang xử lý', who: xlWho, t: s.thoi_gian_xu_ly_xong || s.thoi_gian_bat_dau_xu_ly });
  if (s.thoi_gian_phan_hoi) steps.push({ lbl:'Phản hồi cửa hàng', who:s.nguoi_xu_ly_ten, t:s.thoi_gian_phan_hoi });
  if (s.thoi_gian_dong) steps.push({ lbl:'Hoàn tất & đóng', who:s.nguoi_dong_ten, t:s.thoi_gian_dong });
  return `<div style="margin-top:16px;border-top:1px solid #EEF2F6;padding-top:14px">
    <div style="font-size:12px;font-weight:600;color:#64748B;margin-bottom:10px">Lộ trình xử lý</div>
    ${steps.map((st,i)=>{
      const last = i===steps.length-1;
      return `<div style="display:flex;gap:10px;align-items:stretch">
        <div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:11px;height:11px;border-radius:50%;background:${last?'#1D9E75':'#CBD5E1'};margin-top:3px;flex:none"></div>
          ${last?'':'<div style="width:2px;flex:1;min-height:20px;background:#E2E8F0"></div>'}
        </div>
        <div style="padding-bottom:${last?'0':'12px'}">
          <div style="font-size:13.5px;font-weight:600;color:#0F172A">${escHtml(st.lbl)}${st.who?` · <span style="color:#475569;font-weight:500">${escHtml(st.who)}</span>`:''}</div>
          ${st.t?`<div style="font-size:11.5px;color:#94A3B8;margin-top:1px">${bgFmtDateTimeShort(st.t)}</div>`:''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

window.bgSuVuLightbox = function(url){
  let lb = document.getElementById('bgsv-lightbox');
  if (!lb){ lb = document.createElement('div'); lb.id='bgsv-lightbox'; document.body.appendChild(lb); }
  lb.style.cssText = 'position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  lb.onclick = function(){ lb.remove(); };
  lb.innerHTML = `<img src="${escHtml(url)}" style="max-width:94vw;max-height:90vh;object-fit:contain;border-radius:8px">`;
};

window.bgSuVuDetailPhanHoi = async function(id){
  const elN = document.getElementById('bgsv-ph-noidung');
  const noidung = (elN && elN.value || '').trim();
  if (!noidung){ showToast('Nhập nội dung phản hồi', 'warn'); return; }
  const elD = document.getElementById('bgsv-ph-deadline');
  let deadline = null;
  if (elD && elD.value){ const d = new Date(elD.value); if (!isNaN(d.getTime())) deadline = d.toISOString(); }
  const btn = document.getElementById('bgsv-ph-btn'); if (btn){ btn.disabled=true; btn.textContent='Đang gửi...'; }
  try {
    const { data, error } = await supa.rpc('fn_su_vu_co_dong_phan_hoi', {
      p_id:id, p_ma_nv:SESSION.ma, p_ten_nv:SESSION.ten||SESSION.hoTen||'', p_noi_dung:noidung, p_deadline:deadline
    });
    if (error || (data&&data.ok===false)) throw new Error((data&&data.error)||(error||{}).message);
    showToast('✓ Đã gửi phản hồi', 'ok');
    bgSuVuCloseDetail(); bgRenderSuVu();
  } catch(e){ if (btn){ btn.disabled=false; btn.textContent='Gửi phản hồi'; } showToast('⚠ '+e.message, 'warn'); }
};

// Hoàn tất + HOÀN TÁC 10 GIÂY (hành động chỉ thực thi sau 10s)
window.bgSuVuDetailHoanTat = function(id){
  bgSuVuCloseDetail();
  bgUndoBar('Đã đánh dấu xử lý xong · chờ cửa hàng đóng sự vụ', async ()=>{
    try {
      const { data, error } = await supa.rpc('fn_su_vu_co_dong_xong', { p_id:id, p_ma_nv:SESSION.ma, p_ten_nv:SESSION.ten||SESSION.hoTen||'' });
      if (error || (data&&data.ok===false)) throw new Error((data&&data.error)||(error||{}).message);
      showToast('✓ Đã đánh dấu xử lý xong', 'ok');
    } catch(e){ showToast('⚠ '+e.message, 'warn'); }
    bgRenderSuVu();
  }, 10);
};

// ─── Thanh hoàn tác dùng chung (10 giây) ───
let _bgUndoTimer = null, _bgUndoCommit = null;
function bgUndoBar(msg, onCommit, seconds){
  seconds = seconds || 10;
  bgUndoClear();
  let bar = document.getElementById('bg-undo-bar');
  if (!bar){ bar = document.createElement('div'); bar.id='bg-undo-bar'; document.body.appendChild(bar); }
  bar.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:10000;background:#0F2E45;color:#fff;padding:11px 14px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;gap:12px;font-size:13.5px;max-width:92vw';
  _bgUndoCommit = onCommit;
  let left = seconds;
  const render = ()=>{
    bar.innerHTML = `<span>${escHtml(msg)}</span><button id="bg-undo-btn" style="background:#3FB6A8;color:#06241E;border:none;padding:7px 13px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap">Hoàn tác (${left})</button>`;
    const b = document.getElementById('bg-undo-btn'); if (b) b.onclick = bgUndoCancel;
  };
  render();
  _bgUndoTimer = setInterval(()=>{ left--; if (left<=0){ bgUndoFire(); } else render(); }, 1000);
}
function bgUndoClear(){ if(_bgUndoTimer){ clearInterval(_bgUndoTimer); _bgUndoTimer=null; } const b=document.getElementById('bg-undo-bar'); if(b) b.remove(); }
function bgUndoCancel(){ _bgUndoCommit=null; bgUndoClear(); showToast('Đã hoàn tác', 'ok'); }
async function bgUndoFire(){ const fn=_bgUndoCommit; _bgUndoCommit=null; bgUndoClear(); if(fn) await fn(); }

// [B1] Cơ động xác nhận đã xử lý xong (bất kỳ ai trong vùng, không cần nhận việc)
window.bgSuVuCoDongXong = async function(id){
  if (!confirm('Xác nhận bạn đã xử lý xong sự vụ này?\nCửa hàng sẽ kiểm tra rồi xác nhận hoàn tất.')) return;
  if (window._svActing) return; window._svActing = true;
  try {
    const { data, error } = await supa.rpc('fn_su_vu_co_dong_xong', {
      p_id:id, p_ma_nv:SESSION.ma, p_ten_nv:SESSION.ten||SESSION.hoTen||''
    });
    if (error || (data&&data.ok===false)) throw new Error((data&&data.error)||(error||{}).message);
    showToast('✓ Đã xử lý xong · chờ cửa hàng xác nhận', 'ok');
    bgRenderSuVu();
  } catch(e){ showToast('⚠ '+e.message, 'warn'); }
  finally { window._svActing = false; }
};

// Cơ động / người xử lý xác nhận đã xử lý xong
window.bgSuVuXacNhanXong = async function(id){
  if (!confirm('Xác nhận bạn đã xử lý xong sự vụ này?\nCửa hàng sẽ kiểm tra rồi xác nhận hoàn tất.')) return;
  if (window._svActing) return; window._svActing = true;
  try {
    const { data, error } = await supa.rpc('fn_su_vu_xac_nhan_xong', {
      p_id:id, p_ma_nv:SESSION.ma, p_ten_nv:SESSION.ten||SESSION.hoTen||''
    });
    if (error || (data&&data.ok===false)) throw new Error((data&&data.error)||(error||{}).message);
    showToast('✓ Đã báo xử lý xong · chờ cửa hàng xác nhận', 'ok');
    bgRenderSuVu();
  } catch(e){ showToast('⚠ '+e.message, 'warn'); }
  finally { window._svActing = false; }
};

// Nhân viên / cửa hàng xác nhận hoàn tất & đóng
window.bgSuVuDong = async function(id){
  const note = prompt('Ghi chú khi đóng (tùy chọn):', '');
  if (note === null) return;
  if (window._svActing) return; window._svActing = true;
  try {
    // [v16.74] Vai trò đóng đúng theo loại tài khoản (khớp constraint su_vu)
    const _V = SESSION.vaiTro || '';
    const vaiTroDong = _V === 'CUA_HANG' ? 'TAI_KHOAN_CH'
                     : (_V==='ADMIN'||_V==='ADMINBH'||_V==='QLNS'||/^QLBH/.test(_V)) ? 'QUAN_LY'
                     : 'TRUONG_CA';
    const { data, error } = await supa.rpc('fn_su_vu_dong', {
      p_id:id, p_ma_nv:SESSION.ma, p_ten_nv:SESSION.ten||SESSION.hoTen||'',
      p_vai_tro_dong:vaiTroDong, p_ghi_chu:note||null
    });
    if (error || (data&&data.ok===false)) throw new Error((data&&data.error)||(error||{}).message);
    showToast('✓ Đã xác nhận hoàn tất & đóng sự vụ', 'ok');
    bgRenderSuVu();
  } catch(e){ showToast('⚠ '+e.message, 'warn'); }
};

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
        p_ma_ch: bgCurrentCH.ma, p_limit: 1000000
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
    if (error || (data && data.ok === false)) throw new Error((data&&data.error)||(error||{}).message);
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
    <div class="bgd-section-l">Tiền mặt</div>
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
    if (st.status === 'BT') itemsDat.push({ g, it });
    else if (st.status === 'KO') itemsKhongCo.push({ g, it });
    else if (st.status === 'VD') itemsVD.push({ g, it, mota: st.mo_ta });
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
            <div class="bg-cf-stat-l">Bình thường</div>
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
