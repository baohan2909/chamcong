// [v10.85] CHƯƠNG TRÌNH KHUYẾN MÃI — Tháng 6 Rực Rỡ
// ════════════════════════════════════════════════════════════
let ctRows = []; // mảng giá (number) - mỗi phần tử = 1 ô; rỗng nếu chưa nhập

function ctInitPage(){
  if (!ctRows.length) ctRows = [0, 0]; // 2 ô mặc định
  ctRenderRows();
  ctRecalc();
}

function ctRenderRows(){
  let html = '';
  ctRows.forEach((v, i) => {
    const display = v > 0 ? _ctFmtVN(v) : '';
    html += `<div class="ct-row">
      <div class="ct-row-num">${i+1}</div>
      <input type="text" inputmode="numeric" class="ct-row-input" placeholder="0"
             value="${display}" data-idx="${i}" oninput="ctOnInput(${i}, this)" />
      <span class="ct-row-unit">₫</span>
      ${ctRows.length > 1 ? `<button class="ct-row-del" onclick="ctDelRow(${i})">✕</button>` : ''}
    </div>`;
  });
  document.getElementById('ct-prices').innerHTML = html;
}

function ctAddRow(){
  if (ctRows.length >= 12) { showToast('Tối đa 12 sản phẩm', 'warn'); return; }
  ctRows.push(0);
  ctRenderRows();
  // Focus ô vừa thêm
  setTimeout(() => {
    const inputs = document.querySelectorAll('#ct-prices .ct-row-input');
    if (inputs.length) inputs[inputs.length-1].focus();
  }, 50);
  ctRecalc();
}

function ctDelRow(i){
  ctRows.splice(i, 1);
  if (!ctRows.length) ctRows = [0];
  ctRenderRows();
  ctRecalc();
}

function ctReset(){
  ctRows = [0, 0];
  ctRenderRows();
  ctRecalc();
}

function ctOnInput(idx, el){
  // Parse số từ input (bỏ dấu chấm, ký tự không phải số)
  const raw = el.value.replace(/[^\d]/g, '');
  const num = parseInt(raw) || 0;
  ctRows[idx] = num;
  // Format lại + giữ cursor cuối
  el.value = num > 0 ? _ctFmtVN(num) : '';
  // Đặt cursor cuối input
  const len = el.value.length;
  el.setSelectionRange(len, len);
  ctRecalc();
}

function _ctFmtVN(n){
  return Math.round(n).toLocaleString('vi-VN');
}

// ─── Thuật toán chính: chọn phương án tối ưu cho khách ─────
function _ctTinhToan(prices){
  const n = prices.length;
  const total = prices.reduce((s,p) => s+p, 0);

  // ═══ CASE n=0
  if (n === 0) return { total, n, best:{applicable:false, ten:'Chưa nhập giá', saving:0, paid:0, groups:[], singles:[]}, optA:null, optB:null };

  // ═══ CASE n=1: không có khuyến mãi
  if (n === 1) {
    const best = { applicable:false, ten:'Không áp dụng khuyến mãi (1 SP)', saving:0, paid:total, pct:0, groups:[],
      singles:[{idx:0, p:prices[0], rate:0, saving:0, paid:prices[0]}] };
    return { total, n, best, optA:{ten:'Không áp dụng (1 SP)', saving:0, applicable:false}, optB:null };
  }

  // ═══ CASE n>=2: so sánh CT A vs CT B (DP)
  // CT A — giảm 20% TỔNG bill (mọi SP -20%)
  const optA = {
    applicable:true, ten:'Giảm 20% tổng bill', saving:total*0.2, paid:total*0.8, pct:20,
    groups:[], singles:prices.map((p,i)=>({idx:i, p, rate:0.2, saving:p*0.2, paid:p*0.8}))
  };

  // CT B — DP tối ưu ghép nhóm (Mua 2 Tặng 1 nhiều lần) + SP lẻ giảm 20%
  const dp = _ctDPOptimize(prices);
  const hasGroups = dp.groups.length > 0;
  const optB = {
    applicable: hasGroups,
    ten: hasGroups
      ? (dp.groups.length > 1
          ? `${dp.groups.length} nhóm Mua 2 Tặng 1${dp.singles.length ? ' + giảm 20%' : ''}`
          : `Mua 2 Tặng 1${dp.singles.length ? ' + giảm 20% các SP còn lại' : ''}`)
      : 'Không khả dụng',
    saving: dp.saving, paid: total - dp.saving, pct: total>0 ? dp.saving/total*100 : 0,
    groups: dp.groups, singles: dp.singles
  };

  // Chọn best: optB chỉ thắng khi có nhóm VÀ saving > optA
  let best;
  if (optB.applicable && optB.saving > optA.saving + 0.5) best = { ...optB, key:'B' };
  else best = { ...optA, key:'A' };

  return { total, n, best, optA, optB };
}

// ─── DP tối ưu: chia n SP thành các nhóm 3 + SP lẻ giảm 20% ───
// Trả về { saving, groups:[{mua:[i1,i2], nhan, tb, pNhan, savingGroup, bu}], singles:[{idx,p,rate,saving,paid}] }
function _ctDPOptimize(prices){
  const n = prices.length;
  if (n < 2) return { saving:0, groups:[], singles:[] };

  const full = (1 << n) - 1;
  const dp = new Array(1 << n).fill(0);
  const trace = new Array(1 << n).fill(null);

  for (let mask = 1; mask <= full; mask++) {
    // Bits trong mask
    const bits = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) bits.push(i);

    // Option 1: tách 1 SP làm single giảm 20%
    for (const i of bits) {
      const sub = mask ^ (1 << i);
      const val = dp[sub] + prices[i] * 0.2;
      if (val > dp[mask]) { dp[mask] = val; trace[mask] = { kind:'single', idx:i, sub }; }
    }
    // Option 2: tách 3 SP làm 1 nhóm
    if (bits.length >= 3) {
      for (let a = 0; a < bits.length; a++) {
        for (let b = a+1; b < bits.length; b++) {
          for (let c = b+1; c < bits.length; c++) {
            const i = bits[a], j = bits[b], k = bits[c];
            const g = _ctGroupBest(prices, i, j, k);
            const sub = mask ^ (1<<i) ^ (1<<j) ^ (1<<k);
            const val = dp[sub] + g.savingGroup;
            if (val > dp[mask]) { dp[mask] = val; trace[mask] = { kind:'group', group:g, sub }; }
          }
        }
      }
    }
  }

  // Truy vết
  const groups = [], singles = [];
  let cur = full;
  while (cur > 0) {
    const t = trace[cur];
    if (!t) break;
    if (t.kind === 'single') {
      singles.push({ idx:t.idx, p:prices[t.idx], rate:0.2, saving:prices[t.idx]*0.2, paid:prices[t.idx]*0.8 });
    } else {
      groups.push(t.group);
    }
    cur = t.sub;
  }
  // Sắp groups theo saving giảm dần để hiển thị "nhóm to nhất" trước
  groups.sort((a,b) => b.savingGroup - a.savingGroup);
  // Sắp singles giảm dần theo giá
  singles.sort((a,b) => b.p - a.p);

  return { saving: dp[full], groups, singles };
}

// ─── Chọn cách bố trí tốt nhất cho 1 nhóm 3 SP ───
// Trả về { mua:[idx1,idx2] (giá cao trước), nhan:idx3, tb, pNhan, savingGroup, bu, paidNhan }
function _ctGroupBest(prices, i, j, k){
  // 3 cách chọn SP "nhận"
  const opts = [
    { mua:[i,j], nhan:k, pNhan:prices[k], tb:(prices[i]+prices[j])/2 },
    { mua:[i,k], nhan:j, pNhan:prices[j], tb:(prices[i]+prices[k])/2 },
    { mua:[j,k], nhan:i, pNhan:prices[i], tb:(prices[j]+prices[k])/2 }
  ];
  let best = null;
  opts.forEach(o => {
    o.savingGroup = Math.min(o.pNhan, o.tb);
    o.bu = Math.max(0, o.pNhan - o.tb);
    o.paidNhan = Math.max(0, o.pNhan - o.tb); // đúng bằng bù
    if (!best || o.savingGroup > best.savingGroup) best = o;
  });
  // Sắp mua theo giá cao → thấp
  best.mua.sort((x,y) => prices[y] - prices[x]);
  return best;
}

function ctRecalc(){
  const prices = ctRows.filter(v => v > 0);
  const r = _ctTinhToan(prices);
  _ctRenderResult(r, prices.length, ctRows.length);
}

function _ctRenderResult(r, validCount, totalRows){
  const box = document.getElementById('ct-result');
  // [v10.85] Reset card TB ở trên — chỉ hiện khi n=2 (xử lý dưới)
  const _tbCardEl = document.getElementById('ct-tb-card');
  if (_tbCardEl && r.n !== 2) _tbCardEl.style.display = 'none';
  if (validCount === 0) {
    box.innerHTML = `<div class="ct-empty-hint">💡 Nhập giá ít nhất 1 sản phẩm để xem gợi ý chương trình.</div>`;
    return;
  }
  const best = r.best;
  if (!best.applicable) {
    box.innerHTML = `<div class="ct-empty-hint">⚠ ${escHtml(best.ten)}. Khách thanh toán nguyên giá <b>${_ctFmtVN(r.total)} ₫</b>.</div>`;
    return;
  }

  // Build nhóm + lẻ
  let arrangeHtml = '';
  let rankGlobal = 1;
  (best.groups||[]).forEach((g, gi) => {
    const muaItems = g.mua.map((mIdx) => {
      const p = _ctFmtVN(g.pNhan === undefined ? 0 : 0); // placeholder
      return `<div class="ct-order-item nguyen">
        <div class="ct-order-rank">${rankGlobal++}</div>
        <span class="ct-order-tag nguyen">SP MUA ${g.mua.indexOf(mIdx)+1}</span>
        <div class="ct-order-price">${_ctFmtVN(_ctPriceAt(r, mIdx))} ₫</div>
      </div>`;
    }).join('');
    const isBu = g.bu > 0.5;
    const nhanPrice = _ctFmtVN(g.pNhan);
    const nhanHtml = isBu
      ? `<s>${nhanPrice}</s> KH bù <b>${_ctFmtVN(g.bu)} ₫</b>`
      : `<s>${nhanPrice}</s> <b>Tặng</b>`;
    const giftLine = `<div class="ct-order-item gift">
      <div class="ct-order-rank">${rankGlobal++}</div>
      <span class="ct-order-tag gift">🎁 SP NHẬN</span>
      <div class="ct-order-price">${nhanHtml}</div>
    </div>`;
    const hint = `TB(2 SP mua) = <b>${_ctFmtVN(g.tb)} ₫</b>` + (isBu
      ? ` · KH chọn SP <b>${nhanPrice} ₫</b> nên bù thêm <b>${_ctFmtVN(g.bu)} ₫</b>`
      : ` · SP nhận ${nhanPrice} ₫ ≤ TB → tặng nguyên`);
    arrangeHtml += `<div class="ct-grp-card">
      <div class="ct-grp-head">
        <span class="ct-grp-num">${gi+1}</span>
        <span class="ct-grp-title">Nhóm Mua 2 Tặng 1</span>
        <span class="ct-grp-saving">-${_ctFmtVN(g.savingGroup)} ₫</span>
      </div>
      ${muaItems}${giftLine}
      <div class="ct-grp-hint">${hint}</div>
    </div>`;
  });

  if (best.singles && best.singles.length) {
    const sumSav = best.singles.reduce((s,x)=>s+x.saving, 0);
    const isFullPrice = best.singles.every(s => s.rate === 0); // case n=1 không có KM
    const titleLine = best.key === 'A' ? 'Giảm 20% tất cả' : (isFullPrice ? 'Sản phẩm chưa áp khuyến mãi' : 'Sản phẩm còn lại — Giảm 20%');
    const headSavingHtml = sumSav > 0 ? `<span class="ct-grp-saving">-${_ctFmtVN(sumSav)} ₫</span>` : '';
    const lines = best.singles.map(s => {
      if (s.rate === 0) {
        return `<div class="ct-order-item nguyen">
          <div class="ct-order-rank">${rankGlobal++}</div>
          <span class="ct-order-tag nguyen">NGUYÊN GIÁ</span>
          <div class="ct-order-price">${_ctFmtVN(s.p)} ₫</div>
        </div>`;
      }
      const pct = (s.rate*100).toFixed(0);
      return `<div class="ct-order-item giam">
        <div class="ct-order-rank">${rankGlobal++}</div>
        <span class="ct-order-tag giam">-${pct}%</span>
        <div class="ct-order-price"><s>${_ctFmtVN(s.p)}</s> ${_ctFmtVN(s.paid)} ₫</div>
      </div>`;
    }).join('');
    arrangeHtml += `<div class="ct-grp-card singles">
      <div class="ct-grp-head">
        <span class="ct-grp-icon">📦</span>
        <span class="ct-grp-title">${titleLine}</span>
        ${headSavingHtml}
      </div>
      ${lines}
    </div>`;
  }

  // Compare
  const aSav = r.optA && r.optA.applicable ? _ctFmtVN(r.optA.saving) : null;
  const bSav = r.optB && r.optB.applicable ? _ctFmtVN(r.optB.saving) : null;
  const aIsBest = best.key === 'A';
  const bIsBest = best.key === 'B';
  const compareHtml = (r.n >= 2) ? `
    <div class="ct-compare">
      <div class="ct-compare-title">📊 SO SÁNH CÁC PHƯƠNG ÁN</div>
      <div class="ct-compare-row ${aIsBest?'best':''}">
        <div class="ct-compare-dot"></div>
        <div class="ct-compare-name">Giảm 20% tổng bill</div>
        ${r.optA.applicable ? `<div class="ct-compare-saving">-${aSav} ₫</div>` : `<div class="ct-compare-na">Không áp dụng</div>`}
      </div>
      <div class="ct-compare-row ${bIsBest?'best':''}">
        <div class="ct-compare-dot"></div>
        <div class="ct-compare-name">Ghép nhóm Mua 2 Tặng 1 tối ưu</div>
        ${r.optB && r.optB.applicable ? `<div class="ct-compare-saving">-${bSav} ₫</div>` : `<div class="ct-compare-na">${r.n<3?'Cần ≥ 3 SP':'Không lợi hơn'}</div>`}
      </div>
    </div>` : '';

  // [v10.85] Cập nhật card giá trung bình ở trên (chỉ hiện khi n=2)
  const tbCard = document.getElementById('ct-tb-card');
  if (tbCard) {
    if (r.n === 2) {
      const pp = ctRows.filter(v => v > 0);
      const tb = (pp[0] + pp[1]) / 2;
      document.getElementById('ct-tb-val').innerHTML = `${_ctFmtVN(tb)} <span>₫</span>`;
      tbCard.style.display = '';
    } else {
      tbCard.style.display = 'none';
    }
  }

  box.innerHTML = `
    <div class="ct-best">
      <div class="ct-best-head">
        <div class="ct-best-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <div class="ct-best-title-wrap">
          <div class="ct-best-eyebrow">PHƯƠNG ÁN TỐI ƯU</div>
          <div class="ct-best-name">${escHtml(best.ten)}</div>
        </div>
      </div>
      <div class="ct-best-stats">
        <div class="ct-best-stat saving">
          <div class="ct-best-stat-lbl">KH TIẾT KIỆM</div>
          <div class="ct-best-stat-val">-${_ctFmtVN(best.saving)} <small>₫</small></div>
          <div class="ct-best-stat-lbl" style="margin-top:2px">≈ ${best.pct.toFixed(1)}%</div>
        </div>
        <div class="ct-best-stat paid">
          <div class="ct-best-stat-lbl">KH THANH TOÁN</div>
          <div class="ct-best-stat-val">${_ctFmtVN(best.paid)} <small>₫</small></div>
          <div class="ct-best-stat-lbl" style="margin-top:2px">từ ${_ctFmtVN(r.total)} ₫</div>
        </div>
      </div>
      <div class="ct-order-title">📋 Cách sắp xếp trên máy bán hàng</div>
      ${arrangeHtml}
    </div>
    ${compareHtml}
  `;
}

// Helper: tra giá của 1 SP theo index (dùng trong render)
function _ctPriceAt(r, idx){
  return ctRows.filter(v => v > 0)[idx];
}

// ════════════════════════════════════════════════════════════
// [v10.85] CHECKLIST CỬA HÀNG
// ════════════════════════════════════════════════════════════
let chkDanhMuc = [];        // [{id, nhom_key, nhom_ten, nhom_thu_tu, muc_ten, muc_thu_tu, la_muc_mo}]
let chkGroups = [];         // [{key, ten, items:[...]}]
let chkState = {};          // {mucId: {status:'BT'|'VD', muc_do, mo_ta, anh_urls:[], mo_ta_extra}}
let chkCurrentCH = null;    // {ma, ten}
let chkSub = 'new';

async function chkInitPage(){
  // Xác định CH hiện tại
  document.getElementById('chk-ch-name').textContent = 'Đang xác định cửa hàng...';
  document.getElementById('chk-ch-sub').textContent = '';
  await chkXacDinhCH();
  if (!chkCurrentCH) {
    document.getElementById('chk-ch-name').textContent = 'Chưa xác định được cửa hàng';
    document.getElementById('chk-ch-sub').textContent = 'Bạn cần chấm công vào ca trước khi kiểm tra.';
    document.getElementById('chk-groups').innerHTML = '<div class="ns-empty">Vui lòng chấm công vào ca tại cửa hàng trước.</div>';
    return;
  }
  document.getElementById('chk-ch-name').textContent = chkCurrentCH.ten;
  document.getElementById('chk-ch-sub').textContent = chkCurrentCH.ma + (chkCurrentCH.khuVuc ? ' · ' + chkCurrentCH.khuVuc : '');

  // Load danh mục nếu chưa có
  if (!chkDanhMuc.length) {
    try {
      const { data, error } = await supa.rpc('fn_checklist_danh_muc');
      if (error || !data) { document.getElementById('chk-groups').innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi tải danh mục.</div>'; return; }
      chkDanhMuc = data;
    } catch(e) { document.getElementById('chk-groups').innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+e.message+'</div>'; return; }
  }
  // Gom nhóm
  const gmap = {};
  chkDanhMuc.forEach(m => {
    if (!gmap[m.nhom_key]) gmap[m.nhom_key] = { key:m.nhom_key, ten:m.nhom_ten, thu_tu:m.nhom_thu_tu, items:[] };
    gmap[m.nhom_key].items.push(m);
  });
  chkGroups = Object.values(gmap).sort((a,b)=>a.thu_tu-b.thu_tu);
  chkState = {};
  chkRenderForm();
  chkRenderHandover();
  chkSwitchSub('new');
}

// Xác định CH: CUA_HANG → SESSION.cuaHangMa; NV → VAO_CA gần nhất hôm nay
async function chkXacDinhCH(){
  chkCurrentCH = null;
  if (SESSION.vaiTro === 'CUA_HANG' && SESSION.cuaHangMa) {
    chkCurrentCH = { ma:SESSION.cuaHangMa, ten:SESSION.cuaHangTen||SESSION.cuaHangMa, khuVuc:SESSION.khuVuc||'' };
    return;
  }
  // NV: tìm bản ghi VAO_CA gần nhất hôm nay
  try {
    const now = new Date();
    const today = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
    const { data } = await supa.from('cham_cong')
      .select('ma_ch, ten_ch_snapshot, thoi_gian')
      .eq('ma_nv', SESSION.ma).eq('ngay', today).eq('loai','VAO_CA')
      .order('thoi_gian', { ascending:false }).limit(1);
    if (data && data.length) {
      const r = data[0];
      let kv = '';
      if (window.CH_LIST) { const f = CH_LIST.find(c=>c.ma===r.ma_ch); if (f) kv = f.khuVuc||''; }
      chkCurrentCH = { ma:r.ma_ch, ten:r.ten_ch_snapshot||r.ma_ch, khuVuc:kv };
      return;
    }
  } catch(e){}
  // Fallback: CH mặc định của NV
  if (SESSION.cuaHangMa) {
    chkCurrentCH = { ma:SESSION.cuaHangMa, ten:SESSION.cuaHangTen||SESSION.cuaHangMa, khuVuc:SESSION.khuVuc||'' };
  }
}

function chkSwitchSub(sub){
  chkSub = sub;
  document.getElementById('chk-subtab-new').classList.toggle('active', sub==='new');
  document.getElementById('chk-subtab-today').classList.toggle('active', sub==='today');
  document.getElementById('chk-sub-new').style.display = sub==='new' ? '' : 'none';
  document.getElementById('chk-sub-today').style.display = sub==='today' ? '' : 'none';
  if (sub==='today') chkRenderToday();
}

const CHK_GROUP_ICONS = {
  mat_tien:'🏪', chieu_sang:'💡', tien_nghi:'❄️', trung_bay:'🧢',
  thiet_bi:'🖥️', kho:'📦', sinh_hoat:'🚻', an_ninh:'🔒'
};

function chkRenderForm(){
  let html = '';
  chkGroups.forEach((g, gi) => {
    const itemsHtml = g.items.map(m => chkItemHtml(m)).join('');
    html += `<div class="chk-group" id="chk-g-${g.key}" data-key="${g.key}">
      <div class="chk-group-head" onclick="chkToggleGroup('${g.key}')">
        <div class="chk-group-num" id="chk-gnum-${g.key}">${gi+1}</div>
        <div class="chk-group-title">${escHtml(g.ten)}</div>
        <div class="chk-group-status" id="chk-gstatus-${g.key}">${g.items.length} mục</div>
        <svg class="chk-group-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="chk-group-body">
        <div class="chk-group-quick">
          <button class="chk-quick-ok" id="chk-quick-${g.key}" onclick="chkQuickOK('${g.key}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Tất cả bình thường
          </button>
        </div>
        ${itemsHtml}
      </div>
    </div>`;
  });
  document.getElementById('chk-groups').innerHTML = html;
  document.getElementById('chk-progress-wrap').style.display = '';
  document.getElementById('chk-submit-zone').style.display = '';
  chkUpdateProgress();
}

function chkItemHtml(m){
  const st = chkState[m.id] || {};
  return `<div class="chk-item" id="chk-item-${m.id}">
    <div class="chk-item-row">
      <div class="chk-item-name">${escHtml(m.muc_ten)}</div>
      <div class="chk-item-toggle">
        <button class="chk-tg bt ${st.status==='BT'?'active':''}" id="chk-bt-${m.id}" onclick="chkSetItem(${m.id},'BT')">Bình thường</button>
        <button class="chk-tg vd ${st.status==='VD'?'active':''}" id="chk-vd-${m.id}" onclick="chkSetItem(${m.id},'VD')">Có vấn đề</button>
      </div>
    </div>
    <div id="chk-detail-${m.id}">${st.status==='VD'?chkDetailHtml(m):''}</div>
  </div>`;
}

function chkDetailHtml(m){
  const st = chkState[m.id] || {};
  const photos = (st.anh_urls||[]).map((url,i)=>`<div class="chk-photo-wrap"><img class="chk-photo-thumb" src="${url}"><div class="chk-photo-del" onclick="chkDelPhoto(${m.id},${i})">×</div></div>`).join('');
  return `<div class="chk-vd-detail">
    <div class="chk-mucdo-row">
      <button class="chk-mucdo nhe ${st.muc_do==='NHE'?'active':''}" onclick="chkSetMucDo(${m.id},'NHE')">Nhẹ</button>
      <button class="chk-mucdo vua ${st.muc_do==='VUA'?'active':''}" onclick="chkSetMucDo(${m.id},'VUA')">Vừa</button>
      <button class="chk-mucdo khan ${st.muc_do==='KHAN_CAP'?'active':''}" onclick="chkSetMucDo(${m.id},'KHAN_CAP')">Khẩn cấp</button>
    </div>
    <textarea class="chk-vd-textarea" id="chk-mota-${m.id}" placeholder="Mô tả vấn đề (bắt buộc)..." oninput="chkOnMota(${m.id})">${escHtml(st.mo_ta||'')}</textarea>
    <div class="chk-photo-row">
      ${photos}
      <label class="chk-photo-add">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Ảnh
        <input type="file" accept="image/*" capture="environment" style="display:none" onchange="chkAddPhoto(${m.id}, this)">
      </label>
    </div>
  </div>`;
}

function chkToggleGroup(key){
  document.getElementById('chk-g-'+key).classList.toggle('open');
}

function chkQuickOK(key){
  const g = chkGroups.find(x=>x.key===key);
  if (!g) return;
  g.items.forEach(m => { chkState[m.id] = { status:'BT' }; });
  // Re-render items trong nhóm
  g.items.forEach(m => {
    const el = document.getElementById('chk-item-'+m.id);
    if (el) el.outerHTML = chkItemHtml(m);
  });
  chkUpdateGroupStatus(key);
  chkUpdateProgress();
  // Tự gập + mở nhóm chưa xong kế tiếp
  setTimeout(()=>{
    document.getElementById('chk-g-'+key).classList.remove('open');
    chkOpenNextUndone(key);
  }, 250);
}

function chkOpenNextUndone(afterKey){
  const idx = chkGroups.findIndex(g=>g.key===afterKey);
  for (let i=idx+1; i<chkGroups.length; i++){
    if (!chkGroupDone(chkGroups[i].key)) {
      const el = document.getElementById('chk-g-'+chkGroups[i].key);
      if (el) { el.classList.add('open'); el.scrollIntoView({behavior:'smooth', block:'center'}); }
      return;
    }
  }
}

function chkSetItem(mucId, status){
  if (!chkState[mucId]) chkState[mucId] = {};
  chkState[mucId].status = status;
  if (status==='VD' && !chkState[mucId].muc_do) chkState[mucId].muc_do = 'NHE';
  // Re-render item
  const m = chkDanhMuc.find(x=>x.id===mucId);
  const el = document.getElementById('chk-item-'+mucId);
  if (el && m) {
    el.outerHTML = chkItemHtml(m);
    if (status==='VD') setTimeout(()=>{ const ta=document.getElementById('chk-mota-'+mucId); if(ta) ta.focus(); }, 100);
  }
  chkUpdateGroupStatusForMuc(mucId);
  chkUpdateProgress();
}

function chkSetMucDo(mucId, level){
  if (!chkState[mucId]) chkState[mucId] = { status:'VD' };
  chkState[mucId].muc_do = level;
  ['NHE','VUA','KHAN_CAP'].forEach(l=>{
    const cls = l==='NHE'?'nhe':l==='VUA'?'vua':'khan';
    const btns = document.querySelectorAll(`#chk-detail-${mucId} .chk-mucdo.${cls}`);
    btns.forEach(b=>b.classList.toggle('active', l===level));
  });
}

function chkOnMota(mucId){
  if (!chkState[mucId]) chkState[mucId] = { status:'VD' };
  chkState[mucId].mo_ta = document.getElementById('chk-mota-'+mucId).value;
  chkUpdateProgress();
}

async function chkAddPhoto(mucId, input){
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    const dataUrl = await _chkCompressImage(file);
    if (!chkState[mucId]) chkState[mucId] = { status:'VD' };
    if (!chkState[mucId].anh_urls) chkState[mucId].anh_urls = [];
    if (chkState[mucId].anh_urls.length >= 4) { showToast('Tối đa 4 ảnh / mục', 'warn'); return; }
    chkState[mucId].anh_urls.push(dataUrl);
    const m = chkDanhMuc.find(x=>x.id===mucId);
    document.getElementById('chk-detail-'+mucId).innerHTML = chkDetailHtml(m);
  } catch(e){ showToast('Lỗi xử lý ảnh', 'warn'); }
  input.value = '';
}

function chkDelPhoto(mucId, idx){
  if (chkState[mucId] && chkState[mucId].anh_urls) {
    chkState[mucId].anh_urls.splice(idx,1);
    const m = chkDanhMuc.find(x=>x.id===mucId);
    document.getElementById('chk-detail-'+mucId).innerHTML = chkDetailHtml(m);
  }
}

// Nén ảnh → base64 (max 1000px, quality 0.55)
function _chkCompressImage(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const max = 1000;
        let w = img.width, h = img.height;
        if (w > max || h > max) { if (w>h){ h=h*max/w; w=max; } else { w=w*max/h; h=max; } }
        const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.55));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function chkGroupDone(key){
  const g = chkGroups.find(x=>x.key===key);
  if (!g) return false;
  return g.items.every(m => chkState[m.id] && chkState[m.id].status);
}

function chkUpdateGroupStatus(key){
  const g = chkGroups.find(x=>x.key===key);
  if (!g) return;
  const el = document.getElementById('chk-g-'+key);
  const statusEl = document.getElementById('chk-gstatus-'+key);
  const done = chkGroupDone(key);
  const hasIssue = g.items.some(m => chkState[m.id] && chkState[m.id].status==='VD');
  el.classList.toggle('done-ok', done && !hasIssue);
  el.classList.toggle('done-issue', done && hasIssue);
  if (!done) { statusEl.textContent = g.items.filter(m=>chkState[m.id]&&chkState[m.id].status).length + '/' + g.items.length; }
  else if (hasIssue) { const n = g.items.filter(m=>chkState[m.id]&&chkState[m.id].status==='VD').length; statusEl.textContent = n + ' vấn đề'; }
  else { statusEl.textContent = '✓ Bình thường'; }
  // nút quick active nếu cả nhóm BT
  const allBT = done && !hasIssue;
  const qb = document.getElementById('chk-quick-'+key);
  if (qb) qb.classList.toggle('active', allBT);
}

function chkUpdateGroupStatusForMuc(mucId){
  const m = chkDanhMuc.find(x=>x.id===mucId);
  if (m) chkUpdateGroupStatus(m.nhom_key);
}

function chkUpdateProgress(){
  const doneGroups = chkGroups.filter(g=>chkGroupDone(g.key)).length;
  const total = chkGroups.length;
  document.getElementById('chk-progress-text').textContent = `Đã kiểm ${doneGroups}/${total} nhóm`;
  document.getElementById('chk-progress-fill').style.width = (total? doneGroups/total*100:0) + '%';
  // số vấn đề
  let issues = 0, khan = 0;
  Object.values(chkState).forEach(s=>{ if(s.status==='VD'){ issues++; if(s.muc_do==='KHAN_CAP') khan++; } });
  const isEl = document.getElementById('chk-progress-issues');
  isEl.textContent = issues ? `${issues} vấn đề${khan?' · '+khan+' khẩn cấp':''}` : '';
  // cập nhật status từng nhóm
  chkGroups.forEach(g=>chkUpdateGroupStatus(g.key));
  // nút submit: đủ tất cả nhóm + mọi VD có mô tả
  const allDone = doneGroups === total && total > 0;
  const allVDHaveMota = Object.values(chkState).every(s => s.status!=='VD' || (s.mo_ta && s.mo_ta.trim().length>0));
  document.getElementById('chk-submit-btn').disabled = !(allDone && allVDHaveMota);
}

async function chkSubmit(){
  // Validate
  const allDone = chkGroups.every(g=>chkGroupDone(g.key));
  if (!allDone) { showToast('Vui lòng kiểm tra hết các nhóm', 'warn'); return; }
  // build items
  const items = [];
  let missingMota = false;
  chkDanhMuc.forEach(m => {
    const s = chkState[m.id];
    if (!s || !s.status) return;
    if (s.status==='VD' && (!s.mo_ta || !s.mo_ta.trim())) { missingMota = true; }
    items.push({
      muc_id: String(m.id), nhom_ten: m.nhom_ten, muc_ten: m.muc_ten,
      trang_thai: s.status,
      muc_do: s.status==='VD' ? (s.muc_do||'NHE') : null,
      mo_ta: s.status==='VD' ? (s.mo_ta||'').trim() : null,
      anh_urls: s.status==='VD' ? (s.anh_urls||[]) : []
    });
  });
  if (missingMota) { showToast('Mục "Có vấn đề" cần nhập mô tả', 'warn'); return; }

  const btn = document.getElementById('chk-submit-btn');
  btn.disabled = true; btn.innerHTML = 'Đang gửi...';
  try {
    const { data, error } = await supa.rpc('fn_checklist_submit', {
      p_ma_nv: SESSION.ma, p_ma_ch: chkCurrentCH.ma,
      p_ghi_chu: document.getElementById('chk-ghichu').value || null,
      p_items: items
    });
    if (error || !data || !data.success) {
      showToast('⚠ ' + ((data&&data.error)||(error&&error.message)||'Lỗi gửi'), 'warn');
      btn.disabled = false; btn.innerHTML = 'Hoàn tất &amp; gửi'; chkUpdateProgress();
      return;
    }
    showToast(`✓ Đã gửi checklist${data.van_de?' · '+data.van_de+' vấn đề':''}`, 'ok');
    // Reset form
    chkState = {};
    document.getElementById('chk-ghichu').value = '';
    chkRenderForm();
    chkRenderHandover();
    chkSwitchSub('today');
  } catch(e) {
    showToast('⚠ ' + e.message, 'warn');
    btn.disabled = false; btn.innerHTML = 'Hoàn tất &amp; gửi';
  }
}

// Banner bàn giao ca trước
async function chkRenderHandover(){
  const box = document.getElementById('chk-banderove');
  if (!chkCurrentCH) { box.innerHTML=''; return; }
  try {
    const { data } = await supa.rpc('fn_checklist_moi_nhat', { p_ma_ch: chkCurrentCH.ma });
    if (!data) { box.innerHTML=''; return; }
    const d = data;
    const dt = new Date(d.thoi_gian);
    const tStr = pad(dt.getHours())+':'+pad(dt.getMinutes())+' '+pad(dt.getDate())+'/'+pad(dt.getMonth()+1);
    if (!d.co_van_de) {
      box.innerHTML = `<div class="chk-handover clean">
        <div class="chk-handover-title">✓ Bàn giao gần nhất — tất cả bình thường</div>
        <div class="chk-handover-meta">${escHtml(d.ten_nv_snapshot||'')} · ${tStr}</div>
        ${d.ghi_chu?`<div class="chk-handover-issue">${escHtml(d.ghi_chu)}</div>`:''}
      </div>`;
    } else {
      const vds = (d.van_de||[]).map(v=>`<div class="chk-handover-issue"><b>${escHtml(v.muc_ten)}</b>${v.da_xu_ly?' ✓ đã xử lý':''}: ${escHtml(v.mo_ta)}</div>`).join('');
      box.innerHTML = `<div class="chk-handover">
        <div class="chk-handover-title">⚠ Bàn giao gần nhất — ${d.so_van_de} vấn đề${d.so_khan_cap?' ('+d.so_khan_cap+' khẩn cấp)':''}</div>
        <div class="chk-handover-meta">${escHtml(d.ten_nv_snapshot||'')} · ${tStr}</div>
        ${vds}
        ${d.ghi_chu?`<div class="chk-handover-issue" style="margin-top:5px;font-style:italic">📝 ${escHtml(d.ghi_chu)}</div>`:''}
      </div>`;
    }
  } catch(e){ box.innerHTML=''; }
}

// Xem lại các lần kiểm hôm nay
async function chkRenderToday(){
  const list = document.getElementById('chk-today-list');
  list.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
  try {
    const now = new Date();
    const today = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
    const { data } = await supa.rpc('fn_checklist_theo_ch', { p_ma_ch: chkCurrentCH.ma, p_ngay: today });
    const cntEl = document.getElementById('chk-today-count');
    if (!data || !data.length) {
      list.innerHTML = '<div class="ns-empty">Chưa có lần kiểm tra nào hôm nay.</div>';
      cntEl.style.display='none';
      return;
    }
    cntEl.style.display=''; cntEl.textContent = data.length;
    list.innerHTML = data.map(c => chkRecHtml(c)).join('');
  } catch(e){ list.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+e.message+'</div>'; }
}

function chkRecHtml(c){
  const dt = new Date(c.thoi_gian);
  const tStr = pad(dt.getHours())+':'+pad(dt.getMinutes());
  const issues = (c.van_de||[]).map(v=>{
    const cls = v.muc_do==='KHAN_CAP'?'khan':v.muc_do==='VUA'?'vua':'nhe';
    const tag = v.muc_do==='KHAN_CAP'?'Khẩn cấp':v.muc_do==='VUA'?'Vừa':'Nhẹ';
    const photos = (v.anh_urls||[]).map(u=>`<img src="${u}" onclick="chkViewPhoto('${u}')">`).join('');
    return `<div class="chk-rec-issue">
      <div class="chk-rec-issue-icon ${cls}"></div>
      <div class="chk-rec-issue-body">
        <div class="chk-rec-issue-muc">${escHtml(v.muc_ten)} <small>· ${escHtml(v.nhom_ten)}</small><span class="chk-mucdo-tag ${cls}">${tag}</span>${v.da_xu_ly?'<span class="chk-mucdo-tag" style="background:#ECFDF5;color:#059669">✓ Đã xử lý</span>':''}</div>
        <div class="chk-rec-issue-mota">${escHtml(v.mo_ta)}</div>
        ${photos?`<div class="chk-rec-issue-photos">${photos}</div>`:''}
      </div>
    </div>`;
  }).join('');
  return `<div class="chk-rec ${c.co_van_de?'has-issue':''}">
    <div class="chk-rec-head">
      <div class="chk-rec-top">
        <span class="chk-rec-time">${tStr}</span>
        <span class="chk-rec-badge ${c.co_van_de?'issue':'ok'}">${c.co_van_de?(c.so_van_de+' vấn đề'):'Tất cả bình thường'}</span>
      </div>
      <div class="chk-rec-by">${escHtml(c.ten_nv_snapshot||'')} · ${c.tong_muc} mục kiểm</div>
      ${c.ghi_chu?`<div class="chk-rec-note">📝 ${escHtml(c.ghi_chu)}</div>`:''}
    </div>
    ${issues?`<div class="chk-rec-issues">${issues}</div>`:''}
  </div>`;
}

function chkViewPhoto(url){
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.onclick = ()=>ov.remove();
  ov.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;border-radius:12px">`;
  document.body.appendChild(ov);
}

// ════════════════════════════════════════════════════════════
// [v10.85] QUẢN LÝ SỰ CỐ CỬA HÀNG (QLNS/Admin)
// ════════════════════════════════════════════════════════════
let chkqlMucDo = '';
let chkqlSub = 'vande';

function chkqlInitPage(){
  // Mặc định: hôm nay
  const now = new Date();
  const today = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
  const tu = document.getElementById('chkql-tu');
  const den = document.getElementById('chkql-den');
  if (!tu.value) tu.value = today;
  if (!den.value) den.value = today;
  chkqlSwitch('vande');
}

function chkqlSwitch(sub){
  chkqlSub = sub;
  document.getElementById('chkql-tab-vande').classList.toggle('active', sub==='vande');
  document.getElementById('chkql-tab-thongke').classList.toggle('active', sub==='thongke');
  document.getElementById('chkql-pane-vande').style.display = sub==='vande'?'':'none';
  document.getElementById('chkql-pane-thongke').style.display = sub==='thongke'?'':'none';
  if (sub==='vande') chkqlLoadVanDe();
  else chkqlLoadThongKe();
}

function chkqlSetMucDo(md, btn){
  chkqlMucDo = md;
  document.querySelectorAll('#chkql-mucdo-chips .chkql-chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  chkqlLoadVanDe();
}

async function chkqlLoadVanDe(){
  const list = document.getElementById('chkql-list');
  list.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
  const tu = document.getElementById('chkql-tu').value || null;
  const den = document.getElementById('chkql-den').value || null;
  const params = { p_tu_ngay: tu, p_den_ngay: den };
  if (chkqlMucDo === 'CHUA') params.p_chua_xu_ly = true;
  else if (chkqlMucDo) params.p_muc_do = chkqlMucDo;
  // CUA_HANG chỉ xem CH mình (phòng khi mở rộng quyền)
  try {
    const { data, error } = await supa.rpc('fn_checklist_van_de_list', params);
    if (error) { list.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+error.message+'</div>'; return; }
    // Quick stats
    const arr = data || [];
    const khan = arr.filter(v=>v.muc_do==='KHAN_CAP').length;
    const chua = arr.filter(v=>!v.da_xu_ly).length;
    const chSet = new Set(arr.map(v=>v.ma_ch));
    document.getElementById('chkql-quickstats').innerHTML = `
      <div class="chkql-stat total"><div class="chkql-stat-val">${arr.length}</div><div class="chkql-stat-lbl">Sự cố</div></div>
      <div class="chkql-stat khan"><div class="chkql-stat-val">${khan}</div><div class="chkql-stat-lbl">Khẩn cấp</div></div>
      <div class="chkql-stat pending"><div class="chkql-stat-val">${chua}</div><div class="chkql-stat-lbl">Chưa xử lý</div></div>
      <div class="chkql-stat issue"><div class="chkql-stat-val">${chSet.size}</div><div class="chkql-stat-lbl">Cửa hàng</div></div>`;
    if (!arr.length) { list.innerHTML = '<div class="ns-empty">Không có sự cố nào trong khoảng này. 🎉</div>'; return; }
    list.innerHTML = arr.map(v=>chkqlVdHtml(v)).join('');
  } catch(e){ list.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+e.message+'</div>'; }
}

function chkqlVdHtml(v){
  const cls = v.muc_do==='KHAN_CAP'?'khan':v.muc_do==='VUA'?'vua':'nhe';
  const tag = v.muc_do==='KHAN_CAP'?'Khẩn cấp':v.muc_do==='VUA'?'Vừa':'Nhẹ';
  const dt = new Date(v.thoi_gian);
  const tStr = pad(dt.getHours())+':'+pad(dt.getMinutes())+' '+pad(dt.getDate())+'/'+pad(dt.getMonth()+1);
  const photos = (v.anh_urls||[]).map(u=>`<img src="${u}" onclick="chkViewPhoto('${u}')">`).join('');
  return `<div class="chkql-vd ${cls} ${v.da_xu_ly?'done':''}">
    <div class="chkql-vd-head">
      <div class="chkql-vd-top">
        <span class="chkql-vd-ch">${escHtml(v.ten_ch_snapshot||v.ma_ch)}</span>
        <span class="chk-mucdo-tag ${cls}">${tag}</span>
        ${v.khu_vuc?`<span style="font-size:11px;color:#94A3B8">${escHtml(v.khu_vuc)}</span>`:''}
      </div>
      <div class="chkql-vd-muc"><b>${escHtml(v.muc_ten)}</b> · ${escHtml(v.nhom_ten)}</div>
      <div class="chkql-vd-mota">${escHtml(v.mo_ta)}</div>
      ${photos?`<div class="chkql-vd-photos">${photos}</div>`:''}
      <div class="chkql-vd-meta">
        <span>👤 ${escHtml(v.ten_nv_snapshot||'')}</span>
        <span>🕐 ${tStr}</span>
        ${v.da_xu_ly?`<span style="color:#059669">✓ ${escHtml(v.nguoi_xu_ly||'')} đã xử lý</span>`:''}
      </div>
    </div>
    <div class="chkql-vd-actions">
      ${v.da_xu_ly
        ? `<span class="chkql-vd-done-tag">✓ Đã xử lý${v.ghi_chu_xu_ly?': '+escHtml(v.ghi_chu_xu_ly):''}</span>`
        : `<button class="chkql-vd-xuly" onclick="chkqlXuLy('${v.id}')">Đánh dấu đã xử lý</button>`}
    </div>
  </div>`;
}

async function chkqlXuLy(id){
  const ghiChu = prompt('Ghi chú xử lý (tùy chọn):', '');
  if (ghiChu === null) return;
  try {
    const { data, error } = await supa.rpc('fn_checklist_xu_ly_van_de', {
      p_id: id, p_nguoi: SESSION.ma, p_ghi_chu: ghiChu || null
    });
    if (error || !data || !data.success) { showToast('⚠ ' + ((data&&data.error)||(error&&error.message)), 'warn'); return; }
    showToast('✓ Đã đánh dấu xử lý', 'ok');
    chkqlLoadVanDe();
  } catch(e){ showToast('⚠ ' + e.message, 'warn'); }
}

async function chkqlLoadThongKe(){
  const box = document.getElementById('chkql-thongke');
  box.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';
  const tu = document.getElementById('chkql-tu').value || null;
  const den = document.getElementById('chkql-den').value || null;
  try {
    const { data, error } = await supa.rpc('fn_checklist_thong_ke', { p_tu_ngay: tu, p_den_ngay: den });
    if (error || !data) { box.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi tải thống kê.</div>'; return; }
    const d = data;
    const maxCH = Math.max(1, ...(d.ch_nhieu_su_co||[]).map(x=>x.so_van_de));
    const maxLoai = Math.max(1, ...(d.loai_su_co||[]).map(x=>x.so_lan));
    const maxMuc = Math.max(1, ...(d.muc_hay_loi||[]).map(x=>x.so_lan));
    box.innerHTML = `
      <div class="chkql-stats" style="margin-bottom:12px">
        <div class="chkql-stat total"><div class="chkql-stat-val">${d.tong_checklist||0}</div><div class="chkql-stat-lbl">Lần kiểm</div></div>
        <div class="chkql-stat issue"><div class="chkql-stat-val">${d.tong_van_de||0}</div><div class="chkql-stat-lbl">Sự cố</div></div>
        <div class="chkql-stat khan"><div class="chkql-stat-val">${d.tong_khan_cap||0}</div><div class="chkql-stat-lbl">Khẩn cấp</div></div>
        <div class="chkql-stat pending"><div class="chkql-stat-val">${d.chua_xu_ly||0}</div><div class="chkql-stat-lbl">Chưa xử lý</div></div>
      </div>
      <div class="chkql-tk-card">
        <div class="chkql-tk-title">🏪 Cửa hàng nhiều sự cố nhất</div>
        ${(d.ch_nhieu_su_co||[]).length ? (d.ch_nhieu_su_co||[]).map((x,i)=>`
          <div class="chkql-tk-row">
            <div class="chkql-tk-rank">${i+1}</div>
            <div class="chkql-tk-name">${escHtml(x.ten_ch||x.ma_ch)}</div>
            <div class="chkql-tk-bar-wrap"><div class="chkql-tk-bar" style="width:${x.so_van_de/maxCH*100}%"></div></div>
            <div class="chkql-tk-num">${x.so_van_de}</div>
          </div>`).join('') : '<div style="color:#94A3B8;font-size:13px">Không có dữ liệu</div>'}
      </div>
      <div class="chkql-tk-card">
        <div class="chkql-tk-title">📂 Loại sự cố thường gặp (theo nhóm)</div>
        ${(d.loai_su_co||[]).length ? (d.loai_su_co||[]).map((x,i)=>`
          <div class="chkql-tk-row">
            <div class="chkql-tk-rank">${i+1}</div>
            <div class="chkql-tk-name">${escHtml(x.nhom_ten)}</div>
            <div class="chkql-tk-bar-wrap"><div class="chkql-tk-bar" style="width:${x.so_lan/maxLoai*100}%"></div></div>
            <div class="chkql-tk-num">${x.so_lan}</div>
          </div>`).join('') : '<div style="color:#94A3B8;font-size:13px">Không có dữ liệu</div>'}
      </div>
      <div class="chkql-tk-card">
        <div class="chkql-tk-title">🔧 Hạng mục hay lỗi nhất</div>
        ${(d.muc_hay_loi||[]).length ? (d.muc_hay_loi||[]).map((x,i)=>`
          <div class="chkql-tk-row">
            <div class="chkql-tk-rank">${i+1}</div>
            <div class="chkql-tk-name">${escHtml(x.muc_ten)}</div>
            <div class="chkql-tk-bar-wrap"><div class="chkql-tk-bar" style="width:${x.so_lan/maxMuc*100}%"></div></div>
            <div class="chkql-tk-num">${x.so_lan}</div>
          </div>`).join('') : '<div style="color:#94A3B8;font-size:13px">Không có dữ liệu</div>'}
      </div>`;
  } catch(e){ box.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+e.message+'</div>'; }
}
