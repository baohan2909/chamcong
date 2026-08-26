// ═══════════════════════════════════════════════════════════════════════════
//  KIỂM SOÁT BỔ SUNG — Pha 2: CỔNG BIÊN BẢN ở chấm công (điểm ≤6)
//  Hook: selType('Vào ca','vao') (02-system.js) → _bscGateVaoCa.
//  Luật (Aroma): điểm ≤6 chưa nộp biên bản → chặn 30s cảnh báo → cho chấm 1 LẦN
//  ân hạn duy nhất (báo NV rõ) → lần sau chưa nộp biên bản thì CHẶN HẲN.
// ═══════════════════════════════════════════════════════════════════════════

let _bscPending = null;      // {loai, btnId} đang chờ qua cổng
let _bscCountIv = null;

function _bscGateRoot(){
  let r = document.getElementById('bsg-root');
  if (!r){ r = document.createElement('div'); r.id = 'bsg-root'; document.body.appendChild(r); }
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
        '<div style="font-size:13px;color:#374151;line-height:1.6;margin:10px 0 4px">Điểm <b>'+diem+'/10</b> — bạn còn <b>'+owed+' tường trình</b> chưa nộp. Quy định: <b>mỗi điểm dưới 7 = 1 tường trình</b>, bắt buộc nộp.</div>'+
        '<div style="font-size:12.5px;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:10px 12px;margin:12px 0;line-height:1.55">'+
          'Lần này bạn được chấm công sau <b id="bsg-count">30</b> giây — <b>CHỈ 1 LẦN DUY NHẤT</b>.<br>'+
          'Nếu chưa nộp đủ tường trình, <b>lần chấm công sau sẽ bị CHẶN HOÀN TOÀN</b>.</div>'+
        '<button onclick="bscbbMo()" style="width:100%;padding:12px;margin-bottom:9px;background:linear-gradient(135deg,#B45309,#D97706);color:#fff;border:none;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer">📝 Nộp tường trình ngay</button>'+
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
        '<div style="font-size:13px;color:#374151;line-height:1.6;margin:10px 0 14px">Bạn đã dùng lần ân hạn nhưng còn <b>'+owed+' tường trình</b> chưa nộp (điểm '+diem+'/10). Vui lòng nộp đủ tường trình để tiếp tục chấm công — nếu không sẽ bị <b>xử lý kỷ luật</b>.</div>'+
        '<button onclick="bscbbMo()" style="width:100%;padding:12px;margin-bottom:9px;background:linear-gradient(135deg,#B91C1C,#DC2626);color:#fff;border:none;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer">📝 Nộp tường trình ngay</button>'+
        '<button onclick="_bscDongCong()" style="width:100%;padding:11px;background:#F3F4F6;color:#374151;border:none;border-radius:11px;font-weight:600;font-size:13.5px;cursor:pointer">Đóng</button>'+
      '</div></div>';
}
function _bscDongCong(){ const r=document.getElementById('bsg-root'); if(r)r.innerHTML=''; if(_bscCountIv){clearInterval(_bscCountIv);_bscCountIv=null;} _bscPending=null; }

// Bấm "Chấm công lần này" sau 30s → đánh dấu grace + cho qua chấm công
async function _bscQuaAnHan(){
  try { await supa.rpc('fn_bs_dung_grace', { p_ma_nv: SESSION.ma }); } catch(e){}
  const p = _bscPending; _bscDongCong();
  if (typeof showToast==='function') showToast('Đã dùng lần ân hạn — nhớ nộp tường trình, lần sau sẽ bị chặn.', 'warn');
  if (p){ window._bscGateOK = true; try{ selType(p.loai, p.btnId); }catch(e){} }
}

// ─── Nộp biên bản (text + ảnh) ───
let _bscbbAnh = null;
function bscbbMo(){
  _bscbbAnh = null;
  const root = _bscGateRoot();
  root.innerHTML =
    '<div class="bsg-ov" style="position:fixed;inset:0;z-index:12100;background:rgba(10,10,12,.72);display:flex;align-items:flex-end;justify-content:center;padding:0">'+
      '<div style="background:#fff;border-radius:16px 16px 0 0;max-width:460px;width:100%;padding:18px;max-height:92vh;overflow-y:auto">'+
        '<div style="width:36px;height:4px;background:#D1D5DB;border-radius:2px;margin:0 auto 12px"></div>'+
        '<div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:3px">📝 Nộp tường trình</div>'+
        '<div style="font-size:12px;color:#6B7280;margin-bottom:12px">Mỗi điểm trừ (lỗi) cần 1 tường trình. Giải trình lỗi + cam kết cải thiện; có thể đính kèm ảnh tường trình giấy.</div>'+
        '<textarea id="bsbb-nd" rows="4" placeholder="Nội dung giải trình lỗi / cam kết cải thiện…" style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #D1D5DB;border-radius:8px;font-size:13px;resize:none"></textarea>'+
        '<div style="margin-top:10px">'+
          '<label style="display:inline-flex;align-items:center;gap:7px;padding:9px 13px;background:#EEF6F5;border:1px solid #99F6E4;border-radius:9px;color:#0F766E;font-size:12.5px;font-weight:700;cursor:pointer">📎 Chọn ảnh tường trình<input type="file" accept="image/*" style="display:none" onchange="bscbbChonAnh(this)"></label>'+
          '<span id="bsbb-anh-ten" style="font-size:11.5px;color:#059669;margin-left:8px"></span>'+
        '</div>'+
        '<img id="bsbb-anh-preview" style="display:none;max-width:130px;max-height:130px;border-radius:9px;margin-top:9px;border:1px solid #E5E7EB;object-fit:cover">'+
        '<div id="bsbb-err" style="display:none;color:#DC2626;font-size:12px;margin-top:8px;padding:8px;background:#FEF2F2;border-radius:6px"></div>'+
        '<div style="display:flex;gap:8px;margin-top:14px">'+
          '<button onclick="_bscDongCong()" style="flex:1;padding:12px;background:#F3F4F6;color:#374151;border:none;border-radius:8px;font-weight:500;font-size:14px;cursor:pointer">Hủy</button>'+
          '<button id="bsbb-gui" onclick="bscbbGui()" style="flex:2;padding:12px;background:linear-gradient(135deg,#0F6E56,#1D9E75);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer">Nộp tường trình</button>'+
        '</div>'+
      '</div></div>';
  setTimeout(function(){ const t=document.getElementById('bsbb-nd'); if(t)t.focus(); }, 80);
}
async function bscbbChonAnh(inp){
  const f = inp.files && inp.files[0]; if (!f) return;
  const ten = document.getElementById('bsbb-anh-ten'); if (ten) ten.textContent = '⏳ Đang xử lý ảnh…';
  try {
    let out = { blob: f, dataUrl: null };
    if (typeof muanonCompressAnh === 'function') out = await muanonCompressAnh(f);
    _bscbbAnh = out.blob || f;
    if (ten) ten.textContent = '✓ Đã chọn ảnh';
    const pv = document.getElementById('bsbb-anh-preview');
    if (pv && out.dataUrl){ pv.src = out.dataUrl; pv.style.display = 'block'; }
  } catch(e){ if (ten) ten.textContent = 'Lỗi ảnh — thử lại'; _bscbbAnh = null; }
}
async function _bscUploadAnh(blob){
  try {
    const path = 'bb/' + (SESSION.ma||'KHAC') + '_' + Date.now() + '.jpg';
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
  if (nd.length < 15){ show('Nội dung tối thiểu 15 ký tự.'); return; }
  const btn = document.getElementById('bsbb-gui'); if (btn){ btn.disabled=true; btn.textContent='Đang nộp…'; }
  try {
    let anhUrl = null;
    if (_bscbbAnh) anhUrl = await _bscUploadAnh(_bscbbAnh);
    const { data, error } = await supa.rpc('fn_bs_nop_bien_ban', { p_ma_nv: SESSION.ma, p_loai: 'TUONG_TRINH', p_noi_dung: nd, p_anh_url: anhUrl });
    if (error) throw error;
    if (data && data.ok === false){ show(data.error || 'Lỗi nộp tường trình'); if(btn){btn.disabled=false;btn.textContent='Nộp tường trình';} return; }
    _bscDongCong();
    if (typeof showToast==='function') showToast('✓ Đã nộp tường trình. Bạn có thể chấm công. QLNS sẽ xem xét.', 'ok');
  } catch(e){
    show((e && e.message) || 'Lỗi kết nối'); if(btn){btn.disabled=false;btn.textContent='Nộp tường trình';}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Pha 3: TRANG "KIỂM SOÁT BỔ SUNG & KỶ LUẬT" (ADMIN + QLNS)
// ═══════════════════════════════════════════════════════════════════════════
let _bskThang = null, _bskFilter = 'all', _bskData = null, _bskBusy = false;
function _bskCoQuyen(){ if(!SESSION||!SESSION.ma) return false; var r=String(SESSION.vaiTro||'').toUpperCase(); return r==='ADMIN'||r==='QLNS'||SESSION.ma==='NS00490'; }
function _bskMoney(){}
function _bskThangDefault(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }

function bskInitPage(){
  var root=document.getElementById('bsk-root'); if(!root) return;
  if(!_bskCoQuyen()){ root.innerHTML='<div style="padding:40px;text-align:center;color:#9CA3AF">Chức năng dành cho Quản trị &amp; QLNS.</div>'; return; }
  if(!_bskThang) _bskThang=_bskThangDefault();
  root.innerHTML=
    '<div style="max-width:1100px;margin:0 auto;padding:14px">'+
      '<div style="position:relative;overflow:hidden;background:var(--grad);color:#fff;border-radius:16px;padding:18px 20px;margin-bottom:14px;box-shadow:0 12px 30px -12px rgba(20,33,58,.5)">'+
        '<div style="position:absolute;right:-40px;top:-50px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.08)"></div>'+
        '<div style="position:relative;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.85">Nhân sự · Kiểm soát</div>'+
        '<div style="position:relative;font-size:20px;font-weight:800;margin-top:4px;letter-spacing:-.01em">Kiểm soát bổ sung &amp; kỷ luật</div>'+
        '<div style="position:relative;font-size:12.5px;opacity:.9;margin-top:3px">Tường trình · biên bản · điểm · trạng thái xử lý</div>'+
      '</div>'+
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">'+
        '<label style="font-size:12.5px;color:var(--ink-2);font-weight:600">Tháng <input type="month" id="bsk-thang" value="'+_bskThang+'" onchange="bskDoiThang(this.value)" style="padding:7px 9px;border:1.5px solid var(--line);border-radius:8px;font-size:13px;margin-left:4px;background:#fff;color:var(--ink)"></label>'+
        '<button onclick="bskReload()" style="padding:8px 13px;background:#fff;border:1.5px solid rgba(63,182,168,.5);border-radius:8px;font-size:12.5px;font-weight:700;color:var(--teal-deep);cursor:pointer">↻ Làm mới</button>'+
      '</div>'+
      '<div id="bsk-tq" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px"></div>'+
      '<div id="bsk-filter" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px"></div>'+
      '<div id="bsk-list"></div>'+
    '</div>'+
    '<div id="bsk-modal"></div>';
  bskReload();
}
function bskDoiThang(v){ _bskThang=v||_bskThangDefault(); bskReload(); }
async function bskReload(){
  if(_bskBusy) return; _bskBusy=true;
  var list=document.getElementById('bsk-list'); if(list)list.innerHTML='<div style="padding:30px;text-align:center;color:#9CA3AF">⏳ Đang tải…</div>';
  try{
    var r=await supa.rpc('fn_bs_ks_list',{p_ma_admin:SESSION.ma,p_thang:_bskThang,p_trang_thai:null});
    var d=r.data||{};
    if(d.ok===false){ if(list)list.innerHTML='<div style="padding:24px;text-align:center;color:#DC2626">'+_bscEsc(d.error||'Không có quyền')+'</div>'; _bskBusy=false; return; }
    _bskData=d; _bskRenderTQ(d.tong_quan||{}); _bskRenderFilter(d.tong_quan||{}); _bskRenderList();
  }catch(e){ if(list)list.innerHTML='<div style="padding:24px;text-align:center;color:#DC2626">Lỗi tải: '+_bscEsc((e&&e.message)||'')+'</div>'; }
  _bskBusy=false;
}
function _bskTile(n,l,c){ return '<div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:11px 10px;text-align:center;box-shadow:0 1px 2px rgba(20,33,58,.04)"><div style="font-size:22px;font-weight:800;color:'+c+';font-variant-numeric:tabular-nums;line-height:1;font-family:ui-monospace,Menlo,monospace">'+n+'</div><div style="font-size:10.5px;color:var(--ink-2);margin-top:3px">'+l+'</div></div>'; }
function _bskRenderTQ(t){ var el=document.getElementById('bsk-tq'); if(!el)return;
  el.innerHTML=_bskTile(t.so_nv||0,'NV có case','var(--magenta)')+_bskTile(t.cho_xu_ly||0,'Chờ xử lý','#B45309')+_bskTile(t.so_bien_ban||0,'Biên bản','var(--teal-deep)')+_bskTile(t.so_tuong_trinh||0,'Tường trình','#B45309')+_bskTile(t.so_ky_luat||0,'Kỷ luật','var(--red)'); }
function _bskRenderFilter(){ var el=document.getElementById('bsk-filter'); if(!el)return;
  var chips=[['all','Tất cả'],['CHO_XU_LY','Chờ xử lý'],['KY_LUAT','Kỷ luật'],['DA_XU_LY','Đã xử lý']];
  el.innerHTML=chips.map(function(c){ var on=_bskFilter===c[0];
    return '<button onclick="bskLoc(\''+c[0]+'\')" style="padding:6px 13px;border-radius:100px;border:1.5px solid '+(on?'transparent':'var(--line)')+';background:'+(on?'var(--teal-deep)':'#fff')+';color:'+(on?'#fff':'var(--ink-2)')+';font-size:12px;font-weight:700;cursor:pointer'+(on?';box-shadow:0 0 12px rgba(63,182,168,.35)':'')+'">'+c[1]+'</button>';
  }).join(''); }
function bskLoc(f){ _bskFilter=f; _bskRenderFilter(); _bskRenderList(); }
function _bskChip(tt){ var m={CHO_XU_LY:['#FEF3C7','#92400E','Chờ xử lý'],KY_LUAT:['#FEE2E2','#991B1B','Kỷ luật'],DA_XU_LY:['#DCFCE7','#166534','Đã xử lý'],MIEN:['#F3F4F6','#6B7280','Miễn']}[tt]||['#F3F4F6','#6B7280',tt];
  return '<span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;background:'+m[0]+';color:'+m[1]+'">'+m[2]+'</span>'; }
function _bskRenderList(){
  var el=document.getElementById('bsk-list'); if(!el||!_bskData)return;
  var ds=(_bskData.ds||[]).filter(function(x){ return _bskFilter==='all' || x.trang_thai===_bskFilter; });
  if(!ds.length){ el.innerHTML='<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:30px;text-align:center;color:#9CA3AF">Không có case '+(_bskFilter==='all'?'':'khớp lọc')+' trong tháng.</div>'; return; }
  var rows=ds.map(function(x){
    var dColor=(x.diem_min!=null&&x.diem_min<=5)?'#DC2626':(x.diem_min!=null&&x.diem_min<=6)?'#D97706':'#059669';
    var tags='';
    if(x.so_tt)tags+='<span style="font-size:10px;background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:5px;margin-right:3px">TT '+x.so_tt+'</span>';
    if(x.so_bb)tags+='<span style="font-size:10px;background:#E1F5EE;color:#0F6E56;padding:1px 6px;border-radius:5px;margin-right:3px">BB '+x.so_bb+'</span>';
    if(x.so_kl)tags+='<span style="font-size:10px;background:#FEE2E2;color:#991B1B;padding:1px 6px;border-radius:5px">KL '+x.so_kl+'</span>';
    return '<tr onclick="bskOpenNV(\''+_bscEsc(x.ma_nv)+'\')" style="cursor:pointer;border-bottom:1px solid #F3F4F6">'+
      '<td style="padding:10px 11px"><div style="font-weight:700;color:#111827;font-size:13px">'+_bscEsc(x.ten_nv||x.ma_nv)+'</div><div style="font-size:11px;color:#9CA3AF">'+_bscEsc(x.ma_nv)+'</div></td>'+
      '<td style="padding:10px 11px;font-size:12px;color:#4B5563">'+_bscEsc(x.ten_ch||'—')+'</td>'+
      '<td style="padding:10px 11px;text-align:center;font-weight:800;color:'+dColor+'">'+(x.diem_min!=null?x.diem_min:'—')+'</td>'+
      '<td style="padding:10px 11px;text-align:center;font-weight:700;color:#111827">'+(x.so_lan_bs||0)+'</td>'+
      '<td style="padding:10px 11px">'+tags+'</td>'+
      '<td style="padding:10px 11px">'+_bskChip(x.trang_thai)+'</td>'+
      '<td style="padding:10px 6px;color:#D1D5DB">›</td></tr>';
  }).join('');
  el.innerHTML='<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:640px">'+
    '<thead><tr style="background:#FAFAF8">'+['Nhân viên','Cửa hàng','Điểm','Lần BS','Loại','Trạng thái',''].map(function(h,i){return '<th style="text-align:'+(i>=2&&i<=3?'center':'left')+';font-size:10.5px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.03em;padding:9px 11px;white-space:nowrap">'+h+'</th>';}).join('')+'</tr></thead>'+
    '<tbody>'+rows+'</tbody></table></div></div>';
}
// Chi tiết NV
async function bskOpenNV(maNV){
  var ov=document.getElementById('bsk-modal'); if(!ov)return;
  ov.innerHTML='<div style="position:fixed;inset:0;z-index:11000;background:rgba(10,15,20,.55);display:flex;align-items:center;justify-content:center;padding:16px"><div style="background:#fff;border-radius:16px;max-width:560px;width:100%;padding:24px;text-align:center;color:#9CA3AF">⏳ Đang tải hồ sơ…</div></div>';
  try{
    var r=await supa.rpc('fn_bs_ks_detail',{p_ma_admin:SESSION.ma,p_ma_nv:maNV,p_thang:_bskThang});
    var d=r.data||{};
    if(d.ok===false){ bskCloseNV(); if(typeof showToast==='function')showToast(d.error||'Lỗi','warn'); return; }
    _bskRenderDetail(ov,d);
  }catch(e){ bskCloseNV(); if(typeof showToast==='function')showToast('Lỗi tải','warn'); }
}
function bskCloseNV(){ var ov=document.getElementById('bsk-modal'); if(ov)ov.innerHTML=''; }
function _bskRenderDetail(ov,d){
  var LOAI={TUONG_TRINH:['#FEF3C7','#92400E','Tường trình'],BIEN_BAN:['#E1F5EE','#0F6E56','Biên bản'],KY_LUAT:['#FEE2E2','#991B1B','Kỷ luật']};
  var dColor=(d.diem!=null&&d.diem<=5)?'#DC2626':(d.diem!=null&&d.diem<=6)?'#D97706':'#059669';
  var h='<div onclick="if(event.target===this)bskCloseNV()" style="position:fixed;inset:0;z-index:11000;background:rgba(10,15,20,.55);display:flex;align-items:flex-end;justify-content:center;padding:0">'+
    '<div style="background:var(--bg,#F5F6F4);border-radius:18px 18px 0 0;max-width:560px;width:100%;max-height:92vh;overflow-y:auto">'+
      '<div style="background:var(--grad);color:#fff;padding:18px 18px 16px;position:relative;border-radius:18px 18px 0 0">'+
        '<button onclick="bskCloseNV()" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;border:none;font-size:18px;cursor:pointer">×</button>'+
        '<div style="font-size:17px;font-weight:800">'+_bscEsc(d.ten_nv||d.ma_nv)+'</div>'+
        '<div style="font-size:12px;opacity:.9;margin-top:2px">'+_bscEsc(d.ma_nv)+' · '+_bscEsc(d.thang||'')+'</div>'+
        '<div style="display:flex;gap:16px;margin-top:12px">'+
          '<div><div style="font-size:22px;font-weight:800;line-height:1">'+(d.diem!=null?d.diem:'—')+'<span style="font-size:12px;opacity:.8">/10</span></div><div style="font-size:10.5px;opacity:.85">điểm</div></div>'+
          '<div><div style="font-size:22px;font-weight:800;line-height:1">'+(d.so_lan_bs||0)+'</div><div style="font-size:10.5px;opacity:.85">lần bổ sung</div></div>'+
        '</div></div>';
  // sự kiện trừ điểm
  var sk=d.su_kien||[];
  h+='<div style="padding:14px 16px 4px"><div style="font-size:12px;font-weight:800;color:#4B5563;text-transform:uppercase;letter-spacing:.03em;margin-bottom:8px">Sự kiện trừ điểm ('+sk.length+')</div>';
  if(!sk.length)h+='<div style="color:#9CA3AF;font-size:12.5px;padding:6px 0">Chưa bị trừ điểm.</div>';
  sk.forEach(function(e){ var lo={QUEN_RA:'Quên ra ca',QUEN_VAO:'Quên vào ca',THIEU_LICH:'Thiếu lịch',THIEU_ANH:'Thiếu ảnh',THIEU_BANGIAO:'Thiếu bàn giao',BO_SUNG:'Bổ sung ca'}[e.loai]||e.loai;
    h+='<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#fff;border:1px solid #E5E7EB;border-radius:9px;margin-bottom:5px;font-size:12px"><span style="font-weight:700;color:#111827;min-width:90px">'+_bscEsc(lo)+'</span><span style="color:#6B7280;flex:1">'+_bscEsc(e.mo_ta||'')+'</span>'+(e.da_mien?'<span style="font-size:10px;color:#059669">đã miễn</span>':'')+'</div>'; });
  h+='</div>';
  // biên bản / tường trình
  var bb=d.bien_ban||[];
  h+='<div style="padding:8px 16px 18px"><div style="font-size:12px;font-weight:800;color:#4B5563;text-transform:uppercase;letter-spacing:.03em;margin-bottom:8px">Tường trình · Biên bản ('+bb.length+')</div>';
  if(!bb.length)h+='<div style="color:#9CA3AF;font-size:12.5px;padding:6px 0">Chưa nộp tường trình/biên bản nào.</div>';
  bb.forEach(function(b){ var lo=LOAI[b.loai]||['#F3F4F6','#6B7280',b.loai];
    h+='<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:12px;margin-bottom:9px">'+
      '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:6px"><span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:5px;background:'+lo[0]+';color:'+lo[1]+'">'+lo[2]+'</span>'+_bskChip(b.trang_thai)+'<span style="font-size:11px;color:#9CA3AF;margin-left:auto">'+_bscEsc(b.khi||'')+'</span></div>'+
      '<div style="font-size:13px;color:#111827;line-height:1.5">'+_bscEsc(b.noi_dung||'')+'</div>'+
      (b.anh_url?'<a href="'+_bscEsc(b.anh_url)+'" target="_blank"><img src="'+_bscEsc(b.anh_url)+'" style="max-width:120px;max-height:120px;border-radius:9px;margin-top:8px;border:1px solid #E5E7EB;object-fit:cover"></a>':'')+
      (b.ghi_chu_ql?'<div style="font-size:11.5px;color:#6B7280;margin-top:7px;padding:7px 9px;background:#F9FAFB;border-radius:7px">QL: '+_bscEsc(b.ghi_chu_ql)+(b.nguoi_xu_ly?' · '+_bscEsc(b.nguoi_xu_ly):'')+'</div>':'')+
      '<div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">'+
        '<button onclick="bskXuLy('+b.id+',\'DA_DUYET\')" style="flex:1;min-width:80px;padding:8px;background:#DCFCE7;color:#166534;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✓ Duyệt</button>'+
        '<button onclick="bskXuLy('+b.id+',\'KY_LUAT\')" style="flex:1;min-width:80px;padding:8px;background:#FEE2E2;color:#991B1B;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Kỷ luật</button>'+
        '<button onclick="bskXuLy('+b.id+',\'MIEN\')" style="flex:1;min-width:80px;padding:8px;background:#F3F4F6;color:#4B5563;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Miễn</button>'+
      '</div></div>'; });
  h+='</div></div></div>';
  ov.innerHTML=h;
}
async function bskXuLy(id, tt){
  var gc=null;
  if(tt==='KY_LUAT'){ gc=window.prompt('Ghi chú kỷ luật (tùy chọn):','')||''; }
  try{
    var r=await supa.rpc('fn_bs_ks_xu_ly',{p_ma_admin:SESSION.ma,p_id:id,p_trang_thai:tt,p_ghi_chu:gc});
    if(r.data&&r.data.ok){ if(typeof showToast==='function')showToast('✓ Đã cập nhật','ok'); bskCloseNV(); bskReload(); }
    else if(typeof showToast==='function')showToast((r.data&&r.data.error)||'Lỗi','warn');
  }catch(e){ if(typeof showToast==='function')showToast('Lỗi kết nối','warn'); }
}

/* Globals */
window.bskInitPage=bskInitPage; window.bskReload=bskReload; window.bskDoiThang=bskDoiThang;
window.bskLoc=bskLoc; window.bskOpenNV=bskOpenNV; window.bskCloseNV=bskCloseNV; window.bskXuLy=bskXuLy;
window._bscGateVaoCa = _bscGateVaoCa;
window._bscQuaAnHan = _bscQuaAnHan;
window._bscDongCong = _bscDongCong;
window.bscbbMo = bscbbMo;
window.bscbbChonAnh = bscbbChonAnh;
window.bscbbGui = bscbbGui;
