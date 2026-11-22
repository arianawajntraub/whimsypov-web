(function () {
  window.WhimsyStudio = window.WhimsyStudio || {};

  const DB_NAME = 'whimsy_vault_v10';
  const DB_VERSION = 1;
  const DEFAULT_FOLDERS = [
    'Capturas WhatsApp',
    'Fotos PDE',
    'Videos y Loops',
    'Archivo ARIS2',
    'Notas al Margen',
    'Música Comercial'
  ];

  // Activos propios y permisos reales verificados dentro del repositorio
  const SEED_ASSETS = [
    { id: 'seed-aris-varda', name: 'Agnès Varda y JR (Mural archivo propio)', folder: 'Archivo ARIS2', kind: 'image', url: 'evidencias/aris_agnes_varda_jr.jpg', rights: 'own_cc0', credit: 'Archivo Whimsy POV', noDerivatives: false },
    { id: 'seed-aris-botanica', name: 'Botánica Field Museum 1964', folder: 'Archivo ARIS2', kind: 'image', url: 'evidencias/aris_botanica_fieldmuseum.jpg', rights: 'own_cc0', credit: 'Archivo Whimsy POV', noDerivatives: false },
    { id: 'seed-aris-cuaderno', name: 'Cuaderno boceto', folder: 'Archivo ARIS2', kind: 'image', url: 'evidencias/aris_cuaderno_boceto.jpg', rights: 'own_cc0', credit: 'Archivo Whimsy POV', noDerivatives: false },
    { id: 'seed-aris-flores', name: 'Flores macro (Playa PDE)', folder: 'Fotos PDE', kind: 'image', url: 'evidencias/aris_flores_macro.jpg', rights: 'own_cc0', credit: 'Archivo Ariana Wajntraub', noDerivatives: false },
    { id: 'seed-aris-marcoaurelio', name: 'Busto Marco Aurelio (Archivo)', folder: 'Archivo ARIS2', kind: 'image', url: 'evidencias/aris_marco_aurelio.jpg', rights: 'own_cc0', credit: 'Archivo Whimsy POV', noDerivatives: false },
    { id: 'seed-aris-minoica', name: 'Diosa de las Serpientes Minoica', folder: 'Archivo ARIS2', kind: 'image', url: 'evidencias/aris_minoica_serpientes.jpg', rights: 'own_cc0', credit: 'Archivo Whimsy POV', noDerivatives: false },
    { id: 'seed-edison-1', name: 'Edison en rosca de bombilla (Shawn Miller)', folder: 'Archivo ARIS2', kind: 'image', url: 'evidencias/prepro/shawn_miller_edison_1.jpg', rights: 'permission', permissionRef: 'PERM-001 · Shawn Miller', credit: 'Foto: Shawn Miller (@okinawanaturephotography)', noDerivatives: false },
    { id: 'seed-edison-2', name: 'Edison dentro de lamparita vista 2 (Shawn Miller)', folder: 'Archivo ARIS2', kind: 'image', url: 'evidencias/prepro/shawn_miller_edison_2.jpg', rights: 'permission', permissionRef: 'PERM-001 · Shawn Miller', credit: 'Foto: Shawn Miller (@okinawanaturephotography)', noDerivatives: false },
    { id: 'seed-edison-botella', name: 'Cangrejo en cuello de botella (Shawn Miller)', folder: 'Archivo ARIS2', kind: 'image', url: 'evidencias/prepro/shawn_miller_glass_bottle.jpg', rights: 'permission', permissionRef: 'PERM-001 · Shawn Miller', credit: 'Foto: Shawn Miller (@okinawanaturephotography)', noDerivatives: false },
    { id: 'seed-loop-rambla', name: 'Rambla Punta del Este con pájaros', folder: 'Videos y Loops', kind: 'video', url: 'loops/sol_rambla_pajaros.mp4', rights: 'own_cc0', credit: 'Grabación propia Punta del Este', noDerivatives: false },
    { id: 'seed-loop-muralla', name: 'Muralla y mar azul PDE', folder: 'Videos y Loops', kind: 'video', url: 'loops/sol_muralla_mar_pde.mp4', rights: 'own_cc0', credit: 'Grabación propia Punta del Este', noDerivatives: false },
    { id: 'seed-loop-olas', name: 'Olas rompiendo en la orilla', folder: 'Videos y Loops', kind: 'video', url: 'loops/teloleo_olas_orilla.mp4', rights: 'own_cc0', credit: 'Grabación propia costa', noDerivatives: false },
    { id: 'seed-loop-lluvia', name: 'Lluvia sobre tejas', folder: 'Videos y Loops', kind: 'video', url: 'loops/teloleo_lluvia_tejas.mp4', rights: 'own_cc0', credit: 'Grabación propia', noDerivatives: false },
    { id: 'seed-loop-micro', name: 'Microscopio óptico fibra y lente', folder: 'Videos y Loops', kind: 'video', url: 'loops/micro_fibra_lente.mp4', rights: 'own_cc0', credit: 'Grabación microscopio Whimsy POV', noDerivatives: false },
    { id: 'seed-loop-happenings', name: 'Happenings Escari — Eloísa Cartonera', folder: 'Videos y Loops', kind: 'video', url: 'loops/micro_happenings_libro.mp4', rights: 'own_cc0', credit: 'Grabación libro propio Whimsy POV', noDerivatives: false },
    { id: 'seed-loop-bereshit', name: 'Macro tipografía hebrea Bereshit', folder: 'Videos y Loops', kind: 'video', url: 'loops/micro_bereshit_macro.mp4', rights: 'own_cc0', credit: 'Grabación propia Whimsy POV', noDerivatives: false },
    { id: 'seed-loop-tinta', name: 'Tinta en agua', folder: 'Videos y Loops', kind: 'video', url: 'loops/lluvia_tinta_agua.mp4', rights: 'own_cc0', credit: 'Archivo visual Whimsy POV', noDerivatives: false },
    { id: 'seed-loop-ventana-sol', name: 'Ventana al mar con sol (PDE)', folder: 'Videos y Loops', kind: 'video', url: 'loops/ventana_mar_sol.mp4', rights: 'own_cc0', credit: 'Ventana propia Punta del Este', noDerivatives: false }
  ];

  let dbPromise = null;
  const blobUrlCache = new Map();

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains('media')) {
          const store = db.createObjectStore('media', { keyPath: 'id' });
          store.createIndex('folder', 'folder', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('cartwall')) {
          db.createObjectStore('cartwall', { keyPath: 'slot' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function detectKind(file) {
    const t = (file.type || '').toLowerCase();
    const n = (file.name || '').toLowerCase();
    if (t.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/.test(n)) return 'video';
    if (t.startsWith('audio/') || /\.(ogg|opus|m4a|mp3|wav|aac)$/.test(n)) return 'audio';
    return 'image';
  }

  function genId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async function init() {
    await openDb();
    return true;
  }

  async function addFile(file, meta = {}) {
    const db = await openDb();
    const kind = meta.kind || detectKind(file);
    const defaultFolder = kind === 'audio' ? 'Notas al Margen' : (kind === 'video' ? 'Videos y Loops' : 'Fotos PDE');
    const record = {
      id: meta.id || genId('vault'),
      name: meta.name || file.name || `archivo-${new Date().toISOString().slice(0, 16)}`,
      folder: meta.folder || defaultFolder,
      mimeType: file.type || 'application/octet-stream',
      size: file.size || 0,
      kind,
      blob: file,
      rights: meta.rights || 'own_cc0',
      noDerivatives: !!meta.noDerivatives,
      credit: meta.credit || 'Archivo propio Ariana Wajntraub',
      sourceUrl: meta.sourceUrl || '',
      permissionRef: meta.permissionRef || '',
      createdAt: new Date().toISOString()
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const blobUrl = URL.createObjectURL(record.blob);
    blobUrlCache.set(record.id, blobUrl);
    return { ...record, url: blobUrl, isVault: true };
  }

  async function addFromClipboard(pasteEvent, folder = 'Capturas WhatsApp') {
    const items = pasteEvent?.clipboardData?.items;
    if (!items) return [];
    const saved = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) {
          const rec = await addFile(f, {
            folder,
            name: f.name || `Captura ${new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`,
            rights: 'own_cc0'
          });
          saved.push(rec);
        }
      }
    }
    return saved;
  }

  async function listVaultRecords() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readonly');
      const req = tx.objectStore('media').getAll();
      req.onsuccess = () => {
        const rows = (req.result || []).map(r => {
          let url = blobUrlCache.get(r.id);
          if (!url && r.blob) {
            url = URL.createObjectURL(r.blob);
            blobUrlCache.set(r.id, url);
          }
          return { ...r, url, isVault: true };
        });
        rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function listMedia(folder = 'ALL') {
    const userRows = await listVaultRecords();
    const combined = [...userRows, ...SEED_ASSETS.map(s => ({ ...s, isSeed: true }))];
    if (!folder || folder === 'ALL') return combined;
    return combined.filter(it => it.folder === folder);
  }

  async function getMediaBlobUrl(id) {
    if (!id) return '';
    if (blobUrlCache.has(id)) return blobUrlCache.get(id);
    const seed = SEED_ASSETS.find(s => s.id === id);
    if (seed) return seed.url;
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('media', 'readonly');
      const req = tx.objectStore('media').get(id);
      req.onsuccess = () => {
        const r = req.result;
        if (r && r.blob) {
          const url = URL.createObjectURL(r.blob);
          blobUrlCache.set(id, url);
          resolve(url);
        } else {
          resolve('');
        }
      };
      req.onerror = () => resolve('');
    });
  }

  async function getRecord(id) {
    const seed = SEED_ASSETS.find(s => s.id === id);
    if (seed) return { ...seed, isSeed: true };
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('media', 'readonly');
      const req = tx.objectStore('media').get(id);
      req.onsuccess = () => {
        const r = req.result;
        if (!r) return resolve(null);
        let url = blobUrlCache.get(r.id);
        if (!url && r.blob) {
          url = URL.createObjectURL(r.blob);
          blobUrlCache.set(r.id, url);
        }
        resolve({ ...r, url, isVault: true });
      };
      req.onerror = () => resolve(null);
    });
  }

  async function updateMediaMeta(id, patch) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      const req = store.get(id);
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve(null);
        const next = { ...cur, ...patch };
        store.put(next);
        tx.oncomplete = () => resolve(next);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteMedia(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').delete(id);
      tx.oncomplete = () => {
        const cached = blobUrlCache.get(id);
        if (cached) {
          URL.revokeObjectURL(cached);
          blobUrlCache.delete(id);
        }
        resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async function saveCartSlot(slot, label, blob, durationSec = 0) {
    const db = await openDb();
    const record = {
      slot,
      label: label || `Barrida ${slot}`,
      blob,
      durationSec: Number(durationSec) || 0,
      updatedAt: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cartwall', 'readwrite');
      tx.objectStore('cartwall').put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function listCartSlots() {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('cartwall', 'readonly');
      const req = tx.objectStore('cartwall').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function deleteCartSlot(slot) {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('cartwall', 'readwrite');
      tx.objectStore('cartwall').delete(slot);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  function getFolders() {
    try {
      const extra = JSON.parse(localStorage.getItem('whimsy_vault_folders_v10') || '[]');
      return Array.from(new Set([...DEFAULT_FOLDERS, ...extra]));
    } catch {
      return [...DEFAULT_FOLDERS];
    }
  }

  function addFolder(name) {
    const clean = String(name || '').trim();
    if (!clean) return getFolders();
    const cur = getFolders();
    if (!cur.includes(clean)) {
      const extras = cur.filter(f => !DEFAULT_FOLDERS.includes(f));
      extras.push(clean);
      localStorage.setItem('whimsy_vault_folders_v10', JSON.stringify(extras));
    }
    return getFolders();
  }

  async function exportBackupJson(extraState = {}) {
    const userMedia = await listVaultRecords();
    const carts = await listCartSlots();
    return {
      exportedAt: new Date().toISOString(),
      app: 'WhimsyStudioV2',
      state: extraState,
      vaultInventory: userMedia.map(m => ({
        id: m.id,
        name: m.name,
        folder: m.folder,
        kind: m.kind,
        rights: m.rights,
        credit: m.credit,
        permissionRef: m.permissionRef,
        createdAt: m.createdAt
      })),
      cartSlotsRecorded: carts.map(c => ({ slot: c.slot, label: c.label, durationSec: c.durationSec, updatedAt: c.updatedAt }))
    };
  }

  window.WhimsyStudio.Vault = {
    DEFAULT_FOLDERS,
    SEED_ASSETS,
    init,
    addFile,
    addFromClipboard,
    listMedia,
    getMediaBlobUrl,
    getRecord,
    updateMediaMeta,
    deleteMedia,
    saveCartSlot,
    listCartSlots,
    deleteCartSlot,
    getFolders,
    addFolder,
    exportBackupJson
  };
})();
