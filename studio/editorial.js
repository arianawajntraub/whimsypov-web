(function () {
  window.WhimsyStudio = window.WhimsyStudio || {};

  const BARRIDA_SCRIPTS = [
    {
      slot: 'F1',
      name: 'Apertura Whimsy POV',
      estSec: 7,
      text: 'Whimsy POV, un paréntesis para la curiosidad y el pensar; abrimos la página en blanco alrededor de una sola palabra.'
    },
    {
      slot: 'F2',
      name: 'Cambio de Lente',
      estSec: 5.5,
      text: 'Giramos el cristal sobre la misma mesa para mirar la palabra de hoy desde otra materia.'
    },
    {
      slot: 'F3',
      name: 'Entrada Nota al Margen',
      estSec: 6,
      text: 'Nota al margen en Whimsy POV: abrimos el cuaderno para escuchar una voz real desde su oficio.'
    },
    {
      slot: 'F4',
      name: 'Entrada La Vitrina',
      estSec: 6,
      text: 'Pasamos a La Vitrina de esta semana: cosas reales para ver, leer y escuchar cuando apagues el aire.'
    },
    {
      slot: 'F5',
      name: 'Cierre Oficial',
      estSec: 8,
      text: 'La edición de hoy de Whimsy POV no concluye nada. No concluye, nada. Todo lo que nombramos queda abierto en La Minuta W.'
    },
    {
      slot: 'F6',
      name: 'Sting Mecenazgo (Solo Comercial)',
      estSec: 5,
      text: 'Acompaña este ciclo editorial una alianza que sostiene el paréntesis al aire.'
    }
  ];

  const BLOCK_TYPES = [
    { id: 'apertura', label: '0 · Apertura en frío', color: 't-apertura', defaultSec: 45 },
    { id: 'reloj', label: '1 · Un Reloj del Mundo (opcional)', color: 't-reloj', defaultSec: 105 },
    { id: 'lente_ciencia', label: '2 · Lente Material / Ciencia', color: 't-lente_ciencia', defaultSec: 300 },
    { id: 'barrida', label: 'Respiro + Barrida', color: 't-barrida', defaultSec: 12 },
    { id: 'lente_cultura', label: '3 · Lente Cultural / Archivo / Cine', color: 't-lente_cultura', defaultSec: 318 },
    { id: 'ventana_interludio', label: 'Paréntesis Ventana 15s (Interludio)', color: 't-ventana_interludio', defaultSec: 15 },
    { id: 'nota_al_margen', label: '4 · Nota al Margen (Voz invitada)', color: 't-nota_al_margen', defaultSec: 195 },
    { id: 'evidencia', label: '5 · Evidencia Humana en Marcha', color: 't-evidencia', defaultSec: 195 },
    { id: 'vitrina', label: '6 · La Vitrina + Hilo Rojo', color: 't-vitrina', defaultSec: 135 },
    { id: 'cierre', label: '7 · Cierre sin moralina + Firma', color: 't-cierre', defaultSec: 135 }
  ];

  const CURATED_GUESTS_80_20 = [
    {
      id: 'inv-emilia-damado',
      name: "Emilia D'Amado",
      gender: 'mujer',
      territory: 'Maldonado / Punta del Este, UY',
      role: 'Bióloga marina · CURE Maldonado (Udelar)',
      lenses: ['Ciencia y buenas noticias científicas', 'Archivo'],
      word: 'PIEL',
      handle: '@cure_udelar',
      questionEs: 'Cuando analizás un fragmento mínimo de piel de una ballena franca frente a la costa de Maldonado, ¿qué parte de su viaje por el Atlántico Sur queda escrita químicamente ahí adentro?',
      questionEn: 'When you analyze a tiny skin sample from a southern right whale off the coast of Maldonado, what part of its South Atlantic journey remains chemically written inside?'
    },
    {
      id: 'inv-heidi-lender',
      name: 'Heidi Lender',
      gender: 'mujer',
      territory: 'Pueblo Garzón, Maldonado, UY',
      role: 'Fotógrafa y fundadora de CAMPO Garzón',
      lenses: ['Arte', 'Moda y cultura textil', 'Movimientos sociales'],
      word: 'UMBRAL',
      handle: '@campo_garzon',
      questionEs: 'Pasaste de dirigir moda entre Nueva York y París a sostener una residencia internacional en un pueblo rural de Maldonado: ¿qué detalle físico de Garzón te cambia el ojo apenas cruzás el camino de entrada?',
      questionEn: 'After leading fashion editorial between New York and Paris, you built an international residency in rural Garzón: what physical detail shifts your eye the moment you cross the road in?'
    },
    {
      id: 'inv-anita-aisenberg',
      name: 'Dra. Anita Aisenberg',
      gender: 'mujer',
      territory: 'Montevideo, UY',
      role: 'Bióloga aracnóloga · IIBCE (Instituto Clemente Estable)',
      lenses: ['Ciencia y buenas noticias científicas', 'Física'],
      word: 'ARENA',
      handle: '@anitaaisenberg',
      questionEs: 'En los médanos de la costa uruguaya las hembras de Allocosa salen a buscar pareja y el cortejo ocurre por vibración bajo la arena: ¿qué escucha una araña en la duna que nosotros pisamos sin notar?',
      questionEn: 'In Uruguayan coastal dunes female Allocosa spiders initiate courtship through sand vibrations: what does a spider hear in the dune that we walk past without noticing?'
    },
    {
      id: 'inv-patricia-bentancur',
      name: 'Patricia Bentancur',
      gender: 'mujer',
      territory: 'Montevideo / Venecia, UY',
      role: 'Curadora Pabellón de Uruguay Bienal de Venecia 2026',
      lenses: ['Arte', 'Moda y cultura textil', 'IA y tecnología'],
      word: 'RESTO',
      handle: '@patriciabentancur',
      questionEs: 'Al cierre de la Bienal de Venecia 2026 con las esculturas blandas de Margaret Whyte hechas de telas donadas y chatarra tecnológica, ¿qué pasa en una sala cuando la tela entra en fricción física con la basura electrónica?',
      questionEn: 'Closing the 2026 Venice Biennale with Margaret Whyte soft sculptures built from donated fabrics and e-waste, what shifts in a room when textile enters friction with electronic scrap?'
    },
    {
      id: 'inv-silvia-hopenhayn',
      name: 'Silvia Hopenhayn',
      gender: 'mujer',
      territory: 'Buenos Aires, AR',
      role: 'Escritora y creadora de La página en blanco',
      lenses: ['Libros', 'Poesía', 'Percepción del idioma'],
      word: 'BLANCO',
      handle: '@silvia_hopenhayn',
      questionEs: 'Cuando sentabas en La página en blanco a un poeta y a un arquitecto alrededor de una sola palabra, ¿en qué segundo exacto te dabas cuenta de que la palabra acababa de abrir una grieta inesperada en la mesa?',
      questionEn: 'When you sat a poet and an architect around a single word on La página en blanco, at what exact moment did you notice the word cracking open an unexpected angle?'
    },
    {
      id: 'inv-gabriela-siracusano',
      name: 'Dra. Gabriela Siracusano',
      gender: 'mujer',
      territory: 'Buenos Aires, AR',
      role: 'Directora Centro MATERIA (UNTREF / CONICET)',
      lenses: ['Los colores', 'Ciencia y buenas noticias científicas', 'Arte'],
      word: 'VENENO',
      handle: '@materia_untref',
      questionEs: 'Cuando apuntás espectrometría sobre un cuadro andino del siglo XVII y aparecen minerales tóxicos molidos a mano, ¿qué te cuenta la química del pigmento que ningún documento escrito de la época se animó a decir?',
      questionEn: 'When you run spectrometry on a 17th-century Andean painting and find hand-ground toxic minerals, what does pigment chemistry reveal that no written record dared say?'
    },
    {
      id: 'inv-ivana-vollaro',
      name: 'Ivana Vollaro',
      gender: 'mujer',
      territory: 'Buenos Aires, AR',
      role: 'Artista visual · Autora de Reservados (Malba Puertos)',
      lenses: ['Arte', 'Percepción del idioma', 'Libros'],
      word: 'RESERVA',
      handle: '@ivanavollaro',
      questionEs: 'Después de intervenir las paredes vidriadas de la reserva técnica en Malba Puertos, ¿qué cambia en un objeto común cuando alguien le apoya al lado un cartel oficial que dice «Reservado»?',
      questionEn: 'After intervening the glass reserve walls at Malba Puertos, what happens to an ordinary object the second someone places an official Reserved sign beside it?'
    },
    {
      id: 'inv-cecilia-bembibre',
      name: 'Dra. Cecilia Bembibre',
      gender: 'mujer',
      territory: 'Buenos Aires / Londres, UK',
      role: 'Investigadora Patrimonio Olfativo · UCL London',
      lenses: ['Libros', 'Ciencia y buenas noticias científicas', 'IA y tecnología'],
      word: 'PAPEL',
      handle: '@smellofheritage',
      questionEs: 'Cuando medís en laboratorio los compuestos volátiles de un libro de hace tres siglos y aparece olor a vainilla, humo o madera, ¿qué dato concreto sobre la salud del papel te revela la nariz antes que los ojos?',
      questionEn: 'When you measure volatile organic compounds in a three-century-old book and detect vanilla or smoke, what does the nose reveal about paper health before the eyes do?'
    },
    {
      id: 'inv-lukas-kuhne',
      name: 'Lukas Kühne',
      gender: 'hombre',
      territory: 'Montevideo / Maldonado, UY',
      role: 'Escultor acústico · Monteaudio / Udelar',
      lenses: ['Física', 'Arte', 'Espiritualidad (cero autoayuda)'],
      word: 'ECO',
      handle: '@lukaskuhne',
      questionEs: 'Cuando construís una cámara de hormigón afinada a una frecuencia exacta en hercios y alguien canta adentro, ¿en qué momento deja de ser un edificio y pasa a comportarse como un instrumento musical?',
      questionEn: 'When you build a concrete chamber tuned to a precise Hertz frequency and someone sings inside, at what point does it stop acting as architecture and become an instrument?'
    },
    {
      id: 'inv-eduardo-cardozo',
      name: 'Eduardo Cardozo',
      gender: 'hombre',
      territory: 'Montevideo / José Ignacio, UY',
      role: 'Artista · Representante Uruguay Bienal de Venecia 2024',
      lenses: ['Arte', 'Moda y cultura textil'],
      word: 'MURO',
      handle: '@eduardocardozo_uy',
      questionEs: 'Para Latente arrancaste mediante stacco las paredes manchadas de tu taller en Montevideo y cosiste un velo con la gasa del desprendimiento: ¿qué te reveló la pintura cuando miraste el lado de atrás del muro?',
      questionEn: 'For Latente you detached the stained walls of your Montevideo studio via stacco and sewed a gauze veil: what did the painting reveal from the reverse side of the wall?'
    }
  ];

  const BLACKLIST_PATTERNS = [
    { re: /\bstorytelling\b/gi, label: 'Término prohibido: «storytelling»' },
    { re: /\bmindset\b/gi, label: 'Término prohibido: «mindset»' },
    { re: /\binnovaci[oó]n disruptiva\b/gi, label: 'Término prohibido: «innovación disruptiva»' },
    { re: /\bnos invita a reflexionar\b/gi, label: 'Frase prohibida: «nos invita a reflexionar»' },
    { re: /\ben el mundo actual\b/gi, label: 'Frase prohibida: «en el mundo actual»' },
    { re: /\bel\s+ppt\b|\bel\s+board\b/gi, label: 'Jerga prohibida: «el PPT / el board»' },
    { re: /\bnewsletter de tendencias\b/gi, label: 'Frase prohibida: «newsletter de tendencias»' },
    { re: /\bresignificar lo [ií]ntimo\b|\bhabitar el cuerpo\b|\batravesar la obra\b/gi, label: 'Cliché prohibido (Biblia Bloque 3)' },
    { re: /\bmoby\b/gi, label: 'Legal mobygratis: PROHIBIDO escribir/nombrar al artista («Moby»). Usar «provided by mobygratis»' },
    { re: /\brepositorio\b|\bcat[aá]logo\b|\bpiezas audiovisuales\b|\beditorial y ensay[ií]stica\b|\bsignos de [eé]poca\b|\bperspectiva personal\b/gi, label: 'Palabra prohibida en textos de Whimsy Web' },
    { re: /\b(teng[aá]s|pued[aá]s|veng[aá]s|hag[aá]s)\b/g, label: 'Voseo subjuntivo: escribir sin tilde final (tengas / puedas)' }
  ];

  const MENTE_EXCEPTIONS = new Set([
    'mente', 'demente', 'vehemente', 'inclemente', 'clemente', 'frecuente', 'simiente',
    'ambiente', 'corriente', 'cliente', 'pariente', 'siguiente', 'oriente', 'valiente', 'caliente'
  ]);

  function lintText(text = '') {
    const clean = String(text || '').trim();
    if (!clean) return { ok: true, warnings: [] };
    const warnings = [];

    // 1. Adverbios en -mente
    const words = clean.match(/[a-záéíóúüñ]+/gi) || [];
    const badMente = words.filter(w => {
      const low = w.toLowerCase();
      return low.length > 6 && low.endsWith('mente') && !MENTE_EXCEPTIONS.has(low);
    });
    if (badMente.length) {
      warnings.push(`Adverbios en -mente (${Array.from(new Set(badMente)).slice(0, 4).join(', ')})`);
    }

    // 2. Negaciones por contraste ("no es X, es Y" / "sin pedir permiso" / "nadie lo pidió")
    if (/\bno\s+(?:es|son|fue|eran|se trata)\b[^.\n]{1,50}\b(?:sino|es|era)\b/i.test(clean) || /\b(?:nadie\s+(?:lo|la|las|los)\s+pidi[oó]|sin\s+que\s+nadie|sin\s+pedir\s+permiso)\b/i.test(clean)) {
      warnings.push('Negación por contraste detectada («no es X, es Y» / «nadie lo pidió»)');
    }

    // 3. Oraciones menores a 7 palabras (excluyendo diálogos con raya — o acotaciones entre corchetes)
    const sentences = clean
      .replace(/\[[^\]]+\]/g, ' ')
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('—') && !s.startsWith('-') && !/^\d+\./.test(s));
    const shortSentences = sentences.filter(s => {
      const cnt = s.split(/\s+/).filter(Boolean).length;
      return cnt > 0 && cnt < 7;
    });
    if (shortSentences.length) {
      warnings.push(`${shortSentences.length} oración(es) < 7 palabras (ej. «${shortSentences[0].slice(0, 42)}»)`);
    }

    // 4. Blacklist literal + marca legal audio
    for (const rule of BLACKLIST_PATTERNS) {
      if (rule.re.test(clean)) warnings.push(rule.label);
    }

    return { ok: warnings.length === 0, warnings };
  }

  function estimateSpeechSec(text = '', wpm = 140) {
    const clean = String(text || '').replace(/\[[^\]]+\]/g, ' ').trim();
    if (!clean) return 0;
    const words = clean.split(/\s+/).filter(Boolean).length;
    return Math.round((words / wpm) * 60);
  }

  function calcParity(program) {
    let f = 0;
    let m = 0;
    const refs = [];
    if (program && Array.isArray(program.bloques)) {
      for (const b of program.bloques) {
        if (b.genderRef === 'mujer') { f++; refs.push({ label: b.titulo, g: 'mujer' }); }
        else if (b.genderRef === 'hombre') { m++; refs.push({ label: b.titulo, g: 'hombre' }); }
        if (b.tipo === 'nota_al_margen' && b.notaAlMargen?.gender) {
          if (b.notaAlMargen.gender === 'mujer') f++;
          else if (b.notaAlMargen.gender === 'hombre') m++;
        }
      }
    }
    const total = f + m;
    const pctWomen = total > 0 ? Math.round((f / total) * 100) : 100;
    return { women: f, men: m, total, pctWomen, ok: pctWomen >= 75 };
  }

  function buildInviteMessages(guest) {
    if (!guest) return { es: '', en: '' };
    const word = guest.word || 'PALABRA';
    const qEs = guest.questionEs || '¿Qué detalle material de tu trabajo todavía te intriga?';
    const qEn = guest.questionEn || 'What specific material detail of your work still puzzles you?';
    const es = [
      `Hola ${guest.name}, soy Ariana Wajntraub, locutora y conductora de Whimsy POV y La Minuta W desde Punta del Este.`,
      `Estoy armando un episodio alrededor de la palabra ${word} donde conviven un archivo científico y una escena cultural, y tu trabajo en ${guest.role} pertenece directamente a esa mesa.`,
      `Te pido apenas una nota de voz por acá de 45 a 75 segundos respondiendo esta sola pregunta: ${qEs}`,
      `A las 48 horas del estreno te entrego tu recorte vertical editado y subtitulado de un minuto con tus créditos y enlaces para que puedas compartirlo en tus redes.`,
      `Para cuidar tu archivo y tu nombre con prolijidad, al responderme «Sí, autorizo» y mandarme el audio confirmás que podemos emitir tu voz y tu crédito en YouTube, podcast, Substack, redes y radios.`
    ].join('\n\n');

    const en = [
      `Subject: 60-second voice note for Whimsy POV — "${word}" episode`,
      '',
      `Hello ${guest.name}, I am Ariana Wajntraub, a voice artist and host of Whimsy POV and the weekly Substack essay La Minuta W, produced from Uruguay.`,
      `Each episode places science, archives, and art around a single word, and next week our word is ${word}.`,
      `Would you send a 45 to 75 second voice note recorded right on your phone answering one specific question: ${qEn}`,
      `Within 48 hours of release I will send you a clean, captioned vertical clip with your full credits and links ready to share on your own channels.`,
      `To handle your voice and name properly, replying "Yes, I authorize" along with your recording confirms permission to air your audio and credit on YouTube, podcasts, Substack, social media, and radio.`
    ].join('\n\n');

    return { es, en };
  }

  function createPilotProgram() {
    return {
      episodioId: 'whimsy-piloto-01-piel',
      nombrePrograma: 'Piloto #1 · PIEL (Emilia D’Amado)',
      palabraRectora: 'PIEL',
      tituloYoutube: "Emilia D'Amado y la piel de las ballenas en Maldonado | Whimsy POV",
      idioma: 'es',
      modoComercial: false,
      mecenasNombre: '',
      episodeTrackIds: ['A-7', 'A-2', 'B-4', 'B-2', 'B-7', 'B-9'],
      bloques: [
        {
          id: 'b0',
          tipo: 'apertura',
          titulo: 'Apertura en frío · Palabra PIEL',
          duracionSeg: 45,
          cifraMonumental: '0,5 cm',
          genderRef: 'mujer',
          pistaId: 'A-7',
          barridaSlot: 'F1',
          guion: 'Tres segundos de viento costero sobre el agua fría de Maldonado antes de decir la palabra de hoy.\n\nLa palabra de hoy es PIEL. No como superficie cosmética sino como archivo químico que guarda el viaje de un cuerpo por el océano, el desprendimiento de un muro pintado y el filo del pergamino donde alguna vez se escribió una historia entera.',
          medios: [
            { id: 'seed-loop-rambla', url: 'loops/sol_rambla_pajaros.mp4', kind: 'video', name: 'Rambla PDE (Video limpio)', target: 'center', rights: 'own_cc0', credit: 'Grabación propia Punta del Este', noDerivatives: false }
          ]
        },
        {
          id: 'b1',
          tipo: 'reloj',
          titulo: 'Un Reloj del Mundo · Atlántico Sur',
          duracionSeg: 105,
          cifraMonumental: '16,4 °C',
          genderRef: null,
          pistaId: 'B-4',
          barridaSlot: '',
          guion: 'A esta hora frente a la costa de Maldonado el Atlántico Sur marca dieciséis grados cuatro en superficie y olas lentas cada nueve segundos.\n\nMientras la estación de primavera empuja las corrientes costeras hacia el este, frente a esta misma ventana pasan cada año las ballenas francas australes sin dejar marca visible para quienes miramos desde la orilla.',
          medios: [
            { id: 'seed-loop-olas', url: 'loops/teloleo_olas_orilla.mp4', kind: 'video', name: 'Olas orilla PDE', target: 'right', rights: 'own_cc0', credit: 'Grabación propia costa', noDerivatives: false }
          ]
        },
        {
          id: 'b2',
          tipo: 'lente_ciencia',
          titulo: 'Lente Ciencia · Isótopos en la piel marina',
          duracionSeg: 240,
          cifraMonumental: '4.200 km',
          genderRef: 'mujer',
          pistaId: 'A-2',
          barridaSlot: '',
          guion: 'En el Centro Universitario Regional del Este en Maldonado, la bióloga marina Emilia D’Amado estudia qué quedó registrado dentro de un fragmento mínimo de epidermis de ballena franca austral.\n\nLo que cabe en la punta de un dedo alcanza para leer dónde comió ese animal durante los últimos meses de migración y qué cambios atravesaron el mar abierto antes de llegar a la costa uruguaya.',
          medios: [
            { id: 'seed-edison-1', url: 'evidencias/prepro/shawn_miller_edison_1.jpg', kind: 'image', name: 'Cangrejo en caparazón prestado (Shawn Miller)', target: 'right', rights: 'permission', permissionRef: 'PERM-001 · Shawn Miller', credit: 'Foto: Shawn Miller (@okinawanaturephotography)', noDerivatives: false }
          ]
        },
        {
          id: 'b3',
          tipo: 'barrida',
          titulo: 'Respiro + Barrida Cambio de Lente',
          duracionSeg: 12,
          cifraMonumental: '2026',
          genderRef: null,
          pistaId: 'B-2',
          barridaSlot: 'F2',
          guion: '[SILENCIO 1,5s → DISPARAR F2 «Cambio de Lente»]',
          medios: []
        },
        {
          id: 'b4',
          tipo: 'lente_cultura',
          titulo: 'Lente Textil y Archivo · Margaret Whyte + Patricia Bentancur',
          duracionSeg: 260,
          cifraMonumental: '1946',
          genderRef: 'mujer',
          pistaId: 'B-2',
          barridaSlot: '',
          guion: 'Al mismo tiempo, en el pabellón uruguayo de la Bienal de Venecia 2026 curado por Patricia Bentancur, las esculturas blandas de Margaret Whyte cosen telas usadas alrededor de placas descartadas de chatarra electrónica.\n\nUn tejido donado pasa a funcionar como epidermis sobre circuitos en desuso, exactamente igual que los antiguos pergaminos de piel estirada guardados en los archivos abiertos del Victoria and Albert Museum donde el raspado dejaba leer un texto anterior debajo del nuevo.',
          medios: [
            { id: 'seed-aris-cuaderno', url: 'evidencias/aris_cuaderno_boceto.jpg', kind: 'image', name: 'Cuaderno boceto propio', target: 'right', rights: 'own_cc0', credit: 'Archivo Whimsy POV', noDerivatives: false },
            { id: 'seed-loop-bereshit', url: 'loops/micro_bereshit_macro.mp4', kind: 'video', name: 'Macro letra hebrea Bereshit', target: 'center', rights: 'own_cc0', credit: 'Grabación propia Whimsy POV', noDerivatives: false }
          ]
        },
        {
          id: 'b5',
          tipo: 'ventana_interludio',
          titulo: 'Paréntesis Ventana · Mar abierto (15s)',
          duracionSeg: 15,
          cifraMonumental: '15 s',
          genderRef: null,
          pistaId: 'B-7',
          barridaSlot: '',
          guion: '[TECLA W: En vivo mira la ventana frente al mar durante 15 segundos mientras la música sube a primer plano como interludio radial.]',
          medios: [
            { id: 'seed-loop-ventana-sol', url: 'loops/ventana_mar_sol.mp4', kind: 'video', name: 'Ventana al mar PDE', target: 'center', rights: 'own_cc0', credit: 'Ventana Punta del Este', noDerivatives: false }
          ]
        },
        {
          id: 'b6',
          tipo: 'nota_al_margen',
          titulo: "Nota al Margen · Emilia D'Amado (CURE Maldonado)",
          duracionSeg: 195,
          cifraMonumental: '01:00',
          genderRef: 'mujer',
          pistaId: 'B-4',
          barridaSlot: 'F3',
          guion: 'Abrimos el cuaderno al costado de la página para escuchar desde su laboratorio en Maldonado a la bióloga marina Emilia D’Amado.\n\n[DISPARAR TECLA P: Silencio 1,5s → Barrida F3 → Audio Nota al Margen a capella → Silencio 1,5s → Retomar tomando 1 sola palabra suya sin felicitar ni resumir.]',
          notaAlMargen: {
            nombre: "Emilia D'Amado",
            oficio: 'Bióloga marina · CURE Maldonado (Udelar)',
            ciudad: 'Maldonado, UY',
            handle: '@cure_udelar',
            gender: 'mujer',
            audioVaultId: '',
            audioName: 'Pendiente cargar audio WhatsApp (.ogg / .m4a)',
            permisoOk: false,
            fechaPermiso: ''
          },
          medios: [
            { id: 'seed-aris-botanica', url: 'evidencias/aris_botanica_fieldmuseum.jpg', kind: 'image', name: 'Placa archivo botánico', target: 'right', rights: 'own_cc0', credit: 'Archivo Whimsy POV', noDerivatives: false }
          ]
        },
        {
          id: 'b7',
          tipo: 'evidencia',
          titulo: 'Evidencia · Filología hebrea (Piel / Luz)',
          duracionSeg: 165,
          cifraMonumental: 'אוֹר / עוֹר',
          genderRef: null,
          pistaId: 'B-4',
          barridaSlot: '',
          guion: 'En hebreo bíblico las palabras piel y luz suenan igual al oído y se distinguen apenas por la primera letra silenciosa al escribirlas en el rollo.\n\nLa tradición exegética antigua notó que lo que recubre al cuerpo y lo que permite mirar desde afuera comparten casi la misma grafía sonora, mientras la película Les Plages d’Agnès de Agnès Varda disponía espejos directamente sobre la arena húmeda para reflejar el cielo en el borde mismo del mar.',
          medios: [
            { id: 'seed-aris-varda', url: 'evidencias/aris_agnes_varda_jr.jpg', kind: 'image', name: 'Agnès Varda y JR', target: 'right', rights: 'own_cc0', credit: 'Archivo Whimsy POV', noDerivatives: false }
          ]
        },
        {
          id: 'b8',
          tipo: 'vitrina',
          titulo: 'La Vitrina + Hilo Rojo',
          duracionSeg: 135,
          cifraMonumental: 'EP. 5',
          genderRef: 'mujer',
          pistaId: 'A-7',
          barridaSlot: 'F4',
          guion: '[DISPARAR F4 «La Vitrina»]\n\nTres cosas nuevas para cuando apagues la pantalla: en Leer, el ensayo ilustrado sobre tatuajes marinos del siglo XIX en The Public Domain Review; en Ver, los espejos en la playa de Les Plages d’Agnès dirigidos por Agnès Varda; y en Escuchar, los registros hidroacústicos de ballenas australes liberados en dominio público por NOAA. Todo queda enlazado debajo de Arena y del Episodio 5 de Whimsy POV en Substack.',
          medios: []
        },
        {
          id: 'b9',
          tipo: 'cierre',
          titulo: 'Cierre sin moralina · Poema + Pregunta + Firma',
          duracionSeg: 135,
          cifraMonumental: '∞',
          genderRef: 'mujer',
          pistaId: 'B-9',
          barridaSlot: 'F5',
          guion: 'Volvemos a esos tres segundos frente a la arena húmeda de Maldonado antes de que suba la marea.\n\n[SILENCIO 1,5s]\n\n«Todo lo que toca la orilla deja una marca invisible hasta que alguien se inclina a leerla.» (Lectura breve de Circe Maia o Ida Vitale a confirmar sobre edición en mano).\n\nLa práctica nº 20: hoy mirá la palma de tu mano o el lomo gastado de un libro que abrió otra persona hace treinta años sin sacarle foto.\n\n¿Qué cosa que estás sosteniendo todos los días ya lleva escrito tu recorrido entero y todavía no leíste de cerca?\n\nLa edición de hoy de Whimsy POV no concluye nada. No concluye, nada.\n\n[DISPARAR F5 + FADE MUSICAL 3s]',
          medios: []
        }
      ],
      clipMarkers: []
    };
  }

  function formatMMSS(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function buildProductPack(program, markers = [], chapters = [], catalogTracks = []) {
    const prog = program || createPilotProgram();
    const usedTracks = Array.from(new Set(prog.bloques.map(b => b.pistaId).filter(Boolean)))
      .map(id => catalogTracks.find(t => t.id === id))
      .filter(Boolean);

    const creditLines = usedTracks.length
      ? usedTracks.map(t => t.credit || `Music: ${t.title} provided by mobygratis`).join(' · ')
      : 'Music provided by mobygratis';

    const visualCredits = [];
    const guestRefs = [];
    const seenCred = new Set();
    for (const b of prog.bloques) {
      if (b.tipo === 'nota_al_margen' && b.notaAlMargen?.nombre) {
        guestRefs.push(b.notaAlMargen);
      }
      for (const m of b.medios || []) {
        const key = `${m.rights}:${m.credit || m.name}`;
        if (!seenCred.has(key)) {
          seenCred.add(key);
          visualCredits.push({ name: m.name, rights: m.rights, credit: m.credit || '', sourceUrl: m.sourceUrl || '' });
        }
      }
    }

    const ytTitle = (prog.tituloYoutube || `${prog.palabraRectora || 'Whimsy POV'} | Whimsy POV`).slice(0, 100);
    const chapLines = chapters.length
      ? chapters.map(c => `${formatMMSS(c.sec)} ${c.title}`).join('\n')
      : (() => {
        let acc = 0;
        return prog.bloques.map(b => {
          const line = `${formatMMSS(acc)} ${b.titulo}`;
          acc += Number(b.duracionSeg) || 60;
          return line;
        }).join('\n');
      })();

    const institutionalFooter = 'Ariana Wajntraub es comunicadora, locutora (locutora.ar) y estratega. Produce Whimsy POV y La Minuta W desde Punta del Este. Por columnas en radio o streaming, ciclos con museos e instituciones, moderación de paneles, conferencias o mecenazgos editoriales: whimsypov@gmail.com.';

    const youtubeDesc = [
      `Palabra rectora: ${prog.palabraRectora || 'WHIMSY'}`,
      guestRefs.length ? `Nota al margen: ${guestRefs.map(g => `${g.nombre} (${g.oficio}) ${g.handle || ''}`).join(' · ')}` : '',
      '',
      'Capítulos:',
      chapLines,
      '',
      'Lectura completa y links de La Vitrina en La Minuta W: https://arianawajntraub.substack.com',
      '',
      'Fuentes y créditos visuales:',
      visualCredits.map(v => `- ${v.name}: ${v.credit || v.rights}`).join('\n'),
      '',
      `Audio: ${prog.modoComercial ? 'Licencia comercial verificada / archivo propio' : creditLines}`,
      '',
      institutionalFooter
    ].filter(x => x !== undefined).join('\n');

    const ytShortTitle = `${prog.palabraRectora || 'Whimsy POV'}: ${guestRefs[0]?.nombre ? guestRefs[0].nombre + ' en Nota al Margen' : ytTitle}`.slice(0, 100);

    const igCopy = [
      `La palabra de esta mesa es ${prog.palabraRectora || 'PIEL'}.`,
      guestRefs[0]?.nombre ? `${guestRefs[0].nombre} (${guestRefs[0].handle || ''}) dejó su apunte de voz desde ${guestRefs[0].ciudad || 'su oficio'} para nuestra sección Nota al Margen.` : 'Tres escenas reales conectadas sin explicar la metáfora.',
      'El episodio completo y los enlaces de La Vitrina ya quedaron abiertos en La Minuta W (link en bio). @whimsypov'
    ].join('\n\n');

    const linkedinCopy = [
      `Esta semana en Whimsy POV y La Minuta W trabajamos alrededor de una sola palabra: ${prog.palabraRectora || 'PIEL'}.`,
      guestRefs[0]?.nombre ? `Sumamos la voz real de ${guestRefs[0].nombre} (${guestRefs[0].oficio}) en nuestro segmento Nota al Margen junto a archivo abierto y lectura editorial.` : '',
      'El mismo material circula en YouTube, podcast en Substack y recortes breves pensados para quienes prefieren pensar despacio antes de opinar.',
      'Leelo o escuchalo abierto en https://arianawajntraub.substack.com',
      '',
      institutionalFooter
    ].filter(Boolean).join('\n\n');

    const firstGuest = guestRefs[0];
    const guestDelivery48h = firstGuest
      ? `Hola ${firstGuest.nombre}, ya salió al aire el episodio sobre ${prog.palabraRectora} con tu Nota al Margen. Acá te dejo el enlace al episodio completo y a La Minuta W con tus créditos, y te adjunto tu video vertical de un minuto ya subtitulado con firma @whimsypov · La Minuta W para que lo uses donde quieras. Gracias por prestar tu precisión para esta mesa.`
      : 'Cuando cargues una Nota al Margen, acá tenés el mensaje de entrega a las 48h listo para enviar con su clip 9:16.';

    const loteAprobalo = {
      cuenta_id: 'whimsy-pov',
      episodio_id: prog.episodioId,
      palabra_rectora: prog.palabraRectora,
      fecha_emision: new Date().toISOString().slice(0, 10),
      modo_derechos: prog.modoComercial ? 'comercial_radio' : 'piloto_no_comercial',
      legal_audit: {
        music_license_type: prog.modoComercial ? 'commercial_radio_clean' : 'mobygratis_noncommercial',
        nota_al_margen_consent_ref: firstGuest ? `${firstGuest.nombre} (${firstGuest.permisoOk ? 'permiso_confirmado' : 'PENDIENTE_OK'})` : 'sin_invitado',
        visual_credits: visualCredits,
        credit_line_final: prog.modoComercial ? 'Audio propio / licencia comercial' : creditLines
      },
      piezas: {
        youtube_largo: {
          titulo: ytTitle,
          descripcion: youtubeDesc,
          thumbnail_ref: visualCredits[0]?.name || ''
        },
        substack_minuta_podcast: {
          titulo: `${prog.palabraRectora} — La Minuta W`,
          bajada_dialogada: '— ¿Dónde empieza lo que contás? — En un detalle mínimo que casi nadie miró dos veces.',
          cuerpo_html: prog.bloques.filter(b => b.guion && !b.guion.startsWith('[')).map(b => `<p>${b.guion.replace(/\n/g, '<br>')}</p>`).join('\n'),
          audio_mp3_ref: `${prog.episodioId}_PODCAST_16LUFS.mp3`,
          pie_institucional_2_lineas: institutionalFooter,
          notes_derivados: [
            `Nota 1 (Lámina): Una imagen abierta del archivo y una pregunta sobre ${prog.palabraRectora}.`,
            `Nota 2 (Voz): ${firstGuest ? `${firstGuest.nombre} (${firstGuest.oficio}) en Nota al Margen esta semana.` : 'Fragmento de archivo verificado esta semana.'}`,
            `Nota 3 (La Vitrina): Tres enlaces reales para ver, leer y escuchar esta noche.`
          ]
        },
        clip_principal_9_16: {
          video_ref: `${prog.episodioId}_CLIP_01_9x16.mp4`,
          copy_ig: igCopy,
          copy_yt_short: ytShortTitle
        },
        clip_nota_al_margen_48h: {
          invitado_nombre: firstGuest?.nombre || '',
          invitado_handle: firstGuest?.handle || '',
          video_9_16_ref: `${prog.episodioId}_NOTA_AL_MARGEN_9x16.mp4`,
          copy_ig_colab: igCopy,
          mensaje_entrega_48h: guestDelivery48h
        },
        linkedin_autoridad: {
          copy_sobrio: linkedinCopy
        }
      }
    };

    const marcadoresJson = {
      episodioId: prog.episodioId,
      palabraRectora: prog.palabraRectora,
      generadoEn: new Date().toISOString(),
      capitulos: chapters.length ? chapters : prog.bloques.map((b, i) => ({ index: i + 1, title: b.titulo, sec: 0 })),
      clips9x16: markers
    };

    return {
      ytTitle,
      ytShortTitle,
      youtubeDesc,
      igCopy,
      linkedinCopy,
      guestDelivery48h,
      loteAprobalo,
      marcadoresJson,
      chapLines,
      lintIg: lintText(igCopy),
      lintYt: lintText(ytTitle + '\n' + youtubeDesc)
    };
  }

  window.WhimsyStudio.Editorial = {
    BARRIDA_SCRIPTS,
    BLOCK_TYPES,
    CURATED_GUESTS_80_20,
    lintText,
    estimateSpeechSec,
    calcParity,
    buildInviteMessages,
    createPilotProgram,
    buildProductPack,
    formatMMSS
  };
})();
