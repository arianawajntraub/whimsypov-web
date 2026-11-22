(function () {
  window.WhimsyStudio = window.WhimsyStudio || {};

  let ctx = null;
  let masterLimiter = null;
  let musicBusGain = null;
  let cartBusGain = null;
  let guestBusGain = null;

  let deckA = null;
  let deckB = null;
  let deckGainA = null;
  let deckGainB = null;
  let activeDeck = 'A';
  let crossfadeLock = false;

  let catalog = [];
  let customTracks = [];
  let episodeTrackIds = [];
  let currentTrack = null;

  let licenseMode = 'pilot'; // 'pilot' | 'commercial'
  let isLooping = true;
  let isDucked = false;
  let baseVolume = 0.68;

  // Cartwall Dinesat F1..F6
  const cartBuffers = {}; // slot -> { buffer, label, durationSec }
  let activeCartSrc = null;
  let playingCart = null;

  // Nota al Margen guest audio
  let guestDecoded = null; // { buffer, normGain, title, meta }
  let guestSrc = null;
  let guestAnalyser = null;
  let guestDataArr = null;
  let guestStartedAt = 0;
  let guestOffset = 0;
  let guestPlaying = false;
  let macroState = 'idle'; // idle | ducking | silence_pre | barrida | guest_playing | silence_post | ariana_ready | window_interlude
  let macroAbort = null;

  // Setup Mic Check & Grabador Barridas (no sale a parlantes)
  let micStream = null;
  let micAnalyser = null;
  let micLevelData = null;
  let mediaRecorder = null;
  let recChunks = [];
  let recSlot = null;
  let recLabel = '';
  let recStartTime = 0;

  const telemetryListeners = new Set();
  const statusListeners = new Set();

  function emitStatus(msg, level = 'info') {
    for (const cb of statusListeners) {
      try { cb({ msg, level }); } catch {}
    }
  }

  function ensureAudioContext() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ sampleRate: 48000 });

    masterLimiter = ctx.createDynamicsCompressor();
    masterLimiter.threshold.setValueAtTime(-1.5, ctx.currentTime);
    masterLimiter.knee.setValueAtTime(2, ctx.currentTime);
    masterLimiter.ratio.setValueAtTime(20, ctx.currentTime);
    masterLimiter.attack.setValueAtTime(0.002, ctx.currentTime);
    masterLimiter.release.setValueAtTime(0.05, ctx.currentTime);
    masterLimiter.connect(ctx.destination);

    musicBusGain = ctx.createGain();
    musicBusGain.gain.setValueAtTime(baseVolume, ctx.currentTime);
    musicBusGain.connect(masterLimiter);

    cartBusGain = ctx.createGain();
    cartBusGain.gain.setValueAtTime(0.92, ctx.currentTime);
    cartBusGain.connect(masterLimiter);

    guestBusGain = ctx.createGain();
    guestBusGain.gain.setValueAtTime(1.0, ctx.currentTime);
    guestBusGain.connect(masterLimiter);

    deckGainA = ctx.createGain();
    deckGainA.gain.setValueAtTime(1, ctx.currentTime);
    deckGainA.connect(musicBusGain);

    deckGainB = ctx.createGain();
    deckGainB.gain.setValueAtTime(0, ctx.currentTime);
    deckGainB.connect(musicBusGain);

    deckA = new Audio();
    deckB = new Audio();
    deckA.preload = 'auto';
    deckB.preload = 'auto';

    const srcA = ctx.createMediaElementSource(deckA);
    const srcB = ctx.createMediaElementSource(deckB);
    srcA.connect(deckGainA);
    srcB.connect(deckGainB);

    const handleEnd = (which) => () => {
      if (activeDeck !== which) return;
      if (isLooping && currentTrack) {
        crossfadeToTrack(currentTrack, 2.0);
      } else {
        nextTrack();
      }
    };
    deckA.addEventListener('ended', handleEnd('A'));
    deckB.addEventListener('ended', handleEnd('B'));

    const handleTime = (which) => () => {
      if (activeDeck !== which || !isLooping || crossfadeLock || !currentTrack) return;
      const d = which === 'A' ? deckA : deckB;
      if (Number.isFinite(d.duration) && d.duration > 12) {
        const rem = d.duration - d.currentTime;
        if (rem <= 5.2 && rem > 0.4) {
          crossfadeLock = true;
          crossfadeToTrack(currentTrack, 4.5).finally(() => {
            setTimeout(() => { crossfadeLock = false; }, 1500);
          });
        }
      }
    };
    deckA.addEventListener('timeupdate', handleTime('A'));
    deckB.addEventListener('timeupdate', handleTime('B'));

    return ctx;
  }

  function rampGain(param, target, sec) {
    if (!ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(Math.max(0.0001, target), now + Math.max(0.02, sec));
  }

  async function init() {
    try {
      const res = await fetch('audio/catalogo_moby_whimsy.json', { cache: 'no-store' });
      if (res.ok) {
        catalog = await res.json();
      }
    } catch {}
    await refreshCustomResources();
    setInterval(emitTelemetry, 250);
    return true;
  }

  async function refreshCustomResources() {
    const Vault = window.WhimsyStudio.Vault;
    if (!Vault) return;
    const allMedia = await Vault.listMedia('ALL');
    customTracks = allMedia
      .filter(m => m.kind === 'audio' && m.folder === 'Música Comercial')
      .map(m => ({
        id: m.id,
        rack: 'COM',
        title: m.name.replace(/\.[^.]+$/, ''),
        mood: 'Licencia comercial propia',
        bpm: '—',
        duration: 'Local',
        file: m.url,
        license: 'commercial_owned',
        credit: m.credit || `Music: ${m.name}`,
        isVault: true
      }));

    // Precargar placas de barrida guardadas en IndexedDB
    const savedCarts = await Vault.listCartSlots();
    for (const c of savedCarts) {
      if (c.blob) {
        try {
          const buf = await decodeBlobToAudioBuffer(c.blob);
          cartBuffers[c.slot] = { buffer: buf, label: c.label, durationSec: buf.duration };
        } catch {}
      }
    }
  }

  async function decodeBlobToAudioBuffer(blob) {
    const ac = ensureAudioContext();
    const arr = await blob.arrayBuffer();
    return await ac.decodeAudioData(arr);
  }

  function getCatalogForMode(mode = licenseMode) {
    const all = [...customTracks, ...catalog];
    if (mode === 'commercial') {
      return all.filter(t => t.license !== 'mobygratis_noncommercial');
    }
    return all;
  }

  function setEpisodeTracks(ids) {
    episodeTrackIds = Array.isArray(ids) ? ids.slice(0, 6) : [];
  }

  function getEpisodeTracks() {
    const allowed = getCatalogForMode();
    if (!episodeTrackIds.length) return allowed.slice(0, 6);
    const picked = episodeTrackIds.map(id => allowed.find(t => t.id === id)).filter(Boolean);
    return picked.length ? picked : allowed.slice(0, 6);
  }

  function setLicenseMode(mode) {
    licenseMode = mode === 'commercial' ? 'commercial' : 'pilot';
    if (licenseMode === 'commercial' && currentTrack && currentTrack.license === 'mobygratis_noncommercial') {
      fadeStop(0.5);
      currentTrack = null;
      emitStatus('Con sponsor / Radio activo: pista gratuita no comercial detenida automáticamente.', 'warn');
    } else if (licenseMode === 'pilot') {
      emitStatus('Sin sponsor (mobygratis habilitado). Crédito oficial activo.', 'info');
    } else {
      emitStatus('Con sponsor / Radio activo: pistas gratuitas no comerciales bloqueadas.', 'ok');
    }
    emitTelemetry();
    return licenseMode;
  }

  function getLicenseMode() {
    return licenseMode;
  }

  async function crossfadeToTrack(track, fadeSec = 3.0) {
    if (!track) return;
    if (licenseMode === 'commercial' && track.license === 'mobygratis_noncommercial') {
      emitStatus('Bloqueado en Con sponsor / Radio: cargá una cortina propia o pista comercial.', 'error');
      return;
    }
    ensureAudioContext();
    const incomingKey = activeDeck === 'A' ? 'B' : 'A';
    const outDeck = activeDeck === 'A' ? deckA : deckB;
    const inDeck = incomingKey === 'A' ? deckA : deckB;
    const outGain = activeDeck === 'A' ? deckGainA : deckGainB;
    const inGain = incomingKey === 'A' ? deckGainA : deckGainB;

    const wasPlaying = !outDeck.paused && outDeck.currentTime > 0;
    inDeck.src = track.file;
    inDeck.currentTime = 0;

    currentTrack = track;
    activeDeck = incomingKey;

    rampGain(musicBusGain.gain, isDucked ? baseVolume * 0.18 : baseVolume, 0.25);

    if (wasPlaying) {
      inGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      await inDeck.play().catch(() => {});
      rampGain(outGain.gain, 0.0001, fadeSec);
      rampGain(inGain.gain, 1.0, fadeSec);
      setTimeout(() => {
        if (activeDeck !== (incomingKey === 'A' ? 'B' : 'A')) return;
      }, fadeSec * 1000);
      setTimeout(() => {
        if (activeDeck === incomingKey) {
          outDeck.pause();
          outDeck.currentTime = 0;
        }
      }, fadeSec * 1000 + 120);
    } else {
      outGain.gain.setValueAtTime(0, ctx.currentTime);
      inGain.gain.setValueAtTime(1, ctx.currentTime);
      await inDeck.play().catch(() => {});
    }
    emitTelemetry();
  }

  async function playTrackById(id, fadeSec = 2.5) {
    const allowed = getCatalogForMode();
    const found = allowed.find(t => t.id === id);
    if (!found) {
      emitStatus('Pista no disponible en el modo de licencia actual.', 'error');
      return false;
    }
    await crossfadeToTrack(found, fadeSec);
    return true;
  }

  function togglePlayPause() {
    ensureAudioContext();
    const d = activeDeck === 'A' ? deckA : deckB;
    if (!currentTrack) {
      const list = getEpisodeTracks();
      if (list[0]) return crossfadeToTrack(list[0], 0.4);
      emitStatus('Cargá una pista comercial en Mi Mediateca o cambiá a Sin sponsor (mobygratis).', 'warn');
      return;
    }
    if (d.paused) {
      rampGain(musicBusGain.gain, isDucked ? baseVolume * 0.18 : baseVolume, 0.25);
      d.play().catch(() => {});
    } else {
      d.pause();
    }
    emitTelemetry();
  }

  function nextTrack() {
    const list = getEpisodeTracks();
    if (!list.length) return;
    const idx = currentTrack ? list.findIndex(t => t.id === currentTrack.id) : -1;
    const next = list[(idx + 1) % list.length];
    return crossfadeToTrack(next, 3.5);
  }

  function setVolume(val) {
    baseVolume = Math.max(0.05, Math.min(1, Number(val) || 0.68));
    if (ctx && musicBusGain && !isDucked) {
      rampGain(musicBusGain.gain, baseVolume, 0.12);
    }
    emitTelemetry();
  }

  function toggleDuck(forceState) {
    ensureAudioContext();
    isDucked = typeof forceState === 'boolean' ? forceState : !isDucked;
    const target = isDucked ? Math.max(0.04, baseVolume * 0.18) : baseVolume;
    rampGain(musicBusGain.gain, target, isDucked ? 0.35 : 0.7);
    emitTelemetry();
    return isDucked;
  }

  function toggleLoop(forceState) {
    isLooping = typeof forceState === 'boolean' ? forceState : !isLooping;
    emitTelemetry();
    return isLooping;
  }

  function fadeStop(sec = 3.0) {
    ensureAudioContext();
    isLooping = false;
    isDucked = false;
    rampGain(musicBusGain.gain, 0.0001, sec);
    const targetDeckA = deckA;
    const targetDeckB = deckB;
    setTimeout(() => {
      if (targetDeckA) { targetDeckA.pause(); targetDeckA.currentTime = 0; }
      if (targetDeckB) { targetDeckB.pause(); targetDeckB.currentTime = 0; }
      if (ctx && musicBusGain) {
        musicBusGain.gain.setValueAtTime(baseVolume, ctx.currentTime);
      }
      emitTelemetry();
    }, sec * 1000 + 80);
    emitTelemetry();
  }

  // CARTWALL DINESAT F1..F6
  function stopCart() {
    if (activeCartSrc) {
      try { activeCartSrc.stop(); } catch {}
      activeCartSrc = null;
    }
    playingCart = null;
    emitTelemetry();
  }

  function playCart(slot, onEnded) {
    if (slot === 'F6' && licenseMode === 'pilot') {
      emitStatus('Cart F6 (Mecenazgo) habilitado únicamente en Con sponsor / Radio.', 'error');
      return false;
    }
    const entry = cartBuffers[slot];
    if (!entry || !entry.buffer) {
      emitStatus(`Barrida ${slot} todavía sin grabar: grabala con tu Shure MV51 desde ⚙️ Setup.`, 'warn');
      return false;
    }
    ensureAudioContext();
    stopCart();

    const wasDucked = isDucked;
    if (!wasDucked) toggleDuck(true);

    const src = ctx.createBufferSource();
    src.buffer = entry.buffer;
    src.connect(cartBusGain);
    activeCartSrc = src;
    playingCart = slot;
    src.onended = () => {
      if (activeCartSrc === src) {
        activeCartSrc = null;
        playingCart = null;
        if (!wasDucked && macroState === 'idle') toggleDuck(false);
        emitTelemetry();
        if (onEnded) onEnded();
      }
    };
    src.start(0);
    emitTelemetry();
    return true;
  }

  // NOTA AL MARGEN — NORMALIZACIÓN REAL LUFS-APPROX EN NAVEGADOR
  function measureAndNormalizeGain(buffer) {
    let sumSq = 0;
    let totalSamples = 0;
    let peak = 0.001;
    const chCount = buffer.numberOfChannels;
    for (let ch = 0; ch < chCount; ch++) {
      const data = buffer.getChannelData(ch);
      const step = Math.max(1, Math.floor(data.length / 24000));
      for (let i = 0; i < data.length; i += step) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
        sumSq += v * v;
        totalSamples++;
      }
    }
    const rms = Math.sqrt(sumSq / Math.max(1, totalSamples));
    const targetRms = 0.165; // ~-15 LUFS hablados
    let gain = rms > 0.003 ? targetRms / rms : 1.0;
    if (peak * gain > 0.9) gain = 0.9 / peak;
    return Math.max(0.55, Math.min(4.2, gain));
  }

  async function loadGuestAudio(urlOrBlob, title = 'Nota al Margen') {
    ensureAudioContext();
    let arr;
    if (urlOrBlob instanceof Blob) {
      arr = await urlOrBlob.arrayBuffer();
    } else {
      const res = await fetch(urlOrBlob);
      arr = await res.arrayBuffer();
    }
    const buffer = await ctx.decodeAudioData(arr);
    const normGain = measureAndNormalizeGain(buffer);
    guestDecoded = { buffer, normGain, title };
    guestOffset = 0;
    guestPlaying = false;
    emitTelemetry();
    return { duration: buffer.duration, normGain };
  }

  function stopGuest() {
    if (guestSrc) {
      try { guestSrc.onended = null; guestSrc.stop(); } catch {}
      guestSrc = null;
    }
    guestPlaying = false;
    guestOffset = 0;
    emitTelemetry();
  }

  function startGuestPlayback(offset = 0, onComplete) {
    if (!guestDecoded?.buffer) return false;
    ensureAudioContext();
    if (guestSrc) {
      try { guestSrc.onended = null; guestSrc.stop(); } catch {}
    }

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 100;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7500;

    const gainNode = ctx.createGain();
    gainNode.gain.value = guestDecoded.normGain;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.005;
    comp.release.value = 0.09;

    guestAnalyser = ctx.createAnalyser();
    guestAnalyser.fftSize = 64;
    guestDataArr = new Uint8Array(guestAnalyser.frequencyBinCount);

    const src = ctx.createBufferSource();
    src.buffer = guestDecoded.buffer;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(gainNode);
    gainNode.connect(comp);
    comp.connect(guestAnalyser);
    guestAnalyser.connect(guestBusGain);

    guestOffset = Math.max(0, Math.min(offset, guestDecoded.buffer.duration - 0.05));
    guestStartedAt = ctx.currentTime - guestOffset;
    guestPlaying = true;
    guestSrc = src;

    src.onended = () => {
      if (guestSrc === src) {
        guestSrc = null;
        guestPlaying = false;
        guestOffset = 0;
        emitTelemetry();
        if (onComplete) onComplete();
      }
    };
    src.start(0, guestOffset);
    emitTelemetry();
    return true;
  }

  function togglePauseGuest() {
    if (!guestDecoded?.buffer) return false;
    if (guestPlaying) {
      guestOffset = Math.max(0, ctx.currentTime - guestStartedAt);
      if (guestSrc) {
        try { guestSrc.onended = null; guestSrc.stop(); } catch {}
        guestSrc = null;
      }
      guestPlaying = false;
      emitTelemetry();
      return false;
    } else {
      return startGuestPlayback(guestOffset);
    }
  }

  function cancelMacros() {
    if (macroAbort) {
      macroAbort.aborted = true;
      macroAbort = null;
    }
    macroState = 'idle';
    stopGuest();
    stopCart();
    emitTelemetry();
  }

  const sleep = (ms, token) => new Promise(resolve => {
    setTimeout(() => resolve(!token.aborted), ms);
  });

  async function runNotaAlMargenMacro(guestUrlOrBlob, title, onPhase) {
    if (!guestUrlOrBlob) {
      emitStatus('No hay archivo de voz cargado para Nota al Margen.', 'warn');
      return false;
    }
    cancelMacros();
    ensureAudioContext();
    const token = { aborted: false };
    macroAbort = token;

    const notify = (st) => {
      macroState = st;
      if (onPhase) onPhase(st);
      emitTelemetry();
    };

    try {
      await loadGuestAudio(guestUrlOrBlob, title);
      // 1. Bajar música a silencio en 800ms
      notify('ducking');
      rampGain(musicBusGain.gain, 0.0001, 0.8);
      if (!(await sleep(820, token))) return false;
      if (deckA) deckA.pause();
      if (deckB) deckB.pause();

      // 2. Silencio real 1,5s
      notify('silence_pre');
      if (!(await sleep(1500, token))) return false;

      // 3. Barrida F3 si está grabada
      if (cartBuffers.F3?.buffer) {
        notify('barrida');
        await new Promise(res => {
          const ok = playCart('F3', res);
          if (!ok) res();
        });
        if (token.aborted) return false;
      }

      // 4. Audio invitado limpio a capella
      notify('guest_playing');
      await new Promise(res => {
        startGuestPlayback(0, res);
      });
      if (token.aborted) return false;

      // 5. Silencio post 1,5s
      notify('silence_post');
      if (!(await sleep(1500, token))) return false;

      notify('ariana_ready');
      setTimeout(() => {
        if (macroState === 'ariana_ready') {
          macroState = 'idle';
          if (ctx && musicBusGain) musicBusGain.gain.setValueAtTime(baseVolume, ctx.currentTime);
          emitTelemetry();
        }
      }, 2500);
      return true;
    } catch (err) {
      macroState = 'idle';
      emitStatus('No se pudo decodificar el audio invitado en este navegador (usá Chrome para .ogg).', 'error');
      emitTelemetry();
      return false;
    }
  }

  async function runWindowInterludeMacro(durationSec = 15, onPhase) {
    cancelMacros();
    ensureAudioContext();
    const token = { aborted: false };
    macroAbort = token;
    macroState = 'window_interlude';
    if (onPhase) onPhase('window_interlude');

    const d = activeDeck === 'A' ? deckA : deckB;
    if (!currentTrack || d.paused) {
      const list = getEpisodeTracks();
      if (list[0]) await crossfadeToTrack(list[0], 0.6);
    }
    rampGain(musicBusGain.gain, 0.78, 0.8);
    emitTelemetry();

    const holdMs = Math.max(2000, (durationSec - 1.6) * 1000);
    if (!(await sleep(holdMs, token))) return false;

    isDucked = true;
    rampGain(musicBusGain.gain, baseVolume * 0.18, 0.8);
    macroState = 'idle';
    if (onPhase) onPhase('idle');
    emitTelemetry();
    return true;
  }

  // MONITOREO DE MIC + GRABADORA DE BARRIDAS
  async function startMicMonitor() {
    ensureAudioContext();
    if (!micStream) {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const src = ctx.createMediaStreamSource(micStream);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 85;
      micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 64;
      micLevelData = new Uint8Array(micAnalyser.frequencyBinCount);
      src.connect(hp);
      hp.connect(micAnalyser); // Jamás conectado a destination (cero acople)
    }
    return true;
  }

  function stopMicMonitor() {
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
      micAnalyser = null;
    }
  }

  async function startRecordCart(slot, label) {
    await startMicMonitor();
    recChunks = [];
    recSlot = slot;
    recLabel = label;
    recStartTime = Date.now();
    mediaRecorder = new MediaRecorder(micStream);
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) recChunks.push(ev.data);
    };
    mediaRecorder.start();
    return true;
  }

  async function stopRecordCart() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return null;
    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const dur = Math.max(0.5, (Date.now() - recStartTime) / 1000);
        const buf = await decodeBlobToAudioBuffer(blob);
        cartBuffers[recSlot] = { buffer: buf, label: recLabel, durationSec: buf.duration || dur };
        if (window.WhimsyStudio.Vault) {
          await window.WhimsyStudio.Vault.saveCartSlot(recSlot, recLabel, blob, buf.duration || dur);
        }
        emitStatus(`Barrida ${recSlot} grabada y guardada permanentemente (${(buf.duration || dur).toFixed(1)}s).`, 'ok');
        emitTelemetry();
        resolve(cartBuffers[recSlot]);
      };
      mediaRecorder.stop();
    });
  }

  function getTelemetrySnapshot() {
    const d = activeDeck === 'A' ? deckA : deckB;
    const dur = d && Number.isFinite(d.duration) ? d.duration : 0;
    const cur = d && Number.isFinite(d.currentTime) ? d.currentTime : 0;
    const rem = Math.max(0, dur - cur);
    const playing = !!(d && !d.paused && d.currentTime >= 0);

    let gRem = 0;
    let gDur = 0;
    if (guestDecoded?.buffer) {
      gDur = guestDecoded.buffer.duration;
      const elapsedG = guestPlaying && ctx ? (ctx.currentTime - guestStartedAt) : guestOffset;
      gRem = Math.max(0, gDur - elapsedG);
    }

    let guestLevel = 0;
    if (guestPlaying && guestAnalyser && guestDataArr) {
      guestAnalyser.getByteFrequencyData(guestDataArr);
      let s = 0;
      for (let i = 0; i < guestDataArr.length; i++) s += guestDataArr[i];
      guestLevel = Math.min(1, s / (guestDataArr.length * 140));
    }

    let micLevel = 0;
    if (micAnalyser && micLevelData) {
      micAnalyser.getByteFrequencyData(micLevelData);
      let s = 0;
      for (let i = 0; i < micLevelData.length; i++) s += micLevelData[i];
      micLevel = Math.min(1, s / (micLevelData.length * 130));
    }

    return {
      trackId: currentTrack?.id || '',
      trackTitle: currentTrack?.title || 'Sin música cargada',
      trackCredit: currentTrack ? currentTrack.credit : (licenseMode === 'pilot' ? 'Sin sponsor (mobygratis) listo' : 'Con sponsor / Radio activo'),
      trackLicense: currentTrack?.license || '',
      elapsed: cur,
      remaining: rem,
      duration: dur,
      isPlaying: playing,
      isLooping,
      isDucked,
      volume: baseVolume,
      warn15s: playing && rem > 0 && rem <= 15,
      guestTitle: guestDecoded?.title || '',
      guestRemaining: gRem,
      guestDuration: gDur,
      guestPlaying,
      guestLevel,
      macroState,
      playingCart,
      micLevel,
      licenseMode,
      cartSummary: Object.fromEntries(Object.entries(cartBuffers).map(([k, v]) => [k, { label: v.label, durationSec: v.durationSec }]))
    };
  }

  function emitTelemetry() {
    const snap = getTelemetrySnapshot();
    for (const cb of telemetryListeners) {
      try { cb(snap); } catch {}
    }
  }

  function onTelemetry(cb) {
    telemetryListeners.add(cb);
    return () => telemetryListeners.delete(cb);
  }

  function onStatus(cb) {
    statusListeners.add(cb);
    return () => statusListeners.delete(cb);
  }

  window.WhimsyStudio.AudioEngine = {
    init,
    refreshCustomResources,
    getCatalogForMode,
    setEpisodeTracks,
    getEpisodeTracks,
    setLicenseMode,
    getLicenseMode,
    playTrackById,
    togglePlayPause,
    nextTrack,
    setVolume,
    toggleDuck,
    toggleLoop,
    fadeStop,
    playCart,
    stopCart,
    loadGuestAudio,
    togglePauseGuest,
    stopGuest,
    runNotaAlMargenMacro,
    runWindowInterludeMacro,
    cancelMacros,
    startMicMonitor,
    stopMicMonitor,
    startRecordCart,
    stopRecordCart,
    getTelemetrySnapshot,
    onTelemetry,
    onStatus
  };
})();
