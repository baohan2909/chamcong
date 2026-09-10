// ═══════════════════════════════════════════════════════════════════════════
//  CẤU HÌNH PHIẾU (slip config engine)  —  Quản lý TN / Tạm ứng
//  Tab "Cột dữ liệu" (ánh xạ + thêm cột + import Excel/CSV) · Tab "Giao diện hiển thị"
//  (nhóm/dòng + preview trực tiếp) · Tab "Lịch sử" (gộp cột + giao diện, khôi phục).
//  Lưu vào app_settings (JSON) qua fn_admin_set_setting — KHÔNG cần SQL mới.
//  Cột → chỉ tác động lúc Tải Excel/CSV kế tiếp. Giao diện → phiếu NV lần mở kế tiếp.
//  Engine chung: đăng ký phân hệ trong DEFS (giờ có 'tn'; 'tu' bổ sung sau).
// ═══════════════════════════════════════════════════════════════════════════
(function(){
'use strict';

// ── Nhãn tiếng Việt cho 71 khóa TN ──
const TN_LABELS = {
  stt:'STT', ma_nv:'Mã nhân viên', ma_ns:'Mã NS', ho_ten:'Họ và tên', chuc_vu:'Chức vụ',
  cua_hang:'Cửa hàng', ma_ch:'Mã cửa hàng', khu_vuc:'Khu vực', luong_cb:'Lương căn bản',
  hieu_qua_cv:'Hiệu quả công việc (gốc)', bhxh_tham_gia:'BHXH tham gia', pc_com:'Phụ cấp cơm',
  pc_xang:'Phụ cấp xăng', pc_dilai:'Phụ cấp đi lại', thuong_hieu_qua:'Thưởng hiệu quả',
  pc_trach_nhiem:'Phụ cấp trách nhiệm, điện thoại', tong_gio_cong:'Tổng giờ công', gio_chuan:'Giờ công chuẩn',
  thanh_tien:'Thành tiền công', gio_12:'Giờ tăng ca ×1.2', tangca_12:'Thành tiền tăng ca ×1.2',
  gio_x2:'Giờ tăng ca ×2.0', tangca_20:'Thành tiền tăng ca ×2.0', gio_x3:'Giờ tăng ca ×3.0 (lễ)',
  tangca_30:'Thành tiền tăng ca ×3.0', hieu_qua_thanhtien:'Hiệu quả công việc (thành tiền)',
  nghi_phep:'Nghỉ phép', hh_cht:'Hoa hồng CHT 1%', hh_nvbhsx:'Hoa hồng đơn hàng NVBH SX',
  hh_dungca_db:'Hoa hồng đứng ca 3% DB', online_tiktok:'Online (Tiktok)', sale_hoahong:'Hoa hồng Sale Đội',
  sale_tai_ch:'Hoa hồng cửa hàng', hh_thi_dua:'Hoa hồng thi đua', cong_tac_phi:'Công tác phí',
  ho_tro_khac:'Hỗ trợ / bổ sung khác', com_doi_live:'Tiền cơm đội Live', com_ch:'Tiền cơm cửa hàng',
  thanhtoan_phep_nam:'Thanh toán phép năm', ngay_vao_lam:'Ngày vào làm', tham_nien:'Thâm niên',
  tien_tham_nien:'Tiền thâm niên', tong_thu_nhap:'Tổng thu nhập', tong_tn_ck:'Tổng TN chuyển khoản',
  tong_tn_tm:'Tổng TN tiền mặt', bhxh_8:'BHXH 8%', bhyt_15:'BHYT 1,5%', bhtn_1:'BHTN 1%',
  bhxh_105:'BHXH (10,5%)', nguoi_phu_thuoc:'Người phụ thuộc', giam_tru_gia_canh:'Giảm trừ gia cảnh',
  com_khong_thue:'Tiền cơm không tính thuế', tn_chiu_thue:'Thu nhập chịu thuế', thue_tncn:'Thuế TNCN',
  tong_tam_ung:'Tạm ứng trong kỳ', tn_da_nhan:'Thu nhập đã nhận', tru_khac:'Trừ khác',
  tong_phai_tru:'Tổng phải trừ', tong_thuc_lanh:'Tổng thực lãnh', thuc_nhan_ck:'Thực nhận chuyển khoản',
  thuc_nhan_tm:'Thực nhận tại cửa hàng', tk_ten:'Chủ tài khoản', tk_stk:'Số tài khoản',
  tk_nganhang:'Ngân hàng', tk_chinhanh:'Chi nhánh', tk_gmail:'Email', so_nguoi_phu_thuoc:'SL người phụ thuộc',
  tong_gio_cong2:'Tổng giờ công (2)', tong_ngay_nghi:'Tổng ngày nghỉ', phep_su_dung:'Phép sử dụng/tháng',
  phep_con_lai:'Phép năm còn lại'
};

// ── Nhãn tiếng Việt cho 20 khóa Tạm ứng ──
const TU_LABELS = {
  stt:'STT', ma_bh:'Mã NV (BH)', ho_ten:'Họ và tên', chuc_vu:'Chức vụ', cua_hang:'Cửa hàng',
  ma_ch:'Mã cửa hàng', khu_vuc:'Khu vực', luong_cb:'Lương căn bản', luong_bh:'Lương bảo hiểm',
  ngay_vao_lam:'Ngày vào làm', bhxh_105:'BHXH (10,5%)', muc_ung:'Mức tạm ứng', chuyen_khoan:'Chuyển khoản',
  tien_mat:'Tiền mặt', tk_ten:'Chủ tài khoản', tk_stk:'Số tài khoản', tk_nganhang:'Ngân hàng',
  tk_chinhanh:'Chi nhánh', tk_gmail:'Email', ma_nv:'Mã NS'
};

// ── Đăng ký phân hệ ──
const DEFS = {
  tn: {
    key:'tn', title:'TN · Bảng lương', roles:['ADMIN'], idKeys:['ma_nv','ho_ten'], labels:TN_LABELS,
    settingKey:'tn.columns', histKey:'tn.columns_hist',
    groupsSettingKey:'tn.groups', groupsHistKey:'tn.groups_hist',
    previewFn:'_tnSlipCore',
    previewP:{ ky:'2026-09', kyTen:'Tháng 9, 2026', ngayChi:'2026-09-05', xacNhanLuc:null },
    sampleBase:{ ho_ten:'Nguyễn Văn Mẫu', ma_nv:'NS00001', ma_ns:'NS00001', chuc_vu:'Nhân viên bán hàng',
      cua_hang:'CH Quận 1', ma_ch:'CH01', khu_vuc:'TP.HCM', ngay_vao_lam:'01/03/2021', tham_nien:'4 năm',
      tk_ten:'NGUYEN VAN MAU', tk_stk:'0071001234567', tk_nganhang:'Vietcombank', tk_chinhanh:'TP.HCM', tk_gmail:'mau@example.com',
      tong_thuc_lanh:18500000, thuc_nhan_ck:15000000, thuc_nhan_tm:3500000 },
    defaultKeys(){ return (window.TN_KEYS_DEFAULT || window.TN_KEYS || []).slice(); },
    defaultGroups(){ return (window.TN_GROUPS_DEFAULT || []); },
    onReload(){ try{ if(typeof tnAdminLoad==='function' && typeof TN!=='undefined' && TN && TN.adKy) tnAdminLoad(TN.adKy); }catch(e){} }
  },
  tu: {
    key:'tu', title:'Tạm ứng · Phiếu ứng lương', roles:['ADMIN','QLNS'], idKeys:['ma_nv','ho_ten'], labels:TU_LABELS,
    settingKey:'tu.columns', histKey:'tu.columns_hist',
    groupsSettingKey:'tu.groups', groupsHistKey:'tu.groups_hist',
    previewFn:'_tuSlipCore',
    previewP:{ ky:'2026-09', kyTen:'Tháng 9, 2026', ngayNhan:'2026-09-05', hanHoi:'17h30 ngày 06/09', zalo:'0902753345', xacNhanLuc:null },
    sampleBase:{ ho_ten:'Nguyễn Văn Mẫu', ma_bh:'BH1256', ma_nv:'NS00001', chuc_vu:'Nhân viên bán hàng',
      cua_hang:'CH Quận 1', ma_ch:'CH01', khu_vuc:'TP.HCM', ngay_vao_lam:'01/03/2021', tk_gmail:'mau@example.com',
      muc_ung:3000000, chuyen_khoan:3000000, tien_mat:0, tk_ten:'NGUYEN VAN MAU', tk_stk:'0071001234567', tk_nganhang:'Vietcombank', tk_chinhanh:'TP.HCM' },
    defaultKeys(){ return (window.TU_KEYS_DEFAULT || []).slice(); },
    defaultGroups(){ return (window.TU_GROUPS_DEFAULT || []); },
    onReload(){ try{ if(typeof tuAdminLoad==='function' && typeof TU!=='undefined' && TU && TU.adKy) tuAdminLoad(TU.adKy); }catch(e){} }
  }
};
const HIST_CAP = 25;
const ACCENTS = ['#1E5F63','#2E8B57','#C6373C','#4A5670','#CBA45A','#D6006C','#185FA5','#BA7517'];
const FMTS = [{v:'money',t:'Tiền (₫)'},{v:'gio',t:'Giờ'},{v:'txt',t:'Văn bản'},{v:'num0',t:'Số nguyên'},{v:'stk',t:'Số TK (che)'}];

// ── State bản nháp đang mở ──
let ST = null;

// ── Tiện ích ──
function _esc(s){ return String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
function _toast(m,t){ if(typeof showToast==='function') showToast(m,t||'ok'); }
function _slug(s){
  s=String(s||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d');
  s=s.replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  return s||'cot';
}
function _colLetter(n){ let s=''; n++; while(n>0){ let r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); } return s; }
function _labelFor(def,key){ return (def.labels && def.labels[key]) || String(key).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
function _isAdminRole(def){ try{ const r=(SESSION&&SESSION.vaiTro?String(SESSION.vaiTro).toUpperCase():''); return (def.roles||['ADMIN']).indexOf(r)>=0; }catch(e){ return false; } }
function _who(){ try{ return {ma:(SESSION&&SESSION.ma)||'', ten:(SESSION&&(SESSION.ten||SESSION.hoTen||SESSION.ho_ten))||''}; }catch(e){ return {ma:'',ten:''}; } }
function _fmtTs(ts){ try{ const d=new Date(ts); return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear()+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }catch(e){ return String(ts||''); } }

// ── Đọc / ghi app_settings (JSON string) ──
function _readSetting(key){
  try{
    let v = (typeof _getSetting==='function') ? _getSetting(key,null) : (window.APP_SETTINGS && window.APP_SETTINGS[key]);
    if(v==null) return null;
    if(typeof v==='string'){ v=v.trim(); if(!v) return null; return JSON.parse(v); }
    return v;
  }catch(e){ return null; }
}
async function _writeSetting(key,obj){
  if(typeof supa==='undefined' || !supa) throw new Error('Chưa kết nối');
  const val = JSON.stringify(obj);
  const { data, error } = await supa.rpc('fn_admin_set_setting',{ p_admin:(SESSION&&SESSION.ma), p_key:key, p_value:val });
  if(error || !data || !data.success) throw new Error((data&&data.error)||(error&&error.message)||'Lỗi lưu');
  try{ window.APP_SETTINGS=window.APP_SETTINGS||{}; window.APP_SETTINGS[key]=val; localStorage.setItem('_app_settings',JSON.stringify(window.APP_SETTINGS)); }catch(e){}
}
async function _appendHist(key,item){
  let h=_readSetting(key); let items=(h&&Array.isArray(h.items))?h.items:[];
  items.unshift(item); if(items.length>HIST_CAP) items=items.slice(0,HIST_CAP);
  await _writeSetting(key,{v:1,items:items});
}

// ═══ CỘT: chuẩn hóa / nạp / resolve ═══════════════════════════════════════
function _normCols(def,rawCols){
  const defaultSet=new Set(def.defaultKeys());
  return (rawCols||[]).map(c=>{
    const k=_slug(c.key||'');
    const isId=(def.idKeys||[]).indexOf(k)>=0;
    return { key:k, label:(c.label!=null?String(c.label):_labelFor(def,k)), locked:isId, custom:(c.custom!=null?!!c.custom:!defaultSet.has(k)) && !isId };
  }).filter(c=>c.key);
}
function _loadCols(def){
  const cfg=_readSetting(def.settingKey);
  if(cfg && Array.isArray(cfg.cols) && cfg.cols.length)
    return { cols:_normCols(def,cfg.cols), meta:{updatedAt:cfg.updatedAt||null,updatedBy:cfg.updatedBy||null,updatedByName:cfg.updatedByName||null}, fromSaved:true };
  return { cols:_normCols(def, def.defaultKeys().map(k=>({key:k}))), meta:null, fromSaved:false };
}
function resolveKeys(subsys){
  const def=DEFS[subsys]; if(!def) return [];
  const cfg=_readSetting(def.settingKey);
  if(cfg && Array.isArray(cfg.cols) && cfg.cols.length) return cfg.cols.map(c=>_slug(c.key)).filter(Boolean);
  return def.defaultKeys();
}
function isCustomized(subsys){ const def=DEFS[subsys]; if(!def) return false; const cfg=_readSetting(def.settingKey); return !!(cfg && Array.isArray(cfg.cols) && cfg.cols.length); }

// ═══ NHÓM (giao diện): chuẩn hóa / nạp / resolve ══════════════════════════
function _normGroups(raw){
  return (raw||[]).map(g=>({
    name: g.name!=null?String(g.name):'Nhóm',
    accent: g.accent||'#1E5F63',
    total: g.total||null,
    neg: !!g.neg,
    hidden: !!g.hidden,
    rows: (g.rows||[]).map(r=> Array.isArray(r)
      ? {key:_slug(r[0]),label:(r[1]!=null?String(r[1]):r[0]),fmt:r[2]||'txt',showZero:!!r[3]}
      : {key:_slug(r.key),label:(r.label!=null?String(r.label):r.key),fmt:r.fmt||'txt',showZero:!!r.showZero})
  }));
}
function _serializeGroups(gs){
  return (gs||[]).map(g=>({ name:g.name, accent:g.accent, total:g.total||null, neg:!!g.neg, hidden:!!g.hidden,
    rows:(g.rows||[]).map(r=>({key:r.key,label:r.label,fmt:r.fmt||'txt',showZero:!!r.showZero})) }));
}
function _loadGroups(def){
  if(!def.groupsSettingKey) return {groups:_normGroups(def.defaultGroups?def.defaultGroups():[]),meta:null,fromSaved:false};
  const cfg=_readSetting(def.groupsSettingKey);
  if(cfg && Array.isArray(cfg.groups) && cfg.groups.length)
    return {groups:_normGroups(cfg.groups),meta:{updatedAt:cfg.updatedAt||null,updatedBy:cfg.updatedBy||null,updatedByName:cfg.updatedByName||null},fromSaved:true};
  return {groups:_normGroups(def.defaultGroups?def.defaultGroups():[]),meta:null,fromSaved:false};
}
function resolveGroups(subsys){
  const def=DEFS[subsys]; if(!def||!def.groupsSettingKey) return null;
  const cfg=_readSetting(def.groupsSettingKey);
  if(cfg && Array.isArray(cfg.groups) && cfg.groups.length) return cfg.groups;
  return null;
}
function _availKeys(def){
  const seen={}, out=[];
  const add=(k)=>{ k=_slug(k); if(!k||seen[k])return; seen[k]=1; out.push({key:k,label:_labelFor(def,k)}); };
  resolveKeys(def.key).forEach(add);
  def.defaultKeys().forEach(add);
  (ST&&ST.groups||[]).forEach(g=>(g.rows||[]).forEach(r=>add(r.key)));
  return out;
}
function _sampleD(def,groups){
  const d=Object.assign({}, (def&&def.sampleBase)||{});
  (groups||[]).forEach(g=>{
    if(g.total && d[g.total]===undefined) d[g.total]= g.neg?1200000:21000000;
    (g.rows||[]).forEach(r=>{ const k=r.key, fmt=r.fmt; if(d[k]!==undefined) return;
      if(fmt==='money') d[k]= /tru|thue|bhxh|bhyt|bhtn|tam_ung|giam_tru/.test(k)?450000:2500000;
      else if(fmt==='gio') d[k]=8;
      else if(fmt==='num0') d[k]=1;
      else d[k]='Mẫu'; });
  });
  return d;
}

// ═══ MỞ / ĐÓNG ═════════════════════════════════════════════════════════════
function open(subsys){
  const def=DEFS[subsys];
  if(!def){ _toast('Phân hệ chưa hỗ trợ cấu hình','warn'); return; }
  if(!_isAdminRole(def)){ _toast('Chỉ quản trị được cấu hình','warn'); return; }
  const lc=_loadCols(def), lg=_loadGroups(def);
  ST={ subsys, def, tab:'cols', imp:null,
    cols:lc.cols, colsDirty:false, colsSavedMeta:lc.meta, colsFromSaved:lc.fromSaved,
    groups:lg.groups, groupsDirty:false, groupsSavedMeta:lg.meta, groupsFromSaved:lg.fromSaved };
  _ensureOv(); _render(); document.getElementById('slipcfg-ov').classList.add('show');
}
function close(force){
  if(!force && ST && (ST.colsDirty||ST.groupsDirty)){
    if(typeof appConfirm==='function'){ appConfirm('Bạn có thay đổi chưa Áp dụng. Đóng và bỏ các thay đổi?',{title:'Bỏ thay đổi?',okLabel:'Bỏ & đóng',danger:true}).then(ok=>{ if(ok)_closeNow(); }); return; }
    else if(!confirm('Bỏ các thay đổi chưa áp dụng?')) return;
  }
  _closeNow();
}
function _closeNow(){ const ov=document.getElementById('slipcfg-ov'); if(ov){ ov.classList.remove('show'); ov.innerHTML=''; } ST=null; }
function _ensureOv(){ let ov=document.getElementById('slipcfg-ov'); if(!ov){ ov=document.createElement('div'); ov.id='slipcfg-ov'; document.body.appendChild(ov); } }

// ═══ RENDER KHUNG ══════════════════════════════════════════════════════════
const GEAR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
function _render(){
  const ov=document.getElementById('slipcfg-ov'); if(!ov||!ST) return;
  const def=ST.def; const nHist=_mergedHist(def).length;
  ov.innerHTML=
    '<div class="scf-bd" onclick="SLIPCFG.close()"></div>'+
    '<div class="scf-box" role="dialog" aria-modal="true">'+
      '<div class="scf-bar"><div class="scf-bar-ic">'+GEAR+'</div>'+
        '<div><div class="scf-bar-tt">Cấu hình phiếu</div><div class="scf-bar-sub">'+_esc(def.title)+'</div></div>'+
        '<button class="scf-x" onclick="SLIPCFG.close()" aria-label="Đóng">✕</button></div>'+
      '<div class="scf-tabs">'+
        _tabBtn('cols','Cột dữ liệu','')+
        _tabBtn('disp','Giao diện hiển thị','')+
        _tabBtn('hist','Lịch sử', nHist?('<span class="b">'+nHist+'</span>'):'')+
      '</div>'+
      '<div class="scf-body">'+
        '<div class="scf-pane'+(ST.tab==='cols'?' on':'')+'" id="scf-pane-cols">'+_paneCols()+'</div>'+
        '<div class="scf-pane'+(ST.tab==='disp'?' on':'')+'" id="scf-pane-disp">'+_paneDisp()+'</div>'+
        '<div class="scf-pane'+(ST.tab==='hist'?' on':'')+'" id="scf-pane-hist">'+_paneHist()+'</div>'+
      '</div>'+
      _foot()+
    '</div>';
  if(document.getElementById('scf-preview')) _updPreview();
}
function _tabBtn(id,label,badge){ return '<button class="scf-tab'+(ST.tab===id?' on':'')+'" onclick="SLIPCFG._tab(\''+id+'\')">'+_esc(label)+badge+'</button>'; }
function _setTab(id){ if(!ST) return; ST.tab=id; _render(); }

// ═══ PANE: CỘT DỮ LIỆU ═════════════════════════════════════════════════════
function _paneCols(){
  let h='<div class="scf-note"><span class="ic">💡</span><div>Danh sách cột theo <b>đúng thứ tự trong file Excel/CSV</b> (A · B · C…). Sửa rồi <b>Áp dụng</b> để lần <b>Tải Excel/CSV kế tiếp</b> đọc đúng cột — không cần sửa code. Thay đổi <b>không</b> làm đổi dữ liệu đã lưu.</div></div>';
  h+='<div class="scf-tools">'+
     '<button class="scf-btn pri" onclick="SLIPCFG._add()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Thêm cột</button>'+
     '<label class="scf-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Nhập từ Excel/CSV<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="SLIPCFG._import(this)"></label>'+
     '<button class="scf-btn warn" onclick="SLIPCFG._reset()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Về mặc định</button>'+
     '<div class="scf-spacer"></div><span class="scf-count">'+ST.cols.length+' cột</span></div>'+
     '<div id="scf-imp-wrap"></div>'+
     '<div class="scf-cols" id="scf-cols">'+_colsHtml()+'</div>';
  return h;
}
function _colsHtml(){ const n=ST.cols.length; return ST.cols.map((c,i)=>_colRow(c,i,n)).join(''); }
function _colRow(c,i,n){
  const tag = c.locked ? '<span class="scf-tag id">định danh</span>' : (c.custom?'<span class="scf-tag new">mới</span>':'');
  const keyHtml = c.custom
    ? '<span class="scf-key editable" contenteditable="true" spellcheck="false" onblur="SLIPCFG._keyEdit('+i+',this)">'+_esc(c.key)+'</span>'
    : '<span class="scf-key">'+_esc(c.key)+'</span>';
  const del = c.locked
    ? '<span class="scf-lock" title="Cột định danh — không thể xoá"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>'
    : '<button class="scf-mini del" title="Xoá cột" onclick="SLIPCFG._del('+i+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
  return '<div class="scf-col'+(c.locked?' locked':'')+(c.custom?' custom':'')+'" data-i="'+i+'">'+
    '<div class="scf-pos">'+_colLetter(i)+'</div>'+
    '<div class="scf-col-main">'+
      '<input class="scf-lbl-inp" value="'+_esc(c.label)+'" placeholder="Tên hiển thị cột" oninput="SLIPCFG._lblEdit('+i+',this.value)">'+
      '<div class="scf-key-row">'+keyHtml+tag+'</div></div>'+
    '<div class="scf-col-acts">'+
      '<button class="scf-mini" title="Lên" onclick="SLIPCFG._move('+i+',-1)" '+(i===0?'disabled':'')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>'+
      '<button class="scf-mini" title="Xuống" onclick="SLIPCFG._move('+i+',1)" '+(i===n-1?'disabled':'')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>'+
      del+'</div></div>';
}
function _rerenderCols(){ const box=document.getElementById('scf-cols'); if(box) box.innerHTML=_colsHtml(); const c=document.querySelector('#scf-pane-cols .scf-count'); if(c)c.textContent=ST.cols.length+' cột'; }
function _markColsDirty(){ if(ST){ ST.colsDirty=true; _updFoot(); } }
function _lblEdit(i,v){ if(ST&&ST.cols[i]){ ST.cols[i].label=v; _markColsDirty(); } }
function _keyEdit(i,el){ if(!ST||!ST.cols[i])return; const nk=_slug(el.textContent||''); if(nk!==ST.cols[i].key){ ST.cols[i].key=nk; _markColsDirty(); } el.textContent=nk; }
function _move(i,d){ if(!ST)return; const j=i+d; if(j<0||j>=ST.cols.length)return; const t=ST.cols[i];ST.cols[i]=ST.cols[j];ST.cols[j]=t; _markColsDirty(); _rerenderCols(); }
function _del(i){ if(!ST||!ST.cols[i]||ST.cols[i].locked)return; ST.cols.splice(i,1); _markColsDirty(); _rerenderCols(); }
function _add(){
  if(!ST)return; let n=1, base='cot_moi'; const has=k=>ST.cols.some(c=>c.key===k);
  let key=base; while(has(key)){ n++; key=base+'_'+n; }
  ST.cols.push({key:key,label:'Cột mới',locked:false,custom:true}); _markColsDirty(); _rerenderCols();
  const box=document.getElementById('scf-cols'); if(box){ const last=box.lastElementChild; if(last){ last.classList.add('is-new'); const inp=last.querySelector('.scf-lbl-inp'); if(inp){inp.focus();inp.select();} last.scrollIntoView({block:'nearest'}); } }
}
async function _reset(){
  if(!ST)return; let ok=true;
  if(typeof appConfirm==='function') ok=await appConfirm('Đưa danh sách cột về MẶC ĐỊNH (theo code hiện tại)? Bản nháp, cần Áp dụng để lưu.',{title:'Về mặc định',okLabel:'Về mặc định'});
  else ok=confirm('Về mặc định?');
  if(!ok)return; ST.cols=_normCols(ST.def, ST.def.defaultKeys().map(k=>({key:k}))); _markColsDirty(); _rerenderCols();
  _toast('Đã nạp bản mặc định (chưa lưu — bấm Áp dụng)','ok');
}

// ── IMPORT header từ Excel/CSV (cấu hình cột) ──
function _loadSheetJS(){
  if(window.XLSX) return Promise.resolve(window.XLSX);
  if(window._xlsxLoading) return window._xlsxLoading;
  window._xlsxLoading=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload=()=>res(window.XLSX); s.onerror=()=>rej(new Error('Không tải được thư viện đọc Excel')); document.head.appendChild(s); });
  return window._xlsxLoading;
}
function _csvHeader(text){
  const line=String(text).replace(/\r/g,'').split('\n').find(l=>l.length)||'';
  const r=[]; let cur='',q=false;
  for(let i=0;i<line.length;i++){ const ch=line[i];
    if(q){ if(ch==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else { if(ch==='"')q=true; else if(ch===','){r.push(cur);cur='';} else cur+=ch; } }
  r.push(cur); return r;
}
function _import(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const name=(f.name||'').toLowerCase();
  const done=(headers)=>{ inp.value=''; _showImport(headers,f.name); };
  const fail=(m)=>{ inp.value=''; _toast(m||'Không đọc được file','err'); };
  if(name.endsWith('.csv')){
    const rd=new FileReader();
    rd.onload=()=>{ const h=_csvHeader(rd.result).map(s=>String(s||'').trim()); if(!h.filter(Boolean).length) return fail('CSV không có dòng tiêu đề'); done(h); };
    rd.onerror=()=>fail('Lỗi đọc CSV'); rd.readAsText(f,'utf-8'); return;
  }
  _toast('Đang đọc Excel…','ok');
  _loadSheetJS().then(XLSX=>{
    const rd=new FileReader();
    rd.onload=()=>{ try{
      const wb=XLSX.read(new Uint8Array(rd.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const aoa=XLSX.utils.sheet_to_json(ws,{header:1,blankrows:false,defval:''});
      const h=((aoa&&aoa[0])||[]).map(s=>String(s==null?'':s).trim());
      if(!h.filter(Boolean).length) return fail('Sheet không có dòng tiêu đề');
      done(h);
    }catch(e){ fail('Lỗi phân tích Excel: '+e.message); } };
    rd.onerror=()=>fail('Lỗi đọc file'); rd.readAsArrayBuffer(f);
  }).catch(e=>fail(e.message));
}
function _labelIndex(def){ const m={}; const L=def.labels||{}; Object.keys(L).forEach(k=>{ m[_slug(L[k])]=k; }); def.defaultKeys().forEach(k=>{ if(m[_slug(k)]===undefined) m[_slug(k)]=k; }); return m; }
function _showImport(headers,fname){
  if(!ST) return; const def=ST.def; const idx=_labelIndex(def); const used={};
  const proposed=headers.map((hd,i)=>{
    const label=hd || ('Cột '+_colLetter(i));
    let key=idx[_slug(hd)] || _slug(hd) || ('cot_'+(i+1));
    let k=key,n=1; while(used[k]){ n++; k=key+'_'+n; } used[k]=1; key=k;
    const known = def.defaultKeys().indexOf(key)>=0 || (def.idKeys||[]).indexOf(key)>=0;
    return {key,label,known};
  });
  ST.imp={cols:proposed,fname:fname};
  const wrap=document.getElementById('scf-imp-wrap'); if(!wrap) return;
  const cells=proposed.map((c,i)=>'<div class="scf-imp-cell"><div class="p">'+_colLetter(i)+'</div><div class="h" title="'+_esc(c.label)+'">'+_esc(c.label)+'</div><div class="k">'+_esc(c.key)+(c.known?'':' •mới')+'</div></div>').join('');
  wrap.innerHTML='<div class="scf-imp"><div class="scf-imp-hd">'+
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'+
    'Đã đọc <b style="margin:0 4px">'+_esc(fname||'file')+'</b><span class="cnt">'+proposed.length+' cột</span></div>'+
    '<div class="scf-imp-grid">'+cells+'</div>'+
    '<div class="scf-imp-acts"><button class="scf-btn pri" onclick="SLIPCFG._impApply()">Dùng '+proposed.length+' cột này</button>'+
    '<button class="scf-btn" onclick="SLIPCFG._impCancel()">Huỷ</button></div>'+
    '<div style="font-size:11px;color:#7A6320;margin-top:8px">Khóa <code>•mới</code> là cột chưa có trong mặc định. Sau khi dùng, kiểm tra lại tên/khóa rồi bấm Áp dụng.</div></div>';
}
function _impApply(){ if(!ST||!ST.imp)return; ST.cols=_normCols(ST.def, ST.imp.cols.map(c=>({key:c.key,label:c.label,custom:!c.known}))); ST.imp=null; _markColsDirty(); _rerenderCols(); _impCancel(); _toast('Đã nạp '+ST.cols.length+' cột từ file (chưa lưu — bấm Áp dụng)','ok'); }
function _impCancel(){ if(ST)ST.imp=null; const w=document.getElementById('scf-imp-wrap'); if(w)w.innerHTML=''; }

// ═══ PANE: GIAO DIỆN HIỂN THỊ ══════════════════════════════════════════════
function _paneDisp(){
  return '<div class="scf-note"><span class="ic">🎨</span><div>Sửa <b>nhóm</b> và <b>dòng</b> hiển thị trên phiếu nhân viên. Sửa tới đâu <b>xem trước</b> tới đó. Bấm <b>Áp dụng</b> để nhân viên thấy ở lần mở phiếu kế tiếp.</div></div>'+
    '<div class="scf-tools"><button class="scf-btn pri" onclick="SLIPCFG._gAddG()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Thêm nhóm</button>'+
    '<button class="scf-btn warn" onclick="SLIPCFG._gReset()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Về mặc định</button>'+
    '<div class="scf-spacer"></div><span class="scf-count">'+ST.groups.length+' nhóm</span></div>'+
    '<div class="scf-disp"><div class="scf-disp-edit" id="scf-disp-edit">'+_dispEditHtml()+'</div>'+
    '<div class="scf-disp-prev"><div class="scf-prev-hd">👁 Xem trước phiếu</div><div class="scf-preview" id="scf-preview"></div></div></div>';
}
function _dispEditHtml(){ return ST.groups.map((g,gi)=>_grpCard(g,gi,ST.groups.length)).join('') || '<div class="scf-empty" style="padding:24px">Chưa có nhóm nào. Bấm “Thêm nhóm”.</div>'; }
function _grpCard(g,gi,n){
  const avail=_availKeys(ST.def);
  const rowsH=(g.rows||[]).map((r,ri)=>_drowHtml(gi,ri,r,g.rows.length,avail)).join('') || '<div class="scf-drow-empty">Nhóm trống — thêm dòng bên dưới</div>';
  return '<div class="scf-grp'+(g.hidden?' off':'')+'" data-g="'+gi+'">'+
    '<div class="scf-grp-hd">'+
      '<span class="scf-grp-color" style="background:'+_esc(g.accent||'#1E5F63')+'"></span>'+
      '<input class="scf-grp-name" value="'+_esc(g.name||'')+'" placeholder="Tên nhóm" oninput="SLIPCFG._gName('+gi+',this.value)">'+
      _accentPick(gi,g.accent)+
      '<label class="scf-sw" title="Ẩn/hiện nhóm trên phiếu"><input type="checkbox" '+(g.hidden?'':'checked')+' onchange="SLIPCFG._gHidden('+gi+')"><span></span></label>'+
      '<div class="scf-col-acts">'+
        '<button class="scf-mini" title="Lên" onclick="SLIPCFG._gMoveG('+gi+',-1)" '+(gi===0?'disabled':'')+'>↑</button>'+
        '<button class="scf-mini" title="Xuống" onclick="SLIPCFG._gMoveG('+gi+',1)" '+(gi===n-1?'disabled':'')+'>↓</button>'+
        '<button class="scf-mini del" title="Xoá nhóm" onclick="SLIPCFG._gDelG('+gi+')">✕</button>'+
      '</div></div>'+
    '<div class="scf-drows">'+rowsH+'</div>'+
    '<button class="scf-addrow" onclick="SLIPCFG._gAddRow('+gi+')">＋ Thêm dòng</button></div>';
}
function _accentPick(gi,cur){
  const cl=String(cur||'').toLowerCase();
  return '<span class="scf-acc">'+ACCENTS.map(c=>'<button class="scf-acc-sw'+(c.toLowerCase()===cl?' on':'')+'" style="background:'+c+'" title="'+c+'" onclick="SLIPCFG._gAccent('+gi+',\''+c+'\')"></button>').join('')+
    '<input type="color" class="scf-acc-inp" value="'+_esc(cur||'#1E5F63')+'" oninput="SLIPCFG._gAccentLive('+gi+',this.value)" title="Màu tuỳ chọn"></span>';
}
function _drowHtml(gi,ri,r,n,avail){
  const opts=avail.map(a=>'<option value="'+_esc(a.key)+'"'+(a.key===r.key?' selected':'')+'>'+_esc(a.label)+'</option>').join('');
  const fmtOpts=FMTS.map(f=>'<option value="'+f.v+'"'+(f.v===r.fmt?' selected':'')+'>'+f.t+'</option>').join('');
  return '<div class="scf-drow" data-r="'+ri+'">'+
    '<div class="scf-col-acts col">'+
      '<button class="scf-mini" title="Lên" onclick="SLIPCFG._gRowMove('+gi+','+ri+',-1)" '+(ri===0?'disabled':'')+'>↑</button>'+
      '<button class="scf-mini" title="Xuống" onclick="SLIPCFG._gRowMove('+gi+','+ri+',1)" '+(ri===n-1?'disabled':'')+'>↓</button></div>'+
    '<div class="scf-drow-main">'+
      '<input class="scf-lbl-inp" value="'+_esc(r.label||'')+'" placeholder="Nhãn hiển thị" oninput="SLIPCFG._gRowLabel('+gi+','+ri+',this.value)">'+
      '<div class="scf-drow-sel">'+
        '<select class="scf-sel2" onchange="SLIPCFG._gRowKey('+gi+','+ri+',this.value)" title="Trường dữ liệu">'+opts+'</select>'+
        '<select class="scf-sel2" onchange="SLIPCFG._gRowFmt('+gi+','+ri+',this.value)" title="Định dạng">'+fmtOpts+'</select>'+
        '<label class="scf-zero" title="Luôn hiện kể cả khi = 0"><input type="checkbox" '+(r.showZero?'checked':'')+' onchange="SLIPCFG._gRowZero('+gi+','+ri+')"> =0</label>'+
      '</div></div>'+
    '<button class="scf-mini del" title="Xoá dòng" onclick="SLIPCFG._gRowDel('+gi+','+ri+')">✕</button></div>';
}
function _rerenderDisp(){ const e=document.getElementById('scf-disp-edit'); if(e)e.innerHTML=_dispEditHtml(); const c=document.querySelector('#scf-pane-disp .scf-count'); if(c)c.textContent=ST.groups.length+' nhóm'; _updPreview(); }
function _updPreview(){
  const box=document.getElementById('scf-preview'); if(!box||!ST) return;
  const fn=window[ST.def.previewFn||''];
  if(typeof fn!=='function'){ box.innerHTML='<div class="scf-empty">Không tải được bản xem trước</div>'; return; }
  try{ box.innerHTML='<div class="tn-slip">'+fn(ST.def.previewP||{}, _sampleD(ST.def,ST.groups), ST.groups)+'</div>'; }
  catch(e){ box.innerHTML='<div class="scf-empty">Lỗi xem trước: '+_esc(e.message)+'</div>'; }
}
function _markGroupsDirty(){ if(ST){ ST.groupsDirty=true; _updFoot(); } }
function _gName(gi,v){ if(ST&&ST.groups[gi]){ ST.groups[gi].name=v; _markGroupsDirty(); _updPreview(); } }
function _gAccent(gi,v){ if(ST&&ST.groups[gi]){ ST.groups[gi].accent=v; _markGroupsDirty(); _rerenderDisp(); } }
// Cho <input type=color> (bắn 'input' liên tục): cập nhật TẠI CHỖ, KHÔNG dựng lại DOM (khỏi rớt bộ chọn màu native).
function _gAccentLive(gi,v){
  if(!ST||!ST.groups[gi])return; ST.groups[gi].accent=v; _markGroupsDirty();
  const card=document.querySelector('#scf-disp-edit .scf-grp[data-g="'+gi+'"]'); if(card){ const dot=card.querySelector('.scf-grp-color'); if(dot)dot.style.background=v; }
  _updPreview();
}
function _gHidden(gi){ if(ST&&ST.groups[gi]){ ST.groups[gi].hidden=!ST.groups[gi].hidden; _markGroupsDirty(); _rerenderDisp(); } }
function _gMoveG(gi,d){ if(!ST)return; const j=gi+d; if(j<0||j>=ST.groups.length)return; const t=ST.groups[gi];ST.groups[gi]=ST.groups[j];ST.groups[j]=t; _markGroupsDirty(); _rerenderDisp(); }
function _gDelG(gi){ if(!ST||!ST.groups[gi])return; ST.groups.splice(gi,1); _markGroupsDirty(); _rerenderDisp(); }
function _gAddG(){ if(!ST)return; ST.groups.push({name:'Nhóm mới',accent:ACCENTS[0],total:null,neg:false,hidden:false,rows:[]}); _markGroupsDirty(); _rerenderDisp(); const e=document.getElementById('scf-disp-edit'); if(e&&e.lastElementChild)e.lastElementChild.scrollIntoView({block:'nearest'}); }
function _gRowLabel(gi,ri,v){ const g=ST&&ST.groups[gi]; if(g&&g.rows[ri]){ g.rows[ri].label=v; _markGroupsDirty(); _updPreview(); } }
function _gRowKey(gi,ri,v){ const g=ST&&ST.groups[gi]; if(g&&g.rows[ri]){ g.rows[ri].key=_slug(v); _markGroupsDirty(); _updPreview(); } }
function _gRowFmt(gi,ri,v){ const g=ST&&ST.groups[gi]; if(g&&g.rows[ri]){ g.rows[ri].fmt=v; _markGroupsDirty(); _updPreview(); } }
function _gRowZero(gi,ri){ const g=ST&&ST.groups[gi]; if(g&&g.rows[ri]){ g.rows[ri].showZero=!g.rows[ri].showZero; _markGroupsDirty(); _updPreview(); } }
function _gRowMove(gi,ri,d){ const g=ST&&ST.groups[gi]; if(!g)return; const j=ri+d; if(j<0||j>=g.rows.length)return; const t=g.rows[ri];g.rows[ri]=g.rows[j];g.rows[j]=t; _markGroupsDirty(); _rerenderDisp(); }
function _gRowDel(gi,ri){ const g=ST&&ST.groups[gi]; if(g){ g.rows.splice(ri,1); _markGroupsDirty(); _rerenderDisp(); } }
function _gAddRow(gi){ const g=ST&&ST.groups[gi]; if(!g)return; const avail=_availKeys(ST.def); const first=avail[0]||{key:'ho_ten',label:'Họ và tên'}; g.rows.push({key:first.key,label:first.label,fmt:'txt',showZero:false}); _markGroupsDirty(); _rerenderDisp(); }
async function _gReset(){ if(!ST)return; let ok=true; if(typeof appConfirm==='function') ok=await appConfirm('Đưa giao diện phiếu về MẶC ĐỊNH? (bản nháp, cần Áp dụng để lưu)',{title:'Về mặc định',okLabel:'Về mặc định'}); if(!ok)return; ST.groups=_normGroups(ST.def.defaultGroups()); _markGroupsDirty(); _rerenderDisp(); _toast('Đã nạp giao diện mặc định (chưa lưu — bấm Áp dụng)','ok'); }

// ═══ PANE: LỊCH SỬ (gộp cột + giao diện) ═══════════════════════════════════
function _mergedHist(def){
  const ch=_readSetting(def.histKey), gh=_readSetting(def.groupsHistKey);
  const a=(((ch&&ch.items)||[])).map(it=>Object.assign({},it,{kind:'cols'}));
  const b=(((gh&&gh.items)||[])).map(it=>Object.assign({},it,{kind:'groups'}));
  return a.concat(b).sort((x,y)=> (x.ts<y.ts?1:x.ts>y.ts?-1:0));
}
function _paneHist(){
  const merged=_mergedHist(ST.def);
  if(!merged.length) return '<div class="scf-empty"><div class="ic">🕓</div>Chưa có lịch sử điều chỉnh.<br>Mỗi lần Áp dụng sẽ lưu 1 mốc để khôi phục.</div>';
  let curCols=false,curGroups=false; let h='<div class="scf-hist">';
  merged.forEach((it,i)=>{
    let isCur=false;
    if(it.kind==='cols'&&!curCols){isCur=true;curCols=true;}
    if(it.kind==='groups'&&!curGroups){isCur=true;curGroups=true;}
    const kindLbl=it.kind==='cols'?'Cột dữ liệu':'Giao diện';
    const cnt=it.kind==='cols'?(((it.cols||[]).length)+' cột'):(((it.groups||[]).length)+' nhóm');
    h+='<div class="scf-hi"><div class="scf-hi-top">'+
      '<span class="scf-hi-kind '+it.kind+'">'+kindLbl+'</span>'+
      '<span class="scf-hi-when">'+_esc(_fmtTs(it.ts))+'</span>'+
      (isCur?'<span class="scf-hi-cur">hiện hành</span>':'')+
      '<span class="scf-hi-by">'+_esc(it.byName||it.by||'—')+'</span></div>'+
      (it.note?'<div class="scf-hi-note">'+_esc(it.note)+'</div>':'')+
      '<div class="scf-hi-meta">'+cnt+'</div>'+
      (isCur?'':'<div class="scf-hi-acts"><button class="scf-btn" onclick="SLIPCFG._restore('+i+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Khôi phục bản này</button></div>')+
      '</div>';
  });
  return h+'</div>';
}
async function _restore(mi){
  if(!ST)return; const merged=_mergedHist(ST.def); const it=merged[mi]; if(!it){ _toast('Không đọc được bản này','warn'); return; }
  let ok=true;
  if(typeof appConfirm==='function') ok=await appConfirm('Khôi phục bản '+(it.kind==='cols'?'CỘT DỮ LIỆU':'GIAO DIỆN')+' từ '+_fmtTs(it.ts)+'? (bản nháp, cần Áp dụng để lưu)',{title:'Khôi phục',okLabel:'Nạp bản này'});
  if(!ok)return;
  if(it.kind==='cols'){ ST.cols=_normCols(ST.def,it.cols||[]); ST.colsDirty=true; ST.tab='cols'; }
  else { ST.groups=_normGroups(it.groups||[]); ST.groupsDirty=true; ST.tab='disp'; }
  _render(); _toast('Đã nạp bản '+_fmtTs(it.ts)+' (chưa lưu — bấm Áp dụng)','ok');
}

// ═══ FOOTER ════════════════════════════════════════════════════════════════
function _foot(){
  const dirty=ST.colsDirty||ST.groupsDirty; let info;
  if(ST.tab==='disp'){ const m=ST.groupsSavedMeta; info = ST.groupsFromSaved&&m ? ('Giao diện sửa lần cuối: <b>'+_esc(_fmtTs(m.updatedAt))+'</b>'+((m.updatedByName||m.updatedBy)?(' · bởi <b>'+_esc(m.updatedByName||m.updatedBy)+'</b>'):'')) : 'Giao diện đang <b>mặc định</b> — chưa tuỳ chỉnh.'; }
  else { const m=ST.colsSavedMeta; info = ST.colsFromSaved&&m ? ('Cột sửa lần cuối: <b>'+_esc(_fmtTs(m.updatedAt))+'</b>'+((m.updatedByName||m.updatedBy)?(' · bởi <b>'+_esc(m.updatedByName||m.updatedBy)+'</b>'):'')) : 'Cột đang dùng <b>mặc định</b> — chưa tuỳ chỉnh.'; }
  return '<div class="scf-foot"><div class="scf-foot-info" id="scf-foot-info">'+(dirty?'<span class="scf-dirty">Có thay đổi chưa áp dụng</span>':info)+'</div>'+
    '<div class="scf-foot-acts"><button class="scf-ghost" onclick="SLIPCFG.close()">Đóng</button>'+
    '<button class="scf-save" id="scf-save" onclick="SLIPCFG._save()" '+(dirty?'':'disabled')+'>Áp dụng</button></div></div>';
}
function _updFoot(){ const info=document.getElementById('scf-foot-info'); const btn=document.getElementById('scf-save'); const dirty=ST&&(ST.colsDirty||ST.groupsDirty); if(info&&dirty)info.innerHTML='<span class="scf-dirty">Có thay đổi chưa áp dụng</span>'; if(btn)btn.disabled=!dirty; }

// ═══ VALIDATE + SAVE ═══════════════════════════════════════════════════════
function _validateCols(){
  const seen={}; const errs=[];
  ST.cols.forEach((c,i)=>{ const k=_slug(c.key||''); c.key=k;
    if(!k) errs.push('Cột '+_colLetter(i)+' thiếu khóa');
    else if(seen[k]) errs.push('Khóa trùng: '+k+' (cột '+_colLetter(seen[k]-1)+' và '+_colLetter(i)+')');
    else seen[k]=i+1;
  });
  (ST.def.idKeys||[]).forEach(k=>{ if(!ST.cols.some(c=>c.key===k)) errs.push('Thiếu cột định danh bắt buộc: '+k); });
  return errs;
}
async function _save(){
  if(!ST || (!ST.colsDirty && !ST.groupsDirty)) return;
  if(ST.colsDirty){ const errs=_validateCols(); if(errs.length){ ST.tab='cols'; _render(); _toast('⚠ '+errs[0],'warn'); return; } }
  const parts=[];
  if(ST.colsDirty) parts.push(ST.cols.length+' cột dữ liệu');
  if(ST.groupsDirty) parts.push(ST.groups.length+' nhóm giao diện');
  let ok=true;
  if(typeof appConfirm==='function') ok=await appConfirm('Áp dụng cho '+ST.def.title+':\n• '+parts.join('\n• ')+'\n\nCột → dùng cho lần Tải Excel/CSV kế tiếp. Giao diện → phiếu NV lần mở kế tiếp. Bản hiện tại lưu vào Lịch sử.',{title:'Áp dụng cấu hình',okLabel:'Áp dụng'});
  if(!ok) return;
  const btn=document.getElementById('scf-save'); if(btn){ btn.disabled=true; btn.textContent='Đang lưu…'; }
  const w=_who(); const nowIso=new Date().toISOString(); const done=[];
  try{
    if(ST.colsDirty){
      const cols=ST.cols.map(c=>({key:c.key,label:c.label,custom:!!c.custom}));
      await _writeSetting(ST.def.settingKey,{v:1,cols:cols,updatedAt:nowIso,updatedBy:w.ma,updatedByName:w.ten});
      await _appendHist(ST.def.histKey,{ts:nowIso,by:w.ma,byName:w.ten,note:cols.length+' cột',cols:cols});
      ST.colsDirty=false; ST.colsFromSaved=true; ST.colsSavedMeta={updatedAt:nowIso,updatedBy:w.ma,updatedByName:w.ten}; done.push('cột dữ liệu');
    }
    if(ST.groupsDirty){
      const groups=_serializeGroups(ST.groups);
      await _writeSetting(ST.def.groupsSettingKey,{v:1,groups:groups,updatedAt:nowIso,updatedBy:w.ma,updatedByName:w.ten});
      await _appendHist(ST.def.groupsHistKey,{ts:nowIso,by:w.ma,byName:w.ten,note:groups.length+' nhóm',groups:groups});
      ST.groupsDirty=false; ST.groupsFromSaved=true; ST.groupsSavedMeta={updatedAt:nowIso,updatedBy:w.ma,updatedByName:w.ten}; done.push('giao diện');
    }
    _toast('✓ Đã áp dụng cấu hình','ok'); _render();
    if(typeof ST.def.onReload==='function') ST.def.onReload();
  }catch(e){
    _render();   // vẽ lại footer theo trạng thái THẬT: phần đã lưu hết dirty, phần lỗi vẫn dirty để Áp dụng lại
    const partial = done.length ? (' — ĐÃ áp dụng: '+done.join(', ')+'; phần còn lại CHƯA lưu, bấm Áp dụng lại.') : '';
    _toast('⚠ '+(e.message||'Lỗi lưu cấu hình')+partial,'err');
  }
}

// ── Export API ──
window.SLIPCFG={
  open:open, close:close, resolveKeys:resolveKeys, resolveGroups:resolveGroups, isCustomized:isCustomized, defs:DEFS,
  _tab:_setTab, _add:_add, _del:_del, _move:_move, _lblEdit:_lblEdit, _keyEdit:_keyEdit, _reset:_reset,
  _import:_import, _impApply:_impApply, _impCancel:_impCancel, _restore:_restore, _save:_save,
  _gAddG:_gAddG, _gReset:_gReset, _gName:_gName, _gAccent:_gAccent, _gAccentLive:_gAccentLive, _gHidden:_gHidden, _gMoveG:_gMoveG, _gDelG:_gDelG,
  _gRowLabel:_gRowLabel, _gRowKey:_gRowKey, _gRowFmt:_gRowFmt, _gRowZero:_gRowZero, _gRowMove:_gRowMove, _gRowDel:_gRowDel, _gAddRow:_gAddRow
};
})();
