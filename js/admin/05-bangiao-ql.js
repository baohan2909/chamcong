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
let bgqlSuVuCache = null;
let bgqlSuVuFilter = { trang_thai:'open', muc_do:'all', khu_vuc:'all', ma_ch:null };
let bgqlTimelineFilter = { content:'all', from:null, to:null, ma_ch:null, khu_vuc:'all' };
let bgqlTimelineCache = null;
let bgqlStatsRange = 'today'; // 'today' | 'week' | 'month' | 'custom'

// ═════════════════════════════════════════════════════════════════════════
//  ENTRY
// ═════════════════════════════════════════════════════════════════════════
function bgqlInitPage(){
  bgqlSub = 'suvu';
  bgqlSuVuCache = null;
  bgqlTimelineCache = null;
  bgqlSwitchSub('suvu');
}
window.bgqlInitPage = bgqlInitPage;

function bgqlSwitchSub(sub){
  bgqlSub = sub;
  ['suvu','timeline','stats'].forEach(s => {
    const tab = document.getElementById('bgql-subtab-'+s);
    const body = document.getElementById('bgql-sub-'+s);
    if (tab) tab.classList.toggle('active', s===sub);
    if (body) body.style.display = s===sub ? '' : 'none';
  });
  if (sub==='suvu') bgqlLoadSuVu();
  if (sub==='timeline') bgqlLoadTimeline();
  if (sub==='stats') bgqlLoadStats();
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
  const khan = all.filter(s => s.muc_do === 'KHAN_CAP' && !['HOAN_TAT','HUY'].includes(s.trang_thai));
  const closed = all.filter(s => ['HOAN_TAT','HUY'].includes(s.trang_thai));
  
  // Khu vực distinct
  const khuVucs = [...new Set(all.map(s => s.khu_vuc).filter(k=>k))].sort();
  // CH distinct
  const chList = [...new Map(all.map(s => [s.ma_ch, s.ten_ch_snapshot||s.ma_ch])).entries()];

  cont.innerHTML = `
    <div class="bg-tl-filters" style="padding:8px 2px 6px">
      <button class="bg-tl-chip ${bgqlSuVuFilter.trang_thai==='open'?'active':''}" onclick="bgqlSetFilter('trang_thai','open')">
        Đang xử lý <span class="bg-tl-chip-c">${open.length}</span>
      </button>
      <button class="bg-tl-chip ${bgqlSuVuFilter.muc_do==='KHAN_CAP'?'active':''}" onclick="bgqlSetFilter('muc_do','KHAN_CAP')">
        Khẩn cấp <span class="bg-tl-chip-c">${khan.length}</span>
      </button>
      <button class="bg-tl-chip ${bgqlSuVuFilter.trang_thai==='closed'?'active':''}" onclick="bgqlSetFilter('trang_thai','closed')">
        Đã đóng <span class="bg-tl-chip-c">${closed.length}</span>
      </button>
      <button class="bg-tl-chip ${bgqlSuVuFilter.trang_thai==='all' && bgqlSuVuFilter.muc_do==='all'?'active':''}" onclick="bgqlSetFilter('reset','all')">
        Tất cả <span class="bg-tl-chip-c">${all.length}</span>
      </button>
    </div>
    ${khuVucs.length || chList.length ? `
    <div class="bg-tl-filters" style="padding:0 2px 10px">
      ${khuVucs.length>1 ? `<select class="bgql-fselect" onchange="bgqlSetFilter('khu_vuc', this.value)">
        <option value="all"${bgqlSuVuFilter.khu_vuc==='all'?' selected':''}>Mọi khu vực</option>
        ${khuVucs.map(k=>`<option value="${escHtml(k)}"${bgqlSuVuFilter.khu_vuc===k?' selected':''}>${escHtml(k)}</option>`).join('')}
      </select>` : ''}
      ${chList.length>5 ? `<select class="bgql-fselect" onchange="bgqlSetFilter('ma_ch', this.value)">
        <option value="">Mọi cửa hàng</option>
        ${chList.map(([k,v])=>`<option value="${escHtml(k)}"${bgqlSuVuFilter.ma_ch===k?' selected':''}>${escHtml(v)}</option>`).join('')}
      </select>` : ''}
    </div>` : ''}
  `;
  // Update badges
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

window.bgqlSetFilter = function(k, v){
  if (k === 'reset') { bgqlSuVuFilter = { trang_thai:'all', muc_do:'all', khu_vuc:'all', ma_ch:null }; }
  else if (k === 'trang_thai') {
    bgqlSuVuFilter.trang_thai = bgqlSuVuFilter.trang_thai === v ? 'all' : v;
    if (bgqlSuVuFilter.trang_thai !== 'all') bgqlSuVuFilter.muc_do = 'all';
  } else if (k === 'muc_do') {
    bgqlSuVuFilter.muc_do = bgqlSuVuFilter.muc_do === v ? 'all' : v;
    if (bgqlSuVuFilter.muc_do !== 'all') bgqlSuVuFilter.trang_thai = 'all';
  } else if (k === 'khu_vuc') {
    bgqlSuVuFilter.khu_vuc = v || 'all';
  } else if (k === 'ma_ch') {
    bgqlSuVuFilter.ma_ch = v || null;
  }
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

  return `<div class="bgql-card" style="border-left:4px solid ${accent}">
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
    const { data, error } = await supa.rpc('fn_su_vu_bat_dau', {
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
    const { data, error } = await supa.rpc('fn_su_vu_hoan_tat', {
      p_id: id, p_ma_nv: SESSION.ma, p_ten_nv: SESSION.ten||SESSION.hoTen,
      p_vai_tro: SESSION.vaiTro, p_ghi_chu: note || null
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
  list.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
  try {
    // Mặc định 7 ngày gần nhất
    const today = new Date();
    const from = new Date(today); from.setDate(from.getDate()-7);
    const { data, error } = await supa.rpc('fn_ban_giao_timeline_ql', {
      p_tu_ngay: from.toISOString().slice(0,10),
      p_den_ngay: today.toISOString().slice(0,10),
      p_ma_ch: null, p_khu_vuc: null,
      p_limit: 200
    });
    if (error) throw error;
    bgqlTimelineCache = data || [];
    bgqlRenderTimeline();
  } catch(e){
    list.innerHTML = `<div class="ns-empty" style="color:#DC2626">RPC fn_ban_giao_timeline_ql chưa có (Sprint sau).<br><small>${escHtml(e.message)}</small></div>`;
  }
}

function bgqlRenderTimeline(){
  const list = document.getElementById('bgql-timeline-list');
  const arr = bgqlTimelineCache || [];
  if (arr.length === 0){
    list.innerHTML = '<div class="ns-empty">Chưa có biên bản trong 7 ngày gần đây.</div>';
    return;
  }
  // Group theo ngày
  const byDay = {};
  arr.forEach(b => {
    const d = b.ngay_ban_giao;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(b);
  });
  const days = Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
  list.innerHTML = days.map(d => `
    <div class="bg-tl-daysep">${bgqlFmtDayVN(d)} · ${byDay[d].length} biên bản</div>
    ${byDay[d].map(bgqlTimelineCardHtml).join('')}
  `).join('');
}

function bgqlTimelineCardHtml(b){
  const t = b.gio_ban_giao ? b.gio_ban_giao.slice(0,5) : '';
  const soSV = b.so_su_vu||0, soKhan = b.so_su_vu_khan||0, soAnh = b.so_anh||0;
  const accent = soKhan>0?'#DC2626':soSV>0?'#F97316':'#10B981';
  let thumbs = '';
  if (b.anh_urls && b.anh_urls.length){
    const show = b.anh_urls.slice(0, 3);
    thumbs = `<div class="bg-tl-thumbs">
      ${show.map(url => `<div class="bg-tl-thumb" onclick="event.stopPropagation();bgViewImage('${url}')"><img src="${url}" loading="lazy"></div>`).join('')}
      ${b.anh_urls.length>3?`<div class="bg-tl-thumb bg-tl-thumb-more">+${b.anh_urls.length-3}</div>`:''}
    </div>`;
  }
  return `<div class="bg-tl-card" style="border-left:4px solid ${accent}">
    <div class="bg-tl-head">
      <div class="bg-tl-time">${t}</div>
      <div class="bg-tl-by"><b>${escHtml(b.ten_ch_snapshot||b.ma_ch||'?')}</b> · ${escHtml(b.nguoi_ban_giao_ten||'')}</div>
      ${soKhan>0?`<div class="bg-tl-tag khan">${soKhan} khẩn</div>`:''}
    </div>
    <div class="bg-tl-metrics">
      <div class="bg-tl-metric"><div class="bg-tl-metric-v">${bgFmtVN(b.tien_tong||0)}<span style="font-size:11px;font-weight:600;opacity:.7"> đ</span></div><div class="bg-tl-metric-l">Tiền</div></div>
      <div class="bg-tl-metric"><div class="bg-tl-metric-v" style="${(b.so_item_khong_dat||0)>0?'color:#DC2626':''}">${b.so_item_khong_dat||0}</div><div class="bg-tl-metric-l">Không đạt</div></div>
      <div class="bg-tl-metric"><div class="bg-tl-metric-v" style="${soSV>0?'color:#F97316':''}">${soSV}</div><div class="bg-tl-metric-l">Sự vụ</div></div>
      <div class="bg-tl-metric"><div class="bg-tl-metric-v">${soAnh}</div><div class="bg-tl-metric-l">Ảnh</div></div>
    </div>
    ${thumbs}
  </div>`;
}

function bgqlFmtDayVN(d){
  if (!d) return '';
  const dt = new Date(d);
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  if (dt.getTime() === today.getTime()) return 'Hôm nay · ' + pad(dt.getDate()) + '/' + pad(dt.getMonth()+1);
  if (dt.getTime() === yesterday.getTime()) return 'Hôm qua · ' + pad(dt.getDate()) + '/' + pad(dt.getMonth()+1);
  return pad(dt.getDate()) + '/' + pad(dt.getMonth()+1) + '/' + dt.getFullYear();
}

// ═════════════════════════════════════════════════════════════════════════
//  TAB 3: THỐNG KÊ
// ═════════════════════════════════════════════════════════════════════════
async function bgqlLoadStats(){
  const cont = document.getElementById('bgql-stats-content');
  cont.innerHTML = `
    <div class="bgql-stats-rangepicker">
      ${[
        {k:'today', label:'Hôm nay'},
        {k:'week', label:'7 ngày'},
        {k:'month', label:'30 ngày'}
      ].map(r => `<button class="bg-tl-chip ${bgqlStatsRange===r.k?'active':''}" onclick="bgqlSetStatsRange('${r.k}')">${r.label}</button>`).join('')}
    </div>
    <div id="bgql-stats-cards"><div class="ns-empty">⏳ Đang tính...</div></div>
  `;
  try {
    const { from, to } = bgqlRangeToDates(bgqlStatsRange);
    const { data, error } = await supa.rpc('fn_ban_giao_thong_ke', {
      p_tu_ngay: from, p_den_ngay: to
    });
    if (error) throw error;
    bgqlRenderStatsCards(data || {}, from, to);
  } catch(e){
    document.getElementById('bgql-stats-cards').innerHTML = `<div class="ns-empty" style="color:#DC2626">RPC fn_ban_giao_thong_ke chưa có (Sprint sau).<br><small>${escHtml(e.message)}</small></div>`;
  }
}

window.bgqlSetStatsRange = function(r){ bgqlStatsRange = r; bgqlLoadStats(); };

function bgqlRangeToDates(r){
  const today = new Date();
  const to = today.toISOString().slice(0,10);
  let from;
  if (r === 'today') from = to;
  else if (r === 'week') { const d = new Date(today); d.setDate(d.getDate()-7); from = d.toISOString().slice(0,10); }
  else { const d = new Date(today); d.setDate(d.getDate()-30); from = d.toISOString().slice(0,10); }
  return { from, to };
}

function bgqlRenderStatsCards(stats, from, to){
  const tongCH = stats.tong_ch || 0;
  const daGui = stats.da_gui || 0;
  const chuaGui = stats.chua_gui || 0;
  const phatSinh = stats.phat_sinh_su_co || 0;
  const tongSV = stats.tong_su_vu || 0;
  const svKhan = stats.su_vu_khan || 0;
  const cont = document.getElementById('bgql-stats-cards');
  cont.innerHTML = `
    <div class="bgql-stats-grid">
      <div class="bgql-stat-card" style="background:linear-gradient(135deg,#047857,#10B981)">
        <div class="bgql-stat-icon">✓</div>
        <div class="bgql-stat-v">${daGui}<span class="bgql-stat-sub">/${tongCH}</span></div>
        <div class="bgql-stat-l">Cửa hàng đã gửi</div>
      </div>
      <div class="bgql-stat-card" style="background:linear-gradient(135deg,#92400E,#F59E0B)">
        <div class="bgql-stat-icon">⚠</div>
        <div class="bgql-stat-v">${chuaGui}</div>
        <div class="bgql-stat-l">Chưa gửi</div>
      </div>
      <div class="bgql-stat-card" style="background:linear-gradient(135deg,#991B1B,#DC2626)">
        <div class="bgql-stat-icon">🔴</div>
        <div class="bgql-stat-v">${phatSinh}</div>
        <div class="bgql-stat-l">CH phát sinh sự cố</div>
      </div>
    </div>
    <div class="bgql-stats-sub">
      <div class="bgql-stat-sub-row">
        <span>Tổng sự vụ phát sinh</span>
        <b>${tongSV}</b>
      </div>
      <div class="bgql-stat-sub-row" style="color:#DC2626">
        <span>Trong đó khẩn cấp</span>
        <b>${svKhan}</b>
      </div>
      <div class="bgql-stat-sub-row" style="color:#64748B;font-size:11px;font-weight:500">
        Khoảng: ${from} → ${to}
      </div>
    </div>
  `;
}

// Format VND (reuse từ NV view)
function bgFmtVN(n){ return (n||0).toLocaleString('vi-VN'); }
