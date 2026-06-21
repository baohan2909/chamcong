

// ═══════════════════════════════════════════════════════════════════
// [v11.2] MODULE BÁN HÀNG — JavaScript v11.2
// Thay đổi so v11.1:
//  + BH-01: Click thẻ stat → filter (Đang bán/Đã mua/Chưa mua/Tất cả)
//  + BH-02: Timer hiển thị centiseconds (MM:SS.cc)
//  + BH-03a: SP dùng MA_CU làm primary identifier
//  + BH-03b: SP nhiều dòng (\n) trong cùng 1 ô sheet
//  + BH-03c: Bỏ trường Số khách
//  + BH-03d: Tổng giá trị tự tính
//  + BH-04: Cache SP trong localStorage 24h, indexed search nhanh
//  + BH-05b: STT theo CH/ngày
//  + BH-07: 5 thẻ stat (thêm "Tất cả")
//  + BH-08: Đổi "+ SP" → "+ Sản phẩm", bỏ chip "Số khách"
//  + BH-09a: Bỏ lý do "Chỉ xem tham khảo"
//  + BH-09b: Đổi "Chất lượng/Chức năng" → "Công dụng chưa đáp ứng"
//  + BH-09c: Ghi chú bắt buộc khi Chưa mua
//  + BH-10 (a-f): Form Đã mua mới với mã NV + qty +/-
// ═══════════════════════════════════════════════════════════════════

// ─── STATE ─────────────────────────────────────────────────────
const BH = {
  sessions: [],
  counterToday: 0,
  statsToday: { bought: 0, notBought: 0 },
  soundOn: true,
  currentModal: null,
  currentSessionId: null,
  // [v11.2 BH-04] SP cache + index
  spCache: null,           // {maCu: {ten, sku, giaNY, giaSale, ...}}
  spList: [],              // Array of SP objects (full)
  spVersion: '0',
  spIndex: null,           // Pre-built search index
  // [v11.2 BH-10d] tempItems = [{maCu, qty}] thay tempSku
  tempProducts: [],        // SP quan tâm: array of maCu (chuỗi)
  tempItems: [],           // SP đã mua: array of {maCu, qty}
  tempReason: null,
  tempBoughtNV: null,      // [v11.2 BH-10a] {ma, ten} NV trực phiên (Đã mua)
  tempNotBoughtNV: null,   // [v11.7 BH-3] {ma, ten} NV trực phiên (Chưa mua)
  tempSessionNV: null,     // [v11.7 BH-3] {ma, ten} NV chọn từ đầu phiên (modal NV)
  currentSessionNVId: null,// [v11.7 BH-3] idPhien đang mở modal chọn NV
  // [v11.2 BH-01] Filter
  filterStatus: 'all',     // 'all' | 'selling' | 'bought' | 'notbought'
  // Timers
  clockInterval: null,
  timerInterval: null,
  // QLBH state (giữ nguyên v11)
  qlTab: 'live',
  qlFilterKV: '',
  qlFilterQ: '',
  qlFilterMaCH: '',
  qlFilterTuNgay: '',
  qlFilterDenNgay: '',
  qlReloadTimer: null,
  // [v11.7 BH-7c/d] Filter status + sort
  qlStatusFilter: 'all',
  qlSort: 'time_desc',
  qlLastLive: [],
  qlLastFinished: [],
  qlAutoRefresh: null,
};

// Backward-compat alias (code cũ tham chiếu BH_SP_CACHE)
const BH_SP_CACHE = {};

// ─── HELPERS ───────────────────────────────────────────────────
function bhPad(n) { return n < 10 ? '0' + n : '' + n; }
function bhPad3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : '' + n); }

// [v11.2 BH-02] Timer với centiseconds
function bhFormatTimeCs(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10); // centiseconds
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return h + ':' + bhPad(m % 60) + ':' + bhPad(s);  // bỏ cs cho ca dài
  }
  return bhPad(m) + ':' + bhPad(s) + '.' + bhPad(cs);
}
function bhFormatTimeShort(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return bhPad(m) + ':' + bhPad(s);
}

function bhFormatMoney(n) {
  return String(n || '').replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function bhEscHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function bhVibrate(ms) { if (navigator.vibrate) try{ navigator.vibrate(ms); }catch(e){} }
// [v11.7 BH-1] Tiếng ting trong, dài, giống iPhone tin nhắn
// Dùng 2 oscillator (frequency + harmonic) với envelope ADSR mượt
function bhPlayBeep(freq, dur) {
  if (!BH.soundOn) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    // Oscillator 1: tone chính (sine)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    // Oscillator 2: harmonic 4th cao hơn (cho âm thanh trong, sắc)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 1.498, now); // perfect 5th = 1.5x
    // Gain với envelope mượt
    const gain = ctx.createGain();
    const peakVol = 0.18;
    const decay = Math.max(dur, 600) / 1000; // tối thiểu 600ms decay
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakVol, now + 0.012); // attack 12ms
    gain.gain.exponentialRampToValueAtTime(peakVol * 0.4, now + 0.08); // initial decay
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay); // long tail
    // Lowpass filter để bớt chói
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(6000, now);
    filter.Q.setValueAtTime(1.2, now);
    // Connect
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + decay + 0.05);
    osc2.stop(now + decay + 0.05);
    setTimeout(() => ctx.close(), (decay + 0.1) * 1000);
  } catch(e){}
}

// [v11.2 BH-04] Get tên SP từ mã cũ (lookup nhanh từ cache)
function bhTenSP(maCu) {
  if (!maCu) return '';
  if (BH.spCache && BH.spCache[maCu]) return BH.spCache[maCu].ten;
  if (BH_SP_CACHE[maCu]) return BH_SP_CACHE[maCu].ten;
  return maCu; // fallback
}

// [v11.2 BH-04] Get giá SP (giaSale > 0 ? giaSale : giaNY)
function bhGiaSP(maCu) {
  if (!maCu) return 0;
  const sp = (BH.spCache && BH.spCache[maCu]) || BH_SP_CACHE[maCu];
  if (!sp) return 0;
  return (sp.giaSale > 0) ? sp.giaSale : (sp.giaNY || 0);
}

// [v12] Đếm TỔNG SỐ LƯỢNG sản phẩm từ list dòng text dạng "MÃ_TC (x3)"
// spDaMua là array các dòng; mỗi dòng có thể có hậu tố " (xN)", không có = 1
function bhCountSpQty(spList) {
  if (!Array.isArray(spList) || !spList.length) return 0;
  let total = 0;
  spList.forEach(line => {
    const m = String(line || '').match(/\(x\s*(\d+)\)\s*$/i);
    total += m ? parseInt(m[1], 10) : 1;
  });
  return total;
}

function bhShowToast(text, type, undoFn) {
  const wrap = document.getElementById('bh-toast-wrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'bh-toast' + (type ? ' ' + type : '');
  const icon = type === 'success'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  t.innerHTML = icon + '<span>' + bhEscHtml(text) + '</span>';
  if (undoFn) {
    const u = document.createElement('span');
    u.className = 'undo'; u.textContent = 'Hoàn tác';
    u.onclick = () => { undoFn(); t.classList.add('out'); setTimeout(() => t.remove(), 250); };
    t.appendChild(u);
  }
  wrap.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, undoFn ? 8000 : 2500);
}

// ═══════════════════════════════════════════════════════════════════
// [v11.2 BH-04] SP CACHE + INDEXED SEARCH
// ═══════════════════════════════════════════════════════════════════

const BH_SP_LS_KEY = 'bh_sp_full_v1';
const BH_SP_LS_VER = 'bh_sp_ver_v1';

// Load SP từ localStorage (nếu có) → kiểm version với server → fetch nếu cần
async function bhLoadSpData() {
  // 1) Load từ localStorage
  try {
    const cached = localStorage.getItem(BH_SP_LS_KEY);
    const ver = localStorage.getItem(BH_SP_LS_VER);
    if (cached && ver) {
      const list = JSON.parse(cached);
      if (Array.isArray(list) && list.length) {
        BH.spList = list;
        BH.spVersion = ver;
        bhBuildSpCacheAndIndex(list);
      }
    }
  } catch(e){}

  // 2) [v12-P1] Kiểm tra version (updated_at lớn nhất) qua Supabase
  // Mỗi lần SP nào update thì updated_at đổi → so sánh để biết có cần reload không
  try {
    const { data: vRow, error: vErr } = await supa
      .from('san_pham')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vErr) throw vErr;
    const newVer = vRow ? vRow.updated_at : '0';
    if (BH.spVersion === newVer && BH.spList.length > 0) {
      // Version trùng → dùng cache, không tải lại
      return;
    }
    // 3) Tải toàn bộ SP — dùng pagination 1000/lần để tránh limit
    const allRows = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: rows, error } = await supa
        .from('san_pham')
        .select('ma_sp, ten_sp, ma_vach, ma_tham_chieu, sku, gia_niem_yet, gia_sale, gia_ban, nganh_hang_1, nganh_hang_2, nganh_hang_3')
        .eq('trang_thai', 'ACTIVE')
        .order('ma_sp', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!rows || !rows.length) break;
      allRows.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
      if (offset > 50000) break; // safety
    }
    // Convert sang format frontend kỳ vọng (maCu, ten, sku, giaNY, giaSale...)
    const list = allRows.map(r => ({
      maCu:    r.ma_sp,
      maThamChieu: r.ma_tham_chieu || '',
      ten:     r.ten_sp,
      maVach:  r.ma_vach || '',
      sku:     r.sku || '',
      giaNY:   parseFloat(r.gia_niem_yet || r.gia_ban || 0) || 0,
      giaSale: parseFloat(r.gia_sale || 0) || 0,
      nh1:     r.nganh_hang_1 || '',
      nh2:     r.nganh_hang_2 || '',
      nh3:     r.nganh_hang_3 || '',
    }));
    if (list.length) {
      BH.spList = list;
      BH.spVersion = newVer;
      bhBuildSpCacheAndIndex(list);
      try {
        localStorage.setItem(BH_SP_LS_KEY, JSON.stringify(list));
        localStorage.setItem(BH_SP_LS_VER, newVer);
      } catch(e){
        // QuotaExceeded → vẫn dùng in-memory
      }
      console.log('[BH] Đã tải ' + list.length + ' SP từ Supabase');
    }
  } catch(e) {
    if (!BH.spList.length) {
      console.warn('[BH] Không load được danh sách SP:', e);
    }
  }
}

function bhBuildSpCacheAndIndex(list) {
  BH.spCache = {};
  // Index: prefix-trie đơn giản dùng Map
  // Mỗi token (mã, sku, mã vạch, từ trong tên) → danh sách index
  BH.spIndex = {
    byMaCu: {},        // exact match maCu → index
    bySku: {},         // exact match sku
    byBarcode: {},     // exact match barcode
    byMaThamChieu: {}, // [v9.45] exact match mã tham chiếu (MC001-XM21)
    tokens: [],        // [[token, idx], ...] để partial match nhanh
  };
  list.forEach((sp, idx) => {
    // Backward compat: BH_SP_CACHE cũng cập nhật để code cũ vẫn chạy
    BH_SP_CACHE[sp.maCu] = sp;
    BH.spCache[sp.maCu] = sp;
    if (sp.sku) BH.spCache[sp.sku] = sp;

    if (sp.maCu)         BH.spIndex.byMaCu[sp.maCu.toLowerCase()] = idx;
    if (sp.sku)          BH.spIndex.bySku[sp.sku.toLowerCase()] = idx;
    if (sp.maVach)       BH.spIndex.byBarcode[sp.maVach] = idx;
    if (sp.maThamChieu)  BH.spIndex.byMaThamChieu[sp.maThamChieu.toLowerCase()] = idx;

    // Tách tên thành tokens để search prefix nhanh
    const tokens = (sp.ten || '').toLowerCase().split(/\s+/).filter(Boolean);
    tokens.forEach(tk => {
      BH.spIndex.tokens.push([tk, idx]);
    });
  });
}

// [v11.2 BH-04] Search nhanh với indexed approach
function bhSearchSpLocal(query, limit) {
  query = String(query || '').trim().toLowerCase();
  limit = limit || 30;
  if (!query || !BH.spList.length) return [];

  const matched = new Set();
  const results = [];

  // 1) Exact match maCu/sku/barcode/maThamChieu (highest priority)
  if (BH.spIndex.byMaCu[query] !== undefined) {
    const idx = BH.spIndex.byMaCu[query];
    matched.add(idx);
    results.push(BH.spList[idx]);
  }
  if (BH.spIndex.bySku[query] !== undefined) {
    const idx = BH.spIndex.bySku[query];
    if (!matched.has(idx)) { matched.add(idx); results.push(BH.spList[idx]); }
  }
  if (BH.spIndex.byBarcode[query] !== undefined) {
    const idx = BH.spIndex.byBarcode[query];
    if (!matched.has(idx)) { matched.add(idx); results.push(BH.spList[idx]); }
  }
  // [v9.45] Exact match mã tham chiếu (MC001-XM21)
  if (BH.spIndex.byMaThamChieu && BH.spIndex.byMaThamChieu[query] !== undefined) {
    const idx = BH.spIndex.byMaThamChieu[query];
    if (!matched.has(idx)) { matched.add(idx); results.push(BH.spList[idx]); }
  }

  // 2) Prefix match maCu/sku/barcode/maThamChieu
  if (results.length < limit) {
    const indices = [BH.spIndex.byMaCu, BH.spIndex.bySku, BH.spIndex.byBarcode, BH.spIndex.byMaThamChieu || {}];
    for (let j = 0; j < indices.length && results.length < limit; j++) {
      const keys = Object.keys(indices[j]);
      for (let i = 0; i < keys.length && results.length < limit; i++) {
        if (keys[i].indexOf(query) === 0) {
          const idx = indices[j][keys[i]];
          if (!matched.has(idx)) { matched.add(idx); results.push(BH.spList[idx]); }
        }
      }
    }
  }

  // 3) Token prefix match (tên SP)
  if (results.length < limit) {
    for (let i = 0; i < BH.spIndex.tokens.length && results.length < limit; i++) {
      const [tk, idx] = BH.spIndex.tokens[i];
      if (tk.indexOf(query) === 0 && !matched.has(idx)) {
        matched.add(idx);
        results.push(BH.spList[idx]);
      }
    }
  }

  // 4) Substring match cuối cùng (cả tên + mã + maThamChieu)
  if (results.length < limit) {
    for (let i = 0; i < BH.spList.length && results.length < limit; i++) {
      if (matched.has(i)) continue;
      const sp = BH.spList[i];
      const hay = (sp.ten + ' ' + sp.sku + ' ' + sp.maCu + ' ' + (sp.maVach||'') + ' ' + (sp.maThamChieu||'')).toLowerCase();
      if (hay.indexOf(query) >= 0) {
        matched.add(i);
        results.push(sp);
      }
    }
  }

  return results;
}

// ─── INIT PAGE ────────────────────────────────────────────────
function bhInitPage() {
  if (!SESSION) return;
  const viewCH = document.getElementById('bh-view-ch');
  const viewQL = document.getElementById('bh-view-qlbh');
  const isCH = SESSION.vaiTro === 'CUA_HANG';
  const isQLBH = SESSION.vaiTro === 'QLBH' || SESSION.vaiTro === 'ADMIN' || String(SESSION.vaiTro || '').startsWith('QLBH');

  // Load SP data (async, không block UI)
  bhLoadSpData();

  // [v9.45] Load bảng xếp hạng (mọi role đều xem được)
  bxhLoad();
  // [v9.45] Realtime subscription cho BXH — Apps Script push → Supabase → realtime → app
  bxhStartRealtime();

  if (isCH) {
    viewCH.style.display = '';
    viewQL.style.display = 'none';
    bhInitViewCH();
  } else if (isQLBH) {
    viewCH.style.display = 'none';
    viewQL.style.display = '';
    bhInitViewQLBH();
  } else {
    viewCH.style.display = 'none';
    viewQL.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════
// [v9.45] BẢNG XẾP HẠNG — Light Luxury, SVG icons, 10 rows mini
// ═══════════════════════════════════════════════════════════════════
let BXH = {
  data: { NGAY: [], TUAN: [], THANG: [] },
  currentLoai: 'NGAY',
  lastFetch: 0,
  refreshInterval: null,
  prevRanks: {}  // localStorage cho rank change
};

// SVG icon trophy/medal cho rank 1-3
const BXH_ICONS = {
  1: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  2: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
  3: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>'
};

// SVG mũi tên ↑↓
const BXH_ARROW_UP = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
const BXH_ARROW_DOWN = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>';
const BXH_DASH = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const BXH_SPARK = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

async function bxhLoad(force) {
  // Cache 4 phút — nếu chưa có subscription event báo có data mới thì giữ cache
  if (!force && Date.now() - BXH.lastFetch < 240000 && BXH.data.NGAY.length) {
    bxhRenderMini();
    return;
  }
  try {
    const { data, error } = await supa.from('bang_xep_hang')
      .select('loai, xep_hang, ma_nv, ten_nv, ma_ch, ten_ch, diem, updated_at')
      .order('xep_hang');
    if (error) throw error;
    
    // [v9.45] Detect đã có data trước đó để biết có flash hay không
    const hadPrevData = BXH.data.NGAY.length > 0;
    const prevUpdatedAt = BXH.updatedAt;
    
    BXH.data = { NGAY: [], TUAN: [], THANG: [] };
    let updatedAt = null;
    (data || []).forEach(r => {
      if (BXH.data[r.loai]) BXH.data[r.loai].push(r);
      if (!updatedAt && r.updated_at) updatedAt = r.updated_at;
    });
    BXH.lastFetch = Date.now();
    BXH.updatedAt = updatedAt;
    try {
      const prev = JSON.parse(localStorage.getItem('bxh_prev_ranks') || '{}');
      BXH.prevRanks = prev;
    } catch(e) { BXH.prevRanks = {}; }
    
    // [v9.45] Check tôi tăng hạng → confetti (chỉ khi đã có data trước, không bắn lần đầu)
    if (hadPrevData) {
      bxhCheckMyRankImproved(BXH.data.NGAY);
    }
    
    // [v9.45] Flag để animation chỉ chạy 1 lần khi data mới đến, không phải mỗi render
    BXH._justUpdated = !!(hadPrevData && updatedAt && prevUpdatedAt && updatedAt !== prevUpdatedAt);
    bxhRenderMini();
    BXH._justUpdated = false;
    
    // [v9.45] Flash khi vừa có update mới (updatedAt thay đổi)
    if (hadPrevData && updatedAt && prevUpdatedAt && updatedAt !== prevUpdatedAt) {
      bxhFlashUpdate();
    }
    
    if (document.getElementById('bxh-modal') && document.getElementById('bxh-modal').classList.contains('show')) {
      bxhRenderFull();
    }
  } catch (e) {
    console.warn('[BXH] Lỗi:', e);
    const els = [document.getElementById('bxh-mini-list'), document.getElementById('bxh-mini-list-ql')].filter(Boolean);
    if (!BXH.data.NGAY.length) {
      els.forEach(el => el.innerHTML = '<div class="bxh-empty">Chưa có dữ liệu</div>');
    }
  }
}

// [v9.45] Subscribe Realtime: Supabase tự push khi Apps Script ghi data mới
// Nhịp 5 phút (Apps Script cron) → app nhận event → fetch 1 lần
// Tiết kiệm 90% bandwidth so với polling 30s
// [v10.85] Thay realtime bằng polling để tiết kiệm Supabase Realtime Messages quota
// Trước: subscribe `bang_xep_hang` event * không filter → tốn hàng triệu msg/ngày
// Sau: poll mỗi 60s khi user đang ở tab Bán hàng + tab active (không hidden)
let _bxhPollingTimer = null;
function bxhStartRealtime() {
  bxhStopRealtime();
  _bxhPollingTimer = setInterval(() => {
    if (document.hidden) return;
    if (!SESSION) return;
    const pageBH = document.getElementById('page-banhang');
    if (!pageBH || !pageBH.classList.contains('active')) return;
    bxhLoad(true);
  }, 60000);
}

function bxhStopRealtime() {
  // Clear realtime channel cũ (legacy v9.45)
  if (BXH.realtimeChannel) {
    try { supa.removeChannel(BXH.realtimeChannel); } catch(e){}
    BXH.realtimeChannel = null;
  }
  // Clear polling timer
  if (_bxhPollingTimer) { clearInterval(_bxhPollingTimer); _bxhPollingTimer = null; }
  if (BXH._debounceTimer) {
    clearTimeout(BXH._debounceTimer);
    BXH._debounceTimer = null;
  }
}

// Khi tab browser quay lại sau khi ẩn → fetch ngay (đề phòng miss event)
if (!window._bxhVisHandler) {
  window._bxhVisHandler = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const pageBH = document.getElementById('page-banhang');
      if (pageBH && pageBH.classList.contains('active')) {
        bxhLoad(true);
      }
    }
  });
}

function _bxhRankChangeHtml(loai, maNV, currentRank) {
  const prevKey = loai + ':' + maNV;
  const prevRank = BXH.prevRanks[prevKey];
  if (prevRank === undefined) {
    return `<span class="bxh-mini-change new">${BXH_SPARK}NEW</span>`;
  }
  if (prevRank === currentRank) {
    return `<span class="bxh-mini-change same">${BXH_DASH}</span>`;
  }
  const diff = prevRank - currentRank;
  if (diff > 0) return `<span class="bxh-mini-change up">${BXH_ARROW_UP}${diff}</span>`;
  return `<span class="bxh-mini-change down">${BXH_ARROW_DOWN}${Math.abs(diff)}</span>`;
}

// [v9.45] SVG icon corner: 1=crown, 2=star, 3=medal — size lớn hơn cho ô 48px
const BXH_RANK_ICON = {
  1: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/></svg>',
  2: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  3: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="15" r="6" fill="currentColor"/><polyline points="6 3 6 8 12 11 18 8 18 3" fill="currentColor"/></svg>'
};

function _bxhRankIconCornerHtml(rank) {
  if (rank > 3) return '';
  return `<div class="bxh-mini-rank-icon">${BXH_RANK_ICON[rank]}</div>`;
}

function bxhRenderMini() {
  // [v10.85] Setting ẩn BXH cho NV (ADMIN/QLBH luôn xem được)
  const role = String(SESSION && SESSION.vaiTro || '').toUpperCase();
  const nvXem = _getSetting('ui.nv_xem_bxh', true);
  if (role === 'NV' && (nvXem === false || nvXem === 'false')) {
    const panelMini = document.getElementById('bxh-mini');
    if (panelMini) panelMini.style.display = 'none';
    return;
  }
  // Dùng setting top_n để cắt list
  const topN = Number(_getSetting('ui.bxh_top_n', 10));
  const top = (BXH.data.NGAY || []).slice(0, topN);
  const els = [document.getElementById('bxh-mini-list'), document.getElementById('bxh-mini-list-ql')].filter(Boolean);
  if (!els.length) return;
  if (!top.length) {
    els.forEach(el => el.innerHTML = '<div class="bxh-empty">Chưa có dữ liệu xếp hạng</div>');
    return;
  }
  const meCode = SESSION && SESSION.ma ? String(SESSION.ma).toUpperCase() : '';

  // [v10.85] Màu theo hạng
  const RANK_COLOR = {
    1: { num:'#C99A2E', bg:'linear-gradient(160deg,#FFFDF5 0%,#FDF6E3 100%)', bd:'#E8D08A', glow:'rgba(201,154,46,.25)' },
    2: { num:'#7C8BA0', bg:'linear-gradient(160deg,#FBFCFE 0%,#EEF2F7 100%)', bd:'#CBD5E1', glow:'rgba(124,139,160,.2)' },
    3: { num:'#B06A3B', bg:'linear-gradient(160deg,#FEFAF6 0%,#F8EDE3 100%)', bd:'#E0BD9C', glow:'rgba(176,106,59,.2)' }
  };

  // ─── Top 3 podium ───
  const top3 = top.slice(0, 3);
  const rest = top.slice(3);

  let podiumHtml = '<div class="bxh-podium">';
  top3.forEach(e => {
    const r = e.xep_hang;
    const c = RANK_COLOR[r] || RANK_COLOR[3];
    const isMe = e.ma_nv && String(e.ma_nv).toUpperCase() === meCode;
    const changeHtml = _bxhRankChangeHtml('NGAY', e.ma_nv, r);
    const meBadge = isMe ? '<span class="bxh-mini-me-badge">BẠN</span>' : '';
    const crown = r === 1 ? '<div class="bxh-pod-crown"><svg width="20" height="20" viewBox="0 0 24 24" fill="#C99A2E"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/></svg></div>' : '';
    podiumHtml += `<div class="bxh-pod-card r${r} ${isMe?'is-me':''}" data-ma-nv="${bxhEsc(e.ma_nv)}" style="background:${c.bg};border-color:${c.bd};box-shadow:0 4px 16px ${c.glow}">
      ${crown}
      <div class="bxh-pod-rank" style="color:${c.num}">${r}</div>
      <div class="bxh-pod-avatar">${_renderAvatar(e.ma_nv, e.ten_nv || e.ma_nv, r===1?80:64)}</div>
      <div class="bxh-pod-name">${bxhEsc(e.ten_nv || e.ma_nv)}${meBadge}</div>
      <div class="bxh-pod-ch">${bxhEsc(e.ten_ch || '—')}</div>
      <div class="bxh-pod-diem" style="color:${c.num}">${e.diem.toLocaleString('vi-VN')}</div>
      <div class="bxh-pod-change">${changeHtml}</div>
    </div>`;
  });
  podiumHtml += '</div>';

  // ─── Danh sách từ #4 ───
  let listHtml = '';
  rest.forEach((e, i) => {
    const idx = i + 3; // index trong top
    const isMe = e.ma_nv && String(e.ma_nv).toUpperCase() === meCode;
    const prevKey = 'NGAY:' + e.ma_nv;
    const prevRank = BXH.prevRanks[prevKey];
    let animClass = '';
    if (BXH._justUpdated) {
      if (prevRank !== undefined && prevRank !== e.xep_hang) {
        animClass = (prevRank - e.xep_hang > 0) ? 'anim-up' : 'anim-down';
      } else if (prevRank === undefined) {
        animClass = 'anim-new';
      }
    }
    let gapHtml = '';
    const gap = top[idx-1].diem - e.diem;
    if (gap > 0) gapHtml = `<span class="bxh-gap">cách ${gap.toLocaleString('vi-VN')} điểm</span>`;
    const changeHtml = _bxhRankChangeHtml('NGAY', e.ma_nv, e.xep_hang);
    const meBadge = isMe ? '<span class="bxh-mini-me-badge">BẠN</span>' : '';
    listHtml += `<div class="bxh-mini-row ${isMe ? 'is-me' : ''} ${animClass}" data-ma-nv="${bxhEsc(e.ma_nv)}">
      <div class="bxh-mini-num">${e.xep_hang}</div>
      ${_renderAvatar(e.ma_nv, e.ten_nv || e.ma_nv, 40)}
      <div class="bxh-mini-info">
        <div class="bxh-mini-name">${bxhEsc(e.ten_nv || e.ma_nv)}${meBadge}</div>
        <div class="bxh-mini-ch">${bxhEsc(e.ten_ch || '—')}${gapHtml}</div>
      </div>
      ${changeHtml}
      <div class="bxh-mini-diem">${e.diem.toLocaleString('vi-VN')}</div>
    </div>`;
  });

  const html = podiumHtml + (listHtml ? `<div class="bxh-mini-rest">${listHtml}</div>` : '');
  els.forEach(el => el.innerHTML = html);
  try { if (window._avatarLoadedAll) _patchAvatars(); } catch(e){}
  
  // Lưu rank vào localStorage
  try {
    const newPrev = { ...BXH.prevRanks };
    top.forEach(e => { newPrev['NGAY:' + e.ma_nv] = e.xep_hang; });
    localStorage.setItem('bxh_prev_ranks', JSON.stringify(newPrev));
  } catch(e) {}
}

// [v9.45] Flash banner + LIVE badge khi vừa cập nhật
function bxhFlashUpdate() {
  ['bxh-mini', 'bxh-mini-ql'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('flash');
      void el.offsetWidth; // reflow
      el.classList.add('flash');
    }
  });
  ['bxh-live-badge', 'bxh-live-badge-ql'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('just-updated');
      void el.offsetWidth;
      el.classList.add('just-updated');
      el.innerHTML = '<span class="dot"></span>VỪA CẬP NHẬT';
      setTimeout(() => {
        if (el) el.innerHTML = '<span class="dot"></span>LIVE';
      }, 2000);
    }
  });
}

// [v9.45] Confetti khi tôi tăng hạng
function bxhConfetti() {
  let container = document.getElementById('bxh-confetti');
  if (!container) {
    container = document.createElement('div');
    container.id = 'bxh-confetti';
    document.body.appendChild(container);
  }
  const colors = ['#C9A227', '#F5E6A8', '#A78BFA', '#60A5FA', '#10B981', '#F472B6'];
  for (let i = 0; i < 35; i++) {
    const piece = document.createElement('div');
    piece.className = 'bxh-confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = (Math.random() * 0.5) + 's';
    piece.style.animationDuration = (1.5 + Math.random()) + 's';
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 3000);
  }
}

// [v9.45] Check tôi có tăng hạng không → confetti
function bxhCheckMyRankImproved(top) {
  if (!SESSION || !SESSION.ma) return;
  const meCode = String(SESSION.ma).toUpperCase();
  const me = top.find(e => String(e.ma_nv || '').toUpperCase() === meCode);
  if (!me) return;
  const prevKey = 'NGAY:' + me.ma_nv;
  const prevRank = BXH.prevRanks[prevKey];
  // Tăng hạng (rank giảm số) → confetti
  if (prevRank !== undefined && me.xep_hang < prevRank) {
    setTimeout(() => bxhConfetti(), 200);
  }
  // Mới vào top 10 lần đầu → confetti
  else if (prevRank === undefined && me.xep_hang <= 10) {
    setTimeout(() => bxhConfetti(), 200);
  }
}


function bxhOpenModal() {
  document.getElementById('bxh-modal').classList.add('show');
  bxhSetLoai('NGAY');
}

function bxhCloseModal() {
  document.getElementById('bxh-modal').classList.remove('show');
}

function bxhSetLoai(loai) {
  BXH.currentLoai = loai;
  document.querySelectorAll('.bxh-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.loai === loai);
  });
  bxhRenderFull();
}

function bxhRenderFull() {
  const top = BXH.data[BXH.currentLoai] || [];
  const body = document.getElementById('bxh-modal-body');
  if (!body) return;

  // Updated time
  const upEl = document.getElementById('bxh-updated-time');
  if (upEl && BXH.updatedAt) {
    const d = new Date(BXH.updatedAt);
    const pad = n => String(n).padStart(2,'0');
    upEl.textContent = 'Cập nhật: ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' · ' + pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear();
  }

  if (!top.length) {
    body.innerHTML = '<div class="bxh-empty">Chưa có dữ liệu xếp hạng cho khoảng này.</div>';
    return;
  }

  const top3 = top.slice(0, 3);
  const rest = top.slice(3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  const podiumHtml = `
    <div class="bxh-full-podium">
      ${podiumOrder.map(e => {
        const sz = e.xep_hang === 1 ? 80 : 68;
        // [v10.85] Avatar thực + medal nhỏ ở góc
        const avatarHtml = window._avatarCache && window._avatarCache[e.ma_nv]
          ? `<img src="${window._avatarCache[e.ma_nv]}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" loading="lazy" decoding="async">`
          : `<div style="width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.round(sz*0.4)}px;font-weight:700;color:#5C4408">${_avatarInitial(e.ten_nv)}</div>`;
        return `
        <div class="bxh-full-podium-item rank-${e.xep_hang}">
          <div class="bxh-podium-rank-num">${e.xep_hang}</div>
          <div class="bxh-podium-icon" style="width:${sz}px;height:${sz}px;overflow:hidden;padding:3px">${avatarHtml}</div>
          <div class="bxh-name" title="${bxhEsc(e.ten_nv)}">${bxhEsc(e.ten_nv || e.ma_nv)}</div>
          <div class="bxh-ch" title="${bxhEsc(e.ten_ch)}">${bxhEsc(e.ten_ch || '—')}</div>
          <div class="bxh-diem-big">${e.diem.toLocaleString('vi-VN')}</div>
          <div class="bxh-diem-label">điểm</div>
        </div>
        `;
      }).join('')}
    </div>
  `;

  const meCode = SESSION && SESSION.ma ? String(SESSION.ma).toUpperCase() : '';
  const listHtml = rest.length ? `
    <div class="bxh-list">
      ${rest.map(e => {
        const isMe = e.ma_nv && String(e.ma_nv).toUpperCase() === meCode;
        const changeHtml = _bxhRankChangeHtml(BXH.currentLoai, e.ma_nv, e.xep_hang).replace('bxh-mini-change', 'bxh-rank-change');
        return `
          <div class="bxh-row ${isMe ? 'is-me' : ''}">
            <div class="bxh-rank-num">${e.xep_hang}</div>
            ${_renderAvatar(e.ma_nv, e.ten_nv || e.ma_nv, 32)}
            <div class="bxh-row-info">
              <div class="bxh-row-name">${bxhEsc(e.ten_nv || e.ma_nv)} ${isMe ? '<span class="bxh-mini-me-badge">BẠN</span>' : ''}</div>
              <div class="bxh-row-sub">${bxhEsc(e.ten_ch || '—')} ${changeHtml}</div>
            </div>
            <div class="bxh-row-diem">${e.diem.toLocaleString('vi-VN')}</div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  body.innerHTML = podiumHtml + listHtml;

  // Lưu rank cho loai hiện tại
  try {
    const newPrev = { ...BXH.prevRanks };
    top.forEach(e => { newPrev[BXH.currentLoai + ':' + e.ma_nv] = e.xep_hang; });
    localStorage.setItem('bxh_prev_ranks', JSON.stringify(newPrev));
  } catch(e) {}
}

function bxhEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function bhInitViewCH() {
  document.getElementById('bh-ch-name').textContent = SESSION.cuaHangTen || SESSION.ten;
  document.getElementById('bh-ch-sub').textContent = (SESSION.ma || '') + (SESSION.khuVuc ? ' · ' + SESSION.khuVuc : '');

  bhUpdateClock();
  if (!BH.clockInterval) BH.clockInterval = setInterval(bhUpdateClock, 1000);
  // [v11.7+] Timer 100ms (giảm từ 50ms để bớt load PC) - vẫn đủ mượt cho hiển thị MM:SS
  if (!BH.timerInterval) {
    BH.timerInterval = true; // mark as started
    bhStartTickLoop();
  }

  try {
    const s = localStorage.getItem('bh_sound');
    if (s !== null) BH.soundOn = s === '1';
  } catch(e){}
  bhUpdateSoundUI();

  // [v11.7+ fix sync] Flush queue trước (gửi các phiên chưa đồng bộ từ phiên trước)
  bhFlushKtQueue().then(() => bhLoadPhienDangBan());
  // Auto reload mỗi 10 phút
  bhStartAutoReload();
  // [v12-P1] Realtime sub thay thế polling — phiên thay đổi → reload ngay
  bhStartRealtimeSubCH();
  // Schedule logout 0h sáng hôm sau (chỉ cho CUA_HANG)
  bhScheduleLogoutAt0h();
}

function bhUpdateClock() {
  const d = new Date();
  const tEl = document.getElementById('bh-ch-time');
  if (tEl) tEl.textContent = bhPad(d.getHours()) + ':' + bhPad(d.getMinutes());
}

function bhToggleSound() {
  BH.soundOn = !BH.soundOn;
  try { localStorage.setItem('bh_sound', BH.soundOn ? '1' : '0'); } catch(e){}
  bhUpdateSoundUI();
  // [v11.7 BH-1] Tone preview khi bật âm thanh
  if (BH.soundOn) bhPlayBeep(523, 800);  // C5
}
function bhUpdateSoundUI() {
  const lbl = document.getElementById('bh-sound-label');
  const icon = document.getElementById('bh-sound-icon');
  if (lbl) lbl.textContent = BH.soundOn ? 'Bật' : 'Tắt';
  if (icon) {
    icon.innerHTML = BH.soundOn
      ? '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'
      : '<path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
  }
}

async function bhLoadPhienDangBan(opts) {
  opts = opts || {};
  if (!SESSION.cuaHangMa) return;
  // [v12] Auto đóng phiên quá 60 phút (DB tự xử lý, fire-and-forget)
  try { supa.rpc('fn_bh_auto_close_phien'); } catch(e){}
  try {
    // [v12-P1] Query trực tiếp Supabase: lấy phiên DANG_MO của CH
    const { data: rows, error } = await supa
      .from('phien_ban_hang')
      .select('id, stt_trong_ngay, stt_toan_cuc, ma_nv, ten_nv_snapshot, gio_mo, sp_quan_tam_text, yeu_cau_xoa, ly_do_xoa, nguoi_yeu_cau_xoa, thoi_gian_yeu_cau_xoa, ngay')
      .eq('ma_ch', SESSION.cuaHangMa)
      .eq('trang_thai', 'DANG_MO')
      .order('gio_mo', { ascending: true });
    if (error) throw error;
    // Convert sang format mà code cũ kỳ vọng
    const list = (rows || []).map(r => ({
      idPhien: r.id,
      stt: r.stt_trong_ngay,
      sttToanCuc: r.stt_toan_cuc,
      maNV: r.ma_nv,
      tenNV: r.ten_nv_snapshot,
      gioBD: r.gio_mo,
      ngay: r.ngay,
      spQuanTam: r.sp_quan_tam_text ? r.sp_quan_tam_text.split('\n').filter(Boolean) : [],
      yeuCauXoa: r.yeu_cau_xoa ? {
        co: true, lyDo: r.ly_do_xoa,
        maNguoi: r.nguoi_yeu_cau_xoa,
        ts: r.thoi_gian_yeu_cau_xoa
      } : null,
    }));
    const wasEmpty = BH.sessions.length === 0;

    // [v11.8+] Smart reconcile: detect các phiên bị QLBH xóa
    const serverIds = new Set(list.map(p => p.idPhien));
    const deletedSessions = BH.sessions.filter(s =>
      s.status === 'selling' &&
      !String(s.idPhien).startsWith('temp_') &&
      !serverIds.has(s.idPhien)
    );
    const deletedCount = deletedSessions.length;

    BH.sessions = list.map((p, idx) => {
      let startMs = Date.now();
      try { startMs = new Date(p.gioBD).getTime(); } catch(e){}
      return {
        idPhien: p.idPhien,
        num: p.stt,
        sttToanCuc: p.sttToanCuc || 0,
        startMs,
        products: p.spQuanTam || [],
        nv: p.maNV ? { ma: p.maNV, ten: p.tenNV || p.maNV } : null,
        status: 'selling',
        xinXoa: p.yeuCauXoa,
      };
    });
    if (BH.sessions.length > 0) {
      BH.counterToday = Math.max(...BH.sessions.map(s => s.num || 0));
    }
    bhLoadStatsToday();
    bhRenderSessions();
    bhUpdateStats();

    // [v11.8+] Thông báo nếu có phiên bị QLBH xóa
    if (deletedCount > 0) {
      const txt = deletedCount === 1
        ? `🗑 Phiên #${deletedSessions[0].num} đã được QLBH xóa`
        : `🗑 ${deletedCount} phiên đã được QLBH xóa`;
      try { bhShowToast(txt, null); } catch(e){}
      console.log('[BH] QLBH đã xóa ' + deletedCount + ' phiên:', deletedSessions.map(s => '#' + s.num).join(', '));
    }

    // [v11.7+] Thông báo khi load lại có phiên cũ chưa đóng (chỉ khi không phải auto-silent)
    if (wasEmpty && list.length > 0 && !opts.silent) {
      console.log('[BH] Đã khôi phục ' + list.length + ' phiên đang bán dở từ session trước');
      try {
        bhShowToast('Đã khôi phục ' + list.length + ' phiên đang bán dở (từ lần đăng nhập trước). Có thể kết thúc hoặc tự đóng sau 60 phút.', null);
      } catch(e){}
    }
  } catch(e) {
    console.error('[BH] Load phien dang ban lỗi:', e);
  }
}

// [v11.7+ fix sync] Manual reload thủ công - user bấm nút
async function bhManualReload() {
  const btn = document.getElementById('bh-reload-btn');
  const icon = document.getElementById('bh-reload-icon');
  if (btn) btn.disabled = true;
  if (icon) {
    icon.style.transition = 'transform 0.6s';
    icon.style.transform = 'rotate(360deg)';
  }
  // Flush queue trước (gửi các kt_phien đang chờ)
  await bhFlushKtQueue();
  // Sau đó load lại từ server
  await bhLoadPhienDangBan();
  if (btn) btn.disabled = false;
  if (icon) {
    setTimeout(() => { icon.style.transition = 'none'; icon.style.transform = ''; }, 600);
  }
  bhShowToast('✓ Đã cập nhật từ server', 'success');
}

// [v11.8+] Auto reload mỗi 30 giây cho CH - phát hiện QLBH xóa phiên realtime
//          Chỉ chạy khi tab visible + ở tab bán hàng + không có modal mở
let _bhAutoReloadTimer = null;
const AUTO_RELOAD_MS = 30 * 1000; // 30 giây

// ════════════════════════════════════════════════════════════════
// [v12-P1] REALTIME SUBSCRIPTIONS — thay thế polling
// ════════════════════════════════════════════════════════════════
let _bhRtChannelCH = null;
let _bhRtChannelQL = null;
let _bhRtDebouncer = null;

// Debounce: gom nhiều events thành 1 lần reload (tránh spam khi nhiều CH update cùng lúc)
function _bhRtDebounce(fn, delay) {
  if (_bhRtDebouncer) clearTimeout(_bhRtDebouncer);
  _bhRtDebouncer = setTimeout(() => { _bhRtDebouncer = null; fn(); }, delay || 600);
}

// CH subscription: lắng phiên của CH hiện tại
function bhStartRealtimeSubCH() {
  if (!supa || !SESSION.cuaHangMa) return;
  bhStopRealtimeSubCH();
  try {
    _bhRtChannelCH = supa.channel('ch-phien-' + SESSION.cuaHangMa)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'phien_ban_hang',
        filter: 'ma_ch=eq.' + SESSION.cuaHangMa
      }, (payload) => {
        // DELETE hoặc trạng thái đổi (QLBH xóa) → reload ngay lập tức
        if (payload.eventType === 'DELETE' || 
            (payload.eventType === 'UPDATE' && payload.new && payload.new.trang_thai !== 'DANG_MO')) {
          if (currentPage === 'banhang') bhLoadPhienDangBan({ silent: true });
          return;
        }
        // INSERT/UPDATE bình thường → debounce ngắn, skip nếu modal mở
        const anyModal = document.querySelector('.bh-modal.show');
        if (anyModal) return;
        _bhRtDebounce(() => {
          if (currentPage !== 'banhang') return;
          bhLoadPhienDangBan({ silent: true });
        }, 300);
      })
      // [v9.45] Channel phụ chỉ nghe DELETE (không filter, vì payload.old của DELETE có thể bị strip)
      // Bất cứ phiên nào bị xóa trong DB → reload phiên của CH này
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'phien_ban_hang'
      }, (payload) => {
        // Filter client-side bằng payload.old (nếu có ma_ch) hoặc reload luôn cho chắc
        const matches = !payload.old || !payload.old.ma_ch || payload.old.ma_ch === SESSION.cuaHangMa;
        if (matches && currentPage === 'banhang') {
          bhLoadPhienDangBan({ silent: true });
        }
      })
      .subscribe((status) => {
        console.log('[BH RT CH]', status);
      });
  } catch(e) { console.error('[BH RT CH] init', e); }
}
function bhStopRealtimeSubCH() {
  try { if (_bhRtChannelCH) supa.removeChannel(_bhRtChannelCH); } catch(e){}
  _bhRtChannelCH = null;
}

// [v10.85] Thay realtime bằng polling để tiết kiệm Realtime Messages quota
// Trước: subscribe `phien_ban_hang` event * không filter → 50 QLBH × ~7,700 events/ngày = 385K msg/ngày
// Sau: poll mỗi 30s khi user ở tab Bán hàng (live hoặc history)
let _bhQlPollingTimer = null;
function bhStartRealtimeSubQL() {
  if (!supa) return;
  bhStopRealtimeSubQL();
  _bhQlPollingTimer = setInterval(() => {
    if (document.hidden) return;
    if (!SESSION) return;
    if (currentPage !== 'banhang') return;
    if (BH.qlTab !== 'live' && BH.qlTab !== 'history') return;
    if (document.querySelector('.bh-modal.show')) return;
    bhQlLoadPhien();
  }, 30000);
}
function bhStopRealtimeSubQL() {
  // Clear realtime channel cũ
  try { if (_bhRtChannelQL) supa.removeChannel(_bhRtChannelQL); } catch(e){}
  _bhRtChannelQL = null;
  // Clear polling timer
  if (_bhQlPollingTimer) { clearInterval(_bhQlPollingTimer); _bhQlPollingTimer = null; }
}

function bhStartAutoReload() {
  if (_bhAutoReloadTimer) clearInterval(_bhAutoReloadTimer);
  _bhAutoReloadTimer = setInterval(() => {
    // Skip nếu tab ẩn
    if (document.hidden) return;
    // Skip nếu user không ở tab bán hàng (avoid disrupt khi đang xem tab khác)
    if (typeof CURRENT_PAGE !== 'undefined' && CURRENT_PAGE !== 'banhang') return;
    // Skip nếu đang có modal mở (tránh ngắt user nhập liệu)
    const anyModal = document.querySelector('.bh-modal.show');
    if (anyModal) return;
    // Skip nếu đang có phiên syncing
    if (BH.sessions.some(s => s.syncing)) return;

    console.log('[BH] Auto reload (30s)...');
    bhFlushKtQueue().then(() => bhLoadPhienDangBan({ silent: true }));
  }, AUTO_RELOAD_MS);
}
function bhStopAutoReload() {
  if (_bhAutoReloadTimer) clearInterval(_bhAutoReloadTimer);
  _bhAutoReloadTimer = null;
}

// [v11.7+ fix sync] Schedule logout vào lúc 0h sáng hôm sau
// Trong ngày KHÔNG logout (kể cả nhận update)
let _bhLogoutTimer = null;
function bhScheduleLogoutAt0h() {
  if (_bhLogoutTimer) clearTimeout(_bhLogoutTimer);
  if (!SESSION) return;
  // Chỉ áp dụng cho tài khoản CUA_HANG (NV/QLNS/QLBH thì không tự logout)
  if (SESSION.vaiTro !== 'CUA_HANG') return;

  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const msUntil = tomorrow.getTime() - now.getTime();
  console.log('[BH] Schedule auto-logout lúc 0h:00:05 - sau ' + Math.round(msUntil/1000/60) + ' phút');
  _bhLogoutTimer = setTimeout(() => {
    bhShowToast('🌙 Hết ngày làm việc - đăng xuất tự động', null);
    setTimeout(() => {
      try {
        // [v10.85] CUA_HANG vẫn auto logout 0h — xóa cả localStorage
        localStorage.removeItem('session_cc');
        localStorage.removeItem('session_login_ts');
        sessionStorage.removeItem('session_cc');
        // Xóa cache local nhưng giữ queue (gửi lên ngày mai khi login)
        location.reload();
      } catch(e) {
        location.reload();
      }
    }, 2000);
  }, msUntil);
}

async function bhLoadStatsToday() {
  try {
    // [v13.54] Hiển thị phiên CHỈ TRONG NGÀY (hôm nay).
    //   Ngoại lệ: đơn TỰ ĐÓNG chưa bổ sung trong 6 ngày trước → vẫn lấy về
    //   để NV nhập lại kết quả (trước đây không tìm thấy đơn nên không nhập được).
    const today = new Date();
    const ngayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    const _from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const ngay7Str = _from.getFullYear() + '-' + String(_from.getMonth()+1).padStart(2,'0') + '-' + String(_from.getDate()).padStart(2,'0');
    const SEL = 'id, stt_trong_ngay, ma_nv, ten_nv_snapshot, gio_mo, gio_dong, ket_qua, ly_do_khong_mua, tong_gia_tri, thoi_luong_phut, sp_da_mua_text, sp_quan_tam_text, ngay';

    // Query 1: phiên DA_DONG HÔM NAY (mọi kết quả) — dùng cho thống kê + hiển thị
    const p1 = supa.from('phien_ban_hang').select(SEL)
      .eq('ma_ch', SESSION.cuaHangMa).eq('trang_thai', 'DA_DONG').eq('ngay', ngayStr)
      .order('gio_mo', { ascending: false }).limit(300);
    // Query 2: phiên TỰ ĐÓNG chưa bổ sung trong 6 ngày TRƯỚC (để bổ sung kết quả)
    const p2 = supa.from('phien_ban_hang').select(SEL)
      .eq('ma_ch', SESSION.cuaHangMa).eq('trang_thai', 'DA_DONG').eq('ket_qua', 'TU_DONG')
      .gte('ngay', ngay7Str).lt('ngay', ngayStr)
      .order('gio_mo', { ascending: false }).limit(100);

    const [r1, r2] = await Promise.all([p1, p2]);
    if (r1.error) throw r1.error;

    const fmtTime = ts => {
      if (!ts) return '';
      try { const d = new Date(ts); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
      catch(e){ return ''; }
    };
    const fmtThoiLuong = m => {
      if (!m) return '';
      const totalSec = Math.round(m * 60);
      return String(Math.floor(totalSec/60)).padStart(2,'0') + ':' + String(totalSec%60).padStart(2,'0');
    };
    const mapRow = r => {
      let trangThai = 'Đã mua';
      if (r.ket_qua === 'CHUA_MUA')        trangThai = 'Chưa mua';
      else if (r.ket_qua === 'TU_DONG')    trangThai = 'Tự đóng';
      else if (r.ket_qua === 'ADMIN_DONG') trangThai = 'Admin đã đóng';
      return {
        idPhien: r.id, stt: r.stt_trong_ngay, maNV: r.ma_nv, tenNV: r.ten_nv_snapshot,
        gioBD: fmtTime(r.gio_mo), gioKT: fmtTime(r.gio_dong), thoiLuong: fmtThoiLuong(r.thoi_luong_phut),
        trangThai, lyDo: r.ly_do_khong_mua, tongGiaTri: r.tong_gia_tri,
        spDaMua: r.sp_da_mua_text ? r.sp_da_mua_text.split('\n').filter(Boolean) : [],
        spQuanTam: r.sp_quan_tam_text ? r.sp_quan_tam_text.split('\n').filter(Boolean) : [],
        ngay: r.ngay,   // để hiển thị nhãn ngày khi không phải hôm nay
      };
    };

    BH.historyToday    = (r1.data || []).map(mapRow);                       // hôm nay
    BH.historyTuDongCu = (r2.error ? [] : (r2.data || []).map(mapRow));     // tự đóng cũ (cần bổ sung)
    BH.statsToday = {
      bought:    BH.historyToday.filter(p => p.trangThai === 'Đã mua').length,
      notBought: BH.historyToday.filter(p => p.trangThai === 'Chưa mua' || p.trangThai === 'Tự đóng' || p.trangThai === 'Admin đã đóng').length,
    };
    bhUpdateStats();
    if (BH.filterStatus !== 'selling' && BH.filterStatus !== undefined) {
      bhRenderSessions();
    }
  } catch(e){
    console.error('[BH stats today]', e);
  }
}

// [v11.2 BH-01 + BH-07] Update stats với 5 thẻ + filter
function bhUpdateStats() {
  const selling = BH.sessions.filter(s => s.status !== 'finished').length;
  const total = BH.statsToday.bought + BH.statsToday.notBought + selling;

  document.getElementById('bh-stat-selling').textContent = selling;
  document.getElementById('bh-stat-bought').textContent = BH.statsToday.bought;
  document.getElementById('bh-stat-notbought').textContent = BH.statsToday.notBought;
  const allEl = document.getElementById('bh-stat-all');
  if (allEl) allEl.textContent = total;

  const ratebase = BH.statsToday.bought + BH.statsToday.notBought;
  document.getElementById('bh-stat-rate').textContent = ratebase > 0 ? Math.round(BH.statsToday.bought / ratebase * 100) + '%' : '–';

  // Visual filter active
  ['all', 'selling', 'bought', 'notbought'].forEach(k => {
    const card = document.querySelector('[data-stat-filter="' + k + '"]');
    if (card) card.classList.toggle('active-filter', BH.filterStatus === k);
  });

  // Warn banner
  const warn = document.getElementById('bh-warn');
  if (selling >= 5) {
    warn.style.display = 'flex';
    document.getElementById('bh-warn-text').textContent = 'Đang có ' + selling + ' phiên cùng lúc - kiểm tra phiên cũ nếu quên đóng';
  } else {
    warn.style.display = 'none';
  }
  // Tab badge
  const badge = document.getElementById('bh-nav-badge');
  if (badge) {
    if (selling > 0) { badge.textContent = selling; badge.style.display = ''; }
    else badge.style.display = 'none';
  }
}

// [v11.2 BH-01] Click thẻ stat → filter
function bhSetFilter(status) {
  BH.filterStatus = status;
  bhRenderSessions();
  bhUpdateStats();
}

function bhRenderSessions() {
  const wrap = document.getElementById('bh-sessions');
  const empty = document.getElementById('bh-empty');
  const filter = BH.filterStatus || 'selling';

  // [v11.8] 4 chế độ filter:
  //  selling (default): chỉ phiên đang bán
  //  bought: phiên đã mua hôm nay
  //  notbought: phiên chưa mua + tự đóng hôm nay
  //  all: tất cả (đang bán + đã kết thúc hôm nay)

  // Xóa hết history-card cũ để render lại
  [...wrap.querySelectorAll('.bh-hist-card-ch')].forEach(c => c.remove());

  // ── Chế độ chỉ history (bought / notbought) ──
  if (filter === 'bought' || filter === 'notbought') {
    // Ẩn cards selling
    [...wrap.querySelectorAll('.bh-card')].forEach(c => c.remove());
    let hist;
    if (filter === 'bought') {
      hist = (BH.historyToday || []).filter(p => p.trangThai === 'Đã mua');
    } else {
      // notbought: chưa mua/tự đóng HÔM NAY + đơn tự đóng CŨ (≤7 ngày) cần bổ sung
      hist = (BH.historyToday || []).filter(p => p.trangThai === 'Chưa mua' || p.trangThai === 'Tự đóng' || p.trangThai === 'Admin đã đóng')
             .concat(BH.historyTuDongCu || []);
    }
    if (!hist.length) {
      if (empty) {
        empty.style.display = 'block';
        empty.querySelector('.bh-empty-title').textContent =
          filter === 'bought' ? 'Chưa có phiên đã mua hôm nay' : 'Chưa có phiên chưa mua hôm nay';
        empty.querySelector('.bh-empty-sub').textContent = 'Bấm "Đang bán" để quay lại danh sách phiên live';
      }
      return;
    }
    if (empty) empty.style.display = 'none';
    // Sort mới-cũ
    hist.sort((a, b) => (b.gioBD || '').localeCompare(a.gioBD || ''));
    hist.forEach(p => {
      const card = bhBuildHistCardCh(p);
      wrap.appendChild(card);
    });
    return;
  }

  // ── Chế độ 'all': hiện cả selling + history ──
  let active = BH.sessions.filter(s => s.status !== 'finished');
  let renderedAny = active.length > 0;

  // Selling cards (giữ logic cũ)
  [...wrap.querySelectorAll('.bh-card')].forEach(c => {
    const id = c.dataset.sid;
    if (!BH.sessions.find(s => s.idPhien === id && s.status !== 'finished')) {
      c.classList.add('finished');
      setTimeout(() => c.remove(), 500);
    }
  });
  active.forEach(s => {
    let card = wrap.querySelector('[data-sid="' + s.idPhien + '"]');
    if (!card) {
      card = document.createElement('div');
      card.className = 'bh-card';
      card.dataset.sid = s.idPhien;
      wrap.appendChild(card);
    }
    bhRenderCardContent(card, s);
  });

  // [v11.8] Nếu filter='all' → thêm history cards bên dưới
  if (filter === 'all') {
    const hist = BH.historyToday || [];
    if (hist.length) {
      hist.sort((a, b) => (b.gioBD || '').localeCompare(a.gioBD || ''));
      hist.forEach(p => {
        const card = bhBuildHistCardCh(p);
        wrap.appendChild(card);
      });
      renderedAny = true;
    }
  }

  if (!renderedAny) {
    if (empty) {
      empty.style.display = 'block';
      empty.querySelector('.bh-empty-title').textContent = 'Chưa có phiên nào';
      empty.querySelector('.bh-empty-sub').textContent = 'Bấm nút bên dưới khi có khách vào';
    }
  } else if (empty) {
    empty.style.display = 'none';
  }
}

// [v11.8] Build card history cho view CH (đã mua / chưa mua / tự đóng)
// [v11.8] Build card history cho view CH (đã mua / chưa mua / tự đóng)
function bhBuildHistCardCh(p) {
  const card = document.createElement('div');
  card.className = 'bh-hist-card-ch';
  let cls = 'bh-hist-bought';
  let label = 'Đã mua';
  let detail = '';
  if (p.trangThai === 'Đã mua') {
    // [v16.0] Bỏ tổng tiền (doanh thu) — chỉ giữ số lượng SP
    if (p.spDaMua && p.spDaMua.length) {
      detail = bhCountSpQty(p.spDaMua) + ' SP';
    }
  } else {
    cls = (p.trangThai === 'Tự đóng' || p.trangThai === 'Admin đã đóng') ? 'bh-hist-auto' : 'bh-hist-notbought';
    label = p.trangThai === 'Tự đóng' ? 'Tự đóng'
          : p.trangThai === 'Admin đã đóng' ? 'Admin đã đóng'
          : 'Chưa mua';
    if (p.lyDo) detail = bhEscHtml(p.lyDo.length > 40 ? p.lyDo.slice(0,40)+'…' : p.lyDo);
  }
  // [v13.50] Nhãn ngày khi phiên KHÔNG phải hôm nay (xem phiên 7 ngày để bổ sung)
  const _hnStr = (function(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })();
  let ngayBadge = '';
  if (p.ngay && p.ngay !== _hnStr) {
    const _pr = String(p.ngay).split('-');
    if (_pr.length === 3) ngayBadge = '<span class="bh-hist-ngay">' + _pr[2] + '/' + _pr[1] + '</span>';
  }
  card.innerHTML = `
    <div class="bh-hist-ch-status ${cls}"></div>
    <div class="bh-hist-ch-info">
      <div class="bh-hist-ch-title">
        <span class="bh-hist-ch-stt">#${p.stt || '?'}</span>
        ${bhEscHtml(label)}
        ${ngayBadge}
        ${p.tenNV ? '· NV: ' + bhEscHtml(p.tenNV) : ''}
      </div>
      <div class="bh-hist-ch-meta">
        ${p.gioBD || '--'} → ${p.gioKT || '--'}
        ${p.thoiLuong ? ' · ' + bhEscHtml(p.thoiLuong) : ''}
        ${detail ? ' · ' + detail : ''}
      </div>
    </div>
  `;
  return card;
}

// [v11.8] CH: Yêu cầu xóa phiên (gửi YC, không xóa)
async function bhYeuCauXoaPhien(idPhien) {
  // [v9.45] Lock per-phien + global để chống double-click + race condition
  if (window._bhYCXoaLock && window._bhYCXoaLock[idPhien]) {
    console.log('[YC Xóa] Đã có request đang xử lý cho phiên', idPhien);
    return;
  }
  window._bhYCXoaLock = window._bhYCXoaLock || {};
  window._bhYCXoaLock[idPhien] = Date.now();
  // Auto-clear lock sau 10s (phòng treo)
  setTimeout(() => { try { delete window._bhYCXoaLock[idPhien]; } catch(e){} }, 10000);

  try {
    const s = BH.sessions.find(x => x.idPhien === idPhien);
    if (!s) return;
    if (s.xinXoa) {
      bhShowToast('Phiên này đã có yêu cầu xóa rồi', null);
      return;
    }
    if (String(idPhien).startsWith('temp_') || s.syncing) {
      bhShowToast('Phiên đang đồng bộ, vui lòng đợi...', null);
      return;
    }

    const ok = await appConfirm('Gửi yêu cầu xóa phiên này lên QLBH? Phiên vẫn chạy đến khi QLBH xác nhận xóa.', {
      title: 'Yêu cầu xóa phiên #' + s.num,
      okLabel: 'Gửi yêu cầu',
      danger: false
    });
    if (!ok) return;

    // [v9.45] Re-check sau khi user confirm (đề phòng race condition)
    const s2 = BH.sessions.find(x => x.idPhien === idPhien);
    if (!s2 || s2.xinXoa) return;

    // Optimistic UI: đánh dấu xinXoa ngay
    s2.xinXoa = { co: true, ts: new Date().toISOString(), maNguoi: SESSION.ma || SESSION.cuaHangMa, lyDo: '' };
    bhRenderSessions();
    bhShowToast('✓ Đã gửi yêu cầu xóa - chờ QLBH', 'success');

    try {
      const { data: d, error } = await supa.rpc('fn_bh_yc_xoa_phien', {
        p_phien_id: idPhien,
        p_ma_nguoi_yc: SESSION.ma || SESSION.cuaHangMa,
        p_ly_do: '',
      });
      if (error || !(d && d.success)) {
        s2.xinXoa = null;
        bhRenderSessions();
        bhShowToast('Lỗi: ' + ((d && d.error) || (error && error.message) || 'Không gửi được yêu cầu'), null);
      }
    } catch(e) {
      console.error('[BH YC Xóa] Network error:', e);
    }
  } finally {
    // Clear lock sau khi xong (cả success/fail)
    delete window._bhYCXoaLock[idPhien];
  }
}

// [v11.8] CH: Hủy yêu cầu xóa
async function bhHuyYeuCauXoa(idPhien) {
  const s = BH.sessions.find(x => x.idPhien === idPhien);
  if (!s) return;
  // Optimistic UI
  s.xinXoa = null;
  bhRenderSessions();
  bhShowToast('✓ Đã hủy yêu cầu xóa', 'success');
  // [v12-P1] Supabase RPC
  try {
    supa.rpc('fn_bh_huy_yc_xoa', { p_phien_id: idPhien });
  } catch(e){}
}

function bhRenderCardContent(card, s) {
  const elapsedMs = Date.now() - s.startMs;
  const elapsed = Math.floor(elapsedMs / 1000);
  const tc = elapsed >= 3600 ? ' danger' : (elapsed >= 1200 ? ' warn' : '');
  const timeLabel = new Date(s.startMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  // [v9.0c] Khi xinXoa → lock tương tác. Đồng hồ vẫn chạy.
  const locked = !!s.xinXoa;

  // [v11.1 BH-06] Closing state
  const isClosing = s.status === 'closing';
  if (isClosing) {
    card.innerHTML = `
      <div class="bh-card-header">
        <div class="bh-card-title">
          <span class="bh-dot" style="background:#9CA3AF;animation:none"></span>
          <div>
            <div class="bh-session-num">Phiên #${s.num}</div>
            <div class="bh-session-meta">đang lưu kết quả...</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-m);display:flex;align-items:center;gap:6px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:bhSpin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 5.64 5.64L23 10"/></svg>
          <span>Đang lưu</span>
        </div>
      </div>`;
    return;
  }

  // [v11.7 BH-6] SP trên card phiên hiển thị dạng list dọc, mỗi SP 1 dòng
  let spListHtml = '';
  if (s.products.length > 0) {
    spListHtml = s.products.map(maCu => {
      const sp = (BH.spCache && BH.spCache[maCu]) || BH_SP_CACHE[maCu];
      const ten = sp ? sp.ten : maCu;
      const ma  = sp ? (sp.maThamChieu || sp.maCu) : maCu;
      return `<div class="bh-card-sp-item">
        <div class="bh-card-sp-name">${bhEscHtml(ten)}</div>
        <div class="bh-card-sp-meta">Mã: ${bhEscHtml(ma)}</div>
      </div>`;
    }).join('');
  }
  // [v9.0] Khi locked → bỏ nút thêm SP, NV row không click được, buttons disable
  const addBtnHtml = locked ? '' : `<div class="bh-card-add-sp" onclick="bhOpenSpModal('${s.idPhien}')">
    <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    ${s.products.length > 0 ? 'Thêm sản phẩm' : 'Thêm sản phẩm khách quan tâm'}
  </div>`;

  // [v11.8] Đổi class card khi đã yêu cầu xóa
  if (s.xinXoa) {
    card.classList.add('bh-card-xinxoa');
  } else {
    card.classList.remove('bh-card-xinxoa');
  }

  card.innerHTML = `
    <div class="bh-card-header">
      <div class="bh-card-title">
        <span class="bh-dot"></span>
        <div>
          <div class="bh-session-num">Phiên #${s.num}${s.xinXoa ? ' <span class="bh-yc-badge">⏳ chờ xóa</span>' : ''}</div>
          <div class="bh-session-meta">bắt đầu ${timeLabel}</div>
        </div>
      </div>
      <div class="bh-timer${tc}" data-timer="${s.idPhien}">${bhFormatTimeCs(elapsedMs)}</div>
    </div>
    <!-- [v11.7 BH-3] Chip Nhân viên trực phiên (nằm trên SP) -->
    <div class="bh-card-nv-row" ${locked ? 'style="opacity:0.5;pointer-events:none"' : `onclick="bhOpenSessionNVModal('${s.idPhien}')"`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      ${s.nv ? `<span class="bh-card-nv-name"><strong>${bhEscHtml(s.nv.ma)}</strong> · ${bhEscHtml(s.nv.ten)}</span>${locked ? '' : '<span class="bh-card-nv-edit">đổi</span>'}` : '<span class="bh-card-nv-empty">Chọn nhân viên tư vấn (tùy chọn)</span>'}
    </div>
    <div class="bh-chips-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      Sản phẩm khách quan tâm
    </div>
    <div class="bh-card-sp-list">${spListHtml}${addBtnHtml}</div>
    ${locked
      ? `<div style="background:#FFF7ED;border:1px dashed #FDBA74;border-radius:8px;padding:10px;text-align:center;font-size:12px;color:#9A3412;line-height:1.5;margin-top:4px">🔒 Phiên đang chờ xóa<br><span style="font-size:11px;color:#C2410C">Đã khóa thao tác. Hủy yêu cầu xóa để tiếp tục bán.</span></div>`
      : `<div class="bh-actions">
      <button class="bh-btn bh-btn-secondary" onclick="bhOpenNotBoughtModal('${s.idPhien}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Chưa mua
      </button>
      <button class="bh-btn bh-btn-success" onclick="bhOpenBoughtModal('${s.idPhien}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Đã mua
      </button>
    </div>`
    }
    <!-- [v11.8] Link nhỏ yêu cầu xóa / hủy yêu cầu -->
    <div class="bh-card-yc-row">
      ${s.xinXoa
        ? `<a class="bh-yc-link cancel" onclick="bhHuyYeuCauXoa('${s.idPhien}')">↶ Hủy yêu cầu xóa</a>`
        : `<a class="bh-yc-link" onclick="bhYeuCauXoaPhien('${s.idPhien}')">🗑 Yêu cầu xóa phiên này</a>`
      }
    </div>`;
}

// [v11.2 BH-02] Tick mỗi 50ms cho centiseconds mượt
function bhTickTimers() {
  // [v11.7 perf] Skip khi tab ẩn - timer sẽ catch-up khi tab visible lại
  if (document.hidden) return;
  // [v11.7+ perf] Skip nếu không có phiên đang bán (tiết kiệm CPU)
  let hasSelling = false;
  for (let i = 0; i < BH.sessions.length; i++) {
    if (BH.sessions[i].status === 'selling') { hasSelling = true; break; }
  }
  if (!hasSelling) return;
  BH.sessions.forEach(s => {
    if (s.status !== 'selling') return;
    const el = document.querySelector('[data-timer="' + s.idPhien + '"]');
    if (!el) return;

    // [v9.0c] Đồng hồ LUÔN đếm thật. Không freeze.
    const elapsedMs = Date.now() - s.startMs;
    const elapsed = Math.floor(elapsedMs / 1000);
    el.textContent = bhFormatTimeCs(elapsedMs);
    el.className = 'bh-timer' + (elapsed >= 3600 ? ' danger' : (elapsed >= 1200 ? ' warn' : ''));

    // Auto-close 60p (kể cả khi đã gửi YC xóa - vẫn auto close)
    if (elapsed >= 3600 && !s._autoClosing && !s.xinXoa) {
      s._autoClosing = true;
      bhAutoClosePhien(s);
    }
  });
}

// [v9.0] Tự động đóng phiên khi đủ 60p
async function bhAutoClosePhien(s) {
  try {
    const { data: res } = await supa.rpc('fn_bh_auto_dong_phien', { p_phien_id: s.idPhien });
    if (res && res.success) {
      s.status = 'finished';
      s.ketQua = 'TU_DONG';
      bhShowToast('⏰ Phiên #' + s.num + ' đã tự đóng (quá 60 phút). Vui lòng điền kết quả.', null);
      bhRenderSessions();
      bhUpdateStats();
      // Reload lịch sử để phiên hiện trong list "cần điền"
      try { bhLoadStatsToday && bhLoadStatsToday(); } catch(e){}
    }
  } catch(e) {
    console.warn('[BH] Auto-close error:', e);
    s._autoClosing = false; // cho phép retry
  }
}

// [v9.0/v13.55] Modal khi bị chặn mở phiên mới vì còn phiên tự đóng chưa điền.
//   Query TRỰC TIẾP đơn TỰ ĐÓNG chưa điền trong 7 ngày (không phụ thuộc list đã load).
async function bhShowPhienCanDienModal(soPhien) {
  const today = new Date();
  const hnStr = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  const _from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const ngay7 = _from.getFullYear()+'-'+String(_from.getMonth()+1).padStart(2,'0')+'-'+String(_from.getDate()).padStart(2,'0');
  let phienCanDien = [];
  try {
    const { data, error } = await supa.from('phien_ban_hang')
      .select('id, stt_trong_ngay, gio_mo, gio_dong, ngay')
      .eq('ma_ch', SESSION.cuaHangMa).eq('trang_thai', 'DA_DONG').eq('ket_qua', 'TU_DONG')
      .gte('ngay', ngay7).order('gio_mo', { ascending: false }).limit(50);
    if (!error && Array.isArray(data)) {
      const fmt = ts => { try { const d=new Date(ts); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); } catch(e){ return ''; } };
      phienCanDien = data.map(r => ({ idPhien: r.id, stt: r.stt_trong_ngay, gioBD: fmt(r.gio_mo), gioKT: fmt(r.gio_dong), ngay: r.ngay }));
    }
  } catch(e){ console.warn('[BH] load phiên cần điền:', e); }
  BH._phienCanDienList = phienCanDien;  // lưu cho modal con dùng

  let listHtml;
  if (phienCanDien.length) {
    listHtml = phienCanDien.map(p => {
      const nb = (p.ngay && p.ngay !== hnStr) ? ' · ' + String(p.ngay).split('-').reverse().slice(0,2).join('/') : '';
      return `
      <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div>
          <div style="font-size:13px;font-weight:600;color:#9A3412">Phiên #${p.stt} · ${p.gioBD} → ${p.gioKT}${nb}</div>
          <div style="font-size:11px;color:#C2410C;margin-top:2px">Đã quá 60 phút, tự đóng</div>
        </div>
        <button onclick="bhMoModalDienKetQua('${p.idPhien}')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">Điền kết quả</button>
      </div>`;
    }).join('');
  } else {
    listHtml = '<div style="text-align:center;color:var(--text-m);font-size:12px;padding:14px">Không còn phiên tự đóng nào cần điền (có thể đã được xử lý ở thiết bị khác).</div>';
  }
  const modal = document.createElement('div');
  modal.id = 'bh-can-dien-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;width:100%;max-width:420px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column">
      <div style="padding:16px 18px;border-bottom:1px solid #F3F4F6">
        <div style="font-size:15px;font-weight:700;color:#9A3412">⏰ Còn ${phienCanDien.length || soPhien} phiên chưa điền kết quả</div>
        <div style="font-size:12px;color:var(--text-m);margin-top:4px;line-height:1.5">Phải điền kết quả (Mua/Chưa mua) hoặc gửi yêu cầu xóa cho phiên cũ trước khi mở phiên mới.</div>
      </div>
      <div style="padding:14px 18px;overflow-y:auto">${listHtml}</div>
      <div style="padding:12px 18px;border-top:1px solid #F3F4F6;text-align:right">
        <button onclick="document.getElementById('bh-can-dien-modal').remove()" style="background:#E5E7EB;color:var(--text);border:none;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer">Đóng</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// [v9.0] Mở modal điền kết quả cho phiên tự đóng
function bhMoModalDienKetQua(phienId) {
  const p = (BH._phienCanDienList || []).find(x => x.idPhien === phienId)
         || (BH.historyToday || []).find(x => x.idPhien === phienId)
         || (BH.historyTuDongCu || []).find(x => x.idPhien === phienId);
  if (!p) { bhShowToast('Không tìm thấy phiên', null); return; }
  // Đóng modal cha nếu đang mở
  const cur = document.getElementById('bh-can-dien-modal');
  if (cur) cur.remove();
  // Mở modal nhỏ chọn Mua / Chưa mua
  const modal = document.createElement('div');
  modal.id = 'bh-dien-kq-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;width:100%;max-width:400px;overflow:hidden">
      <div style="padding:16px 18px;border-bottom:1px solid #F3F4F6">
        <div style="font-size:15px;font-weight:700">Điền kết quả phiên #${p.stt}</div>
        <div style="font-size:12px;color:var(--text-m);margin-top:3px">${p.gioBD} → ${p.gioKT}</div>
      </div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:10px">
        <button onclick="bhDienKetQuaPhien('${phienId}','MUA')" style="background:var(--green);color:#fff;border:none;border-radius:10px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">✓ Khách đã mua</button>
        <button onclick="bhDienKetQuaPhien('${phienId}','CHUA_MUA')" style="background:#fff;color:var(--red);border:1.5px solid var(--red);border-radius:10px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">✗ Khách chưa mua</button>
        <button onclick="bhYCXoaTuModal('${phienId}')" style="background:#FFF7ED;color:#9A3412;border:1px solid #FDBA74;border-radius:10px;padding:11px;font-size:12px;font-weight:600;cursor:pointer;margin-top:4px">🗑 Gửi yêu cầu xóa phiên này</button>
        <button onclick="document.getElementById('bh-dien-kq-modal').remove()" style="background:transparent;color:var(--text-m);border:none;padding:8px;font-size:12px;cursor:pointer">Huỷ</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// [v9.0] Gọi RPC cập nhật kết quả phiên đã tự đóng
async function bhDienKetQuaPhien(phienId, ketQua) {
  let lyDo = null;
  if (ketQua === 'CHUA_MUA') {
    lyDo = prompt('Lý do khách chưa mua (tuỳ chọn):') || null;
  }
  try {
    const { data: res, error } = await supa.rpc('fn_bh_capnhat_ket_qua_sau_tu_dong', {
      p_phien_id: phienId,
      p_ma_nguoi_cap_nhat: SESSION.ma,
      p_ket_qua: ketQua,
      p_ly_do_khong_mua: lyDo,
    });
    if (error || !res || !res.success) {
      bhShowToast('Lỗi: ' + ((res && res.error) || (error && error.message) || 'Không cập nhật được'), null);
      return;
    }
    document.getElementById('bh-dien-kq-modal')?.remove();
    bhShowToast('✓ Đã ghi nhận kết quả', 'success');
    try { bhLoadStatsToday && bhLoadStatsToday(); } catch(e){}
  } catch(e) {
    bhShowToast('Lỗi kết nối', null);
  }
}

// [v9.45] Gửi YC xóa cho phiên tự đóng (từ modal điền kết quả)
async function bhYCXoaTuModal(phienId) {
  const ok = await appConfirm('Gửi yêu cầu xóa phiên #' + (phienId.slice(-4)) + ' lên QLBH?', {
    title: 'Yêu cầu xóa phiên tự đóng',
    okLabel: 'Gửi yêu cầu',
    danger: false
  });
  if (!ok) return;
  try {
    const { data: d, error } = await supa.rpc('fn_bh_yc_xoa_phien', {
      p_phien_id: phienId,
      p_ma_nguoi_yc: SESSION.ma || SESSION.cuaHangMa,
      p_ly_do: 'Phiên tự đóng quá 60 phút',
    });
    if (error || !(d && d.success)) {
      bhShowToast('Lỗi: ' + ((d && d.error) || (error && error.message) || 'Không gửi được'), null);
      return;
    }
    document.getElementById('bh-dien-kq-modal')?.remove();
    bhShowToast('✓ Đã gửi yêu cầu xóa - chờ QLBH', 'success');
    try { bhLoadStatsToday && bhLoadStatsToday(); } catch(e){}
  } catch(e) {
    bhShowToast('Lỗi kết nối', null);
  }
}

// [v11.7 fix centi] Dùng requestAnimationFrame cho centi mượt thay setInterval
// RAF tự động sync với refresh rate của màn hình → ổn định hơn setInterval
let _bhTickRAF = null;
let _bhLastTick = 0;
function bhStartTickLoop() {
  if (_bhTickRAF) return; // đã chạy
  function loop(now) {
    // Throttle ~50ms (20fps - đủ mượt cho centi đổi)
    if (now - _bhLastTick >= 50) {
      bhTickTimers();
      _bhLastTick = now;
    }
    _bhTickRAF = requestAnimationFrame(loop);
  }
  _bhTickRAF = requestAnimationFrame(loop);
}

// ─── BẮT ĐẦU PHIÊN ──────────────────────────────────────────
async function bhBatDauPhien(e) {
  // [v11.7+] CHẶN keyboard activation (Enter/Space) khi nút có focus
  // Trên PC, sau khi user click nút khác rồi gõ Enter có thể trigger lại nút này
  if (e && e.detail === 0 && e.type === 'click') {
    // event.detail === 0 => không phải mouse click thật, mà do keyboard activation
    console.log('[BH] Bỏ qua click không phải từ chuột (keyboard activation)');
    return;
  }
  // [v11.7 fix] Lock IMMEDIATELY trước khi làm gì khác - chống double-click PC chắc chắn
  if (BH._batDauPhienLock) {
    console.log('[BH] Bỏ qua click - đang xử lý phiên trước');
    return;
  }
  if (!SESSION || !SESSION.cuaHangMa) {
    bhShowToast('Thiếu thông tin cửa hàng', null);
    return;
  }
  BH._batDauPhienLock = true;
  // Disable button visual để user thấy đang xử lý
  const btn = document.querySelector('.bh-btn-primary');
  if (btn) {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
  }
  // Cooldown 2 giây (thay vì 1) - đủ thời gian cho server trả về
  setTimeout(() => {
    BH._batDauPhienLock = false;
    if (btn) {
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    }
  }, 2000);

  // [v11.8] LUÔN hỏi confirm trước khi tạo phiên - chống tap đôi/nhầm
  const dangBan = BH.sessions.filter(s => s.status === 'selling').length;
  const confirmText = dangBan >= 3
    ? `Hiện đã có ${dangBan} phiên đang bán. Tạo thêm phiên mới?`
    : (dangBan > 0
      ? `Bắt đầu phiên bán mới? (đang có ${dangBan} phiên)`
      : 'Bắt đầu phiên bán mới?');
  const ok = await appConfirm(confirmText, {
    title: 'Khách mới vào',
    okLabel: '+ Tạo phiên',
    cancelLabel: 'Hủy',
    danger: false
  });
  if (!ok) {
    // Release lock + restore button ngay
    BH._batDauPhienLock = false;
    if (btn) {
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    }
    return;
  }

  bhVibrate(20);
  // [v11.7 BH-1] Tone E5 hài hòa
  bhPlayBeep(659, 800);

  BH.counterToday++;
  const tempId = 'temp_' + Date.now();
  const tempSession = {
    idPhien: tempId,
    num: BH.counterToday,
    sttToanCuc: 0,
    startMs: Date.now(),
    products: [],
    nv: null,           // [v11.7 BH-3] NV chưa chọn lúc đầu
    status: 'selling',
    syncing: true
  };
  BH.sessions.push(tempSession);
  bhRenderSessions();
  bhUpdateStats();

  try {
    // [v12-P1] Supabase RPC thay vì Apps Script
    // Idempotency key = tempId để tránh tạo trùng nếu network retry
    const { data, error } = await supa.rpc('fn_bh_mo_phien', {
      p_ma_ch: SESSION.cuaHangMa,
      p_ma_nv: SESSION.vaiTro === 'CUA_HANG' ? null : SESSION.ma,
      p_ten_nv: SESSION.vaiTro === 'CUA_HANG' ? null : SESSION.ten,
      p_idempotency_key: tempId,
      p_device_info: navigator.userAgent.substring(0, 200),
    });
    if (error) throw error;
    const d = data || {};
    if (d.success) {
      tempSession.idPhien = d.idPhien;
      tempSession.num = d.stt;
      tempSession.sttToanCuc = d.sttToanCuc || 0;
      tempSession.syncing = false;
      if (d.gioMo) {
        try { tempSession.startMs = new Date(d.gioMo).getTime(); } catch(e){}
      }
      const card = document.querySelector('[data-sid="' + tempId + '"]');
      if (card) card.dataset.sid = d.idPhien;
      bhRenderSessions();
    } else {
      BH.sessions = BH.sessions.filter(s => s.idPhien !== tempId);
      bhRenderSessions();
      console.error('[BH] Tạo phiên thất bại:', d);
      // [v9.0] Nếu bị chặn vì còn phiên cần điền kết quả → mở modal hướng dẫn
      if (d.block_reason === 'PHIEN_CAN_DIEN') {
        bhShowPhienCanDienModal(d.so_phien_can_dien || 1);
      } else {
        bhShowToast('Lỗi: ' + (d.error || 'Không tạo được phiên'), null);
      }
    }
  } catch(e) {
    BH.sessions = BH.sessions.filter(s => s.idPhien !== tempId);
    bhRenderSessions();
    console.error('[BH] Network error khi tạo phiên:', e);
    bhShowToast('Mất kết nối. Vui lòng thử lại.', null);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════════════
function bhOpenModal(name) {
  document.getElementById('bh-md-' + name).classList.add('show');
  document.getElementById('bh-md-' + name + '-bd').classList.add('show');
  BH.currentModal = name;
  document.getElementById('bh-md-' + name + '-bd').onclick = () => bhCloseModal(name);
}
function bhCloseModal(name) {
  document.getElementById('bh-md-' + name).classList.remove('show');
  document.getElementById('bh-md-' + name + '-bd').classList.remove('show');
  BH.currentModal = null;
}

// ═══════════════════════════════════════════════════════════════════
// MODAL: SP QUAN TÂM (đầu phiên)
// ═══════════════════════════════════════════════════════════════════

let _bhSpSearchTimer = null;

function bhOpenSpModal(sid) {
  BH.currentSessionId = sid;
  const s = BH.sessions.find(x => x.idPhien === sid);
  if (!s) return;
  BH.tempProducts = [...s.products];
  document.getElementById('bh-md-sp-sub').textContent = 'Phiên #' + s.num;
  document.getElementById('bh-sp-search').value = '';
  bhRenderSpListLocal('bh-sp-list', '', 'bhToggleSpQuanTam', BH.tempProducts);
  bhRenderSpSelectedQT();
  bhOpenModal('sp');
  setTimeout(() => document.getElementById('bh-sp-search').focus(), 300);
  document.getElementById('bh-sp-search').oninput = function(e) {
    clearTimeout(_bhSpSearchTimer);
    _bhSpSearchTimer = setTimeout(() => bhRenderSpListLocal('bh-sp-list', e.target.value, 'bhToggleSpQuanTam', BH.tempProducts), 100);
  };
}

// [v11.2 BH-04] Render từ local cache, fallback server nếu chưa có cache
async function bhRenderSpListLocal(containerId, query, toggleFn, selectedList) {
  const list = document.getElementById(containerId);
  query = String(query || '').trim();

  // Fallback nếu chưa có cache
  if (!BH.spList.length) {
    list.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-m);font-size:13px">⏳ Đang tải SP...</div>';
    await bhLoadSpData();
    if (!BH.spList.length) {
      list.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-m);font-size:13px">Không tải được dữ liệu SP. Kiểm tra mạng?</div>';
      return;
    }
  }

  // [v11.7 BH-4] Khi query rỗng - ẩn list (không hiện dòng hint thừa)
  if (query.length < 1) {
    list.innerHTML = '';
    list.style.display = 'none';
    return;
  }
  list.style.display = '';

  const items = bhSearchSpLocal(query, 20);
  if (!items.length) {
    list.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-m);font-size:13px">Không tìm thấy</div>';
    return;
  }
  const selSet = new Set(selectedList || []);
  list.innerHTML = items.map(p => {
    const sel = selSet.has(p.maCu);
    const gia = (p.giaSale > 0) ? p.giaSale : p.giaNY;
    return `
      <div class="bh-sp-item ${sel ? 'selected' : ''}" onclick="${toggleFn}('${bhEscHtml(p.maCu)}')">
        <div class="bh-sp-name">${bhEscHtml(p.ten)}</div>
        <div class="bh-sp-meta">
          <span class="sku">${bhEscHtml(p.maThamChieu || p.maCu)}</span>
          ${gia > 0 ? '<span class="price">' + bhFormatMoney(gia) + 'đ</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

// [v11.7 BH-6] Render SP quan tâm dạng list dọc - mỗi SP 1 dòng đầy đủ thông tin
function bhRenderSpSelectedQT() {
  const wrap = document.getElementById('bh-sp-selected');
  if (!wrap) return;
  if (!BH.tempProducts.length) {
    wrap.innerHTML = '<div class="bh-selected-empty">Chưa chọn sản phẩm</div>';
    return;
  }
  wrap.innerHTML = BH.tempProducts.map(maCu => {
    const sp = (BH.spCache && BH.spCache[maCu]) || BH_SP_CACHE[maCu];
    const ten = sp ? sp.ten : maCu;
    const ma  = sp ? (sp.maThamChieu || sp.maCu) : maCu;
    const gia = sp ? ((sp.giaSale > 0) ? sp.giaSale : (sp.giaNY || 0)) : 0;
    return `
      <div class="bh-selected-item">
        <div class="bh-selected-item-main">
          <div class="bh-selected-item-name">${bhEscHtml(ten)}</div>
          <div class="bh-selected-item-meta">Mã: <strong>${bhEscHtml(ma)}</strong></div>
        </div>
        <button class="bh-selected-rm" onclick="bhToggleSpQuanTam('${bhEscHtml(maCu)}')" title="Bỏ chọn">×</button>
      </div>`;
  }).join('');
}

function bhToggleSpQuanTam(maCu) {
  const i = BH.tempProducts.indexOf(maCu);
  if (i >= 0) BH.tempProducts.splice(i, 1);
  else BH.tempProducts.push(maCu);
  bhRenderSpSelectedQT();
  // [v11.7 BH-5] Sau khi thêm 1 SP - clear ô search + ẩn list để user gõ tìm SP tiếp
  const searchInp = document.getElementById('bh-sp-search');
  if (searchInp) {
    searchInp.value = '';
    searchInp.focus();
  }
  const list = document.getElementById('bh-sp-list');
  if (list) {
    list.innerHTML = '';
    list.style.display = 'none';
  }
}

async function bhSpConfirm() {
  const s = BH.sessions.find(x => x.idPhien === BH.currentSessionId);
  if (s) {
    s.products = [...BH.tempProducts];
    bhRenderSessions();
    try {
      // [v12-P1] Supabase RPC
      await supa.rpc('fn_bh_update_sp_quan_tam', {
        p_phien_id: s.idPhien,
        p_sp_quan_tam: s.products,
      });
    } catch(e){
      console.error('[BH update SP]', e);
    }
  }
  bhCloseModal('sp');
}

// ═══════════════════════════════════════════════════════════════════
// [v11.2 BH-10] MODAL: KẾT THÚC - ĐÃ MUA (NEW)
// Form 4 trường: Nhân viên / Sản phẩm với qty / Ghi chú bắt buộc / (auto: tổng giá trị)
// ═══════════════════════════════════════════════════════════════════

// [v11.7 BH-3] Cache NV toàn hệ thống (load 1 lần trong session, search theo tên/mã)
let _bhNvCacheAll = null; // [{ma, ten, cuaHang, khuVuc}]
let _bhBoughtSpSearchTimer = null;

// Helper: load NV toàn hệ thống (1 lần) — [v12-P1] Supabase
async function bhLoadAllNV() {
  if (_bhNvCacheAll) return _bhNvCacheAll;
  try {
    // Pagination để không bị giới hạn 1000 dòng default
    const allRows = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: rows, error } = await supa
        .from('nhan_vien')
        .select('ma_nv, ho_ten, khu_vuc, ten_ch_snapshot, ma_ch_mac_dinh')
        .eq('trang_thai', 'ACTIVE')
        .order('ho_ten', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!rows || !rows.length) break;
      allRows.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
      if (offset > 5000) break;
    }
    _bhNvCacheAll = allRows.map(r => ({
      ma:       r.ma_nv,
      ten:      r.ho_ten,
      khuVuc:   r.khu_vuc || '',
      cuaHang:  r.ten_ch_snapshot || r.ma_ch_mac_dinh || '',
    }));
  } catch(e) {
    console.error('[BH NV all]', e);
    _bhNvCacheAll = [];
  }
  return _bhNvCacheAll;
}

async function bhOpenBoughtModal(sid) {
  BH.currentSessionId = sid;
  const s = BH.sessions.find(x => x.idPhien === sid);
  if (!s) return;

  // [v11.2 BH-10c] Pre-fill SP từ SP quan tâm với qty=1
  BH.tempItems = s.products.map(maCu => ({ maCu, qty: 1 }));
  // [v11.7 BH-3] Pre-fill NV nếu phiên đã có NV nhập sẵn từ đầu phiên
  BH.tempBoughtNV = s.nv ? { ma: s.nv.ma, ten: s.nv.ten } : null;

  document.getElementById('bh-md-bought-sub').textContent = 'Phiên #' + s.num;
  const nvInp = document.getElementById('bh-bought-nv-input');
  const nvInfo = document.getElementById('bh-bought-nv-info');
  if (BH.tempBoughtNV) {
    nvInp.value = BH.tempBoughtNV.ma;
    nvInfo.innerHTML = '<span style="color:var(--green);font-size:12px;font-weight:500">✓ ' + bhEscHtml(BH.tempBoughtNV.ten) + '</span>';
  } else {
    nvInp.value = '';
    nvInfo.innerHTML = '<span style="color:var(--text-lt);font-size:12px">Chưa chọn nhân viên</span>';
  }
  document.getElementById('bh-bought-search').value = '';
  document.getElementById('bh-bought-note').value = '';
  // [v11.7 BH-4] Không hiện dòng hint thừa
  const boughtList = document.getElementById('bh-bought-list');
  boughtList.innerHTML = '';
  boughtList.style.display = 'none';
  bhRenderBoughtSelected();
  bhRenderBoughtTotal();
  bhUpdateBoughtConfirmBtn();

  // [v11.7 BH-3] Load NV toàn hệ thống (cache lifetime của session)
  await bhLoadAllNV();

  bhOpenModal('bought');

  // NV input handler (dùng lại biến nvInp đã khai báo phía trên)
  nvInp.oninput = bhRenderNvSuggest;
  nvInp.onfocus = bhRenderNvSuggest;
  nvInp.onblur = function() { setTimeout(() => {
    const sg = document.getElementById('bh-bought-nv-sug');
    if (sg) sg.style.display = 'none';
  }, 250); };

  // SP search handler
  document.getElementById('bh-bought-search').oninput = function(e) {
    clearTimeout(_bhBoughtSpSearchTimer);
    _bhBoughtSpSearchTimer = setTimeout(() => bhRenderSpListLocal('bh-bought-list', e.target.value, 'bhAddBoughtSp',
      BH.tempItems.map(it => it.maCu)), 100);
  };
}

// [v11.7 BH-3] Modal chọn NV cho phiên (đầu phiên, từ chip trên card)
async function bhOpenSessionNVModal(sid) {
  BH.currentSessionNVId = sid;
  const s = BH.sessions.find(x => x.idPhien === sid);
  if (!s) return;
  BH.tempSessionNV = s.nv ? { ma: s.nv.ma, ten: s.nv.ten } : null;
  document.getElementById('bh-md-sessnv-sub').textContent = 'Phiên #' + s.num;
  const inp = document.getElementById('bh-sessnv-nv-input');
  if (BH.tempSessionNV) {
    inp.value = BH.tempSessionNV.ma;
    document.getElementById('bh-sessnv-nv-info').innerHTML =
      '<span style="color:var(--green);font-size:12px;font-weight:500">✓ ' + bhEscHtml(BH.tempSessionNV.ten) + '</span>';
  } else {
    inp.value = '';
    document.getElementById('bh-sessnv-nv-info').innerHTML = '<span style="color:var(--text-lt);font-size:12px">Chưa chọn nhân viên</span>';
  }
  bhUpdateSessNVConfirmBtn();
  await bhLoadAllNV();
  bhOpenModal('sessnv');
  inp.oninput = bhRenderSessNvSuggest;
  inp.onfocus = bhRenderSessNvSuggest;
  inp.onblur = function() { setTimeout(() => {
    const sg = document.getElementById('bh-sessnv-nv-sug');
    if (sg) sg.style.display = 'none';
  }, 250); };
  setTimeout(() => inp.focus(), 300);
}
function bhRenderSessNvSuggest() {
  _bhRenderNvSuggestGeneric('sessnv', 'bhSelectSessNV');
}
function bhSelectSessNV(ma, ten) {
  // [v11.7 fix] Click chọn = chọn luôn, đóng modal, gửi server ngầm
  // Không cần nút Xác nhận nữa
  BH.tempSessionNV = { ma, ten };
  const s = BH.sessions.find(x => x.idPhien === BH.currentSessionNVId);
  if (!s) {
    bhCloseModal('sessnv');
    return;
  }
  s.nv = { ma, ten };
  bhRenderSessions();
  bhCloseModal('sessnv');
  // [v12-P1] Supabase RPC ngầm
  try {
    supa.rpc('fn_bh_update_nv_phien', {
      p_phien_id: s.idPhien,
      p_ma_nv: ma,
      p_ten_nv: ten,
    });
  } catch(e){}
  bhShowToast('✓ Đã chọn ' + ten, 'success');
}
function bhUpdateSessNVConfirmBtn() {
  // [v11.7 fix] Không còn nút Xác nhận - hàm này giữ no-op để tương thích
}
async function bhSessionNVConfirm() {
  // [v11.7 fix] Không còn dùng - bhSelectSessNV đã chọn luôn
}

// [v11.7 BH-3] Helper search NV chung - dùng cho đầu phiên, Đã mua, Chưa mua
// suffix = 'bought' | 'notbought' | 'session' (cho mỗi ô input riêng)
function _bhRenderNvSuggestGeneric(suffix, onSelectFn) {
  const inp = document.getElementById('bh-' + suffix + '-nv-input');
  const sug = document.getElementById('bh-' + suffix + '-nv-sug');
  if (!inp || !sug || !_bhNvCacheAll) return;
  const q = inp.value.trim().toUpperCase();
  let matched;
  if (!q) {
    matched = _bhNvCacheAll.slice(0, 10);
  } else {
    matched = _bhNvCacheAll.filter(nv =>
      nv.ma.toUpperCase().indexOf(q) >= 0 || nv.ten.toUpperCase().indexOf(q) >= 0
    ).slice(0, 12);
  }
  if (!matched.length) {
    sug.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--text-m)">Không có NV nào khớp</div>';
    sug.style.display = 'block';
    return;
  }
  // [v11.7 fix mobile] Dùng onpointerdown (mouse + touch unified) thay onmousedown
  // Tránh tên NV có dấu ' phá syntax: dùng JSON.stringify để escape an toàn
  sug.innerHTML = matched.map(nv => {
    const maJs = JSON.stringify(nv.ma || '');
    const tenJs = JSON.stringify(nv.ten || '');
    return `<div class="bh-nv-sug-item" onpointerdown="event.preventDefault();${onSelectFn}(${maJs.replace(/"/g, '&quot;')},${tenJs.replace(/"/g, '&quot;')})">
      <span style="font-weight:600;color:var(--text)">${bhEscHtml(nv.ma)}</span>
      <span style="font-size:13px;color:var(--text-m);margin-left:6px">${bhEscHtml(nv.ten)}</span>
      ${nv.cuaHang ? '<span style="font-size:10px;color:var(--text-lt);margin-left:6px">· ' + bhEscHtml(nv.cuaHang) + '</span>' : ''}
    </div>`;
  }).join('');
  sug.style.display = 'block';
}

function bhRenderNvSuggest() {
  _bhRenderNvSuggestGeneric('bought', 'bhSelectNV');
}

function bhSelectNV(ma, ten) {
  BH.tempBoughtNV = { ma, ten };
  document.getElementById('bh-bought-nv-input').value = ma;
  document.getElementById('bh-bought-nv-info').innerHTML =
    '<span style="color:var(--green);font-size:12px;font-weight:500">✓ ' + bhEscHtml(ten) + '</span>';
  document.getElementById('bh-bought-nv-sug').style.display = 'none';
  bhUpdateBoughtConfirmBtn();
}

function bhAddBoughtSp(maCu) {
  // Nếu đã có → tăng qty
  const existing = BH.tempItems.find(it => it.maCu === maCu);
  if (existing) {
    existing.qty++;
  } else {
    BH.tempItems.push({ maCu, qty: 1 });
  }
  bhRenderBoughtSelected();
  bhRenderBoughtTotal();
  bhUpdateBoughtConfirmBtn();
  // [v11.7 BH-5] Sau khi thêm SP - clear ô search + ẩn list
  const searchInp = document.getElementById('bh-bought-search');
  if (searchInp) {
    searchInp.value = '';
    searchInp.focus();
  }
  const list = document.getElementById('bh-bought-list');
  if (list) {
    list.innerHTML = '';
    list.style.display = 'none';
  }
}

function bhChangeQty(maCu, delta) {
  const it = BH.tempItems.find(x => x.maCu === maCu);
  if (!it) return;
  it.qty += delta;
  if (it.qty <= 0) {
    BH.tempItems = BH.tempItems.filter(x => x.maCu !== maCu);
  }
  bhRenderBoughtSelected();
  bhRenderBoughtTotal();
  bhUpdateBoughtConfirmBtn();
  const q = document.getElementById('bh-bought-search').value;
  if (q) bhRenderSpListLocal('bh-bought-list', q, 'bhAddBoughtSp', BH.tempItems.map(it => it.maCu));
}

function bhRemoveBoughtSp(maCu) {
  BH.tempItems = BH.tempItems.filter(x => x.maCu !== maCu);
  bhRenderBoughtSelected();
  bhRenderBoughtTotal();
  bhUpdateBoughtConfirmBtn();
}

// [v11.2 BH-10d] Render với +/− qty
function bhRenderBoughtSelected() {
  const wrap = document.getElementById('bh-bought-selected');
  if (!wrap) return;
  if (!BH.tempItems.length) {
    wrap.innerHTML = '<div class="bh-selected-empty">Chưa chọn SP đã mua</div>';
    return;
  }
  // [v11.7 BH-6] List dọc, mỗi SP 1 dòng đầy đủ thông tin (tên không bị cắt)
  wrap.innerHTML = BH.tempItems.map(it => {
    const sp = (BH.spCache && BH.spCache[it.maCu]) || BH_SP_CACHE[it.maCu];
    const ten = sp ? sp.ten : it.maCu;
    const ma  = sp ? (sp.maThamChieu || sp.maCu) : it.maCu;
    const gia = bhGiaSP(it.maCu);
    const subtotal = gia * it.qty;
    return `
      <div class="bh-selected-item bh-selected-item-bought">
        <div class="bh-selected-item-main">
          <div class="bh-selected-item-name">${bhEscHtml(ten)}</div>
          <div class="bh-selected-item-meta">Mã: <strong>${bhEscHtml(ma)}</strong></div>
          <div class="bh-bought-item-row">
            <button class="bh-qty-btn" onclick="bhChangeQty('${bhEscHtml(it.maCu)}',-1)">−</button>
            <span class="bh-qty-num">${it.qty}</span>
            <button class="bh-qty-btn" onclick="bhChangeQty('${bhEscHtml(it.maCu)}',1)">+</button>
          </div>
        </div>
        <button class="bh-selected-rm" onclick="bhRemoveBoughtSp('${bhEscHtml(it.maCu)}')">×</button>
      </div>
    `;
  }).join('');
}

function bhRenderBoughtTotal() {
  // [v16.0] Bỏ hiển thị tổng tiền (doanh thu) — giá chưa trừ KM/chiết khấu nên không phản ánh đúng
  const el = document.getElementById('bh-bought-total');
  if (el) {
    el.textContent = '';
    const wrap = el.closest('.bh-bought-total-bar') || el.closest('.bh-bought-total-wrap') || el.parentElement;
    if (wrap) wrap.style.display = 'none';
  }
}

function bhUpdateBoughtConfirmBtn() {
  // [v11.7 perf] Debounce
  if (BH._boughtBtnTimer) clearTimeout(BH._boughtBtnTimer);
  BH._boughtBtnTimer = setTimeout(() => {
    const btn = document.getElementById('bh-bought-confirm-btn');
    if (!btn) return;
    const note = document.getElementById('bh-bought-note').value.trim();
    const ok = !!BH.tempBoughtNV && BH.tempItems.length > 0 && note.length > 0;
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.5';
  }, 80);
}

async function bhBoughtConfirm() {
  const s = BH.sessions.find(x => x.idPhien === BH.currentSessionId);
  if (!s) return;

  // [v11.1 BH-06] Chặn race condition
  if (s.syncing || String(s.idPhien).startsWith('temp_')) {
    bhShowToast('Phiên đang đồng bộ, vui lòng đợi 1-2 giây...', null);
    return;
  }
  if (s.status !== 'selling') {
    bhShowToast('Phiên này đã kết thúc trước đó.', null);
    bhCloseModal('bought');
    return;
  }

  // Validate
  if (!BH.tempBoughtNV) {
    bhShowToast('Vui lòng nhập mã nhân viên', null);
    return;
  }
  if (!BH.tempItems.length) {
    bhShowToast('Vui lòng chọn ít nhất 1 sản phẩm', null);
    return;
  }
  const note = document.getElementById('bh-bought-note').value.trim();
  if (!note) {
    bhShowToast('Vui lòng nhập ghi chú (khách hàng phản hồi thế nào?)', null);
    return;
  }

  // [v11.7+ fix] Finalize UI NGAY - không đợi server
  // Status='finished' → bhTickTimers skip → timer dừng. Render xong là card biến mất.
  const sid = s.idPhien;
  const items = [...BH.tempItems];
  const nv = { ma: BH.tempBoughtNV.ma, ten: BH.tempBoughtNV.ten };

  s.status = 'finished';
  BH.statsToday.bought++;
  bhRenderSessions();
  bhUpdateStats();
  bhCloseModal('bought');
  bhPlayBeep(784, 900);
  bhVibrate(50);

  // Tổng giá trị từ items
  let total = 0;
  items.forEach(it => total += bhGiaSP(it.maCu) * it.qty);
  const undoFn = async () => {
    // Hoàn tác: chỉ chạy được nếu server đã nhận → có request hoan_tac
    try {
      const { data: d2, error } = await supa.rpc('fn_bh_hoan_tac_phien', { p_phien_id: sid });
      if (!error && d2 && d2.success) {
        s.status = 'selling';
        BH.statsToday.bought--;
        bhRenderSessions();
        bhUpdateStats();
        bhShowToast('Đã hoàn tác', null);
      } else if (d2 && d2.error) {
        bhShowToast('Không hoàn tác được: ' + d2.error, null);
      }
    } catch(e) {}
  };
  bhShowToast('✓ Phiên #' + s.num + ' - Đã mua', 'success', undoFn);

  // Gửi server NGẦM với retry (3 lần)
  bhSendKtPhienWithRetry({
    action: 'kt_phien_mua',
    idPhien: sid,
    maNV: nv.ma,
    tenNV: nv.ten,
    spDaMua: items,
    spQuanTam: s.products,
    ghiChu: note
  }, s, 'bought');
}

// [v12-P1] Helper: gửi kết thúc phiên với retry tự động qua Supabase RPC
// Payload format giữ nguyên cho code cũ tương thích
async function bhSendKtPhienWithRetry(payload, s, kind, retries) {
  retries = retries || 0;
  try {
    let data, error;
    if (payload.action === 'kt_phien_mua') {
      ({ data, error } = await supa.rpc('fn_bh_kt_phien_mua', {
        p_phien_id: payload.idPhien,
        p_ma_nv: payload.maNV || '',
        p_ten_nv: payload.tenNV || '',
        p_sp_da_mua: payload.spDaMua || [],
        p_sp_quan_tam: payload.spQuanTam || [],
        p_ghi_chu: payload.ghiChu || '',
      }));
    } else if (payload.action === 'kt_phien_khong_mua') {
      ({ data, error } = await supa.rpc('fn_bh_kt_phien_khong_mua', {
        p_phien_id: payload.idPhien,
        p_ly_do: payload.lyDo || '',
        p_sp_quan_tam: payload.spQuanTam || [],
        p_ghi_chu: payload.ghiChu || '',
        p_ma_nv: payload.maNV || '',
        p_ten_nv: payload.tenNV || '',
      }));
    } else {
      throw new Error('Action không hỗ trợ: ' + payload.action);
    }
    if (error) throw error;
    if (data && data.success) return;
    throw new Error((data && data.error) || 'Lỗi không xác định');
  } catch(e) {
    const msg = (e && e.message) || '';
    // [V3] Trigger chặn kết phiên khi đang YC xóa → không retry, toast rõ ràng
    if (msg.includes('yêu cầu xóa') || msg.includes('yeu cau xoa') || msg.includes('P0001')) {
      bhShowToast('⛔ ' + msg.replace(/^.*?:\s*/,''), null);
      // Mở khóa phiên trên UI để CH có thể hủy YC xóa hoặc chờ QLBH
      if (s) { s.syncing = false; bhRenderSessions(); }
      return;
    }
    console.error('[BH KT phiên] Lần ' + (retries+1) + ' thất bại:', e);
    if (retries < 3) {
      const delay = 2000 * Math.pow(2, retries);
      setTimeout(() => bhSendKtPhienWithRetry(payload, s, kind, retries + 1), delay);
    } else {
      bhQueueKtPhien(payload);
      bhShowToast('⚠ Không gửi được lên server. Đã lưu, sẽ gửi lại khi có mạng.', null);
    }
  }
}

// Queue local lưu các kt_phien chưa gửi được
function bhQueueKtPhien(payload) {
  try {
    const queue = JSON.parse(localStorage.getItem('bh_kt_queue') || '[]');
    queue.push({ payload, ts: Date.now() });
    localStorage.setItem('bh_kt_queue', JSON.stringify(queue));
  } catch(e) {}
}

// Resend queue khi tab visible / login
async function bhFlushKtQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem('bh_kt_queue') || '[]');
    if (!queue.length) return;
    const remaining = [];
    for (const item of queue) {
      try {
        const p = item.payload;
        let data, error;
        if (p.action === 'kt_phien_mua') {
          ({ data, error } = await supa.rpc('fn_bh_kt_phien_mua', {
            p_phien_id: p.idPhien,
            p_ma_nv: p.maNV || '',
            p_ten_nv: p.tenNV || '',
            p_sp_da_mua: p.spDaMua || [],
            p_sp_quan_tam: p.spQuanTam || [],
            p_ghi_chu: p.ghiChu || '',
          }));
        } else if (p.action === 'kt_phien_khong_mua') {
          ({ data, error } = await supa.rpc('fn_bh_kt_phien_khong_mua', {
            p_phien_id: p.idPhien,
            p_ly_do: p.lyDo || '',
            p_sp_quan_tam: p.spQuanTam || [],
            p_ghi_chu: p.ghiChu || '',
            p_ma_nv: p.maNV || '',
            p_ten_nv: p.tenNV || '',
          }));
        }
        if (error || !(data && data.success)) remaining.push(item);
      } catch(e) {
        remaining.push(item);
      }
    }
    localStorage.setItem('bh_kt_queue', JSON.stringify(remaining));
    if (queue.length > remaining.length) {
      console.log('[BH] Đã flush ' + (queue.length - remaining.length) + ' phiên trong queue');
    }
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════════
// [v11.2 BH-09] MODAL: CHƯA MUA — Bỏ "Chỉ xem tham khảo", đổi text, ghi chú bắt buộc
// ═══════════════════════════════════════════════════════════════════
async function bhOpenNotBoughtModal(sid) {
  BH.currentSessionId = sid;
  const s = BH.sessions.find(x => x.idPhien === sid);
  if (!s) return;
  BH.tempReason = null;
  // [v11.7 BH-3] Pre-fill NV nếu phiên đã có (từ đầu phiên)
  BH.tempNotBoughtNV = s.nv ? { ma: s.nv.ma, ten: s.nv.ten } : null;
  document.getElementById('bh-md-notbought-sub').textContent = 'Phiên #' + s.num;
  const nvInp = document.getElementById('bh-notbought-nv-input');
  const nvInfo = document.getElementById('bh-notbought-nv-info');
  if (BH.tempNotBoughtNV) {
    nvInp.value = BH.tempNotBoughtNV.ma;
    nvInfo.innerHTML = '<span style="color:var(--green);font-size:12px;font-weight:500">✓ ' + bhEscHtml(BH.tempNotBoughtNV.ten) + '</span>';
  } else {
    nvInp.value = '';
    nvInfo.innerHTML = '<span style="color:var(--text-lt);font-size:12px">Chưa chọn nhân viên</span>';
  }
  document.getElementById('bh-notbought-note').value = '';
  [...document.querySelectorAll('.bh-reason-item')].forEach(r => r.classList.remove('selected'));
  bhUpdateNotBoughtConfirmBtn();
  await bhLoadAllNV();
  bhOpenModal('notbought');

  // NV input handler
  nvInp.oninput = bhRenderNotBoughtNvSuggest;
  nvInp.onfocus = bhRenderNotBoughtNvSuggest;
  nvInp.onblur = function() { setTimeout(() => {
    const sg = document.getElementById('bh-notbought-nv-sug');
    if (sg) sg.style.display = 'none';
  }, 250); };
}
// [v11.7 BH-3] Render suggest cho input NV ở Chưa mua
function bhRenderNotBoughtNvSuggest() {
  _bhRenderNvSuggestGeneric('notbought', 'bhSelectNvNotBought');
}
function bhSelectNvNotBought(ma, ten) {
  BH.tempNotBoughtNV = { ma, ten };
  document.getElementById('bh-notbought-nv-input').value = ma;
  document.getElementById('bh-notbought-nv-info').innerHTML =
    '<span style="color:var(--green);font-size:12px;font-weight:500">✓ ' + bhEscHtml(ten) + '</span>';
  document.getElementById('bh-notbought-nv-sug').style.display = 'none';
  bhUpdateNotBoughtConfirmBtn();
}

function bhPickReason(el, reason) {
  [...document.querySelectorAll('.bh-reason-item')].forEach(r => r.classList.remove('selected'));
  el.classList.add('selected');
  BH.tempReason = reason;
  bhUpdateNotBoughtConfirmBtn();
}

function bhUpdateNotBoughtConfirmBtn() {
  // [v11.7 perf] Debounce 80ms để không gọi mỗi keystroke gây render-thrash
  if (BH._notBoughtBtnTimer) clearTimeout(BH._notBoughtBtnTimer);
  BH._notBoughtBtnTimer = setTimeout(() => {
    const btn = document.getElementById('bh-notbought-btn');
    if (!btn) return;
    const note = document.getElementById('bh-notbought-note').value.trim();
    const ok = !!BH.tempNotBoughtNV && !!BH.tempReason && note.length > 0;
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.5';
  }, 80);
}

async function bhNotboughtConfirm() {
  // [v11.7 BH-3] Validate NV
  if (!BH.tempNotBoughtNV) {
    bhShowToast('Vui lòng nhập mã nhân viên', null);
    return;
  }
  if (!BH.tempReason) {
    bhShowToast('Vui lòng chọn lý do', null);
    return;
  }
  const note = document.getElementById('bh-notbought-note').value.trim();
  if (!note) {
    bhShowToast('Vui lòng nhập ghi chú', null);
    return;
  }
  const s = BH.sessions.find(x => x.idPhien === BH.currentSessionId);
  if (!s) return;

  if (s.syncing || String(s.idPhien).startsWith('temp_')) {
    bhShowToast('Phiên đang đồng bộ, vui lòng đợi...', null);
    return;
  }
  if (s.status !== 'selling') {
    bhShowToast('Phiên này đã kết thúc trước đó.', null);
    bhCloseModal('notbought');
    return;
  }

  // [v11.7+ fix] Finalize UI NGAY - không đợi server
  const sid = s.idPhien;
  const reason = BH.tempReason;
  const nv = { ma: BH.tempNotBoughtNV.ma, ten: BH.tempNotBoughtNV.ten };

  s.status = 'finished';
  BH.statsToday.notBought++;
  bhRenderSessions();
  bhUpdateStats();
  bhCloseModal('notbought');
  bhPlayBeep(587, 700);
  bhVibrate(30);

  const undoFn = async () => {
    try {
      const { data: d2, error } = await supa.rpc('fn_bh_hoan_tac_phien', { p_phien_id: sid });
      if (!error && d2 && d2.success) {
        s.status = 'selling';
        BH.statsToday.notBought--;
        bhRenderSessions();
        bhUpdateStats();
        bhShowToast('Đã hoàn tác', null);
      } else if (d2 && d2.error) {
        bhShowToast('Không hoàn tác được: ' + d2.error, null);
      }
    } catch(e){}
  };
  bhShowToast('Phiên #' + s.num + ' - ' + reason.slice(0, 30), null, undoFn);

  // Gửi server NGẦM với retry
  bhSendKtPhienWithRetry({
    action: 'kt_phien_khong_mua',
    idPhien: sid,
    lyDo: reason,
    spQuanTam: s.products,
    ghiChu: note,
    maNV: nv.ma,
    tenNV: nv.ten,
  }, s, 'notbought');
}

// ═══════════════════════════════════════════════════════════════════
// VIEW QLBH (giữ logic v11, chỉnh để dùng maCu thay sku)
// ═══════════════════════════════════════════════════════════════════

function bhInitViewQLBH() {
  if (typeof CH_LIST !== 'undefined' && CH_LIST && CH_LIST.length) {
    const sel = document.getElementById('bh-ql-kv');
    const kvSet = new Set();
    CH_LIST.forEach(c => { if (c.khuVuc) kvSet.add(c.khuVuc); });
    const current = sel.value;
    sel.innerHTML = '<option value="">Tất cả khu vực</option>' + [...kvSet].sort().map(kv => `<option value="${bhEscHtml(kv)}">${bhEscHtml(kv)}</option>`).join('');
    if (current) sel.value = current;
  }

  const hn = new Date();
  const hnStr = hn.getFullYear() + '-' + bhPad(hn.getMonth()+1) + '-' + bhPad(hn.getDate());
  document.getElementById('bh-ql-tu').value = hnStr;
  document.getElementById('bh-ql-den').value = hnStr;
  BH.qlFilterTuNgay = hnStr;
  BH.qlFilterDenNgay = hnStr;

  BH.qlTab = 'live';
  bhQlSwitchTab('live', true);

  if (BH.qlAutoRefresh) clearInterval(BH.qlAutoRefresh);
  // [v12-P1] Backup polling 60s — chính chủ là Realtime sub bên dưới
  BH.qlAutoRefresh = setInterval(() => {
    if (BH.qlTab === 'live' && currentPage === 'banhang' && !document.querySelector('.bh-modal.show')) {
      bhQlReload();
    }
  }, 60000);
  // Realtime sub: nhận INSERT/UPDATE/DELETE từ DB ngay lập tức
  bhStartRealtimeSubQL();

  bhQlReload();
}

function bhQlSwitchTab(tab, noReload) {
  BH.qlTab = tab;
  ['live','history','dashboard'].forEach(t => {
    const btn = document.getElementById('bh-ql-tab-' + t);
    const content = document.getElementById('bh-ql-content-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
    if (content) content.style.display = (t === tab) ? '' : 'none';
  });
  const dr = document.getElementById('bh-ql-daterange');
  if (dr) dr.style.display = (tab === 'live') ? 'none' : 'block';
  if (!noReload) bhQlReload();
}

function bhQlDebouncedReload() {
  // [v11.7+ fix] Search CH instant client-side (không gọi server mỗi keystroke)
  // Chỉ debounce nhẹ 80ms để khỏi giật
  clearTimeout(BH.qlReloadTimer);
  BH.qlReloadTimer = setTimeout(() => {
    BH.qlFilterQ = document.getElementById('bh-ql-q').value.trim().toLowerCase();
    bhQlRenderHistory();
    bhQlRenderLive();
  }, 80);
}

// [v11.7+ fix] Render Live với filter q client-side
function bhQlRenderLive() {
  const liveEl = document.getElementById('bh-ql-content-live');
  if (!liveEl) return;
  let live = (BH.qlLastLive || []).slice();
  // [v11.8+] Filter chỉ phiên có YC xóa (khi user click thẻ "🗑 YC xóa")
  const sf = BH.qlStatusFilter || 'all';
  if (sf === 'yc') {
    live = live.filter(p => p.yeuCauXoa && p.yeuCauXoa.co);
  }
  const q = (BH.qlFilterQ || '').toLowerCase();
  if (q) {
    live = live.filter(p => {
      const hay = ((p.tenCH || '') + ' ' + (p.maCH || '') + ' ' + (p.tenNV || '') + ' ' + (p.spQuanTam || []).map(bhTenSP).join(' ')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  document.getElementById('bh-ql-count-live').textContent = live.length;
  if (!live.length) {
    let emptyMsg = 'Hiện không có phiên nào đang diễn ra';
    if (sf === 'yc') emptyMsg = 'Hiện không có yêu cầu xóa nào';
    else if (q) emptyMsg = 'Không tìm thấy CH/SP/NV nào khớp';
    liveEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-m);font-size:13px">' + emptyMsg + '</div>';
    return;
  }
  liveEl.innerHTML = live.map(p => {
    // [v5.1 fix BH-4] Dùng _gioMoIso (timestamp ISO đầy đủ có giây + ms)
    // KHÔNG dùng ngay+gioBD (chỉ HH:MM → mất giây → tất cả phiên cùng phút có startMs giống nhau)
    let startMs;
    try {
      startMs = p._gioMoIso ? new Date(p._gioMoIso).getTime() : new Date(p.ngay + 'T' + p.gioBD).getTime();
      if (isNaN(startMs)) startMs = Date.now();
    } catch(e){ startMs = Date.now(); }
    const elapsed = Math.floor((Date.now() - startMs) / 1000);
    const hot = elapsed >= 900 ? ' hot' : '';
    const sttTC = p.stt ? `<span class="bh-stt-tc">#${p.stt}</span>` : '';
    // [v11.8] Badge yêu cầu xóa
    const hasYC = p.yeuCauXoa && p.yeuCauXoa.co;
    const ycCls = hasYC ? ' has-yc' : '';
    const ycBadge = hasYC ? '<span class="bh-yc-card-badge">🗑 YC XÓA</span>' : '';
    return `
      <div class="bh-live-card${hot}${ycCls}" onclick="bhQlOpenDetail('${p.idPhien}')" data-start="${startMs}" data-live="1">
        <div class="bh-live-card-head">
          <div>
            <div class="bh-live-ch">${ycBadge}${sttTC}${bhEscHtml(p.tenCH)}</div>
            <div class="bh-live-ch-meta">${bhEscHtml(p.maCH)} · ${bhEscHtml(p.khuVuc || '')} · bắt đầu ${p.gioBD}${p.tenNV ? ' · NV: ' + bhEscHtml(p.tenNV) : ''}</div>
          </div>
          <div class="bh-live-timer" data-qltimer="${p.idPhien}">${bhFormatTimeShort(elapsed)}</div>
        </div>
        ${p.spQuanTam && p.spQuanTam.length ? '<div class="bh-live-sp">' + p.spQuanTam.map(maCu => '<span class="bh-chip">' + bhEscHtml(bhTenSP(maCu).slice(0, 22)) + '</span>').join('') + '</div>' : ''}
      </div>
    `;
  }).join('');

  // [v11.8] Hiển thị thanh xóa hàng loạt nếu có yêu cầu
  bhQlUpdateBulkBar(live);
}

// [v11.8] Cập nhật thanh hiển thị số yêu cầu xóa + nút xóa hàng loạt
function bhQlUpdateBulkBar(live) {
  const bar = document.getElementById('bh-ql-bulk-bar');
  if (!bar) return;
  const yc = live.filter(p => p.yeuCauXoa && p.yeuCauXoa.co);
  if (!yc.length) {
    bar.classList.remove('show');
    return;
  }
  bar.classList.add('show');
  // List CH có YC (unique)
  const chSet = {};
  yc.forEach(p => { chSet[p.maCH] = (chSet[p.maCH] || 0) + 1; });
  const chCount = Object.keys(chSet).length;
  document.getElementById('bh-ql-bulk-text').innerHTML =
    `<strong>${yc.length} phiên</strong> đã yêu cầu xóa từ <strong>${chCount} cửa hàng</strong>`;
}

// [v11.8] QLBH xóa hàng loạt phiên đã yêu cầu (theo KV được phép)
async function bhQlXoaHangLoat() {
  const live = BH.qlLastLive || [];
  const yc = live.filter(p => p.yeuCauXoa && p.yeuCauXoa.co);
  if (!yc.length) {
    bhShowToast('Không có yêu cầu xóa nào', null);
    return;
  }
  const ok1 = await appConfirm(`Xóa toàn bộ ${yc.length} phiên đã yêu cầu? Hành động không thể hoàn tác.`, {
    title: 'Xóa hàng loạt',
    okLabel: 'Xóa tất cả',
    danger: true
  });
  if (!ok1) return;
  const ok2 = await appConfirm(`Xác nhận lần cuối: xóa hẳn ${yc.length} phiên?`, {
    title: 'Xác nhận lần cuối',
    okLabel: 'Tôi đồng ý',
    danger: true
  });
  if (!ok2) return;

  // Optimistic UI: xóa khỏi list + DOM ngay
  const idList = yc.map(p => p.idPhien);
  BH.qlLastLive = (BH.qlLastLive || []).filter(p => !idList.includes(p.idPhien));
  idList.forEach(id => {
    const cards = document.querySelectorAll('[onclick*="' + id + '"]');
    cards.forEach(c => {
      c.style.transition = 'opacity .3s, transform .3s';
      c.style.opacity = '0';
      c.style.transform = 'scale(0.95)';
      setTimeout(() => { try { c.remove(); } catch(e){} }, 320);
    });
  });
  bhQlUpdateBulkBar(BH.qlLastLive);
  bhShowToast('✓ Đang xóa ' + yc.length + ' phiên...', 'success');

  // [v12-P1] Supabase RPC — [FIX BH-1] truyền danh sách ID cụ thể
  try {
    const { data: d, error } = await supa.rpc('fn_bh_xoa_hang_loat', {
      p_ma_nguoi_xoa: SESSION.ma,
      p_ids: idList,
    });
    if (!error && d && d.success) {
      bhShowToast('✓ Đã xóa ' + d.deleted + ' phiên', 'success');
    } else {
      bhShowToast('⚠ ' + ((d && d.error) || (error && error.message) || 'Lỗi xóa'), null);
      bhQlReload();
    }
  } catch(e) {
    bhShowToast('⚠ Mất kết nối', null);
  }
}

async function bhQlReload() {
  BH.qlFilterKV = document.getElementById('bh-ql-kv').value;
  // [v11.7+ fix] q lưu lowercase để filter client-side instant
  BH.qlFilterQ  = document.getElementById('bh-ql-q').value.trim().toLowerCase();
  if (BH.qlTab !== 'live') {
    BH.qlFilterTuNgay = document.getElementById('bh-ql-tu').value;
    BH.qlFilterDenNgay = document.getElementById('bh-ql-den').value;
  } else {
    const hn = new Date();
    const hnStr = hn.getFullYear() + '-' + bhPad(hn.getMonth()+1) + '-' + bhPad(hn.getDate());
    BH.qlFilterTuNgay = hnStr;
    BH.qlFilterDenNgay = hnStr;
  }

  if (BH.qlTab === 'dashboard') {
    await bhQlLoadDashboard();
  } else {
    await bhQlLoadPhien();
  }
}

// [v11.7 BH-7c/d] Filter status clickable + Sort options
function bhQlSetStatusFilter(filter) {
  // 'all' | 'live' | 'bought' | 'notbought' | 'yc'
  BH.qlStatusFilter = filter;
  // Update UI active state on stat cards
  ['all','live','bought','notbought','yc'].forEach(f => {
    const card = document.getElementById('bh-ql-stat-card-' + f);
    if (card) card.classList.toggle('active', f === filter);
  });
  // [v11.8+] Filter 'yc' áp dụng cho Live (vì YC chỉ trên phiên đang bán)
  // → tự động chuyển về tab Live nếu đang ở tab khác
  if (filter === 'yc' && BH.qlTab !== 'live') {
    bhQlSetTab('live');
    return; // bhQlSetTab sẽ trigger reload + render
  }
  bhQlRenderLive();
  bhQlRenderHistory();
}
function bhQlSetSort(sortBy) {
  BH.qlSort = sortBy;
  bhQlRenderHistory();
}

// Helper: build kvAllowed param
function _bhQlKVAllowedParam() {
  // Nếu vai trò là QLBH (full hệ thống) hoặc ADMIN → null = full
  // Nếu là QLBHHCM/MĐ/MT/TTN/HNTB → list KV
  if (!SESSION || !SESSION.bhKVList) return '';
  return '&kvAllowed=' + encodeURIComponent(JSON.stringify(SESSION.bhKVList));
}

async function bhQlLoadPhien() {
  try {
    // [v12] Auto đóng phiên quá 60 phút (DB tự xử lý, fire-and-forget)
    try { await supa.rpc('fn_bh_auto_close_phien'); } catch(e){}
    // [v12-P1] Query trực tiếp Supabase, build 2 query song song:
    //   live: phiên DANG_MO trong toàn hệ thống (theo KV nếu có)
    //   finished: phiên DA_DONG trong khoảng tu→den

    const kvFilter = BH.qlFilterKV || '';
    // kvAllowed: list KV nếu QLBH theo vùng cụ thể
    // [v12-fix] ADMIN: xem toàn HT, bỏ qua bhKVList
    const isAdminScope = SESSION && (SESSION.vaiTro === 'ADMIN');
    let kvAllowed = null;
    try {
      if (!isAdminScope && SESSION && SESSION.bhKVList && SESSION.bhKVList.length) {
        kvAllowed = SESSION.bhKVList;
      }
    } catch(e){}

    // Helper apply filter KV chung
    const applyKVFilter = (q) => {
      if (kvFilter) q = q.eq('khu_vuc', kvFilter);
      else if (kvAllowed) q = q.in('khu_vuc', kvAllowed);
      return q;
    };

    // 1) LIVE: DANG_MO toàn hệ thống (không filter ngày, vì đang chạy)
    let liveQ = supa.from('phien_ban_hang')
      .select('id, ma_ch, ten_ch_snapshot, khu_vuc, ma_nv, ten_nv_snapshot, gio_mo, ngay, stt_trong_ngay, stt_toan_cuc, sp_quan_tam_text, yeu_cau_xoa, ly_do_xoa, nguoi_yeu_cau_xoa, thoi_gian_yeu_cau_xoa')
      .eq('trang_thai', 'DANG_MO')
      .order('gio_mo', { ascending: false })
      .limit(500);
    liveQ = applyKVFilter(liveQ);
    const liveRes = await liveQ;
    if (liveRes.error) throw liveRes.error;

    // 2) FINISHED: DA_DONG trong khoảng tu→den
    // [v12-fix] ADMIN: lấy HẾT phiên (pagination), QLBH thường: limit 1000
    const isAdminBH = SESSION && (SESSION.vaiTro === 'ADMIN');
    const FIN_SELECT = 'id, ma_ch, ten_ch_snapshot, khu_vuc, ma_nv, ten_nv_snapshot, gio_mo, gio_dong, ngay, stt_trong_ngay, stt_toan_cuc, ket_qua, ly_do_khong_mua, tong_gia_tri, thoi_luong_phut, sp_quan_tam_text, sp_da_mua_text, ghi_chu';

    let finRes;
    if (isAdminBH) {
      // Pagination 1000/lần đến khi hết
      const PAGE = 1000;
      let from = 0, all = [], firstErr = null;
      while (true) {
        let q = supa.from('phien_ban_hang')
          .select(FIN_SELECT)
          .eq('trang_thai', 'DA_DONG')
          .order('gio_mo', { ascending: false })
          .range(from, from + PAGE - 1);
        if (BH.qlFilterTuNgay) q = q.gte('ngay', BH.qlFilterTuNgay);
        if (BH.qlFilterDenNgay) q = q.lte('ngay', BH.qlFilterDenNgay);
        q = applyKVFilter(q);
        const r = await q;
        if (r.error) { firstErr = r.error; break; }
        const rows = r.data || [];
        all = all.concat(rows);
        if (rows.length < PAGE) break;
        from += PAGE;
        if (from > 200000) break; // safety guard
      }
      finRes = { data: all, error: firstErr };
    } else {
      let finQ = supa.from('phien_ban_hang')
        .select(FIN_SELECT)
        .eq('trang_thai', 'DA_DONG')
        .order('gio_mo', { ascending: false })
        .limit(1000);
      if (BH.qlFilterTuNgay) finQ = finQ.gte('ngay', BH.qlFilterTuNgay);
      if (BH.qlFilterDenNgay) finQ = finQ.lte('ngay', BH.qlFilterDenNgay);
      finQ = applyKVFilter(finQ);
      finRes = await finQ;
    }
    if (finRes.error) throw finRes.error;

    // Helper format
    const fmtTime = ts => {
      if (!ts) return '';
      try { const d = new Date(ts); return bhPad(d.getHours()) + ':' + bhPad(d.getMinutes()); } catch(e){ return ''; }
    };
    const fmtThoiLuong = m => {
      if (!m) return '';
      const totalSec = Math.round(m * 60);
      return bhPad(Math.floor(totalSec / 60)) + ':' + bhPad(totalSec % 60);
    };
    const trangThaiText = ket_qua => {
      if (ket_qua === 'CHUA_MUA')   return 'Chưa mua';
      if (ket_qua === 'TU_DONG')    return 'Tự đóng';
      if (ket_qua === 'ADMIN_DONG') return 'Admin đã đóng';
      return 'Đã mua';
    };

    // Convert live → format frontend
    BH.qlLastLive = (liveRes.data || []).map(r => ({
      idPhien: r.id,
      maCH: r.ma_ch,
      tenCH: r.ten_ch_snapshot || r.ma_ch,
      khuVuc: r.khu_vuc || '',
      maNV: r.ma_nv,
      tenNV: r.ten_nv_snapshot,
      gioBD: fmtTime(r.gio_mo),
      ngay: r.ngay,
      stt: r.stt_trong_ngay,
      sttToanCuc: r.stt_toan_cuc,
      spQuanTam: r.sp_quan_tam_text ? r.sp_quan_tam_text.split('\n').filter(Boolean) : [],
      yeuCauXoa: r.yeu_cau_xoa ? {
        co: true, lyDo: r.ly_do_xoa,
        maNguoi: r.nguoi_yeu_cau_xoa,
        ts: r.thoi_gian_yeu_cau_xoa
      } : null,
      _gioMoIso: r.gio_mo, // dùng cho timer
    }));

    // Convert finished → format frontend
    BH.qlLastFinished = (finRes.data || []).map(r => ({
      idPhien: r.id,
      maCH: r.ma_ch,
      tenCH: r.ten_ch_snapshot || r.ma_ch,
      khuVuc: r.khu_vuc || '',
      maNV: r.ma_nv,
      tenNV: r.ten_nv_snapshot,
      gioBD: fmtTime(r.gio_mo),
      gioKT: fmtTime(r.gio_dong),
      ngay: r.ngay,
      stt: r.stt_trong_ngay,
      sttToanCuc: r.stt_toan_cuc,
      thoiLuong: fmtThoiLuong(r.thoi_luong_phut),
      trangThai: trangThaiText(r.ket_qua),
      lyDo: r.ly_do_khong_mua,
      tongGiaTri: r.tong_gia_tri,
      spQuanTam: r.sp_quan_tam_text ? r.sp_quan_tam_text.split('\n').filter(Boolean) : [],
      spDaMua: r.sp_da_mua_text ? r.sp_da_mua_text.split('\n').filter(Boolean) : [],
      ghiChu: r.ghi_chu,
    }));

    const live = BH.qlLastLive;
    const fin = BH.qlLastFinished;
    const bought = fin.filter(p => p.trangThai === 'Đã mua').length;
    const nbought = fin.filter(p => p.trangThai === 'Chưa mua' || p.trangThai === 'Tự đóng' || p.trangThai === 'Admin đã đóng').length;
    document.getElementById('bh-ql-stat-live').textContent = live.length;
    document.getElementById('bh-ql-stat-bought').textContent = bought;
    document.getElementById('bh-ql-stat-notbought').textContent = nbought;
    const total = bought + nbought;
    document.getElementById('bh-ql-stat-rate').textContent = total > 0 ? Math.round(bought / total * 100) + '%' : '–';
    const totalCard = document.getElementById('bh-ql-stat-all');
    if (totalCard) totalCard.textContent = live.length + bought + nbought;

    // [v11.8+] Update stat YC xóa
    const ycCount = live.filter(p => p.yeuCauXoa && p.yeuCauXoa.co).length;
    const ycEl = document.getElementById('bh-ql-stat-yc');
    if (ycEl) ycEl.textContent = ycCount;
    const ycCard = document.getElementById('bh-ql-stat-card-yc');
    if (ycCard) ycCard.classList.toggle('has-yc', ycCount > 0);

    bhQlRenderLive();
    bhQlRenderHistory();
  } catch(e) {
    console.error('[BH QL] Load lỗi:', e);
    document.getElementById('bh-ql-content-live').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red);font-size:13px">Lỗi tải dữ liệu: ' + (e.message || 'unknown') + '</div>';
  }
}

// [v11.7 BH-7c/d] Render History với filter clickable + sort
function bhQlRenderHistory() {
  const histEl = document.getElementById('bh-ql-content-history');
  if (!histEl) return;
  let fin = (BH.qlLastFinished || []).slice();
  // Apply status filter
  const sf = BH.qlStatusFilter || 'all';
  if (sf === 'bought') fin = fin.filter(p => p.trangThai === 'Đã mua');
  else if (sf === 'notbought') fin = fin.filter(p => p.trangThai === 'Chưa mua' || p.trangThai === 'Tự đóng' || p.trangThai === 'Admin đã đóng');
  // [v11.7+ fix] Filter q client-side - tìm theo CH/SP/NV
  const q = (BH.qlFilterQ || '').toLowerCase();
  if (q) {
    fin = fin.filter(p => {
      const hay = ((p.tenCH || '') + ' ' + (p.maCH || '') + ' ' + (p.tenNV || '') + ' ' + (p.spQuanTam || []).map(bhTenSP).join(' ') + ' ' + (p.spDaMua || []).join(' ')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  // Apply sort
  const sb = BH.qlSort || 'time_desc';
  fin.sort((a, b) => {
    const tA = (a.ngay || '') + (a.gioBD || '');
    const tB = (b.ngay || '') + (b.gioBD || '');
    const dA = bhParseThoiLuong(a.thoiLuong);
    const dB = bhParseThoiLuong(b.thoiLuong);
    const vA = parseFloat(a.tongGiaTri) || 0;
    const vB = parseFloat(b.tongGiaTri) || 0;
    const sA = parseInt(a.stt) || 0;
    const sB = parseInt(b.stt) || 0;
    switch(sb) {
      case 'time_asc':  return tA.localeCompare(tB);
      case 'time_desc': return tB.localeCompare(tA);
      case 'dur_desc':  return dB - dA;
      case 'dur_asc':   return dA - dB;
      case 'value_desc': return vB - vA;
      // [v10.85 YC#2] Sort theo STT phiên trong ngày (kết hợp với ngày)
      case 'stt_asc':   return tA.slice(0,10).localeCompare(tB.slice(0,10)) || (sA - sB);
      case 'stt_desc':  return tB.slice(0,10).localeCompare(tA.slice(0,10)) || (sB - sA);
      default: return tB.localeCompare(tA);
    }
  });
  document.getElementById('bh-ql-count-history').textContent = fin.length;
  if (!fin.length) {
    histEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-m);font-size:13px">' + (q ? 'Không tìm thấy phiên nào khớp' : 'Không có phiên nào') + '</div>';
    return;
  }
  histEl.innerHTML = fin.map(p => {
    const cls = p.trangThai === 'Đã mua' ? 'bought' : (p.trangThai === 'Tự đóng' || p.trangThai === 'Admin đã đóng' ? 'auto' : 'notbought');
    const sttTC = p.stt ? `<span class="bh-stt-tc">#${p.stt}</span>` : '';
    // [v10.85 YC#2] Luôn hiển thị ngày dd/MM (trước đây ẩn nếu trùng ngày filter)
    const ngayHienThi = p.ngay ? (p.ngay.slice(8,10) + '/' + p.ngay.slice(5,7)) : '';
    return `
      <div class="bh-hist-card" onclick="bhQlOpenDetail('${p.idPhien}')">
        <div class="bh-hist-status ${cls}"></div>
        <div class="bh-hist-info">
          <div class="bh-hist-ch">${sttTC}${bhEscHtml(p.tenCH)} · ${bhEscHtml(p.trangThai)}</div>
          <div class="bh-hist-meta">
            ${ngayHienThi ? '<span style="color:#0F6E56;font-weight:600">'+ngayHienThi+'</span> · ' : ''}${bhEscHtml(p.maCH)} · ${p.gioBD} → ${p.gioKT || '--'} · ${p.thoiLuong || '--'}
            ${p.tenNV ? ' · NV: ' + bhEscHtml(p.tenNV) : ''}
          </div>
        </div>
        <div class="bh-hist-time">${ngayHienThi}</div>
      </div>
    `;
  }).join('');
}

// Parse "5:30" → 5.5 phút
function bhParseThoiLuong(s) {
  if (!s) return 0;
  const m = String(s).split(':').map(x => parseInt(x) || 0);
  return (m[0] || 0) + (m[1] || 0) / 60;
}

setInterval(() => {
  if (currentPage !== 'banhang' || BH.qlTab !== 'live') return;
  document.querySelectorAll('[data-qltimer]').forEach(el => {
    const card = el.closest('.bh-live-card');
    if (!card) return;
    const startMs = parseInt(card.dataset.start || '0');
    if (!startMs) return;
    const elapsed = Math.floor((Date.now() - startMs) / 1000);
    el.textContent = bhFormatTimeShort(elapsed);
  });
}, 1000);

function bhQlOpenDetail(idPhien) {
  // [v11.7+ fix] Lưu idPhien hiện tại để dùng cho xóa
  BH.qlCurrentDetailId = idPhien;
  document.getElementById('bh-md-detail-title').textContent = 'Chi tiết phiên';
  document.getElementById('bh-md-detail-sub').textContent = String(idPhien).slice(0, 20);
  document.getElementById('bh-md-detail-body').innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-m);font-size:13px">⏳ Đang tải...</div>';
  // [v11.7+ fix] Show nút xóa cho QLBH/ADMIN/QLBH theo KV
  const delBtn = document.getElementById('bh-md-detail-delete');
  const closeBtn = document.getElementById('bh-md-detail-close');
  const isQLBH = SESSION && (SESSION.vaiTro === 'QLBH' || SESSION.vaiTro === 'ADMIN' || String(SESSION.vaiTro || '').startsWith('QLBH'));
  if (delBtn) delBtn.style.display = isQLBH ? '' : 'none';
  // [v12] Nút đóng phiên: ẩn ban đầu, chỉ show khi biết phiên DANG_MO
  if (closeBtn) closeBtn.style.display = 'none';
  bhOpenModal('detail');

  // [v12-P1] Query trực tiếp 1 phiên theo id từ Supabase
  supa.from('phien_ban_hang')
    .select('id, ma_ch, ten_ch_snapshot, khu_vuc, ma_nv, ten_nv_snapshot, gio_mo, gio_dong, ngay, stt_trong_ngay, trang_thai, ket_qua, ly_do_khong_mua, tong_gia_tri, thoi_luong_phut, sp_quan_tam_text, sp_da_mua_text, ghi_chu')
    .eq('id', idPhien)
    .maybeSingle()
    .then(({ data: r, error }) => {
      if (error || !r) {
        document.getElementById('bh-md-detail-body').innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-m)">Không tìm thấy phiên</div>';
        return;
      }
      // Format
      const fmtTime = ts => { if(!ts)return ''; try{const d=new Date(ts);return bhPad(d.getHours())+':'+bhPad(d.getMinutes());}catch(e){return '';} };
      const fmtThoiLuong = m => { if(!m)return ''; const s=Math.round(m*60); return bhPad(Math.floor(s/60))+':'+bhPad(s%60); };
      let trangThai = 'Đã mua';
      if (r.trang_thai === 'DANG_MO')        trangThai = 'Đang bán';
      else if (r.ket_qua === 'CHUA_MUA')     trangThai = 'Chưa mua';
      else if (r.ket_qua === 'TU_DONG')      trangThai = 'Tự đóng';
      else if (r.ket_qua === 'ADMIN_DONG')   trangThai = 'Admin đã đóng';
      const p = {
        idPhien: r.id, maCH: r.ma_ch, tenCH: r.ten_ch_snapshot || r.ma_ch, khuVuc: r.khu_vuc || '',
        maNV: r.ma_nv, tenNV: r.ten_nv_snapshot,
        gioBD: fmtTime(r.gio_mo), gioKT: fmtTime(r.gio_dong),
        ngay: r.ngay, stt: r.stt_trong_ngay,
        thoiLuong: fmtThoiLuong(r.thoi_luong_phut), trangThai,
        lyDo: r.ly_do_khong_mua, tongGiaTri: r.tong_gia_tri,
        spQuanTam: r.sp_quan_tam_text ? r.sp_quan_tam_text.split('\n').filter(Boolean) : [],
        spDaMua:   r.sp_da_mua_text   ? r.sp_da_mua_text.split('\n').filter(Boolean)   : [],
        ghiChu: r.ghi_chu,
      };
      document.getElementById('bh-md-detail-title').textContent = 'Phiên #' + p.stt + ' · ' + p.trangThai;
      document.getElementById('bh-md-detail-sub').textContent = p.tenCH + ' (' + p.maCH + ')';
      // [v12] Show nút "Đóng phiên" nếu phiên đang mở + user là QLBH/ADMIN
      if (closeBtn && isQLBH && r.trang_thai === 'DANG_MO') closeBtn.style.display = '';
      const spQTHtml = (p.spQuanTam && p.spQuanTam.length)
        ? '<div class="bh-chips">' + p.spQuanTam.map(s => '<span class="bh-chip">' + bhEscHtml(bhTenSP(s)) + '</span>').join('') + '</div>'
        : '<div style="color:var(--text-lt);font-size:12px">Không có</div>';
      const spMuaHtml = (p.spDaMua && p.spDaMua.length)
        ? '<div class="bh-chips">' + p.spDaMua.map(s => '<span class="bh-chip">' + bhEscHtml(s) + '</span>').join('') + '</div>'
        : '<div style="color:var(--text-lt);font-size:12px">—</div>';

      document.getElementById('bh-md-detail-body').innerHTML = `
        <div class="bh-field-label">Thời gian</div>
        <div style="font-size:13px;color:var(--text-m)">${p.ngay} · ${p.gioBD} → ${p.gioKT || 'đang bán'} · ${p.thoiLuong || '--'}</div>
        <div class="bh-field-label">Khu vực</div>
        <div style="font-size:13px">${bhEscHtml(p.khuVuc || '—')}</div>
        ${(p.maNV || p.tenNV) ? '<div class="bh-field-label">Nhân viên trực phiên</div><div style="font-size:13px"><strong>' + bhEscHtml(p.maNV || '') + '</strong> · ' + bhEscHtml(p.tenNV || '') + '</div>' : ''}
        <div class="bh-field-label">Sản phẩm quan tâm</div>
        ${spQTHtml}
        <div class="bh-field-label">Sản phẩm đã mua</div>
        ${spMuaHtml}
        ${p.lyDo ? '<div class="bh-field-label">Lý do không mua</div><div style="font-size:13px;color:var(--text-m)">' + bhEscHtml(p.lyDo) + '</div>' : ''}
        ${p.ghiChu ? '<div class="bh-field-label">Ghi chú</div><div style="font-size:13px;color:var(--text-m);white-space:pre-wrap">' + bhEscHtml(p.ghiChu) + '</div>' : ''}
      `;
    })
    .catch((e) => {
      console.error('[BH detail]', e);
      document.getElementById('bh-md-detail-body').innerHTML = '<div style="padding:24px;text-align:center;color:var(--red)">Lỗi mạng</div>';
    });
}

// [v12] QLBH/ADMIN đóng phiên đang mở → KHONG_MUA
async function bhQlDongPhien() {
  const idPhien = BH.qlCurrentDetailId;
  if (!idPhien) return;
  const ok = await appConfirm('Phiên sẽ bị đóng ngay và tính là "Không mua". Nhân viên cửa hàng sẽ không thể thao tác tiếp trên phiên này.', {
    title: 'Đóng phiên này?',
    okLabel: 'Đóng phiên',
    danger: true
  });
  if (!ok) return;

  bhCloseModal('detail');
  bhShowToast('✓ Đang đóng phiên...', 'success');

  // Gỡ khỏi state local ngay
  const idx = BH.sessions.findIndex(s => s.idPhien === idPhien);
  if (idx >= 0) BH.sessions.splice(idx, 1);
  if (BH.qlLastLive) BH.qlLastLive = BH.qlLastLive.filter(p => p.idPhien !== idPhien);

  supa.rpc('fn_bh_dong_phien', {
    p_phien_id: idPhien,
    p_ma_nguoi_dong: SESSION.ma,
  }).then(({ data: d, error }) => {
    if (!error && d && d.success) {
      bhShowToast('✓ ' + (d.message || 'Đã đóng phiên'), 'success');
    } else {
      bhShowToast('⚠ Server: ' + ((d && d.error) || (error && error.message) || 'Lỗi đóng phiên'), null);
      console.error('[BH Đóng phiên] Server lỗi:', d || error);
    }
    // Reload lại danh sách
    try { if (typeof bhQlLoadPhien === 'function' && BH.qlTab) bhQlLoadPhien(); } catch(e){}
  }).catch(e => {
    bhShowToast('⚠ Mất kết nối', null);
    console.error('[BH Đóng phiên] Network error:', e);
  });
}

// [v11.7+ fix] QLBH/ADMIN xóa phiên - confirm 2 lớp
// [v11.7+ fix] QLBH/ADMIN xóa phiên - dùng appConfirm đẹp + fire-and-forget
async function bhQlXoaPhien() {
  const idPhien = BH.qlCurrentDetailId;
  if (!idPhien) return;
  // [v11.7+ fix] Dùng appConfirm thay native confirm để UI đồng nhất
  const ok1 = await appConfirm('Hành động này KHÔNG thể hoàn tác. Phiên sẽ bị xóa hẳn khỏi Google Sheets.', {
    title: 'Xóa phiên này?',
    okLabel: 'Xóa',
    danger: true
  });
  if (!ok1) return;
  const ok2 = await appConfirm('Bạn chắc chắn 100% muốn xóa phiên này?', {
    title: 'Xác nhận lần cuối',
    okLabel: 'Tôi đồng ý xóa',
    danger: true
  });
  if (!ok2) return;

  // ─── BƯỚC 1: DỪNG TIMER NGAY (xóa khỏi BH.sessions để bhTickTimers bỏ qua) ───
  const idx = BH.sessions.findIndex(s => s.idPhien === idPhien);
  if (idx >= 0) {
    BH.sessions.splice(idx, 1);
  }
  // Cũng xóa khỏi qlLastLive/qlLastFinished nếu đang ở view QLBH
  if (BH.qlLastLive) BH.qlLastLive = BH.qlLastLive.filter(p => p.idPhien !== idPhien);
  if (BH.qlLastFinished) BH.qlLastFinished = BH.qlLastFinished.filter(p => p.idPhien !== idPhien);

  // ─── BƯỚC 2: XÓA CARD KHỎI UI NGAY (fade out 250ms) ───
  // Tìm card trong cả 2 view (CH có data-sid, QLBH có cards trong list)
  const cardCH = document.querySelector('[data-sid="' + idPhien + '"]');
  if (cardCH) {
    cardCH.style.transition = 'opacity .25s, transform .25s, max-height .25s';
    cardCH.style.opacity = '0';
    cardCH.style.transform = 'scale(0.95)';
    setTimeout(() => { try { cardCH.remove(); } catch(e){} }, 260);
  }
  // QLBH view - tìm trong live + history
  const qlCards = document.querySelectorAll('[onclick*="' + idPhien + '"]');
  qlCards.forEach(c => {
    c.style.transition = 'opacity .25s, transform .25s';
    c.style.opacity = '0';
    c.style.transform = 'scale(0.95)';
    setTimeout(() => { try { c.remove(); } catch(e){} }, 260);
  });

  // ─── BƯỚC 3: ĐÓNG MODAL NGAY ───
  bhCloseModal('detail');
  bhShowToast('✓ Đang xóa phiên...', 'success');

  // ─── BƯỚC 4: GỬI SERVER NGẦM (fire-and-forget) — Supabase RPC ───
  supa.rpc('fn_bh_xoa_phien', {
    p_phien_id: idPhien,
    p_ma_nguoi_xoa: SESSION.ma,
  }).then(({ data: d, error }) => {
    if (!error && d && d.success) {
      bhShowToast('✓ ' + (d.message || 'Đã xóa phiên'), 'success');
    } else {
      bhShowToast('⚠ Server: ' + ((d && d.error) || (error && error.message) || 'Lỗi xóa'), null);
      console.error('[BH Xóa phiên] Server lỗi:', d || error);
    }
  }).catch(e => {
    bhShowToast('⚠ Mất kết nối - đang đồng bộ', null);
    console.error('[BH Xóa phiên] Network error:', e);
  });
}

async function bhQlLoadDashboard() {
  const el = document.getElementById('bh-ql-content-dashboard');
  el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-m)">⏳ Đang tải dashboard...</div>';
  try {
    // [v12-P1] Query phiên trong khoảng → aggregate client-side
    const kvFilter = BH.qlFilterKV || '';
    // [v12-fix] ADMIN: xem toàn HT, bỏ qua bhKVList
    const isAdminScope = SESSION && (SESSION.vaiTro === 'ADMIN');
    let kvAllowed = null;
    try {
      if (!isAdminScope && SESSION && SESSION.bhKVList && SESSION.bhKVList.length) kvAllowed = SESSION.bhKVList;
    } catch(e){}

    // Pagination để lấy hết phiên trong khoảng (có thể nhiều)
    const allPhien = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      let q = supa.from('phien_ban_hang')
        .select('id, ma_ch, ten_ch_snapshot, khu_vuc, gio_mo, gio_dong, ngay, trang_thai, ket_qua, ly_do_khong_mua, tong_gia_tri, thoi_luong_phut, sp_quan_tam_text, sp_da_mua_text')
        .order('gio_mo', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (BH.qlFilterTuNgay) q = q.gte('ngay', BH.qlFilterTuNgay);
      if (BH.qlFilterDenNgay) q = q.lte('ngay', BH.qlFilterDenNgay);
      if (kvFilter) q = q.eq('khu_vuc', kvFilter);
      else if (kvAllowed) q = q.in('khu_vuc', kvAllowed);
      const { data: rows, error } = await q;
      if (error) throw error;
      if (!rows || !rows.length) break;
      allPhien.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
      if (offset > 20000) break; // safety
    }

    // Aggregate
    let dangBan = 0, daMua = 0, chuaMua = 0, tongGiaTri = 0;
    let totalThoiLuong = 0, soPhienCoThoiLuong = 0;
    const sttSPQT = {};        // {maSP: count}
    const sttSPDaMua = {};     // {tenSP_or_maSP: count}
    const sttLyDo = {};        // {lyDo: count}
    const sttCH = {};          // {maCH: {tenCH, tong, daMua}}

    for (const r of allPhien) {
      if (r.trang_thai === 'DANG_MO') {
        dangBan++;
      } else if (r.trang_thai === 'DA_DONG') {
        if (r.ket_qua === 'CHUA_MUA' || r.ket_qua === 'TU_DONG') {
          chuaMua++;
          if (r.ly_do_khong_mua) {
            sttLyDo[r.ly_do_khong_mua] = (sttLyDo[r.ly_do_khong_mua] || 0) + 1;
          }
        } else {
          daMua++;
          tongGiaTri += parseFloat(r.tong_gia_tri || 0);
        }
        if (r.thoi_luong_phut) {
          totalThoiLuong += parseFloat(r.thoi_luong_phut);
          soPhienCoThoiLuong++;
        }
      }
      // Top SP quan tâm (split text)
      if (r.sp_quan_tam_text) {
        r.sp_quan_tam_text.split('\n').filter(Boolean).forEach(ma => {
          sttSPQT[ma] = (sttSPQT[ma] || 0) + 1;
        });
      }
      // Top SP đã mua (format: "MÃ_TC (xN)" — gom theo mã, cộng số lượng)
      if (r.sp_da_mua_text) {
        r.sp_da_mua_text.split('\n').filter(Boolean).forEach(line => {
          const m = String(line).match(/\(x\s*(\d+)\)\s*$/i);
          const qty = m ? parseInt(m[1], 10) : 1;
          const key = String(line).replace(/\s*\(x\s*\d+\)\s*$/i, '').trim();
          sttSPDaMua[key] = (sttSPDaMua[key] || 0) + qty;
        });
      }
      // Top CH
      const maCH = r.ma_ch;
      if (!sttCH[maCH]) sttCH[maCH] = { maCH, tenCH: r.ten_ch_snapshot || maCH, tong: 0, daMua: 0 };
      sttCH[maCH].tong++;
      if (r.ket_qua && r.ket_qua !== 'CHUA_MUA' && r.ket_qua !== 'TU_DONG' && r.trang_thai === 'DA_DONG') {
        sttCH[maCH].daMua++;
      }
    }

    const tongPhien = allPhien.length;
    const tyLeChuyenDoi = (daMua + chuaMua) > 0 ? Math.round(daMua / (daMua + chuaMua) * 100) : 0;
    const thoiLuongTB = soPhienCoThoiLuong > 0 ? Math.round(totalThoiLuong / soPhienCoThoiLuong) : 0;

    const t = { tongPhien, dangBan, daMua, chuaMua, tongGiaTri, tyLeChuyenDoi, thoiLuongTB };

    // Convert object → sorted array
    const toSorted = (obj) => Object.entries(obj)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const topSPQuanTam = toSorted(sttSPQT);
    const topSPDaMua = toSorted(sttSPDaMua);
    const topLyDo = toSorted(sttLyDo);
    const theoCuaHang = Object.values(sttCH)
      .map(c => ({ ...c, tyLe: c.tong > 0 ? Math.round(c.daMua / c.tong * 100) : 0 }))
      .sort((a, b) => b.tong - a.tong);

    const db = { tongHop: t, topSPQuanTam, topSPDaMua, topLyDo, theoCuaHang };

    document.getElementById('bh-ql-stat-live').textContent = t.dangBan || 0;
    document.getElementById('bh-ql-stat-bought').textContent = t.daMua || 0;
    document.getElementById('bh-ql-stat-notbought').textContent = t.chuaMua || 0;
    document.getElementById('bh-ql-stat-rate').textContent = (t.tyLeChuyenDoi || 0) + '%';

    const renderBar = (items, title) => {
      if (!items || !items.length) return '<div class="bh-dash-section"><div class="bh-dash-title">' + title + '</div><div style="color:var(--text-lt);font-size:12px">Chưa có dữ liệu</div></div>';
      const max = Math.max(...items.map(i => i.count));
      return '<div class="bh-dash-section"><div class="bh-dash-title">' + title + '</div>' +
        items.slice(0, 10).map(i => {
          const pct = Math.round(i.count / max * 100);
          const label = bhTenSP(i.key) || i.key;
          return `<div><div class="bh-dash-bar-item"><span class="bh-dash-bar-label">${bhEscHtml(label)}</span><span class="bh-dash-bar-count">${i.count}</span></div><div class="bh-dash-bar-fill"><div style="width:${pct}%"></div></div></div>`;
        }).join('') + '</div>';
    };

    const renderCH = (dsCH) => {
      if (!dsCH || !dsCH.length) return '';
      return '<div class="bh-dash-section"><div class="bh-dash-title">Top cửa hàng theo số phiên</div>' +
        dsCH.slice(0, 15).map(c => {
          return `<div class="bh-dash-bar-item">
            <span class="bh-dash-bar-label">${bhEscHtml(c.tenCH)}</span>
            <span style="font-size:11px;color:var(--text-m);margin-right:6px">${c.tong} phiên · <strong style="color:var(--green)">${c.tyLe}%</strong></span>
          </div>`;
        }).join('') + '</div>';
    };

    el.innerHTML = `
      <div class="bh-dash-section">
        <div class="bh-dash-title">Tổng quan</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
          <div><div style="color:var(--text-m);font-size:11px">Tổng phiên</div><div style="font-size:18px;font-weight:600">${t.tongPhien || 0}</div></div>
          <div><div style="color:var(--text-m);font-size:11px">Tỷ lệ chuyển đổi</div><div style="font-size:18px;font-weight:600;color:var(--blue)">${t.tyLeChuyenDoi || 0}%</div></div>
          <div><div style="color:var(--text-m);font-size:11px">Thời lượng TB</div><div style="font-size:16px;font-weight:600">${t.thoiLuongTB || '0'} phút</div></div>
        </div>
      </div>
      ${renderBar(db.topSPQuanTam, 'Top sản phẩm quan tâm')}
      ${renderBar(db.topSPDaMua, 'Top sản phẩm đã bán')}
      ${renderBar(db.topLyDo, 'Top lý do khách không mua')}
      ${renderCH(db.theoCuaHang)}
    `;
  } catch(e) {
    console.error('[BH dashboard]', e);
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--red)">Lỗi tải dashboard: ' + (e.message || 'unknown') + '</div>';
  }
}

window.addEventListener('beforeunload', () => {
  if (BH.clockInterval) clearInterval(BH.clockInterval);
  if (BH.timerInterval) clearInterval(BH.timerInterval);
  if (BH.qlAutoRefresh) clearInterval(BH.qlAutoRefresh);
  // [v12-P1] cleanup Realtime channels
  try { bhStopRealtimeSubCH(); bhStopRealtimeSubQL(); } catch(e){}
});

// ─── End module bán hàng v11.2 ──────────────────────────────────
