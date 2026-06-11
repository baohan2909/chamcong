/* ═══════════════════════════════════════════════════════════════════════════
 *  NÓN SƠN — CAMSCANNER v3 (PURE JS — KHÔNG OpenCV)
 *
 *  Lý do viết lại: OpenCV.js WASM 8MB tải từ docs.opencv.org quá chậm/treo
 *  trên mạng mobile VN. Phiên bản này 100% thuần JS, 0 dependency:
 *    • Perspective warp: homography 4 điểm (giải hệ 8x8 Gaussian elimination)
 *      + inverse mapping + bilinear sampling
 *    • Enhance: auto-levels (histogram percentile stretch) + contrast nhẹ
 *    • Ảnh tự downscale về max 2200px khi load (tránh crash memory iPhone)
 *    • EXIF orientation tự xử lý qua createImageBitmap
 *
 *  Public API:  csOpenFromFile(file, { onComplete:(blob)=>{}, onCancel })
 * ═══════════════════════════════════════════════════════════════════════════ */

(function(global){
  let _root = null, _canvas = null, _ctx = null;
  let _corners = null;
  let _img = null;          // canvas chứa ảnh đã downscale (max 2200px)
  let _displayScale = 1;
  let _dragIdx = -1;
  let _onComplete = null, _onCancel = null;
  let _rafPending = false;

  const MAX_EDIT_SIZE = 2200;   // downscale khi load
  const MAX_OUT_SIZE = 1700;    // output max chiều dài

  // ═══════════════════════════════════════════════════════════════════
  //  PUBLIC
  // ═══════════════════════════════════════════════════════════════════
  async function csOpenFromFile(file, opts){
    _onComplete = (opts && opts.onComplete) || (()=>{});
    _onCancel = (opts && opts.onCancel) || (()=>{});
    _buildUI();
    showStatus('Đang tải ảnh...');
    try {
      _img = await loadAndDownscale(file);
      drawImage();
      _corners = defaultCorners(_img.width, _img.height);
      drawOverlay();
      showStatus('Kéo 4 góc tròn cho khớp tờ giấy rồi bấm Lưu');
    } catch(e){
      console.error('[CamScanner]', e);
      showStatus('Lỗi đọc ảnh: ' + (e.message||e), true);
    }
  }

  function csClose(){
    if (_root){ _root.remove(); _root = null; }
    _canvas = _ctx = _corners = _img = null;
    _dragIdx = -1;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  LOAD + DOWNSCALE (xử lý EXIF, memory-safe)
  // ═══════════════════════════════════════════════════════════════════
  async function loadAndDownscale(file){
    let bmp;
    // createImageBitmap với imageOrientation tự xoay EXIF (Safari 15+, Chrome)
    try {
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch(_) {
      try {
        bmp = await createImageBitmap(file);
      } catch(_2) {
        // Fallback cổ điển: FileReader + Image
        bmp = await new Promise((res, rej)=>{
          const r = new FileReader();
          r.onload = e => {
            const im = new Image();
            im.onload = ()=>res(im);
            im.onerror = rej;
            im.src = e.target.result;
          };
          r.onerror = rej;
          r.readAsDataURL(file);
        });
      }
    }
    let w = bmp.width, h = bmp.height;
    const scale = Math.min(1, MAX_EDIT_SIZE / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) try { bmp.close(); } catch(_){}
    return c;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UI
  // ═══════════════════════════════════════════════════════════════════
  function _buildUI(){
    _root = document.createElement('div');
    _root.id = 'cs-root';
    _root.innerHTML = `
      <style>
        #cs-root { position:fixed; inset:0; z-index:99999; background:#0F172A; display:flex; flex-direction:column;
          font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif }
        #cs-top { padding:12px 14px; padding-top:max(12px, env(safe-area-inset-top)); background:#1E293B; color:#fff;
          display:flex; justify-content:space-between; align-items:center }
        #cs-top .ttl { font-size:14.5px; font-weight:700; letter-spacing:-.01em }
        #cs-close { background:rgba(255,255,255,.1); border:0; color:#fff; font-size:18px; cursor:pointer;
          width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center }
        #cs-stage { flex:1; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;
          padding:10px; touch-action:none }
        #cs-canvas { border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,.55); touch-action:none; cursor:grab; background:#fff }
        #cs-status { position:absolute; top:14px; left:50%; transform:translateX(-50%); background:rgba(30,41,59,.95);
          color:#fff; padding:9px 16px; border-radius:99px; font-size:12.5px; font-weight:600;
          backdrop-filter:blur(8px); white-space:nowrap; max-width:92%; overflow:hidden; text-overflow:ellipsis; z-index:5 }
        #cs-status.err { background:#B91C1C }
        #cs-bottom { padding:14px; padding-bottom:max(14px, env(safe-area-inset-bottom)); background:#1E293B;
          display:flex; gap:10px }
        .cs-btn { padding:13px 18px; border-radius:12px; border:0; font-size:14px; font-weight:700; cursor:pointer; flex:1;
          font-family:inherit; letter-spacing:-.005em }
        .cs-btn-full { background:#334155; color:#fff }
        .cs-btn-primary { background:linear-gradient(135deg,#10B981,#047857); color:#fff;
          box-shadow:0 6px 16px rgba(16,185,129,.35) }
        .cs-btn:active { transform:scale(.97) }
        .cs-btn:disabled { opacity:.5 }
        #cs-spinner { display:none; position:absolute; inset:0; background:rgba(15,23,42,.7); z-index:20;
          align-items:center; justify-content:center; flex-direction:column; gap:12px }
        #cs-spinner.on { display:flex }
        #cs-spinner .ring { width:44px; height:44px; border:4px solid rgba(255,255,255,.2); border-top-color:#10B981;
          border-radius:50%; animation:csspin .8s linear infinite }
        #cs-spinner .txt { color:#fff; font-size:13px; font-weight:600 }
        @keyframes csspin { to { transform:rotate(360deg) } }
      </style>
      <div id="cs-top">
        <div class="ttl">Căn chỉnh biên bản</div>
        <button id="cs-close">✕</button>
      </div>
      <div id="cs-stage">
        <canvas id="cs-canvas"></canvas>
        <div id="cs-status">Đang tải...</div>
        <div id="cs-spinner"><div class="ring"></div><div class="txt">Đang xử lý ảnh...</div></div>
      </div>
      <div id="cs-bottom">
        <button class="cs-btn cs-btn-full" id="cs-fullbtn">Toàn bộ ảnh</button>
        <button class="cs-btn cs-btn-primary" id="cs-apply">Lưu ảnh</button>
      </div>
    `;
    document.body.appendChild(_root);
    _canvas = _root.querySelector('#cs-canvas');
    _ctx = _canvas.getContext('2d');
    _root.querySelector('#cs-close').onclick = ()=>{ csClose(); _onCancel(); };
    _root.querySelector('#cs-apply').onclick = apply;
    _root.querySelector('#cs-fullbtn').onclick = ()=>{
      if (!_img) return;
      _corners = { tl:{x:0,y:0}, tr:{x:_img.width,y:0}, br:{x:_img.width,y:_img.height}, bl:{x:0,y:_img.height} };
      drawOverlay();
      showStatus('Đã chọn toàn bộ ảnh — bấm Lưu');
    };
    _canvas.addEventListener('pointerdown', onPointerDown);
    _canvas.addEventListener('pointermove', onPointerMove);
    _canvas.addEventListener('pointerup', onPointerUp);
    _canvas.addEventListener('pointercancel', onPointerUp);
  }

  function showStatus(msg, isError){
    const el = _root && _root.querySelector('#cs-status');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
  }
  function showSpinner(on){
    const el = _root && _root.querySelector('#cs-spinner');
    if (el) el.classList.toggle('on', !!on);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CANVAS DRAW (DPR sharp)
  // ═══════════════════════════════════════════════════════════════════
  function drawImage(){
    if (!_img) return;
    const stage = _root.querySelector('#cs-stage');
    const stageW = stage.clientWidth - 20, stageH = stage.clientHeight - 20;
    const ratio = Math.min(stageW/_img.width, stageH/_img.height, 1);
    const dw = Math.round(_img.width * ratio);
    const dh = Math.round(_img.height * ratio);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    _canvas.width = Math.round(dw * dpr);
    _canvas.height = Math.round(dh * dpr);
    _canvas.style.width = dw + 'px';
    _canvas.style.height = dh + 'px';
    _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _ctx.imageSmoothingEnabled = true;
    _ctx.imageSmoothingQuality = 'high';
    _displayScale = dw / _img.width;
    _ctx.drawImage(_img, 0, 0, dw, dh);
  }

  function drawOverlay(){
    if (!_corners || !_img) return;
    drawImage();
    const c = _corners, sc = _displayScale;
    const cw = parseFloat(_canvas.style.width), ch = parseFloat(_canvas.style.height);
    // Mask vùng ngoài
    _ctx.save();
    _ctx.fillStyle = 'rgba(15,23,42,.55)';
    _ctx.fillRect(0, 0, cw, ch);
    _ctx.globalCompositeOperation = 'destination-out';
    _ctx.beginPath();
    _ctx.moveTo(c.tl.x*sc, c.tl.y*sc);
    _ctx.lineTo(c.tr.x*sc, c.tr.y*sc);
    _ctx.lineTo(c.br.x*sc, c.br.y*sc);
    _ctx.lineTo(c.bl.x*sc, c.bl.y*sc);
    _ctx.closePath();
    _ctx.fill();
    _ctx.restore();
    // Stroke
    _ctx.strokeStyle = '#10B981';
    _ctx.lineWidth = 2.5;
    _ctx.beginPath();
    _ctx.moveTo(c.tl.x*sc, c.tl.y*sc);
    _ctx.lineTo(c.tr.x*sc, c.tr.y*sc);
    _ctx.lineTo(c.br.x*sc, c.br.y*sc);
    _ctx.lineTo(c.bl.x*sc, c.bl.y*sc);
    _ctx.closePath();
    _ctx.stroke();
    // Handles
    for (const p of [c.tl, c.tr, c.br, c.bl]){
      const cx = p.x*sc, cy = p.y*sc;
      _ctx.beginPath(); _ctx.arc(cx, cy, 15, 0, Math.PI*2);
      _ctx.fillStyle = '#fff'; _ctx.fill();
      _ctx.beginPath(); _ctx.arc(cx, cy, 10, 0, Math.PI*2);
      const grd = _ctx.createRadialGradient(cx-2, cy-2, 1, cx, cy, 10);
      grd.addColorStop(0, '#34D399'); grd.addColorStop(1, '#047857');
      _ctx.fillStyle = grd; _ctx.fill();
    }
  }

  function defaultCorners(w, h){
    const pad = Math.min(w, h) * 0.06;
    return {
      tl: { x: pad, y: pad },
      tr: { x: w-pad, y: pad },
      br: { x: w-pad, y: h-pad },
      bl: { x: pad, y: h-pad }
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DRAG
  // ═══════════════════════════════════════════════════════════════════
  function onPointerDown(e){
    if (!_corners) return;
    e.preventDefault();
    const rect = _canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / _displayScale;
    const y = (e.clientY - rect.top) / _displayScale;
    const pts = [_corners.tl, _corners.tr, _corners.br, _corners.bl];
    let minD = Infinity, mi = -1;
    for (let i = 0; i < 4; i++){
      const d = Math.hypot(pts[i].x-x, pts[i].y-y);
      if (d < minD){ minD = d; mi = i; }
    }
    if (minD < 48 / _displayScale){
      _dragIdx = mi;
      try { _canvas.setPointerCapture(e.pointerId); } catch(_){}
      _canvas.style.cursor = 'grabbing';
    }
  }
  function onPointerMove(e){
    if (_dragIdx < 0 || !_corners || !_img) return;
    e.preventDefault();
    const rect = _canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(_img.width, (e.clientX - rect.left) / _displayScale));
    const y = Math.max(0, Math.min(_img.height, (e.clientY - rect.top) / _displayScale));
    _corners[['tl','tr','br','bl'][_dragIdx]] = { x, y };
    if (!_rafPending){
      _rafPending = true;
      requestAnimationFrame(()=>{ drawOverlay(); _rafPending = false; });
    }
  }
  function onPointerUp(e){
    if (_dragIdx >= 0){
      _dragIdx = -1;
      _canvas.style.cursor = 'grab';
      try { _canvas.releasePointerCapture(e.pointerId); } catch(_){}
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  APPLY: HOMOGRAPHY WARP THUẦN JS + ENHANCE
  // ═══════════════════════════════════════════════════════════════════
  async function apply(){
    if (!_corners || !_img){ showStatus('Chưa có vùng cắt', true); return; }
    const btn = _root.querySelector('#cs-apply');
    btn.disabled = true;
    showSpinner(true);
    // Cho UI render spinner trước khi block main thread
    await new Promise(r => setTimeout(r, 60));
    try {
      const out = warpPerspective(_img, _corners);
      enhanceCanvas(out);
      out.toBlob(blob => {
        showSpinner(false);
        csClose();
        _onComplete(blob);
      }, 'image/jpeg', 0.88);
    } catch(e){
      console.error('[CamScanner apply]', e);
      showSpinner(false);
      showStatus('Lỗi xử lý: ' + (e.message||e), true);
      btn.disabled = false;
    }
  }

  /** Tính homography H (3x3) map từ dst → src cho 4 cặp điểm.
   *  dst: (0,0),(W,0),(W,H),(0,H) — src: 4 góc user chọn.
   *  Giải hệ 8x8 bằng Gaussian elimination. */
  function computeHomography(srcPts, W, H){
    // dstPts theo thứ tự tl,tr,br,bl
    const dst = [[0,0],[W,0],[W,H],[0,H]];
    const src = [[srcPts.tl.x,srcPts.tl.y],[srcPts.tr.x,srcPts.tr.y],[srcPts.br.x,srcPts.br.y],[srcPts.bl.x,srcPts.bl.y]];
    // Ma trận A (8x8) * h = b — h = [h11..h32], h33=1
    const A = [], b = [];
    for (let i = 0; i < 4; i++){
      const [x, y] = dst[i];     // điểm đích
      const [u, v] = src[i];     // điểm nguồn
      // u = (h11x + h12y + h13) / (h31x + h32y + 1)
      A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v*x, -v*y]); b.push(v);
    }
    const h = solveLinear(A, b);
    return [h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1];
  }

  /** Gaussian elimination với partial pivoting cho hệ NxN */
  function solveLinear(A, b){
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++){
      // pivot
      let maxRow = col;
      for (let r = col+1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
      const pivot = M[col][col];
      if (Math.abs(pivot) < 1e-10) throw new Error('Singular matrix — góc trùng nhau');
      for (let r = col+1; r < n; r++){
        const f = M[r][col] / pivot;
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    const x = new Array(n);
    for (let r = n-1; r >= 0; r--){
      let s = M[r][n];
      for (let c = r+1; c < n; c++) s -= M[r][c] * x[c];
      x[r] = s / M[r][r];
    }
    return x;
  }

  /** Warp: inverse mapping + bilinear sampling */
  function warpPerspective(srcCanvas, corners){
    // Output size theo độ dài cạnh trung bình
    const widthTop = Math.hypot(corners.tr.x-corners.tl.x, corners.tr.y-corners.tl.y);
    const widthBot = Math.hypot(corners.br.x-corners.bl.x, corners.br.y-corners.bl.y);
    const heightL = Math.hypot(corners.bl.x-corners.tl.x, corners.bl.y-corners.tl.y);
    const heightR = Math.hypot(corners.br.x-corners.tr.x, corners.br.y-corners.tr.y);
    let W = Math.round(Math.max(widthTop, widthBot));
    let Hh = Math.round(Math.max(heightL, heightR));
    // Cap output
    const scale = Math.min(1, MAX_OUT_SIZE / Math.max(W, Hh));
    W = Math.max(50, Math.round(W * scale));
    Hh = Math.max(50, Math.round(Hh * scale));

    const Hm = computeHomography(corners, W, Hh);
    const [h11,h12,h13,h21,h22,h23,h31,h32] = Hm;

    const srcCtx = srcCanvas.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const sd = srcData.data, sw = srcCanvas.width, sh = srcCanvas.height;

    const out = document.createElement('canvas');
    out.width = W; out.height = Hh;
    const outCtx = out.getContext('2d');
    const outData = outCtx.createImageData(W, Hh);
    const od = outData.data;

    let oi = 0;
    for (let y = 0; y < Hh; y++){
      for (let x = 0; x < W; x++){
        const denom = h31*x + h32*y + 1;
        const u = (h11*x + h12*y + h13) / denom;
        const v = (h21*x + h22*y + h23) / denom;
        if (u >= 0 && u < sw-1 && v >= 0 && v < sh-1){
          // Bilinear
          const x0 = u|0, y0 = v|0;
          const dx = u - x0, dy = v - y0;
          const i00 = (y0*sw + x0)*4;
          const i10 = i00 + 4;
          const i01 = i00 + sw*4;
          const i11 = i01 + 4;
          const w00 = (1-dx)*(1-dy), w10 = dx*(1-dy), w01 = (1-dx)*dy, w11 = dx*dy;
          od[oi]   = sd[i00]*w00 + sd[i10]*w10 + sd[i01]*w01 + sd[i11]*w11;
          od[oi+1] = sd[i00+1]*w00 + sd[i10+1]*w10 + sd[i01+1]*w01 + sd[i11+1]*w11;
          od[oi+2] = sd[i00+2]*w00 + sd[i10+2]*w10 + sd[i01+2]*w01 + sd[i11+2]*w11;
          od[oi+3] = 255;
        } else {
          od[oi] = od[oi+1] = od[oi+2] = 255; od[oi+3] = 255;
        }
        oi += 4;
      }
    }
    outCtx.putImageData(outData, 0, 0);
    return out;
  }

  /** Enhance: auto-levels percentile stretch (cho giấy trắng chữ đen rõ) */
  function enhanceCanvas(canvas){
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const n = d.length / 4;
    // Histogram luminance
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4){
      const lum = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114) | 0;
      hist[lum]++;
    }
    // Percentile 1% và 97%
    const lowCount = n * 0.01, highCount = n * 0.97;
    let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++){ acc += hist[i]; if (acc >= lowCount){ lo = i; break; } }
    acc = 0;
    for (let i = 0; i < 256; i++){ acc += hist[i]; if (acc >= highCount){ hi = i; break; } }
    if (hi - lo < 30){ lo = 0; hi = 255; }  // ảnh phẳng — bỏ stretch
    const range = hi - lo;
    // LUT
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++){
      let v = (i - lo) * 255 / range;
      // Tăng contrast nhẹ (S-curve mềm)
      v = v + (v - 128) * 0.12;
      lut[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    for (let i = 0; i < d.length; i += 4){
      d[i] = lut[d[i]];
      d[i+1] = lut[d[i+1]];
      d[i+2] = lut[d[i+2]];
    }
    ctx.putImageData(imgData, 0, 0);
  }

  global.csOpenFromFile = csOpenFromFile;
  global.csClose = csClose;
})(window);
