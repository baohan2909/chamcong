// ═══════════════════════════════════════════════════════════════════════════
//  KIỂM SOÁT BỔ SUNG — Pha 2: CỔNG BIÊN BẢN ở chấm công (điểm ≤6)
//  Hook: selType('Vào ca','vao') (02-system.js) → _bscGateVaoCa.
//  Luật (Aroma): điểm ≤6 chưa nộp biên bản → chặn 30s cảnh báo → cho chấm 1 LẦN
//  ân hạn duy nhất (báo NV rõ) → lần sau chưa nộp biên bản thì CHẶN HẲN.
// ═══════════════════════════════════════════════════════════════════════════

let _bscPending = null;      // {loai, btnId} đang chờ qua cổng
let _bscCountIv = null;

// Bọc .ns18 để token màu + font 'Be Vietnam Pro' resolve (root nằm ngoài .page nên
// không tự thừa kế được — thiếu class này chữ rơi về font hệ thống).
function _bscGateRoot(){
  let r = document.getElementById('bsg-root');
  if (!r){ r = document.createElement('div'); r.id = 'bsg-root'; r.className = 'ns18'; document.body.appendChild(r); }
  return r;
}
function _bscEsc(s){ return String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

// Cổng khi NV bấm "Vào ca"
async function _bscGateVaoCa(loai, btnId){
  let d = null;
  try {
    // timeout 4s → fail-OPEN (không để RPC treo làm kẹt nút Vào ca)
    const r = await Promise.race([
      supa.rpc('fn_bs_trang_thai_nv', { p_ma_nv: SESSION.ma }),
      new Promise(function(res){ setTimeout(function(){ res({ data: null }); }, 4000); })
    ]);
    d = r.data;
  } catch(e){}
  // Fail-soft: lỗi / chưa chạy SQL / cơ động / không cần biên bản / đã nộp → CHO QUA (không cản chấm công)
  if (!d || !d.ok || d.co_dong || !d.can_bien_ban || d.da_nop_bien_ban){
    window._bscGateOK = true; try{ selType(loai, btnId); }catch(e){} return;
  }
  _bscPending = { loai: loai, btnId: btnId };
  if (d.grace_used) _bscShowBlock(d);      // đã dùng ân hạn, chưa nộp → chặn hẳn
  else _bscShowGrace(d);                     // ân hạn 30s
}

// Modal 30 giây ân hạn
function _bscShowGrace(d){
  const diem = (d.diem!=null)?d.diem:'—'; const owed = d.owed_tt||0;
  const root = _bscGateRoot();
  root.innerHTML =
    '<div class="bsg-ov" style="position:fixed;inset:0;z-index:12000;background:rgba(10,10,12,.78);display:flex;align-items:center;justify-content:center;padding:20px">'+
      '<div style="background:#fff;border-radius:18px;max-width:420px;width:100%;padding:22px 20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)">'+
        '<div style="width:60px;height:60px;margin:0 auto 12px;border-radius:50%;background:#FEF3C7;display:grid;place-items:center;font-size:30px">⚠️</div>'+
        '<div style="font-size:18px;font-weight:800;color:#92400E">Cảnh báo kiểm soát</div>'+
        '<div style="font-size:13px;color:#374151;line-height:1.6;margin:10px 0 4px">Điểm <b>'+diem+'/10</b> — bạn còn <b>'+owed+' biên bản</b> chưa nộp. Quy định: <b>mỗi điểm dưới 7 = 1 biên bản giấy</b> (chụp ảnh), bắt buộc nộp.</div>'+
        '<div style="font-size:12.5px;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:10px 12px;margin:12px 0;line-height:1.55">'+
          'Lần này bạn được chấm công sau <b id="bsg-count">30</b> giây — <b>CHỈ 1 LẦN DUY NHẤT</b>.<br>'+
          'Nếu chưa nộp đủ biên bản, <b>lần chấm công sau sẽ bị CHẶN HOÀN TOÀN</b>.</div>'+
        '<button onclick="bsBienBanMo()" style="width:100%;padding:12px;margin-bottom:9px;background:linear-gradient(135deg,#B45309,#D97706);color:#fff;border:none;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer">📄 Nộp biên bản giấy (kèm ảnh)</button>'+
        '<button id="bsg-proceed" disabled onclick="_bscQuaAnHan()" style="width:100%;padding:12px;background:#E5E7EB;color:#9CA3AF;border:none;border-radius:11px;font-weight:700;font-size:14px;cursor:not-allowed">Chờ 30 giây…</button>'+
      '</div></div>';
  let n = 30;
  if (_bscCountIv) clearInterval(_bscCountIv);
  _bscCountIv = setInterval(function(){
    n--;
    const c = document.getElementById('bsg-count'); if (c) c.textContent = n;
    if (n <= 0){
      clearInterval(_bscCountIv); _bscCountIv = null;
      const b = document.getElementById('bsg-proceed');
      if (b){ b.disabled=false; b.textContent='Chấm công lần này (ân hạn)'; b.style.background='linear-gradient(135deg,#0F6E56,#1D9E75)'; b.style.color='#fff'; b.style.cursor='pointer'; }
    }
  }, 1000);
}
// Modal chặn hẳn (đã dùng ân hạn)
function _bscShowBlock(d){
  const diem = (d.diem!=null)?d.diem:'—'; const owed = d.owed_tt||0;
  const root = _bscGateRoot();
  root.innerHTML =
    '<div class="bsg-ov" style="position:fixed;inset:0;z-index:12000;background:rgba(10,10,12,.82);display:flex;align-items:center;justify-content:center;padding:20px">'+
      '<div style="background:#fff;border-radius:18px;max-width:420px;width:100%;padding:22px 20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)">'+
        '<div style="width:60px;height:60px;margin:0 auto 12px;border-radius:50%;background:#FEE2E2;display:grid;place-items:center;font-size:30px">⛔</div>'+
        '<div style="font-size:18px;font-weight:800;color:#991B1B">Không thể chấm công</div>'+
        '<div style="font-size:13px;color:#374151;line-height:1.6;margin:10px 0 14px">Bạn đã dùng lần ân hạn nhưng còn <b>'+owed+' biên bản</b> chưa nộp (điểm '+diem+'/10). Vui lòng nộp đủ biên bản giấy (kèm ảnh) để tiếp tục chấm công — nếu không sẽ bị <b>xử lý kỷ luật</b>.</div>'+
        '<button onclick="bsBienBanMo()" style="width:100%;padding:12px;margin-bottom:9px;background:linear-gradient(135deg,#B91C1C,#DC2626);color:#fff;border:none;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer">📄 Nộp biên bản giấy (kèm ảnh)</button>'+
        '<button onclick="_bscDongCong()" style="width:100%;padding:11px;background:#F3F4F6;color:#374151;border:none;border-radius:11px;font-weight:600;font-size:13.5px;cursor:pointer">Đóng</button>'+
      '</div></div>';
}
function _bscDongCong(){ const r=document.getElementById('bsg-root'); if(r)r.innerHTML=''; if(_bscCountIv){clearInterval(_bscCountIv);_bscCountIv=null;} _bscPending=null; }

// Bấm "Chấm công lần này" sau 30s → đánh dấu grace + cho qua chấm công
async function _bscQuaAnHan(){
  try { await supa.rpc('fn_bs_dung_grace', { p_ma_nv: SESSION.ma }); } catch(e){}
  const p = _bscPending; _bscDongCong();
  if (typeof showToast==='function') showToast('Đã dùng lần ân hạn — nhớ nộp biên bản giấy, lần sau sẽ bị chặn.', 'warn');
  if (p){ window._bscGateOK = true; try{ selType(p.loai, p.btnId); }catch(e){} }
}

// ─── Nộp tường trình / biên bản (text + NHIỀU ảnh) ───
//   loai='TUONG_TRINH': ảnh tùy chọn.  loai='BIEN_BAN': BẮT BUỘC ≥1 ảnh giấy (C2).
//   Chọn được nhiều ảnh một lúc (C3).
let _bscbbAnhs = [];          // [{blob, dataUrl}]
let _bscbbLoai = 'TUONG_TRINH';
function bsBienBanMo(){ bscbbMo('BIEN_BAN'); }        // entry point cho biên bản giấy
function bscbbMo(loai){
  _bscbbAnhs = [];
  _bscbbLoai = (loai==='BIEN_BAN') ? 'BIEN_BAN' : 'TUONG_TRINH';
  const laBB = _bscbbLoai==='BIEN_BAN';
  const tieu = laBB ? '📄 Nộp biên bản giấy' : '📝 Nộp tường trình';
  const moTa = laBB
    ? 'QLNS yêu cầu bạn nộp <b>biên bản giấy</b>. <b>Bắt buộc</b> chụp ảnh biên bản (có thể chọn nhiều ảnh).'
    : 'Mỗi điểm trừ (lỗi) cần 1 tường trình. Giải trình lỗi + cam kết cải thiện; có thể đính kèm ảnh (nhiều ảnh).';
  const nut = laBB ? 'Nộp biên bản' : 'Nộp tường trình';
  const root = _bscGateRoot();
  root.innerHTML =
    '<div class="bsg-ov" style="position:fixed;inset:0;z-index:12100;background:rgba(10,10,12,.72);display:flex;align-items:flex-end;justify-content:center;padding:0">'+
      '<div style="background:#fff;border-radius:16px 16px 0 0;max-width:460px;width:100%;padding:18px;max-height:92vh;overflow-y:auto">'+
        '<div style="width:36px;height:4px;background:#D1D5DB;border-radius:2px;margin:0 auto 12px"></div>'+
        '<div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:3px">'+tieu+'</div>'+
        '<div style="font-size:12px;color:#6B7280;margin-bottom:12px">'+moTa+'</div>'+
        '<textarea id="bsbb-nd" rows="4" placeholder="'+(laBB?'Nội dung biên bản / cam kết…':'Nội dung giải trình lỗi / cam kết cải thiện…')+'" style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #D1D5DB;border-radius:8px;font-size:13px;resize:none"></textarea>'+
        '<div style="margin-top:10px">'+
          '<label style="display:inline-flex;align-items:center;gap:7px;padding:9px 13px;background:#EEF6F5;border:1px solid #99F6E4;border-radius:9px;color:#0F766E;font-size:12.5px;font-weight:700;cursor:pointer">📎 '+(laBB?'Chọn ảnh biên bản (bắt buộc)':'Chọn ảnh')+'<input type="file" accept="image/*" multiple style="display:none" onchange="bscbbChonAnh(this)"></label>'+
          '<span id="bsbb-anh-ten" style="font-size:11.5px;color:#059669;margin-left:8px"></span>'+
        '</div>'+
        '<div id="bsbb-anh-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"></div>'+
        '<div id="bsbb-err" style="display:none;color:#DC2626;font-size:12px;margin-top:8px;padding:8px;background:#FEF2F2;border-radius:6px"></div>'+
        '<div style="display:flex;gap:8px;margin-top:14px">'+
          '<button onclick="_bscDongCong()" style="flex:1;padding:12px;background:#F3F4F6;color:#374151;border:none;border-radius:8px;font-weight:500;font-size:14px;cursor:pointer">Hủy</button>'+
          '<button id="bsbb-gui" onclick="bscbbGui()" style="flex:2;padding:12px;background:linear-gradient(135deg,#0F6E56,#1D9E75);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer">'+nut+'</button>'+
        '</div>'+
      '</div></div>';
  setTimeout(function(){ const t=document.getElementById('bsbb-nd'); if(t)t.focus(); }, 80);
}
function _bscbbRenderAnhs(){
  const g = document.getElementById('bsbb-anh-grid'); if (!g) return;
  g.innerHTML = _bscbbAnhs.map(function(a,i){
    return '<div style="position:relative;width:76px;height:76px">'+
      '<img src="'+(a.dataUrl||'')+'" style="width:76px;height:76px;border-radius:9px;border:1px solid #E5E7EB;object-fit:cover">'+
      '<button type="button" onclick="bscbbXoaAnh('+i+')" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#DC2626;color:#fff;border:2px solid #fff;font-size:13px;line-height:1;cursor:pointer;display:grid;place-items:center">×</button>'+
      '</div>';
  }).join('');
  const ten = document.getElementById('bsbb-anh-ten');
  if (ten) ten.textContent = _bscbbAnhs.length ? ('✓ '+_bscbbAnhs.length+' ảnh') : '';
}
function bscbbXoaAnh(i){ _bscbbAnhs.splice(i,1); _bscbbRenderAnhs(); }
async function bscbbChonAnh(inp){
  const files = Array.prototype.slice.call(inp.files||[]); if (!files.length) return;
  const ten = document.getElementById('bsbb-anh-ten'); if (ten) ten.textContent = '⏳ Đang xử lý ảnh…';
  for (const f of files){
    try {
      let out = { blob: f, dataUrl: null };
      if (typeof muanonCompressAnh === 'function') out = await muanonCompressAnh(f);
      _bscbbAnhs.push({ blob: out.blob || f, dataUrl: out.dataUrl });
    } catch(e){ /* bỏ ảnh lỗi */ }
  }
  inp.value = '';
  _bscbbRenderAnhs();
}
async function _bscUploadAnh(blob){
  try {
    const path = 'bb/' + (SESSION.ma||'KHAC') + '_' + Date.now() + '_' + Math.floor(Math.random()*1e4) + '.jpg';
    const { error } = await supa.storage.from('bs-bien-ban').upload(path, blob, { contentType:'image/jpeg' });
    if (error) return null;
    const { data } = supa.storage.from('bs-bien-ban').getPublicUrl(path);
    return data ? data.publicUrl : null;
  } catch(e){ return null; }
}
async function bscbbGui(){
  const nd = ((document.getElementById('bsbb-nd')||{}).value || '').trim();
  const err = document.getElementById('bsbb-err');
  const show = (m)=>{ if(err){ err.textContent=m; err.style.display='block'; } };
  const laBB = _bscbbLoai==='BIEN_BAN';
  if (nd.length < 15){ show('Nội dung tối thiểu 15 ký tự.'); return; }
  if (laBB && !_bscbbAnhs.length){ show('Biên bản bắt buộc phải có ảnh biên bản giấy.'); return; }
  const btn = document.getElementById('bsbb-gui'); if (btn){ btn.disabled=true; btn.textContent='Đang nộp…'; }
  try {
    const urls = [];
    for (const a of _bscbbAnhs){ const u = await _bscUploadAnh(a.blob); if (u) urls.push(u); }
    if (laBB && !urls.length){ show('Tải ảnh thất bại — thử lại.'); if(btn){btn.disabled=false;btn.textContent='Nộp biên bản';} return; }
    const { data, error } = await supa.rpc('fn_bs_nop_bien_ban', {
      p_ma_nv: SESSION.ma, p_loai: _bscbbLoai, p_noi_dung: nd, p_anh_urls: urls });
    if (error) throw error;
    if (data && data.ok === false){ show(data.error || 'Lỗi nộp'); if(btn){btn.disabled=false;btn.textContent=laBB?'Nộp biên bản':'Nộp tường trình';} return; }
    _bscDongCong();
    if (typeof showToast==='function') showToast(laBB?'✓ Đã nộp biên bản. QLNS sẽ xem xét.':'✓ Đã nộp tường trình. Bạn có thể chấm công. QLNS sẽ xem xét.', 'ok');
  } catch(e){
    show((e && e.message) || 'Lỗi kết nối'); if(btn){btn.disabled=false;btn.textContent=laBB?'Nộp biên bản':'Nộp tường trình';}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Pha 3: TRANG "KIỂM SOÁT BỔ SUNG & KỶ LUẬT" (ADMIN + QLNS) — v18.76 dựng lại
//  Danh sách = MỌI NV điểm ≤6 (trừ ≥4) HOẶC bổ sung ≥ lần 3. Bảng ngoài đúng
//  spec: Cửa hàng | Nhân viên | Điểm | Bổ sung công | Hình thức xử lý | Trạng thái.
//  Chi tiết: mỗi LỖI 1 dòng → QLNS chọn hình thức xử lý + phản hồi; cuối cùng
//  CHỐT 1 hình thức áp ra bảng ngoài.
// ═══════════════════════════════════════════════════════════════════════════
let _bskThang = null, _bskFilter = 'all', _bskData = null, _bskBusy = false;
let _bskCurD = null, _bskFinalPick = null;
// mã → nhãn hình thức xử lý (+ class màu)
var BSK_HF = { NHAC_NHO:['Nhắc nhở','nn'], NHAC_NHO_BB:['Nhắc nhở bằng biên bản','bb'], KY_LUAT:['Xử lý kỷ luật','kl'] };
var BSK_HF_LIST = [['NHAC_NHO','Nhắc nhở'],['NHAC_NHO_BB','Nhắc nhở + biên bản'],['KY_LUAT','Xử lý kỷ luật']];
function _bskCoQuyen(){ if(!SESSION||!SESSION.ma) return false; var r=String(SESSION.vaiTro||'').toUpperCase(); return r==='ADMIN'||r==='QLNS'||SESSION.ma==='NS00490'; }
function _bskThangDefault(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }

function bskInitPage(){
  var root=document.getElementById('bsk-root'); if(!root) return;
  if(!_bskCoQuyen()){ root.innerHTML='<div class="bsk-card"><div class="bsk-empty">Chức năng dành cho Quản trị &amp; QLNS.</div></div>'; return; }
  if(!_bskThang) _bskThang=_bskThangDefault();
  root.innerHTML=
    '<div class="bsk-bar">'+
      '<label>Tháng <input type="month" id="bsk-thang" value="'+_bskThang+'" onchange="bskDoiThang(this.value)"></label>'+
      '<button type="button" class="bsk-refresh" onclick="bskReload()">↻ Làm mới</button>'+
    '</div>'+
    '<div id="bsk-tq" class="bsk-tiles"></div>'+
    '<div id="bsk-filter" class="bsk-chips"></div>'+
    '<div id="bsk-list"></div>';
  bskReload();
}
function bskDoiThang(v){ _bskThang=v||_bskThangDefault(); bskReload(); }
async function bskReload(){
  if(_bskBusy) return; _bskBusy=true;
  var list=document.getElementById('bsk-list'); if(list)list.innerHTML='<div class="bsk-card"><div class="bsk-empty">⏳ Đang tải…</div></div>';
  try{
    var r=await supa.rpc('fn_bs_ks_list',{p_ma_admin:SESSION.ma,p_thang:_bskThang,p_trang_thai:null});
    var d=r.data||{};
    if(d.ok===false){ if(list)list.innerHTML='<div class="bsk-card"><div class="bsk-empty">'+_bscEsc(d.error||'Không có quyền')+'</div></div>'; _bskBusy=false; return; }
    _bskData=d; _bskRenderTQ(d.tong_quan||{}); _bskRenderFilter(); _bskRenderList();
  }catch(e){ if(list)list.innerHTML='<div class="bsk-card"><div class="bsk-empty">Lỗi tải: '+_bscEsc((e&&e.message)||'')+'</div></div>'; }
  _bskBusy=false;
}
function _bskTile(n,l,c){ return '<div class="bsk-tile"><b style="color:'+c+'">'+n+'</b><span>'+l+'</span></div>'; }
function _bskRenderTQ(t){ var el=document.getElementById('bsk-tq'); if(!el)return;
  el.innerHTML=_bskTile(t.so_nv||0,'NV có lỗi','var(--magenta)')
    +_bskTile(t.cho_xu_ly||0,'Chờ xử lý','var(--amber)')
    +_bskTile(t.da_xu_ly||0,'Đã xử lý','var(--green-m)')
    +_bskTile((t.nhac_nho||0)+(t.nhac_nho_bb||0),'Nhắc nhở','var(--teal-deep)')
    +_bskTile(t.ky_luat||0,'Kỷ luật','var(--red)'); }
function _bskRenderFilter(){ var el=document.getElementById('bsk-filter'); if(!el)return;
  var chips=[['all','Tất cả'],['CHO_XU_LY','Chờ xử lý'],['DA_XU_LY','Đã xử lý']];
  el.innerHTML=chips.map(function(c){
    return '<button type="button" class="'+(_bskFilter===c[0]?'on':'')+'" onclick="bskLoc(\''+c[0]+'\')">'+c[1]+'</button>';
  }).join(''); }
function bskLoc(f){ _bskFilter=f; _bskRenderFilter(); _bskRenderList(); }
function _bskChip(tt){ var m={CHO_XU_LY:['cho','Chờ xử lý'],DA_XU_LY:['ok','Đã xử lý'],KY_LUAT:['kl','Kỷ luật'],DA_DUYET:['ok','Đã duyệt'],DA_NOP:['cho','Chờ xử lý'],MIEN:['mien','Miễn']}[tt]||['mien',tt];
  return '<span class="bsk-st '+m[0]+'">'+_bscEsc(m[1])+'</span>'; }
// Màu điểm theo ngưỡng luật: ≤5 đỏ · 6 vàng · ≥7 xanh
function _bskDiemColor(v){ return (v!=null&&v<=5)?'var(--red)':(v!=null&&v<=6)?'var(--amber)':'var(--green-m)'; }
function _bskHFLabel(hf){ return hf&&BSK_HF[hf] ? '<span class="bsk-hf-tag '+BSK_HF[hf][1]+'">'+BSK_HF[hf][0]+'</span>' : '<span class="bsk-hf-none">—</span>'; }
function _bskRenderList(){
  var el=document.getElementById('bsk-list'); if(!el||!_bskData)return;
  var ds=(_bskData.ds||[]).filter(function(x){ return _bskFilter==='all' || x.trang_thai===_bskFilter; });
  if(!ds.length){ el.innerHTML='<div class="bsk-card"><div class="bsk-empty">Không có nhân viên '+(_bskFilter==='all'?'':'khớp lọc')+' trong tháng.</div></div>'; return; }
  var rows=ds.map(function(x){
    return '<tr onclick="bskOpenNV(\''+_bscEsc(x.ma_nv)+'\')">'+
      '<td class="l">'+_bscEsc(x.ten_ch||'—')+'</td>'+
      '<td class="l"><div class="bsk-nv">'+_bscEsc(x.ten_nv||x.ma_nv)+'<small>'+_bscEsc(x.ma_nv)+'</small></div></td>'+
      '<td><span class="bsk-diem" style="color:'+_bskDiemColor(x.diem)+'">'+(x.diem!=null?x.diem:'—')+'</span></td>'+
      '<td>'+(x.so_lan_bs||0)+'</td>'+
      '<td>'+_bskHFLabel(x.hinh_thuc)+'</td>'+
      '<td>'+_bskChip(x.trang_thai)+'</td>'+
      '<td class="bsk-go">›</td></tr>';
  }).join('');
  var heads=[['Cửa hàng','l'],['Nhân viên','l'],['Điểm',''],['Bổ sung công',''],['Hình thức xử lý',''],['Trạng thái',''],['','']];
  el.innerHTML='<div class="bsk-card"><div class="bsk-scroll"><table class="bsk-table">'+
    '<thead><tr>'+heads.map(function(h){return '<th class="'+h[1]+'">'+h[0]+'</th>';}).join('')+'</tr></thead>'+
    '<tbody>'+rows+'</tbody></table></div></div>';
}
// ─── Chi tiết NV (PORTAL ra body, xem note v18.73/74) ───
function _bskModalRoot(){
  var r=document.getElementById('bsk-modal-root');
  if(!r){ r=document.createElement('div'); r.id='bsk-modal-root'; r.className='ns18'; document.body.appendChild(r); }
  return r;
}
function _bskKeyEsc(e){ if(e.key==='Escape') bskCloseNV(); }
async function bskOpenNV(maNV){
  var ov=_bskModalRoot();
  ov.innerHTML='<div class="bsk-ov"><div class="bsk-modal"><div class="bsk-mbody"><div class="bsk-empty">⏳ Đang tải hồ sơ…</div></div></div></div>';
  document.addEventListener('keydown',_bskKeyEsc);
  try{
    var r=await supa.rpc('fn_bs_ks_detail',{p_ma_admin:SESSION.ma,p_ma_nv:maNV,p_thang:_bskThang});
    var d=r.data||{};
    if(d.ok===false){ bskCloseNV(); if(typeof showToast==='function')showToast(d.error||'Lỗi','warn'); return; }
    _bskCurD=d; _bskFinalPick=(d.chot&&d.chot.hinh_thuc)||null; d._finalNote=(d.chot&&d.chot.phan_hoi)||'';
    _bskRenderDetail();
  }catch(e){ bskCloseNV(); if(typeof showToast==='function')showToast('Lỗi tải','warn'); }
}
function bskCloseNV(){
  var ov=document.getElementById('bsk-modal-root'); if(ov)ov.innerHTML='';
  document.removeEventListener('keydown',_bskKeyEsc);
  _bskCurD=null; _bskFinalPick=null;
}
// Đọc các ô phản hồi (lỗi + chốt) vào _bskCurD trước khi render lại (khỏi mất chữ đang gõ)
function _bskSyncNotes(){
  if(!_bskCurD) return;
  document.querySelectorAll('#bsk-modal-root .bsk-ev-note').forEach(function(inp){
    var k=inp.getAttribute('data-key');
    (_bskCurD.su_kien||[]).forEach(function(e){ if(e.event_key===k) e.phan_hoi=inp.value; });
  });
  var fn=document.getElementById('bsk-final-note'); if(fn) _bskCurD._finalNote=fn.value;
}
// [v18.86] NV nhẹ (số lỗi ≤3 · bổ sung công ≤2) → mặc định 'Nhắc nhở' cho lỗi chưa xử lý
function _bskDefaultNN(){ return !!(_bskCurD && (_bskCurD.so_loi||0) <= 3 && (_bskCurD.so_lan_bs||0) <= 2); }
function _bskEvPills(e){
  var dnn = (!e.hinh_thuc && !e.da_mien && _bskDefaultNN());
  return '<div class="bsk-hf">'+BSK_HF_LIST.map(function(hf){
    var on=((e.hinh_thuc===hf[0]) || (dnn && hf[0]==='NHAC_NHO'))?(' on '+BSK_HF[hf[0]][1]):'';
    return '<button type="button" class="bsk-hf-pill'+on+'" onclick="bskSetEvent(\''+_bscEsc(e.event_key)+'\',\''+hf[0]+'\')">'+hf[1]+'</button>';
  }).join('')+'</div>'+(dnn?'<div style="font-size:10.5px;color:#0F766E;margin-top:3px">Mặc định: Nhắc nhở (NV số lỗi ≤3 · bổ sung ≤2)</div>':'');
}
function _bskFinalPills(){
  return '<div class="bsk-hf">'+BSK_HF_LIST.map(function(hf){
    var on=(_bskFinalPick===hf[0])?(' on '+BSK_HF[hf[0]][1]):'';
    return '<button type="button" class="bsk-hf-pill'+on+'" onclick="bskChotPick(\''+hf[0]+'\')">'+hf[1]+'</button>';
  }).join('')+'</div>';
}
function _bskRenderDetail(){
  var ov=document.getElementById('bsk-modal-root'); var d=_bskCurD; if(!ov||!d)return;
  var LOAI={TUONG_TRINH:['tt','Tường trình'],BIEN_BAN:['bb','Biên bản'],KY_LUAT:['kl','Kỷ luật']};
  var LOAI_SK={QUEN_RA:'Quên ra ca',QUEN_VAO:'Quên vào ca',THIEU_LICH:'Thiếu lịch ca',THIEU_ANH:'Thiếu ảnh nón',THIEU_BANGIAO:'Thiếu bàn giao',BO_SUNG:'Bổ sung ca'};
  var h='<div class="bsk-ov" onclick="if(event.target===this)bskCloseNV()">'+
    '<div class="bsk-modal">'+
      '<div class="bsk-mhead">'+
        '<button type="button" class="bsk-mx" aria-label="Đóng" onclick="bskCloseNV()">×</button>'+
        '<div class="nm">'+_bscEsc(d.ten_nv||d.ma_nv)+'</div>'+
        '<div class="mt">'+_bscEsc(d.ma_nv)+' · Tháng '+_bscEsc(d.thang||'')+'</div>'+
        '<div class="bsk-mstat">'+
          '<div><b style="color:'+((d.diem!=null&&d.diem<=5)?'#FFD9D9':'inherit')+'">'+(d.diem!=null?d.diem:'—')+'<i>/10</i></b><span>Điểm</span></div>'+
          '<div><b>'+(d.so_lan_bs||0)+'</b><span>Bổ sung công</span></div>'+
          '<div><b>'+(d.so_loi||0)+'</b><span>Số lỗi</span></div>'+
        '</div>'+
      '</div>'+
      '<div class="bsk-mbody">';
  // ── mỗi lỗi 1 dòng + hình thức xử lý + phản hồi ──
  var sk=d.su_kien||[];
  var conLoi=sk.filter(function(e){return !e.da_mien;});
  h+='<div class="bsk-sec"><div class="bsk-h3">Sự kiện trừ điểm — xử lý từng lỗi ('+conLoi.length+')</div>';
  if(!conLoi.length){ h+='<div class="bsk-none">Không còn lỗi cần xử lý.</div>'; }
  sk.forEach(function(e){
    if(e.da_mien){
      h+='<div class="bsk-ev mien"><div class="bsk-ev-top"><b>'+_bscEsc(LOAI_SK[e.loai]||e.loai)+'</b>'+
        '<span class="bsk-ev-ngay">'+_bscEsc(e.ngay||'')+'</span><em>đã miễn</em></div>'+
        '<div class="bsk-ev-mota">'+_bscEsc(e.mo_ta||'')+'</div></div>';
      return;
    }
    h+='<div class="bsk-ev"><div class="bsk-ev-top"><b>'+_bscEsc(LOAI_SK[e.loai]||e.loai)+'</b>'+
      '<span class="bsk-ev-ngay">'+_bscEsc(e.ngay||'')+'</span></div>'+
      '<div class="bsk-ev-mota">'+_bscEsc(e.mo_ta||'')+'</div>'+
      _bskEvPills(e)+
      '<input class="bsk-ev-note" data-key="'+_bscEsc(e.event_key)+'" placeholder="Phản hồi cho nhân viên (nếu có)…" value="'+_bscEsc(e.phan_hoi||'')+'" onchange="bskEventNote(\''+_bscEsc(e.event_key)+'\',this)">'+
      '</div>';
  });
  h+='</div>';
  // ── hình thức xử lý CUỐI (áp ra bảng ngoài) ──
  h+='<div class="bsk-sec bsk-final"><div class="bsk-h3">Hình thức xử lý cuối cùng</div>'+
    '<div class="bsk-final-hint">Chọn 1 hình thức áp cho nhân viên này (hiện ở bảng ngoài + gửi thông báo cho NV).</div>'+
    _bskFinalPills()+
    '<textarea id="bsk-final-note" rows="2" placeholder="Ghi chú/phản hồi chung cho nhân viên…">'+_bscEsc(d._finalNote||'')+'</textarea>'+
    '<div class="bsk-final-act">'+
      (d.chot&&d.chot.hinh_thuc?'<button type="button" class="bsk-bochot" onclick="bskBoChot()">Bỏ chốt</button>':'')+
      '<button type="button" class="bsk-chot" onclick="bskChot()">✓ Chốt xử lý</button>'+
    '</div>'+
    (d.chot&&d.chot.khi?'<div class="bsk-chot-info">Đã chốt: '+_bskHFLabel(d.chot.hinh_thuc)+' · '+_bscEsc(d.chot.nguoi_xu_ly||'')+' · '+_bscEsc(d.chot.khi)+'</div>':'')+
  '</div>';
  // ── tường trình / biên bản NV đã nộp ──
  var bb=d.bien_ban||[];
  h+='<div class="bsk-sec"><div class="bsk-h3">Tường trình · Biên bản NV đã nộp ('+bb.length+')</div>';
  if(!bb.length){ h+='<div class="bsk-none">Chưa nộp tường trình/biên bản nào.</div>'; }
  bb.forEach(function(b){ var lo=LOAI[b.loai]||['mien',b.loai];
    var anhs=(b.anh_urls&&b.anh_urls.length)?b.anh_urls:(b.anh_url?[b.anh_url]:[]);
    h+='<div class="bsk-bb">'+
      '<div class="bsk-bb-top"><span class="bsk-tag '+lo[0]+'">'+_bscEsc(lo[1])+'</span>'+
        '<span class="bsk-bb-khi">'+_bscEsc(b.khi||'')+'</span></div>'+
      '<div class="bsk-bb-nd">'+_bscEsc(b.noi_dung||'')+'</div>'+
      (anhs.length?'<div class="bsk-bb-anhs">'+anhs.map(function(u){return '<a href="'+_bscEsc(u)+'" target="_blank" rel="noopener"><img class="bsk-bb-anh" src="'+_bscEsc(u)+'" alt="Ảnh"></a>';}).join('')+'</div>':'')+
      '</div>';
  });
  h+='</div></div></div></div>';
  ov.innerHTML=h;
}
// QLNS chọn hình thức xử lý cho 1 lỗi (bấm lại = bỏ chọn)
async function bskSetEvent(eventKey, code){
  if(!_bskCurD) return; _bskSyncNotes();
  var ev=(_bskCurD.su_kien||[]).find(function(e){return e.event_key===eventKey;}); if(!ev) return;
  var moi=(ev.hinh_thuc===code)?'':code;   // bấm lại hình thức đang chọn → bỏ
  ev.hinh_thuc=moi||null;
  _bskRenderDetail();
  try{
    await supa.rpc('fn_bs_ks_xl_event',{p_ma_admin:SESSION.ma,p_ma_nv:_bskCurD.ma_nv,p_thang:_bskCurD.thang,p_event_key:eventKey,p_hinh_thuc:moi,p_phan_hoi:ev.phan_hoi||null});
  }catch(e){ if(typeof showToast==='function')showToast('Lỗi lưu','warn'); }
}
// Lưu phản hồi 1 lỗi (khi rời ô) — chỉ lưu nếu lỗi đã có hình thức
async function bskEventNote(eventKey, inp){
  if(!_bskCurD) return;
  var ev=(_bskCurD.su_kien||[]).find(function(e){return e.event_key===eventKey;}); if(!ev) return;
  ev.phan_hoi=inp.value;
  if(!ev.hinh_thuc) return;   // chưa chọn hình thức → chưa lưu (sẽ lưu khi chọn)
  try{
    await supa.rpc('fn_bs_ks_xl_event',{p_ma_admin:SESSION.ma,p_ma_nv:_bskCurD.ma_nv,p_thang:_bskCurD.thang,p_event_key:eventKey,p_hinh_thuc:ev.hinh_thuc,p_phan_hoi:ev.phan_hoi||null});
  }catch(e){}
}
function bskChotPick(code){ _bskSyncNotes(); _bskFinalPick=(_bskFinalPick===code)?null:code; _bskRenderDetail(); }
async function bskChot(){
  if(!_bskCurD) return; _bskSyncNotes();
  if(!_bskFinalPick){ if(typeof showToast==='function')showToast('Chọn hình thức xử lý trước','warn'); return; }
  try{
    var r=await supa.rpc('fn_bs_ks_chot',{p_ma_admin:SESSION.ma,p_ma_nv:_bskCurD.ma_nv,p_thang:_bskCurD.thang,p_hinh_thuc:_bskFinalPick,p_phan_hoi:_bskCurD._finalNote||null});
    if(r.data&&r.data.ok){ if(typeof showToast==='function')showToast('✓ Đã chốt xử lý — đã gửi thông báo NV','ok'); bskCloseNV(); bskReload(); }
    else if(typeof showToast==='function')showToast((r.data&&r.data.error)||'Lỗi','warn');
  }catch(e){ if(typeof showToast==='function')showToast('Lỗi kết nối','warn'); }
}
async function bskBoChot(){
  if(!_bskCurD) return;
  try{
    var r=await supa.rpc('fn_bs_ks_chot',{p_ma_admin:SESSION.ma,p_ma_nv:_bskCurD.ma_nv,p_thang:_bskCurD.thang,p_hinh_thuc:'',p_phan_hoi:null});
    if(r.data&&r.data.ok){ if(typeof showToast==='function')showToast('Đã bỏ chốt','ok'); bskCloseNV(); bskReload(); }
  }catch(e){ if(typeof showToast==='function')showToast('Lỗi kết nối','warn'); }
}

/* Globals */
window.bskInitPage=bskInitPage; window.bskReload=bskReload; window.bskDoiThang=bskDoiThang;
window.bskLoc=bskLoc; window.bskOpenNV=bskOpenNV; window.bskCloseNV=bskCloseNV;
window.bskSetEvent=bskSetEvent; window.bskEventNote=bskEventNote;
window.bskChotPick=bskChotPick; window.bskChot=bskChot; window.bskBoChot=bskBoChot;
window._bscGateVaoCa = _bscGateVaoCa;
window._bscQuaAnHan = _bscQuaAnHan;
window._bscDongCong = _bscDongCong;
window.bscbbMo = bscbbMo;
window.bsBienBanMo = bsBienBanMo;
window.bscbbChonAnh = bscbbChonAnh;
window.bscbbXoaAnh = bscbbXoaAnh;
window.bscbbGui = bscbbGui;
