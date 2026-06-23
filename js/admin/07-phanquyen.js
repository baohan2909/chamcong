/* ═══════════════════════════════════════════════════════════════════════
 *  [v16.72] PHÂN QUYỀN CÂY 3 CẤP (RBAC)
 *  Nhóm (thư mục) → Chức danh (cột M) → Nhân viên
 *   - Bấm Nhóm     → áp quyền xuống MỌI chức danh trong nhóm (sao chép xuống)
 *   - Bấm Chức danh→ quyền mặc định cho mọi NV của chức danh
 *   - Bấm Nhân viên→ quyền RIÊNG, đè lên chức danh
 *  Backend: fn_list_phan_quyen_tree / fn_list_nv_theo_chuc_danh /
 *           fn_save_quyen_chuc_danh / fn_save_quyen_ca_nhan / fn_ap_quyen_nhom /
 *           fn_nhom_luu / fn_nhom_doi_ten / fn_nhom_xoa / fn_gan_chuc_danh_nhom
 * ═══════════════════════════════════════════════════════════════════════ */

// ─── Danh mục quyền: phân hệ → các thao tác (GIỮ NGUYÊN) ───
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
    { id:'banhang.dashboard', ten:'Dashboard bán hàng' },
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
const PQ_MAP = (function(){ const m={}; PQ_GROUPS.forEach(g=>g.quyen.forEach(q=>{ m[q.id]={...q, nhom:g.id}; })); return m; })();
const PQ_ALL_IDS = Object.keys(PQ_MAP);

const PQ_PRESETS = {
  full:   { ten:'Toàn quyền', ids: PQ_ALL_IDS.slice() },
  xemall: { ten:'Chỉ xem', ids: PQ_ALL_IDS.filter(id => /\.(xem|xem_minh|xem_all)$/.test(id) || /tu_cham|giaodien\.dung|chuongtrinh\.xem/.test(id)) },
  nv:     { ten:'Nhân viên cơ bản', ids: PQ_ALL_IDS.filter(id => PQ_MAP[id].gd) },
};

const PQ_DEF_NV = ['chamcong.tu_cham','giocong.xem_minh','bando.xem','lichca.xem_minh',
                   'donnghi.tao','bangiao.ca','muanon.xem','chuongtrinh.xem','giaodien.dung'];
const PQ_DEFAULT = {
  ADMIN: PQ_ALL_IDS.slice(),
  QLNS:  ['nhansu.xem','nhansu.quanly','lichca.quanly','duyetyc.duyet','giocong.xem_all',
          'banhang.phien','banhang.dashboard','bangiao.quanly','muanon.xem','muanon.quanly'],
  QLBH:  ['banhang.phien','banhang.dashboard','bangiao.quanly','muanon.xem','muanon.quanly','donnghi.tao'],
  CUA_HANG: ['banhang.phien','banhang.dashboard','donhang.nhan','bangiao.ca','muanon.xem','muanon.quanly'],
  NV:  PQ_DEF_NV.slice(), CTV: PQ_DEF_NV.slice(), CHT: PQ_DEF_NV.slice(),
  TC:  PQ_DEF_NV.slice(), CĐ:  PQ_DEF_NV.slice(), TS:  PQ_DEF_NV.slice(), DH:  PQ_DEF_NV.slice(),
};
function pqDefaultFor(cd){
  if (PQ_DEFAULT[cd]) return PQ_DEFAULT[cd].slice();
  if (/^QLBH/.test(cd)) return PQ_DEFAULT.QLBH.slice();
  if (/^QL/.test(cd))   return PQ_DEFAULT.QLNS.slice();
  if (cd === 'ADMIN')   return PQ_ALL_IDS.slice();
  return PQ_DEF_NV.slice();
}

const PQ_SCOPES = [
  { id:'all',     ten:'Toàn hệ thống',          mo_ta:'Mọi khu vực, mọi cửa hàng',
    ic:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' },
  { id:'khuvuc',  ten:'Theo khu vực phụ trách', mo_ta:'Chỉ vùng mình quản lý',
    ic:'<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>' },
  { id:'cuahang', ten:'Theo cửa hàng',          mo_ta:'Cửa hàng mình + nhân sự trong đó',
    ic:'<path d="M3 9l1-5h16l1 5M5 9v11h14V9M9 20v-6h6v6"/>' },
  { id:'canhan',  ten:'Chỉ cá nhân',            mo_ta:'Chỉ thông tin của bản thân',
    ic:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' },
];
function pqDefaultScope(cd){
  if (cd === 'ADMIN' || cd === 'QLNS') return 'all';
  if (/^QLBH/.test(cd) || /^QL/.test(cd)) return 'khuvuc';
  if (cd === 'CHT') return 'cuahang';
  return 'canhan';
}

const PQ_KHU_VUC = ['Hồ Chí Minh','Hà Nội','Bắc Trung Bộ','Trung Tây Nguyên','Đông Nam Bộ','Tây Nam Bộ'];

const PQ_TEN_CD = {
  ADMIN:'Quản trị viên', QLNS:'Quản lý nhân sự', QLBH:'Quản lý bán hàng',
  QLBHMT:'QLBH Miền Trung', QLBHHNTB:'QLBH HN–TB', QLBHHN:'QLBH Hà Nội',
  NV:'Nhân viên', CTV:'Cộng tác viên', CHT:'Cửa hàng trưởng', TC:'Trưởng ca',
  CĐ:'Cơ động', TS:'Thai sản (nghỉ)', DH:'Dài hạn (nghỉ)',
};
function pqTenChucDanh(cd, tenLuu){ return tenLuu || PQ_TEN_CD[cd] || cd; }

// ═══════════════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════════════
let pqTree   = { nhom: [], chuc_danh: [] };  // từ fn_list_phan_quyen_tree
let pqNVCache = {};                          // chuc_danh -> [{ma_nv,ho_ten,loai,co_rieng}]
let pqExpNhom = {};                          // nhóm nào đang mở
let pqExpCD   = {};                          // chức danh nào đang mở (hiện NV)
let pqTreeSearch = '';                       // tìm trong cây

// Đối tượng đang phân quyền (panel bên phải)
let pqSel = { type:null, cd:null, nv:null, tenNV:null, nhom:null };
//   type: 'chuc_danh' | 'ca_nhan' | 'nhom' | null

// Trạng thái panel quyền (giữ từ bản cũ)
let pqTick   = new Set();
let pqScope  = 'canhan';
let pqKhuVuc = new Set();
let pqTenEdit = '';
let pqSearch = '';      // tìm trong danh mục quyền
let pqGroupOpen = {};
let pqDirty  = false;

// Tìm record chức danh trong cây
function pqFindCD(cd){ return pqTree.chuc_danh.find(x => x.chuc_danh === cd) || null; }
function pqDaCauHinh(cd){ const it = pqFindCD(cd); return !!(it && Array.isArray(it.quyen) && it.quyen.length > 0); }
function pqQuyenHienHuu(cd){
  const it = pqFindCD(cd);
  if (it && Array.isArray(it.quyen) && it.quyen.length) return it.quyen.slice();
  return pqDefaultFor(cd);
}
function pqScopeHienHuu(cd){
  const it = pqFindCD(cd);
  if (it && it.pham_vi) return it.pham_vi;
  return pqDefaultScope(cd);
}

// ═══════════════════════════════════════════════════════════════════════
//  KHỞI TẠO
// ═══════════════════════════════════════════════════════════════════════
async function pqInit(){
  const wrap = document.getElementById('pq-root');
  if (!wrap) return;
  wrap.innerHTML = '<div class="pq-loading">Đang tải cây phân quyền…</div>';
  try {
    const { data, error } = await supa.rpc('fn_list_phan_quyen_tree');
    if (error) throw error;
    pqTree = {
      nhom: Array.isArray(data && data.nhom) ? data.nhom : [],
      chuc_danh: Array.isArray(data && data.chuc_danh) ? data.chuc_danh : [],
    };
    pqNVCache = {}; pqExpNhom = {}; pqExpCD = {};
    pqSel = { type:null, cd:null, nv:null, tenNV:null, nhom:null };
    pqTick = new Set(); pqDirty = false;
    PQ_GROUPS.forEach(g => pqGroupOpen[g.id] = false);
    pqRender();
  } catch(e){
    wrap.innerHTML = '<div class="pq-err">Không tải được cây phân quyền. '+(e.message||e)+'<br><br>'
      + 'Kiểm tra đã chạy SQL Đợt 4 (hàm <b>fn_list_phan_quyen_tree</b>) chưa.</div>';
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════════════
function pqRender(){
  const wrap = document.getElementById('pq-root');
  if (!wrap) return;
  wrap.innerHTML =
    `<div class="pq-head">
       <div class="pq-head-title">Phân quyền</div>
       <div class="pq-head-sub">Cây: Nhóm → Chức danh → Nhân viên. Bấm một mục để phân quyền cho mục đó. Quyền áp dụng ở lần đăng nhập kế tiếp.</div>
     </div>
     <div class="pq-layout">
       <div class="pq-tree">${pqRenderTree()}</div>
       <div class="pq-panel-wrap">${pqSel.type ? pqRenderPanel() : pqRenderEmpty()}</div>
     </div>`;
  pqUpdateFooter();
}

// ─── CÂY ───
function pqRenderTree(){
  const kw = pqTreeSearch.trim().toLowerCase();
  // Gom chức danh theo nhóm
  const byNhom = {};            // tên nhóm -> [chuc_danh]
  const chuaNhom = [];
  pqTree.chuc_danh.forEach(cd => {
    if (kw && !((pqTenChucDanh(cd.chuc_danh, cd.ten_hien_thi)||'').toLowerCase().includes(kw)
                || (cd.chuc_danh||'').toLowerCase().includes(kw))) return;
    if (cd.nhom){ (byNhom[cd.nhom] = byNhom[cd.nhom] || []).push(cd); }
    else chuaNhom.push(cd);
  });

  let html = '';

  // Thanh tìm + nút tạo nhóm
  html += `<div class="pq-tree-bar">
      <div class="pq-tree-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="pq-tree-search-inp" type="text" placeholder="Tìm chức danh…" value="${pqTreeSearch.replace(/"/g,'&quot;')}" oninput="pqOnTreeSearch(this.value)">
      </div>
      <button class="pq-tree-add" onclick="pqTaoNhom()" title="Tạo nhóm mới">+ Nhóm</button>
    </div>`;

  // Các nhóm (theo thứ tự pqTree.nhom)
  pqTree.nhom.forEach(n => {
    const ds = byNhom[n.ten] || [];
    html += pqRenderNhomNode(n.ten, ds);
  });
  // Nhóm rỗng do tìm kiếm: nếu kw, chỉ hiện nhóm có chức danh khớp (đã lọc ở trên).

  // Chức danh chưa phân nhóm
  if (chuaNhom.length){
    html += `<div class="pq-tnode pq-tnode-nonhom">
        <div class="pq-tnode-head pq-nhom-head" onclick="pqToggleExpNhom('__none__')">
          <span class="pq-caret${pqExpNhom['__none__']?' open':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          <span class="pq-nhom-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v12H3z"/><path d="M3 7l2-3h6l2 3"/></svg></span>
          <span class="pq-nhom-ten">Chưa phân nhóm</span>
          <span class="pq-nhom-meta">${chuaNhom.length} chức danh</span>
        </div>
        <div class="pq-nhom-body${pqExpNhom['__none__']?' open':''}">
          ${chuaNhom.map(cd => pqRenderCDNode(cd)).join('')}
        </div>
      </div>`;
  }

  if (!pqTree.nhom.length && !chuaNhom.length && !Object.keys(byNhom).length){
    html += '<div class="pq-tree-empty">Không có chức danh nào khớp.</div>';
  }
  return html;
}

// Một nhóm
function pqRenderNhomNode(ten, dsChucDanh){
  const open = !!pqExpNhom[ten];
  const songuoi = dsChucDanh.reduce((s,c)=> s + (c.so_nguoi||0), 0);
  const selNhom = (pqSel.type === 'nhom' && pqSel.nhom === ten);
  return `<div class="pq-tnode pq-tnode-nhom${selNhom?' sel':''}">
      <div class="pq-tnode-head pq-nhom-head" onclick="pqToggleExpNhom('${pqEsc(ten)}')">
        <span class="pq-caret${open?' open':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        <span class="pq-nhom-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7l2 3h9v9H3z"/></svg></span>
        <span class="pq-nhom-ten">${pqEsc(ten)}</span>
        <span class="pq-nhom-meta">${dsChucDanh.length} chức danh · ${songuoi} người</span>
        <button class="pq-nhom-btn" onclick="event.stopPropagation(); pqChonNhom('${pqEsc(ten)}')" title="Áp quyền cả nhóm">Áp nhóm</button>
        <button class="pq-nhom-menu" onclick="event.stopPropagation(); pqMenuNhom('${pqEsc(ten)}')" title="Quản lý nhóm">⋯</button>
      </div>
      <div class="pq-nhom-body${open?' open':''}">
        ${dsChucDanh.length ? dsChucDanh.map(cd => pqRenderCDNode(cd)).join('')
                            : '<div class="pq-nhom-trong">Chưa có chức danh — bấm ⋯ để gán</div>'}
      </div>
    </div>`;
}

// Một chức danh
function pqRenderCDNode(cd){
  const ma = cd.chuc_danh;
  const sel = (pqSel.type === 'chuc_danh' && pqSel.cd === ma);
  const isAdmin = ma === 'ADMIN';
  const daCH = pqDaCauHinh(ma) || isAdmin;
  const open = !!pqExpCD[ma];
  const badge = isAdmin ? '<span class="pq-badge pq-badge-admin">full</span>'
                        : (daCH ? '<span class="pq-badge pq-badge-ok">✓ đã cấu hình</span>'
                                : '<span class="pq-badge pq-badge-no">⚠ chưa</span>');
  let nvHtml = '';
  if (open){
    const list = pqNVCache[ma];
    if (!list) nvHtml = '<div class="pq-nv-loading">Đang tải nhân viên…</div>';
    else if (!list.length) nvHtml = '<div class="pq-nv-trong">Không có nhân viên</div>';
    else nvHtml = list.map(nv => pqRenderNVNode(nv)).join('');
  }
  return `<div class="pq-tnode pq-tnode-cd${sel?' sel':''}">
      <div class="pq-tnode-head pq-cd-head">
        <span class="pq-caret pq-cd-caret${open?' open':''}" onclick="event.stopPropagation(); pqToggleExpCD('${pqEsc(ma)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        <span class="pq-cd-main" onclick="pqChonChucDanh('${pqEsc(ma)}')">
          <span class="pq-cd-ten">${pqEsc(pqTenChucDanh(ma, cd.ten_hien_thi))}</span>
          <span class="pq-cd-sub"><span class="pq-cd-ma">${pqEsc(ma)}</span> · ${cd.so_nguoi||0} người ${badge}</span>
        </span>
      </div>
      <div class="pq-cd-body${open?' open':''}">${nvHtml}</div>
    </div>`;
}

// Một nhân viên
function pqRenderNVNode(nv){
  const sel = (pqSel.type === 'ca_nhan' && pqSel.nv === nv.ma_nv);
  const rieng = nv.co_rieng
    ? '<span class="pq-nv-tag pq-nv-tag-rieng">★ Riêng</span>'
    : '<span class="pq-nv-tag pq-nv-tag-cd">Theo chức danh</span>';
  return `<div class="pq-nv-node${sel?' sel':''}" onclick="pqChonNV('${pqEsc(nv.ma_nv)}','${pqEsc((nv.ho_ten||'').replace(/'/g,'’'))}')">
      <span class="pq-nv-ava">${pqEsc((nv.ho_ten||'?').trim().charAt(0).toUpperCase())}</span>
      <span class="pq-nv-info">
        <span class="pq-nv-ten">${pqEsc(nv.ho_ten||nv.ma_nv)}</span>
        <span class="pq-nv-ma">${pqEsc(nv.ma_nv)}</span>
      </span>
      ${rieng}
    </div>`;
}

function pqRenderEmpty(){
  return `<div class="pq-pick">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
    <div>Chọn một mục trong cây bên trái để phân quyền:<br>· <b>Nhóm</b> → áp cho mọi chức danh trong nhóm<br>· <b>Chức danh</b> → mọi nhân viên của chức danh<br>· <b>Nhân viên</b> → phân quyền riêng cho người đó</div>
  </div>`;
}

// ─── PANEL QUYỀN ───
function pqRenderPanel(){
  // Banner theo loại đối tượng
  let banner = '';
  let adminTrong = false;
  if (pqSel.type === 'nhom'){
    const ds = pqTree.chuc_danh.filter(c => c.nhom === pqSel.nhom);
    banner = `<div class="pq-banner multi">
        <div class="pq-banner-l">
          <div class="pq-banner-ten">Áp quyền cả nhóm: ${pqEsc(pqSel.nhom)}</div>
          <div class="pq-banner-warn">Quyền bên dưới sẽ GHI ĐÈ toàn bộ ${ds.length} chức danh trong nhóm (sao chép xuống từng chức danh).</div>
        </div>
      </div>`;
  } else if (pqSel.type === 'ca_nhan'){
    const it = pqFindCD(pqSel.cd) || {};
    banner = `<div class="pq-banner">
        <div class="pq-banner-l">
          <div class="pq-banner-ten">Phân quyền riêng: ${pqEsc(pqSel.tenNV||pqSel.nv)} <span class="pq-banner-ma">${pqEsc(pqSel.nv)}</span></div>
          <div class="pq-banner-note">Quyền riêng sẽ <b>đè lên</b> quyền của chức danh ${pqEsc(pqTenChucDanh(pqSel.cd, it.ten_hien_thi))}. Bấm "Về theo chức danh" để gỡ.</div>
        </div>
      </div>`;
  } else { // chuc_danh
    const cd = pqSel.cd;
    adminTrong = cd === 'ADMIN';
    const it = pqFindCD(cd) || {};
    const dangMacDinh = !pqDaCauHinh(cd) && cd !== 'ADMIN';
    banner = `<div class="pq-banner">
        <div class="pq-banner-l">
          <div class="pq-banner-ten">Chức danh: ${pqEsc(pqTenChucDanh(cd, it.ten_hien_thi))} <span class="pq-banner-ma">${pqEsc(cd)}</span></div>
          ${adminTrong ? '<div class="pq-banner-warn">ADMIN luôn có toàn quyền — thay đổi ở đây không giới hạn ADMIN.</div>'
            : (dangMacDinh ? '<div class="pq-banner-note">Đang hiển thị <b>quyền mặc định theo hệ thống</b> (chưa lưu riêng). Chỉnh rồi bấm Lưu để áp dụng cho mọi nhân viên của chức danh.</div>'
                           : '<div class="pq-banner-note">Quyền áp cho mọi nhân viên của chức danh (trừ người đã đặt quyền riêng).</div>')}
        </div>
      </div>`;
  }

  const toolbar = `<div class="pq-toolbar">
      <div class="pq-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="pq-search-inp" type="text" placeholder="Tìm phân hệ / quyền…" value="${pqSearch.replace(/"/g,'&quot;')}" oninput="pqOnSearch(this.value)">
      </div>
      <div class="pq-tools">
        <button class="pq-tool" onclick="pqApplyPreset('full')">Toàn quyền</button>
        <button class="pq-tool" onclick="pqApplyPreset('xemall')">Chỉ xem</button>
        <button class="pq-tool pq-tool-ghost" onclick="pqClearAll()">Bỏ hết</button>
        ${pqSel.type==='ca_nhan' && (pqFindCD(pqSel.cd)) ? `<button class="pq-tool pq-tool-ghost" onclick="pqCopyTuChucDanh()">Lấy theo chức danh</button>` : ''}
      </div>
    </div>`;

  // Ô tên hiển thị — chỉ khi chỉnh CHỨC DANH (không phải ADMIN)
  const tenEditUI = (pqSel.type === 'chuc_danh' && pqSel.cd !== 'ADMIN') ? `<div class="pq-tenedit">
      <div class="pq-tenedit-head">Tên hiển thị <span>— mã cột M: <b>${pqEsc(pqSel.cd)}</b></span></div>
      <input id="pq-ten-inp" class="pq-tenedit-inp" type="text" value="${(pqTenEdit||'').replace(/"/g,'&quot;')}"
        placeholder="VD: Cơ động Sài Gòn" oninput="pqOnTenInput(this.value)">
    </div>` : '';

  const scopeUI = `<div class="pq-scope">
      <div class="pq-scope-head">Phạm vi dữ liệu <span>— được thấy dữ liệu của ai</span></div>
      <div class="pq-scope-opts">
        ${PQ_SCOPES.map(s => `<button class="pq-scope-opt${pqScope===s.id?' on':''}" onclick="pqSetScope('${s.id}')">
          <span class="pq-scope-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${s.ic}</svg></span>
          <span class="pq-scope-txt"><span class="pq-scope-ten">${s.ten}</span><span class="pq-scope-mt">${s.mo_ta}</span></span>
          <span class="pq-scope-radio"></span>
        </button>`).join('')}
      </div>
    </div>`;

  const kvUI = (pqScope === 'khuvuc') ? `<div class="pq-kv">
      <div class="pq-kv-head">Khu vực phụ trách <span>— chọn 1 hoặc nhiều</span></div>
      <div class="pq-kv-opts">
        ${PQ_KHU_VUC.map(kv => `<button type="button" class="pq-kv-opt${pqKhuVuc.has(kv)?' on':''}" onclick="pqToggleKhuVuc('${pqEsc(kv)}')">
          <span class="pq-kv-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
          <span class="pq-kv-ten">${kv}</span>
        </button>`).join('')}
      </div>
    </div>` : '';

  const quyenHead = `<div class="pq-quyen-head">Hạng mục quyền</div>`;
  const groups = PQ_GROUPS.map(g => pqRenderGroup(g)).filter(Boolean).join('');

  return banner + tenEditUI + scopeUI + kvUI + quyenHead + toolbar
    + `<div class="pq-groups">${groups || '<div class="pq-noresult">Không có quyền khớp tìm kiếm.</div>'}</div>`
    + pqFooterSpacer();
}

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
  const open = pqGroupOpen[g.id] || !!kw;

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
        <button class="pq-group-all${all?' on':''}" onclick="event.stopPropagation(); pqToggleNhomQuyen('${g.id}')">${all?'Bỏ nhóm':'Toàn quyền'}</button>
      </div>
      <div class="pq-group-body">${rows}</div>
    </div>`;
}

function pqFooterSpacer(){ return '<div style="height:76px"></div>'; }
function pqEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }

// ═══════════════════════════════════════════════════════════════════════
//  TƯƠNG TÁC — CÂY
// ═══════════════════════════════════════════════════════════════════════
function pqToggleExpNhom(ten){ pqExpNhom[ten] = !pqExpNhom[ten]; pqRender(); }

async function pqToggleExpCD(cd){
  pqExpCD[cd] = !pqExpCD[cd];
  if (pqExpCD[cd] && !pqNVCache[cd]){
    pqRender(); // hiện "Đang tải"
    await pqLoadNV(cd);
  }
  pqRender();
}

async function pqLoadNV(cd){
  try {
    const { data, error } = await supa.rpc('fn_list_nv_theo_chuc_danh', { p_chuc_danh: cd });
    pqNVCache[cd] = (!error && Array.isArray(data)) ? data : [];
  } catch(e){ pqNVCache[cd] = []; }
}

function pqOnTreeSearch(v){ pqTreeSearch = v; const tw = document.querySelector('.pq-tree'); if (tw){ tw.innerHTML = pqRenderTree(); const inp=document.getElementById('pq-tree-search-inp'); if(inp){inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length);} } else pqRender(); }

// Chọn CHỨC DANH để phân quyền
function pqChonChucDanh(cd){
  pqSel = { type:'chuc_danh', cd:cd, nv:null, tenNV:null, nhom:null };
  pqTick = new Set(pqQuyenHienHuu(cd));
  pqScope = pqScopeHienHuu(cd);
  const it = pqFindCD(cd) || {};
  pqTenEdit = it.ten_hien_thi || PQ_TEN_CD[cd] || '';
  pqKhuVuc = new Set(Array.isArray(it.khu_vuc_phu_trach) ? it.khu_vuc_phu_trach : []);
  pqDirty = false;
  pqRender();
}

// Chọn NHÓM để áp quyền hàng loạt
function pqChonNhom(ten){
  pqSel = { type:'nhom', cd:null, nv:null, tenNV:null, nhom:ten };
  // Gợi ý quyền: lấy từ chức danh đầu tiên trong nhóm đã cấu hình (nếu có), else rỗng
  const ds = pqTree.chuc_danh.filter(c => c.nhom === ten);
  const mau = ds.find(c => Array.isArray(c.quyen) && c.quyen.length);
  pqTick  = new Set(mau ? mau.quyen : []);
  pqScope = mau && mau.pham_vi ? mau.pham_vi : 'canhan';
  pqKhuVuc = new Set(mau && Array.isArray(mau.khu_vuc_phu_trach) ? mau.khu_vuc_phu_trach : []);
  pqTenEdit = '';
  pqDirty = false;
  pqRender();
}

// Chọn NHÂN VIÊN để phân quyền riêng
async function pqChonNV(ma, ten){
  // Tìm chức danh chứa NV (từ cache đang mở)
  let cd = null;
  for (const k in pqNVCache){ if ((pqNVCache[k]||[]).some(x => x.ma_nv === ma)){ cd = k; break; } }
  pqSel = { type:'ca_nhan', cd:cd, nv:ma, tenNV:ten, nhom:null };
  pqTenEdit = '';
  // Lấy quyền hiện hành của NV (cá nhân nếu có, else theo chức danh)
  try {
    const { data, error } = await supa.rpc('fn_get_quyen_user', { p_ma: ma });
    if (!error && data && data.success !== false){
      pqTick   = new Set(Array.isArray(data.quyen) ? data.quyen : []);
      pqScope  = data.pham_vi || (cd ? pqScopeHienHuu(cd) : 'canhan');
      pqKhuVuc = new Set(Array.isArray(data.khu_vuc_phu_trach) ? data.khu_vuc_phu_trach : []);
    } else {
      pqTick = new Set(cd ? pqQuyenHienHuu(cd) : []);
      pqScope = cd ? pqScopeHienHuu(cd) : 'canhan';
      pqKhuVuc = new Set();
    }
  } catch(e){
    pqTick = new Set(cd ? pqQuyenHienHuu(cd) : []);
    pqScope = cd ? pqScopeHienHuu(cd) : 'canhan';
    pqKhuVuc = new Set();
  }
  pqDirty = false;
  pqRender();
}

function pqCopyTuChucDanh(){
  if (pqSel.type !== 'ca_nhan' || !pqSel.cd) return;
  pqTick = new Set(pqQuyenHienHuu(pqSel.cd));
  pqScope = pqScopeHienHuu(pqSel.cd);
  const it = pqFindCD(pqSel.cd) || {};
  pqKhuVuc = new Set(Array.isArray(it.khu_vuc_phu_trach) ? it.khu_vuc_phu_trach : []);
  pqDirty = true; pqRender();
}

// ═══════════════════════════════════════════════════════════════════════
//  QUẢN LÝ NHÓM
// ═══════════════════════════════════════════════════════════════════════
function pqAdminMa(){ return (typeof SESSION!=='undefined'&&SESSION)?(SESSION.ma||SESSION.maNV||SESSION.ma_ql||''):''; }

async function pqTaoNhom(){
  const ten = (prompt('Tên nhóm mới (VD: Cơ động):','')||'').trim();
  if (!ten) return;
  try {
    const { data, error } = await supa.rpc('fn_nhom_luu', { p_admin: pqAdminMa(), p_ten: ten, p_thu_tu: pqTree.nhom.length });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã tạo nhóm "'+ten+'"','ok');
    await pqInit();
  } catch(e){ showToast('⚠ '+e.message,'warn'); }
}

async function pqMenuNhom(ten){
  const act = (prompt('Nhóm "'+ten+'": gõ 1=Đổi tên, 2=Xóa nhóm, 3=Gán chức danh vào nhóm','')||'').trim();
  if (act === '1'){
    const moi = (prompt('Tên mới cho nhóm:', ten)||'').trim();
    if (!moi || moi === ten) return;
    try {
      const { data, error } = await supa.rpc('fn_nhom_doi_ten', { p_admin: pqAdminMa(), p_ten_cu: ten, p_ten_moi: moi });
      if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
      showToast('Đã đổi tên nhóm','ok'); await pqInit();
    } catch(e){ showToast('⚠ '+e.message,'warn'); }
  } else if (act === '2'){
    if (!confirm('Xóa nhóm "'+ten+'"? Các chức danh trong nhóm sẽ về "Chưa phân nhóm" (không mất quyền).')) return;
    try {
      const { data, error } = await supa.rpc('fn_nhom_xoa', { p_admin: pqAdminMa(), p_ten: ten });
      if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
      showToast('Đã xóa nhóm','ok'); await pqInit();
    } catch(e){ showToast('⚠ '+e.message,'warn'); }
  } else if (act === '3'){
    await pqGanChucDanhVaoNhom(ten);
  }
}

async function pqGanChucDanhVaoNhom(ten){
  // Liệt kê chức danh chưa thuộc nhóm này
  const dsKhac = pqTree.chuc_danh.filter(c => c.nhom !== ten).map(c => c.chuc_danh);
  if (!dsKhac.length){ showToast('Không còn chức danh để gán','warn'); return; }
  const goiY = pqGoiYPrefix(ten);
  const hint = goiY.length ? '\n\nGợi ý theo ký tự đầu: ' + goiY.join(', ') : '';
  const ma = (prompt('Nhập MÃ chức danh để gán vào nhóm "'+ten+'":\n'+dsKhac.join(', ')+hint,'')||'').trim().toUpperCase();
  if (!ma) return;
  if (!dsKhac.includes(ma)){ showToast('Mã không hợp lệ','warn'); return; }
  try {
    const { data, error } = await supa.rpc('fn_gan_chuc_danh_nhom', { p_admin: pqAdminMa(), p_chuc_danh: ma, p_nhom: ten });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã gán '+ma+' vào nhóm '+ten,'ok'); await pqInit();
  } catch(e){ showToast('⚠ '+e.message,'warn'); }
}

// Gợi ý chức danh theo ký tự đầu của tên nhóm (Cơ động → mã bắt đầu 'C')
function pqGoiYPrefix(tenNhom){
  const ch = (tenNhom||'').trim().charAt(0).toUpperCase();
  if (!ch) return [];
  return pqTree.chuc_danh.filter(c => (c.chuc_danh||'').toUpperCase().startsWith(ch) && c.nhom !== tenNhom).map(c => c.chuc_danh);
}

// ═══════════════════════════════════════════════════════════════════════
//  TƯƠNG TÁC — PANEL QUYỀN (giữ từ bản cũ)
// ═══════════════════════════════════════════════════════════════════════
function pqSetScope(id){ pqScope = id; pqDirty = true; pqRender(); }
function pqOnTenInput(v){ pqTenEdit = v; pqDirty = true; pqUpdateFooter(); }
function pqToggleKhuVuc(kv){ if(pqKhuVuc.has(kv)) pqKhuVuc.delete(kv); else pqKhuVuc.add(kv); pqDirty = true; pqRender(); }

function pqToggleQuyen(id){
  if (pqTick.has(id)){
    pqTick.delete(id);
    PQ_ALL_IDS.forEach(other => {
      const o = PQ_MAP[other];
      if (o.can && o.can.includes(id) && pqTick.has(other)) pqTick.delete(other);
    });
  } else {
    pqTick.add(id);
    const q = PQ_MAP[id];
    if (q.can) q.can.forEach(dep => pqTick.add(dep));
  }
  pqDirty = true; pqRender();
}

function pqToggleNhomQuyen(gid){
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
  Array.from(pqTick).forEach(id => { const q=PQ_MAP[id]; if(q&&q.can) q.can.forEach(d=>pqTick.add(d)); });
  pqDirty = true; pqRender();
}
function pqClearAll(){ pqTick = new Set(); pqDirty = true; pqRender(); }

function pqOnSearch(v){
  pqSearch = v;
  const gw = document.querySelector('.pq-groups');
  if (gw){
    const groups = PQ_GROUPS.map(g => pqRenderGroup(g)).filter(Boolean).join('');
    gw.innerHTML = groups || '<div class="pq-noresult">Không có quyền khớp tìm kiếm.</div>';
  } else pqRender();
}

function pqUpdateFooter(){
  const f = document.getElementById('pq-footer');
  if (!f) return;
  if (!pqSel.type){ f.style.display = 'none'; return; }
  f.style.display = 'flex';
  const scopeTen = (PQ_SCOPES.find(s => s.id === pqScope) || {}).ten || '';
  let dich = '';
  if (pqSel.type === 'nhom'){
    const n = pqTree.chuc_danh.filter(c => c.nhom === pqSel.nhom).length;
    dich = 'áp cho <b>'+n+'</b> chức danh trong nhóm';
  } else if (pqSel.type === 'ca_nhan'){
    dich = 'riêng cho <b>'+pqEsc(pqSel.tenNV||pqSel.nv)+'</b>';
  } else {
    dich = 'cho chức danh <b>'+pqEsc(pqSel.cd)+'</b>';
  }
  const info = document.getElementById('pq-footer-info');
  if (info) info.innerHTML = `<b>${pqTick.size}</b> quyền · ${scopeTen} · ${dich}`;
  // Nút phụ "Về theo chức danh" (chỉ cá nhân đã có quyền riêng)
  const btn = document.getElementById('pq-footer-save');
  if (btn){ btn.disabled = false; btn.textContent = pqSel.type==='nhom' ? 'Áp cả nhóm' : 'Lưu phân quyền'; }
  const resetBtn = document.getElementById('pq-footer-reset');
  if (resetBtn){
    const nvRieng = pqSel.type==='ca_nhan' && (pqNVCache[pqSel.cd]||[]).some(x=>x.ma_nv===pqSel.nv && x.co_rieng);
    resetBtn.style.display = nvRieng ? '' : 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  LƯU
// ═══════════════════════════════════════════════════════════════════════
async function pqSave(){
  if (!pqSel.type) return;
  const btn = document.getElementById('pq-footer-save');
  const adminMa = pqAdminMa();
  const quyenArr = Array.from(pqTick);
  const khuVucArr = (pqScope === 'khuvuc') ? Array.from(pqKhuVuc) : [];
  if (btn){ btn.disabled = true; btn.textContent = 'Đang lưu…'; }
  try {
    if (pqSel.type === 'nhom'){
      const { data, error } = await supa.rpc('fn_ap_quyen_nhom', {
        p_admin: adminMa, p_nhom: pqSel.nhom, p_quyen: quyenArr, p_pham_vi: pqScope, p_khu_vuc: khuVucArr,
      });
      if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
      showToast('Đã áp quyền cho '+(data.so_chuc_danh||0)+' chức danh trong nhóm','ok');
      await pqInit();
      return;
    }
    if (pqSel.type === 'ca_nhan'){
      const { data, error } = await supa.rpc('fn_save_quyen_ca_nhan', {
        p_admin: adminMa, p_ma_nv: pqSel.nv, p_ten_nv: pqSel.tenNV||'', p_quyen: quyenArr,
        p_pham_vi: pqScope, p_khu_vuc: khuVucArr, p_reset: false,
      });
      if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
      showToast('Đã lưu quyền riêng cho '+(pqSel.tenNV||pqSel.nv),'ok');
      // cập nhật cờ co_rieng trong cache
      const arr = pqNVCache[pqSel.cd]; if (arr){ const it = arr.find(x=>x.ma_nv===pqSel.nv); if (it) it.co_rieng = true; }
      pqDirty = false; pqRender();
      return;
    }
    // chuc_danh
    const cd = pqSel.cd;
    if (cd === 'ADMIN'){ showToast('ADMIN luôn toàn quyền — không cần lưu','ok'); if(btn){btn.disabled=false;btn.textContent='Lưu phân quyền';} return; }
    const ten = pqTenEdit.trim() || pqTenChucDanh(cd, (pqFindCD(cd)||{}).ten_hien_thi);
    const { data, error } = await supa.rpc('fn_save_quyen_chuc_danh', {
      p_admin: adminMa, p_chuc_danh: cd, p_ten: ten, p_quyen: quyenArr,
      p_pham_vi: pqScope, p_khu_vuc: khuVucArr,
    });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã lưu quyền cho chức danh '+ten,'ok');
    // cập nhật cây tại chỗ
    const item = pqFindCD(cd);
    if (item){ item.quyen = quyenArr.slice(); item.pham_vi = pqScope; item.ten_hien_thi = ten; item.khu_vuc_phu_trach = khuVucArr.slice(); item.da_cau_hinh = quyenArr.length>0; }
    pqDirty = false; pqRender();
  } catch(e){
    showToast('⚠ Lưu lỗi: '+e.message,'warn');
    if (btn){ btn.disabled=false; btn.textContent = pqSel.type==='nhom'?'Áp cả nhóm':'Lưu phân quyền'; }
  }
}

// Gỡ quyền riêng → NV về theo chức danh
async function pqResetCaNhan(){
  if (pqSel.type !== 'ca_nhan') return;
  if (!confirm('Gỡ quyền riêng của '+(pqSel.tenNV||pqSel.nv)+'? Người này sẽ theo lại quyền chức danh.')) return;
  try {
    const { data, error } = await supa.rpc('fn_save_quyen_ca_nhan', {
      p_admin: pqAdminMa(), p_ma_nv: pqSel.nv, p_ten_nv: pqSel.tenNV||'', p_quyen: [], p_reset: true,
    });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã gỡ quyền riêng — về theo chức danh','ok');
    const arr = pqNVCache[pqSel.cd]; if (arr){ const it = arr.find(x=>x.ma_nv===pqSel.nv); if (it) it.co_rieng = false; }
    pqChonNV(pqSel.nv, pqSel.tenNV); // nạp lại theo chức danh
  } catch(e){ showToast('⚠ '+e.message,'warn'); }
}

// ─── Expose ───
window.pqInit = pqInit;
window.pqOnTreeSearch = pqOnTreeSearch;
window.pqToggleExpNhom = pqToggleExpNhom; window.pqToggleExpCD = pqToggleExpCD;
window.pqChonChucDanh = pqChonChucDanh; window.pqChonNhom = pqChonNhom; window.pqChonNV = pqChonNV;
window.pqTaoNhom = pqTaoNhom; window.pqMenuNhom = pqMenuNhom;
window.pqSetScope = pqSetScope; window.pqOnTenInput = pqOnTenInput; window.pqToggleKhuVuc = pqToggleKhuVuc;
window.pqToggleQuyen = pqToggleQuyen; window.pqToggleNhomQuyen = pqToggleNhomQuyen; window.pqToggleGroup = pqToggleGroup;
window.pqApplyPreset = pqApplyPreset; window.pqClearAll = pqClearAll; window.pqOnSearch = pqOnSearch;
window.pqCopyTuChucDanh = pqCopyTuChucDanh; window.pqSave = pqSave; window.pqResetCaNhan = pqResetCaNhan;
