/* ═══════════════════════════════════════════════════════════════════════
 *  [v15.4] PHÂN QUYỀN THEO CHỨC DANH (RBAC)
 *  - Chức danh hiệu dụng: role≠NV → role; role=NV → chuc_vu (trống='NV')
 *  - "Ai thuộc chức danh nào" = cột chuc_vu/role (đồng bộ từ Google Sheet)
 *  - "Chức danh được làm gì" = bảng chuc_danh_quyen (Supabase), tab này ghi
 *  - ADMIN luôn full quyền (không thể tự khóa)
 * ═══════════════════════════════════════════════════════════════════════ */

// ─── Danh mục quyền: phân hệ → các thao tác. Không sót phân hệ nào ───
// can: [...]  = phụ thuộc (bật quyền này thì tự bật các quyền trong can)
// gd : true   = quyền "gốc" (nền) — gợi ý nên có cho mọi nhân viên
const PQ_GROUPS = [
  { id:'chamcong', ten:'Chấm công & Giờ công', quyen:[
    { id:'chamcong.tu_cham', ten:'Tự chấm công', gd:true },
    { id:'giocong.xem_minh', ten:'Xem giờ công của mình', gd:true },
    { id:'giocong.xem_all',  ten:'Xem giờ công toàn hệ thống' },
    { id:'giocong.sua_lich', ten:'Sửa lịch chấm công', can:['giocong.xem_all'] },
    { id:'giocong.duyet_cb', ten:'Duyệt cảnh báo chấm công', can:['giocong.xem_all'] },
  ]},
  { id:'lichca', ten:'Lịch ca', quyen:[
    { id:'lichca.xem_minh', ten:'Xem lịch của mình', gd:true },
    { id:'lichca.quanly',   ten:'Quản lý lịch ca hệ thống' },
  ]},
  { id:'nhansu', ten:'Nhân sự', quyen:[
    { id:'nhansu.xem',       ten:'Xem nhân sự hôm nay' },
    { id:'nhansu.quanly',    ten:'Quản lý nhân viên (thêm / sửa / xóa)', can:['nhansu.xem'] },
    { id:'nhansu.phanquyen', ten:'Phân quyền (tab này)', can:['nhansu.xem'] },
    { id:'nhansu.chuyenma',  ten:'Chuyển đổi mã nhân viên', can:['nhansu.xem'] },
  ]},
  { id:'duyetyc', ten:'Nghỉ phép & Duyệt yêu cầu', quyen:[
    { id:'donnghi.tao',   ten:'Xin nghỉ / bổ sung ca', gd:true },
    { id:'duyetyc.duyet', ten:'Duyệt yêu cầu (nghỉ / đổi ca / bổ sung)' },
  ]},
  { id:'bangiao', ten:'Bàn giao', quyen:[
    { id:'bangiao.ca',     ten:'Bàn giao ca' },
    { id:'bangiao.quanly', ten:'Quản lý bàn giao (đối soát, sự vụ)' },
    { id:'bangiao.xoa',    ten:'Xóa sự vụ', can:['bangiao.quanly'] },
  ]},
  { id:'banhang', ten:'Bán hàng & Đơn hàng', quyen:[
    { id:'banhang.phien',     ten:'Phiên bán hàng' },
    { id:'banhang.dashboard', ten:'Dashboard doanh số' },
    { id:'donhang.nhan',      ten:'Nhận đơn về cửa hàng' },
    { id:'donhang.quanly',    ten:'Quản lý / điều phối đơn hàng' },
  ]},
  { id:'khuyenmai', ten:'Khuyến mãi & Mẫu nón', quyen:[
    { id:'chuongtrinh.xem', ten:'Xem chương trình khuyến mãi', gd:true },
    { id:'muanon.xem',      ten:'Xem mẫu nón hàng tuần' },
    { id:'muanon.quanly',   ten:'Quản lý mẫu nón', can:['muanon.xem'] },
  ]},
  { id:'congcu', ten:'Công cụ & AI', quyen:[
    { id:'nvai.dung',     ten:'Nhân viên AI' },
    { id:'bando.xem',     ten:'Bản đồ cửa hàng' },
    { id:'giaodien.dung', ten:'Giao diện cá nhân hóa', gd:true },
  ]},
  { id:'admin', ten:'Quản trị hệ thống', quyen:[
    { id:'admin.truycap',  ten:'Vào trang Admin' },
    { id:'admin.taikhoan', ten:'Quản lý tài khoản nhân sự', can:['admin.truycap'] },
    { id:'admin.caidat',   ten:'Cấu hình hệ thống', can:['admin.truycap'] },
  ]},
];

// Map id → quyền (tra nhanh phụ thuộc)
const PQ_MAP = (function(){ const m={}; PQ_GROUPS.forEach(g=>g.quyen.forEach(q=>{ m[q.id]={...q, nhom:g.id}; })); return m; })();
const PQ_ALL_IDS = Object.keys(PQ_MAP);

// Preset nhanh
const PQ_PRESETS = {
  full:   { ten:'Toàn quyền', ids: PQ_ALL_IDS.slice() },
  xemall: { ten:'Chỉ xem', ids: PQ_ALL_IDS.filter(id => /\.(xem|xem_minh|xem_all)$/.test(id) || /tu_cham|giaodien\.dung|chuongtrinh\.xem/.test(id)) },
  nv:     { ten:'Nhân viên cơ bản', ids: PQ_ALL_IDS.filter(id => PQ_MAP[id].gd) },
};

// ─── Quyền MẶC ĐỊNH = ánh xạ đúng phân quyền cứng đang chạy trong app ───
// Dùng khi một chức danh CHƯA được lưu quyền riêng → tab hiển thị sẵn để anh chỉnh.
const PQ_DEF_NV = ['chamcong.tu_cham','giocong.xem_minh','bando.xem','lichca.xem_minh',
                   'donnghi.tao','bangiao.ca','muanon.xem','chuongtrinh.xem','giaodien.dung'];
const PQ_DEFAULT = {
  ADMIN: PQ_ALL_IDS.slice(),
  QLNS:  ['nhansu.xem','nhansu.quanly','lichca.quanly','duyetyc.duyet','giocong.xem_all',
          'banhang.phien','banhang.dashboard','bangiao.quanly','muanon.xem','muanon.quanly'],
  QLBH:  ['banhang.phien','banhang.dashboard','bangiao.quanly','muanon.xem','muanon.quanly','donnghi.tao'],
  CUA_HANG: ['banhang.phien','banhang.dashboard','donhang.nhan','bangiao.ca','muanon.xem','muanon.quanly'],
  NV:  PQ_DEF_NV.slice(),
  CTV: PQ_DEF_NV.slice(),
  CHT: PQ_DEF_NV.slice(),  // hiện chung quyền NV — anh chỉnh để phân biệt
  TC:  PQ_DEF_NV.slice(),
  CĐ:  PQ_DEF_NV.slice(),
  TS:  PQ_DEF_NV.slice(),
  DH:  PQ_DEF_NV.slice(),
};
function pqDefaultFor(cd){
  if (PQ_DEFAULT[cd]) return PQ_DEFAULT[cd].slice();
  if (/^QLBH/.test(cd)) return PQ_DEFAULT.QLBH.slice();
  if (/^QL/.test(cd))   return PQ_DEFAULT.QLNS.slice();
  if (cd === 'ADMIN')   return PQ_ALL_IDS.slice();
  return PQ_DEF_NV.slice();
}
// Quyền hiệu dụng của 1 chức danh: đã lưu DB → dùng DB; chưa → mặc định hệ thống
function pqQuyenHienHuu(cd){
  const it = pqList.find(x => x.chuc_danh === cd);
  if (it && it.daLuu) return it.quyen.slice();
  return pqDefaultFor(cd);
}

// ─── Phạm vi dữ liệu (scope) — chiều "thấy của ai" ───
const PQ_SCOPES = [
  { id:'all',     ten:'Toàn hệ thống',           mo_ta:'Mọi khu vực, mọi cửa hàng',
    ic:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' },
  { id:'khuvuc',  ten:'Theo khu vực phụ trách',  mo_ta:'Chỉ vùng mình quản lý (lấy theo dữ liệu)',
    ic:'<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>' },
  { id:'cuahang', ten:'Theo cửa hàng',           mo_ta:'Cửa hàng mình + nhân sự trong đó',
    ic:'<path d="M3 9l1-5h16l1 5M5 9v11h14V9M9 20v-6h6v6"/>' },
  { id:'canhan',  ten:'Chỉ cá nhân',             mo_ta:'Chỉ thông tin của bản thân',
    ic:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' },
];
function pqDefaultScope(cd){
  if (cd === 'ADMIN' || cd === 'QLNS') return 'all';
  if (/^QLBH/.test(cd) || /^QL/.test(cd)) return 'khuvuc';
  if (cd === 'CHT') return 'cuahang';
  return 'canhan';
}
function pqScopeHienHuu(cd){
  const it = pqList.find(x => x.chuc_danh === cd);
  if (it && it.daLuu && it.pham_vi) return it.pham_vi;
  return pqDefaultScope(cd);
}

// ─── State ───
let pqList = [];            // [{chuc_danh, so_nguoi, ten_hien_thi, quyen[]}]
let pqChon = new Set();     // chức danh đang chọn để set
let pqTick = new Set();     // quyền đang tick (áp khi lưu)
let pqGroupOpen = {};       // nhóm nào đang mở
let pqSearch = '';
let pqDirty = false;        // có thay đổi chưa lưu
let pqScope = 'canhan';     // phạm vi dữ liệu đang chọn

// Tên hiển thị cho chức danh hệ thống
const PQ_TEN_CD = {
  ADMIN:'Quản trị viên', QLNS:'Quản lý nhân sự', QLBH:'Quản lý bán hàng',
  QLBHMT:'QLBH Miền Trung', QLBHHNTB:'QLBH HN–TB', QLBHHN:'QLBH Hà Nội',
  NV:'Nhân viên', CTV:'Cộng tác viên', CHT:'Cửa hàng trưởng', TC:'Trưởng ca',
  CĐ:'Cơ động', TS:'Thai sản (nghỉ)', DH:'Dài hạn (nghỉ)',
};
function pqTenChucDanh(cd, tenLuu){ return tenLuu || PQ_TEN_CD[cd] || cd; }

// ─── Khởi tạo khi mở tab ───
async function pqInit(){
  const wrap = document.getElementById('pq-root');
  if (!wrap) return;
  wrap.innerHTML = '<div class="pq-loading">Đang tải danh sách chức danh…</div>';
  try {
    const { data, error } = await supa.rpc('fn_list_chuc_danh');
    if (error) throw error;
    pqList = (Array.isArray(data) ? data : []).map(x => ({
      chuc_danh: x.chuc_danh,
      so_nguoi: x.so_nguoi || 0,
      ten_hien_thi: x.ten_hien_thi || '',
      quyen: Array.isArray(x.quyen) ? x.quyen : [],
      pham_vi: x.pham_vi || '',
      daLuu: Array.isArray(x.quyen) && x.quyen.length > 0,  // đã có quyền riêng trong DB
    }));
    pqChon = new Set(); pqTick = new Set(); pqDirty = false;
    PQ_GROUPS.forEach(g => pqGroupOpen[g.id] = false);
    pqRender();
  } catch(e){
    wrap.innerHTML = '<div class="pq-err">Không tải được danh sách. '+(e.message||e)+'<br><br>'
      + 'Kiểm tra đã chạy SQL tạo bảng <b>chuc_danh_quyen</b> và hàm <b>fn_list_chuc_danh</b> chưa.</div>';
  }
}

// ─── Render toàn bộ ───
function pqRender(){
  const wrap = document.getElementById('pq-root');
  if (!wrap) return;
  wrap.innerHTML =
    pqRenderChips() +
    (pqChon.size > 0 ? pqRenderPanel() : pqRenderEmpty());
  pqUpdateFooter();
}

// Hàng chip chức danh
function pqRenderChips(){
  const chips = pqList.map(cd => {
    const on = pqChon.has(cd.chuc_danh);
    const isAdmin = cd.chuc_danh === 'ADMIN';
    const meta = isAdmin ? 'full quyền' : (cd.daLuu ? (cd.quyen.length + ' quyền') : 'mặc định');
    return `<button class="pq-chip${on?' on':''}${isAdmin?' pq-chip-admin':''}${(!cd.daLuu&&!isAdmin)?' pq-chip-def':''}" onclick="pqToggleCD('${cd.chuc_danh}')">
      <span class="pq-chip-ten">${pqTenChucDanh(cd.chuc_danh, cd.ten_hien_thi)}</span>
      <span class="pq-chip-meta">${cd.so_nguoi} người · ${meta}</span>
    </button>`;
  }).join('');
  return `<div class="pq-head">
      <div class="pq-head-title">Phân quyền theo chức danh</div>
      <div class="pq-head-sub">Chọn một hoặc nhiều chức danh, đặt quyền rồi bấm Lưu. Quyền áp dụng ở lần đăng nhập kế tiếp của nhân viên.</div>
    </div>
    <div class="pq-chips">${chips || '<div class="pq-empty-chips">Chưa có chức danh nào trong dữ liệu.</div>'}</div>`;
}

function pqRenderEmpty(){
  return `<div class="pq-pick">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
    <div>Chọn chức danh phía trên để bắt đầu thiết lập quyền.</div>
  </div>`;
}

// Panel quyền
function pqRenderPanel(){
  const nhieu = pqChon.size > 1;
  const tenList = Array.from(pqChon).map(cd => pqTenChucDanh(cd, (pqList.find(x=>x.chuc_danh===cd)||{}).ten_hien_thi));
  const adminTrong = pqChon.has('ADMIN');
  const cdDon = pqChon.size===1 ? Array.from(pqChon)[0] : null;
  const dangMacDinh = cdDon && !(pqList.find(x=>x.chuc_danh===cdDon)||{}).daLuu && cdDon !== 'ADMIN';

  const banner = `<div class="pq-banner${nhieu?' multi':''}">
      <div class="pq-banner-l">
        <div class="pq-banner-ten">Đang thiết lập: ${tenList.join(', ')}</div>
        ${nhieu ? '<div class="pq-banner-warn">Quyền bên dưới sẽ GHI ĐÈ toàn bộ quyền của tất cả chức danh đã chọn.</div>'
                : (dangMacDinh ? '<div class="pq-banner-note">Đang hiển thị <b>quyền mặc định theo hệ thống</b> (chưa lưu riêng). Chỉnh lại rồi bấm Lưu để áp dụng.</div>'
                               : '<div class="pq-banner-note">Tick các quyền cần cấp cho chức danh này.</div>')}
        ${adminTrong ? '<div class="pq-banner-warn">ADMIN luôn có toàn quyền — thay đổi ở đây không giới hạn ADMIN.</div>' : ''}
      </div>
    </div>`;

  const toolbar = `<div class="pq-toolbar">
      <div class="pq-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="pq-search-inp" type="text" placeholder="Tìm phân hệ / quyền…" value="${pqSearch}" oninput="pqOnSearch(this.value)">
      </div>
      <div class="pq-tools">
        <button class="pq-tool" onclick="pqRestoreDefault()">Khôi phục mặc định</button>
        <button class="pq-tool" onclick="pqApplyPreset('full')">Toàn quyền</button>
        <button class="pq-tool" onclick="pqApplyPreset('xemall')">Chỉ xem</button>
        <button class="pq-tool pq-tool-ghost" onclick="pqClearAll()">Bỏ hết</button>
        ${pqCopyMenu()}
      </div>
    </div>`;

  const groups = PQ_GROUPS.map(g => pqRenderGroup(g)).filter(Boolean).join('');

  const scopeUI = `<div class="pq-scope">
      <div class="pq-scope-head">Phạm vi dữ liệu <span>— chức danh này được thấy dữ liệu của ai</span></div>
      <div class="pq-scope-opts">
        ${PQ_SCOPES.map(s => `<button class="pq-scope-opt${pqScope===s.id?' on':''}" onclick="pqSetScope('${s.id}')">
          <span class="pq-scope-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${s.ic}</svg></span>
          <span class="pq-scope-txt"><span class="pq-scope-ten">${s.ten}</span><span class="pq-scope-mt">${s.mo_ta}</span></span>
          <span class="pq-scope-radio"></span>
        </button>`).join('')}
      </div>
    </div>`;

  const quyenHead = `<div class="pq-quyen-head">Hạng mục quyền</div>`;

  return banner + scopeUI + quyenHead + toolbar
    + `<div class="pq-groups">${groups || '<div class="pq-noresult">Không có quyền khớp tìm kiếm.</div>'}</div>`
    + pqFooterSpacer();
}

// Menu sao chép từ chức danh khác
function pqCopyMenu(){
  const others = pqList.filter(c => !pqChon.has(c.chuc_danh) && c.chuc_danh !== 'ADMIN' && c.quyen.length);
  if (!others.length) return '';
  const opts = others.map(c => `<option value="${c.chuc_danh}">${pqTenChucDanh(c.chuc_danh, c.ten_hien_thi)} (${c.quyen.length})</option>`).join('');
  return `<select class="pq-copy" onchange="pqCopyFrom(this.value); this.selectedIndex=0;">
      <option value="">Sao chép từ…</option>${opts}
    </select>`;
}

// Một phân hệ (accordion)
function pqRenderGroup(g){
  const kw = pqSearch.trim().toLowerCase();
  let quyen = g.quyen;
  const groupMatch = kw && g.ten.toLowerCase().includes(kw);
  if (kw && !groupMatch) {
    quyen = g.quyen.filter(q => q.ten.toLowerCase().includes(kw) || q.id.includes(kw));
    if (!quyen.length) return '';
  }
  const tong = g.quyen.length;
  const co = g.quyen.filter(q => pqTick.has(q.id)).length;
  const all = co === tong;
  const open = pqGroupOpen[g.id] || !!kw;  // tìm kiếm thì mở hết

  const rows = quyen.map(q => {
    const on = pqTick.has(q.id);
    const dep = q.can ? `<span class="pq-dep" title="Tự bật khi cần: ${q.can.map(c=>PQ_MAP[c]?PQ_MAP[c].ten:c).join(', ')}">cần: ${q.can.map(c=>PQ_MAP[c]?PQ_MAP[c].ten:c).join(', ')}</span>` : '';
    return `<label class="pq-q${on?' on':''}">
        <span class="pq-check" onclick="event.preventDefault(); pqToggleQuyen('${q.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <span class="pq-q-ten" onclick="pqToggleQuyen('${q.id}')">${q.ten}${q.gd?'<span class="pq-gd">nền</span>':''}${dep}</span>
      </label>`;
  }).join('');

  return `<div class="pq-group${open?' open':''}">
      <div class="pq-group-head" onclick="pqToggleGroup('${g.id}')">
        <span class="pq-group-caret"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        <span class="pq-group-ten">${g.ten}</span>
        <span class="pq-group-count${co?' has':''}">${co}/${tong}</span>
        <button class="pq-group-all${all?' on':''}" onclick="event.stopPropagation(); pqToggleNhom('${g.id}')">${all?'Bỏ nhóm':'Toàn quyền'}</button>
      </div>
      <div class="pq-group-body">${rows}</div>
    </div>`;
}

function pqFooterSpacer(){ return '<div style="height:76px"></div>'; }

// ─── Tương tác ───
function pqToggleCD(cd){
  if (pqChon.has(cd)) pqChon.delete(cd); else pqChon.add(cd);
  // Nạp lại tick + phạm vi theo tập chọn
  if (pqChon.size === 1){
    const c = Array.from(pqChon)[0];
    pqTick = new Set(pqQuyenHienHuu(c));
    pqScope = pqScopeHienHuu(c);
  } else if (pqChon.size > 1){
    const sets = Array.from(pqChon).map(c => new Set(pqQuyenHienHuu(c)));
    pqTick = new Set(Array.from(sets[0]||[]).filter(id => sets.every(s => s.has(id))));
    pqScope = pqScopeHienHuu(Array.from(pqChon)[0]);  // gợi ý theo chức danh đầu
  } else {
    pqTick = new Set();
  }
  pqDirty = false;
  pqRender();
}

function pqSetScope(id){ pqScope = id; pqDirty = true; pqRender(); }

function pqToggleQuyen(id){
  if (pqTick.has(id)){
    pqTick.delete(id);
    // bỏ các quyền phụ thuộc vào id (nếu id là điều kiện của chúng)
    PQ_ALL_IDS.forEach(other => {
      const o = PQ_MAP[other];
      if (o.can && o.can.includes(id) && pqTick.has(other)) pqTick.delete(other);
    });
  } else {
    pqTick.add(id);
    // bật kèm phụ thuộc
    const q = PQ_MAP[id];
    if (q.can) q.can.forEach(dep => pqTick.add(dep));
  }
  pqDirty = true;
  pqRender();
}

function pqToggleNhom(gid){
  const g = PQ_GROUPS.find(x => x.id === gid); if (!g) return;
  const all = g.quyen.every(q => pqTick.has(q.id));
  if (all){ g.quyen.forEach(q => pqTick.delete(q.id)); }
  else { g.quyen.forEach(q => { pqTick.add(q.id); if (q.can) q.can.forEach(d=>pqTick.add(d)); }); }
  pqDirty = true; pqRender();
}

function pqToggleGroup(gid){ pqGroupOpen[gid] = !pqGroupOpen[gid]; pqRender(); }

function pqApplyPreset(key){
  const p = PQ_PRESETS[key]; if (!p) return;
  pqTick = new Set(p.ids);
  // đảm bảo phụ thuộc
  Array.from(pqTick).forEach(id => { const q=PQ_MAP[id]; if(q&&q.can) q.can.forEach(d=>pqTick.add(d)); });
  pqDirty = true; pqRender();
}
function pqClearAll(){ pqTick = new Set(); pqDirty = true; pqRender(); }

// Khôi phục về quyền mặc định của hệ thống (theo phân quyền cứng đang chạy)
function pqRestoreDefault(){
  if (pqChon.size === 1){
    pqTick = new Set(pqDefaultFor(Array.from(pqChon)[0]));
  } else if (pqChon.size > 1){
    const sets = Array.from(pqChon).map(c => new Set(pqDefaultFor(c)));
    pqTick = new Set(Array.from(sets[0]||[]).filter(id => sets.every(s => s.has(id))));
  }
  pqDirty = true; pqRender();
}

function pqCopyFrom(cd){
  if (!cd) return;
  const src = pqList.find(x => x.chuc_danh === cd); if (!src) return;
  pqTick = new Set(src.quyen);
  Array.from(pqTick).forEach(id => { const q=PQ_MAP[id]; if(q&&q.can) q.can.forEach(d=>pqTick.add(d)); });
  pqDirty = true; pqRender();
}

function pqOnSearch(v){
  pqSearch = v;
  // chỉ re-render phần groups để giữ focus ô tìm
  const gw = document.querySelector('.pq-groups');
  if (gw){
    const groups = PQ_GROUPS.map(g => pqRenderGroup(g)).filter(Boolean).join('');
    gw.innerHTML = groups || '<div class="pq-noresult">Không có quyền khớp tìm kiếm.</div>';
  } else pqRender();
}

function pqUpdateFooter(){
  const f = document.getElementById('pq-footer');
  if (!f) return;
  if (pqChon.size === 0){ f.style.display = 'none'; return; }
  f.style.display = 'flex';
  const n = pqChon.size;
  const scopeTen = (PQ_SCOPES.find(s => s.id === pqScope) || {}).ten || '';
  document.getElementById('pq-footer-info').innerHTML =
    `<b>${pqTick.size}</b> quyền · ${scopeTen} · áp cho <b>${n}</b> chức danh`;
  const btn = document.getElementById('pq-footer-save');
  btn.disabled = false;
}

// ─── Lưu ───
async function pqSave(){
  if (pqChon.size === 0) return;
  const btn = document.getElementById('pq-footer-save');
  const adminMa = (typeof SESSION !== 'undefined' && SESSION) ? (SESSION.ma || SESSION.maNV || SESSION.ma_ql) : '';
  const quyenArr = Array.from(pqTick);
  btn.disabled = true; btn.textContent = 'Đang lưu…';
  let ok = 0, fail = [];
  for (const cd of pqChon){
    if (cd === 'ADMIN'){ ok++; continue; } // ADMIN full, bỏ qua
    try {
      const ten = pqTenChucDanh(cd, (pqList.find(x=>x.chuc_danh===cd)||{}).ten_hien_thi);
      const { data, error } = await supa.rpc('fn_save_quyen_chuc_danh', {
        p_admin: adminMa, p_chuc_danh: cd, p_ten: ten, p_quyen: quyenArr, p_pham_vi: pqScope,
      });
      if (error || (data && data.success === false)) { fail.push(cd); }
      else {
        ok++;
        const item = pqList.find(x => x.chuc_danh === cd);
        if (item) { item.quyen = quyenArr.slice(); item.pham_vi = pqScope; item.daLuu = true; }
      }
    } catch(e){ fail.push(cd); }
  }
  btn.textContent = 'Lưu phân quyền';
  pqDirty = false;
  if (fail.length){
    showToast('Lưu xong '+ok+', lỗi '+fail.length+': '+fail.join(', '), 'warn');
  } else {
    showToast('Đã lưu quyền cho '+ok+' chức danh', 'ok');
  }
  pqRender();
}

// Mở tab => init (gọi từ adm2SwitchTab)
window.pqInit = pqInit;
