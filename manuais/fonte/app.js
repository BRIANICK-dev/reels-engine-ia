// Reels Engine IA — manuais. Fonte do comportamento: edite aqui e rode "npm run manuais".
(function(){
  'use strict';
  var root = document.documentElement;
  function store(k, v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }

  /* Tema: auto / claro / escuro */
  var themeBtns = document.querySelectorAll('.theme button');
  function applyTheme(t){
    if(t==='light'||t==='dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    themeBtns.forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.t===(t||'auto'))); });
  }
  applyTheme(store('re-tema') || 'auto');
  themeBtns.forEach(function(b){ b.addEventListener('click', function(){ store('re-tema', b.dataset.t); applyTheme(b.dataset.t); }); });

  /* Menu no celular */
  var app = document.querySelector('.app');
  document.querySelectorAll('[data-menu]').forEach(function(b){ b.addEventListener('click', function(){ app.classList.toggle('open'); }); });
  document.querySelectorAll('.side a[href^="#"]').forEach(function(a){ a.addEventListener('click', function(){ app.classList.remove('open'); }); });

  /* Índice: marca a seção visível */
  var links = {}; document.querySelectorAll('nav.toc a[href^="#"]').forEach(function(a){ links[a.getAttribute('href').slice(1)] = a; });
  var secs = Array.prototype.slice.call(document.querySelectorAll('section.sec[id]'));
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ Object.keys(links).forEach(function(k){ links[k].classList.toggle('on', k===e.target.id); }); } });
    }, {rootMargin:'-20% 0px -70% 0px'});
    secs.forEach(function(s){ io.observe(s); });
  }

  /* Copiar comando */
  function copyText(t){
    if(navigator.clipboard && window.isSecureContext !== false){ return navigator.clipboard.writeText(t).catch(function(){ return legacy(t); }); }
    return Promise.resolve(legacy(t));
  }
  function legacy(t){ var ta=document.createElement('textarea'); ta.value=t; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} document.body.removeChild(ta); }
  document.querySelectorAll('.cmd').forEach(function(box){
    var btn = box.querySelector('.copy'); if(!btn) return;
    btn.addEventListener('click', function(){
      var pre = box.querySelector('pre').cloneNode(true);
      pre.querySelectorAll('.p,.c').forEach(function(n){ n.remove(); });
      var text = pre.textContent.split('\n').map(function(l){ return l.replace(/\s+$/,''); }).filter(Boolean).join('\n');
      copyText(text).then(function(){
        var label = btn.querySelector('span'); var old = label.textContent;
        btn.classList.add('done'); label.textContent = 'Copiado';
        setTimeout(function(){ btn.classList.remove('done'); label.textContent = old; }, 1600);
      });
    });
  });

  /* Abas (sistema operacional sincronizado em todo o manual) */
  function detectOS(){ var p=(navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||navigator.userAgent; p=String(p).toLowerCase(); if(p.indexOf('mac')>-1) return 'mac'; if(p.indexOf('linux')>-1&&p.indexOf('android')<0) return 'linux'; return 'win'; }
  function selectTab(group, key, save){
    document.querySelectorAll('.tabs[data-group="'+group+'"]').forEach(function(t){
      var has = t.querySelector('[data-key="'+key+'"]'); if(!has) return;
      t.querySelectorAll('.tablist button').forEach(function(b){ b.setAttribute('aria-selected', String(b.dataset.key===key)); b.tabIndex = b.dataset.key===key?0:-1; });
      t.querySelectorAll('.tabpanel').forEach(function(p){ p.hidden = p.dataset.key!==key; });
    });
    if(save) store('re-aba-'+group, key);
  }
  var groups = {};
  document.querySelectorAll('.tabs').forEach(function(t){
    groups[t.dataset.group]=1;
    t.querySelectorAll('.tablist button').forEach(function(b){
      b.addEventListener('click', function(){ selectTab(t.dataset.group, b.dataset.key, true); });
      b.addEventListener('keydown', function(e){
        if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft') return;
        var bs=[].slice.call(t.querySelectorAll('.tablist button')); var i=bs.indexOf(b)+(e.key==='ArrowRight'?1:-1);
        var n=bs[(i+bs.length)%bs.length]; n.focus(); selectTab(t.dataset.group, n.dataset.key, true);
      });
    });
  });
  Object.keys(groups).forEach(function(g){
    var first = document.querySelector('.tabs[data-group="'+g+'"] .tablist button');
    selectTab(g, store('re-aba-'+g) || (g==='os'?detectOS():first.dataset.key), false);
  });

  /* Busca simples: títulos e texto das seções */
  var input = document.querySelector('.search input'), list = document.querySelector('.results');
  var index = [];
  document.querySelectorAll('[data-busca]').forEach(function(el){
    var sec = el.closest('section.sec'); var title = el.getAttribute('data-busca') || el.textContent;
    var text = '';
    if(/^H[1-6]$/.test(el.tagName)){
      var n = el.closest('.tools') || el; text = el.textContent; n = n.nextElementSibling;
      while(n && !/^H[23]$/.test(n.tagName) && !n.classList.contains('tools') && !(n.querySelector && n.querySelector('h3[data-busca]'))){ text += ' ' + n.textContent; n = n.nextElementSibling; }
    } else if(el.matches('section')){
      var head = el.querySelector('.sec-head'); text = head ? head.textContent : '';
    } else text = el.textContent;
    index.push({id: el.id || (sec&&sec.id), title: title.trim(), sec: sec ? sec.getAttribute('data-titulo') : '', text: text.replace(/\s+/g,' ')});
  });
  function norm(s){ return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
  function esc(s){ return s.replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function snippet(text, q){
    var i = norm(text).indexOf(q); if(i<0) return '';
    var a = Math.max(0,i-38), b = Math.min(text.length, i+q.length+60);
    return (a>0?'…':'') + esc(text.slice(a,i)) + '<mark>' + esc(text.slice(i,i+q.length)) + '</mark>' + esc(text.slice(i+q.length,b)) + (b<text.length?'…':'');
  }
  function run(){
    var q = norm(input.value.trim()); list.innerHTML='';
    if(q.length<2) return;
    var hits = index.map(function(it){ var t=norm(it.title).indexOf(q)>-1, x=norm(it.text).indexOf(q)>-1; return (t||x)?{it:it,score:t?2:1}:null; }).filter(Boolean).sort(function(a,b){ return b.score-a.score; }).slice(0,8);
    if(!hits.length){ list.innerHTML='<li class="none">Nada encontrado. Tente outra palavra (ex.: terminal, erro, fonte).</li>'; return; }
    hits.forEach(function(h, k){
      var li=document.createElement('li');
      li.innerHTML='<a href="#'+h.it.id+'"'+(k===0?' class="on"':'')+'>'+esc(h.it.title)+'<small>'+(snippet(h.it.text,q)||esc(h.it.sec||''))+'</small></a>';
      li.querySelector('a').addEventListener('click', function(){ input.value=''; list.innerHTML=''; app.classList.remove('open'); });
      list.appendChild(li);
    });
  }
  if(input){
    input.addEventListener('input', run);
    input.addEventListener('keydown', function(e){
      var as=[].slice.call(list.querySelectorAll('a')); if(!as.length) return;
      var i=as.findIndex(function(a){ return a.classList.contains('on'); });
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); as[i].classList.remove('on'); i=(i+(e.key==='ArrowDown'?1:-1)+as.length)%as.length; as[i].classList.add('on'); }
      if(e.key==='Enter'){ e.preventDefault(); as[Math.max(i,0)].click(); location.hash = as[Math.max(i,0)].getAttribute('href'); }
      if(e.key==='Escape'){ input.value=''; list.innerHTML=''; }
    });
    document.addEventListener('keydown', function(e){
      var typing = /input|textarea/i.test((document.activeElement||{}).tagName||'');
      if((e.key==='/'&&!typing) || ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')){ e.preventDefault(); app.classList.add('open'); input.focus(); }
    });
  }

  /* Âncora dentro de um bloco fechado (Deu erro?): abre o bloco */
  function openTarget(){
    var id = decodeURIComponent(location.hash.slice(1)); if(!id) return;
    var el = document.getElementById(id); if(!el) return;
    var d = el.closest('details'); if(d && !d.open){ d.open = true; el.scrollIntoView(); }
    if(el.tagName==='DETAILS'){ el.open = true; }
  }
  window.addEventListener('hashchange', openTarget); openTarget();

  /* Checklist: lembra o que você já marcou (só neste navegador) */
  document.querySelectorAll('.checklist input[type=checkbox]').forEach(function(cb){
    var k = 're-check-' + cb.id;
    if(store(k)==='1') cb.checked = true;
    cb.addEventListener('change', function(){ store(k, cb.checked?'1':'0'); });
  });

  /* Miniaturas animadas: tocam só quando visíveis; botão pausar */
  var thumbs = document.querySelectorAll('.thumb');
  var playBtn = document.querySelector('[data-play]');
  var paused = store('re-miniaturas') === 'pausa';
  function setPaused(p){ paused=p; root.classList.toggle('thumbs-paused', p); if(playBtn){ playBtn.setAttribute('aria-pressed', String(!p)); playBtn.querySelector('span').textContent = p ? 'Animar miniaturas' : 'Pausar miniaturas'; } }
  setPaused(paused);
  if(playBtn) playBtn.addEventListener('click', function(){ setPaused(!paused); store('re-miniaturas', paused?'pausa':'anima'); });
  if('IntersectionObserver' in window && thumbs.length){
    var tio = new IntersectionObserver(function(es){ es.forEach(function(e){ e.target.classList.toggle('live', e.isIntersecting); }); }, {threshold:.2});
    thumbs.forEach(function(t){ tio.observe(t); });
  } else thumbs.forEach(function(t){ t.classList.add('live'); });
})();
