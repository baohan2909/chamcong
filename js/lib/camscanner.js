/* ═══════════════════════════════════════════════════════════════════════════
 *  NÓN SƠN — CAMSCANNER v1.0
 *  Detect 4 góc tờ A4 → perspective transform → enhance → output JPEG
 *  
 *  Stack:
 *    - OpenCV.js WASM (lazy load 3MB) — image processing
 *    - Native MediaDevices.getUserMedia — camera stream
 *
 *  Public API:
 *    csOpen({ onComplete: (blob, dataUrl)=>{}, onCancel: ()=>{} })
 *    csClose()
 * ═══════════════════════════════════════════════════════════════════════════ */

(function(global){
  const CV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';
  let _cv = null, _cvLoading = null;
  let _stream = null, _container = null;
  let _onComplete = null, _onCancel = null;
  let _corners = null;        // {tl, tr, br, bl} sau detect
  let _videoEl = null, _canvasOverlay = null;
  let _capturedImageData = null;

  /** Lazy load OpenCV.js WASM */
  function loadOpenCV(){
    if (_cv) return Promise.resolve(_cv);
    if (_cvLoading) return _cvLoading;
    _cvLoading = new Promise((resolve, reject)=>{
      // Đã load rồi trong window?
      if (global.cv && global.cv.imread) {
        _cv = global.cv; return resolve(_cv);
      }
      const s = document.createElement('script');
      s.src = CV_URL;
      s.async = true;
      s.onload = ()=>{
        // OpenCV cần thời gian init WASM
        if (global.cv) {
          if (global.cv.imread) { _cv = global.cv; resolve(_cv); }
          else global.cv.onRuntimeInitialized = ()=>{ _cv = global.cv; resolve(_cv); };
        } else reject(new Error('OpenCV load fail'));
      };
      s.onerror = ()=> reject(new Error('Không tải được OpenCV.js'));
      document.head.appendChild(s);
    });
    return _cvLoading;
  }

  /** Public: mở camera + UI */
  async function csOpen(opts){
    _onComplete = opts.onComplete || (()=>{});
    _onCancel = opts.onCancel || (()=>{});
    _buildUI();
    showStatus('Đang khởi động camera...');
    try {
      // Start camera trước (UX), load OpenCV song song
      const [stream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width:{ideal:1920}, height:{ideal:1080} },
          audio: false
        }),
        loadOpenCV().catch(e => { console.warn('OpenCV fail:', e); return null; })
      ]);
      _stream = stream;
      _videoEl.srcObject = stream;
      await _videoEl.play();
      showStatus('Đưa tờ giấy vào khung hình, giữ thẳng và đủ sáng');
      if (_cv) startDetectLoop();
    } catch(e){
      showStatus('Không truy cập được camera: ' + e.message, true);
    }
  }

  function csClose(){
    if (_stream) { _stream.getTracks().forEach(t=>t.stop()); _stream = null; }
    if (_container) { _container.remove(); _container = null; }
    _videoEl = _canvasOverlay = _corners = _capturedImageData = null;
  }

  function _buildUI(){
    _container = document.createElement('div');
    _container.id = 'cs-root';
    _container.innerHTML = `
      <style>
        #cs-root { position:fixed; inset:0; z-index:99999; background:#000; display:flex; flex-direction:column }
        #cs-top { padding:12px 16px; background:rgba(0,0,0,.75); color:#fff; display:flex; justify-content:space-between; align-items:center; font:600 14px/1.3 'Be Vietnam Pro',sans-serif }
        #cs-close { background:transparent; border:0; color:#fff; font-size:24px; cursor:pointer; padding:4px 12px }
        #cs-stage { flex:1; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center }
        #cs-video, #cs-overlay { position:absolute; inset:0; width:100%; height:100% }
        #cs-overlay { pointer-events:none }
        #cs-status { position:absolute; top:16px; left:50%; transform:translateX(-50%); background:rgba(15,46,69,.92); color:#fff; padding:8px 16px; border-radius:99px; font:500 13px 'Be Vietnam Pro'; backdrop-filter:blur(8px); white-space:nowrap }
        #cs-status.err { background:#B91C1C }
        #cs-bottom { padding:16px; background:rgba(0,0,0,.85); display:flex; justify-content:center; align-items:center; gap:24px }
        #cs-shutter { width:72px; height:72px; border-radius:50%; background:#fff; border:4px solid #1B4965; cursor:pointer; transition:transform .15s }
        #cs-shutter:active { transform:scale(.92) }
        #cs-preview-stage { position:absolute; inset:0; background:#000; display:none; align-items:center; justify-content:center; flex-direction:column; padding:16px; gap:12px }
        #cs-preview-stage.on { display:flex }
        #cs-preview-img { max-width:100%; max-height:70vh; object-fit:contain; box-shadow:0 8px 24px rgba(0,0,0,.5); border-radius:4px }
        .cs-action-row { display:flex; gap:12px; width:100%; max-width:480px }
        .cs-btn { flex:1; padding:14px 20px; border:0; border-radius:12px; font:600 15px 'Be Vietnam Pro'; cursor:pointer }
        .cs-btn-primary { background:#1B4965; color:#fff }
        .cs-btn-secondary { background:#374151; color:#fff }
      </style>
      <div id="cs-top">
        <span>Chụp biên bản bàn giao</span>
        <button id="cs-close">✕</button>
      </div>
      <div id="cs-stage">
        <video id="cs-video" playsinline muted></video>
        <canvas id="cs-overlay"></canvas>
        <div id="cs-status">Đang khởi động...</div>
        <div id="cs-preview-stage">
          <img id="cs-preview-img" alt="">
          <div class="cs-action-row">
            <button class="cs-btn cs-btn-secondary" id="cs-retake">Chụp lại</button>
            <button class="cs-btn cs-btn-primary" id="cs-use">Dùng ảnh này</button>
          </div>
        </div>
      </div>
      <div id="cs-bottom">
        <button id="cs-shutter" aria-label="Chụp"></button>
      </div>
    `;
    document.body.appendChild(_container);
    _videoEl = _container.querySelector('#cs-video');
    _canvasOverlay = _container.querySelector('#cs-overlay');
    _container.querySelector('#cs-close').onclick = ()=>{ csClose(); _onCancel(); };
    _container.querySelector('#cs-shutter').onclick = capture;
    _container.querySelector('#cs-retake').onclick = retake;
    _container.querySelector('#cs-use').onclick = useImage;
  }

  function showStatus(msg, isError){
    const el = _container && _container.querySelector('#cs-status');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
  }

  /** Vòng lặp detect 4 góc realtime trên overlay */
  let _detectTimer = null;
  function startDetectLoop(){
    if (!_cv || !_videoEl) return;
    const tick = ()=>{
      if (!_videoEl || _videoEl.paused) return;
      try { detectCornersFrame(); } catch(e){ /* skip frame */ }
    };
    _detectTimer = setInterval(tick, 350);  // 3 fps đủ
  }
  function stopDetectLoop(){
    if (_detectTimer) { clearInterval(_detectTimer); _detectTimer = null; }
  }

  function detectCornersFrame(){
    const cv = _cv;
    const vw = _videoEl.videoWidth, vh = _videoEl.videoHeight;
    if (!vw || !vh) return;
    
    // Resize overlay match video
    _canvasOverlay.width = vw; _canvasOverlay.height = vh;
    
    // Snapshot frame to temp canvas
    const tmp = document.createElement('canvas');
    tmp.width = vw; tmp.height = vh;
    tmp.getContext('2d').drawImage(_videoEl, 0, 0);
    
    let src = cv.imread(tmp), gray = new cv.Mat(), blur = new cv.Mat(), edges = new cv.Mat();
    let contours = new cv.MatVector(), hier = new cv.Mat();
    
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);
      cv.Canny(blur, edges, 75, 200);
      cv.findContours(edges, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // Tìm contour lớn nhất là tứ giác
      let bestQuad = null, bestArea = 0;
      const minArea = vw * vh * 0.15;
      for (let i = 0; i < contours.size(); i++){
        const c = contours.get(i);
        const area = cv.contourArea(c);
        if (area < minArea) { c.delete(); continue; }
        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * peri, true);
        if (approx.rows === 4 && area > bestArea){
          if (bestQuad) bestQuad.delete();
          bestQuad = approx;
          bestArea = area;
        } else approx.delete();
        c.delete();
      }

      if (bestQuad){
        _corners = extractCorners(bestQuad);
        drawOverlay(_corners, vw, vh);
        bestQuad.delete();
        showStatus('Đã thấy biên bản — bấm chụp');
      } else {
        clearOverlay();
        _corners = null;
        showStatus('Đưa toàn bộ tờ giấy vào khung hình');
      }
    } finally {
      src.delete(); gray.delete(); blur.delete(); edges.delete();
      contours.delete(); hier.delete();
    }
  }

  function extractCorners(approxMat){
    // approxMat.data32S [x0,y0,x1,y1,x2,y2,x3,y3]
    const pts = [];
    for (let i = 0; i < 4; i++) pts.push({ x: approxMat.data32S[i*2], y: approxMat.data32S[i*2+1] });
    // Sort thành tl, tr, br, bl
    const sumS = pts.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y));
    const diffS = pts.slice().sort((a,b)=>(a.x-a.y)-(b.x-b.y));
    return { tl: sumS[0], br: sumS[3], tr: diffS[3], bl: diffS[0] };
  }

  function drawOverlay(c, w, h){
    const ctx = _canvasOverlay.getContext('2d');
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = Math.max(3, w / 400);
    ctx.beginPath();
    ctx.moveTo(c.tl.x, c.tl.y);
    ctx.lineTo(c.tr.x, c.tr.y);
    ctx.lineTo(c.br.x, c.br.y);
    ctx.lineTo(c.bl.x, c.bl.y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(16,185,129,.15)';
    ctx.fill();
  }
  function clearOverlay(){
    const ctx = _canvasOverlay.getContext('2d');
    if (_canvasOverlay.width && _canvasOverlay.height)
      ctx.clearRect(0,0,_canvasOverlay.width,_canvasOverlay.height);
  }

  /** Chụp + warp + enhance */
  function capture(){
    if (!_videoEl) return;
    stopDetectLoop();
    const vw = _videoEl.videoWidth, vh = _videoEl.videoHeight;
    const tmp = document.createElement('canvas');
    tmp.width = vw; tmp.height = vh;
    tmp.getContext('2d').drawImage(_videoEl, 0, 0);

    if (_cv && _corners){
      try {
        const result = warpAndEnhance(tmp, _corners);
        showPreview(result);
        return;
      } catch(e){ console.error('warp fail:', e); }
    }
    // Fallback: chụp thường nếu không detect được
    showPreview(tmp);
  }

  function warpAndEnhance(srcCanvas, corners){
    const cv = _cv;
    const src = cv.imread(srcCanvas);
    
    // Calculate target dimensions (A4 ratio 1:1.414)
    const widthA = dist(corners.tl, corners.tr);
    const widthB = dist(corners.bl, corners.br);
    const heightA = dist(corners.tl, corners.bl);
    const heightB = dist(corners.tr, corners.br);
    const maxW = Math.max(widthA, widthB);
    const maxH = Math.max(heightA, heightB);
    const tw = Math.round(maxW), th = Math.round(maxH);

    const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners.tl.x, corners.tl.y, corners.tr.x, corners.tr.y,
      corners.br.x, corners.br.y, corners.bl.x, corners.bl.y
    ]);
    const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0, tw, 0, tw, th, 0, th
    ]);
    const M = cv.getPerspectiveTransform(srcMat, dstMat);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(tw, th));

    // Enhance: grayscale CLAHE + light sharpen
    const enhanced = enhanceImage(warped);
    
    const outCanvas = document.createElement('canvas');
    outCanvas.width = tw; outCanvas.height = th;
    cv.imshow(outCanvas, enhanced);
    
    src.delete(); srcMat.delete(); dstMat.delete(); M.delete(); warped.delete(); enhanced.delete();
    return outCanvas;
  }

  function enhanceImage(mat){
    const cv = _cv;
    // Convert to gray for CLAHE
    const lab = new cv.Mat();
    cv.cvtColor(mat, lab, cv.COLOR_RGBA2RGB);
    cv.cvtColor(lab, lab, cv.COLOR_RGB2Lab);
    const channels = new cv.MatVector();
    cv.split(lab, channels);
    const L = channels.get(0);
    const clahe = new cv.CLAHE(2.0, new cv.Size(8,8));
    clahe.apply(L, L);
    channels.set(0, L);
    cv.merge(channels, lab);
    const out = new cv.Mat();
    cv.cvtColor(lab, out, cv.COLOR_Lab2RGB);
    cv.cvtColor(out, out, cv.COLOR_RGB2RGBA);
    lab.delete(); channels.delete(); clahe.delete();
    return out;
  }

  function dist(a, b){ return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2); }

  function showPreview(canvas){
    const previewStage = _container.querySelector('#cs-preview-stage');
    const img = _container.querySelector('#cs-preview-img');
    // Downscale nếu quá to (>1600 width)
    const maxW = 1600;
    let outCanvas = canvas;
    if (canvas.width > maxW) {
      const ratio = maxW / canvas.width;
      outCanvas = document.createElement('canvas');
      outCanvas.width = maxW;
      outCanvas.height = Math.round(canvas.height * ratio);
      outCanvas.getContext('2d').drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);
    }
    const dataUrl = outCanvas.toDataURL('image/jpeg', 0.85);
    img.src = dataUrl;
    previewStage.classList.add('on');
    _capturedImageData = { dataUrl, canvas: outCanvas };
  }

  function retake(){
    _container.querySelector('#cs-preview-stage').classList.remove('on');
    _capturedImageData = null;
    if (_cv) startDetectLoop();
  }

  function useImage(){
    if (!_capturedImageData) return;
    _capturedImageData.canvas.toBlob(blob=>{
      const dataUrl = _capturedImageData.dataUrl;
      csClose();
      _onComplete(blob, dataUrl);
    }, 'image/jpeg', 0.85);
  }

  global.csOpen = csOpen;
  global.csClose = csClose;
})(window);
