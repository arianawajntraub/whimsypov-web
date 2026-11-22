#!/usr/bin/env node
/**
 * Motorcito Autónomo RSS + Extractor Visual/Video + Radar Semanal (Whimsy POV + La Minuta W)
 * Compatible 100% en Mac local (02_RADAR_SCRAPING_DIARIO/) y en Nube (web/scripts/ via GitHub Actions).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PARENT_DIR = path.resolve(__dirname, '..');
const IS_IN_WEB_SCRIPTS = path.basename(__dirname) === 'scripts' && fs.existsSync(path.join(PARENT_DIR, 'content.json'));
const WEB_DIR = IS_IN_WEB_SCRIPTS ? PARENT_DIR : path.join(PARENT_DIR, 'web');
const PROJECT_ROOT = IS_IN_WEB_SCRIPTS ? path.resolve(PARENT_DIR, '..') : PARENT_DIR;

const OUTPUT_JSON = path.join(WEB_DIR, 'rss-inbox-live.json');
const LOCAL_CUSTOM_FEEDS = path.join(PROJECT_ROOT, '02_RADAR_SCRAPING_DIARIO', 'feeds_custom.json');
const WEB_CUSTOM_FEEDS = path.join(WEB_DIR, 'scripts', 'feeds_custom.json');
const CUSTOM_FEEDS_PATH = fs.existsSync(LOCAL_CUSTOM_FEEDS) ? LOCAL_CUSTOM_FEEDS : WEB_CUSTOM_FEEDS;

const SUBSTACK_JSON = path.join(PROJECT_ROOT, '01_BIBLIA_Y_EQUIPO', 'SUBSTACK_19_MINUTAS_COMPLETAS.json');
const INVENTARIO_JSON = path.join(PROJECT_ROOT, '01_BIBLIA_Y_EQUIPO', 'INVENTARIO_VIVO_YOUTUBE_Y_SUBSTACK.json');
const WEB_CONTENT_JSON = path.join(WEB_DIR, 'content.json');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 WhimsyRSS/2.0';

// Banco real de 18 pistas libres no comerciales en web/audio/ (solo Modo Piloto · prohibido nombrar artista fuera de crédito oficial)
const FREE_MUSIC_BANK = [
  { id: 'A-0', rack: 'A', trackIdx: 0, title: 'hollywood', mood: 'Groove Sexy Driving', bpm: '120', duration: '04:28', file: 'audio/fast_01_hollywood.m4a', license: 'mobygratis_noncommercial', credit: 'Music: hollywood provided by mobygratis', tags: ['apertura', 'arte', 'cine', 'ciudad'] },
  { id: 'A-1', rack: 'A', trackIdx: 1, title: 'get it', mood: 'Funky Driving Beat', bpm: '100', duration: '04:46', file: 'audio/fast_02_get-it.m4a', license: 'mobygratis_noncommercial', credit: 'Music: get it provided by mobygratis', tags: ['social', 'innovación', 'educación'] },
  { id: 'A-2', rack: 'A', trackIdx: 2, title: 'fail safe audio', mood: 'Electro Hypnotic Groove', bpm: '108', duration: '05:54', file: 'audio/fast_03_fail-safe-audio.m4a', license: 'mobygratis_noncommercial', credit: 'Music: fail safe audio provided by mobygratis', tags: ['ciencia', 'física', 'ia', 'tecnología'] },
  { id: 'A-3', rack: 'A', trackIdx: 3, title: 'great weight lifted', mood: 'Rock / Aggressive Driving', bpm: '132', duration: '03:55', file: 'audio/fast_04_great-weight-lifted.m4a', license: 'mobygratis_noncommercial', credit: 'Music: great weight lifted provided by mobygratis', tags: ['urgente', 'movimientos', 'tension'] },
  { id: 'A-4', rack: 'A', trackIdx: 4, title: 'falling out of love', mood: 'Dark Post-Punk Driving', bpm: '124', duration: '02:58', file: 'audio/fast_05_falling-out-of-love.m4a', license: 'mobygratis_noncommercial', credit: 'Music: falling out of love provided by mobygratis', tags: ['filosofía', 'archivo', 'libros', 'editorial'] },
  { id: 'A-5', rack: 'A', trackIdx: 5, title: 'friday heretic', mood: 'Indie Electro Arriba', bpm: '126', duration: '05:38', file: 'audio/fast_06_friday-heretic.m4a', license: 'mobygratis_noncommercial', credit: 'Music: friday heretic provided by mobygratis', tags: ['colores', 'arte', 'textil', 'diseño'] },
  { id: 'A-6', rack: 'A', trackIdx: 6, title: '1983', mood: 'Upbeat Synth 80s', bpm: '145', duration: '04:28', file: 'audio/fast_07_1983.m4a', license: 'mobygratis_noncommercial', credit: 'Music: 1983 provided by mobygratis', tags: ['pop', 'idioma', 'retro'] },
  { id: 'A-7', rack: 'A', trackIdx: 7, title: 'out stands', mood: 'Pulso Hipnótico', bpm: '102', duration: '04:04', file: 'audio/fast_08_out-stands.m4a', license: 'mobygratis_noncommercial', credit: 'Music: out stands provided by mobygratis', tags: ['botánica', 'naturaleza', 'agua', 'micro'] },
  { id: 'B-0', rack: 'B', trackIdx: 0, title: 'fever dreams', mood: 'Pulso Nocturno', bpm: '106', duration: '04:18', file: 'audio/rackb_02.m4a', license: 'mobygratis_noncommercial', credit: 'Music: fever dreams provided by mobygratis', tags: ['noche', 'sombra', 'cine'] },
  { id: 'B-1', rack: 'B', trackIdx: 1, title: 'clip show', mood: 'Beat Rítmico', bpm: '114', duration: '05:12', file: 'audio/rackb_04.m4a', license: 'mobygratis_noncommercial', credit: 'Music: clip show provided by mobygratis', tags: ['visual', 'archivo', 'fotografía'] },
  { id: 'B-2', rack: 'B', trackIdx: 2, title: 'eight and eight', mood: 'Groove Medio', bpm: '96', duration: '03:32', file: 'audio/rackb_05.m4a', license: 'mobygratis_noncommercial', credit: 'Music: eight and eight provided by mobygratis', tags: ['moda', 'textil', 'oficio'] },
  { id: 'B-3', rack: 'B', trackIdx: 3, title: 'idiots', mood: 'Tensión Cruda', bpm: '118', duration: '05:10', file: 'audio/rackb_10.m4a', license: 'mobygratis_noncommercial', credit: 'Music: idiots provided by mobygratis', tags: ['sesgos', 'crítica', 'ideas'] },
  { id: 'B-4', rack: 'B', trackIdx: 4, title: 'out mid 1', mood: 'Apertura Aire', bpm: '94', duration: '03:32', file: 'audio/rackb_01.m4a', license: 'mobygratis_noncommercial', credit: 'Music: out mid 1 provided by mobygratis', tags: ['espiritualidad', 'biblia', 'silencio'] },
  { id: 'B-5', rack: 'B', trackIdx: 5, title: 'it was so clear', mood: 'Crónica en Movimiento', bpm: '98', duration: '02:54', file: 'audio/rackb_03.m4a', license: 'mobygratis_noncommercial', credit: 'Music: it was so clear provided by mobygratis', tags: ['crónica', 'ancestral', 'territorio'] },
  { id: 'B-6', rack: 'B', trackIdx: 6, title: 'inspire modulate', mood: 'Synth Textura', bpm: '92', duration: '02:45', file: 'audio/rackb_06.m4a', license: 'mobygratis_noncommercial', credit: 'Music: inspire modulate provided by mobygratis', tags: ['microscopio', 'agua', 'materia'] },
  { id: 'B-7', rack: 'B', trackIdx: 7, title: 'open', mood: 'Respiro Corto', bpm: '90', duration: '01:14', file: 'audio/rackb_07.m4a', license: 'mobygratis_noncommercial', credit: 'Music: open provided by mobygratis', tags: ['pausa', 'lectura', 'poesía'] },
  { id: 'B-8', rack: 'B', trackIdx: 8, title: 'june 13', mood: 'Fondo Largo', bpm: '100', duration: '07:50', file: 'audio/rackb_08.m4a', license: 'mobygratis_noncommercial', credit: 'Music: june 13 provided by mobygratis', tags: ['ensayo', 'entrevista'] },
  { id: 'B-9', rack: 'B', trackIdx: 9, title: 'dec 14', mood: 'Cierre Instrumental', bpm: '95', duration: '03:50', file: 'audio/rackb_09.m4a', license: 'mobygratis_noncommercial', credit: 'Music: dec 14 provided by mobygratis', tags: ['cierre', 'pregunta'] }
];

// Paso 3: ADN curado basado en lo más visto/escuchado de @whimsyPOV y las 19 Minutas W
const TOP_WHIMSY_SIGNALS = [
  { title: 'The banality of evil.', views: 1200, channel: 'YouTube Short', lens: 'Grandes ideas y filosofía', keywords: ['ethics', 'evil', 'banality', 'history', 'memory', 'trial', 'filosofía', 'memoria', 'justicia'] },
  { title: 'Una calavera viva. Mondongo | ARTISTAS Whimsy POV', views: 1100, channel: 'YouTube Short', lens: 'Arte', keywords: ['sculpture', 'material', 'craft', 'clay', 'wax', 'art', 'arte', 'materia', 'textura', 'escultura'] },
  { title: 'Madre Cava | Gonzalo Fonseca', views: 1000, channel: 'YouTube Short', lens: 'Arte', keywords: ['architecture', 'stone', 'monument', 'uruguay', 'arquitectura', 'piedra', 'espacio'] },
  { title: 'Gisèle Pelicot: Let shame change sides.', views: 559, channel: 'YouTube Short', lens: 'Movimientos sociales', keywords: ['women', 'court', 'courage', 'society', 'mujeres', 'sociedad', 'voz', 'cuerpo'] },
  { title: 'The kites. Alejandro Jodorowsky. Where a bird sings best.', views: 550, channel: 'YouTube Short', lens: 'Poesía', keywords: ['cinema', 'poetry', 'surrealism', 'symbol', 'cine', 'poesía', 'símbolo', 'dream'] },
  { title: 'El antihappening. Edición de Eloísa Cartonera.', views: 465, channel: 'YouTube Short', lens: 'Libros', keywords: ['books', 'paper', 'print', 'cartonera', 'libros', 'papel', 'imprenta', 'happening'] },
  { title: 'Si te invitan a dirigir una ópera, ¿cómo no vas a dirigir una ópera?', views: 378, channel: 'YouTube Short', lens: 'Cine', keywords: ['opera', 'ai weiwei', 'stage', 'music', 'ópera', 'escena', 'teatro', 'música'] },
  { title: 'Alma Thomas: el color que te transforma', views: 281, channel: 'YouTube Short', lens: 'Los colores', keywords: ['color', 'pigment', 'mosaic', 'painting', 'paint', 'colores', 'pigmento', 'pintura'] },
  { title: 'Leonora Carrington: Soy Nightmare (con Borges)', views: 267, channel: 'YouTube Short', lens: 'Arte', keywords: ['surreal', 'leonora', 'borges', 'myth', 'animal', 'bestiary', 'mitología'] }
];

const CORE_FEEDS = [
  { id: 'colossal', name: 'Colossal', url: 'https://www.thisiscolossal.com/feed/', siteUrl: 'https://www.thisiscolossal.com/', defaultCat: 'transito', defaultLens: 'Arte', defaultRights: 'read_only', clock: '🇬🇧 LONDRES (GMT)', handle: '@thisiscolossal' },
  { id: 'pdr', name: 'The Public Domain Review', url: 'https://publicdomainreview.org/rss.xml', siteUrl: 'https://publicdomainreview.org/', defaultCat: 'transito', defaultLens: 'Libros', defaultRights: 'check_cc0', clock: '🇬🇧 LONDRES (GMT)', handle: '@publicdomainrev' },
  { id: 'quanta', name: 'Quanta Magazine', url: 'https://www.quantamagazine.org/feed/', fallbackUrl: 'https://api.quantamagazine.org/feed/', siteUrl: 'https://www.quantamagazine.org/', defaultCat: 'clima', defaultLens: 'Física', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@quantamag' },
  { id: 'smithsonian-smart', name: 'Smithsonian Smart News', url: 'https://www.smithsonianmag.com/rss/smart-news/', siteUrl: 'https://www.smithsonianmag.com/smart-news/', defaultCat: 'clima', defaultLens: 'Ciencia y buenas noticias científicas', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@smithsonianmag' },
  { id: 'smithsonian-arts', name: 'Smithsonian Arts & Culture', url: 'https://www.smithsonianmag.com/rss/arts-culture/', siteUrl: 'https://www.smithsonianmag.com/arts-culture/', defaultCat: 'transito', defaultLens: 'Arte', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@smithsonianmag' },
  { id: 'hyperallergic', name: 'Hyperallergic', url: 'https://hyperallergic.com/feed/', siteUrl: 'https://hyperallergic.com/', defaultCat: 'transito', defaultLens: 'Arte', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@hyperallergic' },
  { id: 'aeon', name: 'Aeon Magazine', url: 'https://aeon.co/feed.rss', siteUrl: 'https://aeon.co/', defaultCat: 'arrobar', defaultLens: 'Grandes ideas y filosofía', defaultRights: 'read_only', clock: '🇬🇧 LONDRES (GMT)', handle: '@aeonmag' },
  { id: 'openculture', name: 'Open Culture', url: 'https://www.openculture.com/feed', siteUrl: 'https://www.openculture.com/', defaultCat: 'transito', defaultLens: 'Cine', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@openculture' },
  { id: 'nautilus', name: 'Nautilus', url: 'https://nautil.us/feed/', siteUrl: 'https://nautil.us/', defaultCat: 'clima', defaultLens: 'Ciencia y buenas noticias científicas', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@NautilusMag' },
  { id: 'vam', name: 'Victoria & Albert Museum', url: 'https://www.vam.ac.uk/blog/feed', siteUrl: 'https://www.vam.ac.uk/blog', defaultCat: 'transito', defaultLens: 'Moda y cultura textil', defaultRights: 'check_cc0', clock: '🇬🇧 LONDRES (GMT)', handle: '@vamuseum' },
  { id: 'bhl', name: 'Biodiversity Heritage Library', url: 'https://blog.biodiversitylibrary.org/feed', siteUrl: 'https://blog.biodiversitylibrary.org/', defaultCat: 'clima', defaultLens: 'Botánica', defaultRights: 'check_cc0', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@biodivlibrary' },
  { id: 'minutaw', name: 'La Minuta W (Substack)', url: 'https://arianawajntraub.substack.com/feed', siteUrl: 'https://arianawajntraub.substack.com/', defaultCat: 'hilo', defaultLens: 'Libros', defaultRights: 'own_cc0', clock: '🇺🇾 PUNTA DEL ESTE / GARZÓN', handle: '@arianawajntraub' },
  { id: 'emergence', name: 'Emergence Magazine', url: 'https://emergencemagazine.org/feed/', siteUrl: 'https://emergencemagazine.org/', defaultCat: 'arrobar', defaultLens: 'Espiritualidad (cero autoayuda)', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@emergencemag' },
  { id: 'thetorah', name: 'TheTorah.com', url: 'https://www.thetorah.com/rss', siteUrl: 'https://www.thetorah.com/', defaultCat: 'hilo', defaultLens: 'La Biblia y filología antigua', defaultRights: 'read_only', clock: '🇮🇱 JAFFA / JERUSALÉN', handle: '@thetorah_com' },
  { id: 'marginalia-rev', name: 'Marginalia Review of Books', url: 'https://themarginaliareview.com/feed/', siteUrl: 'https://themarginaliareview.com/', defaultCat: 'hilo', defaultLens: 'La Biblia y filología antigua', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@marginaliarb' },
  { id: 'creativecommons', name: 'Creative Commons Blog', url: 'https://creativecommons.org/blog/feed/', siteUrl: 'https://creativecommons.org/blog/', defaultCat: 'clima', defaultLens: 'Innovación abierta (Open Innovation)', defaultRights: 'check_cc0', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@creativecommons' },
  { id: 'mit-medialab', name: 'MIT Media Lab', url: 'https://www.media.mit.edu/feed/', siteUrl: 'https://www.media.mit.edu/', defaultCat: 'clima', defaultLens: 'Innovación en la educación', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@medialab' },
  { id: 'restofworld', name: 'Rest of World', url: 'https://restofworld.org/feed/latest/rss', siteUrl: 'https://restofworld.org/', defaultCat: 'clima', defaultLens: 'IA y tecnología', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@restofworld' },
  { id: 'mit-tech', name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', siteUrl: 'https://www.technologyreview.com/', defaultCat: 'clima', defaultLens: 'IA y tecnología', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@techreview' },
  { id: 'mubi', name: 'MUBI Notebook', url: 'https://mubi.com/en/notebook/posts.rss', siteUrl: 'https://mubi.com/en/notebook', defaultCat: 'transito', defaultLens: 'Cine', defaultRights: 'read_only', clock: '🇬🇧 LONDRES (GMT)', handle: '@mubinotebook' },
  { id: 'marginalian', name: 'The Marginalian', url: 'https://www.themarginalian.org/feed/', siteUrl: 'https://www.themarginalian.org/', defaultCat: 'arrobar', defaultLens: 'Poesía', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@brainpickings' },
  { id: 'sapiens', name: 'SAPIENS Anthropology', url: 'https://www.sapiens.org/feed/', siteUrl: 'https://www.sapiens.org/', defaultCat: 'transito', defaultLens: 'Conocimiento aborigen y ancestral', defaultRights: 'read_only', clock: '🇺🇸 NUEVA YORK (EST)', handle: '@sapiens_org' },
  { id: 'conversation-es', name: 'The Conversation (ES)', url: 'https://theconversation.com/es/articles.atom', siteUrl: 'https://theconversation.com/es', defaultCat: 'clima', defaultLens: 'Movimientos sociales', defaultRights: 'read_only', clock: '🇪🇸 MADRID / LATAM', handle: '@conversation_es' },
  { id: 'elpais-cultura', name: 'El País Cultura', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada', siteUrl: 'https://elpais.com/cultura/', defaultCat: 'arrobar', defaultLens: 'Percepción del idioma', defaultRights: 'read_only', clock: '🇪🇸 MADRID', handle: '@el_pais' },
  { id: 'sobreciencia-uy', name: 'SobreCiencia Uruguay', url: 'https://sobreciencia.uy/feed/', siteUrl: 'https://sobreciencia.uy/', defaultCat: 'arrobar', defaultLens: 'Ciencia y buenas noticias científicas', defaultRights: 'read_only', clock: '🇺🇾 PUNTA DEL ESTE / MONTEVIDEO', handle: '@sobreciencia' },
  { id: 'nexciencia-uba', name: 'NEXciencia (Exactas UBA)', url: 'https://nexciencia.exactas.uba.ar/feed/', siteUrl: 'https://nexciencia.exactas.uba.ar/', defaultCat: 'arrobar', defaultLens: 'Ciencia y buenas noticias científicas', defaultRights: 'read_only', clock: '🇦🇷 BUENOS AIRES', handle: '@Exactas_UBA' },
  { id: 'ladiaria-cultura', name: 'La Diaria Cultura (UY)', url: 'https://ladiaria.com.uy/feeds/articulos/?seccion=cultura', siteUrl: 'https://ladiaria.com.uy/cultura/', defaultCat: 'arrobar', defaultLens: 'Arte', defaultRights: 'read_only', clock: '🇺🇾 MONTEVIDEO / PDE', handle: '@ladigitaluy' },
  { id: 'eternacadencia', name: 'Eterna Cadencia Blog', url: 'https://www.eternacadencia.com.ar/blog/feed', siteUrl: 'https://www.eternacadencia.com.ar/blog', defaultCat: 'hilo', defaultLens: 'Libros', defaultRights: 'read_only', clock: '🇦🇷 BUENOS AIRES', handle: '@eternacadencia' }
];

const WEEKLY_SUGGESTED_FEEDS = [
  { id: 'nature-culture', name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', reason: 'Cruza IA, física y sociedad sin humo corporativo como tus Minutas sobre sesgos.', lens: 'IA y tecnología', cat: 'clima' },
  { id: 'marginalian', name: 'The Marginalian (Maria Popova)', url: 'https://www.themarginalian.org/feed/', reason: 'Alta sintonía con tus Minutas W sobre poesía, cartas y científicas pioneras (paridad 80/20).', lens: 'Poesía', cat: 'arrobar' },
  { id: 'atlasobscura', name: 'Atlas Obscura', url: 'https://www.atlasobscura.com/feeds/latest', reason: 'Conecta con el éxito de Madre Cava / Gonzalo Fonseca y objetos raros del mundo.', lens: 'Conocimiento aborigen y ancestral', cat: 'transito' },
  { id: 'mubi', name: 'MUBI Notebook', url: 'https://mubi.com/en/notebook/posts.rss', reason: 'Ideal para continuar tu línea de David Lynch, Agnès Varda y Jodorowsky.', lens: 'Cine', cat: 'transito' },
  { id: 'nasa-earth', name: 'NASA Earth Observatory', url: 'https://earthobservatory.nasa.gov/feeds/earth-observatory.rss', reason: 'Imágenes satelitales CC0 para tu Minuta «Eppur si muove» y «Arena».', lens: 'Los colores', cat: 'clima' },
  { id: 'el-pais-cultura', name: 'El País Cultura', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada', reason: 'Sigue la veta de crónicas mínimas y columnas de Juan José Millás.', lens: 'Percepción del idioma', cat: 'arrobar' },
  { id: 'bbc-mundo', name: 'BBC Mundo', url: 'https://feeds.bbci.co.uk/mundo/rss.xml', reason: 'Hallazgos internacionales curados en español para cruzar con los relojes mundiales.', lens: 'Movimientos sociales', cat: 'clima' },
  { id: 'conicet', name: 'CONICET Ciencia (Vía Google News RSS)', url: 'https://news.google.com/rss/search?q=site:conicet.gov.ar&hl=es-419&gl=AR&ceid=AR:es-419', reason: 'Ciencia argentina verificada como el cruce de abejas en Exactas UBA y biopolímeros.', lens: 'Innovación abierta', cat: 'clima' }
];

// Las 18 Lentes de Whimsy POV
const EIGHTEEN_LENSES = [
  { name: 'Arte', words: ['art', 'paint', 'sculpt', 'museum', 'gallery', 'canvas', 'draw', 'exhibition', 'artist', 'arte', 'pintura', 'museo', 'obra', 'grabado', 'dibujo'] },
  { name: 'Ciencia y buenas noticias científicas', words: ['science', 'study', 'research', 'discover', 'lab', 'paper', 'scientist', 'ciencia', 'estudio', 'investigador', 'hallazgo', 'climate', 'ocean'] },
  { name: 'Espiritualidad (cero autoayuda)', words: ['ritual', 'sacred', 'silence', 'mystic', 'monastery', 'contemplat', 'silencio', 'rito', 'sagrado'] },
  { name: 'La Biblia y filología antigua', words: ['bible', 'hebrew', 'manuscript', 'scroll', 'ancient', 'script', 'aramaic', 'bibl', 'manuscrito', 'hebreo', 'pergamino'] },
  { name: 'Innovación abierta (Open Innovation)', words: ['open source', 'public domain', 'citizen', 'commons', 'cc0', 'open access', 'dominio público', 'abierto', 'comunitario'] },
  { name: 'Innovación en la educación', words: ['school', 'teach', 'student', 'learn', 'pedagog', 'educa', 'escuela', 'maestro', 'taller', 'aprender'] },
  { name: 'IA y tecnología', words: ['ai', 'algorithm', 'robot', 'machine', 'digital', 'computer', 'software', 'inteligencia artificial', 'algoritmo', 'código', 'excel'] },
  { name: 'Grandes ideas y filosofía', words: ['philosoph', 'ethics', 'banality', 'thought', 'essay', 'arendt', 'filosof', 'ética', 'pensamiento', 'idea'] },
  { name: 'Cine', words: ['film', 'cinema', 'movie', 'director', 'animation', 'short', 'camera', 'video', 'vimeo', 'youtube', 'cine', 'película', 'corto', 'animación', 'documental'] },
  { name: 'Poesía', words: ['poem', 'poetry', 'verse', 'poet', 'haiku', 'lyric', 'poesía', 'poema', 'verso', 'poeta'] },
  { name: 'Libros', words: ['book', 'library', 'archive', 'letter', 'novel', 'print', 'page', 'libro', 'biblioteca', 'archivo', 'carta', 'lectura'] },
  { name: 'Física', words: ['physics', 'quantum', 'optics', 'light', 'gravity', 'acoustic', 'sound', 'física', 'óptica', 'luz', 'gravedad', 'sonido', 'onda'] },
  { name: 'Botánica', words: ['plant', 'tree', 'botan', 'flower', 'fungi', 'moss', 'forest', 'seed', 'planta', 'árbol', 'botánica', 'flor', 'bosque', 'semilla', 'hongo'] },
  { name: 'Moda y cultura textil', words: ['textile', 'fabric', 'weave', 'wool', 'fashion', 'thread', 'dress', 'embroider', 'textil', 'tela', 'hilo', 'lana', 'moda', 'vestido', 'bordado'] },
  { name: 'Conocimiento aborigen y ancestral', words: ['indigenous', 'ancestral', 'tradition', 'oral', 'craft', 'native', 'aborigen', 'ancestral', 'originario', 'tejido'] },
  { name: 'Movimientos sociales', words: ['protest', 'movement', 'community', 'public', 'rights', 'city', 'social', 'comunidad', 'ciudad', 'derechos', 'colectivo'] },
  { name: 'Los colores', words: ['color', 'colour', 'pigment', 'blue', 'red', 'ochre', 'indigo', 'hue', 'dye', 'pigmento', 'azul', 'ocre', 'tinte', 'cromát'] },
  { name: 'Percepción del idioma', words: ['language', 'word', 'alphabet', 'translat', 'etymology', 'speech', 'idioma', 'palabra', 'lengua', 'letra', 'traduc'] }
];

// Carpetas temáticas sugeridas para «Cuando hablemos de [X]»
const TOPIC_BUCKETS = [
  { key: 'Papel', words: ['paper', 'print', 'book', 'sketch', 'scroll', 'manuscript', 'notebook', 'papel', 'libro', 'cuaderno', 'imprenta', 'cartón'] },
  { key: 'Árbol', words: ['tree', 'forest', 'wood', 'bark', 'moss', 'root', 'leaf', 'árbol', 'bosque', 'madera', 'raíz', 'hoja'] },
  { key: 'Animal', words: ['animal', 'bird', 'whale', 'bee', 'insect', 'fauna', 'species', 'beast', 'pájaro', 'ballena', 'abeja', 'especie'] },
  { key: 'Hilo', words: ['thread', 'textile', 'weave', 'loom', 'stitch', 'quipu', 'fiber', 'cloth', 'hilo', 'tela', 'telar', 'bordado', 'trama'] },
  { key: 'Sombra', words: ['shadow', 'dark', 'eclipse', 'night', 'silhouette', 'noir', 'sombra', 'oscuro', 'penumbra', 'noche'] },
  { key: 'Color', words: ['color', 'colour', 'pigment', 'indigo', 'blue', 'ochre', 'red', 'tint', 'dye', 'pigmento', 'azul', 'rojo', 'tinte'] },
  { key: 'Silencio', words: ['silence', 'quiet', 'pause', 'sound', 'acoustic', 'whisper', 'silencio', 'quietud', 'sonido', 'acústica'] },
  { key: 'IA y sesgos', words: ['ai', 'algorithm', 'robot', 'machine', 'bias', 'code', 'excel', 'data', 'inteligencia artificial', 'algoritmo', 'sesgo'] },
  { key: 'Botánica', words: ['plant', 'botan', 'flower', 'seed', 'herbarium', 'flora', 'fungus', 'planta', 'botánica', 'flor', 'semilla', 'herbario'] },
  { key: 'Libros', words: ['library', 'archive', 'letter', 'poem', 'reading', 'edition', 'bible', 'biblioteca', 'archivo', 'carta', 'poesía'] }
];

const VERIFIED_LOCAL_FALLBACKS = [
  'evidencias/prepro/arkivism_1.jpg',
  'evidencias/prepro/pdr_kalvach_1.jpg',
  'evidencias/prepro/quanta_space.webp',
  'evidencias/prepro/commons_hilma.jpg',
  'evidencias/prepro/va_sketch_1.jpg',
  'evidencias/aris_cuaderno_boceto.jpg',
  'evidencias/aris_botanica_fieldmuseum.jpg',
  'evidencias/aris_flores_macro.jpg'
];

function decodeEntities(str = '') {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function stripTags(html = '') {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveUrl(candidate, baseUrl) {
  if (!candidate) return '';
  let clean = decodeEntities(candidate).trim();
  if (!clean || clean.startsWith('data:') || clean.startsWith('javascript:')) return '';
  if (clean.startsWith('//')) clean = 'https:' + clean;
  try {
    return new URL(clean, baseUrl).toString();
  } catch {
    return '';
  }
}

function isValidArticleImage(url) {
  if (!url) return false;
  const low = url.toLowerCase();
  if (/[\/_=-]1x1[._&?/-]/i.test(low)) return false;
  const blocked = [
    'pixel', 'spacer', 'blank.gif', 'tracking', 'doubleclick', 'scorecardresearch',
    'gravatar', 's.w.org', 'emoji', 'feedburner', 'feedsportal', 'analytics',
    'facebook.com/tr', 'twitter.com/i', 'icon-', '/favicon', 'apple-touch-icon',
    'badge', 'avatar-32', 'subscribe-button', 'logo-white', 'loader.gif'
  ];
  if (blocked.some(b => low.includes(b))) return false;
  if (low.endsWith('.svg') && !low.includes('commons.wikimedia')) return false;
  return /^https?:\/\//i.test(url);
}

function extractImagesFromHtml(html = '', baseUrl = '') {
  const found = [];
  const seen = new Set();
  const pushImg = (rawUrl, caption = '') => {
    const abs = resolveUrl(rawUrl, baseUrl);
    if (!abs || !isValidArticleImage(abs)) return;
    const key = abs.split('?')[0];
    if (seen.has(key)) return;
    seen.add(key);
    found.push({
      url: abs,
      caption: stripTags(caption).slice(0, 140) || 'Imagen extraída de la fuente original'
    });
  };

  const srcsetMatches = [...html.matchAll(/(?:srcset|data-srcset)\s*=\s*["']([^"']+)["']/gi)];
  for (const m of srcsetMatches) {
    const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) {
      const last = parts[parts.length - 1].split(/\s+/)[0];
      pushImg(last, 'Imagen en alta resolución de la fuente');
    }
  }

  const imgMatches = [...html.matchAll(/<img\b[^>]*>/gi)];
  for (const m of imgMatches) {
    const tag = m[0];
    const srcM = tag.match(/(?:data-lazy-src|data-src|data-original|src)\s*=\s*["']([^"']+)["']/i);
    const altM = tag.match(/alt\s*=\s*["']([^"']*)["']/i);
    if (srcM) pushImg(srcM[1], altM ? altM[1] : '');
  }

  const metaMatches = [...html.matchAll(/<meta\b[^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image|og:image:secure_url)["'][^>]*>/gi)];
  for (const m of metaMatches) {
    const contentM = m[0].match(/content\s*=\s*["']([^"']+)["']/i);
    if (contentM) pushImg(contentM[1], 'Imagen principal del artículo');
  }

  return found;
}

function normalizeVideoCandidate(rawUrl, baseUrl, defaultCaption = 'Video detectado en la fuente') {
  const abs = resolveUrl(rawUrl, baseUrl);
  if (!abs) return null;

  // YouTube
  const ytM = abs.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytM) {
    const id = ytM[1];
    return {
      url: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
      type: 'youtube',
      caption: defaultCaption
    };
  }

  // Vimeo
  const vmM = abs.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d{6,12})/i);
  if (vmM) {
    const id = vmM[1];
    return {
      url: `https://vimeo.com/${id}`,
      embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`,
      type: 'vimeo',
      caption: defaultCaption
    };
  }

  // MP4 / WebM
  if (/\.(?:mp4|webm|m4v)(?:\?|$)/i.test(abs)) {
    return {
      url: abs,
      embedUrl: abs,
      type: 'mp4',
      caption: defaultCaption
    };
  }

  // Animated GIF
  if (/\.gif(?:\?|$)/i.test(abs) && isValidArticleImage(abs)) {
    return {
      url: abs,
      embedUrl: abs,
      type: 'gif',
      caption: defaultCaption
    };
  }

  return null;
}

function extractVideosFromHtml(html = '', baseUrl = '', imagesList = []) {
  const found = [];
  const seen = new Set();
  const pushVid = (cand) => {
    if (!cand || !cand.url) return;
    const key = cand.embedUrl.split('?')[0];
    if (seen.has(key)) return;
    seen.add(key);
    found.push(cand);
  };

  // <video> & <source>
  for (const m of html.matchAll(/<(?:video|source)\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    pushVid(normalizeVideoCandidate(m[1], baseUrl, 'Video HTML embebido en la nota'));
  }

  // <iframe> YouTube / Vimeo
  for (const m of html.matchAll(/<iframe\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    pushVid(normalizeVideoCandidate(m[1], baseUrl, 'Reproductor audiovisual de la nota'));
  }

  // <a href="...youtube/vimeo/mp4">
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (/youtube\.com|youtu\.be|vimeo\.com|\.mp4\b/i.test(m[1])) {
      pushVid(normalizeVideoCandidate(m[1], baseUrl, 'Enlace audiovisual citado en la nota'));
    }
  }

  // og:video / twitter:player
  for (const m of html.matchAll(/<meta\b[^>]+(?:property|name)\s*=\s*["'](?:og:video|og:video:url|twitter:player)["'][^>]*>/gi)) {
    const cM = m[0].match(/content\s*=\s*["']([^"']+)["']/i);
    if (cM) pushVid(normalizeVideoCandidate(cM[1], baseUrl, 'Video principal de la nota'));
  }

  // Animated GIFs detected among article images
  for (const im of imagesList) {
    if (/\.gif(?:\?|$)/i.test(im.url)) {
      pushVid(normalizeVideoCandidate(im.url, baseUrl, im.caption || 'Animación GIF de la nota'));
    }
  }

  return found.slice(0, 6);
}

function buildCleanReaderHtml(rawHtml = '', baseUrl = '', extractedImages = [], fallbackSummary = '') {
  let cleaned = decodeEntities(rawHtml || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/\s(?:style|class|id|onclick|onload|data-[a-z0-9_-]+)\s*=\s*["'][^"']*["']/gi, '');

  const allowedBlocks = [];
  const blockRe = /<(p|h2|h3|h4|blockquote|ul|ol|figure)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let m;
  while ((m = blockRe.exec(cleaned)) !== null) {
    let chunk = m[0];
    chunk = chunk.replace(/href\s*=\s*["']([^"']+)["']/gi, (_, u) => {
      const abs = resolveUrl(u, baseUrl);
      return abs ? `href="${abs}" target="_blank" rel="noopener"` : 'href="#"';
    });
    chunk = chunk.replace(/\sloading\s*=\s*["'][^"']*["']/gi, '');
    chunk = chunk.replace(/src\s*=\s*["']([^"']+)["']/gi, (_, u) => {
      const abs = resolveUrl(u, baseUrl);
      return abs && isValidArticleImage(abs) ? `src="${abs}" loading="lazy"` : 'data-skip-img="1"';
    });
    chunk = chunk.replace(/<img\b[^>]*data-skip-img="1"[^>]*>/gi, '');
    const textOnly = stripTags(chunk);
    const hasImg = /<img\b[^>]+src="https?:\/\//i.test(chunk);
    if (textOnly.length > 20 || hasImg) {
      if (!/suscrib|subscribe|cookie|newsletter|sign up/i.test(textOnly)) {
        allowedBlocks.push(chunk);
      }
    }
    if (allowedBlocks.length >= 28) break;
  }

  if (allowedBlocks.length === 0 && fallbackSummary) {
    allowedBlocks.push(`<p>${fallbackSummary}</p>`);
  }

  const bodyHasImages = allowedBlocks.some(b => /<img\b/i.test(b));
  if (!bodyHasImages && extractedImages.length > 0) {
    const galleryHtml = extractedImages.slice(0, 4).map(im =>
      `<figure><img src="${im.url}" alt="${im.caption.replace(/"/g, '')}" loading="lazy"><figcaption>${im.caption}</figcaption></figure>`
    ).join('\n');
    return galleryHtml + '\n' + allowedBlocks.join('\n');
  }

  return allowedBlocks.join('\n');
}

function extractArticleBodyFromPage(pageHtml = '', baseUrl = '') {
  const artM = pageHtml.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
    || pageHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const scope = artM ? artM[1] : pageHtml;
  const imgs = extractImagesFromHtml(scope, baseUrl);
  const pageImgs = imgs.length ? imgs : extractImagesFromHtml(pageHtml, baseUrl);
  const videos = extractVideosFromHtml(scope + '\n' + pageHtml, baseUrl, pageImgs);

  // Extract social profile links or author @handles
  const socialHandles = [];
  for (const sm of pageHtml.matchAll(/https?:\/\/(?:www\.)?(?:instagram\.com|twitter\.com|x\.com)\/([a-zA-Z0-9_.]{2,30})/gi)) {
    const h = sm[1].toLowerCase();
    if (!['share', 'intent', 'home', 'search', 'p', 'reel', 'explore'].includes(h)) {
      socialHandles.push('@' + sm[1]);
    }
  }
  const mailM = scope.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);

  const paragraphs = [...scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => stripTags(m[1]))
    .filter(t => t.length > 55 && !/cookie|subscribe|privacy policy|sign in|all rights reserved|javascript/i.test(t))
    .slice(0, 14);
  return {
    images: pageImgs,
    videos,
    socialHandles,
    contactEmail: mailM ? mailM[1] : '',
    paragraphs,
    cleanHtml: paragraphs.map(p => `<p>${p}</p>`).join('\n')
  };
}

function parseFeedXml(xmlText, feedMeta) {
  const items = [];
  const isAtom = /<feed\b/i.test(xmlText) && /<entry\b/i.test(xmlText) && !/<item\b/i.test(xmlText);
  const entryRegex = isAtom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

  let match;
  while ((match = entryRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const getTag = (tag) => {
      const r = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = block.match(r);
      return m ? m[1] : '';
    };

    const rawTitle = getTag('title');
    const title = stripTags(rawTitle);
    if (!title) continue;

    let link = '';
    if (isAtom) {
      const lAlt = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i)
        || block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
      link = lAlt ? decodeEntities(lAlt[1]).trim() : '';
    } else {
      link = stripTags(getTag('link')) || stripTags(getTag('guid'));
    }
    link = resolveUrl(link, feedMeta.siteUrl) || feedMeta.siteUrl;

    const rawDate = getTag('pubDate') || getTag('published') || getTag('updated') || getTag('dc:date');
    const parsedDate = rawDate ? new Date(stripTags(rawDate)) : new Date();
    const validDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const author = stripTags(getTag('dc:creator') || getTag('author') || feedMeta.name).slice(0, 80);
    const contentEncoded = getTag('content:encoded') || getTag('content') || '';
    const description = getTag('description') || getTag('summary') || '';
    const bestHtml = contentEncoded.length >= description.length ? contentEncoded : description;
    const summaryText = stripTags(description || contentEncoded).slice(0, 320);

    const xmlImgs = [];
    const seen = new Set();
    const addXmlImg = (u, cap) => {
      const abs = resolveUrl(u, link);
      if (!abs || !isValidArticleImage(abs)) return;
      const k = abs.split('?')[0];
      if (seen.has(k)) return;
      seen.add(k);
      xmlImgs.push({ url: abs, caption: cap || `Imagen de ${feedMeta.name}` });
    };

    const xmlVideos = [];
    const addXmlVid = (u, cap) => {
      const c = normalizeVideoCandidate(u, link, cap || `Video de ${feedMeta.name}`);
      if (c && !xmlVideos.some(v => v.embedUrl === c.embedUrl)) xmlVideos.push(c);
    };

    for (const m of block.matchAll(/<media:(?:content|thumbnail)\b[^>]*>/gi)) {
      const tag = m[0];
      const uM = tag.match(/url=["']([^"']+)["']/i);
      if (!uM) continue;
      if (/medium=["']video["']|type=["']video\//i.test(tag)) {
        addXmlVid(uM[1], `Video de ${feedMeta.name}`);
      } else {
        addXmlImg(uM[1], `Lámina de ${feedMeta.name}`);
      }
    }

    for (const m of block.matchAll(/<media:player\b[^>]*url=["']([^"']+)["'][^>]*>/gi)) {
      addXmlVid(m[1], `Video reproductor de ${feedMeta.name}`);
    }

    for (const m of block.matchAll(/<enclosure\b[^>]*>/gi)) {
      const tag = m[0];
      const uM = tag.match(/url=["']([^"']+)["']/i);
      if (!uM) continue;
      if (/type=["']video\//i.test(tag) || /\.(?:mp4|webm|m4v)\b/i.test(tag)) {
        addXmlVid(uM[1], `Video adjunto de ${feedMeta.name}`);
      } else if (/type=["']image\//i.test(tag) || /\.(?:jpe?g|png|webp|gif)\b/i.test(tag)) {
        addXmlImg(uM[1], `Imagen principal de ${feedMeta.name}`);
      }
    }

    const decodedBest = decodeEntities(bestHtml);
    for (const im of extractImagesFromHtml(decodedBest, link)) {
      addXmlImg(im.url, im.caption);
    }
    for (const v of extractVideosFromHtml(decodedBest, link, xmlImgs)) {
      if (!xmlVideos.some(x => x.embedUrl === v.embedUrl)) xmlVideos.push(v);
    }

    items.push({
      feedId: feedMeta.id,
      feedName: feedMeta.name,
      feedUrl: feedMeta.url,
      siteUrl: feedMeta.siteUrl,
      handle: feedMeta.handle,
      defaultCat: feedMeta.defaultCat,
      defaultLens: feedMeta.defaultLens,
      defaultRights: feedMeta.defaultRights || 'read_only',
      clock: feedMeta.clock,
      title,
      link,
      author,
      publishedAt: validDate.toISOString(),
      rawHtml: decodedBest,
      summary: summaryText || title,
      images: xmlImgs,
      videos: xmlVideos
    });
    if (items.length >= 6) break;
  }
  return items;
}

function detectLenses(item) {
  const haystack = `${item.title} ${item.summary} ${stripTags(item.rawHtml)}`.toLowerCase();
  const scored = EIGHTEEN_LENSES.map(lens => {
    let score = 0;
    for (const w of lens.words) {
      if (haystack.includes(w)) score += 1;
    }
    if (lens.name === item.defaultLens) score += 0.5;
    return { name: lens.name, score };
  }).sort((a, b) => b.score - a.score);

  const primary = scored[0].score > 0 ? scored[0].name : item.defaultLens;
  const secondary = scored[1] && scored[1].score > 0 ? scored[1].name : 'Arte';
  return [primary, secondary];
}

function findHiloRojo(item, minutas, ytVideos) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const tokens = text.replace(/[^a-záéíóúñ0-9\s]/gi, ' ').split(/\s+/).filter(w => w.length > 4);

  let bestMinuta = minutas[0] || { title: 'Eppur si muove', url: 'https://arianawajntraub.substack.com' };
  let bestMinScore = -1;
  for (const m of minutas) {
    const mText = `${m.title} ${m.subtitle || ''} ${stripTags(m.content_html || '').slice(0, 800)}`.toLowerCase();
    let s = 0;
    for (const t of tokens) {
      if (mText.includes(t)) s += 1;
    }
    if (s > bestMinScore) {
      bestMinScore = s;
      bestMinuta = m;
    }
  }

  let bestVideo = ytVideos[0] || { title: 'Lucio Fontana: El tajo que rompió el arte', url: 'https://www.youtube.com/@whimsyPOV' };
  let bestVidScore = -1;
  for (const v of ytVideos) {
    const vText = (v.title || '').toLowerCase();
    let s = 0;
    for (const t of tokens) {
      if (vText.includes(t)) s += 1;
    }
    if (s > bestVidScore) {
      bestVidScore = s;
      bestVideo = v;
    }
  }

  return {
    minutaTitle: bestMinuta.title,
    minutaUrl: bestMinuta.url,
    videoTitle: bestVideo.title,
    videoUrl: bestVideo.url,
    summaryLine: `Dialoga con tu Minuta W «${bestMinuta.title}» y con «${bestVideo.title}» en @whimsyPOV.`
  };
}

function suggestMusicForItem(item, primaryLens) {
  const lensLower = (primaryLens || '').toLowerCase();
  let trackIdx = 0;
  let rack = 'A';

  if (lensLower.includes('física') || lensLower.includes('ciencia') || lensLower.includes('ia')) {
    rack = 'A'; trackIdx = 2; // fail safe audio
  } else if (lensLower.includes('botánica')) {
    rack = 'A'; trackIdx = 7; // out stands
  } else if (lensLower.includes('poesía')) {
    rack = 'B'; trackIdx = 7; // open
  } else if (lensLower.includes('libros') || lensLower.includes('filosofía')) {
    rack = 'A'; trackIdx = 4; // falling out of love
  } else if (lensLower.includes('colores')) {
    rack = 'A'; trackIdx = 5; // friday heretic
  } else if (lensLower.includes('movimientos') || lensLower.includes('social')) {
    rack = 'A'; trackIdx = 3; // great weight lifted
  } else if (lensLower.includes('textil') || lensLower.includes('moda')) {
    rack = 'B'; trackIdx = 2; // eight and eight
  } else if (lensLower.includes('espiritualidad') || lensLower.includes('biblia')) {
    rack = 'B'; trackIdx = 4; // out mid 1
  } else if (lensLower.includes('cine')) {
    rack = 'B'; trackIdx = 0; // fever dreams
  } else if (lensLower.includes('aborigen') || lensLower.includes('ancestral')) {
    rack = 'B'; trackIdx = 5; // it was so clear
  } else if (lensLower.includes('idioma')) {
    rack = 'A'; trackIdx = 6; // 1983
  } else if (item.videos && item.videos.length > 0) {
    rack = 'B'; trackIdx = 1; // clip show
  }

  const found = FREE_MUSIC_BANK.find(t => t.rack === rack && t.trackIdx === trackIdx) || FREE_MUSIC_BANK[0];
  return { ...found };
}

function buildProtagonistData(item, pageExtracted) {
  const plainBody = `${item.title} ${item.summary} ${stripTags(item.rawHtml)}`;
  const bodyHandles = [];
  for (const m of plainBody.matchAll(/(?:^|[\s(])(@[a-zA-Z0-9_]{3,28})\b/g)) {
    const cand = m[1];
    if (!['@gmail', '@yahoo', '@hotmail', '@media', '@import', '@keyframes'].includes(cand.toLowerCase())) {
      bodyHandles.push(cand);
    }
  }

  const rawAuthor = (item.author || '').trim();
  const cleanName = (rawAuthor && !/^admin$|^editor$|^staff$/i.test(rawAuthor)) ? rawAuthor : item.feedName;
  const pageSocial = (pageExtracted && pageExtracted.socialHandles) ? pageExtracted.socialHandles : [];

  const allHandles = Array.from(new Set([
    ...pageSocial,
    ...bodyHandles,
    item.handle || '@whimsypov',
    '@whimsypov'
  ])).slice(0, 6);

  const primaryHandle = pageSocial[0] || bodyHandles[0] || item.handle || '@whimsypov';
  const shortTitle = item.title.slice(0, 68);

  const inviteEs = `Hola ${cleanName} (${primaryHandle}), soy Ariana Wajntraub, locutora y conductora de Whimsy POV y La Minuta W desde Punta del Este. Estoy armando un episodio donde dialoga tu trabajo sobre «${shortTitle}» con otra lente cultural, y me gustaría sumar tu voz en nuestra sección Nota al Margen. Te pido una nota de voz de 45 a 75 segundos respondiendo qué detalle concreto de ese proceso todavía te intriga. A las 48 horas del estreno te entrego tu recorte vertical subtitulado con tus créditos y enlaces para tus redes. Para cuidar tu archivo y tu nombre con prolijidad, al responderme «Sí, autorizo» y mandarme el audio confirmás que podemos emitir tu voz y tu crédito en YouTube, podcast, Substack, redes y radios.`;
  const inviteEn = `Hello ${cleanName} (${primaryHandle}), I am Ariana Wajntraub, a voice artist and host of Whimsy POV and La Minuta W from Uruguay. Each episode places science, archives, and art around a single word, and your work on "${shortTitle}" belongs in our table. Would you send a 45 to 75 second voice note on your phone sharing one specific material detail from behind this piece for our Margin Note segment? Within 48 hours of release I will send you a captioned vertical clip with full attribution ready for your channels. Replying "Yes, I authorize" along with your audio confirms permission to air your voice and credit on YouTube, podcast, Substack, social media, and radio.`;
  const postAirEs = `Hola ${cleanName} (${primaryHandle}), ya salió al aire el episodio sobre «${shortTitle}» con tu Nota al Margen y crédito completo. Acá tenés el enlace a YouTube (https://www.youtube.com/@whimsyPOV) y a La Minuta W (https://arianawajntraub.substack.com), y te adjunto tu video vertical de un minuto subtitulado para que lo compartas donde quieras.`;

  return {
    name: cleanName,
    handle: primaryHandle,
    foundHandles: allHandles,
    contactUrl: item.link || item.siteUrl,
    contactEmail: (pageExtracted && pageExtracted.contactEmail) || '',
    inviteEs,
    inviteEn,
    postAirEs
  };
}

function suggestBucketAndAngle(item) {
  const hay = `${item.title} ${item.summary} ${(item.lenses || []).join(' ')}`.toLowerCase();
  let bestBucket = null;
  let bestScore = 0;

  for (const tb of TOPIC_BUCKETS) {
    let sc = 0;
    for (const w of tb.words) {
      if (hay.includes(w)) sc += 1;
    }
    if (sc > bestScore) {
      bestScore = sc;
      bestBucket = tb.key;
    }
  }

  const ageHours = (Date.now() - new Date(item.publishedAt).getTime()) / 3600000;
  let suggestedBucket = 'manana';
  if (bestScore >= 2 && bestBucket) {
    suggestedBucket = `tema:${bestBucket}`;
  } else if (ageHours <= 72 || item.feedId === 'minutaw' || (item.videos && item.videos.length > 0) || item.images.length >= 3) {
    suggestedBucket = 'hoy';
  }

  const primaryLens = (item.lenses && item.lenses[0]) || item.defaultLens || 'Arte';
  const hasVid = item.videos && item.videos.length > 0;
  const mediaNote = hasVid
    ? `incluye material audiovisual y ${item.images.length} imágenes listas para proyectar`
    : `aporta ${item.images.length} láminas extraídas desde la fuente original`;
  const curatorialAngle = `Desde la lente ${primaryLens}, este hallazgo de ${item.feedName} ${mediaNote}. Su Hilo Rojo dialoga con «${item.hiloRojo.minutaTitle}» para abrir una pregunta concreta al aire.`;

  return { suggestedBucket, curatorialAngle };
}

async function fetchWithTimeout(url, ms = 8000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8' },
    signal: AbortSignal.timeout(ms),
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function main() {
  console.log('📡 Iniciando Motorcito RSS Whimsy POV v2 (Paso 3 -> Paso 2 -> Paso 1)...');

  let minutas = [];
  let ytVideos = [];
  try {
    if (fs.existsSync(SUBSTACK_JSON)) {
      minutas = JSON.parse(fs.readFileSync(SUBSTACK_JSON, 'utf8'));
    }
  } catch {}
  try {
    if (fs.existsSync(INVENTARIO_JSON)) {
      const inv = JSON.parse(fs.readFileSync(INVENTARIO_JSON, 'utf8'));
      ytVideos = inv.youtube_published_videos_and_shorts || inv.youtube_videos || [];
    }
  } catch {}

  // Respaldo automático en la nube desde web/content.json cuando corre en GitHub Actions
  if ((minutas.length === 0 || ytVideos.length === 0) && fs.existsSync(WEB_CONTENT_JSON)) {
    try {
      const webContent = JSON.parse(fs.readFileSync(WEB_CONTENT_JSON, 'utf8'));
      if (minutas.length === 0 && Array.isArray(webContent.minutas)) {
        minutas = webContent.minutas.map(m => ({
          title: m.title,
          subtitle: m.dialogue || '',
          url: m.url,
          content_html: m.summary || ''
        }));
      }
      if (ytVideos.length === 0 && Array.isArray(webContent.audiovisual)) {
        ytVideos = webContent.audiovisual.map(v => ({
          title: v.title,
          url: v.url
        }));
      }
      console.log(`  📚 Base editorial leída desde web/content.json (${minutas.length} Minutas, ${ytVideos.length} videos).`);
    } catch {}
  }

  let customFeeds = [];
  try {
    if (fs.existsSync(CUSTOM_FEEDS_PATH)) {
      customFeeds = JSON.parse(fs.readFileSync(CUSTOM_FEEDS_PATH, 'utf8'));
    }
  } catch {}

  const allFeeds = [...CORE_FEEDS, ...customFeeds];
  const collected = [];
  const feedStatuses = [];

  await Promise.all(allFeeds.map(async (feed) => {
    try {
      let xml = '';
      try {
        xml = await fetchWithTimeout(feed.url, 8000);
      } catch (e1) {
        if (feed.fallbackUrl) {
          xml = await fetchWithTimeout(feed.fallbackUrl, 8000);
        } else {
          throw e1;
        }
      }
      let parsedItems = parseFeedXml(xml, feed);
      if (parsedItems.length === 0 && feed.fallbackUrl) {
        const xml2 = await fetchWithTimeout(feed.fallbackUrl, 8000);
        parsedItems = parseFeedXml(xml2, feed);
      }
      feedStatuses.push({ id: feed.id, name: feed.name, url: feed.url, siteUrl: feed.siteUrl, ok: true, count: parsedItems.length });
      collected.push(...parsedItems);
      console.log(`  ✅ ${feed.name}: ${parsedItems.length} artículos leídos`);
    } catch (err) {
      feedStatuses.push({ id: feed.id, name: feed.name, url: feed.url, siteUrl: feed.siteUrl, ok: false, count: 0, error: err.message });
      console.log(`  ⚠️ ${feed.name}: ${err.message}`);
    }
  }));

  await Promise.all(collected.map(async (item, idx) => {
    let pageExtracted = null;
    const needsEnrich = item.images.length < 2 || stripTags(item.rawHtml).length < 400 || item.videos.length === 0;
    if (needsEnrich && item.link && !item.link.includes('substack.com')) {
      try {
        const html = await fetchWithTimeout(item.link, 6000);
        pageExtracted = extractArticleBodyFromPage(html, item.link);
        const existingKeys = new Set(item.images.map(i => i.url.split('?')[0]));
        for (const im of pageExtracted.images) {
          const k = im.url.split('?')[0];
          if (!existingKeys.has(k)) {
            existingKeys.add(k);
            item.images.push(im);
          }
          if (item.images.length >= 6) break;
        }
        for (const v of pageExtracted.videos || []) {
          if (!item.videos.some(x => x.embedUrl === v.embedUrl)) {
            item.videos.push(v);
          }
        }
      } catch {}
    }

    if (item.images.length === 0) {
      try {
        const kw = item.title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, ' ').split(/\s+/).filter(w => w.length > 4).slice(0, 3).join(' ');
        if (kw) {
          const commonsApi = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=filetype:bitmap+${encodeURIComponent(kw)}&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=960&format=json`;
          const rawC = await fetchWithTimeout(commonsApi, 5000);
          const cJson = JSON.parse(rawC);
          if (cJson?.query?.pages) {
            for (const p of Object.values(cJson.query.pages)) {
              const ii = (p.imageinfo || [])[0];
              const u = ii && (ii.thumburl || ii.url);
              if (u && isValidArticleImage(u)) {
                item.images.push({
                  url: u,
                  caption: `Archivo CC0 Wikimedia Commons · ${(p.title || '').replace('File:', '').slice(0, 80)}`
                });
              }
            }
          }
        }
      } catch {}
    }

    if (item.images.length === 0) {
      const fallbackPath = VERIFIED_LOCAL_FALLBACKS[idx % VERIFIED_LOCAL_FALLBACKS.length];
      item.images.push({
        url: fallbackPath,
        caption: 'Lámina de archivo Whimsy POV (nota original publicada sin imagen abierta en el feed)',
        isFallback: true
      });
    }

    const baseHtmlForReader = (pageExtracted && pageExtracted.paragraphs.length >= 3 && stripTags(item.rawHtml).length < 450)
      ? pageExtracted.cleanHtml
      : item.rawHtml;

    item.cleanReaderHtml = buildCleanReaderHtml(baseHtmlForReader, item.link, item.images, item.summary);
    item.lenses = detectLenses(item);
    item.hiloRojo = findHiloRojo(item, minutas, ytVideos);
    item.defaultRights = item.defaultRights || (item.feedId === 'minutaw' ? 'own_cc0' : 'read_only');
    item.images = item.images.map(im => ({
      ...im,
      rights: (im.isFallback || /CC0 Wikimedia/i.test(im.caption || '') || item.defaultRights === 'own_cc0')
        ? 'own_cc0'
        : (item.defaultRights === 'check_cc0' ? 'permission' : 'read_only')
    }));
    item.broadcastPreset = {
      mode: item.videos.length > 0 ? 'video_sound' : 'images',
      zone: 'right',
      withSound: true
    };
    item.protagonist = buildProtagonistData(item, pageExtracted);
    item.suggestedMusic = suggestMusicForItem(item, item.lenses[0]);
    const suggestion = suggestBucketAndAngle(item);
    item.suggestedBucket = suggestion.suggestedBucket;
    item.suggestedWord = (suggestion.suggestedBucket || '').startsWith('tema:') ? suggestion.suggestedBucket.slice(5) : '';
    item.curatorialAngle = suggestion.curatorialAngle;
    item.id = 'rss-' + crypto.createHash('sha1').update(`${item.feedId}-${item.link}`).digest('hex').slice(0, 14);
    delete item.rawHtml;
  }));

  if (collected.length === 0 && fs.existsSync(OUTPUT_JSON)) {
    console.log('⚠️ Sin artículos nuevos obtenidos; se conserva intacto rss-inbox-live.json.');
    return;
  }

  collected.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Detector de Palabra Rectora candidata (3+ ítems en distintas lentes)
  const wordStats = new Map();
  for (const it of collected) {
    if (!it.suggestedWord) continue;
    if (!wordStats.has(it.suggestedWord)) wordStats.set(it.suggestedWord, { word: it.suggestedWord, count: 0, lenses: new Set() });
    const entry = wordStats.get(it.suggestedWord);
    entry.count += 1;
    for (const ln of it.lenses || []) entry.lenses.add(ln);
  }
  const suggestedWords = Array.from(wordStats.values())
    .map(w => ({ word: w.word, count: w.count, lensesCount: w.lenses.size, lenses: Array.from(w.lenses) }))
    .filter(w => w.count >= 2)
    .sort((a, b) => (b.lensesCount * 2 + b.count) - (a.lensesCount * 2 + a.count));

  const output = {
    generatedAt: new Date().toISOString(),
    totalItems: collected.length,
    suggestedWords,
    topWhimsySignals: TOP_WHIMSY_SIGNALS,
    weeklySuggestedFeeds: WEEKLY_SUGGESTED_FEEDS,
    freeMusicTracks: FREE_MUSIC_BANK,
    topicBuckets: TOPIC_BUCKETS.map(b => b.key),
    feeds: feedStatuses,
    items: collected
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n🎉 Listo: ${collected.length} artículos enriquecidos guardados en ${OUTPUT_JSON}`);
}

main().catch((err) => {
  console.error('Error en motor_rss_whimsy:', err);
  process.exit(1);
});
