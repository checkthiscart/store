/* ============================================================
   checkthiscart — SHARED SITE ENGINE
   Fetches products.json and renders cards for whichever section
   exists on the current page. Also runs scroll-progress, reveal,
   and tilt animations. Used by index.html and every collection page.

   Product/category text is built with DOM APIs (createElement +
   textContent), not innerHTML, so anything pasted into the admin
   panel is always treated as plain text — never as HTML/script.
   ============================================================ */

(function(){
  "use strict";

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- data loading ---------- */
  function loadProducts(){
    return fetch('products.json', { cache: 'no-store' })
      .then(function(res){
        if(!res.ok) throw new Error('products.json request failed: ' + res.status);
        return res.json();
      });
  }

  /* ---------- small DOM helpers ---------- */
  function el(tag, opts){
    var node = document.createElement(tag);
    opts = opts || {};
    if(opts.class) node.className = opts.class;
    if(opts.text !== undefined) node.textContent = opts.text;
    if(opts.href) node.setAttribute('href', opts.href);
    if(opts.attrs){
      Object.keys(opts.attrs).forEach(function(k){ node.setAttribute(k, opts.attrs[k]); });
    }
    return node;
  }

  function mediaNode(imageValue, className){
    // imageValue is either an emoji/short string, or an http(s) image URL
    var wrap = el('div', { class: className });
    var isUrl = typeof imageValue === 'string' && /^https?:\/\//i.test(imageValue.trim());
    if(isUrl){
      var img = document.createElement('img');
      img.src = imageValue.trim();
      img.alt = '';
      img.loading = 'lazy';
      wrap.appendChild(img);
    } else {
      var span = el('span', { class: 'ph-icon', text: imageValue || '🛒' });
      wrap.appendChild(span);
    }
    return wrap;
  }

  function featureList(features){
    var ul = el('ul', { class: 'features' });
    (features || []).forEach(function(f){
      ul.appendChild(el('li', { text: f }));
    });
    return ul;
  }

  /* ---------- renderers ---------- */
  function renderCategoryGrid(container, categories){
    container.innerHTML = '';
    categories.forEach(function(cat, i){
      var side = i % 2 === 0 ? 'reveal-left' : 'reveal-right';
      var card = el('a', { class: 'tag-card reveal ' + side, attrs: { href: cat.page } });
      card.appendChild(el('span', { class: 'tag-id', text: cat.shelf || '' }));
      card.appendChild(el('span', { class: 'icon', text: cat.icon || '🛒' }));
      card.appendChild(el('h3', { text: cat.label }));
      card.appendChild(el('p', { text: cat.description || '' }));
      card.appendChild(el('span', { class: 'go', text: 'View collection →' }));
      container.appendChild(card);
    });
  }

  function renderTrendingGrid(container, trending){
    container.innerHTML = '';
    var sorted = trending.slice().sort(function(a,b){ return (a.rank||0) - (b.rank||0); });
    sorted.forEach(function(p){
      var card = el('article', { class: 'product-card reveal reveal-scale' });

      var media = mediaNode(p.image, 'product-media');
      media.appendChild(el('span', { class: 'rank mono', text: '#' + (p.rank || '?') + ' TRENDING' }));
      card.appendChild(media);

      var body = el('div', { class: 'product-body' });
      body.appendChild(el('h3', { text: p.title }));
      body.appendChild(el('p', { class: 'hook', text: p.hook }));
      body.appendChild(featureList(p.features));

      var priceRow = el('div', { class: 'price-row' });
      priceRow.appendChild(el('span', { class: 'price', text: p.price || '' }));
      priceRow.appendChild(el('a', {
        class: 'amz-btn', text: 'Check price →', href: p.link,
        attrs: { target: '_blank', rel: 'nofollow noopener sponsored' }
      }));
      body.appendChild(priceRow);

      card.appendChild(body);
      container.appendChild(card);
    });
  }

  function renderCollectionList(container, products, collectionMeta){
    container.innerHTML = '';
    if(!products || products.length === 0){
      var empty = el('div', { class: 'empty-state' });
      empty.appendChild(el('strong', { text: 'No products here yet' }));
      empty.appendChild(document.createTextNode('Add some from the admin panel and they\u2019ll show up here.'));
      container.appendChild(empty);
      return;
    }
    products.forEach(function(p, i){
      var block = el('article', { class: 'product-block reveal' });

      var media = mediaNode(p.image, 'pb-media');
      media.appendChild(el('span', { class: 'rank mono', text: 'PICK ' + String(i + 1).padStart(2, '0') }));
      block.appendChild(media);

      var body = el('div', { class: 'pb-body' });
      body.appendChild(el('h2', { text: p.title }));
      body.appendChild(el('p', { class: 'hook', text: p.hook }));
      body.appendChild(featureList(p.features));

      var footer = el('div', { class: 'pb-footer' });
      footer.appendChild(el('span', { class: 'price', text: p.price || '' }));
      footer.appendChild(el('a', {
        class: 'amz-btn', text: 'Check price on Amazon →', href: p.link,
        attrs: { target: '_blank', rel: 'nofollow noopener sponsored' }
      }));
      body.appendChild(footer);

      block.appendChild(body);
      container.appendChild(block);
    });
  }

  /* ---------- animation system ---------- */
  function initScrollProgress(){
    var bar = document.getElementById('scrollProgress');
    var glow = document.getElementById('heroGlow');
    var ticking = false;
    function update(){
      var doc = document.documentElement;
      var scrollTop = doc.scrollTop || document.body.scrollTop;
      var scrollHeight = (doc.scrollHeight - doc.clientHeight) || 1;
      var pct = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
      if(bar) bar.style.width = pct + '%';
      if(glow && !reduceMotion){
        var offset = Math.min(window.scrollY, 400);
        glow.style.transform = 'translateY(' + (offset * 0.25) + 'px) translateX(' + (offset * -0.08) + 'px)';
      }
      ticking = false;
    }
    update();
    window.addEventListener('scroll', function(){
      if(!ticking){ ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
  }

  function initReveal(){
    var revealEls = document.querySelectorAll('.reveal');
    if('IntersectionObserver' in window && !reduceMotion){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(entry, i){
          if(entry.isIntersecting){
            var target = entry.target;
            setTimeout(function(){ target.classList.add('in'); }, (i % 6) * 60);
            io.unobserve(target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach(function(elm){ io.observe(elm); });
    } else {
      revealEls.forEach(function(elm){ elm.classList.add('in'); });
    }
  }

  function initTilt(selector){
    if(!canHover || reduceMotion) return;
    document.querySelectorAll(selector).forEach(function(card){
      var bounds, raf = null;
      card.addEventListener('mouseenter', function(){ bounds = card.getBoundingClientRect(); });
      card.addEventListener('mousemove', function(e){
        if(raf) return;
        raf = requestAnimationFrame(function(){
          var x = e.clientX - bounds.left, y = e.clientY - bounds.top;
          var cx = bounds.width / 2, cy = bounds.height / 2;
          var rotateX = ((y - cy) / cy) * -4;
          var rotateY = ((x - cx) / cx) * 4;
          card.style.transform = 'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateY(-2px)';
          raf = null;
        });
      });
      card.addEventListener('mouseleave', function(){ card.style.transform = ''; });
    });
  }

  /* ---------- page bootstrap ---------- */
  // Each page sets window.CTC_PAGE before loading this script, e.g.:
  //   { type: 'hub' }
  //   { type: 'collection', collectionId: 'gourmet-gifts' }
  function boot(){
    var pageConfig = window.CTC_PAGE || { type: 'hub' };

    initScrollProgress();

    loadProducts().then(function(data){
      if(pageConfig.type === 'hub'){
        var catGrid = document.getElementById('categoryGrid');
        var trendGrid = document.getElementById('trendingGrid');
        if(catGrid) renderCategoryGrid(catGrid, data.categories || []);
        if(trendGrid) renderTrendingGrid(trendGrid, data.trending || []);
      } else if(pageConfig.type === 'collection'){
        var meta = (data.categories || []).find(function(c){ return c.id === pageConfig.collectionId; });
        var titleEl = document.getElementById('collectionTitle');
        var ledeEl = document.getElementById('collectionLede');
        var eyebrowEl = document.getElementById('collectionEyebrow');
        if(meta){
          if(titleEl) titleEl.textContent = meta.label + ' worth adding to cart';
          if(eyebrowEl) eyebrowEl.textContent = 'Shelf ' + (meta.shelf ? meta.shelf.split('/')[0].trim() : '');
          if(ledeEl && !ledeEl.dataset.custom) ledeEl.textContent = meta.description;
        }
        var listEl = document.getElementById('productList');
        var products = (data.collections || {})[pageConfig.collectionId] || [];
        if(listEl) renderCollectionList(listEl, products, meta);
      }

      initReveal();
      initTilt('.tag-card, .product-card, .product-block');
    }).catch(function(err){
      console.error('checkthiscart: failed to load products.json', err);
      var fallback = document.getElementById('trendingGrid') || document.getElementById('productList');
      if(fallback){
        fallback.innerHTML = '';
        var msg = el('div', { class: 'empty-state' });
        msg.appendChild(el('strong', { text: 'Content failed to load' }));
        msg.appendChild(document.createTextNode('Could not fetch products.json. Refresh, or check that the file exists at the site root.'));
        fallback.appendChild(msg);
      }
      initReveal();
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
