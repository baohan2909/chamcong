const SCRIPT_URL='https://script.google.com/macros/s/AKfycbxe1-r_QzRscqIRixNuZe3Rgw3Fq2mDRJo0_5BIyAA5dzyTk50SR-BHCARr80DknqJp/exec';
const GPS_RADIUS=100; // đồng bộ với Config.GPS_RADIUS_METER trong Script

// ════════════════════════════════════════════════════════════════
// [v12-P1] SUPABASE CLIENT — Module BÁN HÀNG dùng Supabase trực tiếp
// Các module khác (chấm công, lịch ca, đơn nghỉ) tạm giữ Apps Script
// ════════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://yeyiduztwdcyguivomxq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oGLSWiJxVYUIBtFkZAOQRQ_BgCT9r6N';
let supa = null;
try {
  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  console.log('[Supabase] Client ready');
} catch(e) {
  console.error('[Supabase] Init lỗi:', e);
}
