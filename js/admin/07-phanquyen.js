/* ═══════════════════════════════════════════════════════════════════════
 *  [v16.73] PHÂN QUYỀN — CÂY NHÓM LINH HOẠT + CHỌN NHIỀU + AUTOCOMPLETE
 *  Nhóm (chứa chức danh + cá nhân) → tích chọn nhiều mục → áp quyền 1 lần
 *  Chức danh = MÃ cột M. Tên do anh đặt ở cấp nhóm.
 *  Backend: fn_pq_tree / fn_pq_tim / fn_pq_them_thanh_vien / fn_pq_xoa_thanh_vien /
 *           fn_pq_ap_nhieu / fn_nhom_luu / fn_nhom_doi_ten / fn_nhom_xoa /
 *           fn_get_quyen_user / fn_list_nv_theo_chuc_danh
 * ═══════════════════════════════════════════════════════════════════════ */

// ─── Danh mục quyền (GIỮ NGUYÊN) ───
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
};
const PQ_DEF_NV = ['chamcong.tu_cham','giocong.xem_minh','bando.xem','lichca.xem_minh',
                   'donnghi.tao','bangiao.ca','muanon.xem','chuongtrinh.xem','giaodien.dung'];
const PQ_DEFAULT = {
  ADMIN: PQ_ALL_IDS.slice(),
  QLNS:  ['nhansu.xem','nhansu.quanly','lichca.quanly','duyetyc.duyet','giocong.xem_all',
          'banhang.phien','banhang.dashboard','bangiao.quanly','muanon.xem','muanon.quanly'],
  QLBH:  ['banhang.phien','banhang.dashboard','bangiao.quanly','muanon.xem','muanon.quanly','donnghi.tao'],
  CUA_HANG: ['banhang.phien','banhang.dashboard','donhang.nhan','bangiao.ca','muanon.xem','muanon.quanly'],
  NV:  PQ_DEF_NV.slice(), CTV: PQ_DEF_NV.slice(),
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
  return 'canhan';
}
const PQ_KHU_VUC = ['Hồ Chí Minh','Hà Nội','Bắc Trung Bộ','Trung Tây Nguyên','Đông Nam Bộ','Tây Nam Bộ'];

// ═══════════════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════════════
let pqTree = { nhom:[], chuc_danh_tu_do:[] };
let pqNVCache = {};            // chuc_danh -> [{ma_nv,ho_ten,loai,co_rieng}]
let pqGio = [];               // [{loai:'chuc_danh'|'ca_nhan', ma, ten}] đã tích chọn
let pqExpNhom = {};
let pqExpCD = {};
let pqTreeSearch = '';

// inline editors
let pqAddingNhom = false;      // đang tạo nhóm
let pqRenameNhom = null;       // tên nhóm đang đổi tên
let pqAddTvNhom = null;        // nhóm đang mở ô thêm thành viên
let pqTimKq = { chuc_danh:[], nhan_su:[] };  // kết quả autocomplete

// panel quyền
let pqShowPanel = false;
let pqTick = new Set();
let pqScope = 'canhan';
let pqKhuVuc = new Set();
let pqTenEdit = '';           // đổi tên hiển thị (khi giỏ đúng 1 chức danh)
let pqGroupOpen = {};
let pqSearch = '';

// ─── helpers ───
function pqEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }
function pqAdminMa(){ return (typeof SESSION!=='undefined'&&SESSION)?(SESSION.ma||SESSION.maNV||SESSION.ma_ql||''):''; }
function pqGioKey(loai,ma){ return loai+'::'+ma; }
function pqInGio(loai,ma){ return pqGio.some(x => x.loai===loai && x.ma===ma); }
function pqAllCD(){ // tất cả chức danh (trong nhóm + tự do) — để tra cứu
  const out = {};
  pqTree.chuc_danh_tu_do.forEach(c => out[c.chuc_danh] = c);
  pqTree.nhom.forEach(n => (n.thanh_vien||[]).forEach(tv => { if (tv.loai==='chuc_danh') out[tv.ma] = { chuc_danh:tv.ma, ten_hien_thi:tv.ten_hien_thi, quyen:tv.quyen, pham_vi:tv.pham_vi, khu_vuc_phu_trach:tv.khu_vuc_phu_trach, so_nguoi:tv.so_nguoi, da_cau_hinh:tv.da_cau_hinh }; }));
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
//  KHỞI TẠO
// ═══════════════════════════════════════════════════════════════════════
async function pqInit(){
  const wrap = document.getElementById('pq-root');
  if (!wrap) return;
  wrap.innerHTML = '<div class="pq-loading">Đang tải cây phân quyền…</div>';
  try {
    const { data, error } = await supa.rpc('fn_pq_tree');
    if (error) throw error;
    pqTree = {
      nhom: Array.isArray(data && data.nhom) ? data.nhom : [],
      chuc_danh_tu_do: Array.isArray(data && data.chuc_danh_tu_do) ? data.chuc_danh_tu_do : [],
    };
    pqGio = []; pqNVCache = {}; pqExpNhom = {}; pqExpCD = {};
    pqAddingNhom = false; pqRenameNhom = null; pqAddTvNhom = null;
    pqShowPanel = false; pqTick = new Set();
    PQ_GROUPS.forEach(g => pqGroupOpen[g.id] = false);
    pqRender();
  } catch(e){
    wrap.innerHTML = '<div class="pq-err">Không tải được cây phân quyền. '+(e.message||e)+'<br><br>'
      + 'Kiểm tra đã chạy SQL Đợt 4 Phase 3 (<b>fn_pq_tree</b>) chưa.</div>';
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
       <div class="pq-head-sub">Tạo nhóm, bỏ chức danh hoặc nhân sự vào nhóm. Tích chọn 1 hoặc nhiều mục rồi bấm “Phân quyền” để cấp quyền cùng lúc.</div>
     </div>
     <div class="pq-layout">
       <div class="pq-tree">${pqRenderTree()}</div>
       <div class="pq-panel-wrap">${pqShowPanel ? pqRenderPanel() : pqRenderEmpty()}</div>
     </div>`;
  pqUpdateFooter();
}

function pqRenderTree(){
  const kw = pqTreeSearch.trim().toLowerCase();
  let html = '';

  // Thanh công cụ
  html += `<div class="pq-tree-bar">
      <div class="pq-tree-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="pq-tree-search-inp" type="text" placeholder="Tìm chức danh / nhân sự…" value="${pqEsc(pqTreeSearch)}" oninput="pqOnTreeSearch(this.value)">
      </div>
      ${pqAddingNhom ? '' : '<button class="pq-tree-add" onclick="pqBatDauTaoNhom()">+ Tạo nhóm</button>'}
    </div>`;

  // Ô tạo nhóm inline
  if (pqAddingNhom){
    html += `<div class="pq-inline-add">
        <input id="pq-newnhom-inp" type="text" placeholder="Tên nhóm mới (VD: Cơ động)…" onkeydown="if(event.key==='Enter')pqLuuNhomMoi(this.value); if(event.key==='Escape')pqHuyTaoNhom()">
        <button class="pq-inline-ok" onclick="pqLuuNhomMoi(document.getElementById('pq-newnhom-inp').value)">Tạo</button>
        <button class="pq-inline-cancel" onclick="pqHuyTaoNhom()">Hủy</button>
      </div>`;
  }

  // Thanh "đã chọn N" (multi-select)
  if (pqGio.length){
    html += `<div class="pq-gio-bar">
        <span class="pq-gio-count">${pqGio.length} mục đã chọn</span>
        <button class="pq-gio-go" onclick="pqMoPanelQuyen()">Phân quyền →</button>
        <button class="pq-gio-clear" onclick="pqXoaGio()">Bỏ chọn</button>
      </div>`;
  }

  // Các nhóm
  pqTree.nhom.forEach(n => { html += pqRenderNhom(n, kw); });

  // Chức danh chưa nhóm
  const tudo = pqTree.chuc_danh_tu_do.filter(c => !kw || (c.chuc_danh||'').toLowerCase().includes(kw));
  if (tudo.length || !kw){
    const open = pqExpNhom['__tudo__'] !== false; // mặc định mở
    html += `<div class="pq-tnode pq-tnode-nhom">
        <div class="pq-tnode-head pq-nhom-head" onclick="pqToggleExpNhom('__tudo__')">
          <span class="pq-caret${open?' open':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          <span class="pq-nhom-ic pq-nhom-ic-plain"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></span>
          <span class="pq-nhom-ten">Chức danh chưa nhóm</span>
          <span class="pq-nhom-meta">${tudo.length} mã</span>
        </div>
        <div class="pq-nhom-body${open?' open':''}">
          ${tudo.length ? tudo.map(c => pqRenderCD(c, null)).join('') : '<div class="pq-nhom-trong">Tất cả đã được gom nhóm</div>'}
        </div>
      </div>`;
  }

  if (!pqTree.nhom.length && !pqTree.chuc_danh_tu_do.length){
    html += '<div class="pq-tree-empty">Chưa có dữ liệu chức danh.</div>';
  }
  return html;
}

// Một NHÓM
function pqRenderNhom(n, kw){
  const open = !!pqExpNhom[n.ten];
  const tv = n.thanh_vien || [];
  const cds = tv.filter(x => x.loai==='chuc_danh');
  const cns = tv.filter(x => x.loai==='ca_nhan');
  const songuoi = cds.reduce((s,c)=> s+(c.so_nguoi||0), 0) + cns.length;
  const isRename = pqRenameNhom === n.ten;
  const isAdd = pqAddTvNhom === n.ten;

  const tenUI = isRename
    ? `<input id="pq-rename-inp" class="pq-nhom-rename" type="text" value="${pqEsc(n.ten)}" onclick="event.stopPropagation()" onkeydown="event.stopPropagation(); if(event.key==='Enter')pqLuuDoiTen('${pqEsc(n.ten)}',this.value); if(event.key==='Escape')pqHuyDoiTen()">`
    : `<span class="pq-nhom-ten">${pqEsc(n.ten)}</span>`;

  let body = '';
  if (open){
    body += cds.map(c => pqRenderCD(c, n.ten)).join('');
    body += cns.map(c => pqRenderCaNhanTV(c, n.ten)).join('');
    if (!cds.length && !cns.length) body += '<div class="pq-nhom-trong">Nhóm trống — bấm + để thêm chức danh hoặc nhân sự</div>';
    // Ô thêm thành viên (autocomplete)
    if (isAdd) body += pqRenderAddBox(n.ten);
  }

  return `<div class="pq-tnode pq-tnode-nhom">
      <div class="pq-tnode-head pq-nhom-head">
        <span class="pq-caret${open?' open':''}" onclick="pqToggleExpNhom('${pqEsc(n.ten)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        <span class="pq-nhom-ic" onclick="pqToggleExpNhom('${pqEsc(n.ten)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7l2 3h9v9H3z"/></svg></span>
        ${tenUI}
        <span class="pq-nhom-meta">${cds.length} chức danh · ${songuoi} người</span>
        ${isRename ? '' : `<button class="pq-icobtn" title="Thêm thành viên" onclick="event.stopPropagation(); pqMoThemTV('${pqEsc(n.ten)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></button>
        <button class="pq-icobtn" title="Đổi tên" onclick="event.stopPropagation(); pqMoDoiTen('${pqEsc(n.ten)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="pq-icobtn pq-icobtn-del" title="Xóa nhóm" onclick="event.stopPropagation(); pqXoaNhom('${pqEsc(n.ten)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>`}
      </div>
      <div class="pq-nhom-body${open?' open':''}">${body}</div>
    </div>`;
}

// Ô thêm thành viên (autocomplete)
function pqRenderAddBox(nhom){
  const cd = pqTimKq.chuc_danh || [];
  const ns = pqTimKq.nhan_su || [];
  let goiY = '';
  if (cd.length || ns.length){
    goiY = '<div class="pq-ac-list">';
    if (cd.length){
      goiY += '<div class="pq-ac-group">Chức danh</div>';
      goiY += cd.map(c => `<div class="pq-ac-item" onclick="pqThemTV('${pqEsc(nhom)}','chuc_danh','${pqEsc(c.ma)}','${pqEsc((c.ten||'').replace(/'/g,'’'))}')">
          <span class="pq-ac-ma">${pqEsc(c.ma)}</span><span class="pq-ac-ten">${pqEsc(c.ten||'')}</span><span class="pq-ac-meta">${c.so_nguoi||0} người</span>
        </div>`).join('');
    }
    if (ns.length){
      goiY += '<div class="pq-ac-group">Nhân sự</div>';
      goiY += ns.map(p => `<div class="pq-ac-item" onclick="pqThemTV('${pqEsc(nhom)}','ca_nhan','${pqEsc(p.ma)}','${pqEsc((p.ten||'').replace(/'/g,'’'))}')">
          <span class="pq-ac-ava">${pqEsc((p.ten||'?').trim().charAt(0).toUpperCase())}</span><span class="pq-ac-ten">${pqEsc(p.ten||p.ma)}</span><span class="pq-ac-meta">${pqEsc(p.ma)}</span>
        </div>`).join('');
    }
    goiY += '</div>';
  }
  return `<div class="pq-addbox">
      <div class="pq-addbox-inp">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="pq-ac-inp" type="text" placeholder="Gõ tên chức danh hoặc nhân viên…" oninput="pqTimTV(this.value)" onkeydown="if(event.key==='Escape')pqDongThemTV()">
        <button class="pq-addbox-close" onclick="pqDongThemTV()">×</button>
      </div>
      ${goiY}
    </div>`;
}

// Một CHỨC DANH (trong nhóm hoặc tự do). nhom=null nếu tự do.
function pqRenderCD(cd, nhom){
  const ma = cd.chuc_danh || cd.ma;
  const isAdmin = ma === 'ADMIN';
  const daCH = cd.da_cau_hinh || (Array.isArray(cd.quyen) && cd.quyen.length>0) || isAdmin;
  const checked = pqInGio('chuc_danh', ma);
  const open = !!pqExpCD[ma];
  const badge = isAdmin ? '<span class="pq-badge pq-badge-admin">full</span>'
                        : (daCH ? '<span class="pq-badge pq-badge-ok">✓</span>'
                                : '<span class="pq-badge pq-badge-no">⚠</span>');
  let nvHtml = '';
  if (open){
    const list = pqNVCache[ma];
    if (!list) nvHtml = '<div class="pq-nv-loading">Đang tải…</div>';
    else if (!list.length) nvHtml = '<div class="pq-nv-trong">Không có nhân viên</div>';
    else nvHtml = list.map(nv => pqRenderNV(nv)).join('');
  }
  return `<div class="pq-tnode pq-tnode-cd">
      <div class="pq-row pq-cd-row${checked?' checked':''}">
        <span class="pq-cb${checked?' on':''}" onclick="pqToggleGio('chuc_danh','${pqEsc(ma)}','${pqEsc((cd.ten_hien_thi||ma).replace(/'/g,'’'))}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <span class="pq-caret pq-cd-caret${open?' open':''}" onclick="pqToggleExpCD('${pqEsc(ma)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        <span class="pq-cd-main" onclick="pqToggleGio('chuc_danh','${pqEsc(ma)}','${pqEsc((cd.ten_hien_thi||ma).replace(/'/g,'’'))}')">
          <span class="pq-cd-ma-big">${pqEsc(ma)}</span>
          <span class="pq-cd-sub">${cd.so_nguoi||0} người ${badge}</span>
        </span>
        ${nhom ? `<button class="pq-icobtn pq-icobtn-x" title="Gỡ khỏi nhóm" onclick="event.stopPropagation(); pqGoTV('${pqEsc(nhom)}','chuc_danh','${pqEsc(ma)}')">×</button>` : ''}
      </div>
      <div class="pq-cd-body${open?' open':''}">${nvHtml}</div>
    </div>`;
}

// Một CÁ NHÂN là thành viên trực tiếp của nhóm
function pqRenderCaNhanTV(c, nhom){
  const ma = c.ma;
  const checked = pqInGio('ca_nhan', ma);
  const rieng = c.co_rieng ? '<span class="pq-nv-tag pq-nv-tag-rieng">★ Riêng</span>' : '';
  return `<div class="pq-row pq-cn-row${checked?' checked':''}">
      <span class="pq-cb${checked?' on':''}" onclick="pqToggleGio('ca_nhan','${pqEsc(ma)}','${pqEsc((c.ten_hien_thi||ma).replace(/'/g,'’'))}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
      <span class="pq-nv-ava">${pqEsc((c.ten_hien_thi||'?').trim().charAt(0).toUpperCase())}</span>
      <span class="pq-cn-main" onclick="pqToggleGio('ca_nhan','${pqEsc(ma)}','${pqEsc((c.ten_hien_thi||ma).replace(/'/g,'’'))}')">
        <span class="pq-nv-ten">${pqEsc(c.ten_hien_thi||ma)}</span>
        <span class="pq-nv-ma">${pqEsc(ma)} ${rieng}</span>
      </span>
      <button class="pq-icobtn pq-icobtn-x" title="Gỡ khỏi nhóm" onclick="event.stopPropagation(); pqGoTV('${pqEsc(nhom)}','ca_nhan','${pqEsc(ma)}')">×</button>
    </div>`;
}

// Một NHÂN VIÊN (con của chức danh khi xổ ra)
function pqRenderNV(nv){
  const checked = pqInGio('ca_nhan', nv.ma_nv);
  const rieng = nv.co_rieng ? '<span class="pq-nv-tag pq-nv-tag-rieng">★ Riêng</span>' : '<span class="pq-nv-tag pq-nv-tag-cd">Theo chức danh</span>';
  return `<div class="pq-row pq-nv-row${checked?' checked':''}">
      <span class="pq-cb${checked?' on':''}" onclick="pqToggleGio('ca_nhan','${pqEsc(nv.ma_nv)}','${pqEsc((nv.ho_ten||'').replace(/'/g,'’'))}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
      <span class="pq-nv-ava">${pqEsc((nv.ho_ten||'?').trim().charAt(0).toUpperCase())}</span>
      <span class="pq-cn-main" onclick="pqToggleGio('ca_nhan','${pqEsc(nv.ma_nv)}','${pqEsc((nv.ho_ten||'').replace(/'/g,'’'))}')">
        <span class="pq-nv-ten">${pqEsc(nv.ho_ten||nv.ma_nv)}</span>
        <span class="pq-nv-ma">${pqEsc(nv.ma_nv)} ${rieng}</span>
      </span>
    </div>`;
}

function pqRenderEmpty(){
  return `<div class="pq-pick">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    <div><b>Tích chọn</b> các mục cần cấp quyền — có thể chọn nhiều chức danh, nhiều nhân viên cùng lúc — rồi bấm <b>“Phân quyền →”</b>.<br><br>Bấm <b>+ Tạo nhóm</b> để gom các mã phân quyền hoặc nhân sự lại cho dễ quản lý.</div>
  </div>`;
}

// ─── PANEL QUYỀN (áp cho cả giỏ) ───
function pqRenderPanel(){
  const n = pqGio.length;
  const donCD = (n===1 && pqGio[0].loai==='chuc_danh') ? pqGio[0].ma : null;
  const adminTrong = pqGio.some(x => x.loai==='chuc_danh' && x.ma==='ADMIN');

  const chips = pqGio.map(g => `<span class="pq-target-chip pq-target-${g.loai}">
      ${g.loai==='chuc_danh' ? '<b>'+pqEsc(g.ma)+'</b>' : pqEsc(g.ten||g.ma)}
      <span class="pq-target-x" onclick="pqBoMuc('${g.loai}','${pqEsc(g.ma)}')">×</span>
    </span>`).join('');

  const banner = `<div class="pq-banner${n>1?' multi':''}">
      <div class="pq-banner-l">
        <div class="pq-banner-ten">Áp quyền cho ${n} mục</div>
        <div class="pq-targets">${chips}</div>
        ${adminTrong ? '<div class="pq-banner-warn">ADMIN luôn toàn quyền — bỏ qua khi áp.</div>' : ''}
        ${n>1 ? '<div class="pq-banner-note">Quyền bên dưới sẽ GHI ĐÈ cho tất cả mục trên.</div>' : ''}
      </div>
    </div>`;

  // Ô đặt tên hiển thị — chỉ khi giỏ đúng 1 chức danh (không ADMIN)
  const tenEditUI = (donCD && donCD!=='ADMIN') ? `<div class="pq-tenedit">
      <div class="pq-tenedit-head">Tên hiển thị <span>— mã cột M: <b>${pqEsc(donCD)}</b></span></div>
      <input id="pq-ten-inp" class="pq-tenedit-inp" type="text" value="${pqEsc(pqTenEdit)}" placeholder="VD: Cơ động Sài Gòn" oninput="pqOnTenInput(this.value)">
    </div>` : '';

  const toolbar = `<div class="pq-toolbar">
      <div class="pq-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="pq-search-inp" type="text" placeholder="Tìm quyền…" value="${pqEsc(pqSearch)}" oninput="pqOnSearch(this.value)">
      </div>
      <div class="pq-tools">
        <button class="pq-tool" onclick="pqApplyPreset('full')">Toàn quyền</button>
        <button class="pq-tool" onclick="pqApplyPreset('xemall')">Chỉ xem</button>
        <button class="pq-tool pq-tool-ghost" onclick="pqClearAll()">Bỏ hết</button>
      </div>
    </div>`;

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

  const kvUI = (pqScope==='khuvuc') ? `<div class="pq-kv">
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
    + '<div style="height:76px"></div>';
}

function pqRenderGroup(g){
  const kw = pqSearch.trim().toLowerCase();
  let quyen = g.quyen;
  const groupMatch = kw && g.ten.toLowerCase().includes(kw);
  if (kw && !groupMatch){ quyen = g.quyen.filter(q => q.ten.toLowerCase().includes(kw) || q.id.includes(kw)); if (!quyen.length) return ''; }
  const tong = g.quyen.length, co = g.quyen.filter(q => pqTick.has(q.id)).length, all = co===tong;
  const open = pqGroupOpen[g.id] || !!kw;
  const rows = quyen.map(q => {
    const on = pqTick.has(q.id);
    const dep = q.can ? `<span class="pq-dep">cần: ${q.can.map(c=>PQ_MAP[c]?PQ_MAP[c].ten:c).join(', ')}</span>` : '';
    return `<label class="pq-q${on?' on':''}">
        <span class="pq-check" onclick="event.preventDefault(); pqToggleQuyen('${q.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
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

// ═══════════════════════════════════════════════════════════════════════
//  GIỎ CHỌN (multi-select)
// ═══════════════════════════════════════════════════════════════════════
function pqToggleGio(loai, ma, ten){
  const i = pqGio.findIndex(x => x.loai===loai && x.ma===ma);
  if (i >= 0) pqGio.splice(i,1);
  else pqGio.push({ loai, ma, ten });
  // Nếu panel đang mở mà giỏ rỗng → đóng
  if (!pqGio.length) pqShowPanel = false;
  // Nếu panel đang mở → cập nhật tick theo giỏ
  if (pqShowPanel) pqNapTickTheoGio();
  pqRender();
}
function pqBoMuc(loai, ma){ pqToggleGio(loai, ma); }
function pqXoaGio(){ pqGio = []; pqShowPanel = false; pqRender(); }

async function pqMoPanelQuyen(){
  if (!pqGio.length) return;
  pqShowPanel = true;
  await pqNapTickTheoGio();
  pqRender();
}

// Nạp quyền sẵn vào bảng tick theo giỏ
async function pqNapTickTheoGio(){
  pqTenEdit = '';
  if (pqGio.length === 1){
    const g = pqGio[0];
    if (g.loai === 'chuc_danh'){
      const all = pqAllCD(); const it = all[g.ma] || {};
      pqTick = new Set(Array.isArray(it.quyen) && it.quyen.length ? it.quyen : pqDefaultFor(g.ma));
      pqScope = it.pham_vi || pqDefaultScope(g.ma);
      pqKhuVuc = new Set(Array.isArray(it.khu_vuc_phu_trach) ? it.khu_vuc_phu_trach : []);
      pqTenEdit = it.ten_hien_thi || '';
    } else { // ca_nhan
      try {
        const { data, error } = await supa.rpc('fn_get_quyen_user', { p_ma: g.ma });
        if (!error && data && data.success !== false){
          pqTick = new Set(Array.isArray(data.quyen) ? data.quyen : []);
          pqScope = data.pham_vi || 'canhan';
          pqKhuVuc = new Set(Array.isArray(data.khu_vuc_phu_trach) ? data.khu_vuc_phu_trach : []);
        } else { pqTick = new Set(); pqScope='canhan'; pqKhuVuc=new Set(); }
      } catch(e){ pqTick = new Set(); pqScope='canhan'; pqKhuVuc=new Set(); }
    }
  } else {
    // Nhiều mục → bắt đầu rỗng (anh set mới, áp đè)
    pqTick = new Set(); pqScope = 'canhan'; pqKhuVuc = new Set();
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CÂY: expand + tải NV
// ═══════════════════════════════════════════════════════════════════════
function pqToggleExpNhom(ten){
  if (ten === '__tudo__') pqExpNhom['__tudo__'] = (pqExpNhom['__tudo__'] === false) ? true : false;
  else pqExpNhom[ten] = !pqExpNhom[ten];
  pqRender();
}
async function pqToggleExpCD(cd){
  pqExpCD[cd] = !pqExpCD[cd];
  if (pqExpCD[cd] && !pqNVCache[cd]){ pqRender(); await pqLoadNV(cd); }
  pqRender();
}
async function pqLoadNV(cd){
  try {
    const { data, error } = await supa.rpc('fn_list_nv_theo_chuc_danh', { p_chuc_danh: cd });
    pqNVCache[cd] = (!error && Array.isArray(data)) ? data : [];
  } catch(e){ pqNVCache[cd] = []; }
}
function pqOnTreeSearch(v){
  pqTreeSearch = v;
  const tw = document.querySelector('.pq-tree');
  if (tw){ tw.innerHTML = pqRenderTree(); const inp=document.getElementById('pq-tree-search-inp'); if(inp){inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length);} }
  else pqRender();
}

// ═══════════════════════════════════════════════════════════════════════
//  TẠO / ĐỔI TÊN / XÓA NHÓM (inline)
// ═══════════════════════════════════════════════════════════════════════
function pqBatDauTaoNhom(){ pqAddingNhom = true; pqRender(); setTimeout(()=>{ const i=document.getElementById('pq-newnhom-inp'); if(i)i.focus(); },30); }
function pqHuyTaoNhom(){ pqAddingNhom = false; pqRender(); }
async function pqLuuNhomMoi(ten){
  ten = (ten||'').trim(); if (!ten){ pqHuyTaoNhom(); return; }
  try {
    const { data, error } = await supa.rpc('fn_nhom_luu', { p_admin: pqAdminMa(), p_ten: ten, p_thu_tu: pqTree.nhom.length });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã tạo nhóm "'+ten+'"','ok');
    pqAddingNhom = false; await pqInit();
  } catch(e){ showToast('⚠ '+e.message,'warn'); }
}

function pqMoDoiTen(ten){ pqRenameNhom = ten; pqRender(); setTimeout(()=>{ const i=document.getElementById('pq-rename-inp'); if(i){i.focus(); i.select();} },30); }
function pqHuyDoiTen(){ pqRenameNhom = null; pqRender(); }
async function pqLuuDoiTen(tenCu, tenMoi){
  tenMoi = (tenMoi||'').trim(); if (!tenMoi || tenMoi===tenCu){ pqHuyDoiTen(); return; }
  try {
    const { data, error } = await supa.rpc('fn_nhom_doi_ten', { p_admin: pqAdminMa(), p_ten_cu: tenCu, p_ten_moi: tenMoi });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã đổi tên nhóm','ok'); pqRenameNhom = null; await pqInit();
  } catch(e){ showToast('⚠ '+e.message,'warn'); }
}

async function pqXoaNhom(ten){
  if (!confirm('Xóa nhóm "'+ten+'"? Các chức danh/nhân sự trong nhóm chỉ bị gỡ khỏi nhóm, KHÔNG mất quyền.')) return;
  try {
    const { data, error } = await supa.rpc('fn_nhom_xoa', { p_admin: pqAdminMa(), p_ten: ten });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã xóa nhóm','ok'); await pqInit();
  } catch(e){ showToast('⚠ '+e.message,'warn'); }
}

// ═══════════════════════════════════════════════════════════════════════
//  THÊM / GỠ THÀNH VIÊN NHÓM (autocomplete)
// ═══════════════════════════════════════════════════════════════════════
function pqMoThemTV(nhom){ pqAddTvNhom = nhom; pqExpNhom[nhom] = true; pqTimKq = {chuc_danh:[],nhan_su:[]}; pqRender(); setTimeout(()=>{ const i=document.getElementById('pq-ac-inp'); if(i)i.focus(); },30); }
function pqDongThemTV(){ pqAddTvNhom = null; pqTimKq = {chuc_danh:[],nhan_su:[]}; pqRender(); }

let _pqTimTimer = null;
function pqTimTV(kw){
  clearTimeout(_pqTimTimer);
  if (!kw || !kw.trim()){ pqTimKq = {chuc_danh:[],nhan_su:[]}; pqCapNhatAcList(); return; }
  _pqTimTimer = setTimeout(async () => {
    try {
      const { data, error } = await supa.rpc('fn_pq_tim', { p_kw: kw, p_gioi_han: 20 });
      pqTimKq = (!error && data) ? { chuc_danh: data.chuc_danh||[], nhan_su: data.nhan_su||[] } : {chuc_danh:[],nhan_su:[]};
    } catch(e){ pqTimKq = {chuc_danh:[],nhan_su:[]}; }
    pqCapNhatAcList();
  }, 250);
}
// Cập nhật chỉ phần danh sách gợi ý (giữ focus ô input)
function pqCapNhatAcList(){
  const box = document.querySelector('.pq-addbox');
  if (!box || !pqAddTvNhom) return;
  const old = box.querySelector('.pq-ac-list');
  if (old) old.remove();
  const cd = pqTimKq.chuc_danh||[], ns = pqTimKq.nhan_su||[];
  if (!cd.length && !ns.length) return;
  const div = document.createElement('div'); div.className = 'pq-ac-list';
  let h = '';
  if (cd.length){ h += '<div class="pq-ac-group">Chức danh</div>' + cd.map(c => `<div class="pq-ac-item" onclick="pqThemTV('${pqEsc(pqAddTvNhom)}','chuc_danh','${pqEsc(c.ma)}','${pqEsc((c.ten||'').replace(/'/g,'’'))}')"><span class="pq-ac-ma">${pqEsc(c.ma)}</span><span class="pq-ac-ten">${pqEsc(c.ten||'')}</span><span class="pq-ac-meta">${c.so_nguoi||0} người</span></div>`).join(''); }
  if (ns.length){ h += '<div class="pq-ac-group">Nhân sự</div>' + ns.map(p => `<div class="pq-ac-item" onclick="pqThemTV('${pqEsc(pqAddTvNhom)}','ca_nhan','${pqEsc(p.ma)}','${pqEsc((p.ten||'').replace(/'/g,'’'))}')"><span class="pq-ac-ava">${pqEsc((p.ten||'?').trim().charAt(0).toUpperCase())}</span><span class="pq-ac-ten">${pqEsc(p.ten||p.ma)}</span><span class="pq-ac-meta">${pqEsc(p.ma)}</span></div>`).join(''); }
  div.innerHTML = h; box.appendChild(div);
}

async function pqThemTV(nhom, loai, ma, ten){
  try {
    const { data, error } = await supa.rpc('fn_pq_them_thanh_vien', { p_admin: pqAdminMa(), p_nhom: nhom, p_loai: loai, p_ma: ma, p_ten: ten||null });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã thêm vào nhóm '+nhom,'ok');
    pqAddTvNhom = nhom; pqTimKq = {chuc_danh:[],nhan_su:[]};
    await pqInit(); pqExpNhom[nhom] = true; pqAddTvNhom = nhom; pqRender();
    setTimeout(()=>{ const i=document.getElementById('pq-ac-inp'); if(i)i.focus(); },30);
  } catch(e){ showToast('⚠ '+e.message,'warn'); }
}
async function pqGoTV(nhom, loai, ma){
  try {
    const { data, error } = await supa.rpc('fn_pq_xoa_thanh_vien', { p_admin: pqAdminMa(), p_nhom: nhom, p_loai: loai, p_ma: ma });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    await pqInit(); pqExpNhom[nhom] = true; pqRender();
  } catch(e){ showToast('⚠ '+e.message,'warn'); }
}

// ═══════════════════════════════════════════════════════════════════════
//  PANEL: thao tác quyền
// ═══════════════════════════════════════════════════════════════════════
function pqSetScope(id){ pqScope = id; pqRender(); }
function pqOnTenInput(v){ pqTenEdit = v; }
function pqToggleKhuVuc(kv){ if(pqKhuVuc.has(kv)) pqKhuVuc.delete(kv); else pqKhuVuc.add(kv); pqRender(); }
function pqToggleQuyen(id){
  if (pqTick.has(id)){
    pqTick.delete(id);
    PQ_ALL_IDS.forEach(other => { const o = PQ_MAP[other]; if (o.can && o.can.includes(id) && pqTick.has(other)) pqTick.delete(other); });
  } else { pqTick.add(id); const q = PQ_MAP[id]; if (q.can) q.can.forEach(dep => pqTick.add(dep)); }
  pqRender();
}
function pqToggleNhomQuyen(gid){
  const g = PQ_GROUPS.find(x => x.id === gid); if (!g) return;
  const all = g.quyen.every(q => pqTick.has(q.id));
  if (all) g.quyen.forEach(q => pqTick.delete(q.id));
  else g.quyen.forEach(q => { pqTick.add(q.id); if (q.can) q.can.forEach(d=>pqTick.add(d)); });
  pqRender();
}
function pqToggleGroup(gid){ pqGroupOpen[gid] = !pqGroupOpen[gid]; pqRender(); }
function pqApplyPreset(key){
  const p = PQ_PRESETS[key]; if (!p) return;
  pqTick = new Set(p.ids);
  Array.from(pqTick).forEach(id => { const q=PQ_MAP[id]; if(q&&q.can) q.can.forEach(d=>pqTick.add(d)); });
  pqRender();
}
function pqClearAll(){ pqTick = new Set(); pqRender(); }
function pqOnSearch(v){
  pqSearch = v;
  const gw = document.querySelector('.pq-groups');
  if (gw){ const groups = PQ_GROUPS.map(g => pqRenderGroup(g)).filter(Boolean).join(''); gw.innerHTML = groups || '<div class="pq-noresult">Không có quyền khớp tìm kiếm.</div>'; }
  else pqRender();
}

function pqUpdateFooter(){
  const f = document.getElementById('pq-footer');
  if (!f) return;
  if (!pqShowPanel || !pqGio.length){ f.style.display = 'none'; return; }
  f.style.display = 'flex';
  const scopeTen = (PQ_SCOPES.find(s => s.id === pqScope) || {}).ten || '';
  const info = document.getElementById('pq-footer-info');
  if (info) info.innerHTML = `<b>${pqTick.size}</b> quyền · ${scopeTen} · áp cho <b>${pqGio.length}</b> mục`;
  const btn = document.getElementById('pq-footer-save');
  if (btn){ btn.disabled = false; btn.textContent = 'Áp quyền'; }
  const resetBtn = document.getElementById('pq-footer-reset');
  if (resetBtn){
    const donCN = pqGio.length===1 && pqGio[0].loai==='ca_nhan';
    resetBtn.style.display = donCN ? '' : 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  LƯU — áp quyền cho cả giỏ
// ═══════════════════════════════════════════════════════════════════════
async function pqSave(){
  if (!pqShowPanel || !pqGio.length) return;
  const btn = document.getElementById('pq-footer-save');
  const quyenArr = Array.from(pqTick);
  const khuVucArr = (pqScope==='khuvuc') ? Array.from(pqKhuVuc) : [];
  // Nếu giỏ 1 chức danh + có đặt tên → đính tên vào target
  const targets = pqGio.map(g => {
    const o = { loai:g.loai, ma:g.ma, ten:g.ten||'' };
    if (g.loai==='chuc_danh' && pqGio.length===1 && pqTenEdit.trim()) o.ten = pqTenEdit.trim();
    return o;
  });
  if (btn){ btn.disabled = true; btn.textContent = 'Đang áp…'; }
  try {
    const { data, error } = await supa.rpc('fn_pq_ap_nhieu', {
      p_admin: pqAdminMa(), p_targets: targets, p_quyen: quyenArr, p_pham_vi: pqScope, p_khu_vuc: khuVucArr,
    });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã áp quyền: '+(data.so_chuc_danh||0)+' chức danh, '+(data.so_ca_nhan||0)+' cá nhân','ok');
    await pqInit();
  } catch(e){
    showToast('⚠ Áp quyền lỗi: '+e.message,'warn');
    if (btn){ btn.disabled=false; btn.textContent='Áp quyền'; }
  }
}

// Gỡ quyền riêng cá nhân (chỉ khi giỏ 1 cá nhân)
async function pqResetCaNhan(){
  if (pqGio.length!==1 || pqGio[0].loai!=='ca_nhan') return;
  const g = pqGio[0];
  if (!confirm('Gỡ quyền riêng của '+(g.ten||g.ma)+'? Người này về theo quyền chức danh.')) return;
  try {
    const { data, error } = await supa.rpc('fn_save_quyen_ca_nhan', { p_admin: pqAdminMa(), p_ma_nv: g.ma, p_ten_nv: g.ten||'', p_quyen: [], p_reset: true });
    if (error || (data && data.success === false)) throw new Error((data&&data.error)||error.message);
    showToast('Đã gỡ quyền riêng','ok'); await pqInit();
  } catch(e){ showToast('⚠ '+e.message,'warn'); }
}

// ─── Expose ───
window.pqInit = pqInit;
window.pqOnTreeSearch = pqOnTreeSearch;
window.pqToggleExpNhom = pqToggleExpNhom; window.pqToggleExpCD = pqToggleExpCD;
window.pqToggleGio = pqToggleGio; window.pqBoMuc = pqBoMuc; window.pqXoaGio = pqXoaGio; window.pqMoPanelQuyen = pqMoPanelQuyen;
window.pqBatDauTaoNhom = pqBatDauTaoNhom; window.pqHuyTaoNhom = pqHuyTaoNhom; window.pqLuuNhomMoi = pqLuuNhomMoi;
window.pqMoDoiTen = pqMoDoiTen; window.pqHuyDoiTen = pqHuyDoiTen; window.pqLuuDoiTen = pqLuuDoiTen; window.pqXoaNhom = pqXoaNhom;
window.pqMoThemTV = pqMoThemTV; window.pqDongThemTV = pqDongThemTV; window.pqTimTV = pqTimTV; window.pqThemTV = pqThemTV; window.pqGoTV = pqGoTV;
window.pqSetScope = pqSetScope; window.pqOnTenInput = pqOnTenInput; window.pqToggleKhuVuc = pqToggleKhuVuc;
window.pqToggleQuyen = pqToggleQuyen; window.pqToggleNhomQuyen = pqToggleNhomQuyen; window.pqToggleGroup = pqToggleGroup;
window.pqApplyPreset = pqApplyPreset; window.pqClearAll = pqClearAll; window.pqOnSearch = pqOnSearch;
window.pqSave = pqSave; window.pqResetCaNhan = pqResetCaNhan;
