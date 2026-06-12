/* ═══════════════════════════════════════════════════════════════════════════
 *  NÓN SƠN — BÀN GIAO CA · QUẢN LÝ v1.0 (Sprint 2)
 *  
 *  3 tab:
 *   1. Sự vụ: list cross-CH, filter (CH/khu vực/trạng thái/mức độ),
 *      actions: Tiếp nhận / Bắt đầu xử lý / Phản hồi (deadline BẮT BUỘC) / Đóng / Hủy
 *   2. Timeline: ảnh + tóm tắt biên bản từ tất cả CH, filter (ngày/khu vực/CH)
 *   3. Thống kê: 3 thẻ (Đã gửi / Chưa gửi / Phát sinh sự cố) + range ngày
 *
 *  Kế thừa CSS chk-* + bg-tl-* (Timeline NV)
 *  Backend RPCs: fn_su_vu_list, fn_su_vu_tiep_nhan, fn_su_vu_bat_dau,
 *                fn_su_vu_phan_hoi (v2 — deadline), fn_su_vu_hoan_tat,
 *                fn_su_vu_huy, fn_ban_giao_timeline_ql, fn_ban_giao_thong_ke
 * ═══════════════════════════════════════════════════════════════════════════ */

// State
let bgqlSub = 'suvu';
let bgqlInnerTab = 'suvu';  // [v13.28] 'suvu' | 'tienchi'
let bgqlSuVuCache = null;
let bgqlTienChiCache = null;
let bgqlSuVuFilter = { trang_thai:'open', muc_do:'all', khu_vuc:'all', ma_ch:null, range:'7d', customFrom:null, customTo:null };
let bgqlTimelineFilter = { content:'all', from:null, to:null, ma_ch:null, khu_vuc:'all' };
let bgqlTimelineCache = null;
let bgqlStatsRange = 'today'; // 'today' | 'week' | 'month' | 'custom'

// ═════════════════════════════════════════════════════════════════════════
//  ENTRY
// ═════════════════════════════════════════════════════════════════════════
function bgqlInitPage(){
  // [v13.27] Giữ tab + cache khi user switch tab về rồi quay lại
  if (bgqlSuVuCache !== null && document.getElementById('bgql-sub-suvu')) {
    // Chỉ refresh badge tab counts (không clear cache)
    bgqlSwitchSub(bgqlSub || 'suvu');
    return;
  }
  bgqlSub = 'suvu';
  bgqlSuVuCache = null;
  bgqlTimelineCache = null;
  bgqlSwitchSub('suvu');
}
window.bgqlInitPage = bgqlInitPage;

function bgqlSwitchSub(sub){
  bgqlSub = sub;
  ['suvu','timeline','stats','print'].forEach(s => {
    const tab = document.getElementById('bgql-subtab-'+s);
    const body = document.getElementById('bgql-sub-'+s);
    if (tab) tab.classList.toggle('active', s===sub);
    if (body) body.style.display = s===sub ? '' : 'none';
  });
  if (sub==='suvu') bgqlLoadSuVu();
  if (sub==='timeline') bgqlLoadTimeline();
  if (sub==='stats') bgqlLoadStats();
  if (sub==='print') bgqlLoadPrint();
}
window.bgqlSwitchSub = bgqlSwitchSub;

// ═════════════════════════════════════════════════════════════════════════
//  TAB 1: SỰ VỤ
// ═════════════════════════════════════════════════════════════════════════
async function bgqlLoadSuVu(){
  const list = document.getElementById('bgql-suvu-list');
  list.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
  try {
    const { data, error } = await supa.rpc('fn_su_vu_list', {
      p_ma_ch: null, p_limit: 200, p_offset: 0
    });
    if (error) throw error;
    bgqlSuVuCache = data || [];
    bgqlRenderSuVuFilters();
    bgqlRenderSuVuList();
  } catch(e){
    list.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+e.message+'</div>';
  }
}

function bgqlRenderSuVuFilters(){
  const cont = document.getElementById('bgql-suvu-filters');
  if (!cont) return;
  const all = bgqlSuVuCache || [];
  const open = all.filter(s => !['HOAN_TAT','HUY'].includes(s.trang_thai));
  const chList = [...new Map(all.map(s => [s.ma_ch, s.ten_ch_snapshot||s.ma_ch])).entries()];
  const khuVucs = [...new Set(all.map(s => s.khu_vuc).filter(k=>k))].sort();

  if (bgqlInnerTab === 'suvu') {
    cont.innerHTML = `
      <div class="bgql-flt-row">
        <select class="bg-tl-dropdown" onchange="bgqlSetFilterDD('muc_do', this.value)">
          <option value="all"${bgqlSuVuFilter.muc_do==='all'?' selected':''}>Mức độ: Tất cả</option>
          <option value="KHAN_CAP"${bgqlSuVuFilter.muc_do==='KHAN_CAP'?' selected':''}>🔴 Khẩn cấp</option>
          <option value="QUAN_TRONG"${bgqlSuVuFilter.muc_do==='QUAN_TRONG'?' selected':''}>⚠️ Quan trọng</option>
          <option value="CAN_THIET"${bgqlSuVuFilter.muc_do==='CAN_THIET'?' selected':''}>📋 Cần thiết</option>
        </select>
        <select class="bg-tl-dropdown" onchange="bgqlSetFilterDD('trang_thai', this.value)">
          <option value="open"${bgqlSuVuFilter.trang_thai==='open'?' selected':''}>Đang xử lý (${open.length})</option>
          <option value="closed"${bgqlSuVuFilter.trang_thai==='closed'?' selected':''}>Đã đóng</option>
          <option value="all"${bgqlSuVuFilter.trang_thai==='all'?' selected':''}>Tất cả</option>
        </select>
      </div>
      ${(khuVucs.length>1 || chList.length>5) ? `
      <div class="bgql-flt-row">
        ${khuVucs.length>1 ? `<select class="bg-tl-dropdown" onchange="bgqlSetFilterDD('khu_vuc', this.value)">
          <option value="all"${bgqlSuVuFilter.khu_vuc==='all'?' selected':''}>Mọi khu vực</option>
          ${khuVucs.map(k=>`<option value="${escHtml(k)}"${bgqlSuVuFilter.khu_vuc===k?' selected':''}>${escHtml(k)}</option>`).join('')}
        </select>` : ''}
        ${chList.length>5 ? `<select class="bg-tl-dropdown" onchange="bgqlSetFilterDD('ma_ch', this.value)">
          <option value="">Mọi cửa hàng</option>
          ${chList.map(([k,v])=>`<option value="${escHtml(k)}"${bgqlSuVuFilter.ma_ch===k?' selected':''}>${escHtml(v)}</option>`).join('')}
        </select>` : ''}
      </div>` : ''}
    `;
  } else if (bgqlInnerTab === 'tienchi') {
    const tc = bgqlTienChiCache || [];
    const tcChList = [...new Map(tc.map(t => [t.ma_ch, t.ten_ch_snapshot||t.ma_ch])).entries()];
    const tcKhuVucs = [...new Set(tc.map(t => t.khu_vuc).filter(k=>k))].sort();
    cont.innerHTML = `
      <div class="bgql-flt-row">
        <select class="bg-tl-dropdown" onchange="bgqlSetFilterDD('range', this.value)">
          <option value="today"${bgqlSuVuFilter.range==='today'?' selected':''}>Hôm nay</option>
          <option value="7d"${bgqlSuVuFilter.range==='7d'?' selected':''}>7 ngày qua</option>
          <option value="30d"${bgqlSuVuFilter.range==='30d'?' selected':''}>30 ngày qua</option>
          <option value="custom"${bgqlSuVuFilter.range==='custom'?' selected':''}>Tự chọn khoảng…</option>
        </select>
        ${tcKhuVucs.length>1 ? `<select class="bg-tl-dropdown" onchange="bgqlSetFilterDD('khu_vuc', this.value)">
          <option value="all"${bgqlSuVuFilter.khu_vuc==='all'?' selected':''}>Mọi khu vực</option>
          ${tcKhuVucs.map(k=>`<option value="${escHtml(k)}"${bgqlSuVuFilter.khu_vuc===k?' selected':''}>${escHtml(k)}</option>`).join('')}
        </select>` : ''}
      </div>
      ${bgqlSuVuFilter.range === 'custom' ? `<div class="bgql-flt-row">
        <input type="date" class="bg-tl-dropdown" value="${bgqlSuVuFilter.customFrom||''}" onchange="bgqlSetTcCustomFrom(this.value)">
        <input type="date" class="bg-tl-dropdown" value="${bgqlSuVuFilter.customTo||''}" onchange="bgqlSetTcCustomTo(this.value)">
      </div>` : ''}
      ${tcChList.length>5 ? `<div class="bgql-flt-row">
        <select class="bg-tl-dropdown" onchange="bgqlSetFilterDD('ma_ch', this.value)">
          <option value="">Mọi cửa hàng</option>
          ${tcChList.map(([k,v])=>`<option value="${escHtml(k)}"${bgqlSuVuFilter.ma_ch===k?' selected':''}>${escHtml(v)}</option>`).join('')}
        </select>
      </div>` : ''}
    `;
  }

  const itabSV = document.getElementById('bgql-itab-suvu-c');
  if (itabSV) {
    if (open.length > 0) { itabSV.style.display = ''; itabSV.textContent = open.length; }
    else itabSV.style.display = 'none';
  }
  const badge = document.getElementById('bgql-menu-badge');
  if (badge) {
    const urgentOpen = open.filter(s=>s.muc_do==='KHAN_CAP').length;
    if (urgentOpen > 0) { badge.style.display=''; badge.textContent = urgentOpen; }
    else badge.style.display = 'none';
  }
  const sub = document.getElementById('bgql-suvu-count');
  if (sub) {
    if (open.length > 0) { sub.style.display=''; sub.textContent = open.length; }
    else sub.style.display = 'none';
  }
}

window.bgqlSetFilterDD = function(key, value){
  if (key === 'muc_do') bgqlSuVuFilter.muc_do = value;
  else if (key === 'trang_thai') bgqlSuVuFilter.trang_thai = value;
  else if (key === 'khu_vuc') bgqlSuVuFilter.khu_vuc = value || 'all';
  else if (key === 'ma_ch') bgqlSuVuFilter.ma_ch = value || null;
  else if (key === 'range') {
    bgqlSuVuFilter.range = value;
    bgqlTienChiCache = null;
    if (value !== 'custom') bgqlLoadTienChi();
    else bgqlRenderSuVuFilters();  // Hiện datepicker
    return;
  }
  bgqlRenderSuVuFilters();
  if (bgqlInnerTab === 'suvu') bgqlRenderSuVuList();
  else bgqlRenderTienChiList();
};

// [v13.31] Datepicker custom cho Tiền chi
window.bgqlSetTcCustomFrom = function(v){ 
  bgqlSuVuFilter.customFrom = v; 
  if (bgqlSuVuFilter.customTo) bgqlLoadTienChi();
};
window.bgqlSetTcCustomTo = function(v){ 
  bgqlSuVuFilter.customTo = v; 
  if (bgqlSuVuFilter.customFrom) bgqlLoadTienChi();
};

window.bgqlSwitchInnerTab = function(t){
  bgqlInnerTab = t;
  document.getElementById('bgql-itab-suvu').classList.toggle('active', t==='suvu');
  document.getElementById('bgql-itab-tienchi').classList.toggle('active', t==='tienchi');
  document.getElementById('bgql-inner-suvu').style.display = t==='suvu' ? '' : 'none';
  document.getElementById('bgql-inner-tienchi').style.display = t==='tienchi' ? '' : 'none';
  bgqlRenderSuVuFilters();
  if (t === 'suvu') bgqlRenderSuVuList();
  else {
    if (bgqlTienChiCache === null) bgqlLoadTienChi();
    else bgqlRenderTienChiList();
  }
};

// Legacy compat (cho code khác có thể gọi)
window.bgqlSetFilter = function(k, v){
  if (k === 'reset') bgqlSuVuFilter = { trang_thai:'all', muc_do:'all', khu_vuc:'all', ma_ch:null, range:'7d' };
  else if (k === 'trang_thai') bgqlSuVuFilter.trang_thai = bgqlSuVuFilter.trang_thai === v ? 'all' : v;
  else if (k === 'muc_do') bgqlSuVuFilter.muc_do = bgqlSuVuFilter.muc_do === v ? 'all' : v;
  else if (k === 'khu_vuc') bgqlSuVuFilter.khu_vuc = v || 'all';
  else if (k === 'ma_ch') bgqlSuVuFilter.ma_ch = v || null;
  bgqlRenderSuVuFilters();
  bgqlRenderSuVuList();
};


function bgqlRenderSuVuList(){
  const list = document.getElementById('bgql-suvu-list');
  let arr = bgqlSuVuCache || [];
  
  if (bgqlSuVuFilter.trang_thai === 'open') arr = arr.filter(s => !['HOAN_TAT','HUY'].includes(s.trang_thai));
  else if (bgqlSuVuFilter.trang_thai === 'closed') arr = arr.filter(s => ['HOAN_TAT','HUY'].includes(s.trang_thai));
  if (bgqlSuVuFilter.muc_do !== 'all') arr = arr.filter(s => s.muc_do === bgqlSuVuFilter.muc_do);
  if (bgqlSuVuFilter.khu_vuc !== 'all') arr = arr.filter(s => s.khu_vuc === bgqlSuVuFilter.khu_vuc);
  if (bgqlSuVuFilter.ma_ch) arr = arr.filter(s => s.ma_ch === bgqlSuVuFilter.ma_ch);

  // Sort: KHAN_CAP first, then created_at desc
  arr = arr.slice().sort((a,b) => {
    const mdOrder = { KHAN_CAP:0, QUAN_TRONG:1, CAN_THIET:2 };
    const da = mdOrder[a.muc_do] || 9, db = mdOrder[b.muc_do] || 9;
    if (da !== db) return da - db;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (arr.length === 0){
    list.innerHTML = '<div class="ns-empty">Không có sự vụ phù hợp.</div>';
    return;
  }
  list.innerHTML = arr.map(bgqlSuVuCardHtml).join('');
}

function bgqlSuVuCardHtml(s){
  const mdLbl = { KHAN_CAP:'Khẩn cấp', QUAN_TRONG:'Quan trọng', CAN_THIET:'Cần thiết' }[s.muc_do]||s.muc_do;
  const mdEmoji = { KHAN_CAP:'🔴', QUAN_TRONG:'⚠️', CAN_THIET:'📋' }[s.muc_do]||'';
  const stLbl = {
    MOI_TAO:'Mới tạo', DA_TIEP_NHAN:'Đã tiếp nhận',
    DANG_XU_LY:'Đang xử lý', DA_PHAN_HOI:'Đã phản hồi',
    HOAN_TAT:'Hoàn tất', HUY:'Đã hủy'
  }[s.trang_thai]||s.trang_thai;
  const isOpen = !['HOAN_TAT','HUY'].includes(s.trang_thai);
  const accent = s.muc_do==='KHAN_CAP'?'#DC2626':s.muc_do==='QUAN_TRONG'?'#F97316':'#1B4965';
  
  // Actions theo trạng thái
  let actions = '';
  if (s.trang_thai === 'MOI_TAO') {
    actions = `<button class="bgql-act bgql-act-primary" onclick="event.stopPropagation();bgqlTiepNhan('${s.id}')">Tiếp nhận</button>
               <button class="bgql-act bgql-act-ghost" onclick="event.stopPropagation();bgqlHuy('${s.id}')">Hủy</button>`;
  } else if (s.trang_thai === 'DA_TIEP_NHAN') {
    actions = `<button class="bgql-act bgql-act-primary" onclick="event.stopPropagation();bgqlBatDau('${s.id}')">Bắt đầu xử lý</button>
               <button class="bgql-act bgql-act-secondary" onclick="event.stopPropagation();bgqlOpenPhanHoi('${s.id}')">Phản hồi</button>`;
  } else if (s.trang_thai === 'DANG_XU_LY' || s.trang_thai === 'DA_PHAN_HOI') {
    actions = `<button class="bgql-act bgql-act-secondary" onclick="event.stopPropagation();bgqlOpenPhanHoi('${s.id}')">${s.trang_thai==='DA_PHAN_HOI'?'Cập nhật phản hồi':'Phản hồi'}</button>
               <button class="bgql-act bgql-act-success" onclick="event.stopPropagation();bgqlHoanTat('${s.id}')">Đóng (hoàn tất)</button>`;
  }

  let deadline = '';
  if (s.deadline_xu_ly) {
    const dt = new Date(s.deadline_xu_ly);
    const now = new Date();
    const past = dt < now && isOpen;
    deadline = `<div class="bgql-deadline${past?' past':''}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Deadline: ${pad(dt.getDate())}/${pad(dt.getMonth()+1)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}
      ${past?'<span style="color:#DC2626;font-weight:800;margin-left:4px">QUÁ HẠN</span>':''}
    </div>`;
  }

  return `<div class="bgql-card" style="border-left:4px solid ${accent}" onclick="if(!event.target.closest('.bgql-act,.bgql-card-actions,a,button,input,textarea,select')) bgqlOpenSuVuDetail('${s.id}')">
    <div class="bgql-card-head">
      <span class="bgql-md-tag" style="background:${accent}20;color:${accent}">${mdEmoji} ${mdLbl}</span>
      <span class="bgql-st-tag ${isOpen?'open':'closed'}">${stLbl}</span>
      <span class="bgql-time">${bgqlFmtTimeShort(s.created_at)}</span>
    </div>
    <div class="bgql-card-title">${escHtml(s.tieu_de)}</div>
    <div class="bgql-card-meta">
      <b>${escHtml(s.ten_ch_snapshot||s.ma_ch||'?')}</b> · Tạo: ${escHtml(s.nguoi_tao_ten||'?')}
      ${s.nguoi_phu_trach_ten?' · Phụ trách: '+escHtml(s.nguoi_phu_trach_ten):''}
    </div>
    ${s.mo_ta?`<div class="bgql-card-body">${escHtml(s.mo_ta).slice(0,220)}${s.mo_ta.length>220?'...':''}</div>`:''}
    ${s.phan_hoi_xu_ly?`<div class="bgql-reply">
      <div class="bgql-reply-l">PHẢN HỒI · ${escHtml(s.nguoi_phu_trach_ten||'QL')}</div>
      <div>${escHtml(s.phan_hoi_xu_ly).slice(0,300)}</div>
      ${deadline}
    </div>`:deadline}
    ${actions?`<div class="bgql-actions">${actions}</div>`:''}
  </div>`;
}

function bgqlFmtTimeShort(s){
  if (!s) return '';
  const d = new Date(s);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return pad(d.getHours())+':'+pad(d.getMinutes());
  return pad(d.getDate())+'/'+pad(d.getMonth()+1)+' '+pad(d.getHours())+':'+pad(d.getMinutes());
}

// ═════════════════════════════════════════════════════════════════════════
//  ACTIONS — Tiếp nhận, Bắt đầu, Hoàn tất, Hủy
// ═════════════════════════════════════════════════════════════════════════
window.bgqlTiepNhan = async function(id){
  if (!confirm('Tiếp nhận sự vụ này?')) return;
  try {
    const { data, error } = await supa.rpc('fn_su_vu_tiep_nhan', {
      p_id: id, p_ma_nv: SESSION.ma, p_ten_nv: SESSION.ten||SESSION.hoTen, p_vai_tro: SESSION.vaiTro
    });
    if (error || (data && data.ok === false)) throw new Error((data&&data.error)||error.message);
    showToast('✓ Đã tiếp nhận', 'ok');
    bgqlLoadSuVu();
  } catch(e){ showToast('⚠ '+e.message, 'warn'); }
};
window.bgqlBatDau = async function(id){
  try {
    const { data, error } = await supa.rpc('fn_su_vu_bat_dau_xu_ly', {
      p_id: id, p_ma_nv: SESSION.ma, p_ten_nv: SESSION.ten||SESSION.hoTen, p_vai_tro: SESSION.vaiTro
    });
    if (error || (data && data.ok === false)) throw new Error((data&&data.error)||error.message);
    showToast('✓ Bắt đầu xử lý', 'ok');
    bgqlLoadSuVu();
  } catch(e){ showToast('⚠ '+e.message, 'warn'); }
};
window.bgqlHoanTat = async function(id){
  const note = prompt('Ghi chú đóng sự vụ (tùy chọn):', '');
  if (note === null) return;
  try {
    const { data, error } = await supa.rpc('fn_su_vu_dong', {
      p_id: id, p_ma_nv: SESSION.ma, p_ten_nv: SESSION.ten||SESSION.hoTen,
      p_vai_tro_dong: SESSION.vaiTro, p_ghi_chu: note || null
    });
    if (error || (data && data.ok === false)) throw new Error((data&&data.error)||error.message);
    showToast('✓ Đã đóng sự vụ', 'ok');
    bgqlLoadSuVu();
  } catch(e){ showToast('⚠ '+e.message, 'warn'); }
};
window.bgqlHuy = async function(id){
  const reason = prompt('Lý do hủy:', '');
  if (!reason || !reason.trim()) return;
  try {
    const { data, error } = await supa.rpc('fn_su_vu_huy', {
      p_id: id, p_ma_nv: SESSION.ma, p_ten_nv: SESSION.ten||SESSION.hoTen,
      p_vai_tro: SESSION.vaiTro, p_ly_do: reason.trim()
    });
    if (error || (data && data.ok === false)) throw new Error((data&&data.error)||error.message);
    showToast('✓ Đã hủy', 'ok');
    bgqlLoadSuVu();
  } catch(e){ showToast('⚠ '+e.message, 'warn'); }
};

// ═════════════════════════════════════════════════════════════════════════
//  MODAL PHẢN HỒI — deadline BẮT BUỘC
// ═════════════════════════════════════════════════════════════════════════
window.bgqlOpenPhanHoi = function(id){
  const sv = (bgqlSuVuCache || []).find(s => s.id === id);
  if (!sv) return;
  // Default deadline: 24h kể từ giờ, làm tròn 30 phút
  const now = new Date();
  const def = new Date(now.getTime() + 24*60*60*1000);
  def.setMinutes(Math.ceil(def.getMinutes()/30)*30, 0, 0);
  const defStr = def.getFullYear()+'-'+pad(def.getMonth()+1)+'-'+pad(def.getDate())+'T'+pad(def.getHours())+':'+pad(def.getMinutes());

  const m = document.createElement('div');
  m.className = 'bgql-modal-bg';
  m.innerHTML = `
    <div class="bgql-modal">
      <div class="bgql-modal-head">
        <div class="bgql-modal-ttl">Phản hồi sự vụ</div>
        <button class="bgql-modal-x" onclick="this.closest('.bgql-modal-bg').remove()">✕</button>
      </div>
      <div class="bgql-modal-body">
        <div class="bgql-modal-sv">
          <div style="font-weight:700;color:#0F172A;margin-bottom:4px">${escHtml(sv.tieu_de)}</div>
          <div style="font-size:12px;color:#64748B">${escHtml(sv.ten_ch_snapshot||sv.ma_ch||'')} · ${escHtml(sv.nguoi_tao_ten||'')}</div>
        </div>

        <label class="bgql-modal-label">Nội dung phản hồi <span style="color:#DC2626">*</span></label>
        <textarea id="bgql-ph-noidung" class="bgql-modal-input" rows="4"
          placeholder="Hướng xử lý cho cửa hàng / lệnh điều phối / tài liệu kèm theo...">${escHtml(sv.phan_hoi_xu_ly||'')}</textarea>

        <label class="bgql-modal-label">Deadline xử lý <span style="color:#DC2626">*</span></label>
        <input type="datetime-local" id="bgql-ph-deadline" class="bgql-modal-input bgql-modal-dl"
          value="${defStr}" step="900">
        <div style="font-size:11px;color:#64748B;margin-top:-4px;margin-bottom:14px">
          Toàn bộ NV của CH + tài khoản CH sẽ nhận thông báo kèm deadline này.
        </div>

        <div class="bgql-modal-act">
          <button class="bgql-act bgql-act-ghost" onclick="this.closest('.bgql-modal-bg').remove()">Hủy</button>
          <button class="bgql-act bgql-act-primary" id="bgql-ph-submit" onclick="bgqlSubmitPhanHoi('${id}')">Gửi phản hồi</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(m);
  setTimeout(()=>{ document.getElementById('bgql-ph-noidung').focus(); }, 50);
};

window.bgqlSubmitPhanHoi = async function(id){
  const noidung = document.getElementById('bgql-ph-noidung').value.trim();
  const dlStr = document.getElementById('bgql-ph-deadline').value;
  if (!noidung) { showToast('Nội dung phản hồi không được trống', 'warn'); return; }
  if (!dlStr) { showToast('Deadline xử lý là bắt buộc', 'warn'); return; }
  const dl = new Date(dlStr);
  if (isNaN(dl.getTime()) || dl < new Date()) { showToast('Deadline phải sau thời điểm hiện tại', 'warn'); return; }

  const btn = document.getElementById('bgql-ph-submit');
  btn.disabled = true; btn.textContent = 'Đang gửi...';
  try {
    const { data, error } = await supa.rpc('fn_su_vu_phan_hoi', {
      p_id: id,
      p_ma_nv: SESSION.ma, p_ten_nv: SESSION.ten||SESSION.hoTen||'', p_vai_tro: SESSION.vaiTro||'',
      p_noi_dung: noidung,
      p_deadline_xu_ly: dl.toISOString(),
      p_anh_urls: null
    });
    if (error || (data && data.ok === false)) throw new Error((data&&data.error)||error.message);
    showToast('✓ Đã gửi phản hồi · CH+NV sẽ nhận thông báo', 'ok');
    document.querySelector('.bgql-modal-bg').remove();
    bgqlLoadSuVu();
  } catch(e){
    btn.disabled = false; btn.textContent = 'Gửi phản hồi';
    showToast('⚠ '+e.message, 'warn');
  }
};

// ═════════════════════════════════════════════════════════════════════════
//  TAB 2: TIMELINE QL (cross-CH)
// ═════════════════════════════════════════════════════════════════════════
async function bgqlLoadTimeline(){
  const list = document.getElementById('bgql-timeline-list');
  list.innerHTML = bgqlRenderTimelineHeader() + '<div class="ns-empty">⏳ Đang tải...</div>';
  try {
    const { from, to } = bgqlTimelineGetRange();
    const { data, error } = await supa.rpc('fn_ban_giao_timeline_ql', {
      p_tu_ngay: from, p_den_ngay: to,
      p_ma_ch: bgqlTimelineFilter.ma_ch || null,
      p_khu_vuc: (bgqlTimelineFilter.khu_vuc && bgqlTimelineFilter.khu_vuc !== 'all') ? bgqlTimelineFilter.khu_vuc : null,
      p_limit: 500
    });
    if (error) throw error;
    bgqlTimelineCache = Array.isArray(data) ? data : [];
    bgqlRenderTimeline();
  } catch(e){
    list.innerHTML = bgqlRenderTimelineHeader() + 
      `<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message)}</div>`;
  }
}

// [v13.32] Refactor Timeline QL — 2 mode Đơn/Ảnh giống NV
let bgqlTLMode = 'don';      // 'don' | 'anh'
let bgqlTLRange = '7d';      // 'today' | '7d' | '30d' | 'custom'
let bgqlTLCustomFrom = null;
let bgqlTLCustomTo = null;
let bgqlTLCond = 'all';      // 'all' | 'binh_thuong' | 'co_su_vu' | 'KHAN_CAP'

function bgqlTimelineGetRange(){
  const today = new Date();
  const to = today.toISOString().slice(0,10);
  let from;
  if (bgqlTLRange === 'today') from = to;
  else if (bgqlTLRange === '7d') { const d = new Date(today); d.setDate(d.getDate()-7); from = d.toISOString().slice(0,10); }
  else if (bgqlTLRange === '30d') { const d = new Date(today); d.setDate(d.getDate()-30); from = d.toISOString().slice(0,10); }
  else if (bgqlTLRange === 'custom') {
    return { from: bgqlTLCustomFrom || to, to: bgqlTLCustomTo || to };
  }
  else from = to;
  return { from, to };
}

function bgqlRenderTimelineHeader(){
  const all = bgqlTimelineCache || [];
  const khuVucs = [...new Set(all.map(b => b.khu_vuc).filter(k=>k))].sort();
  const chList = [...new Map(all.map(b => [b.ma_ch, b.ten_ch_snapshot||b.ma_ch])).entries()];
  const tongDon = all.length;
  const tongAnh = all.reduce((s, b) => s + ((b.anh_urls && b.anh_urls.length) || 0), 0);
  
  return `
    <div class="bg-tl-mode-tabs">
      <button class="bg-tl-mode ${bgqlTLMode==='don'?'active':''}" onclick="bgqlSetTLMode('don')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Đơn <span class="bg-tl-mode-c">${tongDon}</span>
      </button>
      <button class="bg-tl-mode ${bgqlTLMode==='anh'?'active':''}" onclick="bgqlSetTLMode('anh')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Ảnh <span class="bg-tl-mode-c">${tongAnh}</span>
      </button>
    </div>
    <div class="bg-tl-filters-row">
      <select class="bg-tl-dropdown" onchange="bgqlSetTLRange(this.value)">
        <option value="today"${bgqlTLRange==='today'?' selected':''}>Hôm nay</option>
        <option value="7d"${bgqlTLRange==='7d'?' selected':''}>7 ngày qua</option>
        <option value="30d"${bgqlTLRange==='30d'?' selected':''}>30 ngày qua</option>
        <option value="custom"${bgqlTLRange==='custom'?' selected':''}>Tự chọn khoảng…</option>
      </select>
      <select class="bg-tl-dropdown" onchange="bgqlSetTLCond(this.value)">
        <option value="all"${bgqlTLCond==='all'?' selected':''}>Tình trạng: Tất cả</option>
        <option value="binh_thuong"${bgqlTLCond==='binh_thuong'?' selected':''}>Bình thường</option>
        <option value="co_su_vu"${bgqlTLCond==='co_su_vu'?' selected':''}>Có sự vụ</option>
        <option value="KHAN_CAP"${bgqlTLCond==='KHAN_CAP'?' selected':''}>Khẩn cấp</option>
      </select>
    </div>
    ${bgqlTLRange === 'custom' ? `<div class="bg-tl-filters-row">
      <input type="date" class="bg-tl-dropdown" value="${bgqlTLCustomFrom||''}" onchange="bgqlSetTLCustomFrom(this.value)">
      <input type="date" class="bg-tl-dropdown" value="${bgqlTLCustomTo||''}" onchange="bgqlSetTLCustomTo(this.value)">
    </div>` : ''}
    ${khuVucs.length>1 || chList.length>5 ? `<div class="bg-tl-filters-row">
      ${khuVucs.length>1 ? `<select class="bg-tl-dropdown" onchange="bgqlSetTLKV(this.value)">
        <option value="">Mọi khu vực</option>
        ${khuVucs.map(k=>`<option value="${escHtml(k)}"${bgqlTimelineFilter.khu_vuc===k?' selected':''}>${escHtml(k)}</option>`).join('')}
      </select>` : ''}
      ${chList.length>5 ? `<select class="bg-tl-dropdown" onchange="bgqlSetTLCh(this.value)">
        <option value="">Mọi cửa hàng</option>
        ${chList.map(([k,v])=>`<option value="${escHtml(k)}"${bgqlTimelineFilter.ma_ch===k?' selected':''}>${escHtml(v)}</option>`).join('')}
      </select>` : ''}
    </div>` : ''}
  `;
}

window.bgqlSetTLMode = function(m){ bgqlTLMode = m; bgqlRenderTimeline(); };
window.bgqlSetTLCond = function(c){ bgqlTLCond = c; bgqlRenderTimeline(); };
window.bgqlSetTLRange = function(r){ 
  bgqlTLRange = r; 
  if (r !== 'custom') bgqlLoadTimeline();
  else bgqlRenderTimeline();
};
window.bgqlSetTLCustomFrom = function(v){ bgqlTLCustomFrom = v; if (bgqlTLCustomTo) bgqlLoadTimeline(); };
window.bgqlSetTLCustomTo = function(v){ bgqlTLCustomTo = v; if (bgqlTLCustomFrom) bgqlLoadTimeline(); };
window.bgqlSetTLKV = function(v){ bgqlTimelineFilter.khu_vuc = v || 'all'; bgqlLoadTimeline(); };
window.bgqlSetTLCh = function(v){ bgqlTimelineFilter.ma_ch = v || null; bgqlLoadTimeline(); };

function bgqlRenderTimeline(){
  const list = document.getElementById('bgql-timeline-list');
  if (!list) return;
  let arr = (bgqlTimelineCache || []).slice();
  
  // Apply cond filter
  if (bgqlTLCond === 'binh_thuong') arr = arr.filter(b => (b.so_su_vu||0) === 0);
  else if (bgqlTLCond === 'co_su_vu') arr = arr.filter(b => (b.so_su_vu||0) > 0);
  else if (bgqlTLCond === 'KHAN_CAP') arr = arr.filter(b => (b.so_su_vu_khan||0) > 0);
  
  const header = bgqlRenderTimelineHeader();
  let bodyHtml;
  if (arr.length === 0) {
    bodyHtml = '<div class="ns-empty">Không có biên bản phù hợp.</div>';
  } else if (bgqlTLMode === 'anh') {
    bodyHtml = bgqlRenderTLAnh(arr.filter(b => b.anh_urls && b.anh_urls.length));
  } else {
    bodyHtml = bgqlRenderTLDon(arr);
  }
  list.innerHTML = header + bodyHtml;
}

function bgqlRenderTLDon(arr){
  if (arr.length === 0) return '<div class="ns-empty">Không có biên bản.</div>';
  // Group by ngày
  const byDay = {};
  arr.forEach(b => {
    if (!byDay[b.ngay_ban_giao]) byDay[b.ngay_ban_giao] = [];
    byDay[b.ngay_ban_giao].push(b);
  });
  const days = Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
  return days.map(d => `
    <div class="bg-tl-daysep">${bgqlFmtDayVN(d)} · ${byDay[d].length} biên bản</div>
    ${byDay[d].map(bgqlTLCardHtml).join('')}
  `).join('');
}

function bgqlTLCardHtml(b){
  const time = b.gio_ban_giao ? String(b.gio_ban_giao).slice(0,5) : '';
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
      ${show.map(url => `<div class="bg-tl-thumb" onclick="event.stopPropagation(); bgViewImage('${escHtml(url)}')"><img src="${escHtml(url)}" loading="lazy"></div>`).join('')}
      ${b.anh_urls.length > 3 ? `<div class="bg-tl-thumb bg-tl-thumb-more">+${b.anh_urls.length-3}</div>` : ''}
    </div>`;
  }

  return `<div class="bg-tl-card" onclick="bgOpenBanGiaoDetail('${b.id}')" style="border-left:4px solid ${accent}">
    <div class="bg-tl-head">
      <div class="bg-tl-time">${time}</div>
      <div class="bg-tl-by">${escHtml(b.ten_ch_snapshot||b.ma_ch)} · ${escHtml(b.nguoi_ban_giao_ten||'?')}</div>
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

function bgqlRenderTLAnh(arr){
  const items = [];
  arr.forEach(b => {
    if (!b.anh_urls) return;
    b.anh_urls.forEach(url => items.push({
      url, ban_giao_id: b.id, ngay: b.ngay_ban_giao,
      time: b.gio_ban_giao, by: b.nguoi_ban_giao_ten,
      ch: b.ten_ch_snapshot || b.ma_ch,
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
    <div class="bg-tl-daysep">${bgqlFmtDayVN(d)} · ${byDay[d].length} ảnh</div>
    <div class="bg-tl-anh-grid">
      ${byDay[d].map(it => `
        <div class="bg-tl-anh-cell${it.khan?' khan':''}" onclick="bgViewImage('${escHtml(it.url)}')">
          <img src="${escHtml(it.url)}" loading="lazy">
          <div class="bg-tl-anh-meta">${(it.time||'').slice(0,5)} · ${escHtml((it.ch||'').slice(0,18))}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}


// ═════════════════════════════════════════════════════════════════════════
//  [v13.30] TAB THỐNG KÊ — Interactive dashboard
//   - Bộ lọc đầy đủ: range ngày + khu vực + cửa hàng
//   - 3 cards compact 60% chiều cao, click → filter
//   - List CH với badge sự vụ
//   - Click CH → drawer chi tiết sự vụ
// ═════════════════════════════════════════════════════════════════════════
let bgqlStatsData = null;        // jsonb từ fn_bg_thong_ke_ch
let bgqlStatsKhuVuc = null;      // filter khu vực
let bgqlStatsMaCh = null;        // filter ma_ch
let bgqlStatsCardFilter = 'all'; // 'all' | 'da_gui' | 'chua_gui' | 'co_sv'
let bgqlStatsOpenedCh = null;    // ma_ch đang xem chi tiết sự vụ

async function bgqlLoadStats(){
  const cont = document.getElementById('bgql-stats-content');
  if (!cont) return;
  cont.innerHTML = bgqlRenderStatsTopBar() + '<div class="ns-empty">⏳ Đang tính...</div>';
  try {
    const { from, to } = bgqlRangeToDates(bgqlStatsRange);
    const { data, error } = await supa.rpc('fn_bg_thong_ke_ch', {
      p_tu_ngay: from, p_den_ngay: to,
      p_khu_vuc: bgqlStatsKhuVuc, p_ma_ch: bgqlStatsMaCh
    });
    if (error) throw error;
    bgqlStatsData = data || {};
    bgqlRenderStats();
  } catch(e){
    cont.innerHTML = bgqlRenderStatsTopBar() + 
      `<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message)}</div>`;
  }
}

function bgqlRangeToDates(r){
  const today = new Date();
  const to = today.toISOString().slice(0,10);
  let from;
  if (r === 'today') from = to;
  else if (r === 'week') { const d = new Date(today); d.setDate(d.getDate()-7); from = d.toISOString().slice(0,10); }
  else { const d = new Date(today); d.setDate(d.getDate()-30); from = d.toISOString().slice(0,10); }
  return { from, to };
}

function bgqlRenderStatsTopBar(){
  // Lấy khu_vuc + ma_ch distinct từ data hiện tại (nếu có)
  const ds = (bgqlStatsData && bgqlStatsData.ds_ch) || [];
  const khuVucs = [...new Set(ds.map(c => c.khu_vuc).filter(k=>k))].sort();
  const chList = ds.map(c => [c.ma_ch, c.ten_ch||c.ma_ch]);
  return `
    <div class="bgql-flt-row">
      <select class="bg-tl-dropdown" onchange="bgqlSetStatsRange(this.value)">
        <option value="today"${bgqlStatsRange==='today'?' selected':''}>Hôm nay</option>
        <option value="week"${bgqlStatsRange==='week'?' selected':''}>7 ngày qua</option>
        <option value="month"${bgqlStatsRange==='month'?' selected':''}>30 ngày qua</option>
      </select>
      ${khuVucs.length>1 ? `<select class="bg-tl-dropdown" onchange="bgqlSetStatsKV(this.value)">
        <option value="">Mọi khu vực</option>
        ${khuVucs.map(k=>`<option value="${escHtml(k)}"${bgqlStatsKhuVuc===k?' selected':''}>${escHtml(k)}</option>`).join('')}
      </select>` : ''}
    </div>
    ${chList.length>5 ? `<div class="bgql-flt-row">
      <select class="bg-tl-dropdown" onchange="bgqlSetStatsCh(this.value)">
        <option value="">Mọi cửa hàng</option>
        ${chList.map(([k,v])=>`<option value="${escHtml(k)}"${bgqlStatsMaCh===k?' selected':''}>${escHtml(v)}</option>`).join('')}
      </select>
    </div>` : ''}
  `;
}

window.bgqlSetStatsRange = function(r){ bgqlStatsRange = r; bgqlLoadStats(); };
window.bgqlSetStatsKV = function(v){ bgqlStatsKhuVuc = v || null; bgqlLoadStats(); };
window.bgqlSetStatsCh = function(v){ bgqlStatsMaCh = v || null; bgqlLoadStats(); };
window.bgqlSetStatsCard = function(c){ 
  bgqlStatsCardFilter = bgqlStatsCardFilter === c ? 'all' : c;
  bgqlStatsOpenedCh = null;
  bgqlRenderStats();
};
window.bgqlOpenChDetail = function(ma_ch){
  bgqlStatsOpenedCh = bgqlStatsOpenedCh === ma_ch ? null : ma_ch;
  bgqlRenderStats();
};

function bgqlRenderStats(){
  const cont = document.getElementById('bgql-stats-content');
  if (!cont || !bgqlStatsData) return;
  const tt = bgqlStatsData.tom_tat || {};
  const ds = bgqlStatsData.ds_ch || [];
  
  // Filter ds theo card đang chọn
  let dsFiltered = ds;
  if (bgqlStatsCardFilter === 'da_gui') dsFiltered = ds.filter(c => c.so_bg > 0);
  else if (bgqlStatsCardFilter === 'chua_gui') dsFiltered = ds.filter(c => c.so_bg === 0);
  else if (bgqlStatsCardFilter === 'co_sv') dsFiltered = ds.filter(c => c.so_su_vu > 0);

  cont.innerHTML = bgqlRenderStatsTopBar() + `
    <div class="bgql-stats-compact">
      <div class="bgql-stat-c ${bgqlStatsCardFilter==='da_gui'?'active':''} stat-ok" onclick="bgqlSetStatsCard('da_gui')">
        <div class="bgql-stat-c-v">${tt.da_gui||0}<span class="bgql-stat-c-vs">/${tt.tong_ch||0}</span></div>
        <div class="bgql-stat-c-l">Đã gửi</div>
      </div>
      <div class="bgql-stat-c ${bgqlStatsCardFilter==='chua_gui'?'active':''} stat-warn" onclick="bgqlSetStatsCard('chua_gui')">
        <div class="bgql-stat-c-v">${tt.chua_gui||0}</div>
        <div class="bgql-stat-c-l">Chưa gửi</div>
      </div>
      <div class="bgql-stat-c ${bgqlStatsCardFilter==='co_sv'?'active':''} stat-bad" onclick="bgqlSetStatsCard('co_sv')">
        <div class="bgql-stat-c-v">${tt.co_su_vu||0}</div>
        <div class="bgql-stat-c-l">Có sự vụ</div>
      </div>
    </div>
    <div class="bgql-stats-chlist">
      ${dsFiltered.length === 0 
        ? '<div class="ns-empty">Không có cửa hàng phù hợp.</div>'
        : dsFiltered.map(c => bgqlChRowHtml(c, c.ma_ch === bgqlStatsOpenedCh)).join('')
      }
    </div>
  `;
}

function bgqlChRowHtml(c, opened){
  const isChuaGui = c.so_bg === 0;
  const isKhan = c.so_su_vu_khan > 0;
  const hasSV = c.so_su_vu > 0;
  
  let statusBadge;
  if (isChuaGui) {
    statusBadge = '<span class="bgql-ch-badge bgql-ch-badge-warn">Chưa gửi</span>';
  } else if (isKhan) {
    statusBadge = `<span class="bgql-ch-badge bgql-ch-badge-khan">🔴 ${c.so_su_vu_khan} khẩn · ${c.so_su_vu} sự vụ</span>`;
  } else if (hasSV) {
    statusBadge = `<span class="bgql-ch-badge bgql-ch-badge-sv">${c.so_su_vu} sự vụ</span>`;
  } else {
    statusBadge = '<span class="bgql-ch-badge bgql-ch-badge-ok">✓ Bình thường</span>';
  }
  
  return `
    <div class="bgql-ch-row${opened?' opened':''}" onclick="bgqlOpenChDetail('${c.ma_ch}')">
      <div class="bgql-ch-row-head">
        <div class="bgql-ch-row-info">
          <div class="bgql-ch-row-name">${escHtml(c.ten_ch||c.ma_ch)}</div>
          <div class="bgql-ch-row-meta">${escHtml(c.ma_ch)}${c.khu_vuc?' · '+escHtml(c.khu_vuc):''}</div>
        </div>
        ${statusBadge}
        ${hasSV ? `<svg class="bgql-ch-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>` : ''}
      </div>
      ${opened && hasSV ? `<div class="bgql-ch-row-detail">
        ${(c.su_vu_ds||[]).map(sv => bgqlSvDetailHtml(sv)).join('')}
      </div>` : ''}
    </div>
  `;
}

function bgqlSvDetailHtml(sv){
  const mdMap = { 'KHAN_CAP':'🔴 Khẩn cấp', 'QUAN_TRONG':'⚠️ Quan trọng', 'CAN_THIET':'📋 Cần thiết' };
  const stMap = { 'MOI_TAO':'Mới tạo', 'DA_TIEP_NHAN':'Đã tiếp nhận', 'DANG_XU_LY':'Đang xử lý', 'HOAN_TAT':'Hoàn tất', 'HUY':'Đã hủy' };
  const mdClass = sv.muc_do === 'KHAN_CAP' ? 'khan' : sv.muc_do === 'QUAN_TRONG' ? 'qt' : 'ct';
  const t = sv.created_at ? new Date(sv.created_at).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
  return `
    <div class="bgql-sv-mini" onclick="event.stopPropagation(); bgqlOpenSuVuDetail('${sv.id}')" style="cursor:pointer">
      <div class="bgql-sv-mini-head">
        <span class="bgql-sv-mini-md ${mdClass}">${mdMap[sv.muc_do]||sv.muc_do}</span>
        <span class="bgql-sv-mini-st" data-st="${sv.trang_thai||''}">${stMap[sv.trang_thai]||sv.trang_thai}</span>
        <span class="bgql-sv-mini-time">${t}</span>
      </div>
      <div class="bgql-sv-mini-title">${escHtml(sv.tieu_de||'')}</div>
      ${sv.mo_ta ? `<div class="bgql-sv-mini-desc">${escHtml(sv.mo_ta)}</div>` : ''}
      ${sv.phan_hoi_xu_ly ? `<div class="bgql-sv-mini-reply"><b>QL phản hồi:</b> ${escHtml(sv.phan_hoi_xu_ly)}${sv.deadline_xu_ly?` · ⏰ ${new Date(sv.deadline_xu_ly).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:''}</div>` : ''}
    </div>
  `;
}

// Format VND (reuse từ NV view)
function bgFmtVN(n){ return (n||0).toLocaleString('vi-VN'); }


// ═════════════════════════════════════════════════════════════════════════
//  [v13.27] TAB IN ẤN — Gallery + Print biên bản giấy
//  Mỗi cửa hàng = 1 sheet 2 mặt (4 ảnh layout cố định)
//  Hoặc tùy chọn 1/2/4 ảnh per trang
// ═════════════════════════════════════════════════════════════════════════
let bgqlPrintCache = null;        // Map<ma_ch, {ten_ch, bg_list: [{id, ngay, time, by, anh_urls[]}]}>
let bgqlPrintRange = '7d';        // 'today' | '7d' | '30d' | 'custom'
let bgqlPrintCustomFrom = null;
let bgqlPrintCustomTo = null;
let bgqlPrintFilterKV = null;     // [v13.31] khu vực filter
let bgqlPrintFilterCH = null;     // [v13.31] CH filter
let bgqlPrintSelectedCH = new Set();  // CH đã tick chọn
let bgqlPrintLayout = '1';        // [v13.30] '1' default — 1 ảnh/trang, 2 mặt cố định

async function bgqlLoadPrint(){
  const cont = document.getElementById('bgql-print-content');
  cont.innerHTML = bgqlRenderPrintHeader() + '<div class="ns-empty">⏳ Đang tải biên bản...</div>';
  
  try {
    // Tính range ngày
    const { from, to } = bgqlPrintGetRange();
    
    // Fetch tất cả biên bản trong range (cross-CH, dùng RPC timeline_ql)
    const { data, error } = await supa.rpc('fn_ban_giao_timeline_ql', {
      p_tu_ngay: from, p_den_ngay: to,
      p_ma_ch: null, p_khu_vuc: null, p_limit: 1000
    });
    if (error) throw error;
    
    // Group theo CH
    const byCH = {};
    (data || []).forEach(bg => {
      if (!byCH[bg.ma_ch]) byCH[bg.ma_ch] = { 
        ma_ch: bg.ma_ch, ten_ch: bg.ten_ch_snapshot, khu_vuc: bg.khu_vuc,
        bg_list: [], total_anh: 0
      };
      const urls = bg.anh_urls || [];
      byCH[bg.ma_ch].bg_list.push({
        id: bg.id,
        ngay: bg.ngay_ban_giao,
        time: bg.gio_ban_giao,
        by: bg.nguoi_ban_giao_ten,
        anh_urls: urls,
        so_su_vu: bg.so_su_vu||0,
        so_khan: bg.so_su_vu_khan||0
      });
      byCH[bg.ma_ch].total_anh += urls.length;
    });
    
    bgqlPrintCache = byCH;
    bgqlRenderPrintList();
  } catch(e){
    cont.innerHTML = bgqlRenderPrintHeader() + 
      `<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message)}</div>`;
  }
}

function bgqlPrintGetRange(){
  const today = new Date();
  const to = today.toISOString().slice(0,10);
  let from;
  if (bgqlPrintRange === 'today') from = to;
  else if (bgqlPrintRange === '7d') { const d = new Date(today); d.setDate(d.getDate()-7); from = d.toISOString().slice(0,10); }
  else if (bgqlPrintRange === '30d') { const d = new Date(today); d.setDate(d.getDate()-30); from = d.toISOString().slice(0,10); }
  else if (bgqlPrintRange === 'custom') {
    // [v13.31] Custom range
    return { 
      from: bgqlPrintCustomFrom || to, 
      to: bgqlPrintCustomTo || to 
    };
  }
  else { from = to; }
  return { from, to };
}

function bgqlRenderPrintHeader(){
  // Lấy khu_vuc + ma_ch distinct từ cache (nếu đã load)
  const cache = bgqlPrintCache || {};
  const allCh = Object.values(cache);
  const khuVucs = [...new Set(allCh.map(c => c.khu_vuc).filter(k=>k))].sort();
  const chList = allCh.map(c => [c.ma_ch, c.ten_ch||c.ma_ch])
    .sort((a,b) => a[1].localeCompare(b[1], 'vi'));
  
  return `
    <div class="bgql-print-bar">
      <div class="bgql-print-bar-left">
        <select class="bg-tl-dropdown" onchange="bgqlPrintSetRange(this.value)">
          <option value="today"${bgqlPrintRange==='today'?' selected':''}>Hôm nay</option>
          <option value="7d"${bgqlPrintRange==='7d'?' selected':''}>7 ngày qua</option>
          <option value="30d"${bgqlPrintRange==='30d'?' selected':''}>30 ngày qua</option>
          <option value="custom"${bgqlPrintRange==='custom'?' selected':''}>Tự chọn khoảng…</option>
        </select>
        <select class="bg-tl-dropdown" onchange="bgqlPrintSetLayout(this.value)">
          <option value="1"${bgqlPrintLayout==='1'?' selected':''}>1 ảnh / trang (mặc định)</option>
          <option value="2"${bgqlPrintLayout==='2'?' selected':''}>2 ảnh / trang</option>
          <option value="4"${bgqlPrintLayout==='4'?' selected':''}>4 ảnh / trang</option>
        </select>
      </div>
      ${bgqlPrintRange === 'custom' ? `
      <div class="bgql-print-bar-left" style="margin-top:8px">
        <input type="date" class="bg-tl-dropdown" value="${bgqlPrintCustomFrom||''}" onchange="bgqlPrintSetCustomFrom(this.value)" placeholder="Từ ngày">
        <input type="date" class="bg-tl-dropdown" value="${bgqlPrintCustomTo||''}" onchange="bgqlPrintSetCustomTo(this.value)" placeholder="Đến ngày">
      </div>` : ''}
      ${khuVucs.length>1 || chList.length>1 ? `
      <div class="bgql-print-bar-left" style="margin-top:8px">
        ${khuVucs.length>1 ? `<select class="bg-tl-dropdown" onchange="bgqlPrintSetKV(this.value)">
          <option value="">Mọi khu vực</option>
          ${khuVucs.map(k=>`<option value="${escHtml(k)}"${bgqlPrintFilterKV===k?' selected':''}>${escHtml(k)}</option>`).join('')}
        </select>` : ''}
        ${chList.length>1 ? `<select class="bg-tl-dropdown" onchange="bgqlPrintSetCH(this.value)">
          <option value="">Mọi cửa hàng</option>
          ${chList.map(([k,v])=>`<option value="${escHtml(k)}"${bgqlPrintFilterCH===k?' selected':''}>${escHtml(v)}</option>`).join('')}
        </select>` : ''}
      </div>` : ''}
      <div class="bgql-print-bar-right" style="margin-top:8px">
        <button class="bgql-act bgql-act-ghost" onclick="bgqlPrintToggleAll()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Chọn tất cả
        </button>
        <button class="bgql-act bgql-act-primary" id="bgql-print-btn" onclick="bgqlDoPrint()" disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          In <span id="bgql-print-count" style="font-weight:800">0</span>
        </button>
      </div>
    </div>
  `;
}

window.bgqlPrintSetCustomFrom = function(v){ bgqlPrintCustomFrom = v; if (bgqlPrintCustomTo) bgqlLoadPrint(); };
window.bgqlPrintSetCustomTo = function(v){ bgqlPrintCustomTo = v; if (bgqlPrintCustomFrom) bgqlLoadPrint(); };
window.bgqlPrintSetKV = function(v){ 
  bgqlPrintFilterKV = v || null; 
  bgqlPrintSelectedCH.clear();
  bgqlRenderPrintList(); 
};
window.bgqlPrintSetCH = function(v){ 
  bgqlPrintFilterCH = v || null; 
  bgqlPrintSelectedCH.clear();
  bgqlRenderPrintList(); 
};

function bgqlRenderPrintList(){
  const cont = document.getElementById('bgql-print-content');
  const cache = bgqlPrintCache || {};
  // [v13.31] Apply filter KV + CH
  let arr = Object.values(cache);
  if (bgqlPrintFilterKV) arr = arr.filter(c => c.khu_vuc === bgqlPrintFilterKV);
  if (bgqlPrintFilterCH) arr = arr.filter(c => c.ma_ch === bgqlPrintFilterCH);
  
  if (arr.length === 0){
    cont.innerHTML = bgqlRenderPrintHeader() + 
      '<div class="ns-empty">Không có biên bản trong khoảng thời gian này.</div>';
    return;
  }
  
  // Sort by ten_ch
  arr.sort((a,b) => (a.ten_ch||'').localeCompare(b.ten_ch||'', 'vi'));
  
  cont.innerHTML = bgqlRenderPrintHeader() + `
    <div class="bgql-print-list">
      ${arr.map(ch => {
        const checked = bgqlPrintSelectedCH.has(ch.ma_ch);
        const previewImgs = [];
        ch.bg_list.forEach(bg => bg.anh_urls.forEach(u => previewImgs.push(u)));
        const showImgs = previewImgs.slice(0, 4);
        return `
          <div class="bgql-print-card${checked?' selected':''}" onclick="bgqlPrintToggleCH('${ch.ma_ch}')">
            <div class="bgql-print-card-check">
              <div class="bgql-print-checkbox${checked?' checked':''}">
                ${checked ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
              </div>
            </div>
            <div class="bgql-print-card-info">
              <div class="bgql-print-card-name">${escHtml(ch.ten_ch||ch.ma_ch)}</div>
              <div class="bgql-print-card-meta">${escHtml(ch.ma_ch)} · ${ch.bg_list.length} biên bản · ${ch.total_anh} ảnh</div>
            </div>
            <div class="bgql-print-card-thumbs">
              ${showImgs.map(u => `<div class="bgql-print-thumb"><img src="${u}" loading="lazy"></div>`).join('')}
              ${previewImgs.length > 4 ? `<div class="bgql-print-thumb bgql-print-thumb-more">+${previewImgs.length-4}</div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  bgqlPrintUpdateBtnState();
}

window.bgqlPrintSetRange = function(r){
  bgqlPrintRange = r;
  bgqlPrintCache = null;
  bgqlPrintSelectedCH.clear();
  bgqlLoadPrint();
};

window.bgqlPrintSetLayout = function(l){
  bgqlPrintLayout = l;
};

window.bgqlPrintToggleCH = function(ma_ch){
  if (bgqlPrintSelectedCH.has(ma_ch)) bgqlPrintSelectedCH.delete(ma_ch);
  else bgqlPrintSelectedCH.add(ma_ch);
  bgqlRenderPrintList();
};

window.bgqlPrintToggleAll = function(){
  const cache = bgqlPrintCache || {};
  const allMaCh = Object.keys(cache);
  if (bgqlPrintSelectedCH.size === allMaCh.length){
    bgqlPrintSelectedCH.clear();
  } else {
    allMaCh.forEach(m => bgqlPrintSelectedCH.add(m));
  }
  bgqlRenderPrintList();
};

function bgqlPrintUpdateBtnState(){
  const btn = document.getElementById('bgql-print-btn');
  const cnt = document.getElementById('bgql-print-count');
  if (!btn || !cnt) return;
  // Đếm tổng ảnh
  let totalAnh = 0;
  const cache = bgqlPrintCache || {};
  bgqlPrintSelectedCH.forEach(m => {
    if (cache[m]) totalAnh += cache[m].total_anh;
  });
  cnt.textContent = totalAnh;
  btn.disabled = totalAnh === 0;
  btn.style.opacity = totalAnh === 0 ? '.5' : '1';
}

// ─── DO PRINT — render print HTML letterhead + đợi ảnh load + window.print() ──
window.bgqlDoPrint = async function(){
  const cache = bgqlPrintCache || {};
  const layout = parseInt(bgqlPrintLayout, 10) || 1;
  
  const chList = Array.from(bgqlPrintSelectedCH)
    .map(m => cache[m])
    .filter(Boolean)
    .sort((a,b) => (a.ten_ch||'').localeCompare(b.ten_ch||'', 'vi'));
  
  if (chList.length === 0){ showToast('Vui lòng chọn ít nhất 1 cửa hàng', 'warn'); return; }
  
  const printRoot = document.getElementById('bgql-print-root') || (() => {
    const d = document.createElement('div');
    d.id = 'bgql-print-root';
    document.body.appendChild(d);
    return d;
  })();
  
  // Build pages
  const pages = [];
  chList.forEach(ch => {
    const allImgs = [];
    ch.bg_list.forEach(bg => {
      (bg.anh_urls || []).forEach(url => allImgs.push({ url, bg }));
    });
    if (allImgs.length === 0) return;
    for (let i = 0; i < allImgs.length; i += layout) {
      const pageImgs = allImgs.slice(i, i + layout);
      pages.push({ 
        ch, imgs: pageImgs, 
        pageNum: Math.floor(i/layout) + 1, 
        totalPages: Math.ceil(allImgs.length/layout) 
      });
    }
  });
  
  const printDateStr = new Date().toLocaleDateString('vi-VN', { 
    day:'2-digit', month:'2-digit', year:'numeric' 
  });
  
  printRoot.innerHTML = pages.map(p => `
    <div class="print-page print-layout-${layout}">
      <div class="print-header">
        <div class="print-header-l">
          <div class="print-ch-name">${escHtml(p.ch.ten_ch||p.ch.ma_ch)}</div>
          <div class="print-ch-sub">${escHtml(p.ch.ma_ch)} · Biên bản bàn giao ca</div>
        </div>
        <div class="print-header-r">
          <div>Ngày in: <b>${printDateStr}</b></div>
          <div>Trang <b>${p.pageNum}/${p.totalPages}</b></div>
        </div>
      </div>
      <div class="print-grid">
        ${p.imgs.map(({url, bg}) => `
          <div class="print-cell">
            <div class="print-cell-img"><img src="${escHtml(url)}" crossorigin="anonymous" loading="eager"></div>
            <div class="print-cell-meta">
              <b>${escHtml(bg.by||'—')}</b> · Lúc ${(bg.time||'').slice(0,5)} ngày ${bg.ngay}
              ${bg.so_su_vu>0?` · <b style="color:#9A3412">${bg.so_su_vu} sự vụ${bg.so_khan>0?` (${bg.so_khan} khẩn)`:''}</b>`:''}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="print-footer">
        <span>Nón Sơn · Hệ thống chấm công & bàn giao</span>
        <span>Cửa hàng: <b>${escHtml(p.ch.ma_ch)}</b></span>
      </div>
    </div>
  `).join('');
  
  // [v13.31] Wait for ALL images to load trước khi mở print dialog
  showToast('⏳ Đang chuẩn bị bản in...', 'info');
  const allImgEls = printRoot.querySelectorAll('img');
  await Promise.all(Array.from(allImgEls).map(img => {
    if (img.complete && img.naturalHeight > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });  // Resolve cả khi error để không stuck
      setTimeout(resolve, 5000);  // Timeout safety 5s/ảnh
    });
  }));
  
  document.body.classList.add('printing');
  // Đợi 1 frame để CSS apply
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.print();
  // Cleanup
  setTimeout(() => {
    document.body.classList.remove('printing');
    printRoot.innerHTML = '';  // Clear để tránh phình memory
  }, 1500);
};


// ═════════════════════════════════════════════════════════════════════════
//  [v13.28] TIỀN CHI — inner tab thứ 2 trong tab "Sự vụ" QL
//  RPC fn_bg_tien_chi_list — cross-CH, WHERE tien_chi > 0
// ═════════════════════════════════════════════════════════════════════════
async function bgqlLoadTienChi(){
  const list = document.getElementById('bgql-tienchi-list');
  if (!list) return;
  list.innerHTML = '<div class="ns-empty">⏳ Đang tải tiền chi...</div>';
  try {
    // Derive range từ bgqlSuVuFilter.range
    const today = new Date();
    const toStr = today.toISOString().slice(0,10);
    let fromStr;
    if (bgqlSuVuFilter.range === 'today') fromStr = toStr;
    else if (bgqlSuVuFilter.range === '30d') {
      const d = new Date(today); d.setDate(d.getDate()-30);
      fromStr = d.toISOString().slice(0,10);
    } else if (bgqlSuVuFilter.range === 'custom') {
      // [v13.31] Custom range
      if (!bgqlSuVuFilter.customFrom || !bgqlSuVuFilter.customTo) {
        // Chưa chọn ngày → return empty
        bgqlTienChiCache = [];
        bgqlRenderSuVuFilters();
        bgqlRenderTienChiList();
        return;
      }
      fromStr = bgqlSuVuFilter.customFrom;
    } else {
      const d = new Date(today); d.setDate(d.getDate()-7);
      fromStr = d.toISOString().slice(0,10);
    }
    const denStr = bgqlSuVuFilter.range === 'custom' ? (bgqlSuVuFilter.customTo || toStr) : toStr;
    const { data, error } = await supa.rpc('fn_bg_tien_chi_list', {
      p_tu_ngay: fromStr,
      p_den_ngay: denStr,
      p_ma_ch: bgqlSuVuFilter.ma_ch || null,
      p_khu_vuc: (bgqlSuVuFilter.khu_vuc && bgqlSuVuFilter.khu_vuc !== 'all') ? bgqlSuVuFilter.khu_vuc : null,
      p_limit: 200
    });
    if (error) throw error;
    bgqlTienChiCache = Array.isArray(data) ? data : [];
    bgqlRenderSuVuFilters();  // Refresh filters với cache mới
    bgqlRenderTienChiList();
  } catch(e){
    list.innerHTML = `<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message)}</div>`;
  }
}

function bgqlRenderTienChiList(){
  const list = document.getElementById('bgql-tienchi-list');
  if (!list) return;
  let arr = bgqlTienChiCache || [];
  // Client-side filter cho khu_vuc + ma_ch (RPC đã filter, đây là double-safe)
  if (bgqlSuVuFilter.khu_vuc && bgqlSuVuFilter.khu_vuc !== 'all') arr = arr.filter(t => t.khu_vuc === bgqlSuVuFilter.khu_vuc);
  if (bgqlSuVuFilter.ma_ch) arr = arr.filter(t => t.ma_ch === bgqlSuVuFilter.ma_ch);

  // Update badge inner tab Tiền chi
  const itabTC = document.getElementById('bgql-itab-tienchi-c');
  if (itabTC) {
    if (arr.length > 0) { itabTC.style.display = ''; itabTC.textContent = arr.length; }
    else itabTC.style.display = 'none';
  }

  if (arr.length === 0){
    list.innerHTML = '<div class="ns-empty">Không có khoản chi trong khoảng thời gian này.</div>';
    return;
  }
  // Tổng tiền chi
  const tongChi = arr.reduce((s, t) => s + (Number(t.tien_chi)||0), 0);

  const groupByDay = {};
  arr.forEach(t => {
    const d = t.ngay_ban_giao;
    if (!groupByDay[d]) groupByDay[d] = [];
    groupByDay[d].push(t);
  });
  const days = Object.keys(groupByDay).sort((a,b)=>b.localeCompare(a));

  list.innerHTML = `
    <div class="bgql-tc-summary">
      <div class="bgql-tc-summary-l">Tổng chi</div>
      <div class="bgql-tc-summary-v">${bgFmtVN(tongChi)}<span style="font-size:13px;font-weight:600;opacity:.7"> đ</span></div>
      <div class="bgql-tc-summary-s">${arr.length} khoản</div>
    </div>
    ${days.map(d => `
      <div class="bg-tl-daysep">${bgqlFmtDayVN(d)} · ${groupByDay[d].length} khoản</div>
      ${groupByDay[d].map(bgqlTienChiCardHtml).join('')}
    `).join('')}
  `;
}

function bgqlTienChiCardHtml(t){
  const time = t.gio_ban_giao ? String(t.gio_ban_giao).slice(0,5) : '';
  const tienChi = bgFmtVN(t.tien_chi || 0);
  const ghiChu = t.tien_chi_ghi_chu || '';
  return `
    <div class="bgql-tienchi-card" onclick="bgOpenBanGiaoDetail('${t.id}')">
      <div class="bgql-tc-head">
        <span class="bgql-tienchi-tag">CHI PHÍ</span>
        <div class="bgql-tc-ch">${escHtml(t.ten_ch_snapshot || t.ma_ch)}</div>
        <div class="bgql-tc-time">${time}</div>
      </div>
      <div class="bgql-tienchi-amount">
        ${tienChi}<span class="bgql-tc-amount-dvi">đ</span>
      </div>
      ${ghiChu ? `<div class="bgql-tc-note">${escHtml(ghiChu)}</div>` : '<div class="bgql-tc-note bgql-tc-note-empty">(không có ghi chú)</div>'}
      <div class="bgql-tc-foot">
        <span>${escHtml(t.nguoi_ban_giao_ten || '')}${t.nguoi_ban_giao_chuc_vu ? ' · ' + escHtml(t.nguoi_ban_giao_chuc_vu) : ''}</span>
        ${t.khu_vuc ? `<span class="bgql-tc-kv">${escHtml(t.khu_vuc)}</span>` : ''}
      </div>
    </div>
  `;
}


// ═════════════════════════════════════════════════════════════════════════
//  [v13.32] MODAL CHI TIẾT SỰ VỤ — universal drill-down
//   - Mở từ: Sự vụ list / Stats CH row sv-mini / Timeline (future)
//   - Hiển thị: header + timeline events + ảnh sự vụ + phản hồi + biên bản gốc
// ═════════════════════════════════════════════════════════════════════════
window.bgqlOpenSuVuDetail = async function(sv_id){
  const modal = document.getElementById('bgql-svd-modal');
  const body = document.getElementById('bgql-svd-body');
  if (!modal || !body) return;
  
  body.innerHTML = '<div class="ns-empty">⏳ Đang tải chi tiết...</div>';
  modal.style.display = '';
  document.body.style.overflow = 'hidden';
  
  try {
    const { data, error } = await supa.rpc('fn_su_vu_detail', { p_id: sv_id });
    if (error) throw error;
    if (!data || !data.ok) throw new Error((data && data.error) || 'Không tải được');
    bgqlRenderSuVuDetail(data);
  } catch(e){
    body.innerHTML = `<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message)}</div>`;
  }
};

window.bgqlCloseSuVuDetail = function(){
  const modal = document.getElementById('bgql-svd-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
};

function bgqlRenderSuVuDetail(d){
  const body = document.getElementById('bgql-svd-body');
  const sv = d.su_vu || {};
  const anhSv = d.anh_su_vu || [];
  const anhPh = d.anh_phan_hoi || [];
  const bg = d.bien_ban;
  const anhBg = d.anh_bien_ban || [];
  
  const mdMap = { 'KHAN_CAP':'🔴 Khẩn cấp', 'QUAN_TRONG':'⚠️ Quan trọng', 'CAN_THIET':'📋 Cần thiết' };
  const stMap = { 'MOI_TAO':'Mới tạo', 'DA_TIEP_NHAN':'Đã tiếp nhận', 'DANG_XU_LY':'Đang xử lý', 'HOAN_TAT':'Hoàn tất', 'HUY':'Đã hủy' };
  const loaiMap = {
    'TAI_SAN_KHONG_DAT':'Tài sản không đạt',
    'TIEN_LECH':'Tiền lệch',
    'HANG_HOA':'Hàng hóa',
    'KHAC':'Khác'
  };
  const mdClass = sv.muc_do === 'KHAN_CAP' ? 'khan' : sv.muc_do === 'QUAN_TRONG' ? 'qt' : 'ct';
  
  // Timeline events
  const events = [];
  if (sv.created_at) events.push({ type:'created', time:sv.created_at, label:'Tạo sự vụ', by:sv.nguoi_tao_ten, role:sv.nguoi_tao_chuc_vu });
  if (sv.thoi_gian_tiep_nhan) events.push({ type:'received', time:sv.thoi_gian_tiep_nhan, label:'Tiếp nhận', by:sv.nguoi_phu_trach_ten });
  if (sv.thoi_gian_bat_dau_xu_ly) events.push({ type:'processing', time:sv.thoi_gian_bat_dau_xu_ly, label:'Bắt đầu xử lý', by:sv.nguoi_phu_trach_ten });
  if (sv.thoi_gian_phan_hoi) events.push({ type:'reply', time:sv.thoi_gian_phan_hoi, label:'Phản hồi', by:sv.nguoi_phu_trach_ten });
  if (sv.thoi_gian_dong) events.push({ type:'closed', time:sv.thoi_gian_dong, label:'Đóng sự vụ', by:sv.nguoi_dong_ten, role:sv.nguoi_dong_vai_tro });
  
  const fmtT = t => t ? new Date(t).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
  const fmtD = t => t ? new Date(t).toLocaleDateString('vi-VN') : '';
  
  document.getElementById('bgql-svd-title').textContent = 'Chi tiết sự vụ';
  
  body.innerHTML = `
    <!-- HEADER -->
    <div class="bgql-svd-header">
      <div class="bgql-svd-tags">
        <span class="bgql-sv-mini-md ${mdClass}">${mdMap[sv.muc_do]||sv.muc_do}</span>
        <span class="bgql-sv-mini-st" data-st="${sv.trang_thai||''}">${stMap[sv.trang_thai]||sv.trang_thai}</span>
        ${sv.loai ? `<span class="bgql-svd-loai">${escHtml(loaiMap[sv.loai]||sv.loai)}</span>` : ''}
      </div>
      <div class="bgql-svd-tieude">${escHtml(sv.tieu_de||'(không có tiêu đề)')}</div>
      <div class="bgql-svd-ch">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${escHtml(sv.ten_ch_snapshot || sv.ma_ch)} · ${escHtml(sv.ma_ch)}
      </div>
    </div>

    <!-- TIMELINE EVENTS -->
    ${events.length > 0 ? `<div class="bgql-svd-section">
      <div class="bgql-svd-section-l">Diễn biến</div>
      <div class="bgql-svd-timeline">
        ${events.map((ev, i) => `
          <div class="bgql-svd-event bgql-svd-ev-${ev.type}">
            <div class="bgql-svd-ev-dot"></div>
            ${i < events.length - 1 ? '<div class="bgql-svd-ev-line"></div>' : ''}
            <div class="bgql-svd-ev-body">
              <div class="bgql-svd-ev-label">${ev.label}</div>
              <div class="bgql-svd-ev-time">${fmtT(ev.time)}${ev.by ? ` · ${escHtml(ev.by)}` : ''}${ev.role ? ` (${escHtml(ev.role)})` : ''}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <!-- MÔ TẢ + SỐ LIỆU -->
    ${sv.mo_ta ? `<div class="bgql-svd-section">
      <div class="bgql-svd-section-l">Mô tả</div>
      <div class="bgql-svd-mota">${escHtml(sv.mo_ta)}</div>
    </div>` : ''}
    ${sv.so_lieu && Object.keys(sv.so_lieu).length > 0 ? `<div class="bgql-svd-section">
      <div class="bgql-svd-section-l">Số liệu</div>
      <div class="bgql-svd-solieu">${Object.entries(sv.so_lieu).filter(([k,v])=>v!==null).map(([k,v])=>`<span><b>${escHtml(k)}:</b> ${escHtml(String(v))}</span>`).join(' · ')}</div>
    </div>` : ''}

    <!-- ẢNH SỰ VỤ -->
    ${anhSv.length > 0 ? `<div class="bgql-svd-section">
      <div class="bgql-svd-section-l">Ảnh đính kèm sự vụ · ${anhSv.length}</div>
      <div class="bgql-svd-gallery">
        ${anhSv.map(url => `<div class="bgql-svd-gal-cell" onclick="bgViewImage('${escHtml(url)}')"><img src="${escHtml(url)}" loading="lazy"></div>`).join('')}
      </div>
    </div>` : ''}

    <!-- PHẢN HỒI QL -->
    ${(sv.phan_hoi_xu_ly || anhPh.length > 0) ? `<div class="bgql-svd-section bgql-svd-reply">
      <div class="bgql-svd-section-l">Phản hồi từ QL</div>
      ${sv.phan_hoi_xu_ly ? `<div class="bgql-svd-reply-text">${escHtml(sv.phan_hoi_xu_ly)}</div>` : ''}
      ${sv.deadline_xu_ly ? `<div class="bgql-svd-reply-dl">⏰ Deadline: <b>${fmtT(sv.deadline_xu_ly)}</b></div>` : ''}
      ${sv.nguoi_phu_trach_ten ? `<div class="bgql-svd-reply-by">— ${escHtml(sv.nguoi_phu_trach_ten)}${sv.thoi_gian_phan_hoi ? ` · ${fmtT(sv.thoi_gian_phan_hoi)}` : ''}</div>` : ''}
      ${anhPh.length > 0 ? `<div class="bgql-svd-gallery" style="margin-top:8px">
        ${anhPh.map(url => `<div class="bgql-svd-gal-cell" onclick="bgViewImage('${escHtml(url)}')"><img src="${escHtml(url)}" loading="lazy"></div>`).join('')}
      </div>` : ''}
    </div>` : ''}

    <!-- ĐÓNG SỰ VỤ -->
    ${sv.trang_thai === 'HOAN_TAT' && sv.nguoi_dong_ten ? `<div class="bgql-svd-section bgql-svd-closed">
      <div class="bgql-svd-section-l">Đã đóng</div>
      <div class="bgql-svd-closed-by">${escHtml(sv.nguoi_dong_ten)}${sv.nguoi_dong_vai_tro ? ` (${escHtml(sv.nguoi_dong_vai_tro)})` : ''} · ${fmtT(sv.thoi_gian_dong)}</div>
      ${sv.ghi_chu_dong ? `<div class="bgql-svd-closed-note">${escHtml(sv.ghi_chu_dong)}</div>` : ''}
    </div>` : ''}

    <!-- BIÊN BẢN GỐC -->
    ${bg ? `<div class="bgql-svd-section bgql-svd-bg">
      <div class="bgql-svd-section-l">Biên bản gốc</div>
      <div class="bgql-svd-bg-card" onclick="bgqlCloseSuVuDetail(); bgOpenBanGiaoDetail('${bg.id}')">
        <div class="bgql-svd-bg-info">
          <div class="bgql-svd-bg-time">${(bg.gio_ban_giao||'').slice(0,5)} · ${bg.ngay_ban_giao}</div>
          <div class="bgql-svd-bg-by">Người gửi: <b>${escHtml(bg.nguoi_ban_giao_ten||'?')}</b></div>
          <div class="bgql-svd-bg-tien">Tổng tiền: <b>${bgFmtVN(bg.tien_tong||0)} đ</b></div>
        </div>
        ${anhBg.length > 0 ? `<div class="bgql-svd-bg-thumbs">
          ${anhBg.slice(0,3).map(url => `<div class="bgql-svd-bg-thumb"><img src="${escHtml(url)}" loading="lazy"></div>`).join('')}
          ${anhBg.length > 3 ? `<div class="bgql-svd-bg-thumb-more">+${anhBg.length-3}</div>` : ''}
        </div>` : ''}
        <div class="bgql-svd-bg-arrow">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </div>` : ''}
  `;
}
