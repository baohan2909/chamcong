// ═══════════════════════════════════════════════════════════════════════════
//  PHÂN HỆ TN  (bảng thu nhập cá nhân — nhạy cảm, verify mật khẩu server-side)
//  Tên hiển thị chỉ "TN". Không branding Nón Sơn. Style theo hệ v18.
// ═══════════════════════════════════════════════════════════════════════════
const TN = { pw:null, ma:null, kyList:[], ky:null, phieu:null,
             adKy:null, adData:null, adThreadId:null,
             syncUrl:(localStorage.getItem('tn_sync_url')||'https://script.google.com/macros/s/AKfycbxKNNRjt0K3gM0k60bi3alHGEG-e6rFZwgicOXFXLjHtd9sNvuRSqVri8LAbRFvGzgLrQ/exec'),
             syncSecret:'' };  // [v18.35] secret CHỈ giữ trong phiên (memory), KHÔNG lưu localStorage — Aroma: không lưu key trên máy

function _tnLaCH(){ return typeof _laCuaHang==='function' && _laCuaHang(); }
function _tnEsc(s){ return String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
function _tnNum(v){ if(v==null||v==='') return 0; const n=(typeof v==='number')?v:parseFloat(String(v).replace(/[^\d.-]/g,'')); return isNaN(n)?0:n; }
function _tnMoney(v){ const n=Math.round(_tnNum(v)); return n.toLocaleString('vi-VN'); }
function _tnHasVal(v){ if(v==null||v==='') return false; if(typeof v==='number') return v!==0; const s=String(v).trim(); if(!s||s==='0') return false; return _tnNum(v)!==0 || /[a-zA-Z]/.test(s); }
function _tnGio(v){ const n=_tnNum(v); return n? n.toLocaleString('vi-VN',{maximumFractionDigits:1})+' giờ' : ''; }
function _tnMaskStk(v){ const s=String(v||'').replace(/\s/g,''); return s.length>4 ? '•••• '+s.slice(-4) : s; }

// ─── Nhóm hiển thị phiếu (chỉ render dòng có giá trị) ───
const TN_GROUPS = [
  { name:'Công & giờ làm', accent:'#1E5F63', rows:[
    ['tong_gio_cong','Tổng giờ công','gio'], ['gio_chuan','Giờ công chuẩn','gio'],
    ['gio_12','Giờ tăng ca ×1.2','gio'], ['gio_x2','Giờ tăng ca ×2.0','gio'], ['gio_x3','Giờ tăng ca ×3.0 (lễ)','gio'],
    ['nghi_phep','Nghỉ phép','txt'],
    ['phep_su_dung','Phép sử dụng/tháng','txt'], ['phep_con_lai','Phép năm còn lại','txt'] ] },
    // [fix cột] Bỏ "Ngày nghỉ trong tháng" (BO = tong_ngay_nghi, gồm cả CN → gây hiểu nhầm là phép).
    // "Phép sử dụng/tháng" lấy đúng cột BP (phep_su_dung). "Phép năm còn lại" = BQ (giữ nguyên).
  { name:'Các khoản thu nhập', accent:'#2E8B57', total:'tong_thu_nhap', rows:[
    ['luong_cb','Lương căn bản','money'], ['thanh_tien','Thành tiền công','money'],
    ['tangca_12','Thành tiền tăng ca ×1.2','money'], ['tangca_20','Thành tiền tăng ca ×2.0','money'], ['tangca_30','Thành tiền tăng ca ×3.0','money'],
    ['thuong_hieu_qua','Thưởng hiệu quả','money'], ['hieu_qua_thanhtien','Hiệu quả công việc','money'],
    ['pc_trach_nhiem','Phụ cấp trách nhiệm, điện thoại','money'],
    ['hh_cht','Hoa hồng CHT 1%','money'], ['hh_nvbhsx','Hoa hồng đơn hàng NVBH SX','money'], ['hh_dungca_db','Hoa hồng đứng ca 3% DB','money'],
    ['online_tiktok','Online (Tiktok)','money'], ['sale_hoahong','Sale (hoa hồng + thưởng)','money'], ['sale_tai_ch','Sale tại cửa hàng','money'],
    ['pc_com','Phụ cấp cơm','money'], ['com_ch','Tiền cơm cửa hàng','money'], ['com_doi_live','Tiền cơm đội Live','money'],
    ['pc_xang','Phụ cấp xăng','money'], ['pc_dilai','Phụ cấp đi lại','money'],
    ['cong_tac_phi','Công tác phí','money'], ['tien_tham_nien','Tiền thâm niên','money'],
    ['thanhtoan_phep_nam','Thanh toán phép năm','money'], ['ho_tro_khac','Hỗ trợ / bổ sung khác','money'] ] },
  { name:'Các khoản trừ', accent:'#C6373C', total:'tong_phai_tru', neg:true, rows:[
    ['tong_tam_ung','Tạm ứng trong kỳ','money'], ['bhxh_105','BHXH (10,5%)','money'],
    ['thue_tncn','Thuế TNCN','money'], ['tru_khac','Trừ khác','money'] ] },
  { name:'Thuế & bảo hiểm (chi tiết)', accent:'#4A5670', rows:[
    ['bhxh_8','BHXH 8%','money'], ['bhyt_15','BHYT 1,5%','money'], ['bhtn_1','BHTN 1%','money'],
    ['nguoi_phu_thuoc','Người phụ thuộc','txt'], ['giam_tru_gia_canh','Giảm trừ gia cảnh','money'],
    ['com_khong_thue','Tiền cơm không tính thuế','money'], ['tn_chiu_thue','Thu nhập chịu thuế','money'] ] },
  { name:'Tài khoản nhận', accent:'#CBA45A', rows:[
    ['tk_ten','Chủ tài khoản','txt'], ['tk_stk','Số tài khoản','stk'],
    ['tk_nganhang','Ngân hàng','txt'], ['tk_chinhanh','Chi nhánh','txt'] ] },
];

// ═══ NHÂN VIÊN ═══════════════════════════════════════════════════════════
function tnInitPage(){
  if(_tnLaCH()){ if(typeof showToast==='function') showToast('Mục này không dành cho tài khoản cửa hàng','warn'); try{goToPage('banhang');}catch(e){} return; }
  TN.ma = (typeof SESSION!=='undefined'&&SESSION)?SESSION.ma:null;
  if(TN.pw){ tnAfterVerify(); } else { tnRenderGate(); }
}
function tnRenderGate(){
  const root=document.getElementById('tn-body'); if(!root) return;
  root.innerHTML =
    '<div class="tn-gate">'+
      '<div class="tn-gate-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>'+
      '<div class="tn-gate-t">Xác thực để xem</div>'+
      '<div class="tn-gate-s">Nhập lại mật khẩu đăng nhập để mở thông tin của bạn.</div>'+
      '<input id="tn-pw" class="tn-inp" type="password" placeholder="Mật khẩu" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')tnVerify()">'+
      '<div id="tn-gate-err" class="tn-err"></div>'+
      '<button class="tn-btn-ok" onclick="tnVerify()">Mở thông tin</button>'+
    '</div>';
  setTimeout(()=>{const i=document.getElementById('tn-pw'); if(i)i.focus();},60);
}
function tnVerify(){
  const inp=document.getElementById('tn-pw'); const pw=inp?inp.value.trim():'';
  const err=document.getElementById('tn-gate-err');
  if(!pw){ if(err)err.textContent='Vui lòng nhập mật khẩu.'; return; }
  const btn=document.querySelector('.tn-gate .tn-btn-ok'); if(btn){btn.disabled=true;btn.textContent='Đang xác thực...';}
  supa.rpc('fn_tn_my_kylist',{p_ma:TN.ma,p_password:pw}).then(({data,error})=>{
    if(btn){btn.disabled=false;btn.textContent='Mở thông tin';}
    if(error||!data||!data.success){ if(err)err.textContent=(data&&data.error)||'Xác thực thất bại.'; return; }
    TN.pw=pw; TN.kyList=data.danhSach||[]; tnAfterVerify();
  }).catch(()=>{ if(btn){btn.disabled=false;btn.textContent='Mở thông tin';} if(err)err.textContent='Lỗi kết nối.'; });
}
function tnAfterVerify(){
  if(!TN.kyList.length){
    supa.rpc('fn_tn_my_kylist',{p_ma:TN.ma,p_password:TN.pw}).then(({data})=>{ TN.kyList=(data&&data.danhSach)||[]; tnRenderShell(); });
  } else tnRenderShell();
}
function tnRenderShell(){
  const root=document.getElementById('tn-body'); if(!root) return;
  if(!TN.kyList.length){
    root.innerHTML='<div class="tn-empty"><div class="tn-empty-ic">📭</div><div>Chưa có kỳ nào được mở cho bạn.</div><div class="tn-empty-s">Khi có thông tin mới, mục này sẽ hiển thị.</div></div>';
    return;
  }
  if(!TN.ky || !TN.kyList.find(k=>k.ky===TN.ky)) TN.ky=TN.kyList[0].ky;
  const chips=TN.kyList.map(k=>'<button class="tn-ky-chip'+(k.ky===TN.ky?' on':'')+'" onclick="tnLoadKy(\''+k.ky+'\')">'+_tnEsc(k.ten||k.ky)+'</button>').join('');
  root.innerHTML='<div class="tn-ky-bar">'+chips+'</div><div id="tn-slip-wrap"><div class="tn-loading">Đang tải...</div></div>';
  tnLoadKy(TN.ky);
}
function tnLoadKy(ky){
  TN.ky=ky;
  document.querySelectorAll('.tn-ky-chip').forEach(c=>c.classList.toggle('on', c.textContent && TN.kyList.find(k=>k.ky===ky) && c.getAttribute('onclick').indexOf("'"+ky+"'")>=0));
  const wrap=document.getElementById('tn-slip-wrap'); if(wrap)wrap.innerHTML='<div class="tn-loading">Đang tải...</div>';
  supa.rpc('fn_tn_my_phieu',{p_ma:TN.ma,p_password:TN.pw,p_ky:ky}).then(({data,error})=>{
    if(error||!data||!data.success){ if(wrap)wrap.innerHTML='<div class="tn-empty">'+_tnEsc((data&&data.error)||'Không tải được phiếu.')+'</div>'; return; }
    TN.phieu=data; tnRenderPhieu();
  }).catch(()=>{ if(wrap)wrap.innerHTML='<div class="tn-empty">Lỗi kết nối.</div>'; });
}
// [refactor] Thân phiếu (head+who+hero+nhóm) — DÙNG CHUNG cho NV (tnRenderPhieu) và
// modal admin xem phiếu NV (tnAdminPhieuModal). Chỉ-đọc, không gồm nút hành động.
function _tnSlipCore(p, d){
  const daXN = !!p.xacNhanLuc;
  let h='';
  // head
  h+='<div class="tn-slip-head"><div><div class="tn-kicker">TN · Kỳ '+_tnEsc((p.ky||'').replace('-','/'))+'</div>'+
     '<div class="tn-slip-title">Phiếu kỳ '+_tnEsc(p.kyTen||p.ky)+'</div>'+
     (p.ngayChi?'<div class="tn-paydate"><span class="tn-gold-dot"></span>Ngày chi lương: '+_tnDate(p.ngayChi)+'</div>':'')+'</div>'+
     '<span class="tn-chip '+(daXN?'ok':'live')+'"><span class="tn-dot"></span>'+(daXN?'Đã xác nhận':'Đang mở')+'</span></div>';
  // who
  h+='<div class="tn-who">'+
     _tnWho('Họ và tên', d.ho_ten)+ _tnWho('Mã nhân viên', (d.ma_nv||'')+(d.ma_ns?' · '+d.ma_ns:''))+
     _tnWho('Cửa hàng', (d.cua_hang||'')+(d.ma_ch?' · '+d.ma_ch:''))+ _tnWho('Chức vụ', d.chuc_vu)+
     _tnWho('Vào làm', d.ngay_vao_lam)+ _tnWho('Thâm niên', d.tham_nien)+ '</div>';
  // hero THỰC LÃNH
  h+='<div class="tn-hero"><div class="tn-hero-main"><div class="tn-hero-lbl">Thực lãnh kỳ này</div>'+
     '<div class="tn-hero-num">'+_tnMoney(d.tong_thuc_lanh)+' <span>₫</span></div></div>'+
     '<div class="tn-hero-sub">'+
       ( _tnHasVal(d.thuc_nhan_ck) ? '<div><div class="l">Chuyển khoản</div><div class="n">'+_tnMoney(d.thuc_nhan_ck)+'</div></div>':'')+
       ( _tnHasVal(d.thuc_nhan_tm) ? '<div><div class="l">Nhận tại cửa hàng</div><div class="n">'+_tnMoney(d.thuc_nhan_tm)+'</div></div>':'')+
     '</div></div>';
  // groups
  TN_GROUPS.forEach((g,gi)=>{
    const rows=g.rows.filter(r=>_tnHasVal(d[r[0]]));
    if(!rows.length) return;
    const open = gi<3;
    const totalTxt = g.total!=null ? ((g.neg?'−':'')+_tnMoney(d[g.total])) : '';
    h+='<div class="tn-grp'+(open?' open':'')+'" style="--ga:'+g.accent+'">'+
       '<button class="tn-grp-head" onclick="tnTg(this)"><span class="tn-grp-dot"></span><span class="tn-grp-name">'+_tnEsc(g.name)+'</span>'+
       '<span class="tn-grp-meta'+(g.neg?' neg':'')+'">'+totalTxt+'<svg class="tn-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></span></button>'+
       '<div class="tn-grp-rows">';
    rows.forEach(r=>{
      const key=r[0], lbl=r[1], fmt=r[2]; const raw=d[key];
      let val = fmt==='money'?( (g.neg?'−':'')+_tnMoney(raw) ) : fmt==='gio'?_tnGio(raw) : fmt==='stk'?_tnMaskStk(raw) : _tnEsc(raw);
      h+='<div class="tn-row"><span class="k">'+_tnEsc(lbl)+'</span><span class="v'+(g.neg&&fmt==='money'?' neg':'')+'">'+val+'</span></div>';
    });
    h+='</div></div>';
  });
  return h;
}
function tnRenderPhieu(){
  const wrap=document.getElementById('tn-slip-wrap'); if(!wrap) return;
  const p=TN.phieu, d=p.duLieu||{};
  const daXN = !!p.xacNhanLuc;
  let h='<div class="tn-slip">'+_tnSlipCore(p,d);
  // foot: actions + thread
  h+='<div class="tn-slip-foot">';
  if(!daXN){
    h+='<div class="tn-actions"><button class="tn-btn-ok wide" onclick="tnConfirm()">Đã xem &amp; xác nhận</button>'+
       '<button class="tn-btn-ghost" onclick="tnToggleFb()">Gửi ý kiến</button></div>';
  } else {
    h+='<div class="tn-confirmed">✓ Bạn đã xác nhận lúc '+_tnEsc(_tnDt(p.xacNhanLuc))+'</div>'+
       '<button class="tn-btn-ghost" onclick="tnToggleFb()" style="margin-top:8px">Gửi ý kiến</button>';
  }
  h+='<div id="tn-fb" class="tn-fb" style="display:none"><textarea id="tn-fb-inp" class="tn-ta" placeholder="Nếu có sai sót hoặc thắc mắc, nhập tại đây gửi quản trị..."></textarea><button class="tn-btn-teal" onclick="tnSendFb()">Gửi</button></div>';
  h+= tnThreadHtml(p.phanHoi);
  h+='</div></div>';
  wrap.innerHTML=h;
}
function _tnWho(l,v){ return '<div><span>'+_tnEsc(l)+'</span><b>'+(_tnEsc(v)||'—')+'</b></div>'; }
function _tnDt(t){ if(!t)return''; const d=new Date(t); return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
function _tnDate(s){ if(!s)return''; const p=String(s).slice(0,10).split('-'); return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):s; }
function tnThreadHtml(list){
  if(!list||!list.length) return '';
  let h='<div class="tn-thread"><div class="tn-thread-l">Trao đổi</div>';
  list.forEach(m=>{ h+='<div class="tn-msg '+(m.nguoi==='NV'?'nv':'ad')+'">'+_tnEsc(m.noiDung)+'<small>'+(m.nguoi==='NV'?'Bạn':'Quản trị')+' · '+_tnEsc(_tnDt(m.luc))+'</small></div>'; });
  return h+'</div>';
}
function tnTg(btn){ btn.parentElement.classList.toggle('open'); }
function tnToggleFb(){ const f=document.getElementById('tn-fb'); if(f){ f.style.display=f.style.display==='none'?'block':'none'; if(f.style.display==='block'){const i=document.getElementById('tn-fb-inp'); if(i)i.focus();} } }
function tnConfirm(){
  if(!TN.phieu) return;
  supa.rpc('fn_tn_confirm',{p_ma:TN.ma,p_password:TN.pw,p_phieu_id:TN.phieu.id}).then(({data})=>{
    if(data&&data.success){ if(typeof showToast==='function')showToast('✓ Đã xác nhận','ok'); tnLoadKy(TN.ky); }
    else if(typeof showToast==='function') showToast((data&&data.error)||'Lỗi','warn');
  });
}
function tnSendFb(){
  const i=document.getElementById('tn-fb-inp'); const txt=i?i.value.trim():'';
  if(!txt){ if(typeof showToast==='function')showToast('Nhập nội dung','warn'); return; }
  supa.rpc('fn_tn_feedback',{p_ma:TN.ma,p_password:TN.pw,p_phieu_id:TN.phieu.id,p_noi_dung:txt}).then(({data})=>{
    if(data&&data.success){ TN._fbSent=TN._fbSent||{}; if(TN.phieu)TN._fbSent[TN.phieu.id]=1; if(typeof showToast==='function')showToast('✓ Đã gửi ý kiến','ok'); tnLoadKy(TN.ky); }
    else if(typeof showToast==='function') showToast((data&&data.error)||'Lỗi','warn');
  });
}
function tnLeavePage(){ /* giữ pw trong phiên; xóa khi logout (móc doLogout) */ }

// ═══ [2A] BUỘC XÁC NHẬN / GỬI Ý KIẾN KHI RỜI PHIẾU CHƯA XÁC NHẬN ═══════════
// Móc trong goToPage (02-system): rời trang 'tn' mà đang mở 1 phiếu CHƯA xác nhận
// → chặn điều hướng, bật modal 2 nút. Bấm ra ngoài = ở lại xem tiếp (không thoát lén).
function tnLeaveGuard(pendingPage){
  try{
    if(TN._leaveOk){ TN._leaveOk=false; return false; }        // vừa được cho phép đi qua
    if(_tnLaCH()) return false;                                  // tài khoản cửa hàng: không áp
    if(!TN.pw || !TN.phieu || !TN.phieu.id) return false;       // chưa mở phiếu nào
    if(TN.phieu.xacNhanLuc) return false;                       // đã xác nhận → cho đi tự do
    if(TN._fbSent && TN._fbSent[TN.phieu.id]) return false;     // đã gửi ý kiến phiếu này → không nhắc lại
    TN._pendingPage = pendingPage || 'home';
    tnLeaveModal();
    return true;                                                // chặn điều hướng
  }catch(e){ return false; }                                    // lỗi bất ngờ → KHÔNG nhốt người dùng
}
function tnLeaveModal(){
  let ov=document.getElementById('tn-leave-ov');
  if(!ov){ ov=document.createElement('div'); ov.id='tn-leave-ov'; ov.className='tn-leave-ov'; document.body.appendChild(ov); }
  const p=TN.phieu||{}, d=p.duLieu||{};
  ov.innerHTML=
    '<div class="tn-leave-bd" onclick="tnLeaveStay()"></div>'+
    '<div class="tn-leave-box" role="dialog" aria-modal="true" aria-labelledby="tn-leave-t">'+
      '<div class="tn-leave-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>'+
      '<div class="tn-leave-t" id="tn-leave-t">Xác nhận trước khi thoát</div>'+
      '<div class="tn-leave-s">Bạn vừa xem phiếu <b>'+_tnEsc(p.kyTen||p.ky||'')+'</b>'+
        (_tnHasVal(d.tong_thuc_lanh)?' — thực lãnh <b>'+_tnMoney(d.tong_thuc_lanh)+' ₫</b>':'')+'.'+
        '<br>Vui lòng xác nhận đã xem, hoặc gửi ý kiến nếu có sai sót.</div>'+
      '<div id="tn-leave-fb" class="tn-leave-fb" style="display:none"><textarea id="tn-leave-fb-inp" class="tn-ta" placeholder="Nhập ý kiến/thắc mắc về phiếu này gửi quản trị..."></textarea><div id="tn-leave-fb-err" class="tn-err"></div></div>'+
      '<div class="tn-leave-acts">'+
        '<button class="tn-btn-ok wide" onclick="tnLeaveConfirm(this)">Đã xem &amp; xác nhận</button>'+
        '<button class="tn-btn-ghost" id="tn-leave-fbbtn" onclick="tnLeaveFb(this)">Gửi ý kiến</button>'+
      '</div>'+
      '<div class="tn-leave-hint">Chạm ra ngoài để xem lại phiếu</div>'+
    '</div>';
  ov.classList.add('show');
}
function _tnLeaveClose(){ const ov=document.getElementById('tn-leave-ov'); if(ov){ ov.classList.remove('show'); ov.innerHTML=''; } }
function tnLeaveStay(){ _tnLeaveClose(); TN._pendingPage=null; }
function tnLeaveGo(){ TN._leaveOk=true; _tnLeaveClose(); const pg=TN._pendingPage||'home'; TN._pendingPage=null; try{ goToPage(pg); }catch(e){} }
function tnLeaveConfirm(btn){
  if(!TN.phieu){ tnLeaveGo(); return; }
  if(btn){ btn.disabled=true; btn.textContent='Đang xác nhận...'; }
  supa.rpc('fn_tn_confirm',{p_ma:TN.ma,p_password:TN.pw,p_phieu_id:TN.phieu.id}).then(({data})=>{
    if(data&&data.success){
      try{ TN.phieu.xacNhanLuc=new Date().toISOString(); }catch(e){}
      if(typeof showToast==='function')showToast('✓ Đã xác nhận phiếu','ok');
      tnLeaveGo();
    } else {
      if(btn){ btn.disabled=false; btn.textContent='Đã xem & xác nhận'; }
      if(typeof showToast==='function')showToast((data&&data.error)||'Không xác nhận được','warn');
    }
  }).catch(()=>{ if(btn){ btn.disabled=false; btn.textContent='Đã xem & xác nhận'; } if(typeof showToast==='function')showToast('Lỗi kết nối','warn'); });
}
function tnLeaveFb(btn){
  const box=document.getElementById('tn-leave-fb');
  if(box && box.style.display==='none'){        // lần bấm đầu: mở ô nhập, nút thành "Gửi"
    box.style.display='block';
    if(btn){ btn.textContent='Gửi'; btn.classList.remove('tn-btn-ghost'); btn.classList.add('tn-btn-teal'); }
    const i=document.getElementById('tn-leave-fb-inp'); if(i)i.focus();
    return;
  }
  const i=document.getElementById('tn-leave-fb-inp'); const txt=i?i.value.trim():'';
  const err=document.getElementById('tn-leave-fb-err');
  if(!txt){ if(err)err.textContent='Vui lòng nhập nội dung ý kiến.'; if(i)i.focus(); return; }
  if(btn){ btn.disabled=true; btn.textContent='Đang gửi...'; }
  supa.rpc('fn_tn_feedback',{p_ma:TN.ma,p_password:TN.pw,p_phieu_id:TN.phieu.id,p_noi_dung:txt}).then(({data})=>{
    if(data&&data.success){
      TN._fbSent=TN._fbSent||{}; TN._fbSent[TN.phieu.id]=1;   // đã gửi → không nhắc lại phiếu này
      if(typeof showToast==='function')showToast('✓ Đã gửi ý kiến đến quản trị','ok');
      tnLeaveGo();
    } else { if(btn){ btn.disabled=false; btn.textContent='Gửi'; } if(err)err.textContent=(data&&data.error)||'Gửi không thành công.'; }
  }).catch(()=>{ if(btn){ btn.disabled=false; btn.textContent='Gửi'; } if(err)err.textContent='Lỗi kết nối.'; });
}
try{ window.tnLeaveGuard=tnLeaveGuard; window.tnLeaveStay=tnLeaveStay; window.tnLeaveConfirm=tnLeaveConfirm; window.tnLeaveFb=tnLeaveFb; }catch(e){}

// ═══ ADMIN CONSOLE ═══════════════════════════════════════════════════════
function tnAdminInitPage(){
  if(!(typeof SESSION!=='undefined'&&SESSION&&SESSION.vaiTro==='ADMIN')){ try{goToPage('home');}catch(e){} return; }
  TN.ma=SESSION.ma;
  if(TN.pw) tnAdminShell(); else tnAdminGate();
}
function tnAdminGate(){
  const root=document.getElementById('tn-ad-body'); if(!root) return;
  root.innerHTML='<div class="tn-gate"><div class="tn-gate-t">Xác thực quản trị</div>'+
    '<div class="tn-gate-s">Nhập lại mật khẩu để vào quản lý TN.</div>'+
    '<input id="tn-ad-pw" class="tn-inp" type="password" placeholder="Mật khẩu" onkeydown="if(event.key===\'Enter\')tnAdminVerify()">'+
    '<div id="tn-ad-err" class="tn-err"></div><button class="tn-btn-ok" onclick="tnAdminVerify()">Vào quản lý</button></div>';
  setTimeout(()=>{const i=document.getElementById('tn-ad-pw'); if(i)i.focus();},60);
}
function tnAdminVerify(){
  let pw=(document.getElementById('tn-ad-pw')||{}).value; pw=(pw||'').trim();
  const err=document.getElementById('tn-ad-err');
  if(!pw){ if(err)err.textContent='Nhập mật khẩu.'; return; }
  supa.rpc('fn_tn_admin_list',{p_ma:TN.ma,p_password:pw,p_ky:null}).then(({data,error})=>{
    if(error||!data||!data.success){ if(err)err.textContent=(data&&data.error)||'Thất bại.'; return; }
    TN.pw=pw; TN.adData=data; TN.adKy=(data.kyList&&data.kyList[0])?data.kyList[0].ky:null; tnAdminShell();
  });
}
function tnAdminShell(){
  const root=document.getElementById('tn-ad-body'); if(!root) return;
  if(!TN.adData || (TN.adData.kyList||[]).length===0){
    root.innerHTML=tnAdminSyncCardHtml()+'<div class="tn-empty" style="margin-top:14px">Chưa có kỳ nào. Cấu hình nguồn rồi bấm Đồng bộ.</div>';
    return;
  }
  root.innerHTML=tnAdminSyncCardHtml()+'<div id="tn-ad-main"></div>';
  tnAdminLoad(TN.adKy);
}
function tnAdminSyncCardHtml(){
  const kySel=(TN.adData&&TN.adData.kyList||[]).map(k=>'<option value="'+k.ky+'"'+(k.ky===TN.adKy?' selected':'')+'>'+_tnEsc(k.ten||k.ky)+'</option>').join('');
  // [v18.36] mặc định = THÁNG TRƯỚC (lương tháng N chốt đầu tháng N+1)
  const now=new Date(); const pm=new Date(now.getFullYear(), now.getMonth()-1, 1); const defM=pm.getFullYear()+'-'+String(pm.getMonth()+1).padStart(2,'0');
  return '<div class="tn-card"><div class="tn-ad-top"><div><div class="tn-ad-title">Đồng bộ dữ liệu</div>'+
    '<div class="tn-ad-sub">Kéo TẤT CẢ dòng trong sheet TN vào kỳ. Secret chỉ giữ trong phiên — không lưu trên máy.</div></div>'+
    (kySel?'<select class="tn-sel" title="Xem kỳ đã có" onchange="tnAdminLoad(this.value)">'+kySel+'</select>':'')+'</div>'+
    '<div class="tn-sync-row">'+
      '<div class="tn-fld"><label>Kỳ đồng bộ vào</label><input id="tn-sync-month" class="tn-inp sm" type="month" value="'+defM+'"></div>'+
      '<div class="tn-fld"><label>Secret <span class="tn-nolock">không lưu</span></label><input id="tn-secret" class="tn-inp sm" type="password" placeholder="Nhập secret" autocomplete="off"></div>'+
      '<button class="tn-btn-ok tn-sync-btn" onclick="tnAdminSyncNow()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Đồng bộ ngay</button>'+
      '<label class="tn-btn-ghost tn-file">Tải CSV<input type="file" accept=".csv" style="display:none" onchange="tnAdminCsv(this)"></label>'+
    '</div></div>';
}
function _tnSyncKy(){ const m=(document.getElementById('tn-sync-month')||{}).value||new Date().toISOString().slice(0,7); return {ky:m, ten:'Tháng '+parseInt(m.slice(5))+', '+m.slice(0,4)}; }
function tnAdminSyncNow(){
  const sec=((document.getElementById('tn-secret')||{}).value||'').trim();
  if(!sec){ if(typeof showToast==='function')showToast('Nhập secret để đồng bộ','warn'); const i=document.getElementById('tn-secret'); if(i)i.focus(); return; }
  const k=_tnSyncKy();
  if(typeof showToast==='function')showToast('Đang lấy dữ liệu từ Sheet...','ok');
  const url=TN.syncUrl+(TN.syncUrl.indexOf('?')>=0?'&':'?')+'secret='+encodeURIComponent(sec);
  fetch(url).then(r=>r.json()).then(res=>{
    if(!res||!res.success){ if(typeof showToast==='function')showToast('Sheet: '+((res&&res.error)||'lỗi — kiểm secret'),'err'); return; }
    tnAdminDoSync(k.ky,k.ten,res.rows||[]);
  }).catch(()=>{ if(typeof showToast==='function')showToast('Lỗi lấy Sheet (kiểm secret/CORS)','err'); });
}
function tnAdminCsv(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const k=_tnSyncKy();
  const rd=new FileReader();
  rd.onload=()=>{ const rows=tnParseCsv(rd.result); inp.value=''; if(!rows.length){if(typeof showToast==='function')showToast('CSV rỗng/không đọc được','warn');return;} tnAdminDoSync(k.ky,k.ten,rows); };
  rd.readAsText(f,'utf-8');
}
const TN_KEYS=['stt','ma_nv','ma_ns','ho_ten','chuc_vu','cua_hang','ma_ch','khu_vuc','luong_cb','hieu_qua_cv','bhxh_tham_gia','pc_com','pc_xang','pc_dilai','thuong_hieu_qua','pc_trach_nhiem','tong_gio_cong','gio_chuan','thanh_tien','gio_12','tangca_12','gio_x2','tangca_20','gio_x3','tangca_30','hieu_qua_thanhtien','nghi_phep','hh_cht','hh_nvbhsx','hh_dungca_db','online_tiktok','sale_hoahong','sale_tai_ch','cong_tac_phi','ho_tro_khac','com_doi_live','com_ch','thanhtoan_phep_nam','ngay_vao_lam','tham_nien','tien_tham_nien','tong_thu_nhap','tong_tn_ck','tong_tn_tm','bhxh_8','bhyt_15','bhtn_1','bhxh_105','nguoi_phu_thuoc','giam_tru_gia_canh','com_khong_thue','tn_chiu_thue','thue_tncn','tong_tam_ung','tn_da_nhan','tru_khac','tong_phai_tru','tong_thuc_lanh','thuc_nhan_ck','thuc_nhan_tm','tk_ten','tk_stk','tk_nganhang','tk_chinhanh','tk_gmail','tong_gio_cong2','tong_ngay_nghi','phep_su_dung','phep_con_lai'];
function tnParseCsv(text){
  const lines=String(text).replace(/\r/g,'').split('\n').filter(l=>l.length); const out=[];
  for(let i=1;i<lines.length;i++){
    const cells=tnCsvLine(lines[i]); const ma=(cells[1]||'').trim(); if(!ma) continue;
    const o={}; for(let c=0;c<TN_KEYS.length;c++){ o[TN_KEYS[c]]=cells[c]!==undefined?cells[c]:''; } out.push(o);
  }
  return out;
}
function tnCsvLine(line){ const r=[]; let cur='',q=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(q){ if(ch==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; } else { if(ch==='"')q=true; else if(ch===','){r.push(cur);cur='';} else cur+=ch; } } r.push(cur); return r; }
function tnAdminDoSync(ky,ten,rows){
  if(typeof showToast==='function')showToast('Đang ghi '+rows.length+' phiếu...','ok');
  supa.rpc('fn_tn_sync',{p_ma:TN.ma,p_password:TN.pw,p_ky:ky,p_ten:ten,p_rows:rows}).then(({data,error})=>{
    if(error||!data||!data.success){ if(typeof showToast==='function')showToast('Đồng bộ lỗi: '+((data&&data.error)||(error&&error.message)),'err'); return; }
    if(typeof showToast==='function')showToast('✓ Đã đồng bộ '+data.so_phieu+' phiếu kỳ '+ky,'ok');
    TN.adKy=ky; supa.rpc('fn_tn_admin_list',{p_ma:TN.ma,p_password:TN.pw,p_ky:ky}).then(({data:d2})=>{ if(d2&&d2.success){TN.adData=d2; tnAdminShell();} });
  });
}
function tnAdminLoad(ky){
  TN.adKy=ky;
  supa.rpc('fn_tn_admin_list',{p_ma:TN.ma,p_password:TN.pw,p_ky:ky}).then(({data,error})=>{
    if(error||!data||!data.success){ if(typeof showToast==='function')showToast('Lỗi tải','err'); return; }
    TN.adData=data; tnAdminRenderMain();
  });
}
function tnAdminRenderMain(){
  const root=document.getElementById('tn-ad-main'); if(!root) return;
  if(!TN.adFilter)TN.adFilter='all'; if(!TN.adSort)TN.adSort={col:'hoTen',dir:1};
  const list=TN.adData.danhSach||[];
  const c={xem:0,xn:0,yk:0}; list.forEach(p=>{ if(p.xemLuc)c.xem++; if(p.xacNhanLuc)c.xn++; if(p.coYkien && p.chuaTraLoi)c.yk++; });
  const den=TN.adData.hienAllDen? new Date(TN.adData.hienAllDen):null;
  const hienAllEff=!!TN.adData.hienAll && (!den || den.getTime()>Date.now());
  // [v18.36] thẻ số = FILTER (bấm để lọc)
  let h='<div class="tn-stats">'+
    _tnStatF('all',list.length,'Phiếu')+_tnStatF('xem',c.xem,'Đã xem')+_tnStatF('xacnhan',c.xn,'Đã xác nhận')+_tnStatF('ykien',c.yk,'Ý kiến chờ',c.yk>0)+'</div>';
  // [v18.36] Mở tất cả + hẹn giờ tự tắt
  h+='<div class="tn-card"><div class="tn-openall">'+
     '<label class="tn-tgl-lbl">Mở tất cả kỳ này <button class="tn-tgl'+(hienAllEff?' on':'')+'" onclick="tnAdOpenAll('+(!hienAllEff)+')"></button></label>'+
     '<select id="tn-openall-dur" class="tn-sel sm" onchange="tnAdDurChange(this.value)" title="Thời hạn mở"><option value="0">Vĩnh viễn</option><option value="24">Trong 24 giờ</option><option value="72">Trong 3 ngày</option><option value="168">Trong 7 ngày</option><option value="date">Đến ngày…</option></select>'+
     '<input id="tn-openall-date" type="datetime-local" class="tn-inp sm" style="display:none">'+
     tnOpenAllStatus(hienAllEff,den)+
     '<label class="tn-tgl-lbl tn-paydate-fld"><span class="tn-gold-dot"></span>Ngày chi lương <input type="date" id="tn-ngaychi" class="tn-inp sm" value="'+_tnEsc((TN.adData.ngayChi||'').slice(0,10))+'" onchange="tnAdSetNgayChi(this.value)"></label>'+
     '</div>';
  // [Request 4] Thanh lọc: tìm tên/mã NV + lọc theo cửa hàng
  const chSet=[...new Set(list.map(p=>p.maCH).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  h+='<div class="tn-ad-tools">'+
     '<div class="tn-ad-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'+
       '<input id="tn-ad-search" type="search" placeholder="Tìm tên hoặc mã nhân viên…" value="'+_tnEsc(TN.adSearch||'')+'" oninput="tnAdApplyFilter()"></div>'+
     '<select id="tn-ad-ch" class="tn-sel sm" onchange="tnAdApplyFilter()"><option value="">Tất cả cửa hàng ('+chSet.length+')</option>'+
       chSet.map(ch=>'<option value="'+_tnEsc(ch)+'"'+(TN.adCH===ch?' selected':'')+'>'+_tnEsc(ch)+'</option>').join('')+'</select>'+
     '</div>';
  h+='<div class="tn-tbl-wrap"><div id="tn-ad-tbl"></div></div><div id="tn-ad-thread"></div>';
  root.innerHTML=h;
  tnAdRenderTable();
  tnStartCountdown();
}
// [Request 4] Vẽ RIÊNG phần bảng (lọc/tìm/sort chỉ vẽ lại đây → không mất focus ô tìm, không restart đồng hồ)
function tnAdRenderTable(){
  const box=document.getElementById('tn-ad-tbl'); if(!box || !TN.adData) return;
  const list=TN.adData.danhSach||[];
  const den=TN.adData.hienAllDen? new Date(TN.adData.hienAllDen):null;
  const hienAllEff=!!TN.adData.hienAll && (!den || den.getTime()>Date.now());
  const rows=tnAdFilterSort(list);
  let h='<table class="tn-tbl"><thead><tr>'+
     tnTh('hoTen','Nhân viên')+tnTh('maCH','Cửa hàng')+tnTh('thucLanh','Thực lãnh','r')+tnTh('trangThai','Trạng thái')+'<th>Hiện</th></tr></thead><tbody>';
  rows.forEach(p=>{
    h+='<tr><td><button class="tn-nv-open" onclick="tnAdminViewPhieu(\''+p.id+'\')" title="Xem bảng lương chi tiết"><b>'+_tnEsc(p.hoTen||p.maNV)+'</b><small>'+_tnEsc(p.maNV)+'</small></button></td><td>'+_tnEsc(p.maCH||'—')+'</td>'+
       '<td class="r">'+_tnMoney(p.thucLanh)+'</td><td>'+tnPill(p)+'</td>'+
       '<td><button class="tn-tgl sm'+((p.hien||hienAllEff)?' on':'')+'" '+(hienAllEff?'disabled title="Đang mở tất cả"':'onclick="tnAdminToggleOne(\''+p.maNV+'\','+(!p.hien)+')"')+'></button></td></tr>';
    if(p.coYkien){ h+='<tr class="tn-fb-row"><td colspan="5"><button class="tn-fb-open" onclick="tnAdminOpenThread(\''+p.id+'\',\''+_tnEsc(p.hoTen||p.maNV)+'\')">💬 Xem &amp; trả lời ý kiến của '+_tnEsc(p.hoTen||p.maNV)+(p.chuaTraLoi?' <span class="tn-new">mới</span>':'')+'</button></td></tr>'; }
  });
  h+='</tbody></table>'+(rows.length?'':'<div class="tn-empty" style="margin-top:8px">Không có phiếu khớp bộ lọc</div>');
  box.innerHTML=h;
}
function tnAdApplyFilter(){
  TN.adSearch=(document.getElementById('tn-ad-search')||{}).value||'';
  TN.adCH=(document.getElementById('tn-ad-ch')||{}).value||'';
  tnAdRenderTable();
}
// [v18.38] Đồng hồ đếm ngược tới lúc "Mở tất cả" tự tắt (nhảy giờ:phút:giây)
function tnStartCountdown(){
  if(TN.cdTimer){ clearInterval(TN.cdTimer); TN.cdTimer=null; }
  if(!document.getElementById('tn-countdown')) return;
  const pad=n=>('0'+n).slice(-2);
  const tick=()=>{
    const e=document.getElementById('tn-countdown');
    if(!e){ if(TN.cdTimer){clearInterval(TN.cdTimer);TN.cdTimer=null;} return; }
    let ms=new Date(e.getAttribute('data-den')).getTime()-Date.now();
    if(ms<=0){ e.innerHTML='<b style="color:#C6373C">Đã hết hạn — đang tự ẩn…</b>'; clearInterval(TN.cdTimer); TN.cdTimer=null; setTimeout(()=>{try{tnAdminLoad(TN.adKy);}catch(x){}},1500); return; }
    const d=Math.floor(ms/86400000); ms-=d*86400000;
    const h=Math.floor(ms/3600000); ms-=h*3600000;
    const m=Math.floor(ms/60000); ms-=m*60000;
    const s=Math.floor(ms/1000);
    e.innerHTML='● Đang mở · còn <b class="tn-cd-num">'+(d>0?d+' ngày ':'')+pad(h)+':'+pad(m)+':'+pad(s)+'</b>';
  };
  tick(); TN.cdTimer=setInterval(tick,1000);
}
function _tnStatF(f,n,l,warn){ return '<button type="button" class="tn-stat'+(warn?' warn':'')+(TN.adFilter===f?' active':'')+'" onclick="tnAdSetFilter(\''+f+'\')"><div class="n">'+n+'</div><div class="l">'+_tnEsc(l)+'</div></button>'; }
function tnAdSetFilter(f){ TN.adFilter=(TN.adFilter===f && f!=='all')?'all':f; tnAdminRenderMain(); }
function tnTh(col,label,cls){ const s=TN.adSort; const arr=(s.col===col)?(s.dir>0?' ↑':' ↓'):''; return '<th class="'+(cls||'')+' tn-th-sort" onclick="tnAdSort(\''+col+'\')">'+_tnEsc(label)+arr+'</th>'; }
function tnAdSort(col){ const s=TN.adSort; if(s.col===col)s.dir=-s.dir; else {s.col=col;s.dir=1;} tnAdRenderTable(); }
function tnAdFilterSort(list){
  let r=list.slice(); const f=TN.adFilter;
  if(f==='xem')r=r.filter(p=>p.xemLuc); else if(f==='xacnhan')r=r.filter(p=>p.xacNhanLuc); else if(f==='ykien')r=r.filter(p=>p.coYkien&&p.chuaTraLoi);
  // [Request 4] tìm tên/mã + lọc cửa hàng
  const q=(TN.adSearch||'').trim().toLowerCase();
  if(q) r=r.filter(p=>(String(p.hoTen||'')+' '+String(p.maNV||'')).toLowerCase().includes(q));
  if(TN.adCH) r=r.filter(p=>p.maCH===TN.adCH);
  const s=TN.adSort;
  r.sort((a,b)=>{ let va,vb; if(s.col==='thucLanh'){va=_tnNum(a.thucLanh);vb=_tnNum(b.thucLanh);} else {va=(a[s.col]||'').toString().toLowerCase();vb=(b[s.col]||'').toString().toLowerCase();} return (va<vb?-1:va>vb?1:0)*s.dir; });
  return r;
}
function tnOpenAllStatus(eff,den){
  if(!eff) return '<span class="tn-openall-st">Đang ẩn với NV</span>';
  if(!den) return '<span class="tn-openall-st">● Đang mở · vĩnh viễn</span>';
  if(den.getTime()-Date.now()<=0) return '<span class="tn-openall-st">Đã hết hạn (ẩn)</span>';
  return '<span class="tn-openall-st" id="tn-countdown" data-den="'+den.toISOString()+'">● Đang mở…</span>';
}
function tnAdDurChange(v){ const d=document.getElementById('tn-openall-date'); if(d)d.style.display=(v==='date')?'':'none'; }
// [v18.39] Đặt ngày chi lương cho kỳ → hiển thị trên phiếu NV
function tnAdSetNgayChi(v){
  supa.rpc('fn_tn_admin_ngaychi',{p_ma:TN.ma,p_password:TN.pw,p_ky:TN.adKy,p_ngay:v||null}).then(({data,error})=>{
    if(error && /find the function|does not exist|schema cache/i.test(error.message||'')){ if(typeof showToast==='function')showToast('Hãy chạy SQL tn_v3_ngaychi.sql trước','warn'); return; }
    if(data&&data.success){ if(typeof showToast==='function')showToast(v?('✓ Ngày chi lương: '+_tnDate(v)):'✓ Đã xóa ngày chi','ok'); if(TN.adData)TN.adData.ngayChi=v||null; }
    else if(typeof showToast==='function')showToast((data&&data.error)||'Lỗi','warn');
  });
}
function tnAdOpenAll(on){
  let den=null;
  if(on){
    const dur=((document.getElementById('tn-openall-dur')||{}).value)||'0';
    if(dur==='date'){ const dv=(document.getElementById('tn-openall-date')||{}).value; if(!dv){ if(typeof showToast==='function')showToast('Chọn ngày giờ tự tắt','warn'); return; } den=new Date(dv).toISOString(); }
    else if(dur!=='0'){ den=new Date(Date.now()+parseInt(dur)*3600000).toISOString(); }
  }
  const done=(data)=>{ if(data&&data.success){ if(typeof showToast==='function')showToast(on?'✓ Đã mở tất cả':'✓ Đã ẩn','ok'); tnAdminLoad(TN.adKy); } else if(typeof showToast==='function')showToast((data&&data.error)||'Lỗi','warn'); };
  supa.rpc('fn_tn_admin_toggle',{p_ma:TN.ma,p_password:TN.pw,p_ky:TN.adKy,p_ma_nv:null,p_hien:on,p_hien_all_den:den}).then(({data,error})=>{
    if(error && /find the function|does not exist|schema cache|p_hien_all_den/i.test(error.message||'')){
      // RPC cũ chưa có tham số hạn (chưa chạy tn_v2_hengio.sql) → lùi về 5 tham số, không hẹn giờ
      if(den && typeof showToast==='function')showToast('Chưa bật được hẹn giờ — hãy chạy SQL tn_v2_hengio.sql','warn');
      supa.rpc('fn_tn_admin_toggle',{p_ma:TN.ma,p_password:TN.pw,p_ky:TN.adKy,p_ma_nv:null,p_hien:on}).then(({data:d2})=>done(d2));
    } else done(data);
  });
}
function tnPill(p){
  const s=p.trangThai;
  const m={AN:['p-hid','Chưa mở'],MO:['p-hid','Đã mở'],DA_XEM:['p-seen','Đã xem'],DA_XAC_NHAN:['p-ok','Đã xác nhận'],CO_YKIEN:['p-fb','Có ý kiến'],HOAN_TAT:['p-ok','Hoàn tất']}[s]||['p-hid',s];
  return '<span class="tn-pill '+m[0]+'">'+m[1]+'</span>';
}
function tnAdminToggleAll(v){ supa.rpc('fn_tn_admin_toggle',{p_ma:TN.ma,p_password:TN.pw,p_ky:TN.adKy,p_ma_nv:null,p_hien:v}).then(()=>tnAdminLoad(TN.adKy)); }
function tnAdminToggleOne(ma,v){ supa.rpc('fn_tn_admin_toggle',{p_ma:TN.ma,p_password:TN.pw,p_ky:TN.adKy,p_ma_nv:ma,p_hien:v}).then(()=>tnAdminLoad(TN.adKy)); }
function tnAdminOpenThread(id,ten){
  TN.adThreadId=id;
  supa.rpc('fn_tn_admin_thread',{p_ma:TN.ma,p_password:TN.pw,p_phieu_id:id}).then(({data})=>{
    if(!data||!data.success) return;
    const box=document.getElementById('tn-ad-thread'); if(!box) return;
    box.innerHTML='<div class="tn-card"><div class="tn-ad-title" style="font-size:14px;margin-bottom:8px">Ý kiến · '+_tnEsc(ten)+'</div>'+
      tnThreadHtml(data.phanHoi)+
      '<div class="tn-fb" style="display:block;margin-top:10px"><textarea id="tn-ad-reply" class="tn-ta" placeholder="Trả lời nhân viên..."></textarea><button class="tn-btn-teal" onclick="tnAdminReply()">Gửi trả lời</button></div></div>';
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
}
function tnAdminReply(){
  let t=(document.getElementById('tn-ad-reply')||{}).value; t=(t||'').trim();
  if(!t){ if(typeof showToast==='function')showToast('Nhập nội dung','warn'); return; }
  supa.rpc('fn_tn_admin_reply',{p_ma:TN.ma,p_password:TN.pw,p_phieu_id:TN.adThreadId,p_noi_dung:t}).then(({data})=>{
    if(data&&data.success){ if(typeof showToast==='function')showToast('✓ Đã gửi','ok'); tnAdminOpenThread(TN.adThreadId,''); tnAdminLoad(TN.adKy); }
  });
}
// ═══ [Request 1] ADMIN BẤM 1 NV → XEM BẢNG LƯƠNG CHI TIẾT (chỉ-đọc, như NV tự xem) ═══
// Dùng lại fn_tn_admin_thread (đã xác thực ADMIN). SQL tn_v5_adminphieu.sql bổ sung
// cho RPC này trả THÊM duLieu/ky/kyTen/ngayChi/xacNhanLuc (tương thích ngược).
function tnAdminViewPhieu(phieuId){
  if(!phieuId) return;
  const row=(TN.adData&&TN.adData.danhSach||[]).find(x=>String(x.id)===String(phieuId));
  const hoTen=row?(row.hoTen||row.maNV):'';
  supa.rpc('fn_tn_admin_thread',{p_ma:TN.ma,p_password:TN.pw,p_phieu_id:phieuId}).then(({data,error})=>{
    if(error||!data||!data.success){ if(typeof showToast==='function')showToast((data&&data.error)||'Không tải được phiếu','warn'); return; }
    if(!data.duLieu){ if(typeof showToast==='function')showToast('Phiếu này chưa có dữ liệu chi tiết','warn'); return; }
    // fn_tn_admin_thread đã trả duLieu+hoTen+phanHoi; bổ sung nhãn kỳ/ngày chi/xác nhận từ state admin (KHÔNG cần SQL)
    const kyObj=(TN.adData&&TN.adData.kyList||[]).find(k=>k.ky===TN.adKy);
    data.ky = data.ky || TN.adKy;
    data.kyTen = data.kyTen || (kyObj?(kyObj.ten||kyObj.ky):TN.adKy);
    data.ngayChi = data.ngayChi || (TN.adData&&TN.adData.ngayChi) || null;
    data.xacNhanLuc = data.xacNhanLuc || (row?row.xacNhanLuc:null);
    tnAdminPhieuModal(data, hoTen||data.hoTen);
  }).catch(()=>{ if(typeof showToast==='function')showToast('Lỗi kết nối','warn'); });
}
function tnAdminPhieuModal(p, hoTen){
  let ov=document.getElementById('tn-apv-ov');
  if(!ov){ ov=document.createElement('div'); ov.id='tn-apv-ov'; ov.className='tn-apv-ov'; document.body.appendChild(ov); }
  const d=p.duLieu||{};
  const thread=(p.phanHoi&&p.phanHoi.length)?('<div class="tn-slip-foot">'+tnThreadHtml(p.phanHoi)+'</div>'):'';
  ov.innerHTML=
    '<div class="tn-apv-bd" onclick="tnAdminPhieuClose()"></div>'+
    '<div class="tn-apv-box">'+
      '<div class="tn-apv-bar"><span class="tn-apv-ttl">Bảng lương · '+_tnEsc(hoTen||d.ho_ten||'')+'</span>'+
        '<button class="tn-apv-x" onclick="tnAdminPhieuClose()" aria-label="Đóng">✕</button></div>'+
      '<div class="tn-apv-scroll"><div class="tn-slip">'+_tnSlipCore(p,d)+thread+'</div></div>'+
    '</div>';
  ov.classList.add('show');
}
function tnAdminPhieuClose(){ const ov=document.getElementById('tn-apv-ov'); if(ov){ ov.classList.remove('show'); ov.innerHTML=''; } }
try{ window.tnAdminViewPhieu=tnAdminViewPhieu; window.tnAdminPhieuClose=tnAdminPhieuClose; }catch(e){}

try{ window.tnInitPage=tnInitPage; window.tnAdminInitPage=tnAdminInitPage; }catch(e){}
