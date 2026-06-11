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
    1: 'Khu vực 1 — Mặt tiền, hạ tầng',
    2: 'Khu vực 2 — Quầy thu ngân & IT',
    4: 'Khu vực 4 — Kho, sinh hoạt, công cụ'
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

  // Group 5: Hàng hóa (9 dòng: 3 khu vực × 3 nhóm)
  const KV_HANG = { 'SANH':'Sảnh trưng bày', 'KHO':'Kho', 'NIEM_PHONG':'Niêm phong' };
  const NHOM_HANG = ['Nhóm Nón Vải','Nhóm Nón Bảo Hiểm','Nhóm Phụ Kiện (Lưới, kính...)'];
  const hangItems = [];
  for (const kv of ['SANH','KHO','NIEM_PHONG']) {
    for (const nh of NHOM_HANG) {
      hangItems.push({ id:'hg_'+kv+'_'+nh, khu_vuc:kv, nhom_hang:nh, ten: nh + ' · ' + KV_HANG[kv] });
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
  ['new','today','timeline'].forEach(s => {
    document.getElementById('bg-subtab-'+s).classList.toggle('active', s===sub);
    document.getElementById('bg-sub-'+s).style.display = s===sub ? '' : 'none';
  });
  if (sub==='today') bgRenderToday();
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
    const v = (bgState[it.id]&&bgState[it.id].so_tien)||0;
    const note = (bgState[it.id]&&bgState[it.id].ghi_chu)||'';
    return `<div class="bg-tien-row" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F1F5F9">
      <div style="flex:1;font-size:13px;color:#334155">${escHtml(it.ten)}</div>
      <input type="text" inputmode="numeric" class="bg-tien-input" id="bg-tien-${it.id}"
        style="width:130px;padding:8px 10px;text-align:right;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-weight:600;font-family:'JetBrains Mono',monospace;color:#1E293B"
        value="${bgFmtVN(v)}"
        onfocus="this.value=(bgState['${it.id}']&&bgState['${it.id}'].so_tien)||''"
        onblur="bgUpdateTien('${it.id}', this.value)">
      <button class="bg-note-btn ${note?'has':''}" onclick="bgToggleTienNote('${it.id}')" 
        style="width:34px;height:34px;border-radius:8px;border:1.5px solid #E2E8F0;background:${note?'#FBBF24':'#fff'};color:${note?'#fff':'#94A3B8'};cursor:pointer;display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </button>
    </div>
    <div class="bg-tien-note" id="bg-tien-note-${it.id}" style="display:${note?'block':'none'};padding:0 0 10px">
      <textarea class="chk-vd-textarea" oninput="bgUpdateTienNote('${it.id}', this.value)" 
        placeholder="Ghi chú / giải trình (nếu lệch)..." 
        style="border-color:#FDE047;background:#FEFCE8">${escHtml(note)}</textarea>
    </div>`;
  }).join('');
  rows += `<div style="display:flex;align-items:center;padding:14px 0 4px;border-top:2px solid #E2E8F0;margin-top:6px">
    <div style="flex:1;font-size:13px;font-weight:700;color:#0F2E45">Tổng tiền bàn giao (1 + 2 − 3)</div>
    <div id="bg-tien-tong" style="width:130px;text-align:right;padding:8px 10px;font-family:'JetBrains Mono',monospace;font-weight:800;font-size:16px;color:#0F2E45;background:#F1F5F9;border-radius:8px">0</div>
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
        <button class="chk-tg bt ${st.status==='BT'?'active':''}" onclick="bgSetTaiSan('${it.id}','BT')">Bình thường</button>
        <button class="chk-tg vd ${st.status==='VD'?'active':''}" onclick="bgSetTaiSan('${it.id}','VD')">Có vấn đề</button>
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
  if (status === 'BT') {
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

// ─── Group Hàng hóa (9 dòng số nguyên + ghi chú) ──────────────────────
function bgRenderGroupHang(g){
  return g.items.map(it => {
    const st = bgState[it.id] || {};
    const sl = (st.so_luong!==undefined) ? st.so_luong : '';
    const note = st.ghi_chu || '';
    return `<div class="bg-hang-row" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #F8FAFC">
      <div style="flex:1;font-size:12.5px;color:#334155">${escHtml(it.ten)}</div>
      <input type="number" inputmode="numeric" min="0" 
        style="width:80px;padding:7px 8px;text-align:right;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-weight:600;font-family:'JetBrains Mono',monospace"
        value="${sl}" placeholder="--"
        onchange="bgUpdateHang('${it.id}', this.value)">
      <button class="${note?'has':''}" onclick="bgToggleHangNote('${it.id}')" 
        style="width:32px;height:32px;border-radius:8px;border:1.5px solid #E2E8F0;background:${note?'#FBBF24':'#fff'};color:${note?'#fff':'#94A3B8'};cursor:pointer;display:flex;align-items:center;justify-content:center">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </button>
    </div>
    <div id="bg-hang-note-${it.id}" style="display:${note?'block':'none'};padding:0 0 9px">
      <textarea class="chk-vd-textarea" oninput="bgUpdateHangNote('${it.id}', this.value)"
        placeholder="Ghi chú / chênh lệch..."
        style="border-color:#FDE047;background:#FEFCE8">${escHtml(note)}</textarea>
    </div>`;
  }).join('');
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
    `<div class="chk-photo-wrap"><img class="chk-photo-thumb" src="${p.dataUrl}" style="width:78px;height:78px"><div class="chk-photo-del" onclick="bgDelBienBanPhoto(${i})">×</div></div>`
  ).join('');
  return `<div class="chk-photo-row" id="bg-anh-row">
    ${photos}
    <label class="chk-photo-add" style="width:78px;height:78px;border-color:#1B4965;color:#1B4965">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      Chọn ảnh
      <input type="file" accept="image/*" style="display:none" onchange="bgAddBienBanPhoto(this)">
    </label>
  </div>
  <div style="margin-top:6px;font-size:11px;color:#94A3B8">Chọn ảnh biên bản giấy đã ký, hệ thống sẽ tự cắt theo khung. Tối đa 6 ảnh.</div>`;
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

  // Tiền: cần nhập đủ 3 dòng tiền (>=0 cũng tính là nhập nếu user đã chạm — kiểm bằng key tồn tại)
  const tienOK = ['tien_mat_ket','tien_ban_hang','tien_chi'].every(k => bgState[k] && bgState[k].so_tien !== undefined);
  if (tienOK) doneCount++;

  // 3 nhóm tài sản: hết items đã có status
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
    const anyHang = hangG.items.some(it=>bgState[it.id] && bgState[it.id].so_luong !== undefined && bgState[it.id].so_luong !== null);
    if (anyHang) doneCount++;
  }

  // Ảnh: >= 1
  if (bgPhotos.length >= 1) doneCount++;

  const txt = document.getElementById('bg-progress-text');
  const isb = document.getElementById('bg-progress-issues');
  const fill = document.getElementById('bg-progress-fill');
  const btn = document.getElementById('bg-submit-btn');
  if (txt) txt.textContent = 'Hoàn thành '+doneCount+'/6 phần';
  if (isb) isb.textContent = issues > 0 ? (issues + ' vấn đề') : '';
  if (fill) fill.style.width = (doneCount/6*100) + '%';
  if (btn) {
    // Cần đủ 6 phần để gửi
    btn.disabled = (doneCount < 6);
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
        chi_tiet_tai_san.push({
          stt: it.stt, ten: it.ten, don_vi: it.don_vi, khu_vuc: it.khu_vuc,
          dat: st.status !== 'VD',
          ghi_chu: st.status==='VD' ? (st.mo_ta||null) : null
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
            p_tieu_de: it.ten + ' — Có vấn đề',
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
          p_tieu_de: LBL + ' — Có ghi chú',
          p_mo_ta: note,
          p_so_lieu: { loai:k, so_tien: bgState[k].so_tien||0 },
          p_anh_urls: [], p_muc_do: 'KHAN_CAP'
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
            p_tieu_de: it.nhom_hang + ' (' + it.khu_vuc + ') — Chênh lệch',
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
//  TAB 2: HÔM NAY
// ═════════════════════════════════════════════════════════════════════════
async function bgRenderToday(){
  const list = document.getElementById('bg-today-list');
  list.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
  if (!bgCurrentCH){ list.innerHTML = '<div class="ns-empty">Chưa xác định cửa hàng.</div>'; return; }
  try {
    const today = new Date().toISOString().slice(0,10);
    const { data } = await supa.rpc('fn_ban_giao_list', {
      p_ma_ch: bgCurrentCH.ma, p_limit: 30, p_offset: 0
    });
    const todayList = (data || []).filter(b => b.ngay_ban_giao === today);
    const cnt = document.getElementById('bg-today-count');
    if (todayList.length === 0){
      list.innerHTML = '<div class="ns-empty">Chưa có biên bản nào hôm nay.</div>';
      cnt.style.display = 'none';
      return;
    }
    cnt.style.display = ''; cnt.textContent = todayList.length;
    list.innerHTML = todayList.map(bgRecHtml).join('');
  } catch(e){ list.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+e.message+'</div>'; }
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
//  TAB 3: TIMELINE (Sprint 1 stub — Sprint 2 sẽ làm đầy đủ Gallery + Filter)
// ═════════════════════════════════════════════════════════════════════════
async function bgRenderTimeline(){
  const list = document.getElementById('bg-timeline-list');
  list.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
  if (!bgCurrentCH){ list.innerHTML = '<div class="ns-empty">Chưa xác định cửa hàng.</div>'; return; }
  try {
    const { data } = await supa.rpc('fn_ban_giao_list', {
      p_ma_ch: bgCurrentCH.ma, p_limit: 50, p_offset: 0
    });
    if (!data || data.length === 0){
      list.innerHTML = '<div class="ns-empty">Chưa có biên bản nào.</div>';
      return;
    }
    // Group theo ngày
    const byDay = {};
    data.forEach(b => {
      const d = b.ngay_ban_giao;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(b);
    });
    const days = Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
    list.innerHTML = days.map(d => `
      <div style="margin:14px 0 8px;padding:0 4px;font-size:12px;font-weight:700;color:#0F2E45;text-transform:uppercase;letter-spacing:.04em">
        ${bgFmtDayVN(d)}
      </div>
      ${byDay[d].map(bgRecHtml).join('')}
    `).join('');
  } catch(e){ list.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+e.message+'</div>'; }
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
