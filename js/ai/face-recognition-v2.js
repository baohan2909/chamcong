/* ════════════════════════════════════════════════════════════════════════════
 *  Nón Sơn — Face Recognition v2 "NS FaceLite" (13/08/2026)
 *
 *  LÀM LẠI TỪ ĐẦU theo lệnh Aroma ("lag lắm, máy NV mạnh yếu lẫn lộn, làm sao
 *  tất cả cùng dùng") — bỏ face-api/WebGL, thay bằng bộ nhẹ chạy CPU:
 *   - Dò mặt:      YuNet 230KB (kèm 5 điểm mốc — khỏi cần model landmark riêng)
 *   - Nhận diện:   MobileFaceNet int8 3.5MB (thay ResNet 6.4MB của face-api)
 *   - Nền chạy:    onnxruntime-web WASM 1 luồng (KHÔNG WebGL → hết nguồn ngốn
 *                  RAM làm iOS kill app "văng ra màn hình chính")
 *
 *  VÌ SAO HẾT LAG (đo benchmark 13/08):
 *   - Bản cũ chạy model nặng 6.4MB ~6 lần/GIÂY suốt lúc canh mặt (WebGL).
 *   - Bản mới lúc canh mặt chỉ chạy YuNet 230KB (~12ms); model nhận diện chỉ
 *     chạy 2-3 lần DUY NHẤT lúc chụp (~53ms/lần trên PC, ước 0.2-0.35s máy yếu).
 *   - Độ chính xác đã kiểm chứng: cùng người cosine 0.5-0.72, khác người ~0.0
 *     → ngưỡng 0.35 (map = 70% trên thang admin) dư biên an toàn hai phía.
 *
 *  BÀI HỌC ĐỘ NÉT (benchmark bench2/3/4): PHẢI căn chỉnh mặt từ khung video gốc
 *  (~480px), KHÔNG từ canvas dò 192px (cùng-người tụt 0.72→0.43 vì mặt vỡ nét).
 *  → dò ở 192 (nhanh) → lúc chụp dò tinh lại trên crop 256 quanh mặt → cắt 112
 *    từ khung gốc → embed.
 *
 *  CÔNG TẮC (app_settings `face.v2`, KHÔNG cần build lại):
 *   - không set / 'off'  → chạy engine CŨ (file này im lặng — deploy an toàn)
 *   - 'ns00490'          → chỉ NS00490 dùng v2 (Aroma test iPhone)
 *   - 'all' / true       → tất cả dùng v2
 *  Router cuối file override window.nsFace* TẠI THỜI ĐIỂM GỌI → đổi cờ là đổi
 *  engine ngay lần chấm sau, không reload.
 *
 *  DB: bảng face_v2_embeddings + fn_face_enroll_v2 / fn_face_verify_v2 /
 *  fn_face_enroll_status_v2 (SQL: scratchpad/v18.51_face_v2.sql — Aroma chạy).
 *  Vector v1 (128-d face-api) KHÔNG tương thích → NV được mời đăng ký lại 1 lần.
 *  ──────────────────────────────────────────────────────────────────────── */
(function () {
'use strict';
if (window.__NSFACE2_LOADED) return;
window.__NSFACE2_LOADED = true;

var CFG = {
  DIR: 'face2/',
  // [tên file, số byte] — để tính % tiến độ tải (đúng pattern chống-treo v18.50:
  // chỉ fail khi ĐỨNG mạng 30s, không phải tổng thời gian; tải xong file nào SW cache file đó)
  F_ORTJS:  ['ort.wasm.min.js',    145070],
  F_SIMD:   ['ort-wasm-simd.wasm', 10551547],
  F_NOSIMD: ['ort-wasm.wasm',      9726745],
  F_YUNET:  ['yunet.onnx',         229657],
  F_MFN:    ['mfn_int8.onnx',      3514509],
  DET: 192,            // cạnh canvas dò mặt lúc canh (nhanh, ~12ms PC)
  REFINE: 256,         // cạnh canvas dò tinh lúc chụp (mặt ~150px → landmark chuẩn)
  MIN_FACE_DET: 32,    // mặt < 32px @192 (~17% khung) → "đưa gần hơn" (tương đương 80px bản cũ)
  STABLE_PX: 12,       // độ xê dịch cho phép giữa 2 khung @192 (bản cũ 30px @480)
  STABLE_FRAMES: 3,
  SCAN_MS: 700,        // [ào 1 phát] vòng ring fill NHANH ~0.7s — chỉ phản hồi thị giác, KHÔNG chặn logic (bản cũ 2.5s)
  SUCCESS_MS: 600,     // [ào 1 phát] màn "thành công" trước khi qua chấm công (bản cũ 1.4s)
  TRACK_MS: 150,       // nhịp dò lúc canh mặt (~6-7 khung/giây, model bé nên rẻ)
  DET_THR: 0.6,
  REFINE_THR: 0.5,
  GUM_TIMEOUT: 15000,
  STALL_MS: 30000
};

// 5 điểm chuẩn arcface trên khung 112×112 (trái-ảnh mắt, phải-ảnh mắt, mũi, 2 mép miệng)
var REFPTS = [[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],[41.5493,92.3655],[70.7299,92.2041]];

var _ready = false, _loading = false, _loadPct = 0;
var _detSess = null, _recSess = null;
var _detCanvas = null;   // canvas 192 tái dùng (đỡ GC)
var _dbg = { det: 0, emb: 0 };

/* ─── WASM SIMD check (iOS <16.4 không SIMD → dùng ort-wasm.wasm, chậm hơn nhưng chạy) ─── */
var _simdCache = null;
function _simdOk() {
  if (_simdCache !== null) return _simdCache;
  try {
    _simdCache = WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
  } catch (e) { _simdCache = false; }
  return _simdCache;
}

/* ─── Tải file có % tiến độ + chống treo (pattern v18.50) ─── */
function _fetchProgress(url, onChunk) {
  return new Promise(function (resolve, reject) {
    var reader = null, stallTimer = null;
    var arm = function () {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(function () { try { if (reader) reader.cancel(); } catch (e) {} reject(new Error('stall:' + url)); }, CFG.STALL_MS);
    };
    (async function () {
      try {
        arm();
        var resp = await fetch(url);
        if (!resp.ok) { clearTimeout(stallTimer); reject(new Error('http ' + resp.status + ':' + url)); return; }
        if (!resp.body || !resp.body.getReader) { await resp.arrayBuffer(); clearTimeout(stallTimer); resolve(); return; }
        reader = resp.body.getReader();
        while (true) {
          var r = await reader.read();
          if (r.done) break;
          arm();
          if (r.value && onChunk) onChunk(r.value.length);
        }
        clearTimeout(stallTimer); resolve();
      } catch (e) { clearTimeout(stallTimer); reject(e); }
    })();
  });
}
function _fileList() {
  return [CFG.F_ORTJS, _simdOk() ? CFG.F_SIMD : CFG.F_NOSIMD, CFG.F_YUNET, CFG.F_MFN];
}
async function _prefetch(onProgress) {
  var files = _fileList();
  var total = 0, loaded = 0, i;
  for (i = 0; i < files.length; i++) total += files[i][1];
  var emit = function (p) { _loadPct = p; if (onProgress) onProgress(p); };
  for (i = 0; i < files.length; i++) {
    await _fetchProgress(CFG.DIR + files[i][0], function (n) {
      loaded += n;
      emit(Math.min(99, Math.floor(loaded / total * 100)));
    });
  }
  emit(100);
}
function _loadScript(src, ms) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var s = document.createElement('script');
    var tid = setTimeout(function () { if (!done) { done = true; reject(new Error('script-timeout')); } }, ms || 22000);
    s.src = src;
    s.onload = function () { if (!done) { done = true; clearTimeout(tid); resolve(); } };
    s.onerror = function () { if (!done) { done = true; clearTimeout(tid); reject(new Error('script-error')); } };
    document.head.appendChild(s);
  });
}

async function _ensureLoaded(onProgress) {
  if (_ready) { if (onProgress) onProgress(100); return true; }
  if (_loading) {
    while (_loading) { if (onProgress) onProgress(_loadPct); await new Promise(function (r) { setTimeout(r, 200); }); }
    if (onProgress) onProgress(_ready ? 100 : _loadPct);
    return _ready;
  }
  _loading = true;
  try {
    // 1) Tải trọn bộ file có % (SW cache bền → lần sau tức thì)
    await _prefetch(onProgress);
    // 2) Nạp runtime + tạo 2 session từ cache
    if (typeof ort === 'undefined') await _loadScript(CFG.DIR + CFG.F_ORTJS[0], 22000);
    ort.env.wasm.wasmPaths = CFG.DIR;
    ort.env.wasm.numThreads = 1;   // GitHub Pages không COOP/COEP → không SharedArrayBuffer
    var opts = { executionProviders: ['wasm'] };
    _detSess = await ort.InferenceSession.create(CFG.DIR + CFG.F_YUNET[0], opts);
    _recSess = await ort.InferenceSession.create(CFG.DIR + CFG.F_MFN[0], opts);
    _ready = true;
    return true;
  } catch (e) {
    console.error('[face2] load fail:', e);
    return false;
  } finally {
    _loading = false;
  }
}

/* ─── Preload nền sau đăng nhập: chỉ TẢI FILE vào cache (không tạo session — đỡ RAM lúc nhàn rỗi) ─── */
var _preloaded = false;
function v2Preload() {
  if (_preloaded || _ready || _loading) return;
  _preloaded = true;
  try { _prefetch(null).catch(function () { _preloaded = false; }); } catch (e) { _preloaded = false; }
  _refreshMenuLabel();
}

/* ─── Nhãn "Đã đăng ký / Chưa đăng ký" trong menu Tài khoản — theo trạng thái V2 ─── */
function _refreshMenuLabel() {
  try {
    if (typeof supa === 'undefined' || typeof SESSION === 'undefined' || !SESSION) return;
    supa.rpc('fn_face_enroll_status_v2', { p_ma_nv: SESSION.ma }).then(function (res) {
      var data = res && res.data;
      if (!data) return;
      var lbl = document.getElementById('menu-face-status');
      if (!lbl) return;
      if (data.completed) { lbl.textContent = '✓ Đã đăng ký'; lbl.style.color = '#0F6E56'; }
      else { lbl.textContent = 'Chưa đăng ký'; lbl.style.color = '#EF4444'; }
    }).catch(function () {});
  } catch (e) {}
}

/* ════════════════ ENGINE: tensor / decode / align / embed ════════════════ */

// YuNet ăn BGR KHÔNG chuẩn hóa, CHW (đối chiếu 0.0px với OpenCV)
function _toBGRTensor(canvas) {
  var d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  var n = canvas.width * canvas.height;
  var out = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) {
    out[i] = d[i * 4 + 2];
    out[n + i] = d[i * 4 + 1];
    out[2 * n + i] = d[i * 4];
  }
  return new ort.Tensor('float32', out, [1, 3, canvas.height, canvas.width]);
}
// MobileFaceNet ăn RGB (x-127.5)/128, CHW 112×112
function _toMFNTensor(canvas) {
  var d = canvas.getContext('2d').getImageData(0, 0, 112, 112).data;
  var n = 112 * 112;
  var out = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) {
    out[i] = (d[i * 4] - 127.5) / 128;
    out[n + i] = (d[i * 4 + 1] - 127.5) / 128;
    out[2 * n + i] = (d[i * 4 + 2] - 127.5) / 128;
  }
  return new ort.Tensor('float32', out, [1, 3, 112, 112]);
}

// Giải mã YuNet (strides 8/16/32) — trả mặt điểm cao nhất hoặc null
function _decodeYunet(results, W, H, thr) {
  var best = null;
  var strides = [8, 16, 32];
  for (var s = 0; s < 3; s++) {
    var st = strides[s];
    var cls = results['cls_' + st].data, obj = results['obj_' + st].data,
        bbox = results['bbox_' + st].data, kps = results['kps_' + st].data;
    var cols = (W / st) | 0, rows = (H / st) | 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var i = r * cols + c;
        var cl = cls[i]; if (cl < 0) cl = 0; else if (cl > 1) cl = 1;
        var ob = obj[i]; if (ob < 0) ob = 0; else if (ob > 1) ob = 1;
        var score = Math.sqrt(cl * ob);
        if (score < thr || (best && score <= best.score)) continue;
        var cx = (c + bbox[i * 4]) * st, cy = (r + bbox[i * 4 + 1]) * st;
        var w = Math.exp(bbox[i * 4 + 2]) * st, h = Math.exp(bbox[i * 4 + 3]) * st;
        var pts = [];
        for (var k = 0; k < 5; k++) pts.push([(c + kps[i * 10 + 2 * k]) * st, (r + kps[i * 10 + 2 * k + 1]) * st]);
        best = { score: score, x: cx - w / 2, y: cy - h / 2, w: w, h: h, cx: cx, cy: cy, pts: pts };
      }
    }
  }
  return best;
}

// Similarity transform (least-squares, không phản chiếu) 5 điểm → REFPTS (khớp cv2.estimateAffinePartial2D)
function _simToRef(src) {
  var n = 5, Sx = 0, Sy = 0, Su = 0, Sv = 0, Sxx = 0, Sxu = 0, Scr = 0;
  for (var i = 0; i < n; i++) {
    var x = src[i][0], y = src[i][1], u = REFPTS[i][0], v = REFPTS[i][1];
    Sx += x; Sy += y; Su += u; Sv += v;
    Sxx += x * x + y * y; Sxu += x * u + y * v; Scr += x * v - y * u;
  }
  var den = Sxx - (Sx * Sx + Sy * Sy) / n;
  var a = (Sxu - (Sx * Su + Sy * Sv) / n) / den;
  var b = (Scr - (Sx * Sv - Sy * Su) / n) / den;
  return { a: a, b: b, tx: (Su - a * Sx + b * Sy) / n, ty: (Sv - b * Sx - a * Sy) / n };
}

// Dò mặt trên 1 canvas — lỗi inference (RAM hiccup máy yếu) → null, KHÔNG throw phá vòng quét
async function _detectOnCanvas(canvas, thr) {
  if (!_ready) return null;
  try {
    var t0 = performance.now();
    var out = await _detSess.run({ input: _toBGRTensor(canvas) });
    _dbg.det = performance.now() - t0;
    return _decodeYunet(out, canvas.width, canvas.height, thr);
  } catch (e) {
    console.warn('[face2] detect error:', e && e.message);
    return null;
  }
}

// Chụp khung video vuông (center-crop, KHÔNG lật gương — enroll & verify cùng hệ nên nhất quán)
function _grabFrameSquare(video) {
  var vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  var s = Math.min(vw, vh);
  var c = document.createElement('canvas');
  c.width = s; c.height = s;
  c.getContext('2d').drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, s, s);
  return c;
}

// 1 nhịp canh mặt: video → canvas 192 → YuNet. Trả {none:true} | {tooSmall:true} | box @192
async function _trackOnce(video) {
  var vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return { none: true };
  if (!_detCanvas) { _detCanvas = document.createElement('canvas'); _detCanvas.width = CFG.DET; _detCanvas.height = CFG.DET; }
  var s = Math.min(vw, vh);
  _detCanvas.getContext('2d').drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, CFG.DET, CFG.DET);
  var d = await _detectOnCanvas(_detCanvas, CFG.DET_THR);
  if (!d) return { none: true };
  if (d.w < CFG.MIN_FACE_DET) return { tooSmall: true };
  return d;
}

// Lúc CHỤP: dò tinh landmark trên crop 256 quanh mặt rồi cắt 112 từ KHUNG GỐC → embed 512-d chuẩn hóa
async function _refineAndEmbed(video, box192) {
  var frame = _grabFrameSquare(video);
  if (!frame) return null;
  var S = frame.width;
  var sc = S / CFG.DET;
  var bx = box192.x * sc, by = box192.y * sc, bw = box192.w * sc, bh = box192.h * sc;
  var m = Math.max(bw, bh) * 1.6;
  if (m > S) m = S;
  var rx = bx + bw / 2 - m / 2, ry = by + bh / 2 - m / 2;
  if (rx < 0) rx = 0; if (ry < 0) ry = 0;
  if (rx > S - m) rx = S - m; if (ry > S - m) ry = S - m;
  var rc = document.createElement('canvas');
  rc.width = CFG.REFINE; rc.height = CFG.REFINE;
  rc.getContext('2d').drawImage(frame, rx, ry, m, m, 0, 0, CFG.REFINE, CFG.REFINE);
  var d2 = await _detectOnCanvas(rc, CFG.REFINE_THR);
  if (!d2) return null;
  var k = m / CFG.REFINE;
  var pts = [];
  for (var i = 0; i < 5; i++) pts.push([rx + d2.pts[i][0] * k, ry + d2.pts[i][1] * k]);
  var M = _simToRef(pts);
  var c112 = document.createElement('canvas');
  c112.width = 112; c112.height = 112;
  var ctx = c112.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(M.a, M.b, -M.b, M.a, M.tx, M.ty);
  ctx.drawImage(frame, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try {
    var t0 = performance.now();
    var out = await _recSess.run({ 'input.1': _toMFNTensor(c112) });
    _dbg.emb = performance.now() - t0;
    var e = out[_recSess.outputNames[0]].data;
    var norm = 0, j;
    for (j = 0; j < e.length; j++) norm += e[j] * e[j];
    norm = Math.sqrt(norm) || 1;
    var arr = new Array(e.length);
    for (j = 0; j < e.length; j++) arr[j] = e[j] / norm;
    return arr;
  } catch (e2) {
    console.warn('[face2] embed error:', e2 && e2.message);
    return null;
  }
}

function _avgEmb(list) {
  if (!list.length) return null;
  var dim = list[0].length, out = new Array(dim).fill(0), i, j;
  for (i = 0; i < list.length; i++) for (j = 0; j < dim; j++) out[j] += list[i][j];
  var norm = 0;
  for (j = 0; j < dim; j++) { out[j] /= list.length; norm += out[j] * out[j]; }
  norm = Math.sqrt(norm) || 1;
  for (j = 0; j < dim; j++) out[j] = Math.round(out[j] / norm * 1e6) / 1e6;
  return out;
}

/* ════════════════ CAMERA (kế thừa nguyên bài học v17.68→v18.50) ════════════════ */

function _gumWithTimeout(constraints, ms) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var tid = setTimeout(function () {
      if (done) return;
      done = true;
      var err = new Error('camera-open-timeout');
      err.name = 'CameraTimeoutError';
      reject(err);
    }, ms);
    navigator.mediaDevices.getUserMedia(constraints).then(
      function (stream) {
        if (done) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} return; }
        done = true; clearTimeout(tid); resolve(stream);
      },
      function (e) { if (done) return; done = true; clearTimeout(tid); reject(e); }
    );
  });
}

var _CAM_TRIES = [
  { facingMode: 'user', width: { exact: 640 }, height: { exact: 480 }, frameRate: { ideal: 24, max: 30 } },
  { facingMode: 'user', width: { exact: 480 }, height: { exact: 640 }, frameRate: { ideal: 24, max: 30 } },
  { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
  { facingMode: 'user' },
  true
];

async function _openCam(videoEl) {
  if (videoEl.srcObject) {
    try { videoEl.srcObject.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    videoEl.srcObject = null;
  }
  try {
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('muted', '');
    videoEl.setAttribute('autoplay', '');
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
  } catch (e) {}

  var stream, i;
  for (i = 0; i < _CAM_TRIES.length; i++) {
    try {
      stream = await _gumWithTimeout({ video: _CAM_TRIES[i], audio: false }, CFG.GUM_TIMEOUT);
      break;
    } catch (e) {
      if (e && e.name === 'CameraTimeoutError') throw e;   // treo hệ thống → báo ngay, không thử thêm 15s/lượt
      if (i === _CAM_TRIES.length - 1) throw e;
    }
  }
  videoEl.srcObject = stream;
  try { window._nsBusy = true; } catch (e) {}   // [v18.48] đang quét mặt → HOÃN auto-reload bản mới

  if (videoEl.readyState < 1) {
    await new Promise(function (resolve) {
      var tid = setTimeout(resolve, 5000);
      videoEl.addEventListener('loadedmetadata', function () { clearTimeout(tid); resolve(); }, { once: true });
    });
  }
  try { await videoEl.play(); }
  catch (e) {
    await new Promise(function (r) { setTimeout(r, 150); });
    try { await videoEl.play(); } catch (e2) {}
  }
  if (videoEl.paused) {
    var tapTarget = videoEl.closest('.ns-face-stage') || videoEl;
    var tapPlay = function () { videoEl.play().catch(function () {}); };
    tapTarget.addEventListener('click', tapPlay);
    tapTarget.addEventListener('touchstart', tapPlay, { passive: true });
  }

  var prefix = String(videoEl.id || '').replace(/-video$/, '');
  var previewEl = document.getElementById(prefix + '-preview');
  if (previewEl) _startPreview(videoEl, previewEl);
  return stream;
}

function _stopCam(stream) {
  if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
  try { window._nsBusy = false; if (typeof window.nsReloadIfPending === 'function') window.nsReloadIfPending(); } catch (e) {}
}
function _stopAllStreams() {
  if (_verifyStream) { _stopCam(_verifyStream); _verifyStream = null; }
  if (_enrollStream) { _stopCam(_enrollStream); _enrollStream = null; }
  try { window._nsBusy = false; if (typeof window.nsReloadIfPending === 'function') window.nsReloadIfPending(); } catch (e) {}
}
window.addEventListener('pagehide', _stopAllStreams);

// Preview canvas 320 (video thật thu 2px opacity 0 — tầng render iOS ổn định tuyệt đối, bài học v6-cam)
function _startPreview(videoEl, canvasEl) {
  var ctx = canvasEl.getContext('2d');
  var cw = canvasEl.width, ch = canvasEl.height;
  if (canvasEl._nsRaf) { try { cancelAnimationFrame(canvasEl._nsRaf); } catch (e) {} }
  var raf = 0, last = 0;
  var draw = function (ts) {
    if (!document.body.contains(canvasEl) || !videoEl.srcObject) { cancelAnimationFrame(raf); return; }
    raf = requestAnimationFrame(draw);
    canvasEl._nsRaf = raf;
    if (ts - last < 33) return;
    last = ts;
    var vw = videoEl.videoWidth, vh = videoEl.videoHeight;
    if (!vw || !vh || videoEl.readyState < 2) return;
    var s = Math.min(vw, vh);
    var sx = (vw - s) / 2, sy = (vh - s) / 2;
    ctx.save();
    ctx.translate(cw, 0); ctx.scale(-1, 1);
    ctx.drawImage(videoEl, sx, sy, s, s, 0, 0, cw, ch);
    ctx.restore();
  };
  raf = requestAnimationFrame(draw);
  canvasEl._nsRaf = raf;
}

// Ảnh bằng chứng lưu kèm chấm công (lật gương khớp góc nhìn user — như v1)
function _captureFaceFrame(videoEl) {
  try {
    var w = videoEl.videoWidth || 640, h = videoEl.videoHeight || 480;
    if (!w || !h) return null;
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch (e) { return null; }
}

function _haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p || 30); } catch (e) {} }

/* ════════════════ UI DÙNG CHUNG (giữ nguyên vỏ v1 — NV không phải học lại) ════════════════ */

function _buildStage(containerEl, prefix) {
  containerEl.innerHTML =
    '<div class="ns-face-stage" id="' + prefix + '-stage">' +
      '<div class="ns-face-cam">' +
        '<video id="' + prefix + '-video" autoplay muted playsinline webkit-playsinline></video>' +
        '<canvas id="' + prefix + '-preview" class="ns-face-preview" width="320" height="320"></canvas>' +
      '</div>' +
      '<div class="ns-face-cam-overlay">' +
        '<div class="ns-face-cam-check" id="' + prefix + '-check">' +
          '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</div>' +
      '</div>' +
      '<svg class="ns-face-ring" viewBox="0 0 200 200">' +
        '<defs><linearGradient id="nsFaceRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
          '<stop offset="0%" stop-color="#2BC084"/><stop offset="100%" stop-color="#0F6E56"/>' +
        '</linearGradient></defs>' +
        '<circle class="ns-face-ring-bg" cx="100" cy="100" r="95"/>' +
        '<circle class="ns-face-ring-fg" id="' + prefix + '-ring-fg" cx="100" cy="100" r="95"/>' +
      '</svg>' +
    '</div>' +
    '<div class="ns-face-instruction" id="' + prefix + '-instruction"></div>' +
    '<div class="ns-face-substatus" id="' + prefix + '-substatus"></div>' +
    '<div class="ns-face-debug" id="' + prefix + '-debug"></div>';
}
function _setInstruction(prefix, text) {
  var el = document.getElementById(prefix + '-instruction');
  if (el) el.textContent = text;
}
function _setSubstatus(prefix, text, type) {
  var el = document.getElementById(prefix + '-substatus');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'ns-face-substatus' + (type ? ' ' + type : '');
}
// Dòng số đo — CHỈ NS00490 thấy (phục vụ Aroma test iPhone: dò/embed mất bao nhiêu ms)
function _dbgShow(prefix) {
  try {
    if (!window.SESSION || SESSION.ma !== 'NS00490') return;
    var el = document.getElementById(prefix + '-debug');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = 'v2 ' + (_simdOk() ? 'simd' : 'no-simd')
      + ' · dò ' + _dbg.det.toFixed(0) + 'ms · embed ' + _dbg.emb.toFixed(0) + 'ms';
  } catch (e) {}
}

/* ─── Canh mặt ổn định (logic v1, engine mới) — trả box @192 để chụp ─── */
async function _waitStable(video, prefix, abortRef) {
  var prev = null, stableCount = 0, ready = 0;
  while (!abortRef.aborted && ready < 30) {
    if (video.videoWidth > 0 && video.readyState >= 2 && !video.paused) break;
    await new Promise(function (r) { setTimeout(r, 100); });
    ready++;
  }
  while (!abortRef.aborted) {
    var d = await _trackOnce(video);
    if (d.none) {
      _setSubstatus(prefix, 'Đang tìm khuôn mặt');
      stableCount = 0; prev = null;
    } else if (d.tooSmall) {
      _setSubstatus(prefix, 'Đưa khuôn mặt gần hơn');
      stableCount = 0;
    } else {
      if (prev && Math.abs(prev.cx - d.cx) < CFG.STABLE_PX && Math.abs(prev.cy - d.cy) < CFG.STABLE_PX) stableCount++;
      else stableCount = 0;
      prev = d;
      if (stableCount >= CFG.STABLE_FRAMES) return d;
      _setSubstatus(prefix, 'Đã định vị, sẵn sàng quét');
    }
    _dbgShow(prefix);
    await new Promise(function (r) { setTimeout(r, CFG.TRACK_MS); });
  }
  return null;
}

/* ─── Quét NHANH "ào 1 phát": ring fill ~0.7s (CHỈ phản hồi thị giác, không chặn logic),
 *     chụp 2 embedding LIỀN NHAU rồi trung bình → thấy mặt là xong luôn.
 *     Bản cũ chờ nửa vòng + hết vòng + nháy 0.8s = ~3.3s NGHI THỨC; nay ~1s.
 *     Ring ép transition-duration INLINE nên v1 (dùng chung CSS 2.5s) KHÔNG bị đụng. ─── */
async function _smoothScan(video, prefix, abortRef) {
  var box = await _waitStable(video, prefix, abortRef);
  if (!box || abortRef.aborted) return null;

  var stage = document.getElementById(prefix + '-stage');
  var ringFg = document.getElementById(prefix + '-ring-fg');
  if (stage) stage.classList.add('scanning');
  _setSubstatus(prefix, 'Đang quét...', 'ok');

  var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  if (ringFg) {
    ringFg.classList.remove('animating', 'flash-complete');
    ringFg.style.strokeDashoffset = '597';
    void ringFg.offsetWidth;
    ringFg.style.transition = 'stroke-dashoffset ' + (CFG.SCAN_MS / 1000) + 's cubic-bezier(0.4,0,0.2,1)';
    ringFg.style.strokeDashoffset = '0';
  }

  // Chụp 2 embedding liền nhau (~150ms) — KHÔNG chờ nửa/hết vòng như bản cũ
  var embs = [];
  var e1 = await _refineAndEmbed(video, box);
  if (e1) embs.push(e1);
  await new Promise(function (r) { setTimeout(r, 150); });
  if (abortRef.aborted) return null;
  var d2 = await _trackOnce(video);
  var box2 = (!d2.none && !d2.tooSmall) ? d2 : box;
  var e2 = await _refineAndEmbed(video, box2);
  if (e2) embs.push(e2);
  _dbgShow(prefix);

  // Để ring chạy cho tròn (nhưng TỐI ĐA SCAN_MS — nếu chụp lâu hơn thì flash ngay)
  var now = (window.performance && performance.now) ? performance.now() : Date.now();
  var remain = CFG.SCAN_MS - (now - t0);
  if (remain > 0) await new Promise(function (r) { setTimeout(r, remain); });
  if (abortRef.aborted) return null;

  // Nháy dấu ✓ NGẮN (300ms thay vì 800ms)
  if (stage) stage.classList.remove('scanning');
  if (ringFg) { ringFg.style.strokeDashoffset = '0'; ringFg.classList.add('flash-complete'); }
  var check = document.getElementById(prefix + '-check');
  if (check) check.classList.add('show');
  _haptic([40, 60, 40]);
  await new Promise(function (r) { setTimeout(r, 300); });
  if (check) check.classList.remove('show');
  if (ringFg) ringFg.classList.remove('flash-complete');

  if (!embs.length) return null;
  return _avgEmb(embs);
}

/* ════════════════ FLOW 1: ĐĂNG KÝ (3 góc như cũ) ════════════════ */
var _enrollAbort = { aborted: false };
var _enrollStream = null;

function v2OpenEnrollment() {
  _enrollAbort = { aborted: false };
  _stopAllStreams();
  var old = document.getElementById('ns-face-modal');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = 'ns-face-modal';
  modal.className = 'ns-face-modal';
  modal.innerHTML =
    '<div class="ns-face-header">' +
      '<button class="ns-face-close" onclick="nsFaceCloseEnrollment()">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '<div class="ns-face-title">Đăng ký khuôn mặt</div>' +
    '</div>' +
    '<div class="ns-face-body" id="ns-face-modal-body">' +
      '<div class="ns-face-step active">' +
        '<div class="ns-face-icon-big">' +
          '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2BC084" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' +
        '</div>' +
        '<h3>Quét khuôn mặt</h3>' +
        '<p>Hệ thống sẽ lưu 3 góc nhìn: chính diện, nghiêng trái và nghiêng phải. Mỗi lần quét chỉ mất vài giây.</p>' +
        '<div class="ns-face-privacy"><b>Bảo mật:</b> Chỉ lưu vector đặc trưng, không lưu ảnh gốc của bạn.</div>' +
        '<button class="ns-face-btn-primary" id="ns-fe-start">Bắt đầu</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  requestAnimationFrame(function () { modal.classList.add('open'); });
  document.getElementById('ns-fe-start').onclick = _startEnrollFlow;
}

function v2CloseEnrollment() {
  _enrollAbort.aborted = true;
  if (_enrollStream) { _stopCam(_enrollStream); _enrollStream = null; }
  var m = document.getElementById('ns-face-modal');
  if (m) { m.classList.remove('open'); setTimeout(function () { m.remove(); }, 250); }
}
function _feRetry() { v2CloseEnrollment(); setTimeout(function () { v2OpenEnrollment(); }, 300); }

async function _startEnrollFlow() {
  var body = document.getElementById('ns-face-modal-body');
  body.innerHTML = '<div class="ns-face-step active" id="fe-step"></div>';
  _buildStage(document.getElementById('fe-step'), 'fe');

  var video = document.getElementById('fe-video');
  _setInstruction('fe', 'Đang mở camera…');
  try {
    _enrollStream = await _openCam(video);
    if (video.paused) _setInstruction('fe', 'Chạm vào vòng tròn để bật camera');
  } catch (e) {
    var isPerm = e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || /denied|permission/i.test(e.message || ''));
    if (isPerm) _setInstruction('fe', 'Cần cấp quyền camera — vào Cài đặt cho phép rồi bấm "Thử lại"');
    else if (e && e.name === 'CameraTimeoutError') _setInstruction('fe', 'Không mở được camera — kiểm tra quyền Camera trong Cài đặt > Safari rồi bấm "Thử lại"');
    else _setInstruction('fe', 'Không mở được camera — bấm "Thử lại"');
    _addRetryBtn('fe', _feRetry);
    return;
  }
  if (_enrollAbort.aborted) return;

  _setInstruction('fe', 'Chuẩn bị máy quét…');
  _setSubstatus('fe', 'Đang tải bộ nhận diện… ' + _loadPct + '%', 'ok');
  var ok = await _ensureLoaded(function (pct) { _setSubstatus('fe', 'Đang tải bộ nhận diện… ' + pct + '%', 'ok'); });
  if (_enrollAbort.aborted) return;
  if (!ok) {
    _setInstruction('fe', 'Không tải được máy quét');
    _setSubstatus('fe', 'Kiểm tra mạng rồi bấm "Thử lại"', 'err');
    _addRetryBtn('fe', _feRetry);
    return;
  }
  _setSubstatus('fe', '', '');

  var steps = [
    { goc: 'thang', label: 'Nhìn thẳng vào ống kính', delay: 300 },
    { goc: 'trai',  label: 'Quay nhẹ về vai TRÁI của bạn', delay: 1500 },
    { goc: 'phai',  label: 'Quay nhẹ về vai PHẢI của bạn', delay: 1500 }
  ];
  for (var i = 0; i < steps.length; i++) {
    var st = steps[i];
    if (_enrollAbort.aborted) return;
    _setInstruction('fe', st.label);
    _setSubstatus('fe', '', '');
    await new Promise(function (r) { setTimeout(r, st.delay); });

    var embedding = await _smoothScan(video, 'fe', _enrollAbort);
    if (!embedding || _enrollAbort.aborted) {
      if (!_enrollAbort.aborted) {
        _setSubstatus('fe', 'Chưa lấy được nét mặt, quét lại...', 'err');
        await new Promise(function (r) { setTimeout(r, 1000); });
        i--; continue;
      }
      return;
    }

    _setSubstatus('fe', 'Đang lưu...', 'ok');
    var saved = await _saveEnroll(st.goc, embedding);
    if (!saved) {
      _setSubstatus('fe', 'Lưu không thành công, đang thử lại...', 'err');
      await new Promise(function (r) { setTimeout(r, 1500); });
      i--; continue;
    }
    _setSubstatus('fe', '✓ Đã ghi nhận (' + (i + 1) + '/3)', 'ok');
    await new Promise(function (r) { setTimeout(r, 700); });
  }

  if (_enrollStream) { _stopCam(_enrollStream); _enrollStream = null; }
  _showEnrollDone();
}

async function _saveEnroll(goc, embedding) {
  try {
    var res = await supa.rpc('fn_face_enroll_v2', {
      p_ma_nv: SESSION.ma, p_goc: goc, p_embedding: embedding,
      p_device: navigator.userAgent.substring(0, 100)
    });
    if (res.error) throw res.error;
    if (!res.data || !res.data.ok) {
      if (typeof showToast === 'function') showToast('Lỗi: ' + (res.data && res.data.message), 'err');
      return false;
    }
    return true;
  } catch (e) {
    if (typeof showToast === 'function') showToast('Lỗi: ' + (e.message || 'network'), 'err');
    return false;
  }
}

function _showEnrollDone() {
  var body = document.getElementById('ns-face-modal-body');
  if (!body) return;
  body.innerHTML =
    '<div class="ns-face-step active">' +
      '<div class="ns-face-success-stage">' +
        '<div class="ns-face-icon-big success">' +
          '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</div>' +
        '<h3>Đăng ký thành công</h3>' +
        '<p>Khuôn mặt của bạn đã được lưu. Từ giờ bạn có thể chấm công bằng cách quét gương mặt.</p>' +
        '<button class="ns-face-btn-primary" onclick="nsFaceCloseEnrollment()">Hoàn tất</button>' +
      '</div>' +
    '</div>';
  var lbl = document.getElementById('menu-face-status');
  if (lbl) { lbl.textContent = '✓ Đã đăng ký'; lbl.style.color = '#0F6E56'; }
}

/* ════════════════ FLOW 2: XÁC MINH (chấm công) ════════════════ */
var _verifyAbort = { aborted: false };
var _verifyStream = null;
var _verifyCallback = { onSuccess: null, onFail: null };

async function v2StartChamCong(onSuccess, onFail) {
  _verifyCallback = { onSuccess: onSuccess, onFail: onFail };
  _stopAllStreams();

  var enrolled = false;
  try {
    var res = await supa.rpc('fn_face_enroll_status_v2', { p_ma_nv: SESSION.ma });
    enrolled = res.data && res.data.completed;
  } catch (e) {}

  if (!enrolled) {
    // NV cũ (đã đăng ký bản 1) hay NV mới đều đi qua đây — hệ mới cần mẫu mới 1 lần
    if (window.confirm('Hệ thống quét khuôn mặt vừa được nâng cấp (nhanh và nhẹ hơn).\n\nBạn cần đăng ký lại khuôn mặt một lần (~1 phút). Đăng ký ngay?\nHủy: chấm công bằng ảnh tay.')) {
      v2OpenEnrollment();
    } else {
      if (onFail) onFail({ reason: 'no_enroll', fallback: true });
    }
    return;
  }

  _verifyAbort = { aborted: false };
  var old = document.getElementById('ns-face-verify-modal');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = 'ns-face-verify-modal';
  modal.className = 'ns-face-modal';
  modal.innerHTML =
    '<div class="ns-face-header">' +
      '<button class="ns-face-close" onclick="nsFaceCloseVerify()">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '<div class="ns-face-title">Xác minh khuôn mặt</div>' +
    '</div>' +
    '<div class="ns-face-body" id="ns-face-verify-modal-body">' +
      '<div class="ns-face-step active" id="fv-step"></div>' +
    '</div>';
  document.body.appendChild(modal);
  requestAnimationFrame(function () { modal.classList.add('open'); });

  _buildStage(document.getElementById('fv-step'), 'fv');

  var video = document.getElementById('fv-video');
  _setInstruction('fv', 'Đang mở camera…');
  try {
    _verifyStream = await _openCam(video);
    if (video.paused) _setInstruction('fv', 'Chạm vào vòng tròn để bật camera');
  } catch (e) {
    var isPerm = e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || /denied|permission/i.test(e.message || ''));
    if (isPerm) {
      _setInstruction('fv', 'Cần cấp quyền camera');
      _setSubstatus('fv', 'Vào Cài đặt cho phép camera, rồi bấm "Thử lại"', 'err');
    } else if (e && e.name === 'CameraTimeoutError') {
      _setInstruction('fv', 'Không mở được camera');
      _setSubstatus('fv', 'Kiểm tra quyền Camera trong Cài đặt > Safari, đóng app đang dùng camera, rồi bấm "Thử lại" — hoặc chấm công bằng ảnh tay', 'err');
    } else {
      _setInstruction('fv', 'Không mở được camera');
      _setSubstatus('fv', 'Bấm "Thử lại" hoặc chấm công bằng ảnh tay', 'err');
    }
    _addRetryBtn('fv', _fvRetry);
    _addFallbackBtn();
    return;
  }
  if (_verifyAbort.aborted) return;

  _setInstruction('fv', 'Chuẩn bị máy quét…');
  _setSubstatus('fv', 'Đang tải bộ nhận diện… ' + _loadPct + '%', 'ok');
  var ok = await _ensureLoaded(function (pct) { _setSubstatus('fv', 'Đang tải bộ nhận diện… ' + pct + '%', 'ok'); });
  if (_verifyAbort.aborted) return;
  if (!ok) {
    _setInstruction('fv', 'Không tải được máy quét');
    _setSubstatus('fv', 'Kiểm tra mạng rồi bấm "Thử lại"', 'err');
    _addRetryBtn('fv', _fvRetry);
    _addFallbackBtn();
    return;
  }
  _setSubstatus('fv', '', '');
  _setInstruction('fv', 'Đặt khuôn mặt vào khung');

  _runVerifyAttempt(video, 0);
}

async function _runVerifyAttempt(video, attempt) {
  if (_verifyAbort.aborted) return;
  if (attempt >= 3) {
    _setInstruction('fv', 'Đã thử 3 lần không thành công');
    _setSubstatus('fv', 'Bấm bên dưới để chấm công bằng ảnh tay', 'err');
    _addFallbackBtn();
    return;
  }

  _setInstruction('fv', attempt === 0 ? 'Đặt khuôn mặt vào khung' : 'Vui lòng thử lại');
  var embedding = await _smoothScan(video, 'fv', _verifyAbort);
  if (_verifyAbort.aborted) return;
  if (!embedding) {
    _setSubstatus('fv', 'Chưa lấy được nét mặt', 'err');
    await new Promise(function (r) { setTimeout(r, 1200); });
    _runVerifyAttempt(video, attempt + 1);
    return;
  }

  _setSubstatus('fv', 'Đang xác thực...', 'ok');
  var result = await _submitVerify(embedding);

  if (result && result.passed) {
    var matchPct = result.match_pct !== undefined ? result.match_pct : '?';
    var faceImageB64 = _captureFaceFrame(video);
    _showVerifySuccess(matchPct);
    _haptic([30, 50, 30, 50, 60]);
    var cb = _verifyCallback.onSuccess;
    setTimeout(function () {
      v2CloseVerify();
      if (cb) cb({ match_pct: matchPct, distance: result.cosine, faceImage: faceImageB64 });
    }, CFG.SUCCESS_MS);
  } else {
    var matchPct2 = result && result.match_pct !== undefined ? result.match_pct : '?';
    var needPct = result && result.threshold_pct ? result.threshold_pct : 70;
    _setInstruction('fv', 'Chưa đạt độ chính xác yêu cầu');
    _setSubstatus('fv', 'Tương đồng ' + matchPct2 + '% — cần tối thiểu ' + needPct + '%', 'err');
    _haptic([100, 50, 100]);
    await new Promise(function (r) { setTimeout(r, 1500); });
    _runVerifyAttempt(video, attempt + 1);
  }
}

function _showVerifySuccess(matchPct) {
  var body = document.getElementById('ns-face-verify-modal-body');
  if (!body) return;
  body.innerHTML =
    '<div class="ns-face-step active">' +
      '<div class="ns-face-success-stage">' +
        '<div class="ns-face-icon-big success">' +
          '<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</div>' +
        '<h3>Xác thực thành công</h3>' +
        '<p style="font-size:15px;margin-top:4px">Độ tương đồng <b style="color:#2BC084;font-size:18px">' + matchPct + '%</b></p>' +
        '<p style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:8px">Đang chuyển sang chấm công...</p>' +
      '</div>' +
    '</div>';
}

async function _submitVerify(embedding) {
  try {
    var res = await supa.rpc('fn_face_verify_v2', {
      p_ma_nv: SESSION.ma, p_embedding: embedding,
      p_device: navigator.userAgent.substring(0, 100)
    });
    if (res.error) throw res.error;
    return res.data;
  } catch (e) {
    return { ok: false, passed: false, error: e.message };
  }
}

function _addFallbackBtn() {
  var body = document.getElementById('ns-face-verify-modal-body');
  if (!body || body.querySelector('.ns-face-btn-secondary:not(.ns-face-btn-retry)')) return;
  var btn = document.createElement('button');
  btn.className = 'ns-face-btn-secondary';
  btn.textContent = 'Chấm công bằng ảnh tay';
  btn.onclick = function () {
    var cb = _verifyCallback.onFail;
    v2CloseVerify();
    if (cb) cb({ reason: 'low_sim', fallback: true });
  };
  body.appendChild(btn);
}
function _addRetryBtn(prefix, onClick) {
  var modalId = prefix === 'fe' ? 'ns-face-modal-body' : 'ns-face-verify-modal-body';
  var body = document.getElementById(modalId);
  if (!body || body.querySelector('.ns-face-btn-retry')) return;
  var btn = document.createElement('button');
  btn.className = 'ns-face-btn-secondary ns-face-btn-retry';
  btn.textContent = '↻ Thử lại';
  btn.onclick = onClick;
  body.appendChild(btn);
}

function v2CloseVerify() {
  _verifyAbort.aborted = true;
  if (_verifyStream) { _stopCam(_verifyStream); _verifyStream = null; }
  var m = document.getElementById('ns-face-verify-modal');
  if (m) { m.classList.remove('open'); setTimeout(function () { m.remove(); }, 250); }
}
function _fvRetry() {
  var cb = _verifyCallback;
  v2CloseVerify();
  setTimeout(function () { v2StartChamCong(cb.onSuccess, cb.onFail); }, 300);
}

/* ════════════════ ROUTER: công tắc app_settings `face.v2` ════════════════
 * Lưu bản gốc v1 rồi override window.nsFace* bằng hàm ĐỊNH TUYẾN TẠI THỜI ĐIỂM GỌI.
 * File này nạp SAU face-recognition.js (index.html) nên window.nsFace* lúc này = v1.
 * Close* override gọi CẢ HAI (idempotent — modal dùng chung ID, mỗi bên tự dọn stream của mình)
 * để nút ✕ trong modal (onclick="nsFaceCloseVerify()") luôn đóng đúng dù engine nào mở. */
var _v1 = {
  start:      window.nsFaceStartChamCong,
  enroll:     window.nsFaceOpenEnrollment,
  preload:    window.nsFacePreload,
  closeV:     window.nsFaceCloseVerify,
  closeE:     window.nsFaceCloseEnrollment
};

function _v2On() {
  try {
    if (typeof SESSION === 'undefined' || !SESSION || !SESSION.ma) return false;
    var v = (typeof _getSetting === 'function') ? _getSetting('face.v2', 'off') : 'off';
    if (v === true || v === 'true' || v === 'all') return true;
    if (v === 'ns00490' || v === 'test') return SESSION.ma === 'NS00490';
    return false;
  } catch (e) { return false; }
}

window.nsFaceStartChamCong = function (onSuccess, onFail) {
  if (_v2On()) return v2StartChamCong(onSuccess, onFail);
  return _v1.start ? _v1.start(onSuccess, onFail) : undefined;
};
window.nsFaceOpenEnrollment = function () {
  if (_v2On()) return v2OpenEnrollment();
  return _v1.enroll ? _v1.enroll() : undefined;
};
window.nsFacePreload = function () {
  if (_v2On()) return v2Preload();
  return _v1.preload ? _v1.preload() : undefined;
};
window.nsFaceCloseVerify = function () {
  try { if (_v1.closeV) _v1.closeV(); } catch (e) {}
  v2CloseVerify();
};
window.nsFaceCloseEnrollment = function () {
  try { if (_v1.closeE) _v1.closeE(); } catch (e) {}
  v2CloseEnrollment();
};

// Hook debug/bench (dùng cho trang test + soi từ console iPhone)
window.NSFACE2 = {
  version: '2.0',
  on: _v2On,
  simd: _simdOk,
  ensureLoaded: _ensureLoaded,
  detectOnCanvas: _detectOnCanvas,
  refineAndEmbed: _refineAndEmbed,
  trackOnce: _trackOnce,
  smoothScan: _smoothScan,
  buildStage: _buildStage,
  cfg: CFG,
  dbg: _dbg
};
})();
