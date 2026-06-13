/* ════════════════════════════════════════════════════════════════════════════
 *  [v13.41] NHÂN VIÊN AI — Sprint B1
 *  Page chat ChatGPT-style + floating button + session sidebar + agent call
 * ════════════════════════════════════════════════════════════════════════════ */

let nvaiCurrentSession = null;  // {id, tieu_de, message_count}
let nvaiSessionList = [];
let nvaiMessages = [];           // [{role, content, tool_calls, meta, created_at}]
let nvaiSending = false;

// Show floating button cho ADMIN sau khi login
function nvaiInitFab(){
  const fab = document.getElementById('nvai-fab');
  const menu = document.getElementById('menu-nvai');
  if (!fab) return;
  const isAdmin = (typeof SESSION !== 'undefined' && SESSION && SESSION.vaiTro === 'ADMIN');
  fab.style.display = isAdmin ? '' : 'none';
  if (menu) menu.style.display = isAdmin ? '' : 'none';
}

// Hook vào khi page load
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(nvaiInitFab, 1500); // chờ SESSION load
  });
  // Re-check sau mỗi 2s đầu phòng race
  let nvaiTries = 0;
  const iv = setInterval(() => {
    nvaiInitFab();
    nvaiTries++;
    if (nvaiTries > 5) clearInterval(iv);
  }, 1000);
}

// Page init khi vào page-nvai
window.nvaiPageInit = async function(){
  const isAdmin = (typeof SESSION !== 'undefined' && SESSION && SESSION.vaiTro === 'ADMIN');
  if (!isAdmin) {
    showToast && showToast('Tính năng dành cho ADMIN', 'warn');
    goToPage('home');
    return;
  }
  // Ẩn FAB khi đang ở page nvai
  const fab = document.getElementById('nvai-fab');
  if (fab) fab.style.display = 'none';
  await nvaiLoadSessions();
};

// Hook khi rời page nvai → show FAB lại
window.nvaiPageLeave = function(){
  nvaiInitFab();
};

async function nvaiLoadSessions(){
  try {
    const { data, error } = await supa.rpc('fn_chat_session_list', { p_ma_nv: SESSION.ma, p_limit: 30 });
    if (error) throw error;
    nvaiSessionList = Array.isArray(data) ? data : [];
    nvaiRenderSessionList();
  } catch(e){
    const box = document.getElementById('nvai-session-list');
    if (box) box.innerHTML = `<div class="ns-empty" style="color:#DC2626;font-size:11.5px">Lỗi: ${escHtml(e.message)}</div>`;
  }
}

function nvaiRenderSessionList(){
  const box = document.getElementById('nvai-session-list');
  if (!box) return;
  if (nvaiSessionList.length === 0) {
    box.innerHTML = '<div class="ns-empty" style="font-size:11.5px">Chưa có cuộc nào</div>';
    return;
  }
  box.innerHTML = nvaiSessionList.map(s => {
    const isActive = nvaiCurrentSession && nvaiCurrentSession.id === s.id;
    const t = new Date(s.updated_at);
    const tStr = nvaiFmtAgo(t);
    return `<div class="nvai-sess-row ${isActive?'active':''}" onclick="nvaiOpenSession('${s.id}')">
      <div class="nvai-sess-ttl">${escHtml(s.tieu_de || 'Không tên')}</div>
      <div class="nvai-sess-meta">${tStr} · ${s.message_count||0} tin</div>
      <button class="nvai-sess-del" onclick="event.stopPropagation(); nvaiDeleteSession('${s.id}')" title="Xóa">✕</button>
    </div>`;
  }).join('');
}

function nvaiFmtAgo(t){
  const diff = Date.now() - t.getTime();
  const min = Math.floor(diff/60000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return min + 'p';
  const h = Math.floor(min/60);
  if (h < 24) return h + ' giờ';
  const d = Math.floor(h/24);
  if (d < 7) return d + ' ngày';
  return pad(t.getDate())+'/'+pad(t.getMonth()+1);
}

window.nvaiNewChat = function(){
  nvaiCurrentSession = null;
  nvaiMessages = [];
  nvaiRenderSessionList();
  const list = document.getElementById('nvai-msg-list');
  if (list) {
    list.innerHTML = `<div class="nvai-welcome">
      <div class="nvai-welcome-ttl">Xin chào, em là Nhân viên AI của anh.</div>
      <div class="nvai-welcome-sub">Em hiểu data toàn hệ thống Nón Sơn: nhân sự, chấm công, lịch ca, bàn giao, sự vụ. Anh hỏi tự nhiên, em truy vấn data thật và trả lời.</div>
      <div class="nvai-suggest-grid">
        <button class="nvai-suggest" onclick="nvaiSendSuggest('Cho anh xem tổng quan hệ thống hôm nay')">Tổng quan hệ thống hôm nay</button>
        <button class="nvai-suggest" onclick="nvaiSendSuggest('Hôm nay có ai đi trễ hoặc chưa chấm công không?')">Ai đi trễ hôm nay?</button>
        <button class="nvai-suggest" onclick="nvaiSendSuggest('Liệt kê các sự vụ KHẨN CẤP đang còn mở')">Sự vụ khẩn cấp đang mở</button>
        <button class="nvai-suggest" onclick="nvaiSendSuggest('Top 5 cửa hàng có nhiều sự vụ nhất 7 ngày qua')">Top CH nhiều vấn đề</button>
      </div>
    </div>`;
  }
};

window.nvaiOpenSession = async function(sid){
  try {
    const { data, error } = await supa.rpc('fn_chat_message_list', { p_session_id: sid, p_ma_nv: SESSION.ma });
    if (error || (data && data.ok === false)) throw new Error((data&&data.error)||error.message);
    nvaiCurrentSession = nvaiSessionList.find(s => s.id === sid);
    nvaiMessages = data.messages || [];
    nvaiRenderSessionList();
    nvaiRenderMessages();
  } catch(e){ showToast('⚠ ' + e.message, 'warn'); }
};

window.nvaiDeleteSession = async function(sid){
  if (!confirm('Xóa cuộc hội thoại này? Không thể hoàn tác.')) return;
  try {
    const { data, error } = await supa.rpc('fn_chat_session_delete', { p_id: sid, p_ma_nv: SESSION.ma });
    if (error || (data && data.ok === false)) throw new Error((data&&data.error)||error.message);
    if (nvaiCurrentSession && nvaiCurrentSession.id === sid) nvaiNewChat();
    await nvaiLoadSessions();
  } catch(e){ showToast('⚠ ' + e.message, 'warn'); }
};

function nvaiRenderMessages(){
  const list = document.getElementById('nvai-msg-list');
  if (!list) return;
  if (nvaiMessages.length === 0) {
    nvaiNewChat();
    return;
  }
  list.innerHTML = nvaiMessages.map(m => nvaiRenderMsg(m)).join('');
  // Scroll to bottom
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
}

function nvaiRenderMsg(m){
  if (m.role === 'user') {
    return `<div class="nvai-msg user"><div class="nvai-bubble user">${escHtml(m.content||'')}</div></div>`;
  }
  if (m.role === 'assistant') {
    const tcCount = Array.isArray(m.tool_calls) ? m.tool_calls.length : 0;
    const tokens = m.meta && m.meta.tokens_out ? m.meta.tokens_out : null;
    const model = m.meta && m.meta.model ? (m.meta.model.includes('haiku') ? 'Haiku' : 'Sonnet') : '';
    const body = nvaiFormatMarkdown(m.content || '');
    return `<div class="nvai-msg assistant">
      <div class="nvai-avatar">AI</div>
      <div class="nvai-bubble assistant">
        ${tcCount>0?`<div class="nvai-tool-hint">Đã truy vấn ${tcCount} tool</div>`:''}
        <div class="nvai-content">${body}</div>
        ${(model||tokens)?`<div class="nvai-meta-foot">${model}${tokens?' · '+tokens+' tokens out':''}</div>`:''}
      </div>
    </div>`;
  }
  return '';
}

// Markdown lite: **bold**, *italic*, `code`, list "- ", line break
function nvaiFormatMarkdown(text){
  let s = escHtml(text||'');
  // Bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  // Italic
  s = s.replace(/(?<![\*])\*([^*\n]+)\*(?![\*])/g, '<i>$1</i>');
  // Inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // List items
  s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>[\s\S]+?<\/li>)/g, m => '<ul>'+m+'</ul>');
  // Headings
  s = s.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  s = s.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  // Line break
  s = s.replace(/\n/g, '<br>');
  return s;
}

window.nvaiOnKey = function(e){
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    nvaiSendMessage();
  }
};

window.nvaiAutoResize = function(el){
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
};

window.nvaiSendSuggest = function(text){
  const input = document.getElementById('nvai-input');
  if (input) {
    input.value = text;
    nvaiAutoResize(input);
  }
  nvaiSendMessage();
};

window.nvaiSendMessage = async function(){
  if (nvaiSending) return;
  const input = document.getElementById('nvai-input');
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text) return;
  
  // Push user msg vào UI ngay
  nvaiMessages.push({ role: 'user', content: text, created_at: new Date().toISOString() });
  nvaiRenderMessages();
  
  input.value = '';
  nvaiAutoResize(input);
  nvaiSending = true;
  nvaiAddThinkingBubble();
  document.getElementById('nvai-send-btn').disabled = true;
  
  try {
    // Build history (loại trừ message user vừa thêm, sẽ truyền riêng)
    const history = nvaiMessages.slice(0, -1).filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
      role: m.role,
      content: m.content || ''
    }));
    
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch(`${supa.supabaseUrl}/functions/v1/ai-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || supa.supabaseKey}`,
        'apikey': supa.supabaseKey
      },
      body: JSON.stringify({
        ma_nv: SESSION.ma,
        session_id: nvaiCurrentSession?.id || null,
        user_message: text,
        history
      })
    });
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || 'Lỗi AI');
    
    // Update session_id (nếu tạo mới)
    if (!nvaiCurrentSession && result.session_id) {
      nvaiCurrentSession = { id: result.session_id, tieu_de: text.slice(0,60), message_count: 2 };
    }
    
    // Append assistant
    nvaiMessages.push({
      role: 'assistant',
      content: result.reply,
      tool_calls: result.tool_calls_detail || null,
      meta: {
        model: result.model,
        tokens_in: result.tokens?.input,
        tokens_out: result.tokens?.output
      },
      created_at: new Date().toISOString()
    });
    
    nvaiRemoveThinkingBubble();
    nvaiRenderMessages();
    await nvaiLoadSessions();  // refresh sidebar
    
  } catch(e){
    nvaiRemoveThinkingBubble();
    nvaiMessages.push({
      role: 'assistant',
      content: '⚠ Lỗi: ' + e.message,
      created_at: new Date().toISOString()
    });
    nvaiRenderMessages();
  } finally {
    nvaiSending = false;
    document.getElementById('nvai-send-btn').disabled = false;
  }
};

function nvaiAddThinkingBubble(){
  const list = document.getElementById('nvai-msg-list');
  if (!list) return;
  const b = document.createElement('div');
  b.id = 'nvai-thinking';
  b.className = 'nvai-msg assistant';
  b.innerHTML = `<div class="nvai-avatar">AI</div>
    <div class="nvai-bubble assistant"><div class="nvai-typing"><span></span><span></span><span></span></div></div>`;
  list.appendChild(b);
  list.scrollTop = list.scrollHeight;
}
function nvaiRemoveThinkingBubble(){
  const b = document.getElementById('nvai-thinking');
  if (b) b.remove();
}
