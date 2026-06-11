/* ═══════════════════════════════════════════════════════════════════════════
 *  NÓN SƠN — CAMSCANNER v2 (FILE PICKER MODE)
 *  Public API:  csOpenFromFile(file, { onComplete:(blob)=>{}, onCancel })
 *  
 *  Flow:
 *    1. Nhận File object (từ <input type="file">)
 *    2. Load vào <img>, detect 4 góc auto (OpenCV.js lazy)
 *    3. User có thể kéo 4 góc handle để điều chỉnh
 *    4. Apply: perspective transform + CLAHE enhance → output JPEG blob
 *
 *  KHÔNG mở camera trực tiếp — chỉ xử lý ảnh đã chọn.
 * ═══════════════════════════════════════════════════════════════════════════ */

(function(global){
  const CV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';
  let _cv = null, _cvLoading = null;
  let _root = null, _imgEl = null, _canvas = null, _ctx = null;
  let _corners = null;
  let _imgData = null; // { width, height, naturalImg }
  let _displayScale = 1;
  let _dragIdx = -1;
  let _onComplete = null, _onCancel = null;

  function loadOpenCV(){
    if (_cv) return Promise.resolve(_cv);
    if (_cvLoading) return _cvLoading;
    _cvLoading = new Promise((resolve, reject)=>{
      if (global.cv && global.cv.imread){ _cv = global.cv; return resolve(_cv); }
      const s = document.createElement('script');
      s.src = CV_URL; s.async = true;
      s.onload = ()=>{
        if (!global.cv) return reject(new Error('OpenCV load fail'));
        if (global.cv.imread) { _cv = global.cv; resolve(_cv); }
        else global.cv.onRuntimeInitialized = ()=>{ _cv = global.cv; resolve(_cv); };
      };
      s.onerror = ()=> reject(new Error('Không tải được OpenCV.js'));
      document.head.appendChild(s);
    });
    return _cvLoading;
  }

  async function csOpenFromFile(file, opts){
    _onComplete = opts.onComplete || (()=>{});
    _onCancel = opts.onCancel || (()=>{});
    _buildUI();
    showStatus('Đang tải ảnh...');
    
    try {
      const dataUrl = await readFileAsDataURL(file);
      const img = await loadImage(dataUrl);
      _imgData = { naturalImg: img };
      drawImage();
      // Default corners ngay — KHÔNG block chờ OpenCV. User kéo thủ công.
      _corners = defaultCorners(img.width, img.height);
      drawOverlay();
      showStatus('Kéo 4 góc cho khớp tờ giấy, hoặc bấm "Phát hiện lại" để tự động');
      // Lazy preload OpenCV ngầm để khi bấm "Phát hiện lại" sẽ nhanh
      loadOpenCV().catch(e => console.warn('OpenCV preload failed:', e));
    } catch(e){
      showStatus('Lỗi đọc ảnh: ' + e.message, true);
    }
  }

  function csClose(){
    if (_root){ _root.remove(); _root = null; }
    _imgEl = _canvas = _ctx = _corners = _imgData = null;
  }

  function _buildUI(){
    _root = document.createElement('div');
    _root.id = 'cs-root';
    _root.innerHTML = `
      <style>
        #cs-root { position:fixed; inset:0; z-index:9999; background:#0F172A; display:flex; flex-direction:column; font-family:inherit }
        #cs-top { padding:12px 14px; background:#1E293B; color:#fff; display:flex; justify-content:space-between; align-items:center; }
        #cs-top .ttl { font-size:14px; font-weight:700 }
        #cs-close { background:transparent; border:0; color:#fff; font-size:22px; cursor:pointer; padding:4px 12px }
        #cs-stage { flex:1; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; padding:8px; touch-action:none }
        #cs-canvas { max-width:100%; max-height:100%; border-radius:6px; box-shadow:0 8px 32px rgba(0,0,0,.5); touch-action:none; cursor:grab; background:#fff }
        #cs-status { position:absolute; top:12px; left:50%; transform:translateX(-50%); background:rgba(30,41,59,.95); color:#fff; padding:8px 14px; border-radius:99px; font-size:12px; font-weight:600; backdrop-filter:blur(8px); white-space:nowrap; max-width:90%; text-align:center }
        #cs-status.err { background:#B91C1C }
        #cs-bottom { padding:14px; padding-bottom:max(14px, env(safe-area-inset-bottom)); background:#1E293B; display:flex; gap:10px; align-items:center; justify-content:space-between }
        .cs-btn { padding:11px 18px; border-radius:10px; border:0; font-size:13.5px; font-weight:700; cursor:pointer; flex:1 }
        .cs-btn-secondary { background:#475569; color:#fff }
        .cs-btn-primary { background:linear-gradient(180deg,#1B4965,#0F2E45); color:#fff }
        .cs-btn-redo { background:#334155; color:#fff }
      </style>
      <div id="cs-top">
        <div class="ttl">Căn chỉnh biên bản</div>
        <button id="cs-close">✕</button>
      </div>
      <div id="cs-stage">
        <canvas id="cs-canvas"></canvas>
        <div id="cs-status">Đang tải...</div>
      </div>
      <div id="cs-bottom">
        <button class="cs-btn cs-btn-redo" id="cs-redo">Phát hiện lại</button>
        <button class="cs-btn cs-btn-primary" id="cs-apply">Lưu ảnh</button>
      </div>
    `;
    document.body.appendChild(_root);
    _canvas = _root.querySelector('#cs-canvas');
    _ctx = _canvas.getContext('2d');
    _root.querySelector('#cs-close').onclick = ()=>{ csClose(); _onCancel(); };
    _root.querySelector('#cs-apply').onclick = apply;
    _root.querySelector('#cs-redo').onclick = redoDetect;

    // Touch/mouse handlers cho kéo góc
    const stage = _root.querySelector('#cs-stage');
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

  function readFileAsDataURL(file){
    return new Promise((res, rej)=>{
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function loadImage(src){
    return new Promise((res, rej)=>{
      const img = new Image();
      img.onload = ()=> res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  function drawImage(){
    if (!_imgData) return;
    const img = _imgData.naturalImg;
    const stage = _root.querySelector('#cs-stage');
    const sw = stage.clientWidth - 16, sh = stage.clientHeight - 16;
    let dw = img.width, dh = img.height;
    if (dw > sw) { dh = dh * sw / dw; dw = sw; }
    if (dh > sh) { dw = dw * sh / dh; dh = sh; }
    _canvas.width = dw;
    _canvas.height = dh;
    _canvas.style.width = dw + 'px';
    _canvas.style.height = dh + 'px';
    _displayScale = dw / img.width;  // ratio display vs natural
    _ctx.drawImage(img, 0, 0, dw, dh);
  }

  function drawOverlay(){
    if (!_corners) return;
    drawImage();  // base layer
    const c = _corners;
    const sc = _displayScale;
    // Vẽ polygon
    _ctx.strokeStyle = '#14B8A6';
    _ctx.lineWidth = 3;
    _ctx.fillStyle = 'rgba(20,184,166,.15)';
    _ctx.beginPath();
    _ctx.moveTo(c.tl.x*sc, c.tl.y*sc);
    _ctx.lineTo(c.tr.x*sc, c.tr.y*sc);
    _ctx.lineTo(c.br.x*sc, c.br.y*sc);
    _ctx.lineTo(c.bl.x*sc, c.bl.y*sc);
    _ctx.closePath();
    _ctx.fill();
    _ctx.stroke();
    // Handles 4 góc
    const pts = [c.tl, c.tr, c.br, c.bl];
    for (const p of pts){
      _ctx.beginPath();
      _ctx.arc(p.x*sc, p.y*sc, 12, 0, Math.PI*2);
      _ctx.fillStyle = '#fff';
      _ctx.fill();
      _ctx.lineWidth = 3;
      _ctx.strokeStyle = '#14B8A6';
      _ctx.stroke();
    }
  }

  function defaultCorners(w, h){
    const pad = Math.min(w, h) * 0.08;
    return {
      tl: { x: pad, y: pad },
      tr: { x: w-pad, y: pad },
      br: { x: w-pad, y: h-pad },
      bl: { x: pad, y: h-pad }
    };
  }

  function autoDetectCorners(img){
    const cv = _cv;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    let src = cv.imread(c), gray = new cv.Mat(), blur = new cv.Mat(), edges = new cv.Mat();
    let contours = new cv.MatVector(), hier = new cv.Mat();
    let result = null;
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);
      cv.Canny(blur, edges, 75, 200);
      cv.findContours(edges, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      const minArea = img.width * img.height * 0.15;
      let bestQuad = null, bestArea = 0;
      for (let i = 0; i < contours.size(); i++){
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < minArea){ cnt.delete(); continue; }
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02*peri, true);
        if (approx.rows === 4 && area > bestArea){
          if (bestQuad) bestQuad.delete();
          bestQuad = approx;
          bestArea = area;
        } else approx.delete();
        cnt.delete();
      }
      if (bestQuad){
        const pts = [];
        for (let i = 0; i < 4; i++) pts.push({ x: bestQuad.data32S[i*2], y: bestQuad.data32S[i*2+1] });
        const sumS = pts.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y));
        const diffS = pts.slice().sort((a,b)=>(a.x-a.y)-(b.x-b.y));
        result = { tl: sumS[0], br: sumS[3], tr: diffS[3], bl: diffS[0] };
        bestQuad.delete();
      }
    } finally {
      src.delete(); gray.delete(); blur.delete(); edges.delete();
      contours.delete(); hier.delete();
    }
    return result;
  }

  async function redoDetect(){
    if (!_imgData) return;
    showStatus('Đang tải module nhận diện...');
    try {
      await loadOpenCV();
    } catch(e){
      showStatus('Không tải được module nhận diện. Kéo thủ công 4 góc.', true);
      return;
    }
    showStatus('Đang phát hiện khung...');
    setTimeout(()=>{
      try {
        const r = autoDetectCorners(_imgData.naturalImg);
        if (r){ _corners = r; drawOverlay(); showStatus('Đã phát hiện. Kéo góc nếu cần.'); }
        else showStatus('Không phát hiện được. Kéo thủ công 4 góc.', true);
      } catch(e){ showStatus('Lỗi: '+e.message, true); }
    }, 30);
  }

  // ─── Drag handles ────────────────────────────────────────────────
  function onPointerDown(e){
    if (!_corners) return;
    const rect = _canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / _displayScale;
    const y = (e.clientY - rect.top) / _displayScale;
    const pts = [_corners.tl, _corners.tr, _corners.br, _corners.bl];
    let minD = Infinity, mi = -1;
    for (let i = 0; i < 4; i++){
      const d = Math.hypot(pts[i].x-x, pts[i].y-y);
      if (d < minD) { minD = d; mi = i; }
    }
    if (minD * _displayScale < 30) {
      _dragIdx = mi;
      _canvas.setPointerCapture(e.pointerId);
      _canvas.style.cursor = 'grabbing';
    }
  }
  function onPointerMove(e){
    if (_dragIdx < 0 || !_corners) return;
    const rect = _canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(_imgData.naturalImg.width, (e.clientX - rect.left) / _displayScale));
    const y = Math.max(0, Math.min(_imgData.naturalImg.height, (e.clientY - rect.top) / _displayScale));
    const keys = ['tl','tr','br','bl'];
    _corners[keys[_dragIdx]] = { x, y };
    drawOverlay();
  }
  function onPointerUp(e){
    if (_dragIdx >= 0) {
      _dragIdx = -1;
      _canvas.style.cursor = 'grab';
      try { _canvas.releasePointerCapture(e.pointerId); } catch(_){}
    }
  }

  // ─── Apply: warp + enhance + output blob ──────────────────────────
  async function apply(){
    if (!_corners){ showStatus('Chưa có vùng để cắt', true); return; }
    showStatus('Đang xử lý...');
    const btn = _root.querySelector('#cs-apply');
    btn.disabled = true;
    try {
      let outCanvas;
      if (_cv){
        outCanvas = warpAndEnhance();
      } else {
        // Fallback: crop bounding box, không perspective
        outCanvas = cropBBoxFallback();
      }
      // Downscale nếu > 1600
      if (outCanvas.width > 1600){
        const r = 1600/outCanvas.width;
        const c2 = document.createElement('canvas');
        c2.width = 1600; c2.height = Math.round(outCanvas.height*r);
        c2.getContext('2d').drawImage(outCanvas, 0, 0, c2.width, c2.height);
        outCanvas = c2;
      }
      outCanvas.toBlob(blob => {
        csClose();
        _onComplete(blob);
      }, 'image/jpeg', 0.85);
    } catch(e){
      console.error(e);
      showStatus('Lỗi: ' + e.message, true);
      btn.disabled = false;
    }
  }

  function warpAndEnhance(){
    const cv = _cv;
    const img = _imgData.naturalImg;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const src = cv.imread(c);
    const corners = _corners;
    const widthA = Math.hypot(corners.tr.x-corners.tl.x, corners.tr.y-corners.tl.y);
    const widthB = Math.hypot(corners.br.x-corners.bl.x, corners.br.y-corners.bl.y);
    const heightA = Math.hypot(corners.bl.x-corners.tl.x, corners.bl.y-corners.tl.y);
    const heightB = Math.hypot(corners.br.x-corners.tr.x, corners.br.y-corners.tr.y);
    const tw = Math.round(Math.max(widthA, widthB));
    const th = Math.round(Math.max(heightA, heightB));
    const srcMat = cv.matFromArray(4,1,cv.CV_32FC2,[
      corners.tl.x, corners.tl.y, corners.tr.x, corners.tr.y,
      corners.br.x, corners.br.y, corners.bl.x, corners.bl.y
    ]);
    const dstMat = cv.matFromArray(4,1,cv.CV_32FC2,[ 0,0, tw,0, tw,th, 0,th ]);
    const M = cv.getPerspectiveTransform(srcMat, dstMat);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(tw, th));

    // CLAHE enhance
    const lab = new cv.Mat();
    cv.cvtColor(warped, lab, cv.COLOR_RGBA2RGB);
    cv.cvtColor(lab, lab, cv.COLOR_RGB2Lab);
    const ch = new cv.MatVector();
    cv.split(lab, ch);
    const L = ch.get(0);
    const clahe = new cv.CLAHE(2.0, new cv.Size(8,8));
    clahe.apply(L, L);
    ch.set(0, L);
    cv.merge(ch, lab);
    const out = new cv.Mat();
    cv.cvtColor(lab, out, cv.COLOR_Lab2RGB);
    cv.cvtColor(out, out, cv.COLOR_RGB2RGBA);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = tw; outCanvas.height = th;
    cv.imshow(outCanvas, out);
    src.delete(); srcMat.delete(); dstMat.delete(); M.delete(); warped.delete();
    lab.delete(); ch.delete(); clahe.delete(); out.delete();
    return outCanvas;
  }

  function cropBBoxFallback(){
    const img = _imgData.naturalImg;
    const c = _corners;
    const xs = [c.tl.x, c.tr.x, c.br.x, c.bl.x];
    const ys = [c.tl.y, c.tr.y, c.br.y, c.bl.y];
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
    return cv;
  }

  global.csOpenFromFile = csOpenFromFile;
  global.csClose = csClose;
})(window);
