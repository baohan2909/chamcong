// ════════════════════════════════════════════════════════════════════
// [v17.27] TRƯỞNG CA v2 — banner cam + bảng hỏi khi vào ca + chuyển Trưởng ca
//  Đọc: fn_truong_ca_trang_thai · Chuyển: fn_chuyen_truong_ca (sinh 4 dòng auto)
// ════════════════════════════════════════════════════════════════════
let _tcState = { tc:null, dangCa:[], maCh:null };

function tcStoreMa(){ const el=document.getElementById('sel-cuahang'); return el?(el.value||''):''; }
function tcStoreTen(){ const el=document.getElementById('input-ch-display'); return el?(el.value||''):''; }
function tcToday(){ return new Date().toISOString().substring(0,10); }
function tcLaToi(){ return !!(_tcState.tc && SESSION && _tcState.tc.ma_nv===SESSION.ma); }
const TC_FLAG_SVG='<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>';

async function tcRefreshBanner(){
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

function tcRenderBanner(){
  const el=document.getElementById('tc-banner'); if(!el) return;
  if(tcLaToi()){
    el.style.display='block';
    el.innerHTML=`<div style="display:flex;align-items:center;gap:11px;background:linear-gradient(135deg,#F97316,#C2410C);border-radius:16px;padding:13px 14px;box-shadow:0 6px 18px rgba(194,65,12,.28)">
      <div style="flex:none;width:40px;height:40px;border-radius:11px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px">${TC_FLAG_SVG}</svg>
      </div>
      <div style="flex:1;min-width:0;color:#fff">
        <div style="font-size:15px;font-weight:800">Bạn đang là Trưởng ca</div>
        <div style="font-size:11.5px;opacity:.92;margin-top:1px">Chịu trách nhiệm chính ca hiện tại</div>
      </div>
      <button onclick="tcOpenTransfer()" style="flex:none;border:none;border-radius:11px;padding:9px 13px;font-size:13px;font-weight:800;color:#C2410C;background:#fff;cursor:pointer;white-space:nowrap">Chuyển</button>
    </div>`;
  } else { el.style.display='none'; el.innerHTML=''; }
}

function tcRenderToggleState(){
  const tg=document.getElementById('tc-toggle'); const info=document.getElementById('tc-info');
  const tcKhac=_tcState.tc && SESSION && _tcState.tc.ma_nv!==SESSION.ma;
  if(tcLaToi()){
    if(tg) tg.style.display='none';
    if(info) info.style.display='none';
  } else if(tcKhac){
    if(tg) tg.style.display='none';
    const cb=document.getElementById('tc-checkbox'); if(cb) cb.checked=false;
    if(info){ info.style.display='flex';
      info.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex:none">${TC_FLAG_SVG}</svg><span>Ca này · Trưởng ca: <b>${escHtml(_tcState.tc.ten||'')}</b></span>`; }
  } else {
    if(tg) tg.style.display='';
    if(info) info.style.display='none';
  }
}

// Gọi từ doSubmit (thay cho _doSubmitContinueWithGPS trực tiếp)
// [v17.29] Kiểm tra TC ĐÚNG thời điểm chấm (re-query) → chỉ hỏi khi ca CHƯA có Trưởng ca
let _tcSubmitGuard=false;
async function tcCheckDialogBeforeSubmit(proceed){
  if(_tcSubmitGuard) return;
  _tcSubmitGuard=true;
  const go=()=>{ _tcSubmitGuard=false; proceed(); setTimeout(tcRefreshBanner, 3500); };
  const laVaoCa=(typeof state!=='undefined' && state && state.loai==='Vào ca');
  if(!laVaoCa){ go(); return; }                          // chỉ áp dụng khi VÀO CA
  const cb=document.getElementById('tc-checkbox');
  if(cb && cb.checked){ go(); return; }                  // đã tự nhận TC qua nút gạt → ghi luôn
  try{ await tcRefreshBanner(); }catch(e){}              // re-query trạng thái TC tại thời điểm chấm
  if(_tcState.tc){ go(); return; }                       // ca ĐÃ có Trưởng ca → KHÔNG hỏi, vào ca thường
  tcAskDialog(()=>{ if(cb) cb.checked=true; go(); }, ()=>{ if(cb) cb.checked=false; go(); }); // chưa có → hỏi
}

function tcCloseModal(){ const m=document.getElementById('tc-modal-root'); if(m) m.remove(); }

function tcAskDialog(onYes, onNo){
  tcCloseModal();
  const root=document.createElement('div'); root.id='tc-modal-root';
  root.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center';
  root.innerHTML=`<div style="background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:22px 20px 26px">
    <div style="width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,#F97316,#C2410C);display:flex;align-items:center;justify-content:center;margin-bottom:14px">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px">${TC_FLAG_SVG}</svg>
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
