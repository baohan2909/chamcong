// ════════════════════════════════════════════════════════════════════
// [v17.30] TRƯỞNG CA — thẻ chức danh (gradient + bong bóng) + bảng hỏi + chuyển
//  Hiện thẻ "TRƯỞNG CA · tên" cho MỌI máy trong ca:
//   • NV (trang chấm công): xem tên TC; nếu chính mình là TC → có nút Chuyển + chip BẠN
//   • Tài khoản cửa hàng (trang bán hàng): xem tên TC (không có nút Chuyển)
//  Đọc: fn_truong_ca_trang_thai · Chuyển: fn_chuyen_truong_ca (sinh 4 dòng auto)
// ════════════════════════════════════════════════════════════════════
let _tcState = { tc:null, dangCa:[], maCh:null };
let _tcPollTimer = null;
const TC_FLAG_SVG='<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>';

function tcStoreMa(){
  if(SESSION && SESSION.vaiTro==='CUA_HANG') return SESSION.cuaHangMa || '';
  const el=document.getElementById('sel-cuahang'); return el?(el.value||''):'';
}
function tcStoreTen(){
  if(SESSION && SESSION.vaiTro==='CUA_HANG') return SESSION.cuaHangTen || '';
  const el=document.getElementById('input-ch-display'); return el?(el.value||''):'';
}
function tcToday(){ return new Date().toISOString().substring(0,10); }
function tcLaToi(){ return !!(_tcState.tc && SESSION && _tcState.tc.ma_nv===SESSION.ma); }

async function tcRefreshBanner(){
  tcStartPoll();
  const maCh=tcStoreMa(); _tcState.maCh=maCh;
  if(!maCh||!SESSION){ _tcState.tc=null; _tcState.dangCa=[]; tcRenderBanner(); tcRenderToggleState(); return; }
  try{
    const { data, error } = await supa.rpc('fn_truong_ca_trang_thai', { p_ma_ch:maCh, p_ngay:tcToday() });
    if(error) throw error;
    _tcState.tc = (data&&data.tc)?data.tc:null;
    _tcState.dangCa = (data&&Array.isArray(data.dang_ca))?data.dang_ca:[];
  }catch(e){ _tcState.tc=null; _tcState.dangCa=[]; }
  tcRenderBanner(); tcRenderToggleState();
}

// Thẻ chức danh — phong cách header (gradient + 2 bong bóng tròn)
function tcCardHtml(coNutChuyen){
  const ten = escHtml((_tcState.tc && _tcState.tc.ten) || '');
  const chipBan = coNutChuyen ? '<span style="display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.04em;color:#fff;background:rgba(255,255,255,.26);padding:2px 7px;border-radius:7px;margin-left:9px;vertical-align:2px">BẠN</span>' : '';
  const nut = coNutChuyen ? '<button onclick="tcOpenTransfer()" style="flex:none;border:none;border-radius:12px;padding:10px 15px;font-size:13px;font-weight:800;color:#C2410C;background:#fff;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.16)">Chuyển</button>' : '';
  return `<div style="position:relative;overflow:hidden;background:linear-gradient(135deg,#F97316,#C2410C);border-radius:18px;padding:16px 18px;box-shadow:0 8px 24px rgba(194,65,12,.30)">
    <div style="position:absolute;right:-26px;top:-26px;width:124px;height:124px;border-radius:50%;background:rgba(255,255,255,.13)"></div>
    <div style="position:absolute;right:36px;top:24px;width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.10)"></div>
    <div style="position:relative;z-index:1;display:flex;align-items:center;gap:13px">
      <div style="flex:none;width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px">${TC_FLAG_SVG}</svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;font-weight:800;letter-spacing:.13em;color:rgba(255,255,255,.85);text-transform:uppercase">Trưởng ca · Phụ trách cửa hàng</div>
        <div style="font-size:18px;font-weight:800;color:#fff;margin-top:3px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ten}${chipBan}</div>
      </div>
      ${nut}
    </div>
  </div>`;
}

function tcRenderBanner(){
  const has = !!_tcState.tc;
  const elNV = document.getElementById('tc-banner');       // trang chấm công (NV + TC)
  const elCH = document.getElementById('tc-banner-ch');    // trang bán hàng (tài khoản cửa hàng)
  if(elNV){
    if(has){ elNV.style.display='block'; elNV.innerHTML = tcCardHtml(tcLaToi()); }
    else { elNV.style.display='none'; elNV.innerHTML=''; }
  }
  if(elCH){
    const isCH = !!(SESSION && SESSION.vaiTro==='CUA_HANG');
    if(has && isCH){ elCH.style.display='block'; elCH.innerHTML = tcCardHtml(false); }
    else { elCH.style.display='none'; elCH.innerHTML=''; }
  }
}

function tcRenderToggleState(){
  const tg=document.getElementById('tc-toggle'); if(!tg) return;
  if(_tcState.tc){ tg.style.display='none'; const cb=document.getElementById('tc-checkbox'); if(cb) cb.checked=false; }
  else { tg.style.display=''; }
}

// Poll nhẹ để mọi máy trong ca thấy TC cập nhật (chỉ khi đang ở trang chấm công/bán hàng + tab hiển thị)
function _tcOnRelevantPage(){
  const cc=document.getElementById('page-chamcong'); const bh=document.getElementById('page-banhang');
  return (cc&&cc.classList.contains('active')) || (bh&&bh.classList.contains('active'));
}
function tcStartPoll(){
  if(_tcPollTimer) return;
  _tcPollTimer=setInterval(()=>{
    if(document.visibilityState==='visible' && SESSION && _tcOnRelevantPage()) tcRefreshBanner();
  }, 60000);
}

// Gọi từ doSubmit — kiểm tra TC ĐÚNG thời điểm chấm → chỉ hỏi khi ca CHƯA có Trưởng ca
let _tcSubmitGuard=false;
async function tcCheckDialogBeforeSubmit(proceed){
  if(_tcSubmitGuard) return;
  _tcSubmitGuard=true;
  const go=()=>{ _tcSubmitGuard=false; proceed(); setTimeout(tcRefreshBanner, 3500); };
  const laVaoCa=(typeof state!=='undefined' && state && state.loai==='Vào ca');
  if(!laVaoCa){ go(); return; }
  const cb=document.getElementById('tc-checkbox');
  if(cb && cb.checked){ go(); return; }
  try{ await tcRefreshBanner(); }catch(e){}
  if(_tcState.tc){ go(); return; }
  tcAskDialog(()=>{ if(cb) cb.checked=true; go(); }, ()=>{ if(cb) cb.checked=false; go(); });
}

function tcCloseModal(){ const m=document.getElementById('tc-modal-root'); if(m) m.remove(); }

function tcAskDialog(onYes, onNo){
  tcCloseModal();
  const root=document.createElement('div'); root.id='tc-modal-root';
  root.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center';
  root.innerHTML=`<div style="background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:22px 20px 26px">
    <div style="position:relative;overflow:hidden;width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#F97316,#C2410C);display:flex;align-items:center;justify-content:center;margin-bottom:14px">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:25px;height:25px;position:relative;z-index:1">${TC_FLAG_SVG}</svg>
    </div>
    <div style="font-size:18px;font-weight:800;color:#0F2E45">Bạn có phải Trưởng ca hiện tại không?</div>
    <div style="font-size:13px;color:#64748B;margin-top:6px;line-height:1.5">Ca này chưa có Trưởng ca. Chọn "Là Trưởng ca" nếu bạn chịu trách nhiệm chính trong ca.</div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button id="tc-ask-no" style="flex:1;padding:14px;border:1.5px solid #E2E8F0;border-radius:13px;background:#fff;color:#64748B;font-size:15px;font-weight:700;cursor:pointer">Không</button>
      <button id="tc-ask-yes" style="flex:1;padding:14px;border:none;border-radius:13px;background:linear-gradient(135deg,#F97316,#C2410C);color:#fff;font-size:15px;font-weight:800;cursor:pointer">Là Trưởng ca</button>
    </div>
  </div>`;
  document.body.appendChild(root);
  document.getElementById('tc-ask-yes').onclick=()=>{ tcCloseModal(); onYes&&onYes(); };
  document.getElementById('tc-ask-no').onclick=()=>{ tcCloseModal(); onNo&&onNo(); };
}

function tcOpenTransfer(){
  tcCloseModal();
  const others=(_tcState.dangCa||[]).filter(p=>p.ma_nv!==SESSION.ma);
  const root=document.createElement('div'); root.id='tc-modal-root';
  root.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center';
  const list=others.length
    ? others.map(p=>`<button onclick="tcDoTransfer('${escHtml(p.ma_nv)}',this.getAttribute('data-ten'))" data-ten="${escHtml(p.ten||p.ma_nv)}" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:13px 12px;border:1px solid #E6EBF0;border-radius:13px;background:#fff;cursor:pointer;margin-bottom:8px">
        <div style="flex:none;width:36px;height:36px;border-radius:10px;background:#FFF7ED;color:#C2410C;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${escHtml((p.ten||'?').trim().charAt(0)||'?')}</div>
        <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#0F2E45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.ten||p.ma_nv)}</div><div style="font-size:11px;color:#94A3B8">${escHtml(p.ma_nv)} · đang trong ca</div></div>
        <svg viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2.4" style="width:18px;height:18px;flex:none"><polyline points="9 18 15 12 9 6"/></svg>
      </button>`).join('')
    : '<div style="text-align:center;color:#94A3B8;font-size:13px;padding:24px 8px;line-height:1.5">Chưa có nhân viên nào khác đang trong ca tại cửa hàng này để nhận Trưởng ca.</div>';
  root.innerHTML=`<div style="background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:20px 18px 24px;max-height:80vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="font-size:18px;font-weight:800;color:#0F2E45">Chuyển Trưởng ca</div>
      <button onclick="tcCloseModal()" style="border:none;background:#F1F5F9;width:32px;height:32px;border-radius:10px;font-size:18px;color:#64748B;cursor:pointer">×</button>
    </div>
    <div style="font-size:12.5px;color:#64748B;margin-bottom:16px;line-height:1.5">Chọn người nhận (phải đang trong ca tại cửa hàng). Người nhận thành Trưởng ca ngay, hệ thống tự chốt giờ.</div>
    ${list}</div>`;
  document.body.appendChild(root);
}

async function tcDoTransfer(denMaNv, denTen){
  const ok=await appConfirm('Chuyển Trưởng ca cho '+denTen+'?\nBạn sẽ trở lại vai trò nhân viên thường, hệ thống tự chốt giờ.', { title:'Chuyển Trưởng ca', okLabel:'Chuyển' });
  if(!ok) return;
  try{
    const { data, error } = await supa.rpc('fn_chuyen_truong_ca', {
      p_tu_ma_nv:SESSION.ma, p_tu_ten:SESSION.ten,
      p_den_ma_nv:denMaNv, p_den_ten:denTen,
      p_ma_ch:_tcState.maCh, p_ten_ch:tcStoreTen()
    });
    if(error||!data||!data.success){ showToast((data&&data.error)||(error&&error.message)||'Lỗi chuyển Trưởng ca','err'); return; }
    tcCloseModal();
    showToast('✓ Đã chuyển Trưởng ca cho '+denTen,'ok');
    tcRefreshBanner();
  }catch(e){ showToast('Lỗi kết nối','err'); }
}
