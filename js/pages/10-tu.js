// ═══════════════════════════════════════════════════════════════════════════
//  PHÂN HỆ TẠM ỨNG  (phiếu tạm ứng cá nhân — nhạy cảm, verify mật khẩu server-side)
//  Song song TN, phiếu gọn (1 mức ứng). Tái dùng class .tn-* + style v18.
//  Nguồn: sheet "TU" (20 cột A→T). Khớp NV theo MÃ NS (cột T).
// ═══════════════════════════════════════════════════════════════════════════
const TU = { pw:null, ma:null, kyList:[], ky:null, phieu:null,
             adKy:null, adData:null, adSearch:'', adCH:'',
             syncUrl:(localStorage.getItem('tn_sync_url')||'https://script.google.com/macros/s/AKfycbxKNNRjt0K3gM0k60bi3alHGEG-e6rFZwgicOXFXLjHtd9sNvuRSqVri8LAbRFvGzgLrQ/exec') };

// 20 key theo cột A→T sheet TU. Cột B="MÃ NV"(BH)→ma_bh; cột T="Mã NS"→ma_nv (khớp login).
const TU_KEYS=['stt','ma_bh','ho_ten','chuc_vu','cua_hang','ma_ch','khu_vuc','luong_cb','luong_bh','ngay_vao_lam',
  'bhxh_105','muc_ung','chuyen_khoan','tien_mat','tk_ten','tk_stk','tk_nganhang','tk_chinhanh','tk_gmail','ma_nv'];

function _tuLaCH(){ return typeof _laCuaHang==='function' && _laCuaHang(); }
function _tuEsc(s){ return String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
function _tuNum(v){ if(v==null||v==='') return 0; const n=(typeof v==='number')?v:parseFloat(String(v).replace(/[^\d.-]/g,'')); return isNaN(n)?0:n; }
function _tuMoney(v){ return Math.round(_tuNum(v)).toLocaleString('vi-VN'); }
function _tuHasVal(v){ if(v==null||v==='') return false; if(typeof v==='number') return v!==0; const s=String(v).trim(); if(!s||s==='0') return false; return _tuNum(v)!==0 || /[a-zA-Z]/.test(s); }
function _tuDt(t){ if(!t)return''; const d=new Date(t); return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
function _tuDate(s){ if(!s)return''; const p=String(s).slice(0,10).split('-'); return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):String(s); }
function _tuWho(l,v){ return '<div><span>'+_tuEsc(l)+'</span><b>'+(_tuEsc(v)||'—')+'</b></div>'; }

// ═══ NHÂN VIÊN ═══════════════════════════════════════════════════════════
function tuInitPage(){
  if(_tuLaCH()){ if(typeof showToast==='function') showToast('Mục này không dành cho tài khoản cửa hàng','warn'); try{goToPage('banhang');}catch(e){} return; }
  TU.ma=(typeof SESSION!=='undefined'&&SESSION)?SESSION.ma:null;
  if(TU.pw){ tuAfterVerify(); } else { tuRenderGate(); }
}
function tuRenderGate(){
  const root=document.getElementById('tu-body'); if(!root) return;
  root.innerHTML='<div class="tn-gate">'+
    '<div class="tn-gate-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>'+
    '<div class="tn-gate-t">Xác thực để xem</div>'+
    '<div class="tn-gate-s">Nhập lại mật khẩu đăng nhập để mở phiếu tạm ứng của bạn.</div>'+
    '<input id="tu-pw" class="tn-inp" type="password" placeholder="Mật khẩu" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')tuVerify()">'+
    '<div id="tu-gate-err" class="tn-err"></div>'+
    '<button class="tn-btn-ok" onclick="tuVerify()">Mở phiếu</button></div>';
  setTimeout(()=>{const i=document.getElementById('tu-pw'); if(i)i.focus();},60);
}
function tuVerify(){
  const inp=document.getElementById('tu-pw'); const pw=inp?inp.value.trim():'';
  const err=document.getElementById('tu-gate-err');
  if(!pw){ if(err)err.textContent='Vui lòng nhập mật khẩu.'; return; }
  const btn=document.querySelector('#tu-body .tn-gate .tn-btn-ok'); if(btn){btn.disabled=true;btn.textContent='Đang xác thực...';}
  supa.rpc('fn_tu_my_kylist',{p_ma:TU.ma,p_password:pw}).then(({data,error})=>{
    if(btn){btn.disabled=false;btn.textContent='Mở phiếu';}
    if(error||!data||!data.success){ if(err)err.textContent=(data&&data.error)||'Xác thực thất bại.'; return; }
    TU.pw=pw; TU.kyList=data.danhSach||[]; tuAfterVerify();
  }).catch(()=>{ if(btn){btn.disabled=false;btn.textContent='Mở phiếu';} if(err)err.textContent='Lỗi kết nối.'; });
}
function tuAfterVerify(){
  if(!TU.kyList.length){
    supa.rpc('fn_tu_my_kylist',{p_ma:TU.ma,p_password:TU.pw}).then(({data})=>{ TU.kyList=(data&&data.danhSach)||[]; tuRenderShell(); });
  } else tuRenderShell();
}
function tuRenderShell(){
  const root=document.getElementById('tu-body'); if(!root) return;
  if(!TU.kyList.length){
    root.innerHTML='<div class="tn-empty"><div class="tn-empty-ic">📭</div><div>Chưa có kỳ tạm ứng nào được mở cho bạn.</div><div class="tn-empty-s">Khi có phiếu mới, mục này sẽ hiển thị.</div></div>';
    return;
  }
  if(!TU.ky || !TU.kyList.find(k=>k.ky===TU.ky)) TU.ky=TU.kyList[0].ky;
  const chips=TU.kyList.map(k=>'<button class="tn-ky-chip'+(k.ky===TU.ky?' on':'')+'" onclick="tuLoadKy(\''+k.ky+'\')">'+_tuEsc(k.ten||k.ky)+'</button>').join('');
  root.innerHTML='<div class="tn-ky-bar">'+chips+'</div><div id="tu-slip-wrap"><div class="tn-loading">Đang tải...</div></div>';
  tuLoadKy(TU.ky);
}
function tuLoadKy(ky){
  TU.ky=ky;
  document.querySelectorAll('#tu-body .tn-ky-chip').forEach(c=>c.classList.toggle('on', (c.getAttribute('onclick')||'').indexOf("'"+ky+"'")>=0));
  const wrap=document.getElementById('tu-slip-wrap'); if(wrap)wrap.innerHTML='<div class="tn-loading">Đang tải...</div>';
  supa.rpc('fn_tu_my_phieu',{p_ma:TU.ma,p_password:TU.pw,p_ky:ky}).then(({data,error})=>{
    if(error||!data||!data.success){ if(wrap)wrap.innerHTML='<div class="tn-empty">'+_tuEsc((data&&data.error)||'Không tải được phiếu.')+'</div>'; return; }
    TU.phieu=data; tuRenderPhieu();
  }).catch(()=>{ if(wrap)wrap.innerHTML='<div class="tn-empty">Lỗi kết nối.</div>'; });
}
// Thân phiếu tạm ứng (dùng chung NV + admin xem). Chỉ-đọc.
function _tuSlipCore(p,d){
  const daXN=!!p.xacNhanLuc;
  const maNvLine=(d.ma_bh||'')+((d.ma_nv&&d.ma_nv!==d.ma_bh)?' · '+d.ma_nv:'');
  let h='';
  h+='<div class="tn-slip-head"><div><div class="tn-kicker">TẠM ỨNG · Kỳ '+_tuEsc((p.ky||'').replace('-','/'))+'</div>'+
     '<div class="tn-slip-title">Phiếu tạm ứng '+_tuEsc(p.kyTen||p.ky)+'</div>'+
     (p.ngayNhan?'<div class="tn-paydate"><span class="tn-gold-dot"></span>Ngày nhận: '+_tuDate(p.ngayNhan)+'</div>':'')+'</div>'+
     '<span class="tn-chip '+(daXN?'ok':'live')+'"><span class="tn-dot"></span>'+(daXN?'Đã xác nhận':'Đang mở')+'</span></div>';
  h+='<div class="tn-who">'+
     _tuWho('Họ và tên', d.ho_ten)+ _tuWho('Mã nhân viên', maNvLine)+
     _tuWho('Ngày vào làm', d.ngay_vao_lam)+ _tuWho('Cửa hàng', (d.cua_hang||'')+(d.ma_ch?' · '+d.ma_ch:''))+
     _tuWho('Chức vụ', d.chuc_vu)+ _tuWho('Email', d.tk_gmail)+ '</div>';
  h+='<div class="tn-hero"><div class="tn-hero-main"><div class="tn-hero-lbl">Mức tạm ứng</div>'+
     '<div class="tn-hero-num">'+_tuMoney(d.muc_ung)+' <span>₫</span></div></div>'+
     '<div class="tn-hero-sub">'+
       ( _tuHasVal(d.chuyen_khoan) ? '<div><div class="l">Chuyển khoản</div><div class="n">'+_tuMoney(d.chuyen_khoan)+'</div></div>':'')+
       ( _tuHasVal(d.tien_mat) ? '<div><div class="l">Nhận tiền mặt</div><div class="n">'+_tuMoney(d.tien_mat)+'</div></div>':'')+
     '</div></div>';
  // Tài khoản nhận
  const tkRows=[['tk_ten','Chủ tài khoản'],['tk_stk','Số tài khoản'],['tk_nganhang','Ngân hàng'],['tk_chinhanh','Chi nhánh']].filter(r=>_tuHasVal(d[r[0]]));
  if(tkRows.length){
    h+='<div class="tn-grp open" style="--ga:#CBA45A"><button class="tn-grp-head" onclick="tuTg(this)"><span class="tn-grp-dot"></span><span class="tn-grp-name">Tài khoản nhận</span>'+
       '<span class="tn-grp-meta"><svg class="tn-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></span></button><div class="tn-grp-rows">';
    tkRows.forEach(r=>{ h+='<div class="tn-row"><span class="k">'+_tuEsc(r[1])+'</span><span class="v">'+_tuEsc(d[r[0]])+'</span></div>'; });
    h+='</div></div>';
  }
  return h;
}
// Ghi chú cuối phiếu (Phòng NS · Zalo · ngày nhận) — theo mẫu phiếu tạm ứng
function _tuNoteHtml(p){
  const zalo=p.zalo||'0902753345';
  const kyTxt=_tuEsc(p.kyTen||p.ky||'');
  let h='<div class="tu-note"><div class="hd">Phòng Nhân Sự gửi đến Anh/Chị Phiếu tạm ứng lương '+kyTxt+'</div><ul>';
  h+='<li>Nếu có thắc mắc, Anh/Chị liên hệ qua Zalo Nhân sự: <span class="zalo">'+_tuEsc(zalo)+'</span>'+(p.hanHoi?(' trước <b>'+_tuEsc(p.hanHoi)+'</b>'):'')+'</li>';
  if(p.ngayNhan) h+='<li>Ngày nhận: <span class="hl">vào ngày '+_tuDate(p.ngayNhan)+'</span></li>';
  h+='</ul><div class="thanks">Trân trọng!</div></div>';
  return h;
}
function tuRenderPhieu(){
  const wrap=document.getElementById('tu-slip-wrap'); if(!wrap) return;
  const p=TU.phieu, d=p.duLieu||{}; const daXN=!!p.xacNhanLuc;
  let h='<div class="tn-slip">'+_tuSlipCore(p,d);
  h+='<div style="padding:0 18px">'+_tuNoteHtml(p)+'</div>';
  h+='<div class="tn-slip-foot">';
  if(!daXN){
    h+='<div class="tn-actions"><button class="tn-btn-ok wide" onclick="tuConfirm()">Đã xem &amp; xác nhận</button>'+
       '<button class="tn-btn-ghost" onclick="tuToggleFb()">Gửi ý kiến</button></div>';
  } else {
    h+='<div class="tn-confirmed">✓ Bạn đã xác nhận lúc '+_tuEsc(_tuDt(p.xacNhanLuc))+'</div>'+
       '<button class="tn-btn-ghost" onclick="tuToggleFb()" style="margin-top:8px">Gửi ý kiến</button>';
  }
  h+='<div id="tu-fb" class="tn-fb" style="display:none"><textarea id="tu-fb-inp" class="tn-ta" placeholder="Nếu có sai sót hoặc thắc mắc, nhập tại đây gửi quản trị..."></textarea><button class="tn-btn-teal" onclick="tuSendFb()">Gửi</button></div>';
  h+=tuThreadHtml(p.phanHoi)+'</div></div>';
  wrap.innerHTML=h;
}
function tuThreadHtml(list){
  if(!list||!list.length) return '';
  let h='<div class="tn-thread"><div class="tn-thread-l">Trao đổi</div>';
  list.forEach(m=>{ h+='<div class="tn-msg '+(m.nguoi==='NV'?'nv':'ad')+'">'+_tuEsc(m.noiDung)+'<small>'+(m.nguoi==='NV'?'Bạn':'Quản trị')+' · '+_tuEsc(_tuDt(m.luc))+'</small></div>'; });
  return h+'</div>';
}
function tuTg(btn){ btn.parentElement.classList.toggle('open'); }
function tuToggleFb(){ const f=document.getElementById('tu-fb'); if(f){ f.style.display=f.style.display==='none'?'block':'none'; if(f.style.display==='block'){const i=document.getElementById('tu-fb-inp'); if(i)i.focus();} } }
function tuConfirm(){
  if(!TU.phieu) return;
  supa.rpc('fn_tu_confirm',{p_ma:TU.ma,p_password:TU.pw,p_phieu_id:TU.phieu.id}).then(({data})=>{
    if(data&&data.success){ if(typeof showToast==='function')showToast('✓ Đã xác nhận','ok'); tuLoadKy(TU.ky); }
    else if(typeof showToast==='function') showToast((data&&data.error)||'Lỗi','warn');
  });
}
function tuSendFb(){
  const i=document.getElementById('tu-fb-inp'); const txt=i?i.value.trim():'';
  if(!txt){ if(typeof showToast==='function')showToast('Nhập nội dung','warn'); return; }
  supa.rpc('fn_tu_feedback',{p_ma:TU.ma,p_password:TU.pw,p_phieu_id:TU.phieu.id,p_noi_dung:txt}).then(({data})=>{
    if(data&&data.success){ if(typeof showToast==='function')showToast('✓ Đã gửi ý kiến','ok'); tuLoadKy(TU.ky); }
    else if(typeof showToast==='function') showToast((data&&data.error)||'Lỗi','warn');
  });
}

// ═══ ADMIN ═══════════════════════════════════════════════════════════════
function tuAdminInitPage(){
  // [v18.68] Console mở cho ADMIN + QLNS (server RPC cũng đã cho phép 2 vai trò này)
  var _r=(typeof SESSION!=='undefined'&&SESSION)?String(SESSION.vaiTro||'').toUpperCase():'';
  if(_r!=='ADMIN' && _r!=='QLNS'){ try{goToPage('home');}catch(e){} return; }
  TU.ma=SESSION.ma;
  if(TU.pw) tuAdminShell(); else tuAdminGate();
}
function tuAdminGate(){
  const root=document.getElementById('tu-ad-body'); if(!root) return;
  root.innerHTML='<div class="tn-gate"><div class="tn-gate-t">Xác thực quản trị</div>'+
    '<div class="tn-gate-s">Nhập lại mật khẩu để vào quản lý Tạm ứng.</div>'+
    '<input id="tu-ad-pw" class="tn-inp" type="password" placeholder="Mật khẩu" onkeydown="if(event.key===\'Enter\')tuAdminVerify()">'+
    '<div id="tu-ad-err" class="tn-err"></div><button class="tn-btn-ok" onclick="tuAdminVerify()">Vào quản lý</button></div>';
  setTimeout(()=>{const i=document.getElementById('tu-ad-pw'); if(i)i.focus();},60);
}
function tuAdminVerify(){
  let pw=((document.getElementById('tu-ad-pw')||{}).value||'').trim();
  const err=document.getElementById('tu-ad-err');
  if(!pw){ if(err)err.textContent='Nhập mật khẩu.'; return; }
  supa.rpc('fn_tu_admin_list',{p_ma:TU.ma,p_password:pw,p_ky:null}).then(({data,error})=>{
    if(error||!data||!data.success){ if(err)err.textContent=(data&&data.error)||'Thất bại.'; return; }
    TU.pw=pw; TU.adData=data; TU.adKy=data.ky||((data.kyList&&data.kyList[0])?data.kyList[0].ky:null); tuAdminShell();
  });
}
function tuAdminShell(){
  const root=document.getElementById('tu-ad-body'); if(!root) return;
  root.innerHTML=tuAdminSyncCardHtml()+'<div id="tu-ad-main"></div>';
  if(TU.adData && (TU.adData.kyList||[]).length) tuAdminRenderMain();
  else document.getElementById('tu-ad-main').innerHTML='<div class="tn-empty" style="margin-top:14px">Chưa có kỳ nào. Cấu hình rồi bấm Đồng bộ / Tải CSV.</div>';
}
function tuAdminSyncCardHtml(){
  const kySel=(TU.adData&&TU.adData.kyList||[]).map(k=>'<option value="'+k.ky+'"'+(k.ky===TU.adKy?' selected':'')+'>'+_tuEsc(k.ten||k.ky)+'</option>').join('');
  const now=new Date(); const pm=new Date(now.getFullYear(), now.getMonth(), 1); const defM=pm.getFullYear()+'-'+String(pm.getMonth()+1).padStart(2,'0');
  return '<div class="tn-card"><div class="tn-ad-top"><div><div class="tn-ad-title">Đồng bộ tạm ứng</div>'+
    '<div class="tn-ad-sub">Chọn <b>tháng</b> → kéo tất cả dòng sheet <b>TU</b> vào kỳ đó. Tải CSV chạy ngay; "Đồng bộ ngay" cần GAS hỗ trợ <code>?sheet=TU</code>.</div></div>'+
    (kySel?'<select class="tn-sel" title="Xem kỳ đã có" onchange="tuAdminLoad(this.value)">'+kySel+'</select>':'')+'</div>'+
    '<div class="tn-sync-row">'+
      '<div class="tn-fld"><label>Tháng đồng bộ / hiển thị</label><input id="tu-sync-month" class="tn-inp sm" type="month" value="'+defM+'"></div>'+
      '<div class="tn-fld"><label>Secret <span class="tn-nolock">không lưu</span></label><input id="tu-secret" class="tn-inp sm" type="password" placeholder="Nhập secret" autocomplete="off"></div>'+
      '<button class="tn-btn-ok tn-sync-btn" onclick="tuAdminSyncNow()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Đồng bộ ngay</button>'+
      '<label class="tn-btn-ghost tn-file">Tải CSV<input type="file" accept=".csv" style="display:none" onchange="tuAdminCsv(this)"></label>'+
    '</div>'+
    '<label class="tn-sync-replace"><input type="checkbox" id="tu-sync-replace" checked> <b>Thay dữ liệu cũ</b> — xóa sạch phiếu tháng này trước khi nạp</label>'+
    '</div>';
}
function _tuSyncKy(){ const m=(document.getElementById('tu-sync-month')||{}).value||new Date().toISOString().slice(0,7); return {ky:m, ten:'Tháng '+parseInt(m.slice(5))+', '+m.slice(0,4)}; }
function tuAdminSyncNow(){
  const sec=((document.getElementById('tu-secret')||{}).value||'').trim();
  if(!sec){ if(typeof showToast==='function')showToast('Nhập secret để đồng bộ','warn'); return; }
  const k=_tuSyncKy();
  if(typeof showToast==='function')showToast('Đang lấy dữ liệu từ sheet TU...','ok');
  const url=TU.syncUrl+(TU.syncUrl.indexOf('?')>=0?'&':'?')+'secret='+encodeURIComponent(sec)+'&sheet=TU';
  fetch(url).then(r=>r.json()).then(res=>{
    if(!res||!res.success){ if(typeof showToast==='function')showToast('Sheet: '+((res&&res.error)||'lỗi — kiểm secret'),'err'); return; }
    tuAdminDoSync(k.ky,k.ten,res.rows||[]);
  }).catch(()=>{ if(typeof showToast==='function')showToast('Lỗi lấy Sheet (kiểm secret/GAS ?sheet=TU)','err'); });
}
function tuAdminCsv(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const k=_tuSyncKy(); const rd=new FileReader();
  rd.onload=()=>{ const rows=tuParseCsv(rd.result); inp.value=''; if(!rows.length){if(typeof showToast==='function')showToast('CSV rỗng/không đọc được','warn');return;} tuAdminDoSync(k.ky,k.ten,rows); };
  rd.readAsText(f,'utf-8');
}
function tuParseCsv(text){
  const lines=String(text).replace(/\r/g,'').split('\n').filter(l=>l.length); const out=[];
  for(let i=1;i<lines.length;i++){
    const cells=tuCsvLine(lines[i]); const maBh=(cells[1]||'').trim(); const maNs=(cells[19]||'').trim();
    if(!maBh && !maNs) continue;
    const o={}; for(let c=0;c<TU_KEYS.length;c++){ o[TU_KEYS[c]]=cells[c]!==undefined?cells[c]:''; } out.push(o);
  }
  return out;
}
function tuCsvLine(line){ const r=[]; let cur='',q=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(q){ if(ch==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; } else { if(ch==='"')q=true; else if(ch===','){r.push(cur);cur='';} else cur+=ch; } } r.push(cur); return r; }
function tuAdminDoSync(ky,ten,rows){
  if(!rows||!rows.length){ if(typeof showToast==='function')showToast('⚠ Không nhận được dòng nào — ĐÃ HỦY để tránh mất dữ liệu.','err'); return; }
  // [v18.66] Chặn nạp bậy: rows phải có shape TU (muc_ung / ma_bh). GAS chưa hỗ trợ ?sheet=TU
  //   sẽ trả về data sheet TN (thiếu 2 key này) → báo rõ thay vì lưu sai.
  if(rows[0] && rows[0].muc_ung===undefined && rows[0].ma_bh===undefined){
    if(typeof showToast==='function')showToast('⚠ Nguồn trả SAI sheet (không phải TU). GAS chưa nhận ?sheet=TU — hãy dùng "Tải CSV", hoặc deploy lại GAS (đảm bảo CHỈ 1 hàm doGet).','err');
    return;
  }
  const replace=!!(document.getElementById('tu-sync-replace')||{}).checked;
  const _write=()=>{
    supa.rpc('fn_tu_sync',{p_ma:TU.ma,p_password:TU.pw,p_ky:ky,p_ten:ten,p_rows:rows}).then(({data,error})=>{
      if(error||!data||!data.success){ if(typeof showToast==='function')showToast('Đồng bộ lỗi: '+((data&&data.error)||(error&&error.message)),'err'); return; }
      if(typeof showToast==='function')showToast('✓ Đã đồng bộ '+data.so_phieu+' phiếu kỳ '+ky,'ok');
      TU.adKy=ky; supa.rpc('fn_tu_admin_list',{p_ma:TU.ma,p_password:TU.pw,p_ky:ky}).then(({data:d2})=>{ if(d2&&d2.success){TU.adData=d2; tuAdminShell();} });
    });
  };
  if(typeof showToast==='function')showToast((replace?'Đang thay dữ liệu cũ + ghi ':'Đang ghi ')+rows.length+' phiếu...','ok');
  if(replace) Promise.resolve(supa.rpc('fn_tu_admin_clear',{p_ma:TU.ma,p_password:TU.pw,p_ky:ky,p_mode:'all'})).then(()=>_write()).catch(()=>_write());
  else _write();
}
function tuAdminLoad(ky){
  TU.adKy=ky;
  supa.rpc('fn_tu_admin_list',{p_ma:TU.ma,p_password:TU.pw,p_ky:ky}).then(({data,error})=>{
    if(error||!data||!data.success){ if(typeof showToast==='function')showToast('Lỗi tải','err'); return; }
    TU.adData=data; tuAdminRenderMain();
  });
}
function tuAdminRenderMain(){
  const root=document.getElementById('tu-ad-main'); if(!root) return;
  const list=TU.adData.danhSach||[];
  const c={xem:0,xn:0,yk:0}; list.forEach(p=>{ if(p.xemLuc)c.xem++; if(p.xacNhanLuc)c.xn++; if(p.coYkien&&p.chuaTraLoi)c.yk++; });
  const den=TU.adData.hienAllDen? new Date(TU.adData.hienAllDen):null;
  const hienAllEff=!!TU.adData.hienAll && (!den||den.getTime()>Date.now());
  let h='<div class="tn-stats">'+
    _tuStat(list.length,'Phiếu')+_tuStat(c.xem,'Đã xem')+_tuStat(c.xn,'Đã xác nhận')+_tuStat(c.yk,'Ý kiến chờ',c.yk>0)+'</div>';
  h+='<div class="tn-card"><div class="tn-openall">'+
     '<label class="tn-tgl-lbl">Mở tất cả kỳ này <button class="tn-tgl'+(hienAllEff?' on':'')+'" onclick="tuAdOpenAll('+(!hienAllEff)+')"></button></label>'+
     '<label class="tn-tgl-lbl tn-paydate-fld"><span class="tn-gold-dot"></span>Ngày nhận <input type="date" id="tu-ngaynhan" class="tn-inp sm" value="'+_tuEsc((TU.adData.ngayNhan||'').slice(0,10))+'" onchange="tuAdSetNgayNhan()"></label>'+
     '<label class="tn-tgl-lbl">Hạn hỏi <input type="text" id="tu-han" class="tn-inp sm" style="min-width:150px" placeholder="17h30 ngày…" value="'+_tuEsc(TU.adData.hanHoi||'')+'" onchange="tuAdSetNgayNhan()"></label>'+
     '<label class="tn-tgl-lbl">Zalo <input type="text" id="tu-zalo" class="tn-inp sm" style="min-width:120px" value="'+_tuEsc(TU.adData.zalo||'0902753345')+'" onchange="tuAdSetNgayNhan()"></label>'+
     '</div></div>';
  const chSet=[...new Set(list.map(p=>p.cuaHang||p.maCH).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  h+='<div class="tn-ad-tools"><div class="tn-ad-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'+
     '<input id="tu-ad-search" type="search" placeholder="Tìm tên hoặc mã nhân viên…" value="'+_tuEsc(TU.adSearch||'')+'" oninput="tuAdApplyFilter()"></div>'+
     '<select id="tu-ad-ch" class="tn-sel sm" onchange="tuAdApplyFilter()"><option value="">Tất cả cửa hàng ('+chSet.length+')</option>'+
       chSet.map(ch=>'<option value="'+_tuEsc(ch)+'"'+(TU.adCH===ch?' selected':'')+'>'+_tuEsc(ch)+'</option>').join('')+'</select></div>';
  h+='<div class="tn-tbl-wrap"><div id="tu-ad-tbl"></div></div>';
  h+='<div class="tn-card tn-danger"><div class="tn-danger-t">⚠ Vùng xóa dữ liệu · kỳ '+_tuEsc(TU.adKy||'')+'</div><div class="tn-danger-row">'+
     '<button class="tn-btn-danger" onclick="tuAdClearResponses()">↺ Xóa phản hồi NV<small>Reset "đã xem/xác nhận" + xóa ý kiến</small></button>'+
     '<button class="tn-btn-danger solid" onclick="tuAdClearData()">🗑 Xóa toàn bộ dữ liệu kỳ<small>Xóa sạch phiếu để nạp lại</small></button>'+
     '</div><div class="tn-danger-note">Thao tác không hoàn tác được.</div></div>';
  root.innerHTML=h;
  tuAdRenderTable();
}
function _tuStat(n,l,alert){ return '<div class="tn-stat'+(alert?' warn':'')+'"><div class="n">'+n+'</div><div class="l">'+_tuEsc(l)+'</div></div>'; }
function tuAdApplyFilter(){
  const s=document.getElementById('tu-ad-search'), ch=document.getElementById('tu-ad-ch');
  TU.adSearch=s?s.value:''; TU.adCH=ch?ch.value:''; tuAdRenderTable();
  if(s){ const v=s.value; const el=document.getElementById('tu-ad-search'); if(el){el.focus(); try{el.setSelectionRange(v.length,v.length);}catch(e){}} }
}
function tuAdRenderTable(){
  const box=document.getElementById('tu-ad-tbl'); if(!box||!TU.adData) return;
  const den=TU.adData.hienAllDen? new Date(TU.adData.hienAllDen):null;
  const hienAllEff=!!TU.adData.hienAll && (!den||den.getTime()>Date.now());
  let list=TU.adData.danhSach||[];
  const q=(TU.adSearch||'').trim().toLowerCase();
  if(q) list=list.filter(p=>String(p.hoTen||'').toLowerCase().indexOf(q)>=0 || String(p.maNV||'').toLowerCase().indexOf(q)>=0 || String(p.maBH||'').toLowerCase().indexOf(q)>=0);
  if(TU.adCH) list=list.filter(p=>(p.cuaHang||p.maCH)===TU.adCH);
  let h='<table class="tn-tbl"><thead><tr><th>Nhân viên</th><th>Cửa hàng</th><th class="r">Mức ứng</th><th>Trạng thái</th><th>Hiện</th></tr></thead><tbody>';
  list.forEach(p=>{
    h+='<tr><td><button class="tn-nv-open" onclick="tuAdminViewPhieu(\''+p.id+'\')" title="Xem phiếu tạm ứng"><b>'+_tuEsc(p.hoTen||p.maNV)+'</b><small>'+_tuEsc(p.maBH||p.maNV)+'</small></button></td>'+
       '<td>'+_tuEsc(p.cuaHang||p.maCH||'—')+'</td><td class="r">'+_tuMoney(p.mucUng)+'</td><td>'+tuPill(p)+'</td>'+
       '<td><button class="tn-tgl sm'+((p.hien||hienAllEff)?' on':'')+'" '+(hienAllEff?'disabled title="Đang mở tất cả"':'onclick="tuAdminToggleOne(\''+p.maNV+'\','+(!p.hien)+')"')+'></button></td></tr>';
    if(p.coYkien){ h+='<tr class="tn-fb-row"><td colspan="5"><button class="tn-fb-open" onclick="tuAdminToggleThread(\''+p.id+'\',this)"><span class="tn-fb-caret">▸</span> 💬 Xem &amp; trả lời ý kiến của '+_tuEsc(p.hoTen||p.maNV)+(p.chuaTraLoi?' <span class="tn-new">mới</span>':'')+'</button><div class="tn-thread-inline" id="tu-thr-'+p.id+'" style="display:none"></div></td></tr>'; }
  });
  h+='</tbody></table>'+(list.length?'':'<div class="tn-empty" style="margin-top:8px">'+((TU.adData.danhSach||[]).length?'Không có phiếu khớp bộ lọc':'📭 Kỳ này chưa có phiếu. Đồng bộ / Tải CSV để nạp.')+'</div>');
  box.innerHTML=h;
}
function tuPill(p){
  if(p.xacNhanLuc) return '<span class="tn-pill p-ok">Đã xác nhận</span>';
  if(p.xemLuc) return '<span class="tn-pill p-seen">Đã xem</span>';
  return '<span class="tn-pill p-hid">Chưa xem</span>';
}
function tuAdOpenAll(v){
  supa.rpc('fn_tu_admin_toggle',{p_ma:TU.ma,p_password:TU.pw,p_ky:TU.adKy,p_all:!!v}).then(({data})=>{
    if(data&&data.success){ if(typeof showToast==='function')showToast(v?'✓ Đã mở tất cả':'Đã ẩn tất cả','ok'); tuAdminLoad(TU.adKy); }
    else if(typeof showToast==='function')showToast((data&&data.error)||'Lỗi','warn');
  });
}
function tuAdminToggleOne(maNV,v){
  supa.rpc('fn_tu_admin_toggle',{p_ma:TU.ma,p_password:TU.pw,p_ky:TU.adKy,p_ma_nv:maNV,p_hien:!!v}).then(({data})=>{
    if(data&&data.success) tuAdminLoad(TU.adKy);
    else if(typeof showToast==='function')showToast((data&&data.error)||'Lỗi','warn');
  });
}
function tuAdSetNgayNhan(){
  const nn=((document.getElementById('tu-ngaynhan')||{}).value)||null;
  const han=((document.getElementById('tu-han')||{}).value)||null;
  const zalo=((document.getElementById('tu-zalo')||{}).value)||null;
  supa.rpc('fn_tu_admin_ngaynhan',{p_ma:TU.ma,p_password:TU.pw,p_ky:TU.adKy,p_ngay_nhan:nn,p_han:han,p_zalo:zalo}).then(({data})=>{
    if(data&&data.success){ if(typeof showToast==='function')showToast('✓ Đã lưu','ok'); if(TU.adData){TU.adData.ngayNhan=nn;TU.adData.hanHoi=han;TU.adData.zalo=zalo;} }
    else if(typeof showToast==='function')showToast((data&&data.error)||'Lỗi','warn');
  });
}
function tuAdClearData(){ tuAdClear('all'); }
function tuAdClearResponses(){ tuAdClear('responses'); }
async function tuAdClear(mode){
  const ky=TU.adKy; if(!ky) return;
  const msg=mode==='all'?('XÓA TOÀN BỘ phiếu tạm ứng kỳ '+ky+'?\nMọi phiếu và phản hồi sẽ bị xóa vĩnh viễn.'):('Xóa phản hồi NV kỳ '+ky+'?\nReset "đã xem/xác nhận" + xóa ý kiến.');
  let ok=false;
  if(typeof appConfirm==='function') ok=await appConfirm(msg,{title:mode==='all'?'Xóa dữ liệu kỳ':'Xóa phản hồi',okLabel:'Xóa',danger:true});
  else ok=confirm(msg);
  if(!ok) return;
  supa.rpc('fn_tu_admin_clear',{p_ma:TU.ma,p_password:TU.pw,p_ky:ky,p_mode:mode}).then(({data,error})=>{
    if(error && /find the function|does not exist|schema cache/i.test(error.message||'')){ if(typeof showToast==='function')showToast('Hãy chạy SQL v18.65_tam_ung.sql trước','warn'); return; }
    if(data&&data.success){ if(typeof showToast==='function')showToast(mode==='all'?('✓ Đã xóa '+(data.so_phieu||0)+' phiếu'):('✓ Đã reset '+(data.so_phieu||0)+' phiếu'),'ok'); tuAdminLoad(ky); }
    else if(typeof showToast==='function')showToast((data&&data.error)||'Không xóa được','warn');
  }).catch(()=>{ if(typeof showToast==='function')showToast('Lỗi kết nối','warn'); });
}
// Admin xem phiếu 1 NV (modal body-level .tn-apv-*)
function tuAdminViewPhieu(id){
  supa.rpc('fn_tu_admin_thread',{p_ma:TU.ma,p_password:TU.pw,p_phieu_id:parseInt(id,10)}).then(({data})=>{
    if(!data||!data.success){ if(typeof showToast==='function')showToast((data&&data.error)||'Không tải được','warn'); return; }
    let ov=document.getElementById('tu-apv-ov');
    if(!ov){ ov=document.createElement('div'); ov.id='tu-apv-ov'; ov.className='tn-apv-ov'; document.body.appendChild(ov); }
    const d=data.duLieu||{};
    ov.innerHTML='<div class="tn-apv-bd" onclick="tuAdminCloseView()"></div><div class="tn-apv-box">'+
      '<div class="tn-apv-bar"><div class="tn-apv-ttl">Phiếu tạm ứng · '+_tuEsc(d.ho_ten||data.id)+'</div><button class="tn-apv-x" onclick="tuAdminCloseView()">✕</button></div>'+
      '<div class="tn-slip">'+_tuSlipCore(data,d)+'<div style="padding:0 18px 16px">'+_tuNoteHtml(data)+'</div>'+tuThreadHtml(data.phanHoi)+'</div></div>';
    ov.classList.add('show');
  });
}
function tuAdminCloseView(){ const ov=document.getElementById('tu-apv-ov'); if(ov) ov.classList.remove('show'); }
function tuAdminToggleThread(id,btn){
  const box=document.getElementById('tu-thr-'+id); if(!box) return;
  const open=box.style.display!=='none' && box.getAttribute('data-loaded');
  document.querySelectorAll('#tu-ad-tbl .tn-thread-inline').forEach(b=>{b.style.display='none';});
  document.querySelectorAll('#tu-ad-tbl .tn-fb-open').forEach(b=>b.classList.remove('on'));
  if(open){ box.style.display='none'; return; }
  if(btn)btn.classList.add('on'); box.style.display='block';
  supa.rpc('fn_tu_admin_thread',{p_ma:TU.ma,p_password:TU.pw,p_phieu_id:parseInt(id,10)}).then(({data})=>{
    if(!data||!data.success){ box.innerHTML='<div class="tn-err">Lỗi tải</div>'; return; }
    box.setAttribute('data-loaded','1');
    box.innerHTML=tuThreadHtml(data.phanHoi)+'<div class="tn-fb"><textarea class="tn-ta" id="tu-rep-'+id+'" placeholder="Trả lời nhân viên..."></textarea><button class="tn-btn-teal" onclick="tuAdReply(\''+id+'\')">Gửi trả lời</button></div>';
  });
}
function tuAdReply(id){
  const i=document.getElementById('tu-rep-'+id); const txt=i?i.value.trim():'';
  if(!txt){ if(typeof showToast==='function')showToast('Nhập nội dung','warn'); return; }
  supa.rpc('fn_tu_admin_reply',{p_ma:TU.ma,p_password:TU.pw,p_phieu_id:parseInt(id,10),p_noi_dung:txt}).then(({data})=>{
    if(data&&data.success){ if(typeof showToast==='function')showToast('✓ Đã trả lời','ok'); tuAdminLoad(TU.adKy); }
    else if(typeof showToast==='function')showToast((data&&data.error)||'Lỗi','warn');
  });
}

/* Globals */
window.tuInitPage=tuInitPage; window.tuVerify=tuVerify; window.tuLoadKy=tuLoadKy;
window.tuTg=tuTg; window.tuToggleFb=tuToggleFb; window.tuConfirm=tuConfirm; window.tuSendFb=tuSendFb;
window.tuAdminInitPage=tuAdminInitPage; window.tuAdminVerify=tuAdminVerify;
window.tuAdminSyncNow=tuAdminSyncNow; window.tuAdminCsv=tuAdminCsv; window.tuAdminLoad=tuAdminLoad;
window.tuAdOpenAll=tuAdOpenAll; window.tuAdminToggleOne=tuAdminToggleOne; window.tuAdSetNgayNhan=tuAdSetNgayNhan;
window.tuAdApplyFilter=tuAdApplyFilter; window.tuAdClearData=tuAdClearData; window.tuAdClearResponses=tuAdClearResponses;
window.tuAdminViewPhieu=tuAdminViewPhieu; window.tuAdminCloseView=tuAdminCloseView;
window.tuAdminToggleThread=tuAdminToggleThread; window.tuAdReply=tuAdReply;
