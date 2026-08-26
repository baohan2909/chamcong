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
  const diem = (d.diem!=null)?d.diem:'—';
  const root = _bscGateRoot();
  root.innerHTML =
    '<div class="bsg-ov" style="position:fixed;inset:0;z-index:12000;background:rgba(10,10,12,.78);display:flex;align-items:center;justify-content:center;padding:20px">'+
      '<div style="background:#fff;border-radius:18px;max-width:420px;width:100%;padding:22px 20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)">'+
        '<div style="width:60px;height:60px;margin:0 auto 12px;border-radius:50%;background:#FEF3C7;display:grid;place-items:center;font-size:30px">⚠️</div>'+
        '<div style="font-size:18px;font-weight:800;color:#92400E">Cảnh báo kiểm soát</div>'+
        '<div style="font-size:13px;color:#374151;line-height:1.6;margin:10px 0 4px">Bạn đang ở mức cảnh báo — <b>điểm '+diem+'/10</b>. Theo quy định <b>bắt buộc nộp biên bản cam kết</b>.</div>'+
        '<div style="font-size:12.5px;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:10px 12px;margin:12px 0;line-height:1.55">'+
          'Lần này bạn được chấm công sau <b id="bsg-count">30</b> giây — <b>CHỈ 1 LẦN DUY NHẤT</b>.<br>'+
          'Nếu chưa nộp biên bản, <b>lần chấm công sau sẽ bị CHẶN HOÀN TOÀN</b>.</div>'+
        '<button onclick="bscbbMo()" style="width:100%;padding:12px;margin-bottom:9px;background:linear-gradient(135deg,#B45309,#D97706);color:#fff;border:none;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer">📋 Nộp biên bản ngay</button>'+
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
  const diem = (d.diem!=null)?d.diem:'—';
  const root = _bscGateRoot();
  root.innerHTML =
    '<div class="bsg-ov" style="position:fixed;inset:0;z-index:12000;background:rgba(10,10,12,.82);display:flex;align-items:center;justify-content:center;padding:20px">'+
      '<div style="background:#fff;border-radius:18px;max-width:420px;width:100%;padding:22px 20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)">'+
        '<div style="width:60px;height:60px;margin:0 auto 12px;border-radius:50%;background:#FEE2E2;display:grid;place-items:center;font-size:30px">⛔</div>'+
        '<div style="font-size:18px;font-weight:800;color:#991B1B">Không thể chấm công</div>'+
        '<div style="font-size:13px;color:#374151;line-height:1.6;margin:10px 0 14px">Bạn đã dùng lần ân hạn nhưng <b>chưa nộp biên bản</b> (điểm '+diem+'/10). Vui lòng nộp biên bản cam kết để tiếp tục chấm công.</div>'+
        '<button onclick="bscbbMo()" style="width:100%;padding:12px;margin-bottom:9px;background:linear-gradient(135deg,#B91C1C,#DC2626);color:#fff;border:none;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer">📋 Nộp biên bản ngay</button>'+
        '<button onclick="_bscDongCong()" style="width:100%;padding:11px;background:#F3F4F6;color:#374151;border:none;border-radius:11px;font-weight:600;font-size:13.5px;cursor:pointer">Đóng</button>'+
      '</div></div>';
}
function _bscDongCong(){ const r=document.getElementById('bsg-root'); if(r)r.innerHTML=''; if(_bscCountIv){clearInterval(_bscCountIv);_bscCountIv=null;} _bscPending=null; }

// Bấm "Chấm công lần này" sau 30s → đánh dấu grace + cho qua chấm công
async function _bscQuaAnHan(){
  try { await supa.rpc('fn_bs_dung_grace', { p_ma_nv: SESSION.ma }); } catch(e){}
  const p = _bscPending; _bscDongCong();
  if (typeof showToast==='function') showToast('Đã dùng lần ân hạn — nhớ nộp biên bản, lần sau sẽ bị chặn.', 'warn');
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
        '<div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:3px">📋 Nộp biên bản cam kết</div>'+
        '<div style="font-size:12px;color:#6B7280;margin-bottom:12px">Giải trình việc điểm thấp / bổ sung nhiều và cam kết cải thiện. Có thể đính kèm ảnh biên bản giấy.</div>'+
        '<textarea id="bsbb-nd" rows="4" placeholder="Nội dung cam kết / giải trình…" style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #D1D5DB;border-radius:8px;font-size:13px;resize:none"></textarea>'+
        '<div style="margin-top:10px">'+
          '<label style="display:inline-flex;align-items:center;gap:7px;padding:9px 13px;background:#EEF6F5;border:1px solid #99F6E4;border-radius:9px;color:#0F766E;font-size:12.5px;font-weight:700;cursor:pointer">📎 Chọn ảnh biên bản<input type="file" accept="image/*" style="display:none" onchange="bscbbChonAnh(this)"></label>'+
          '<span id="bsbb-anh-ten" style="font-size:11.5px;color:#059669;margin-left:8px"></span>'+
        '</div>'+
        '<img id="bsbb-anh-preview" style="display:none;max-width:130px;max-height:130px;border-radius:9px;margin-top:9px;border:1px solid #E5E7EB;object-fit:cover">'+
        '<div id="bsbb-err" style="display:none;color:#DC2626;font-size:12px;margin-top:8px;padding:8px;background:#FEF2F2;border-radius:6px"></div>'+
        '<div style="display:flex;gap:8px;margin-top:14px">'+
          '<button onclick="_bscDongCong()" style="flex:1;padding:12px;background:#F3F4F6;color:#374151;border:none;border-radius:8px;font-weight:500;font-size:14px;cursor:pointer">Hủy</button>'+
          '<button id="bsbb-gui" onclick="bscbbGui()" style="flex:2;padding:12px;background:linear-gradient(135deg,#0F6E56,#1D9E75);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer">Nộp biên bản</button>'+
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
    const { data, error } = await supa.rpc('fn_bs_nop_bien_ban', { p_ma_nv: SESSION.ma, p_loai: 'BIEN_BAN', p_noi_dung: nd, p_anh_url: anhUrl });
    if (error) throw error;
    if (data && data.ok === false){ show(data.error || 'Lỗi nộp biên bản'); if(btn){btn.disabled=false;btn.textContent='Nộp biên bản';} return; }
    _bscDongCong();
    if (typeof showToast==='function') showToast('✓ Đã nộp biên bản. Bạn có thể chấm công. QLNS sẽ xem xét.', 'ok');
  } catch(e){
    show((e && e.message) || 'Lỗi kết nối'); if(btn){btn.disabled=false;btn.textContent='Nộp biên bản';}
  }
}

/* Globals */
window._bscGateVaoCa = _bscGateVaoCa;
window._bscQuaAnHan = _bscQuaAnHan;
window._bscDongCong = _bscDongCong;
window.bscbbMo = bscbbMo;
window.bscbbChonAnh = bscbbChonAnh;
window.bscbbGui = bscbbGui;
