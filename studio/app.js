(function () {
  const { Vault, AudioEngine, Editorial } = window.WhimsyStudio;
  const STORAGE_KEY = 'whimsy_studio_v10_state';
  const LIVE_KEY = 'whimsy_live_v10';
  const busV10 = ('BroadcastChannel' in window) ? new BroadcastChannel('whimsy_studio_v10') : null;

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const LENS_NAMES = [
    'Arte', 'Ciencia y buenas noticias científicas', 'Espiritualidad (cero autoayuda)',
    'La Biblia y filología antigua', 'Innovación abierta (Open Innovation)',
    'Innovación en la educación', 'IA y tecnología', 'Grandes ideas y filosofía',
    'Cine', 'Poesía', 'Libros', 'Física', 'Botánica', 'Moda y cultura textil',
    'Conocimiento aborigen y ancestral', 'Movimientos sociales', 'Los colores',
    'Percepción del idioma'
  ];

  const RIGHTS_META = {
    own_cc0: { cls: 'r-own_cc0', label: '🟢 Propio / CC0', short: '🟢 Propio/CC0', canAir: true },
    permission: { cls: 'r-permission', label: '🟡 Permiso archivado', short: '🟡 Permiso', canAir: true },
    critical_quote: { cls: 'r-critical_quote', label: '🟡 Cita crítica + crédito', short: '🟡 Cita', canAir: true },
    read_only: { cls: 'r-read_only', label: '🔴 Solo lectura (prensa)', short: '🔴 Solo lectura', canAir: false }
  };

  let rssData = { generatedAt: '', suggestedWords: [], feeds: [], items: [] };
  let vaultMediaList = [];
  let filteredItems = [];
  let state = loadState();

  // UI ephemeral state
  let currentMode = 'radar'; // radar | mesa | cabina
  let railMode = { type: 'filter', value: 'all' }; // filter | lens | feed | vault
  let searchQuery = '';
  let viewAsGrid = false;
  let activeCandidateWord = '';
  let selectedItemId = null;
  let paperDarkTheme = false;

  // Zoom overlay state
  let zoomOpen = false;
  let zoomView = 'read'; // read | visual
  let zoomMediaIdx = 0;
  let zoomScale = 1;
  let zoomFontPx = 19;
  let zoomPan = { x: 0, y: 0, dragging: false, startX: 0, startY: 0 };
  let pendingQuoteText = '';

  // Mesa / Cabina state
  let bankTab = 'notes'; // notes | media
  let inspTab = 'preview'; // preview | guests | pack
  let selectedBlockId = null;
  let cabinTab = 'block'; // block | gateras
  let cabinBlockIdx = 0;
  let prompterFontRem = 1.45;
  let activeCamMode = 'loop';
  let activeBumper = false;
  let currentRightMedia = null;
  let currentCenterMedia = null;
  let currentGuestCard = null;
  let currentBgLoop = 'loops/sol_rambla_pajaros.mp4';

  // Aire timer & Marcadores K
  let recTimerRunning = false;
  let recSeconds = 0;
  let recInterval = null;
  let clipMarkers = [];
  let openClipIn = null;
  let chaptersRecorded = [];
  let dragBlockId = null;
  let recordingSlot = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.programs) && parsed.programs.length) {
          parsed.trackCuration = parsed.trackCuration || { 'A-7': 'top3', 'A-2': 'top3', 'B-4': 'top3', 'B-9': 'cortina' };
          return parsed;
        }
      }
    } catch {}
    const pilot = Editorial.createPilotProgram();
    return {
      activeProgramId: pilot.episodioId,
      programs: [pilot],
      readIds: [],
      savedIds: [],
      customRadarItems: [],
      chosenNotes: [], // { id, title, sourceName, quote, url, lenses, createdAt }
      chosenMedia: [], // { id, url, vaultId, kind, name, rights, noDerivatives, credit, sourceUrl, permissionRef }
      gateras: [], // { id, title, sourceName, summary, url, media }
      rightsOverrides: {}, // mediaKey -> { rights, noDerivatives, credit }
      trackCuration: { 'A-7': 'top3', 'A-2': 'top3', 'B-4': 'top3', 'B-9': 'cortina' }
    };
  }

  function saveState(msg = '✓ Guardado') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const el = document.getElementById('saveStatus');
      if (el) {
        el.textContent = msg;
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.textContent = '✓'; }, 2400);
      }
      updateMesaBadge();
    } catch {}
  }

  function toast(msg) {
    saveState(msg);
  }

  function getActiveProgram() {
    let p = state.programs.find(x => x.episodioId === state.activeProgramId);
    if (!p) {
      p = state.programs[0];
      state.activeProgramId = p?.episodioId;
    }
    return p;
  }

  function updateMesaBadge() {
    const count = state.chosenNotes.length + state.chosenMedia.length;
    const badge = document.getElementById('mesaCountBadge');
    if (badge) badge.textContent = String(count);
  }

  function getRightsForMedia(url, fallbackRights = 'read_only') {
    const ov = state.rightsOverrides[url];
    return {
      rights: ov?.rights || fallbackRights || 'read_only',
      noDerivatives: !!ov?.noDerivatives,
      credit: ov?.credit || ''
    };
  }

  // ==========================================================
  // BOOTSTRAP E INICIALIZACIÓN
  // ==========================================================
  async function boot() {
    await Vault.init();
    await AudioEngine.init();
    await refreshVaultMedia();
    await fetchLiveInbox();

    const prog = getActiveProgram();
    AudioEngine.setLicenseMode(prog.modoComercial ? 'commercial' : 'pilot');
    AudioEngine.setEpisodeTracks(prog.episodeTrackIds);

    selectedBlockId = prog.bloques[0]?.id || null;
    if (prog.bloques[0]?.medios?.[0]) {
      currentRightMedia = prog.bloques[0].medios[0];
    }

    wireEvents();
    setupMonitorResizeObservers();
    renderAll();
    syncLicenseSwitchUI();
    pushToObs();

    AudioEngine.onTelemetry(handleAudioTelemetry);
    AudioEngine.onStatus(({ msg }) => toast(msg));

    setInterval(() => {
      const pde = document.getElementById('airClockPde');
      if (pde) {
        pde.textContent = new Date().toLocaleTimeString('es-UY', {
          timeZone: 'America/Montevideo', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) + ' PDE';
      }
    }, 1000);
  }

  async function refreshVaultMedia() {
    vaultMediaList = await Vault.listMedia('ALL');
  }

  async function fetchLiveInbox() {
    try {
      const res = await fetch(`rss-inbox-live.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        rssData = await res.json();
      }
    } catch {}
  }

  function getUnifiedRadarItems() {
    const rssItems = (rssData.items || []).map(it => ({ ...it, origin: 'rss' }));
    const customItems = (state.customRadarItems || []).map(it => ({ ...it, origin: 'custom' }));
    const vaultAsItems = vaultMediaList.map(v => ({
      id: v.id,
      origin: 'vault',
      feedId: 'vault',
      feedName: `Mi Mediateca · ${v.folder}`,
      folder: v.folder,
      title: v.name,
      summary: `${v.credit || 'Archivo propio'} · ${v.kind.toUpperCase()}`,
      link: v.sourceUrl || '',
      publishedAt: v.createdAt || new Date().toISOString(),
      lenses: ['Archivo propio'],
      images: v.kind === 'image' ? [{ url: v.url, vaultId: v.isVault ? v.id : '', caption: v.name, rights: v.rights, credit: v.credit, noDerivatives: v.noDerivatives }] : [],
      videos: v.kind === 'video' ? [{ url: v.url, vaultId: v.isVault ? v.id : '', caption: v.name, rights: v.rights, credit: v.credit, noDerivatives: v.noDerivatives, kind: 'video' }] : [],
      audios: v.kind === 'audio' ? [{ url: v.url, vaultId: v.isVault ? v.id : '', caption: v.name, rights: v.rights, credit: v.credit }] : [],
      cleanReaderHtml: `<p><strong>Archivo en Mi Mediateca (${esc(v.folder)}):</strong> ${esc(v.name)}</p><p>Estado legal: ${esc(RIGHTS_META[v.rights]?.label || v.rights)}</p>`,
      defaultRights: v.rights || 'own_cc0',
      vaultRecord: v
    }));

    return [...customItems, ...vaultAsItems, ...rssItems];
  }

  function applyFilters() {
    const all = getUnifiedRadarItems();
    const q = searchQuery.trim().toLowerCase();

    filteredItems = all.filter(it => {
      if (railMode.type === 'filter') {
        if (railMode.value === 'all' && it.origin === 'vault') return true;
        if (railMode.value === 'unread') return it.origin !== 'vault' && !state.readIds.includes(it.id);
        if (railMode.value === 'saved') return state.savedIds.includes(it.id);
        if (railMode.value === 'with_video') return (it.videos || []).length > 0;
      } else if (railMode.type === 'lens') {
        if (!(it.lenses || []).includes(railMode.value)) return false;
      } else if (railMode.type === 'feed') {
        if (it.feedId !== railMode.value) return false;
      } else if (railMode.type === 'vault') {
        if (it.origin !== 'vault') return false;
        if (railMode.value !== 'ALL' && it.folder !== railMode.value) return false;
      }

      if (activeCandidateWord) {
        const hayWord = `${it.title} ${it.summary} ${it.suggestedWord || ''}`.toLowerCase();
        if (!hayWord.includes(activeCandidateWord.toLowerCase())) return false;
      }

      if (q) {
        const hay = `${it.title} ${it.summary} ${it.feedName} ${(it.lenses || []).join(' ')} ${it.protagonist?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filteredItems.some(x => x.id === selectedItemId)) {
      selectedItemId = filteredItems[0]?.id || null;
    }
  }

  // ==========================================================
  // RENDERIZADO GLOBAL Y MODO 1 (RADAR + ZOOM + MEDIATECA)
  // ==========================================================
  function renderAll() {
    renderProgramSelect();
    updateMesaBadge();
    applyFilters();
    renderRail();
    renderWordCandidates();
    renderRadarList();
    renderReaderPane();
    if (currentMode === 'mesa') renderMesa();
    if (currentMode === 'cabina') renderCabina();
  }

  function renderProgramSelect() {
    const sel = document.getElementById('programSelect');
    if (!sel) return;
    sel.innerHTML = state.programs.map(p => (
      `<option value="${esc(p.episodioId)}" ${p.episodioId === state.activeProgramId ? 'selected' : ''}>${esc(p.nombrePrograma || p.palabraRectora)}</option>`
    )).join('');

    const blockSel = document.getElementById('addBlockTypeSelect');
    if (blockSel && !blockSel.options.length) {
      blockSel.innerHTML = Editorial.BLOCK_TYPES.map(t => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('');
    }
  }

  function renderRail() {
    const all = getUnifiedRadarItems();
    const rssOnly = all.filter(i => i.origin !== 'vault');
    document.getElementById('cntAll').textContent = String(all.length);
    document.getElementById('cntUnread').textContent = String(rssOnly.filter(i => !state.readIds.includes(i.id)).length);
    document.getElementById('cntSaved').textContent = String(state.savedIds.length);
    document.getElementById('cntVideo').textContent = String(all.filter(i => (i.videos || []).length > 0).length);
    document.getElementById('cntVaultAll').textContent = String(vaultMediaList.length);

    document.querySelectorAll('#railNovedadesGroup .rail-btn').forEach(b => {
      b.classList.toggle('active', railMode.type === 'filter' && railMode.value === b.dataset.filter);
    });
    const vaultAllBtn = document.querySelector('[data-vault="ALL"]');
    if (vaultAllBtn) vaultAllBtn.classList.toggle('active', railMode.type === 'vault' && railMode.value === 'ALL');

    const folders = Vault.getFolders();
    document.getElementById('railVaultFolders').innerHTML = folders.map(f => {
      const cnt = vaultMediaList.filter(v => v.folder === f).length;
      const act = railMode.type === 'vault' && railMode.value === f;
      return `<button type="button" class="rail-btn ${act ? 'active' : ''}" data-vault="${esc(f)}"><span class="lbl">${esc(f)}</span><span class="pill-cnt tabular">${cnt}</span></button>`;
    }).join('');

    document.getElementById('railLensesList').innerHTML = LENS_NAMES.map(ln => {
      const cnt = rssOnly.filter(i => (i.lenses || []).includes(ln)).length;
      const act = railMode.type === 'lens' && railMode.value === ln;
      return `<button type="button" class="rail-btn ${act ? 'active' : ''}" data-lens="${esc(ln)}"><span class="lbl">${esc(ln)}</span><span class="pill-cnt tabular">${cnt}</span></button>`;
    }).join('');

    const feedCounts = new Map();
    for (const it of rssOnly) {
      if (!feedCounts.has(it.feedId)) feedCounts.set(it.feedId, { id: it.feedId, name: it.feedName, count: 0 });
      feedCounts.get(it.feedId).count += 1;
    }
    document.getElementById('railFeedsList').innerHTML = Array.from(feedCounts.values()).map(fd => {
      const act = railMode.type === 'feed' && railMode.value === fd.id;
      return `<button type="button" class="rail-btn ${act ? 'active' : ''}" data-feed="${esc(fd.id)}"><span class="lbl">${esc(fd.name)}</span><span class="pill-cnt tabular">${fd.count}</span></button>`;
    }).join('');
  }

  function renderWordCandidates() {
    const row = document.getElementById('wordCandidatesRow');
    if (!row) return;
    const words = rssData.suggestedWords || [];
    const pills = [
      `<button type="button" class="chip ${activeCandidateWord === '' ? 'active' : ''}" data-word="">Todas las palabras</button>`,
      ...words.slice(0, 7).map(w => (
        `<button type="button" class="chip ${activeCandidateWord === w.word ? 'active' : ''}" data-word="${esc(w.word)}" title="${esc((w.lenses || []).join(' · '))}">${esc(w.word)} (${w.count})</button>`
      ))
    ];
    row.innerHTML = pills.join('');
  }

  function getItemLeadThumb(it) {
    if (it.images && it.images[0]) return it.images[0].url;
    if (it.videos && it.videos[0] && it.videos[0].poster) return it.videos[0].poster;
    return 'evidencias/aris_cuaderno_boceto.jpg';
  }

  function getItemMediaList(it) {
    if (!it) return [];
    const list = [];
    for (const im of it.images || []) {
      const ov = getRightsForMedia(im.url, im.rights || it.defaultRights || 'read_only');
      list.push({
        id: it.vaultRecord?.id || ('med-' + btoa(unescape(encodeURIComponent(im.url))).slice(0, 14).replace(/[^a-zA-Z0-9]/g, '')),
        kind: 'image',
        url: im.url,
        vaultId: im.vaultId || '',
        name: im.caption || it.title,
        rights: ov.rights,
        noDerivatives: ov.noDerivatives || !!im.noDerivatives,
        credit: ov.credit || im.credit || it.feedName,
        sourceUrl: it.link || '',
        permissionRef: it.vaultRecord?.permissionRef || ''
      });
    }
    for (const vid of it.videos || []) {
      const src = vid.url || vid.embedUrl || '';
      const ov = getRightsForMedia(src, vid.rights || it.defaultRights || 'own_cc0');
      list.push({
        id: it.vaultRecord?.id || ('vid-' + Math.random().toString(36).slice(2, 8)),
        kind: 'video',
        url: src,
        vaultId: vid.vaultId || '',
        name: vid.caption || it.title,
        rights: ov.rights,
        noDerivatives: ov.noDerivatives || !!vid.noDerivatives,
        credit: ov.credit || vid.credit || it.feedName,
        sourceUrl: it.link || ''
      });
    }
    return list;
  }

  function renderRadarList() {
    const el = document.getElementById('radarListScroll');
    if (!el) return;
    el.classList.toggle('as-grid', viewAsGrid);
    if (!filteredItems.length) {
      el.innerHTML = '<div style="padding:20px;text-align:center;" class="muted-note">No hay elementos en este filtro. Probá limpiar la búsqueda o arrastrá fotos/videos propios a Mi Mediateca.</div>';
      return;
    }
    el.innerHTML = filteredItems.map(it => {
      const thumb = getItemLeadThumb(it);
      const isSel = it.id === selectedItemId;
      const isSaved = state.savedIds.includes(it.id);
      const isUnread = it.origin !== 'vault' && !state.readIds.includes(it.id);
      const media = getItemMediaList(it);
      const leadR = media[0]?.rights || it.defaultRights || 'read_only';
      const rm = RIGHTS_META[leadR] || RIGHTS_META.read_only;
      const dateStr = it.publishedAt ? new Date(it.publishedAt).toLocaleDateString('es-UY', { day: '2-digit', month: 'short' }) : '';

      return `<div class="feed-card ${isSel ? 'selected' : ''}" data-item-id="${esc(it.id)}">
        ${it.videos?.[0] && !it.images?.[0]
          ? `<video class="feed-thumb" src="${esc(it.videos[0].url)}" muted playsinline></video>`
          : `<img class="feed-thumb" src="${esc(thumb)}" alt="" loading="lazy">`}
        <div class="feed-card-body">
          <div class="feed-meta">
            <span>${isUnread ? '● ' : ''}${esc(it.feedName)}</span>
            <span class="tabular">${esc(dateStr)}</span>
          </div>
          <div class="feed-title">${esc(it.title)}</div>
          <div class="feed-foot">
            <span class="r-badge ${rm.cls}">${rm.short}</span>
            <span style="font-size:0.64rem;color:var(--muted);">${isSaved ? '★ ' : ''}${esc((it.lenses || [])[0] || '')}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function renderReaderPane() {
    const body = document.getElementById('readerBody');
    const extBtn = document.getElementById('btnExternalOpen');
    const saveBtn = document.getElementById('btnSaveToggle');
    const item = filteredItems.find(x => x.id === selectedItemId);

    if (!item) {
      body.innerHTML = '<div style="padding:32px;" class="muted-note">Seleccioná una novedad o un archivo propio a la izquierda para leerlo, agrandarlo o pasarlo a la Mesa.</div>';
      return;
    }

    if (item.origin !== 'vault' && !state.readIds.includes(item.id)) {
      state.readIds.push(item.id);
      saveState();
      renderRail();
    }

    if (extBtn) {
      if (item.link) {
        extBtn.href = item.link;
        extBtn.style.display = 'inline-flex';
      } else {
        extBtn.style.display = 'none';
      }
    }
    if (saveBtn) {
      const saved = state.savedIds.includes(item.id);
      saveBtn.textContent = saved ? '★ Guardado' : '☆ Guardar';
      saveBtn.classList.toggle('active', saved);
    }

    const media = getItemMediaList(item);
    const chosenUrls = new Set(state.chosenMedia.map(m => m.url));

    const stripHtml = media.length ? `
      <div class="media-strip">
        ${media.map((m, idx) => {
          const rm = RIGHTS_META[m.rights] || RIGHTS_META.read_only;
          const isPicked = chosenUrls.has(m.url);
          return `<div class="media-tile ${isPicked ? 'picked' : ''}">
            ${m.kind === 'video'
              ? `<video class="media-tile-preview" src="${esc(m.url)}" muted loop playsinline data-zoom-idx="${idx}"></video>`
              : `<img class="media-tile-preview" src="${esc(m.url)}" alt="${esc(m.name)}" data-zoom-idx="${idx}">`}
            <div class="media-tile-actions">
              <span class="r-badge ${rm.cls}" title="${esc(rm.label)}">${rm.short}${m.noDerivatives ? ' · ND' : ''}</span>
              <div style="display:flex;gap:4px;">
                <button type="button" class="btn btn-sm ${isPicked ? 'btn-sage active' : 'btn-sage'}" style="flex:1;" data-pick-media-idx="${idx}">${isPicked ? '✓ Elegido' : '+ Elegir'}</button>
                <button type="button" class="btn btn-sm" data-zoom-idx="${idx}" title="Lupa fullscreen">⤢</button>
              </div>
              ${m.rights === 'read_only'
                ? `<button type="button" class="btn btn-sm" data-rights-quote="${esc(m.url)}" style="font-size:0.62rem;">Marcar cita c/crédito</button>`
                : ''}
            </div>
          </div>`;
        }).join('')}
      </div>` : '';

    const hilo = item.hiloRojo
      ? `<details>
          <summary>🧵 Hilo Rojo con tu archivo (19 Minutas + 91 videos)</summary>
          <p class="muted-note" style="margin-top:6px;">
            ${esc(item.hiloRojo.summaryLine)}<br>
            <a href="${esc(item.hiloRojo.minutaUrl)}" target="_blank" rel="noopener noreferrer">Abrir Minuta W ↗</a> ·
            <a href="${esc(item.hiloRojo.videoUrl)}" target="_blank" rel="noopener noreferrer">Ver en YouTube ↗</a>
          </p>
        </details>` : '';

    const prot = item.protagonist
      ? `<details>
          <summary>🎙️ Invitación Nota al Margen · ${esc(item.protagonist.name)} (${esc(item.protagonist.handle)})</summary>
          <p class="muted-note" style="margin-top:6px;">${esc(item.protagonist.inviteEs)}</p>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button type="button" class="btn btn-sm" id="btnCopyItemInviteEs">Copiar ES (c/autorización)</button>
            <button type="button" class="btn btn-sm" id="btnCopyItemInviteEn">Copiar EN</button>
          </div>
        </details>` : '';

    body.innerHTML = `
      ${stripHtml}
      <article class="article-paper ${paperDarkTheme ? 'theme-dark' : ''}" id="articleProseRoot">
        <h2>${esc(item.title)}</h2>
        <div class="art-meta">
          <span>${esc(item.feedName)}</span>
          <span>·</span>
          <span>${esc((item.lenses || []).join(' · '))}</span>
          ${item.suggestedWord ? `<span>· Palabra: ${esc(item.suggestedWord)}</span>` : ''}
          <button type="button" id="btnReaderPaperToggle" class="btn btn-sm" style="margin-left:auto;">Papel / Oscuro</button>
        </div>
        <div class="art-prose">${item.cleanReaderHtml || `<p>${esc(item.summary)}</p>`}</div>
      </article>
      <div class="reader-details-bar">
        ${hilo}${prot}
        ${item.vaultRecord?.kind === 'audio' ? `<div style="padding:10px 14px;"><audio controls src="${esc(item.vaultRecord.url)}" style="width:100%;"></audio></div>` : ''}
      </div>
    `;
  }

  // ZOOM / RECORRIDO INMERSIVO
  function openZoomOverlay(viewMode = 'read', mediaIdx = 0) {
    if (!filteredItems.length) return;
    zoomOpen = true;
    zoomView = viewMode;
    zoomMediaIdx = mediaIdx;
    zoomScale = 1;
    zoomPan = { x: 0, y: 0, dragging: false, startX: 0, startY: 0 };
    document.getElementById('zoomOverlay').classList.add('open');
    renderZoomOverlay();
  }

  function closeZoomOverlay() {
    zoomOpen = false;
    document.getElementById('zoomOverlay').classList.remove('open');
  }

  function renderZoomOverlay() {
    if (!zoomOpen) return;
    const itemIdx = Math.max(0, filteredItems.findIndex(x => x.id === selectedItemId));
    const item = filteredItems[itemIdx];
    if (!item) return closeZoomOverlay();

    const media = getItemMediaList(item);
    if (zoomMediaIdx >= media.length) zoomMediaIdx = Math.max(0, media.length - 1);
    const curMedia = media[zoomMediaIdx] || null;

    document.getElementById('zoomCounter').textContent = `${itemIdx + 1} / ${filteredItems.length}`;
    document.getElementById('zoomTabRead').classList.toggle('active', zoomView === 'read');
    document.getElementById('zoomTabVisual').classList.toggle('active', zoomView === 'visual');

    const readBox = document.getElementById('zoomReadBox');
    const visBox = document.getElementById('zoomVisualBox');
    readBox.style.display = zoomView === 'read' ? 'block' : 'none';
    visBox.style.display = zoomView === 'visual' ? 'flex' : 'none';

    readBox.className = `zoom-read-container ${paperDarkTheme ? 'dark' : ''}`;
    readBox.style.fontSize = `${zoomFontPx}px`;
    readBox.innerHTML = `
      <h2 style="font-size:1.6em;font-weight:800;line-height:1.18;margin-bottom:10px;">${esc(item.title)}</h2>
      <div style="font-size:0.78rem;opacity:0.75;font-weight:700;margin-bottom:18px;">${esc(item.feedName)} · ${esc((item.lenses || []).join(' · '))}</div>
      <div class="art-prose" style="line-height:1.68;">${item.cleanReaderHtml || `<p>${esc(item.summary)}</p>`}</div>
    `;

    const rKey = curMedia?.rights || item.defaultRights || 'read_only';
    const rm = RIGHTS_META[rKey] || RIGHTS_META.read_only;
    const rBadge = document.getElementById('zoomRightsBadge');
    rBadge.className = `r-badge ${rm.cls}`;
    rBadge.textContent = rm.label;

    const rNote = document.getElementById('zoomRightsNote');
    if (rKey === 'read_only') {
      rNote.innerHTML = 'Esta imagen viene de prensa RSS: <strong>solo lectura/investigación</strong>. No sale al aire ni va a YouTube sin permiso o sustitución por Mi Mediateca.';
    } else if (curMedia?.noDerivatives) {
      rNote.textContent = 'Marcada CC BY-ND: protegida contra filtros y recortes destructivos al aire.';
    } else {
      rNote.textContent = curMedia ? (curMedia.credit || curMedia.name) : item.feedName;
    }

    if (zoomView === 'visual') {
      if (!curMedia) {
        visBox.innerHTML = '<div class="muted-note">Este elemento no tiene foto ni video adjunto.</div>';
      } else if (curMedia.kind === 'video') {
        visBox.innerHTML = `<video src="${esc(curMedia.url)}" controls autoplay playsinline style="transform:translate(${zoomPan.x}px,${zoomPan.y}px) scale(${zoomScale});"></video>`;
      } else {
        visBox.innerHTML = `<img src="${esc(curMedia.url)}" alt="${esc(curMedia.name)}" draggable="false" style="transform:translate(${zoomPan.x}px,${zoomPan.y}px) scale(${zoomScale});">`;
      }
    }

    document.getElementById('zoomThumbs').innerHTML = media.map((m, idx) => (
      `<button type="button" class="zoom-thumb-btn ${idx === zoomMediaIdx ? 'active' : ''}" data-zoom-thumb="${idx}">
        ${m.kind === 'video' ? `<span style="font-size:0.7rem;font-weight:800;">🎬 ${idx + 1}</span>` : `<img src="${esc(m.url)}" alt="">`}
      </button>`
    )).join('');

    const chooseBtn = document.getElementById('btnZoomChooseMedia');
    if (chooseBtn) {
      const picked = curMedia && state.chosenMedia.some(m => m.url === curMedia.url);
      chooseBtn.disabled = !curMedia;
      chooseBtn.textContent = picked ? '✓ Ya en Mesa' : '✓ Elegir este medio';
    }
    const saveBtn = document.getElementById('btnZoomSave');
    if (saveBtn) {
      saveBtn.textContent = state.savedIds.includes(item.id) ? '★ Guardada' : '☆ Guardar';
    }
  }

  function stepZoomItem(delta) {
    if (!filteredItems.length) return;
    const idx = Math.max(0, filteredItems.findIndex(x => x.id === selectedItemId));
    const nextIdx = (idx + delta + filteredItems.length) % filteredItems.length;
    selectedItemId = filteredItems[nextIdx].id;
    zoomMediaIdx = 0;
    zoomScale = 1;
    zoomPan.x = 0;
    zoomPan.y = 0;
    renderRadarList();
    renderReaderPane();
    renderZoomOverlay();
  }

  // ==========================================================
  // PASAR ITEMS, NOTAS Y MEDIOS A MESA DE PRODUCCIÓN
  // ==========================================================
  function addNoteToMesa(item, quoteOverride = '') {
    if (!item) return;
    const entry = {
      id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: item.id,
      title: item.title,
      sourceName: item.feedName,
      quote: quoteOverride || item.summary || item.title,
      url: item.link || '',
      lenses: item.lenses || [],
      protagonist: item.protagonist || null,
      createdAt: new Date().toISOString()
    };
    state.chosenNotes.unshift(entry);
    saveState('✓ Pasado a Mesa de Producción');
    if (currentMode === 'mesa') renderMesa();
  }

  function addMediaToMesa(mediaObj) {
    if (!mediaObj) return;
    if (!state.chosenMedia.some(m => m.url === mediaObj.url)) {
      state.chosenMedia.unshift({ ...mediaObj, target: 'right' });
      saveState(mediaObj.rights === 'read_only'
        ? '⚠️ Guardado en Mesa (🔴 prensa: solo lectura)'
        : '✓ Medio elegido en Mesa');
    } else {
      toast('Ese medio ya está en tu Mesa');
    }
    renderReaderPane();
    if (zoomOpen) renderZoomOverlay();
    if (currentMode === 'mesa') renderMesa();
  }

  function addItemToGateras(item) {
    if (!item) return;
    if (!state.gateras.some(g => g.itemId === item.id)) {
      const media = getItemMediaList(item).filter(m => RIGHTS_META[m.rights]?.canAir);
      state.gateras.unshift({
        id: `gat-${Date.now().toString(36)}`,
        itemId: item.id,
        title: item.title,
        sourceName: item.feedName,
        summary: item.summary || item.title,
        url: item.link || '',
        medios: media
      });
      saveState('🟡 Cargado en Gateras (Plan B)');
      if (currentMode === 'mesa') renderMesa();
    } else {
      toast('Ya estaba en Gateras');
    }
  }

  // ==========================================================
  // MODO 2: MESA DE PRODUCCIÓN / ESCALETA DINESAT
  // ==========================================================
  function renderMesa() {
    const prog = getActiveProgram();
    document.getElementById('mesaWordInput').value = prog.palabraRectora || 'PIEL';
    document.getElementById('mesaWordPresets').innerHTML = ['PIEL', 'PAPEL', 'ÁRBOL', 'ANIMAL', 'HILO', 'SOMBRA']
      .map(w => `<button type="button" class="chip ${prog.palabraRectora === w ? 'active' : ''}" data-preset-word="${w}">${w}</button>`).join('');

    const ytIn = document.getElementById('mesaYtTitleInput');
    ytIn.value = prog.tituloYoutube || '';
    document.getElementById('ytTitleLen').textContent = String((prog.tituloYoutube || '').length);

    const mecIn = document.getElementById('mesaMecenasInput');
    mecIn.value = prog.mecenasNombre || '';
    mecIn.disabled = !prog.modoComercial;
    mecIn.placeholder = prog.modoComercial ? 'Nombre del mecenas / museo / institución' : 'Bloqueado en Sin sponsor (mobygratis)';

    renderBankAndGateras();
    renderRhythmAndBadges();
    renderBlocksList();
    renderInspector();
  }

  function renderBankAndGateras() {
    const el = document.getElementById('bankList');
    if (bankTab === 'notes') {
      if (!state.chosenNotes.length) {
        el.innerHTML = '<div class="muted-note" style="padding:10px;">Elegí notas o subrayá citas en Modo 1 para tenerlas a mano y arrastrarlas a tu escaleta.</div>';
      } else {
        el.innerHTML = state.chosenNotes.map((n, idx) => (
          `<div class="bank-chip-item" draggable="true" data-drag-type="note" data-drag-idx="${idx}">
            <div style="font-size:0.72rem;font-weight:800;line-height:1.25;">${esc(n.title)}</div>
            <div class="muted-note" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${esc(n.quote)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
              <button type="button" class="btn btn-sm btn-sage" data-inject-note="${idx}">+ Al bloque</button>
              <button type="button" class="btn btn-sm btn-ghost" data-del-note="${idx}">✕</button>
            </div>
          </div>`
        )).join('');
      }
    } else {
      const combined = [...state.chosenMedia];
      if (!combined.length) {
        el.innerHTML = '<div class="muted-note" style="padding:10px;">Marcá "+ Elegir" sobre fotos o videos de tus fuentes o Mi Mediateca.</div>';
      } else {
        el.innerHTML = combined.map((m, idx) => {
          const rm = RIGHTS_META[m.rights] || RIGHTS_META.read_only;
          return `<div class="bank-chip-item" draggable="true" data-drag-type="media" data-drag-idx="${idx}">
            <div style="display:flex;gap:8px;align-items:center;">
              ${m.kind === 'video'
                ? `<video src="${esc(m.url)}" style="width:46px;height:46px;object-fit:cover;border-radius:4px;" muted></video>`
                : `<img src="${esc(m.url)}" style="width:46px;height:46px;object-fit:cover;border-radius:4px;">`}
              <div style="min-width:0;flex:1;">
                <div style="font-size:0.7rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.name)}</div>
                <span class="r-badge ${rm.cls}">${rm.short}</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;gap:4px;">
              <button type="button" class="btn btn-sm btn-sage" data-inject-media="${idx}">+ Al bloque</button>
              <button type="button" class="btn btn-sm btn-ghost" data-del-media="${idx}">✕</button>
            </div>
          </div>`;
        }).join('');
      }
    }

    document.getElementById('gaterasCountLabel').textContent = String(state.gateras.length);
    document.getElementById('gaterasList').innerHTML = state.gateras.length
      ? state.gateras.map((g, idx) => (
        `<div style="border:1px solid var(--border);border-radius:6px;padding:6px;background:var(--surface);display:flex;justify-content:space-between;gap:6px;align-items:center;">
          <div style="min-width:0;">
            <div style="font-size:0.7rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(g.title)}</div>
            <div style="font-size:0.62rem;color:var(--muted);">${esc(g.sourceName)}</div>
          </div>
          <button type="button" class="btn btn-sm btn-ghost" data-del-gatera="${idx}">✕</button>
        </div>`
      )).join('')
      : '<div class="muted-note">Sin temas de Plan B todavía.</div>';
  }

  function renderRhythmAndBadges() {
    const prog = getActiveProgram();
    const totalSec = prog.bloques.reduce((s, b) => s + (Number(b.duracionSeg) || 0), 0);
    document.getElementById('rhythmTotalLabel').textContent = `${Editorial.formatMMSS(totalSec)} / 24:00`;

    const bar = document.getElementById('rhythmBar');
    bar.innerHTML = prog.bloques.map((b, i) => {
      const pct = totalSec > 0 ? ((Number(b.duracionSeg) || 10) / totalSec) * 100 : 10;
      const tMeta = Editorial.BLOCK_TYPES.find(t => t.id === b.tipo) || { color: 't-lente_ciencia' };
      return `<div class="rhythm-seg ${tMeta.color}" style="width:${pct.toFixed(2)}%;" data-select-block="${esc(b.id)}" title="${esc(b.titulo)} (${Editorial.formatMMSS(b.duracionSeg)})">${i + 1}</div>`;
    }).join('');

    const par = Editorial.calcParity(prog);
    const parEl = document.getElementById('parityBadge');
    parEl.className = `r-badge tabular ${par.ok ? 'r-own_cc0' : 'r-permission'}`;
    parEl.textContent = `Paridad 80/20: ${par.pctWomen}% mujeres`;

    const fullScript = prog.bloques.map(b => b.guion || '').join('\n');
    const lint = Editorial.lintText(fullScript + '\n' + (prog.tituloYoutube || ''));
    const lintEl = document.getElementById('linterBadge');
    lintEl.className = `r-badge ${lint.ok ? 'r-own_cc0' : 'r-permission'}`;
    lintEl.textContent = lint.ok ? 'Linter 13 reglas OK' : `${lint.warnings.length} aviso(s) de estilo`;
    lintEl.title = lint.warnings.join(' | ');
  }

  function renderBlocksList() {
    const prog = getActiveProgram();
    const tracks = AudioEngine.getCatalogForMode(prog.modoComercial ? 'commercial' : 'pilot');
    const container = document.getElementById('blocksList');

    container.innerHTML = prog.bloques.map((b, idx) => {
      const isOpen = b.id === selectedBlockId;
      const speechSec = Editorial.estimateSpeechSec(b.guion || '');
      const lint = Editorial.lintText(b.guion || '');
      const hasReadOnlyMedia = (b.medios || []).some(m => m.rights === 'read_only');

      const trackOpts = [
        `<option value="">— Sin pista asignada —</option>`,
        ...tracks.map(t => `<option value="${esc(t.id)}" ${b.pistaId === t.id ? 'selected' : ''}>${esc(t.title)} (${esc(t.bpm)} BPM)</option>`)
      ].join('');

      const guestBoxHtml = b.tipo === 'nota_al_margen' ? `
        <div style="border:1px solid var(--sand);border-radius:7px;padding:10px;background:rgba(234,215,183,0.06);display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <strong style="font-size:0.76rem;color:var(--sand);">🎙️ Configuración «Nota al Margen»</strong>
            <select class="tb-select" data-guest-preset="${esc(b.id)}">
              <option value="">Cargar invitada/o del Radar 80/20...</option>
              ${Editorial.CURATED_GUESTS_80_20.map(g => `<option value="${esc(g.id)}">${esc(g.name)} (${esc(g.word)})</option>`).join('')}
            </select>
          </div>
          <div class="grid-3">
            <div><span class="label-xs">Nombre</span><input type="text" class="field" data-guest-field="nombre" data-bid="${esc(b.id)}" value="${esc(b.notaAlMargen?.nombre || '')}"></div>
            <div><span class="label-xs">Oficio / Institución</span><input type="text" class="field" data-guest-field="oficio" data-bid="${esc(b.id)}" value="${esc(b.notaAlMargen?.oficio || '')}"></div>
            <div><span class="label-xs">Ciudad y @handle</span><input type="text" class="field" data-guest-field="handle" data-bid="${esc(b.id)}" value="${esc(b.notaAlMargen?.handle || '')}"></div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label class="btn btn-sm btn-sand">
              Subir audio WhatsApp (.ogg / .m4a / .mp3)
              <input type="file" accept="audio/*,.ogg,.opus,.m4a,.mp3,.wav" data-guest-audio="${esc(b.id)}" style="display:none;">
            </label>
            <span class="muted-note">${esc(b.notaAlMargen?.audioName || 'Sin archivo cargado')}</span>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:0.74rem;font-weight:700;cursor:pointer;color:${b.notaAlMargen?.permisoOk ? 'var(--sage)' : 'var(--coral)'};">
            <input type="checkbox" data-guest-perm="${esc(b.id)}" ${b.notaAlMargen?.permisoOk ? 'checked' : ''}>
            Consentimiento confirmado («Sí, autorizo» — Ley 18.331 UY / Art. 53 CCyC AR)
          </label>
        </div>` : '';

      const mediasHtml = (b.medios || []).length ? (b.medios || []).map((m, mi) => {
        const rm = RIGHTS_META[m.rights] || RIGHTS_META.read_only;
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
            <span class="r-badge ${rm.cls}">${rm.short}</span>
            <span style="font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.name)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <label style="font-size:0.65rem;display:flex;align-items:center;gap:3px;cursor:pointer;" title="CC BY-ND: sin filtros ni recortes">
              <input type="checkbox" data-media-nd="${esc(b.id)}:${mi}" ${m.noDerivatives ? 'checked' : ''}> ND
            </label>
            <select class="tb-select" data-media-target="${esc(b.id)}:${mi}" style="padding:2px 5px;font-size:0.66rem;">
              <option value="right" ${m.target === 'right' ? 'selected' : ''}>Ala Derecha</option>
              <option value="center" ${m.target === 'center' ? 'selected' : ''}>Centro 9:16</option>
              <option value="cine-16x9" ${m.target === 'cine-16x9' ? 'selected' : ''}>Cine 16:9</option>
            </select>
            <button type="button" class="btn btn-sm btn-ghost" data-remove-bmedia="${esc(b.id)}:${mi}">✕</button>
          </div>
        </div>`;
      }).join('') : '<div class="muted-note">Arrastrá fotos o videos desde Medios elegidos (columna izquierda) hasta este bloque.</div>';

      return `<div class="block-card ${isOpen ? 'selected' : ''}" data-block-id="${esc(b.id)}" draggable="true">
        <div class="block-head" data-toggle-block="${esc(b.id)}">
          <span class="drag-handle" title="Arrastrar para reordenar">⋮⋮</span>
          <span class="tabular" style="font-size:0.72rem;font-weight:800;color:var(--coral);">${String(idx + 1).padStart(2, '0')}</span>
          <span style="font-size:0.8rem;font-weight:800;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.titulo)}</span>
          ${hasReadOnlyMedia ? '<span class="r-badge r-read_only">🔴 Revisar medios</span>' : ''}
          <span class="tabular" style="font-size:0.72rem;color:var(--sand);font-weight:700;">${Editorial.formatMMSS(b.duracionSeg)}</span>
          <button type="button" class="btn btn-sm btn-ghost" data-move-block="${esc(b.id)}:-1" title="Subir">↑</button>
          <button type="button" class="btn btn-sm btn-ghost" data-move-block="${esc(b.id)}:1" title="Bajar">↓</button>
          <button type="button" class="btn btn-sm btn-ghost" data-del-block="${esc(b.id)}" title="Quitar bloque">✕</button>
        </div>

        ${isOpen ? `<div class="block-body">
          <div class="grid-3">
            <div><span class="label-xs">Título de bloque</span><input type="text" class="field" data-b-field="titulo" data-bid="${esc(b.id)}" value="${esc(b.titulo)}"></div>
            <div><span class="label-xs">Cifra monumental (izq.)</span><input type="text" class="field" data-b-field="cifraMonumental" data-bid="${esc(b.id)}" value="${esc(b.cifraMonumental || '')}"></div>
            <div><span class="label-xs">Duración estimada (seg)</span><input type="number" class="field tabular" data-b-field="duracionSeg" data-bid="${esc(b.id)}" value="${Number(b.duracionSeg) || 60}" min="5" step="5"></div>
          </div>
          <div class="grid-3">
            <div>
              <span class="label-xs">Tipo</span>
              <select class="tb-select" style="width:100%;max-width:none;" data-b-field="tipo" data-bid="${esc(b.id)}">
                ${Editorial.BLOCK_TYPES.map(t => `<option value="${esc(t.id)}" ${b.tipo === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
              </select>
            </div>
            <div>
              <span class="label-xs">Pista sugerida</span>
              <select class="tb-select" style="width:100%;max-width:none;" data-b-field="pistaId" data-bid="${esc(b.id)}">${trackOpts}</select>
            </div>
            <div>
              <span class="label-xs">Paridad 80/20</span>
              <select class="tb-select" style="width:100%;max-width:none;" data-b-field="genderRef" data-bid="${esc(b.id)}">
                <option value="" ${!b.genderRef ? 'selected' : ''}>Sin persona eje</option>
                <option value="mujer" ${b.genderRef === 'mujer' ? 'selected' : ''}>Referente Mujer (80%)</option>
                <option value="hombre" ${b.genderRef === 'hombre' ? 'selected' : ''}>Referente Hombre (20%)</option>
              </select>
            </div>
          </div>
          <div>
            <span class="label-xs">Diseño sonoro de esta instancia (barrida, cama, silencio, fade)</span>
            <input type="text" class="field" data-b-field="disenoSonoro" data-bid="${esc(b.id)}" value="${esc(b.disenoSonoro || '')}" placeholder="Ej. Silencio 1,5s → Barrida → Cama rítmica -22 dB → Fade 3s">
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span class="label-xs" style="margin:0;">Guion hablado (140 PPM ≈ ${Editorial.formatMMSS(speechSec)})</span>
              <span style="font-size:0.65rem;font-weight:700;color:${lint.ok ? 'var(--sage)' : 'var(--coral)'};">${lint.ok ? '● Estilo limpio' : '⚠ ' + esc(lint.warnings[0])}</span>
            </div>
            <textarea class="field" rows="5" data-b-field="guion" data-bid="${esc(b.id)}">${esc(b.guion || '')}</textarea>
          </div>
          ${guestBoxHtml}
          <div style="display:flex;flex-direction:column;gap:5px;">
            <span class="label-xs">Medios del bloque (para aire)</span>
            ${mediasHtml}
          </div>
        </div>` : ''}
      </div>`;
    }).join('');
  }

  function renderInspector() {
    const el = document.getElementById('inspectorContent');
    if (!el) return;
    const prog = getActiveProgram();

    document.querySelectorAll('[data-insp-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.inspTab === inspTab);
    });

    if (inspTab === 'preview') {
      const selB = prog.bloques.find(b => b.id === selectedBlockId) || prog.bloques[0];
      const tracksAll = AudioEngine.getCatalogForMode(prog.modoComercial ? 'commercial' : 'pilot');
      const curMap = state.trackCuration || {};
      const orderRank = { cortina: 0, top3: 1, rotacion: 2 };
      const sortedTracks = [...tracksAll].sort((a, b) => (orderRank[curMap[a.id] || 'rotacion'] ?? 2) - (orderRank[curMap[b.id] || 'rotacion'] ?? 2));
      const epSet = new Set(prog.episodeTrackIds || []);
      const curLabel = {
        cortina: '📌 Cortina fija',
        top3: '⭐ Top 3 (queda)',
        rotacion: '↻ Rotación'
      };
      el.innerHTML = `
        <div class="preview-16x9-frame" id="inspPreviewWrap">
          <iframe id="inspPreviewIframe" src="obs-salida.html?preview=1"></iframe>
        </div>
        <button type="button" class="btn btn-coral btn-sm" id="btnInspPushPreview">Proyectar bloque elegido en previa y OBS</button>
        <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;flex-direction:column;gap:6px;">
          <span class="label-xs">Checklist pre-aire</span>
          <div class="muted-note">1. Bloque seleccionado: <strong>${esc(selB?.titulo || '—')}</strong></div>
          <div class="muted-note">2. Medios habilitados (🟢/🟡): <strong>${(selB?.medios || []).filter(m => RIGHTS_META[m.rights]?.canAir).length}</strong></div>
          <div class="muted-note">3. Modo música: <strong>${prog.modoComercial ? 'Con sponsor / Radio' : 'Sin sponsor (mobygratis)'}</strong></div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;flex-direction:column;gap:6px;">
          <span class="label-xs">Curación musical semanal (📌 Fijas · ⭐ Top 3 · ↻ Rotación)</span>
          <div style="display:flex;flex-direction:column;gap:5px;">
            ${sortedTracks.map(t => {
              const st = curMap[t.id] || 'rotacion';
              const inEp = epSet.has(t.id);
              return `<div style="display:flex;align-items:center;justify-content:space-between;gap:5px;padding:5px 7px;border:1px solid var(--border);border-radius:6px;background:var(--surface);">
                <div style="min-width:0;flex:1;">
                  <div style="font-size:0.7rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.title)}</div>
                  <div style="font-size:0.62rem;color:var(--muted);">${esc(t.bpm)} BPM</div>
                </div>
                <button type="button" class="btn btn-sm ${st === 'cortina' ? 'btn-coral' : (st === 'top3' ? 'btn-sand' : '')}" data-cycle-curation="${esc(t.id)}" title="Clic para cambiar entre Rotación, Top 3 semanal y Cortina fija">${curLabel[st]}</button>
                <button type="button" class="btn btn-sm ${inEp ? 'btn-sage active' : ''}" data-toggle-ep-track="${esc(t.id)}" title="Incluir en las 6 pistas de la Cabina">${inEp ? '✓ En Deck' : '+ Deck'}</button>
              </div>`;
            }).join('')}
          </div>
        </div>
      `;
      scaleIframeInside(document.getElementById('inspPreviewWrap'));
      pushToObsFromBlock(selB);
    } else if (inspTab === 'guests') {
      el.innerHTML = `
        <span class="label-xs">Invitaciones «Nota al Margen» (80/20 con consentimiento legal integrado)</span>
        ${Editorial.CURATED_GUESTS_80_20.map((g, gi) => (
          `<div style="border:1px solid var(--border);border-radius:7px;padding:9px;background:var(--surface);display:flex;flex-direction:column;gap:5px;">
            <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;">
              <strong style="font-size:0.75rem;">${esc(g.name)}</strong>
              <span class="r-badge r-own_cc0">${esc(g.word)}</span>
            </div>
            <div class="muted-note">${esc(g.role)} · ${esc(g.territory)}</div>
            <div style="display:flex;gap:5px;">
              <button type="button" class="btn btn-sm btn-sand" data-copy-guest-es="${gi}">Copiar Invitación ES</button>
              <button type="button" class="btn btn-sm" data-copy-guest-en="${gi}">Copiar EN</button>
            </div>
          </div>`
        )).join('')}
      `;
    } else {
      const tracks = AudioEngine.getCatalogForMode(prog.modoComercial ? 'commercial' : 'pilot');
      const pack = Editorial.buildProductPack(prog, clipMarkers, chaptersRecorded, tracks);
      el.innerHTML = `
        <span class="label-xs">Salida 1-clic post-vivo (YouTube, Substack, Redes, Aprobalo)</span>
        <div>
          <span class="label-xs">Título YouTube (${pack.ytTitle.length}/100 car.)</span>
          <textarea class="field" rows="2" readonly>${esc(pack.ytTitle)}</textarea>
        </div>
        <div>
          <span class="label-xs">Descripción YouTube (capítulos + fuentes + créditos)</span>
          <textarea class="field" rows="5" readonly>${esc(pack.youtubeDesc)}</textarea>
          <button type="button" class="btn btn-sm" style="margin-top:4px;" data-copy-pack="yt">Copiar YouTube</button>
        </div>
        <div>
          <span class="label-xs">Instagram / TikTok (0 URLs crudas · Linter ${pack.lintIg.ok ? 'OK' : 'Avisos'})</span>
          <textarea class="field" rows="4" readonly>${esc(pack.igCopy)}</textarea>
          <button type="button" class="btn btn-sm" style="margin-top:4px;" data-copy-pack="ig">Copiar IG</button>
        </div>
        <div>
          <span class="label-xs">Entrega 48h al invitado (Nota al Margen)</span>
          <textarea class="field" rows="3" readonly>${esc(pack.guestDelivery48h)}</textarea>
          <button type="button" class="btn btn-sm" style="margin-top:4px;" data-copy-pack="guest48">Copiar entrega 48h</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--border);padding-top:10px;">
          <button type="button" class="btn btn-coral btn-sm" id="btnDownloadAprobalo">⬇ Descargar lote_aprobala_whimsy.json</button>
          <button type="button" class="btn btn-sand btn-sm" id="btnDownloadMarkers">⬇ Descargar marcadores.json (Cortes K + Capítulos)</button>
        </div>
      `;
    }
  }

  // ==========================================================
  // MODO 3: CABINA DE AIRE / AUTOCONTROL (WINAMP + DINESAT)
  // ==========================================================
  function renderCabina() {
    const prog = getActiveProgram();
    document.getElementById('cabinLicLabel').textContent = prog.modoComercial ? 'CON SPONSOR / RADIO' : 'SIN SPONSOR';
    document.getElementById('airDot').classList.toggle('is-air', recTimerRunning);

    const blkIdx = Math.max(0, Math.min(cabinBlockIdx, prog.bloques.length - 1));
    cabinBlockIdx = blkIdx;
    const curBlk = prog.bloques[blkIdx];
    const nextBlk = prog.bloques[blkIdx + 1];

    document.getElementById('airBlockTitle').textContent = curBlk ? curBlk.titulo : '—';
    const sdEl = document.getElementById('airBlockSoundDesign');
    if (sdEl) sdEl.textContent = curBlk?.disenoSonoro ? `🎛️ ${curBlk.disenoSonoro}` : '';
    document.getElementById('airNextLabel').textContent = nextBlk
      ? `EN AIRE ${String(blkIdx + 1).padStart(2, '0')} · SIGUIENTE: ${nextBlk.titulo.slice(0, 32)}`
      : `BLOQUE FINAL ${String(blkIdx + 1).padStart(2, '0')}`;

    document.getElementById('prompterSteps').innerHTML = prog.bloques.map((b, i) => (
      `<button type="button" class="step-pill ${i === blkIdx ? 'active' : (i < blkIdx ? 'done' : '')}" data-jump-cabin="${i}">${String(i + 1).padStart(2, '0')} ${esc(b.titulo.slice(0, 18))}</button>`
    )).join('');

    const pt = document.getElementById('prompterText');
    pt.style.fontSize = `${prompterFontRem}rem`;
    pt.textContent = curBlk?.guion || '(Bloque sin texto)';

    document.getElementById('clipCountLabel').textContent = String(clipMarkers.length);

    // 6 pistas curadas del episodio con distintivo Cortina / Top 3
    const six = AudioEngine.getEpisodeTracks();
    const curSnap = AudioEngine.getTelemetrySnapshot();
    const curMap = state.trackCuration || {};
    document.getElementById('deckTracks6').innerHTML = six.map(t => {
      const st = curMap[t.id] || 'rotacion';
      const pref = st === 'cortina' ? '📌 ' : (st === 'top3' ? '⭐ ' : '');
      return `<button type="button" class="track-slot-btn ${curSnap.trackId === t.id ? 'active' : ''}" data-play-track="${esc(t.id)}" title="${esc(t.title)}">${pref}${esc(t.title)}</button>`;
    }).join('');

    // Cartwall F1..F6
    const carts = Editorial.BARRIDA_SCRIPTS;
    document.getElementById('cartwallGrid').innerHTML = carts.map(c => {
      const saved = curSnap.cartSummary?.[c.slot];
      const locked = c.slot === 'F6' && !prog.modoComercial;
      const isPlaying = curSnap.playingCart === c.slot;
      return `<button type="button" class="cart-pad ${saved ? 'ready' : ''} ${isPlaying ? 'playing' : ''}" data-play-cart="${c.slot}" ${locked ? 'disabled' : ''} title="${esc(c.text)}">
        <span style="font-size:0.64rem;font-weight:800;color:${isPlaying ? 'var(--coral)' : 'var(--sand)'};">${c.slot}${saved ? ' · ' + saved.durationSec.toFixed(1) + 's' : ' (sin grabar)'}</span>
        <span style="font-size:0.68rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.name)}</span>
      </button>`;
    }).join('');

    document.querySelectorAll('.cam-mode-btn').forEach(btn => {
      btn.classList.toggle('btn-coral', btn.dataset.cam === activeCamMode);
    });

    renderCabinContextColumn();
    scaleIframeInside(document.getElementById('cabinMonitorWrap'));
  }

  function renderCabinContextColumn() {
    const prog = getActiveProgram();
    const curBlk = prog.bloques[cabinBlockIdx];
    const el = document.getElementById('cabinContextList');
    if (!el) return;

    document.querySelectorAll('[data-cab-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.cabTab === cabinTab);
    });

    if (cabinTab === 'block') {
      const media = curBlk?.medios || [];
      if (!media.length) {
        el.innerHTML = '<div class="muted-note" style="padding:10px;">Sin fotos/videos en este bloque. Podés proyectar desde Gateras o usar tu cámara OBS 1080p.</div>';
        return;
      }
      el.innerHTML = media.map((m, mi) => {
        const rm = RIGHTS_META[m.rights] || RIGHTS_META.read_only;
        const isAir = (currentRightMedia?.url === m.url) || (currentCenterMedia?.url === m.url);
        return `<div class="ctx-media-card ${isAir ? 'on-air' : ''}">
          ${m.kind === 'video'
            ? `<video src="${esc(m.url)}" muted loop playsinline></video>`
            : `<img src="${esc(m.url)}" alt="">`}
          <div style="padding:7px;display:flex;flex-direction:column;gap:5px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
              <span class="r-badge ${rm.cls}">${rm.short}</span>
              <span style="font-size:0.66rem;color:var(--muted);">${m.noDerivatives ? 'ND' : ''}</span>
            </div>
            <div style="font-size:0.7rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.name)}</div>
            <div style="display:flex;gap:4px;">
              <button type="button" class="btn btn-sm btn-coral" style="flex:1;" data-air-media="${mi}:right" ${!rm.canAir ? 'disabled' : ''}>Ala Der.</button>
              <button type="button" class="btn btn-sm" data-air-media="${mi}:center" ${!rm.canAir ? 'disabled' : ''}>9:16</button>
              <button type="button" class="btn btn-sm" data-air-media="${mi}:cine" ${!rm.canAir ? 'disabled' : ''}>Cine</button>
            </div>
          </div>
        </div>`;
      }).join('');
    } else {
      el.innerHTML = state.gateras.length
        ? state.gateras.map((g, gi) => (
          `<div class="cabin-panel">
            <div style="font-size:0.74rem;font-weight:800;">${esc(g.title)}</div>
            <div class="muted-note">${esc(g.sourceName)}</div>
            <button type="button" class="btn btn-sand btn-sm" data-launch-gatera="${gi}">🚀 Mandar al aire ahora</button>
          </div>`
        )).join('')
        : '<div class="muted-note" style="padding:10px;">No tenés notas cargadas en Gateras (Plan B).</div>';
    }
  }

  function handleAudioTelemetry(snap) {
    const cd = document.getElementById('deckCountdown');
    if (cd) {
      cd.textContent = `-${Editorial.formatMMSS(snap.remaining)}`;
      cd.classList.toggle('warn', !!snap.warn15s);
    }
    const tEl = document.getElementById('deckTrackTitle');
    const cEl = document.getElementById('deckTrackCredit');
    if (tEl) tEl.textContent = snap.trackTitle;
    if (cEl) cEl.textContent = snap.trackCredit;

    const duckBtn = document.getElementById('btnDeckDuck');
    if (duckBtn) duckBtn.classList.toggle('btn-coral', snap.isDucked);
    const loopBtn = document.getElementById('btnDeckLoop');
    if (loopBtn) loopBtn.classList.toggle('btn-sage', snap.isLooping);

    const gTimer = document.getElementById('guestTimerLabel');
    if (gTimer) {
      gTimer.textContent = snap.guestPlaying ? `(-${Editorial.formatMMSS(snap.guestRemaining)})` : '';
    }
    const bar = document.getElementById('setupMicBar');
    if (bar) {
      bar.style.width = `${Math.round((snap.micLevel || 0) * 100)}%`;
    }

    if (snap.guestPlaying && busV10) {
      busV10.postMessage({ type: 'OBS_GUEST_LEVEL', level: snap.guestLevel });
    }
  }

  // ==========================================================
  // SINCRONIZACIÓN A OBS-SALIDA V2
  // ==========================================================
  function pushToObsFromBlock(blk) {
    const prog = getActiveProgram();
    const b = blk || prog.bloques[cabinBlockIdx] || prog.bloques[0];
    if (!b) return;
    if (b.medios?.[0] && RIGHTS_META[b.medios[0].rights]?.canAir) {
      const m = b.medios[0];
      if (m.target === 'center') currentCenterMedia = m;
      else currentRightMedia = m;
    }
    pushToObs({
      headline: b.titulo,
      kicker: `${(prog.palabraRectora || 'WHIMSY').toUpperCase()} · BLOQUE`,
      fact: (b.guion || '').split('\n')[0].slice(0, 120),
      heroNumber: b.cifraMonumental || '—'
    });
  }

  function pushToObs(overrides = {}) {
    const prog = getActiveProgram();
    const b = prog.bloques[cabinBlockIdx] || prog.bloques[0];
    const snap = AudioEngine.getTelemetrySnapshot();
    const comingUp = prog.bloques.slice(cabinBlockIdx, cabinBlockIdx + 4).map(x => x.titulo);

    const payload = {
      ts: Date.now(),
      palabraRectora: prog.palabraRectora || 'WHIMSY',
      heroNumber: overrides.heroNumber ?? b?.cifraMonumental ?? '0,5 cm',
      kicker: overrides.kicker ?? `${prog.palabraRectora || 'WHIMSY'} · EN AIRE`,
      headline: overrides.headline ?? b?.titulo ?? prog.tituloYoutube,
      fact: overrides.fact ?? ((b?.guion || '').split('\n')[0].slice(0, 120)),
      blockMeta: `BLOQUE ${String(cabinBlockIdx + 1).padStart(2, '0')} / ${String(prog.bloques.length).padStart(2, '0')} · ${prog.modoComercial ? 'CON SPONSOR' : 'SIN SPONSOR'}`,
      comingUp,
      licenseMode: prog.modoComercial ? 'commercial' : 'pilot',
      mecenasNombre: prog.modoComercial ? (prog.mecenasNombre || '') : '',
      musicCredit: prog.modoComercial
        ? (snap.trackLicense === 'commercial_owned' ? snap.trackCredit : 'Audio comercial / archivo propio')
        : (snap.trackCredit || 'Music provided by mobygratis'),
      bpm: snap.trackTitle !== 'Sin música cargada' ? '102' : '',
      camMode: activeCamMode,
      bgLoopSrc: currentBgLoop,
      centerMedia: currentCenterMedia,
      rightMedia: currentRightMedia,
      notaCard: currentGuestCard,
      bumper: activeBumper ? { active: true, slot: 'SEPARADOR', title: b?.titulo || 'Whimsy POV', subtitle: prog.palabraRectora } : { active: false },
      ...overrides
    };

    try {
      localStorage.setItem(LIVE_KEY, JSON.stringify(payload));
      if (busV10) busV10.postMessage({ type: 'OBS_STATE', payload });
    } catch {}
  }

  function scaleIframeInside(wrap) {
    if (!wrap) return;
    const ifr = wrap.querySelector('iframe');
    if (!ifr || !wrap.clientWidth) return;
    const s = wrap.clientWidth / 1920;
    ifr.style.transform = `scale(${s})`;
  }

  function setupMonitorResizeObservers() {
    if (!('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) scaleIframeInside(e.target);
    });
    const m1 = document.getElementById('cabinMonitorWrap');
    if (m1) ro.observe(m1);
  }

  function syncLicenseSwitchUI() {
    const prog = getActiveProgram();
    const pBtn = document.getElementById('btnLicensePilot');
    const cBtn = document.getElementById('btnLicenseCommercial');
    pBtn.className = prog.modoComercial ? '' : 'active-pilot';
    cBtn.className = prog.modoComercial ? 'active-commercial' : '';
  }

  function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    document.getElementById('viewRadar').classList.toggle('active', mode === 'radar');
    document.getElementById('viewMesa').classList.toggle('active', mode === 'mesa');
    document.getElementById('viewCabina').classList.toggle('active', mode === 'cabina');

    if (mode === 'mesa') renderMesa();
    if (mode === 'cabina') {
      const prog = getActiveProgram();
      AudioEngine.setEpisodeTracks(prog.episodeTrackIds);
      renderCabina();
      pushToObsFromBlock(prog.bloques[cabinBlockIdx]);
    }
  }

  // ==========================================================
  // ACCIONES DE AIRE Y ATAJOS DE TECLADO
  // ==========================================================
  function stepCabinBlock(delta) {
    const prog = getActiveProgram();
    const nextIdx = Math.max(0, Math.min(prog.bloques.length - 1, cabinBlockIdx + delta));
    cabinBlockIdx = nextIdx;
    const blk = prog.bloques[nextIdx];
    chaptersRecorded.push({ sec: recSeconds, title: blk.titulo });

    if (blk.pistaId && AudioEngine.getTelemetrySnapshot().trackId !== blk.pistaId) {
      AudioEngine.playTrackById(blk.pistaId, 3.0);
    }
    if (blk.barridaSlot && AudioEngine.getTelemetrySnapshot().cartSummary?.[blk.barridaSlot]) {
      AudioEngine.playCart(blk.barridaSlot);
    }
    if (blk.medios?.[0] && RIGHTS_META[blk.medios[0].rights]?.canAir) {
      const m = blk.medios[0];
      if (m.target === 'center') { currentCenterMedia = m; activeCamMode = 'split'; }
      else if (m.target === 'cine-16x9') { currentCenterMedia = m; activeCamMode = 'cine-16x9'; }
      else { currentRightMedia = m; }
    }
    renderCabina();
    pushToObsFromBlock(blk);
  }

  function triggerNotaAlMargen() {
    const prog = getActiveProgram();
    const blk = prog.bloques[cabinBlockIdx] || prog.bloques.find(b => b.tipo === 'nota_al_margen');
    const ng = blk?.notaAlMargen;
    if (!ng) {
      toast('Este bloque no tiene configurada una Nota al Margen.');
      return;
    }
    if (!ng.permisoOk) {
      toast('🔴 BLOQUEO LEGAL: Confirmá primero «Sí, autorizo» en Modo 2 (Mesa de Producción).');
      return;
    }
    if (!ng.audioVaultId) {
      toast('Cargá primero el audio (.ogg / .m4a) del invitado en Modo 2.');
      return;
    }
    Vault.getMediaBlobUrl(ng.audioVaultId).then(url => {
      if (!url) return toast('No se encontró el archivo de audio.');
      activeCamMode = 'nota';
      currentGuestCard = { active: true, nombre: ng.nombre, oficio: ng.oficio, ciudad: ng.ciudad, handle: ng.handle, level: 0.2 };
      pushToObs();
      AudioEngine.runNotaAlMargenMacro(url, ng.nombre, (phase) => {
        if (phase === 'ariana_ready' || phase === 'idle') {
          currentGuestCard = null;
          if (activeCamMode === 'nota') activeCamMode = 'loop';
          pushToObs();
        }
      });
    });
  }

  function triggerWindowInterlude() {
    activeCamMode = 'loop';
    currentBgLoop = 'loops/ventana_mar_sol.mp4';
    currentCenterMedia = null;
    pushToObs({ kicker: 'PARÉNTESIS DE VENTANA · PUNTA DEL ESTE', headline: '15 segundos frente al mar', fact: 'Respiro visual e interludio musical' });
    AudioEngine.runWindowInterludeMacro(15);
  }

  function markClipK() {
    if (!openClipIn) {
      openClipIn = recSeconds;
      toast(`✂️ Marca IN de Clip grabada en ${Editorial.formatMMSS(openClipIn)}. Tocá K otra vez para cerrar OUT.`);
    } else {
      const prog = getActiveProgram();
      const blk = prog.bloques[cabinBlockIdx];
      clipMarkers.push({
        inSeg: openClipIn,
        outSeg: Math.max(openClipIn + 15, recSeconds),
        tituloShort: blk?.titulo || prog.palabraRectora
      });
      openClipIn = null;
      toast(`✓ Clip 9:16 guardado (${clipMarkers.length} marcados)`);
      renderCabina();
    }
  }

  function downloadJsonFile(filename, dataObj) {
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  // ==========================================================
  // EVENT WIRING
  // ==========================================================
  function wireEvents() {
    // Tabs superiores
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    document.getElementById('programSelect').addEventListener('change', (ev) => {
      state.activeProgramId = ev.target.value;
      const prog = getActiveProgram();
      selectedBlockId = prog.bloques[0]?.id || null;
      cabinBlockIdx = 0;
      AudioEngine.setLicenseMode(prog.modoComercial ? 'commercial' : 'pilot');
      AudioEngine.setEpisodeTracks(prog.episodeTrackIds);
      syncLicenseSwitchUI();
      saveState();
      renderAll();
    });

    document.getElementById('btnNewProgram').addEventListener('click', () => {
      const name = prompt('Nombre corto o Palabra rectora del nuevo programa:');
      if (!name) return;
      const base = Editorial.createPilotProgram();
      base.episodioId = 'whimsy-' + Date.now().toString(36);
      base.palabraRectora = name.trim().toUpperCase().slice(0, 24);
      base.nombrePrograma = `Programa · ${base.palabraRectora}`;
      base.tituloYoutube = `${base.palabraRectora}: nueva mesa polifónica | Whimsy POV`;
      base.bloques.forEach(b => { b.guion = ''; b.medios = []; });
      state.programs.unshift(base);
      state.activeProgramId = base.episodioId;
      selectedBlockId = base.bloques[0]?.id;
      saveState('✓ Nuevo programa creado');
      renderAll();
      switchMode('mesa');
    });

    document.getElementById('btnLicensePilot').addEventListener('click', () => {
      const p = getActiveProgram();
      p.modoComercial = false;
      AudioEngine.setLicenseMode('pilot');
      syncLicenseSwitchUI();
      saveState('Sin sponsor (mobygratis) activo');
      renderAll();
      pushToObs();
    });

    document.getElementById('btnLicenseCommercial').addEventListener('click', () => {
      const p = getActiveProgram();
      p.modoComercial = true;
      AudioEngine.setLicenseMode('commercial');
      syncLicenseSwitchUI();
      saveState('Con sponsor / Radio activo');
      renderAll();
      pushToObs();
    });

    document.getElementById('btnOpenObs').addEventListener('click', () => {
      window.open('obs-salida.html?monitor=1', 'WhimsyObsMonitor', 'width=1120,height=640');
    });
    document.getElementById('btnOpenObsMonitor').addEventListener('click', () => {
      window.open('obs-salida.html?monitor=1', 'WhimsyObsMonitor', 'width=1120,height=640');
    });

    // Rail Modo 1
    document.getElementById('btnToggleRail').addEventListener('click', () => {
      document.getElementById('viewRadar').classList.toggle('rail-collapsed');
    });

    document.getElementById('railPane').addEventListener('click', (ev) => {
      const b = ev.target.closest('.rail-btn');
      if (!b) return;
      if (b.dataset.filter) railMode = { type: 'filter', value: b.dataset.filter };
      else if (b.dataset.vault) railMode = { type: 'vault', value: b.dataset.vault };
      else if (b.dataset.lens) railMode = { type: 'lens', value: b.dataset.lens };
      else if (b.dataset.feed) railMode = { type: 'feed', value: b.dataset.feed };
      renderAll();
    });

    document.getElementById('btnNewFolder').addEventListener('click', () => {
      const f = prompt('Nombre de la nueva carpeta en Mi Mediateca:');
      if (!f) return;
      Vault.addFolder(f);
      renderRail();
      toast('✓ Carpeta agregada');
    });

    // Drag & drop + Upload + Cmd+V en Mi Mediateca
    const dropBox = document.getElementById('dropVaultBox');
    const fileIn = document.getElementById('vaultFileInput');
    dropBox.addEventListener('click', () => fileIn.click());
    dropBox.addEventListener('dragover', (e) => { e.preventDefault(); dropBox.classList.add('drag-over'); });
    dropBox.addEventListener('dragleave', () => dropBox.classList.remove('drag-over'));
    dropBox.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropBox.classList.remove('drag-over');
      const targetFolder = railMode.type === 'vault' && railMode.value !== 'ALL' ? railMode.value : 'Fotos PDE';
      for (const f of e.dataTransfer.files || []) {
        await Vault.addFile(f, { folder: targetFolder, rights: 'own_cc0' });
      }
      await refreshVaultMedia();
      await AudioEngine.refreshCustomResources();
      renderAll();
      toast('✓ Archivo guardado en Mi Mediateca');
    });

    fileIn.addEventListener('change', async (e) => {
      const targetFolder = railMode.type === 'vault' && railMode.value !== 'ALL' ? railMode.value : 'Fotos PDE';
      for (const f of e.target.files || []) {
        await Vault.addFile(f, { folder: targetFolder, rights: 'own_cc0' });
      }
      fileIn.value = '';
      await refreshVaultMedia();
      await AudioEngine.refreshCustomResources();
      renderAll();
      toast('✓ Subido a Mi Mediateca');
    });

    window.addEventListener('paste', async (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const saved = await Vault.addFromClipboard(e, 'Capturas WhatsApp');
      if (saved.length) {
        await refreshVaultMedia();
        railMode = { type: 'vault', value: 'Capturas WhatsApp' };
        selectedItemId = saved[0].id;
        renderAll();
        toast('✓ Captura pegada en Mi Mediateca');
      }
    });

    // Búsqueda, Grilla, Palabras candidatas
    document.getElementById('radarSearch').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderAll();
    });
    document.getElementById('btnToggleGrid').addEventListener('click', () => {
      viewAsGrid = !viewAsGrid;
      document.getElementById('btnToggleGrid').classList.toggle('btn-coral', viewAsGrid);
      renderRadarList();
    });
    document.getElementById('btnRefreshRss').addEventListener('click', async () => {
      await fetchLiveInbox();
      renderAll();
      toast('↻ Bandeja RSS actualizada');
    });
    document.getElementById('wordCandidatesRow').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-word]');
      if (!chip) return;
      activeCandidateWord = chip.dataset.word;
      renderAll();
    });

    document.getElementById('radarListScroll').addEventListener('click', (e) => {
      const card = e.target.closest('[data-item-id]');
      if (!card) return;
      selectedItemId = card.dataset.itemId;
      renderRadarList();
      renderReaderPane();
    });

    // Visor Modo 1 acciones
    document.getElementById('btnReaderPrev').addEventListener('click', () => {
      const idx = Math.max(0, filteredItems.findIndex(x => x.id === selectedItemId));
      if (idx > 0) {
        selectedItemId = filteredItems[idx - 1].id;
        renderRadarList();
        renderReaderPane();
      }
    });
    document.getElementById('btnReaderNext').addEventListener('click', () => {
      const idx = Math.max(0, filteredItems.findIndex(x => x.id === selectedItemId));
      if (idx + 1 < filteredItems.length) {
        selectedItemId = filteredItems[idx + 1].id;
        renderRadarList();
        renderReaderPane();
      }
    });
    document.getElementById('btnOpenZoom').addEventListener('click', () => openZoomOverlay('read', 0));
    document.getElementById('btnSaveToggle').addEventListener('click', () => {
      if (!selectedItemId) return;
      const idx = state.savedIds.indexOf(selectedItemId);
      if (idx >= 0) state.savedIds.splice(idx, 1);
      else state.savedIds.push(selectedItemId);
      saveState();
      renderAll();
    });
    document.getElementById('btnPickToMesa').addEventListener('click', () => {
      const it = filteredItems.find(x => x.id === selectedItemId);
      if (it) addNoteToMesa(it);
    });
    document.getElementById('btnAddToGateras').addEventListener('click', () => {
      const it = filteredItems.find(x => x.id === selectedItemId);
      if (it) addItemToGateras(it);
    });

    document.getElementById('readerBody').addEventListener('click', (e) => {
      if (e.target.id === 'btnReaderPaperToggle') {
        paperDarkTheme = !paperDarkTheme;
        renderReaderPane();
        return;
      }
      const it = filteredItems.find(x => x.id === selectedItemId);
      if (!it) return;
      const media = getItemMediaList(it);
      const pickBtn = e.target.closest('[data-pick-media-idx]');
      if (pickBtn) {
        addMediaToMesa(media[Number(pickBtn.dataset.pickMediaIdx)]);
        return;
      }
      const zoomTrig = e.target.closest('[data-zoom-idx]');
      if (zoomTrig) {
        openZoomOverlay('visual', Number(zoomTrig.dataset.zoomIdx));
        return;
      }
      const rightsQuoteBtn = e.target.closest('[data-rights-quote]');
      if (rightsQuoteBtn) {
        const u = rightsQuoteBtn.dataset.rightsQuote;
        state.rightsOverrides[u] = { ...(state.rightsOverrides[u] || {}), rights: 'critical_quote' };
        saveState('🟡 Marcado como cita crítica con crédito');
        renderReaderPane();
        renderRadarList();
        return;
      }
      if (e.target.id === 'btnCopyItemInviteEs' && it.protagonist) {
        navigator.clipboard?.writeText(it.protagonist.inviteEs);
        toast('✓ Invitación ES copiada');
      }
      if (e.target.id === 'btnCopyItemInviteEn' && it.protagonist) {
        navigator.clipboard?.writeText(it.protagonist.inviteEn);
        toast('✓ Invitación EN copiada');
      }
    });

    // Subrayar cita -> botón flotante
    const qFloat = document.getElementById('quoteFloatBtn');
    const handleTextSelect = (e) => {
      const inside = e.target.closest('#articleProseRoot') || e.target.closest('#zoomReadBox');
      if (!inside) return;
      setTimeout(() => {
        const sel = window.getSelection();
        const txt = sel ? sel.toString().trim() : '';
        if (txt.length >= 12) {
          pendingQuoteText = txt;
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          qFloat.style.left = `${Math.min(window.innerWidth - 190, Math.max(12, rect.left))}px`;
          qFloat.style.top = `${Math.min(window.innerHeight - 48, rect.bottom + 8)}px`;
          qFloat.style.display = 'inline-flex';
        } else {
          qFloat.style.display = 'none';
        }
      }, 20);
    };
    document.addEventListener('mouseup', handleTextSelect);
    qFloat.addEventListener('click', () => {
      const it = filteredItems.find(x => x.id === selectedItemId);
      if (it && pendingQuoteText) {
        addNoteToMesa(it, `«${pendingQuoteText}»`);
        pendingQuoteText = '';
        qFloat.style.display = 'none';
        window.getSelection()?.removeAllRanges();
      }
    });

    // Zoom overlay controls
    document.getElementById('btnZoomClose').addEventListener('click', closeZoomOverlay);
    document.getElementById('zoomTabRead').addEventListener('click', () => { zoomView = 'read'; renderZoomOverlay(); });
    document.getElementById('zoomTabVisual').addEventListener('click', () => { zoomView = 'visual'; renderZoomOverlay(); });
    document.getElementById('zoomPrevItem').addEventListener('click', () => stepZoomItem(-1));
    document.getElementById('zoomNextItem').addEventListener('click', () => stepZoomItem(1));
    document.getElementById('btnZoomTheme').addEventListener('click', () => { paperDarkTheme = !paperDarkTheme; renderZoomOverlay(); });
    document.querySelectorAll('.zoom-font-btn').forEach(b => {
      b.addEventListener('click', () => { zoomFontPx = Number(b.dataset.size) || 19; renderZoomOverlay(); });
    });
    document.querySelectorAll('.zoom-scale-btn').forEach(b => {
      b.addEventListener('click', () => {
        zoomScale = Number(b.dataset.scale) || 1;
        if (zoomScale === 1) { zoomPan.x = 0; zoomPan.y = 0; }
        zoomView = 'visual';
        renderZoomOverlay();
      });
    });
    document.getElementById('zoomThumbs').addEventListener('click', (e) => {
      const t = e.target.closest('[data-zoom-thumb]');
      if (!t) return;
      zoomMediaIdx = Number(t.dataset.zoomThumb);
      zoomScale = 1; zoomPan.x = 0; zoomPan.y = 0;
      zoomView = 'visual';
      renderZoomOverlay();
    });
    document.getElementById('btnZoomChooseMedia').addEventListener('click', () => {
      const it = filteredItems.find(x => x.id === selectedItemId);
      const media = getItemMediaList(it);
      if (media[zoomMediaIdx]) addMediaToMesa(media[zoomMediaIdx]);
    });
    document.getElementById('btnZoomSave').addEventListener('click', () => {
      document.getElementById('btnSaveToggle').click();
      renderZoomOverlay();
    });
    document.getElementById('btnZoomToMesa').addEventListener('click', () => {
      const it = filteredItems.find(x => x.id === selectedItemId);
      if (it) addNoteToMesa(it);
    });

    // Pan en Lupa Visual
    const zVis = document.getElementById('zoomVisualBox');
    zVis.addEventListener('mousedown', (e) => {
      if (zoomScale <= 1) return;
      zoomPan.dragging = true;
      zoomPan.startX = e.clientX - zoomPan.x;
      zoomPan.startY = e.clientY - zoomPan.y;
      zVis.classList.add('dragging');
    });
    window.addEventListener('mousemove', (e) => {
      if (!zoomPan.dragging) return;
      zoomPan.x = e.clientX - zoomPan.startX;
      zoomPan.y = e.clientY - zoomPan.startY;
      const target = zVis.querySelector('img, video');
      if (target) target.style.transform = `translate(${zoomPan.x}px,${zoomPan.y}px) scale(${zoomScale})`;
    });
    window.addEventListener('mouseup', () => {
      zoomPan.dragging = false;
      zVis.classList.remove('dragging');
    });

    // MODO 2: MESA DE PRODUCCIÓN
    document.querySelectorAll('[data-bank-tab]').forEach(t => {
      t.addEventListener('click', () => {
        bankTab = t.dataset.bankTab;
        document.querySelectorAll('[data-bank-tab]').forEach(x => x.classList.toggle('active', x.dataset.bankTab === bankTab));
        renderBankAndGateras();
      });
    });

    document.getElementById('viewMesa').addEventListener('click', (e) => {
      const prog = getActiveProgram();
      const presetWord = e.target.closest('[data-preset-word]');
      if (presetWord) {
        prog.palabraRectora = presetWord.dataset.presetWord;
        saveState();
        renderMesa();
        return;
      }
      const inspT = e.target.closest('[data-insp-tab]');
      if (inspT) {
        inspTab = inspT.dataset.inspTab;
        renderInspector();
        return;
      }
      const injN = e.target.closest('[data-inject-note]');
      if (injN) {
        const note = state.chosenNotes[Number(injN.dataset.injectNote)];
        const blk = prog.bloques.find(b => b.id === selectedBlockId) || prog.bloques[0];
        if (note && blk) {
          blk.guion = (blk.guion ? blk.guion + '\n\n' : '') + `${note.quote} (${note.sourceName})`;
          saveState('✓ Cita agregada al bloque');
          renderBlocksList();
          renderRhythmAndBadges();
        }
        return;
      }
      const injM = e.target.closest('[data-inject-media]');
      if (injM) {
        const med = state.chosenMedia[Number(injM.dataset.injectMedia)];
        const blk = prog.bloques.find(b => b.id === selectedBlockId) || prog.bloques[0];
        if (med && blk) {
          blk.medios = blk.medios || [];
          if (!blk.medios.some(x => x.url === med.url)) blk.medios.push({ ...med });
          saveState('✓ Medio agregado al bloque');
          renderBlocksList();
        }
        return;
      }
      const delN = e.target.closest('[data-del-note]');
      if (delN) { state.chosenNotes.splice(Number(delN.dataset.delNote), 1); saveState(); renderBankAndGateras(); return; }
      const delM = e.target.closest('[data-del-media]');
      if (delM) { state.chosenMedia.splice(Number(delM.dataset.delMedia), 1); saveState(); renderBankAndGateras(); return; }
      const delG = e.target.closest('[data-del-gatera]');
      if (delG) { state.gateras.splice(Number(delG.dataset.delGatera), 1); saveState(); renderBankAndGateras(); return; }

      const seg = e.target.closest('[data-select-block]');
      if (seg) {
        selectedBlockId = seg.dataset.selectBlock;
        renderBlocksList();
        renderInspector();
        return;
      }
      const mvBtn = e.target.closest('[data-move-block]');
      if (mvBtn) {
        const [bid, dirStr] = mvBtn.dataset.moveBlock.split(':');
        const dir = Number(dirStr);
        const i = prog.bloques.findIndex(b => b.id === bid);
        const target = i + dir;
        if (i >= 0 && target >= 0 && target < prog.bloques.length) {
          const [item] = prog.bloques.splice(i, 1);
          prog.bloques.splice(target, 0, item);
          saveState();
          renderBlocksList();
          renderRhythmAndBadges();
        }
        return;
      }
      const delB = e.target.closest('[data-del-block]');
      if (delB) {
        if (prog.bloques.length <= 1) return toast('El programa debe tener al menos 1 bloque.');
        prog.bloques = prog.bloques.filter(b => b.id !== delB.dataset.delBlock);
        selectedBlockId = prog.bloques[0].id;
        saveState();
        renderBlocksList();
        renderRhythmAndBadges();
        return;
      }
      const toggleB = e.target.closest('[data-toggle-block]');
      if (toggleB && !e.target.closest('button')) {
        selectedBlockId = toggleB.dataset.toggleBlock;
        renderBlocksList();
        renderInspector();
        return;
      }
      const remBM = e.target.closest('[data-remove-bmedia]');
      if (remBM) {
        const [bid, mi] = remBM.dataset.removeBmedia.split(':');
        const blk = prog.bloques.find(b => b.id === bid);
        if (blk?.medios) { blk.medios.splice(Number(mi), 1); saveState(); renderBlocksList(); }
        return;
      }
      const cEs = e.target.closest('[data-copy-guest-es]');
      if (cEs) {
        const msgs = Editorial.buildInviteMessages(Editorial.CURATED_GUESTS_80_20[Number(cEs.dataset.copyGuestEs)]);
        navigator.clipboard?.writeText(msgs.es);
        toast('✓ Invitación Nota al Margen ES copiada');
        return;
      }
      const cEn = e.target.closest('[data-copy-guest-en]');
      if (cEn) {
        const msgs = Editorial.buildInviteMessages(Editorial.CURATED_GUESTS_80_20[Number(cEn.dataset.copyGuestEn)]);
        navigator.clipboard?.writeText(msgs.en);
        toast('✓ Invitación EN copiada');
        return;
      }
      const cycleCur = e.target.closest('[data-cycle-curation]');
      if (cycleCur) {
        const tid = cycleCur.dataset.cycleCuration;
        state.trackCuration = state.trackCuration || {};
        const seq = ['rotacion', 'top3', 'cortina'];
        const cur = state.trackCuration[tid] || 'rotacion';
        const next = seq[(seq.indexOf(cur) + 1) % seq.length];
        state.trackCuration[tid] = next;
        saveState(next === 'cortina' ? '📌 Guardada como Cortina fija para siempre' : (next === 'top3' ? '⭐ Guardada en Top 3 semanal' : '↻ Puesta en rotación'));
        renderInspector();
        return;
      }
      const togEp = e.target.closest('[data-toggle-ep-track]');
      if (togEp) {
        const tid = togEp.dataset.toggleEpTrack;
        prog.episodeTrackIds = Array.isArray(prog.episodeTrackIds) ? [...prog.episodeTrackIds] : [];
        const pos = prog.episodeTrackIds.indexOf(tid);
        if (pos >= 0) {
          prog.episodeTrackIds.splice(pos, 1);
        } else {
          if (prog.episodeTrackIds.length >= 6) prog.episodeTrackIds.pop();
          prog.episodeTrackIds.unshift(tid);
        }
        AudioEngine.setEpisodeTracks(prog.episodeTrackIds);
        saveState(`Deck del episodio actualizado (${prog.episodeTrackIds.length}/6)`);
        renderInspector();
        return;
      }
      if (e.target.id === 'btnInspPushPreview') {
        const blk = prog.bloques.find(b => b.id === selectedBlockId);
        pushToObsFromBlock(blk);
        toast('✓ Previa actualizada');
      }
      if (e.target.id === 'btnDownloadAprobalo' || e.target.id === 'btnDownloadMarkers' || e.target.dataset.copyPack) {
        const tracks = AudioEngine.getCatalogForMode(prog.modoComercial ? 'commercial' : 'pilot');
        const pack = Editorial.buildProductPack(prog, clipMarkers, chaptersRecorded, tracks);
        if (e.target.id === 'btnDownloadAprobalo') {
          downloadJsonFile(`lote_aprobala_${prog.episodioId}.json`, pack.loteAprobalo);
          toast('✓ Descargado lote Aprobalo JSON');
        } else if (e.target.id === 'btnDownloadMarkers') {
          downloadJsonFile(`marcadores_${prog.episodioId}.json`, pack.marcadoresJson);
          toast('✓ Descargado marcadores.json');
        } else if (e.target.dataset.copyPack === 'yt') {
          navigator.clipboard?.writeText(pack.youtubeDesc); toast('✓ Copiado YouTube');
        } else if (e.target.dataset.copyPack === 'ig') {
          navigator.clipboard?.writeText(pack.igCopy); toast('✓ Copiado IG');
        } else if (e.target.dataset.copyPack === 'guest48') {
          navigator.clipboard?.writeText(pack.guestDelivery48h); toast('✓ Copiado entrega 48h');
        }
      }
    });

    document.getElementById('mesaWordInput').addEventListener('input', (e) => {
      getActiveProgram().palabraRectora = e.target.value.toUpperCase();
      saveState();
      pushToObsFromBlock(getActiveProgram().bloques.find(b => b.id === selectedBlockId));
    });
    document.getElementById('mesaYtTitleInput').addEventListener('input', (e) => {
      getActiveProgram().tituloYoutube = e.target.value;
      document.getElementById('ytTitleLen').textContent = String(e.target.value.length);
      saveState();
    });
    document.getElementById('mesaMecenasInput').addEventListener('input', (e) => {
      getActiveProgram().mecenasNombre = e.target.value;
      saveState();
    });

    document.getElementById('btnAddBlock').addEventListener('click', () => {
      const prog = getActiveProgram();
      const typeId = document.getElementById('addBlockTypeSelect').value;
      const meta = Editorial.BLOCK_TYPES.find(t => t.id === typeId) || Editorial.BLOCK_TYPES[2];
      const newId = 'blk-' + Date.now().toString(36);
      prog.bloques.push({
        id: newId,
        tipo: meta.id,
        titulo: meta.label,
        duracionSeg: meta.defaultSec,
        cifraMonumental: prog.palabraRectora || '—',
        genderRef: null,
        pistaId: prog.episodeTrackIds[0] || '',
        disenoSonoro: Editorial.DEFAULT_SOUND_DESIGN_BY_TYPE?.[meta.id] || '',
        guion: '',
        medios: [],
        notaAlMargen: meta.id === 'nota_al_margen' ? { nombre: '', oficio: '', ciudad: '', handle: '', gender: 'mujer', audioVaultId: '', audioName: '', permisoOk: false } : undefined
      });
      selectedBlockId = newId;
      saveState('✓ Bloque sumado a la escaleta');
      renderMesa();
    });

    document.getElementById('btnGoCabina').addEventListener('click', () => switchMode('cabina'));

    // Edición inline de campos dentro de Bloques
    document.getElementById('blocksList').addEventListener('input', (e) => {
      const prog = getActiveProgram();
      const f = e.target.dataset.bField;
      if (f) {
        const blk = prog.bloques.find(b => b.id === e.target.dataset.bid);
        if (!blk) return;
        blk[f] = f === 'duracionSeg' ? Math.max(5, Number(e.target.value) || 30) : e.target.value;
        saveState();
        renderRhythmAndBadges();
        return;
      }
      const gf = e.target.dataset.guestField;
      if (gf) {
        const blk = prog.bloques.find(b => b.id === e.target.dataset.bid);
        if (!blk) return;
        blk.notaAlMargen = blk.notaAlMargen || {};
        blk.notaAlMargen[gf] = e.target.value;
        saveState();
      }
    });

    document.getElementById('blocksList').addEventListener('change', async (e) => {
      const prog = getActiveProgram();
      if (e.target.dataset.bField) {
        renderBlocksList();
        renderRhythmAndBadges();
        return;
      }
      if (e.target.dataset.guestPreset) {
        const blk = prog.bloques.find(b => b.id === e.target.dataset.guestPreset);
        const g = Editorial.CURATED_GUESTS_80_20.find(x => x.id === e.target.value);
        if (blk && g) {
          blk.notaAlMargen = {
            ...(blk.notaAlMargen || {}),
            nombre: g.name,
            oficio: g.role,
            ciudad: g.territory,
            handle: g.handle,
            gender: g.gender
          };
          saveState('✓ Invitado cargado en Nota al Margen');
          renderBlocksList();
          renderRhythmAndBadges();
        }
        return;
      }
      if (e.target.dataset.guestAudio) {
        const blk = prog.bloques.find(b => b.id === e.target.dataset.guestAudio);
        const f = e.target.files?.[0];
        if (blk && f) {
          const rec = await Vault.addFile(f, { folder: 'Notas al Margen', rights: 'permission', name: f.name });
          blk.notaAlMargen = blk.notaAlMargen || {};
          blk.notaAlMargen.audioVaultId = rec.id;
          blk.notaAlMargen.audioName = f.name;
          await refreshVaultMedia();
          saveState('✓ Audio invitado guardado en Vault');
          renderBlocksList();
        }
        return;
      }
      if (e.target.dataset.guestPerm) {
        const blk = prog.bloques.find(b => b.id === e.target.dataset.guestPerm);
        if (blk) {
          blk.notaAlMargen = blk.notaAlMargen || {};
          blk.notaAlMargen.permisoOk = e.target.checked;
          saveState();
          renderBlocksList();
        }
        return;
      }
      if (e.target.dataset.mediaNd) {
        const [bid, mi] = e.target.dataset.mediaNd.split(':');
        const blk = prog.bloques.find(b => b.id === bid);
        if (blk?.medios?.[Number(mi)]) {
          blk.medios[Number(mi)].noDerivatives = e.target.checked;
          saveState();
        }
        return;
      }
      if (e.target.dataset.mediaTarget) {
        const [bid, mi] = e.target.dataset.mediaTarget.split(':');
        const blk = prog.bloques.find(b => b.id === bid);
        if (blk?.medios?.[Number(mi)]) {
          blk.medios[Number(mi)].target = e.target.value;
          saveState();
        }
      }
    });

    // Drag & Drop entre Banco y Bloques
    document.getElementById('viewMesa').addEventListener('dragstart', (e) => {
      const bankCard = e.target.closest('.bank-chip-item');
      if (bankCard) {
        e.dataTransfer.setData('text/plain', JSON.stringify({ kind: bankCard.dataset.dragType, idx: Number(bankCard.dataset.dragIdx) }));
        dragBlockId = null;
        return;
      }
      const blk = e.target.closest('.block-card');
      if (blk) {
        dragBlockId = blk.dataset.blockId;
        e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'block', id: dragBlockId }));
      }
    });
    document.getElementById('blocksList').addEventListener('dragover', (e) => {
      const card = e.target.closest('.block-card');
      if (card) { e.preventDefault(); card.classList.add('drop-target'); }
    });
    document.getElementById('blocksList').addEventListener('dragleave', (e) => {
      const card = e.target.closest('.block-card');
      if (card) card.classList.remove('drop-target');
    });
    document.getElementById('blocksList').addEventListener('drop', (e) => {
      const card = e.target.closest('.block-card');
      if (!card) return;
      e.preventDefault();
      card.classList.remove('drop-target');
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const prog = getActiveProgram();
        const targetId = card.dataset.blockId;
        const targetBlk = prog.bloques.find(b => b.id === targetId);
        if (data.kind === 'block' && data.id !== targetId) {
          const fromIdx = prog.bloques.findIndex(b => b.id === data.id);
          const toIdx = prog.bloques.findIndex(b => b.id === targetId);
          if (fromIdx >= 0 && toIdx >= 0) {
            const [moved] = prog.bloques.splice(fromIdx, 1);
            prog.bloques.splice(toIdx, 0, moved);
            saveState(); renderBlocksList(); renderRhythmAndBadges();
          }
        } else if (data.kind === 'note' && targetBlk) {
          const n = state.chosenNotes[data.idx];
          if (n) {
            targetBlk.guion = (targetBlk.guion ? targetBlk.guion + '\n\n' : '') + `${n.quote} (${n.sourceName})`;
            saveState('✓ Cita soltada en bloque'); renderBlocksList(); renderRhythmAndBadges();
          }
        } else if (data.kind === 'media' && targetBlk) {
          const m = state.chosenMedia[data.idx];
          if (m) {
            targetBlk.medios = targetBlk.medios || [];
            if (!targetBlk.medios.some(x => x.url === m.url)) targetBlk.medios.push({ ...m });
            saveState('✓ Medio soltado en bloque'); renderBlocksList();
          }
        }
      } catch {}
    });

    // MODO 3: CABINA DE AIRE
    document.getElementById('btnToggleGhostGuide').addEventListener('click', () => {
      const g = document.getElementById('ghost9x16Guide');
      g.classList.toggle('on');
      document.getElementById('btnToggleGhostGuide').classList.toggle('active', g.classList.contains('on'));
    });

    document.querySelectorAll('.cam-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCamMode = btn.dataset.cam;
        activeBumper = false;
        if (activeCamMode === 'loop') {
          currentCenterMedia = null;
          currentGuestCard = null;
        }
        renderCabina();
        pushToObs();
      });
    });

    document.getElementById('btnToggleBumper').addEventListener('click', () => {
      activeBumper = !activeBumper;
      document.getElementById('btnToggleBumper').classList.toggle('btn-coral', activeBumper);
      pushToObs();
    });

    document.getElementById('btnDeckPlay').addEventListener('click', () => AudioEngine.togglePlayPause());
    document.getElementById('btnDeckDuck').addEventListener('click', () => AudioEngine.toggleDuck());
    document.getElementById('btnDeckFade').addEventListener('click', () => AudioEngine.fadeStop(3.0));
    document.getElementById('btnDeckNext').addEventListener('click', () => AudioEngine.nextTrack());
    document.getElementById('btnDeckLoop').addEventListener('click', () => AudioEngine.toggleLoop());
    document.getElementById('deckVolSlider').addEventListener('input', (e) => {
      document.getElementById('deckVolPct').textContent = `${e.target.value}%`;
      AudioEngine.setVolume(Number(e.target.value) / 100);
    });
    document.getElementById('deckTracks6').addEventListener('click', (e) => {
      const b = e.target.closest('[data-play-track]');
      if (b) { AudioEngine.playTrackById(b.dataset.playTrack, 2.5).then(() => { renderCabina(); pushToObs(); }); }
    });
    document.getElementById('cartwallGrid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-play-cart]');
      if (b) AudioEngine.playCart(b.dataset.playCart);
    });
    document.getElementById('btnCancelMacros').addEventListener('click', () => {
      AudioEngine.cancelMacros();
      activeBumper = false;
      currentGuestCard = null;
      if (activeCamMode === 'nota') activeCamMode = 'loop';
      pushToObs();
    });

    document.getElementById('btnMacroNota').addEventListener('click', triggerNotaAlMargen);
    document.getElementById('btnGuestPause').addEventListener('click', () => AudioEngine.togglePauseGuest());
    document.getElementById('btnMacroVentana').addEventListener('click', triggerWindowInterlude);

    document.getElementById('btnCabinPrev').addEventListener('click', () => stepCabinBlock(-1));
    document.getElementById('btnCabinNext').addEventListener('click', () => stepCabinBlock(1));
    document.getElementById('btnMarkClip').addEventListener('click', markClipK);

    document.getElementById('prompterSteps').addEventListener('click', (e) => {
      const p = e.target.closest('[data-jump-cabin]');
      if (!p) return;
      cabinBlockIdx = Number(p.dataset.jumpCabin);
      renderCabina();
      pushToObsFromBlock(getActiveProgram().bloques[cabinBlockIdx]);
    });

    document.getElementById('btnPromptFontMinus').addEventListener('click', () => {
      prompterFontRem = Math.max(1.0, prompterFontRem - 0.15);
      document.getElementById('prompterText').style.fontSize = `${prompterFontRem}rem`;
    });
    document.getElementById('btnPromptFontPlus').addEventListener('click', () => {
      prompterFontRem = Math.min(2.4, prompterFontRem + 0.15);
      document.getElementById('prompterText').style.fontSize = `${prompterFontRem}rem`;
    });

    document.getElementById('btnToggleRecTimer').addEventListener('click', () => {
      recTimerRunning = !recTimerRunning;
      const btn = document.getElementById('btnToggleRecTimer');
      if (recTimerRunning) {
        btn.classList.add('btn-coral');
        recInterval = setInterval(() => {
          recSeconds++;
          btn.textContent = `● AIRE ${Editorial.formatMMSS(recSeconds)}`;
        }, 1000);
      } else {
        btn.classList.remove('btn-coral');
        clearInterval(recInterval);
      }
      document.getElementById('airDot').classList.toggle('is-air', recTimerRunning);
    });

    document.querySelectorAll('[data-cab-tab]').forEach(t => {
      t.addEventListener('click', () => {
        cabinTab = t.dataset.cabTab;
        renderCabinContextColumn();
      });
    });

    document.getElementById('cabinContextList').addEventListener('click', (e) => {
      const prog = getActiveProgram();
      const blk = prog.bloques[cabinBlockIdx];
      const airBtn = e.target.closest('[data-air-media]');
      if (airBtn && blk) {
        const [miStr, zone] = airBtn.dataset.airMedia.split(':');
        const m = blk.medios?.[Number(miStr)];
        if (!m || !RIGHTS_META[m.rights]?.canAir) return toast('🔴 Bloqueado por derechos.');
        if (zone === 'right') {
          currentRightMedia = m;
        } else if (zone === 'center') {
          currentCenterMedia = m;
          activeCamMode = 'split';
        } else if (zone === 'cine') {
          currentCenterMedia = m;
          activeCamMode = 'cine-16x9';
          AudioEngine.fadeStop(2.5);
        }
        activeBumper = false;
        renderCabina();
        pushToObs({ headline: m.name, fact: m.credit || blk.titulo });
        return;
      }
      const gatBtn = e.target.closest('[data-launch-gatera]');
      if (gatBtn) {
        const g = state.gateras[Number(gatBtn.dataset.launchGatera)];
        if (!g) return;
        currentRightMedia = g.medios?.[0] || currentRightMedia;
        document.getElementById('prompterText').textContent = `${g.title}\n\n${g.summary}`;
        pushToObs({ kicker: '⚡ PLAN B EN GATERAS', headline: g.title, fact: g.sourceName });
        toast('⚡ Tema de Gateras al aire');
      }
    });

    // MODALES: + SUMAR Y SETUP
    document.getElementById('btnOpenSumar').addEventListener('click', () => {
      const sel = document.getElementById('sumarFolder');
      sel.innerHTML = Vault.getFolders().map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
      document.getElementById('sumarModal').classList.add('open');
    });
    document.getElementById('btnCloseSumar').addEventListener('click', () => {
      document.getElementById('sumarModal').classList.remove('open');
    });
    document.getElementById('btnSubmitSumar').addEventListener('click', async () => {
      const title = document.getElementById('sumarTitle').value.trim();
      const lens = document.getElementById('sumarLens').value.trim() || 'Arte';
      const url = document.getElementById('sumarUrl').value.trim();
      const folder = document.getElementById('sumarFolder').value || 'Fotos PDE';
      const summary = document.getElementById('sumarSummary').value.trim();
      const files = Array.from(document.getElementById('sumarFilesInput').files || []);

      const imgs = [];
      const vids = [];
      for (const f of files) {
        const rec = await Vault.addFile(f, { folder, rights: 'own_cc0', sourceUrl: url, name: f.name });
        if (rec.kind === 'video') vids.push({ url: rec.url, vaultId: rec.id, caption: f.name, rights: 'own_cc0', credit: 'Archivo propio' });
        else if (rec.kind === 'image') imgs.push({ url: rec.url, vaultId: rec.id, caption: f.name, rights: 'own_cc0', credit: 'Archivo propio' });
      }
      if (title || url || summary) {
        const customId = 'custom-' + Date.now().toString(36);
        state.customRadarItems.unshift({
          id: customId,
          origin: 'custom',
          feedId: 'custom',
          feedName: 'Sumado por Ariana',
          title: title || url || 'Hallazgo propio',
          link: url,
          summary: summary || title,
          publishedAt: new Date().toISOString(),
          lenses: [lens],
          images: imgs,
          videos: vids,
          cleanReaderHtml: `<p>${esc(summary || title)}</p>${url ? `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a></p>` : ''}`,
          defaultRights: 'own_cc0'
        });
        selectedItemId = customId;
      }
      await refreshVaultMedia();
      await AudioEngine.refreshCustomResources();
      saveState('✓ Sumado a tu Radar y Mediateca');
      document.getElementById('sumarTitle').value = '';
      document.getElementById('sumarUrl').value = '';
      document.getElementById('sumarSummary').value = '';
      document.getElementById('sumarFilesInput').value = '';
      document.getElementById('sumarModal').classList.remove('open');
      renderAll();
    });

    // Modal Setup + Grabador de 5 Barridas
    function renderBarridasSetup() {
      const snap = AudioEngine.getTelemetrySnapshot();
      document.getElementById('setupBarridasList').innerHTML = Editorial.BARRIDA_SCRIPTS.map(b => {
        const saved = snap.cartSummary?.[b.slot];
        const isRec = recordingSlot === b.slot;
        return `<div style="border:1px solid var(--border);border-radius:7px;padding:9px 11px;background:var(--bg);display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong style="font-size:0.78rem;">${b.slot} · ${esc(b.name)} (~${b.estSec}s)</strong>
            <div style="display:flex;gap:5px;">
              ${saved ? `<span class="r-badge r-own_cc0 tabular">${saved.durationSec.toFixed(1)}s grabada</span>` : '<span class="r-badge r-permission">Pendiente</span>'}
              <button type="button" class="btn btn-sm ${isRec ? 'btn-coral' : 'btn-sand'}" data-rec-slot="${b.slot}">${isRec ? '⏹ Detener y guardar' : '🎙️ Grabar'}</button>
              ${saved ? `<button type="button" class="btn btn-sm" data-test-cart="${b.slot}">▶ Oír</button>` : ''}
              ${saved ? `<button type="button" class="btn btn-sm btn-ghost" data-del-cart="${b.slot}">✕</button>` : ''}
            </div>
          </div>
          <p style="font-size:0.76rem;color:var(--cream);line-height:1.45;">«${esc(b.text)}»</p>
        </div>`;
      }).join('');
    }

    document.getElementById('btnOpenSetup').addEventListener('click', () => {
      renderBarridasSetup();
      document.getElementById('setupModal').classList.add('open');
    });
    document.getElementById('btnCloseSetup').addEventListener('click', () => {
      AudioEngine.stopMicMonitor();
      document.getElementById('setupModal').classList.remove('open');
    });
    document.getElementById('btnStartMicCheck').addEventListener('click', () => AudioEngine.startMicMonitor());
    document.getElementById('btnStopMicCheck').addEventListener('click', () => AudioEngine.stopMicMonitor());

    document.getElementById('setupBarridasList').addEventListener('click', async (e) => {
      const recBtn = e.target.closest('[data-rec-slot]');
      if (recBtn) {
        const slot = recBtn.dataset.recSlot;
        const meta = Editorial.BARRIDA_SCRIPTS.find(x => x.slot === slot);
        if (recordingSlot === slot) {
          await AudioEngine.stopRecordCart();
          recordingSlot = null;
          renderBarridasSetup();
          if (currentMode === 'cabina') renderCabina();
        } else {
          recordingSlot = slot;
          await AudioEngine.startRecordCart(slot, meta?.name || slot);
          renderBarridasSetup();
        }
        return;
      }
      const playB = e.target.closest('[data-test-cart]');
      if (playB) { AudioEngine.playCart(playB.dataset.testCart); return; }
      const delB = e.target.closest('[data-del-cart]');
      if (delB) {
        await Vault.deleteCartSlot(delB.dataset.delCart);
        await AudioEngine.refreshCustomResources();
        renderBarridasSetup();
        if (currentMode === 'cabina') renderCabina();
      }
    });

    document.getElementById('btnDownloadBackup').addEventListener('click', async () => {
      const data = await Vault.exportBackupJson(state);
      downloadJsonFile(`whimsy_studio_backup_${new Date().toISOString().slice(0, 10)}.json`, data);
      toast('✓ Backup descargado');
    });

    // ATAJOS DE TECLADO FÍSICOS (DESACTIVADOS EN CAMPOS DE TEXTO)
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;

      if (zoomOpen) {
        if (e.key === 'Escape') { e.preventDefault(); closeZoomOverlay(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); stepZoomItem(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); stepZoomItem(1); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const it = filteredItems.find(x => x.id === selectedItemId);
          const m = getItemMediaList(it);
          if (m.length) {
            zoomMediaIdx = (zoomMediaIdx + (e.key === 'ArrowDown' ? 1 : -1) + m.length) % m.length;
            zoomView = 'visual';
            renderZoomOverlay();
          }
        }
        return;
      }

      if (currentMode === 'radar' && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openZoomOverlay('read', 0);
        return;
      }

      if (currentMode !== 'cabina') return;

      if (e.code === 'Space') {
        e.preventDefault();
        stepCabinBlock(e.shiftKey ? -1 : 1);
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault(); AudioEngine.toggleDuck();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault(); AudioEngine.fadeStop(3.0);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault(); AudioEngine.nextTrack();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        const snap = AudioEngine.getTelemetrySnapshot();
        if (snap.guestPlaying || snap.guestDuration > 0 && snap.macroState === 'guest_playing') AudioEngine.togglePauseGuest();
        else triggerNotaAlMargen();
      } else if (e.key.toLowerCase() === 'w') {
        e.preventDefault(); triggerWindowInterlude();
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault(); markClipK();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const cycle = ['loop', 'obs-alpha', 'split'];
        activeCamMode = cycle[(cycle.indexOf(activeCamMode) + 1) % cycle.length];
        renderCabina(); pushToObs();
      } else if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        activeCamMode = activeCamMode === 'cine-16x9' ? 'loop' : 'cine-16x9';
        renderCabina(); pushToObs();
      } else if (/^F[1-6]$/.test(e.key)) {
        e.preventDefault(); AudioEngine.playCart(e.key);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        AudioEngine.cancelMacros();
        activeBumper = false;
        activeCamMode = 'loop';
        currentGuestCard = null;
        renderCabina(); pushToObs();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
