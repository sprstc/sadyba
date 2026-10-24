/**
 * ============================================================================
 * src/data/houseSpec.js
 * Jedyne Źródło Prawdy (Single Source of Truth) dla Cyfrowego Bliźniaka 3D
 * budynku mieszkalnego jednorodzinnego w zabudowie bliźniaczej (Segment B – północny).
 *
 * Opracowano na podstawie analizy porównawczej 3 źródeł:
 * 1) Projektu pierwotnego i obliczeń statycznych z 19.X.1955 r.
 * 2) Projektu Inwentaryzacyjnego zatwierdzonego 7 marca 1966 r.
 * 3) Współczesnej inwentaryzacji laserowej 3D (standard RICS IPMS 3C)
 *    oraz dokumentacji fotograficznej z natury (2026 r.).
 * ============================================================================
 */

export const ARCHIVE_METADATA = {
  address: 'Segment bliźniaczy północny (Typ B) – zabudowa jednorodzinna',
  cooperative: 'Spółdzielnia Mieszkaniowo-Budowlana (lata 50. XX w.)',
  investor1966: 'Właściciel prywatny (Segment B)',
  project1955: {
    approvalDate: '19.X.1955 r. / 22.XI.1955 r.',
    approvalNumber: 'Dokumentacja projektowo-statyczna (1955 r.)',
    authors: 'Zespół projektowy inżynierów konstruktorów (1955 r.)',
    structuralReviewer: 'Inspektor weryfikacji obliczeń statycznych (12.X.1955 r.)',
    buildingInspector: 'Nadzór budowlany (12.XII.1955 r.)',
    footprintArea: 64.00,
    usableArea: 106.36,
    volume: 533.00,
  },
  inventory1966: {
    approvalDate: '7 marca 1966 r. (Pozwolenie na użytkowanie: 21 lipca 1966 r.)',
    approvalNumber: 'Operat inwentaryzacji budowlanej (1966 r.)',
    authors: 'Zespół inżynierów architektów – inwentaryzacja powykonawcza (1966 r.)',
    districtArchitect: 'Wydział Architektury i Nadzoru Budowlanego (1966 r.)',
    chimneyReport: 'Protokół odbioru przewodów kominowych i wentylacyjnych (26.IV.1965 r.)',
    plotArea: 387.00,
    footprintArea: 85.17,
    volume: 614.00,
  },
  modernScan2026: {
    provider: 'Skanowanie laserowe 3D (standard RICS IPMS 3C)',
    totalInternalArea: 222.7,
    terraceArea: 15.9,
    lowHeadroomArea: 14.9,
    floorsBreakdown: {
      basement: 52.1,
      groundFloor: 66.0,
      firstFloor: 53.2,
      attic: 51.4,
    },
  },
};

/**
 * UKŁAD WSPÓŁRZĘDNYCH ŚWIATA 3D (Three.js Right-Handed):
 * - Oś Y (pionowa): Y = 0.00 m to poziom terenu urządzonego (-1.60 m względem parteru ±0.00).
 * - Oś X (Wschód ↔ Zachód, głębokość działki):
 *     +X = WSCHÓD (Elewacja frontowa od ulicy, zjazd do garażu)
 *     -X = ZACHÓD (Elewacja ogrodowa, weranda, taras, ogród tylny)
 * - Oś Z (Północ ↔ Południe, szerokość działki):
 *     Z = 0.00 m = Oś dylatacji / ściana ogniowa między Segmentem B i Segmentem A
 *     -Z = PÓŁNOC (Segment B – północny: Z od 0.00 do -6.08 m, wejście główne od północy)
 *     +Z = POŁUDNIE (Segment A – bliźniaczy: Z od 0.00 do +6.08 m)
 *
 * Dzięki temu układowi wszystkie 4 elewacje w rzutach prostokątnych (Wschód, Zachód, Północ, Góra)
 * odpowiadają w 100% bez odbić lustrzanych rysunkom inwentaryzacyjnym z 1966 r.!
 */
export const ELEVATIONS = {
  FOUNDATION_BOTTOM: -1.55, // Spód ław fundamentowych (bankiety betonowe Rw=110)
  BASEMENT_FLOOR: -0.92,    // Posadzka podziemia (-2.52 m w proj. arch.)
  GROUND_LEVEL: 0.00,       // Poziom terenu urządzonego (-1.60 m w proj. arch.)
  BASEMENT_CEILING: 1.30,   // Spód stropu Kleina nad piwnicą (wys. w świetle 2.22 m)
  GROUND_FLOOR: 1.60,       // Posadzka parteru (±0.00 w proj. arch., cokół +1.60 m)
  GROUND_CEILING: 4.40,     // Spód stropu Kleina nad parterem (wys. w świetle 2.80 m)
  FIRST_FLOOR: 4.70,        // Posadzka I piętra (+3.10 m w proj. arch., strop 0.30 m)
  FIRST_CEILING: 7.28,      // Spód stropu Kleina nad I piętrem (wys. w świetle 2.58 m)
  ATTIC_FLOOR: 7.55,        // Posadzka poddasza / gzyms (+5.95 m w proj. arch., strop 0.27 m)
  WALL_PLATE: 7.85,         // Poziom murłaty 16×16 cm (+6.25 m w proj. arch.)
  PURLIN_LEVEL: 9.15,       // Poziom płatwi 12×18 cm i kleszczy 2×(5×14) cm
  ROOF_RIDGE: 10.25,        // Kalenica główna dachu (+8.65 m nad parterem, wys. strychu 2.70 m)
  CHIMNEY_TOP: 11.20,       // Czapka komina głównego (wys. całkowita budynku ok. 12.12 m od posadzki piwnicy)
  // Aliasy camelCase:
  foundationBottom: -1.55,
  basementFloor: -0.92,
  groundLevel: 0.00,
  basementCeiling: 1.30,
  groundFloor: 1.60,
  groundCeiling: 4.40,
  firstFloor: 4.70,
  firstCeiling: 7.28,
  atticFloor: 7.55,
  wallPlate: 7.85,
  purlinLevel: 9.15,
  roofRidge: 10.25,
  chimneyTop: 11.20,
};

export const WALL_THICKNESS = {
  FOUNDATION_FOOTING_EXT: 0.69, // Ława pod ścianą zewnętrzną (60-69 cm wg str. 10 obl. stat.)
  FOUNDATION_FOOTING_INT: 0.85, // Ława pod ścianą obciążoną stropami (85 cm wg str. 11 obl. stat.)
  FOUNDATION_CHIMNEY: 1.45,     // Ława pod ścianą kominową (145 cm wg str. 11 obl. stat.)
  BASEMENT_EXT: 0.51,           // Mury piwniczne z cegły pełnej na zaprawie 1:4 (51 cm)
  EXT_MAIN: 0.38,               // Mury zewnętrzne konstrukcyjne parteru i piętra (38 cm / 41 cm z tynkiem)
  EXT_VERANDA: 0.25,            // Ściany werandy ogrodowej (25 cm)
  PARTY_WALL: 0.38,             // Ściana dylatacyjna / kominowa w osi Z = 0 (38 cm + komin 51 cm)
  INT_LOAD_BEARING: 0.25,       // Wewnętrzne ściany nośne (cegła pełna kl. II/III 25 cm)
  PARTITION: 0.12,              // Ścianki działowe z cegły dziurawki na 1/2 cegły (12 cm)
  SLAB_KLEIN: 0.30,             // Grubość całkowita stropu Kleina z podłogą (30 cm; nad I p. 27 cm)
};

/**
 * Wymiary gabarytowe bryły (zgodne z łańcuchem wymiarowym Inwentaryzacji 1966 r. str. 6):
 * - Szerokość segmentu (oś Z): 6.08 m (Z od 0.00 do -6.08 m)
 * - Głębokość korpusu głównego (oś X): 11.00 m (X od +5.50 m [ulica] do -5.50 m [ściana salonu])
 * - Głębokość werandy (oś X): 2.70 m (X od -5.50 m do -8.20 m; w świetle 2.40 m)
 * - Łączna głębokość zabudowy z werandą: 13.70 m (6.08 × 13.70 = 83.30 m² + ganek 1.87 m² = 85.17 m²!)
 * - Schody ogrodowe przy werandzie: 2.37 m (X od -8.20 m do -10.57 m; łącznie 16.07 m jak na rzucie 1966!)
 */
export const BUILDING_DIMS = {
  SEGMENT_WIDTH: 6.08,
  TWIN_WIDTH: 12.16,
  MAIN_DEPTH: 11.00,
  VERANDA_DEPTH: 2.70,
  VERANDA_CLEAR_DEPTH: 2.40,
  TOTAL_DEPTH_WITH_VERANDA: 13.70,
  GARDEN_STAIRS_LENGTH: 2.37,
  TOTAL_CHAIN_1966: 16.07,

  // Współrzędne X kluczowych osi konstrukcyjnych:
  X_FRONT_FACE: 5.50,        // Lico wschodnie (od ulicy frontowej)
  X_FRONT_INNER: 5.12,       // Wewnętrzne lico ściany wschodniej (grub. 38 cm)
  X_KITCHEN_WEST: 2.12,      // Ścianka działowa między kuchnią a WC/klatką (3.00 m od frontu)
  X_BEDROOM0_WEST: 1.12,     // Ściana między sypialnią frontową parteru a korytarzem (4.00 m)
  X_SPINE_WEST: -0.95,       // Wschodnie lico głównej ściany poprzecznej nośnej
  X_SALON_EAST: -1.20,       // Zachodnie lico głównej ściany poprzecznej nośnej (grub. 25 cm)
  X_MAIN_REAR_INNER: -5.15,  // Wewnętrzne lico ściany między salonem a werandą (szer. salonu 3.95 m)
  X_MAIN_REAR_FACE: -5.50,   // Zewnętrzne lico korpusu głównego (koniec bryły z 1955 r.)
  X_VERANDA_INNER: -7.95,    // Wewnętrzne lico ściany zachodniej werandy
  X_VERANDA_FACE: -8.20,     // Zewnętrzne lico werandy od ogrodu

  // Współrzędne Z kluczowych osi konstrukcyjnych (Segment B: Z <= 0):
  Z_PARTY_AXIS: 0.00,        // Oś dylatacji bliźniaka
  Z_PARTY_INNER: -0.38,      // Wewnętrzne lico ściany południowej (dylatacyjnej)
  Z_SERVICE_STRIP: -2.35,    // Ścianka pasma południowego (Kuchnia / WC / Klatka schodowa / Łazienka)
  Z_NORTH_INNER: -5.70,      // Wewnętrzne lico ściany północnej (wejściowej)
  Z_NORTH_FACE: -6.08,       // Zewnętrzne lico ściany północnej (szer. 6.08 m)
  Z_PORCH_OUTER: -7.43,      // Zewnętrzne lico podestu wejściowego od północy
};

/**
 * Działka ewidencyjna i otoczenie (Plan Sytuacyjny 1:500 z 1966 r., str. 3 i 5):
 * - Szerokość frontu działki B: 10.52 m (Z od 0.00 do -10.52 m; pas boczny północny 4.44 m)
 * - Głębokość działki: 30.13 m (od linii ogrodzenia frontowego X = +10.50 m do granicy zachodniej X = -19.63 m)
 * - Przedogródek (linia zabudowy): 5.00 m (od ogrodzenia X = +10.50 m do lica frontowego X = +5.50 m)
 */
export const PLOT_SPEC = {
  WIDTH_SINGLE: 10.52,
  WIDTH_TWIN: 21.04,
  DEPTH: 30.13,
  AREA_M2: 387.0,
  FRONT_SETBACK: 5.00,
  SIDE_MARGIN_NORTH: 4.44,
  REAR_GARDEN_DEPTH: 16.63,
  X_FENCE_EAST: 10.50,       // Linia ogrodzenia od ulicy frontowej
  X_PLOT_WEST: -19.63,       // Zachodnia granica działki (10.50 - 30.13 = -19.63 m)
  X_STREET_CENTER: 15.50,    // Oś jezdni ulicy frontowej (szer. ulicy w liniach rozgr. 10.00 m)
  GARAGE_RAMP: {
    xStart: 10.50,
    xEnd: 5.50,
    zCenter: -4.15,
    width: 2.55,
    zElevationStart: 0.00,
    zElevationEnd: -0.92,
  },
  SEPTIC_TANK_1966: {
    // Historyczne 3-komorowe szambo „SZAMBO OOO” z planu sytuacyjnego 1966 r.
    x: -12.5,
    z: -7.8,
  },
  UTILITY_POLE_2026: {
    // Betonowy słup rozkraczny linii napowietrznej nn przy ogrodzeniu frontowym („słup do demontażu”)
    x: 10.35,
    z: -1.45,
    height: 9.2,
  },
};

/**
 * Specyfikacja konstrukcyjna stropów Kleina (z Obliczeń Statycznych 1955 r., str. 4–8
 * oraz Rzutów Inwentaryzacyjnych 1966 r., str. 6–7):
 * - Belki z rozbiórki (obniżenie dopuszczalnych naprężeń o 10%, stąd w naturze I NP 24 zamiast I NP 22).
 * - Płyta Kleina typ żeberkowy półciężki z cegły pełnej kl. III (Re = 50 kg/cm²), zbrojenie Ø 6 mm co spoinę.
 */
export const KLEIN_SLAB_SPEC = {
  beamProfiles: {
    INP24: { height: 0.24, flangeWidth: 0.106, webThickness: 0.0087, flangeThickness: 0.0131, label: 'I NP 24' },
    INP22: { height: 0.22, flangeWidth: 0.098, webThickness: 0.0081, flangeThickness: 0.0122, label: 'I NP 22' },
    INP18: { height: 0.18, flangeWidth: 0.082, webThickness: 0.0069, flangeThickness: 0.0104, label: 'I NP 18' },
    INP16: { height: 0.16, flangeWidth: 0.074, webThickness: 0.0063, flangeThickness: 0.0095, label: 'I NP 16' },
    INP14: { height: 0.14, flangeWidth: 0.066, webThickness: 0.0057, flangeThickness: 0.0086, label: 'I NP 14' },
  },
  // Rozmieszczenie osi belek stalowych (wzdłuż osi X, rozpiętość poprzeczna wzdłuż osi Z):
  baysX: [
    { x: 4.30, profile: 'INP22', span: 'full', note: 'Trakt frontowy (I NP 22 / PN 24)' },
    { x: 3.15, profile: 'INP22', span: 'full', note: 'Trakt frontowy (I NP 22 / PN 24)' },
    { x: 2.05, profile: 'INP24', span: 'full', note: 'Belka przy klatce schodowej I NP 24 (Wx=354 cm³)' },
    { x: 0.90, profile: 'INP18', span: 'trimmed', note: 'Belka krótka przy wymianie klatki I NP 18 (l=3.70m)' },
    { x: -0.10, profile: 'INP18', span: 'trimmed', note: 'Belka krótka przy wymianie klatki I NP 18 (l=3.70m)' },
    { x: -1.10, profile: 'INP24', span: 'full', note: 'Belka główna przy klatce i ścianie nośnej I NP 24' },
    { x: -2.35, profile: 'INP24', span: 'full', note: 'Trakt salonu PN 24 (rozstaw a=1.25 m wg inwent. 1966)' },
    { x: -3.60, profile: 'INP24', span: 'full', note: 'Trakt salonu PN 24 (rozstaw a=1.25 m wg inwent. 1966)' },
    { x: -4.85, profile: 'INP22', span: 'full', note: 'Trakt salonu przy ścianie ogrodowej' },
    { x: -6.35, profile: 'INP24', span: 'veranda', note: 'Strop werandy / tarasu PN 24 (rozstaw a=1.20 m)' },
    { x: -7.55, profile: 'INP24', span: 'veranda', note: 'Strop werandy / tarasu PN 24 (rozstaw a=1.20 m)' },
  ],
  stairTrimmer: {
    // Wymian stalowy klatki schodowej (Obliczenia statyczne 1955 str. 7 i 8: I NP 14, l = 2.00 m)
    xStart: -1.10,
    xEnd: 2.05,
    zAxis: -2.85,
    profile: 'INP14',
    label: 'Wymian klatki I NP 14',
  },
};

/**
 * Specyfikacja więźby dachowej stolcowo-kleszczowej (Obliczenia 1955 str. 2-4 + Przekrój 1966 str. 7):
 */
export const ROOF_SPEC = {
  pitchAngleDeg: 42.3, // tg β = 2.20 / 2.30 => β = 42°20' w obl. 1955 (w przekroju 1966 ok. 38-45°)
  timberCrossSections: {
    murlata: { w: 0.16, h: 0.16, label: 'Murłata 16×16 cm' },
    platew: { w: 0.12, h: 0.18, label: 'Płatew 12×18 cm (w obl. 12×16 cm)' },
    stolec: { w: 0.14, h: 0.14, label: 'Słupek (stolec) 14×14 cm' },
    podwalina: { w: 0.12, h: 0.14, label: 'Podwalina 12×14 cm' },
    krokiew: { w: 0.08, h: 0.16, label: 'Krokiew 8×16 cm (rozstaw ~1.00 m)' },
    kleszcze: { w: 0.05, h: 0.14, label: 'Kleszcze podwójne 2×(5×14) cm' },
    miecz: { w: 0.08, h: 0.12, label: 'Miecz 8×12 cm' },
  },
  dormers: [
    { id: 'dormer-east', side: 'east', x: 3.65, z: -3.04, width: 1.35, label: 'Lukarna wschodnia (od ulicy)' },
    { id: 'dormer-north', side: 'north', x: 0.00, z: -4.25, width: 1.35, label: 'Lukarna północna (od wejścia)' },
    { id: 'dormer-west', side: 'west', x: -3.65, z: -2.85, width: 1.35, label: 'Lukarna zachodnia (od ogrodu)' },
  ],
};

/**
 * Pełna baza pomieszczeń (do Raycastingu 3D, Karty Inspekcji, Paska Dolnego i Tabeli Porównawczej):
 */
export const ROOMS_SPEC = [
  // ======================== PIĘTRO -1 (PODZIEMIE) ========================
  {
    id: 'b-boiler',
    code: 'P-1.01',
    name: 'Pomieszczenie gospodarcze (Kotłownia)',
    floorKey: 'basement',
    floorLabel: 'Podziemie (-2,52 m / Y = -0,92 m)',
    area1955: 8.60,
    area1966: 8.66,
    area2026: 8.40,
    dimsClear: '2,80 × 3,09 m (h = 2,22 m)',
    elevationY: -0.92,
    floorFinish: 'Gładź cementowa na podkładzie betonowym',
    ceilingStruct: 'Strop Kleina (belki I NP 22/24 + płyta ceglana zbrojona)',
    description:
      'Kotłownia w południowo-wschodnim narożniku podziemia przy pionie kominowym (przewód C.O. 25×50 cm wg protokołu kominiarskiego z 1965 r.). Mieści zabytkowy kocioł żeliwny w obmurowaniu ceglanym oraz współczesny kocioł kondensacyjny Vaillant ecoTEC.',
    bounds: { xMin: 2.12, xMax: 5.00, yMin: -0.92, yMax: 1.28, zMin: -2.45, zMax: -0.45 },
    lookAt: { x: 3.55, y: 0.15, z: -1.45 },
    camOffset: { x: 2.3, y: 1.2, z: -2.1 },
  },
  {
    id: 'b-garage-front',
    code: 'P-1.02',
    name: 'Garaż I (Frontowy z wjazdem z ulicy)',
    floorKey: 'basement',
    floorLabel: 'Podziemie (-2,52 m / Y = -0,92 m)',
    area1955: 20.00,
    area1966: 19.95,
    area2026: 19.90,
    dimsClear: '3,30 × 6,05 m (h = 2,22 m)',
    elevationY: -0.92,
    floorFinish: 'Posadzka betonowa zacierana na gładko ze spadkiem ku bramie',
    ceilingStruct: 'Strop Kleina (I NP 22/24) + nadproże wjazdu 2 × I NP 16',
    description:
      'Garaż frontowy dostępny bezpośrednio z ulicy frontowej poprzez 5-metrowy pochylony zjazd (ZJAZD) i bramę dwuskrzydłową 2,10 × 2,00 m. W głębi przejście pod żelbetowym biegiem schodowym (1,65 m²) oraz szerokie wrota do garażu ogrodowego.',
    bounds: { xMin: -0.95, xMax: 5.00, yMin: -0.92, yMax: 1.28, zMin: -5.60, zMax: -2.45 },
    lookAt: { x: 2.2, y: 0.2, z: -4.1 },
    camOffset: { x: 4.5, y: 1.3, z: -4.1 },
  },
  {
    id: 'b-garage-rear',
    code: 'P-1.03',
    name: 'Garaż II (Zachodni + pod werandą)',
    floorKey: 'basement',
    floorLabel: 'Podziemie (-2,52 m / Y = -0,92 m)',
    area1955: 22.00,
    area1966: 33.54, // 21.06 m² (pod salonem) + 12.48 m² (pod werandą)
    area2026: 20.60,
    dimsClear: '5,40 × 3,90 m + 5,20 × 2,40 m (h = 2,22 m)',
    elevationY: -0.92,
    floorFinish: 'Posadzka cementowa na chudym betonie',
    ceilingStruct: 'Strop Kleina (belki I NP 24 w rozstawie co 1,20–1,25 m)',
    description:
      'Rozległa przestrzeń pod salonem (21,06 m² w inwent. 1966 r. / 20,6 m² w pomiarze Skan 3D) połączona z dodatkowym pomieszczeniem pod werandą (12,48 m²), doświetlona okienkami piwnicznymi w elewacji północnej i zachodniej.',
    bounds: { xMin: -7.90, xMax: -1.15, yMin: -0.92, yMax: 1.28, zMin: -5.60, zMax: -0.45 },
    lookAt: { x: -3.5, y: 0.2, z: -3.0 },
    camOffset: { x: -1.5, y: 1.3, z: -4.5 },
  },

  // ======================== PIĘTRO 0 (PARTER) ========================
  {
    id: 'g-vestibule',
    code: 'P0.01',
    name: 'Wejście / Przedsionek (Wiatrołap)',
    floorKey: 'groundFloor',
    floorLabel: 'Parter (±0,00 = Y +1,60 m)',
    area1955: 1.50,
    area1966: 1.40,
    area2026: 1.40,
    dimsClear: '1,20 × 1,17 m (h = 2,80 m)',
    elevationY: 1.60,
    floorFinish: 'Lastriko / terakota mrozoodporna',
    ceilingStruct: 'Płyta stropowa nad sienią wejściową',
    description:
      'Wejście główne w elewacji północnej poprzedzone 9 stopniami zewnętrznymi z lastriko oraz podestem pod zadaszeniem gankowym krytym dachówką karpiówką.',
    bounds: { xMin: -0.25, xMax: 1.15, yMin: 1.60, yMax: 4.35, zMin: -6.40, zMax: -4.90 },
    lookAt: { x: 0.45, y: 2.6, z: -5.6 },
    camOffset: { x: 0.45, y: 3.1, z: -8.2 },
  },
  {
    id: 'g-hall',
    code: 'P0.02',
    name: 'Korytarz / Hol ze schodami zabiegowymi',
    floorKey: 'groundFloor',
    floorLabel: 'Parter (±0,00 = Y +1,60 m)',
    area1955: 8.70,
    area1966: 7.37,
    area2026: 8.50,
    dimsClear: '2,80 × 2,43 m + bieg schodów (h = 2,80 m)',
    elevationY: 1.60,
    floorFinish: 'Klepka dębowa / wykładzina na podkładzie drewnianym, ściany w boazerii',
    ceilingStruct: 'Strop Kleina z wymianem stalowym I NP 14 wokół otworu schodowego',
    description:
      'Centralny węzeł komunikacyjny domu wykończony pionową boazerią drewnianą. Stąd wznoszą się reprezentacyjne dębowe schody zabiegowe (18 stopni) na I piętro oraz otwiera się przeszklony dwuskrzydłowy portal do salonu.',
    bounds: { xMin: -0.95, xMax: 2.05, yMin: 1.60, yMax: 4.35, zMin: -4.90, zMax: -0.45 },
    lookAt: { x: 0.5, y: 2.7, z: -2.6 },
    camOffset: { x: 0.4, y: 3.0, z: -4.7 },
  },
  {
    id: 'g-wc',
    code: 'P0.03',
    name: 'Toaleta / WC parteru',
    floorKey: 'groundFloor',
    floorLabel: 'Parter (±0,00 = Y +1,60 m)',
    area1955: 0.94,
    area1966: 0.95,
    area2026: 1.00,
    dimsClear: '1,10 × 0,90 m (h = 2,80 m)',
    elevationY: 1.60,
    floorFinish: 'Lastriko / drobna terakota ceramiczna',
    ceilingStruct: 'Strop Kleina (I NP 18)',
    description:
      'Kompaktowa toaleta parteru zlokalizowana przy ścianie kominowej pomiędzy kuchnią a klatką schodową, z pionem wentylacyjnym w ścianie dylatacyjnej.',
    bounds: { xMin: 1.00, xMax: 2.12, yMin: 1.60, yMax: 4.35, zMin: -1.75, zMax: -0.45 },
    lookAt: { x: 1.55, y: 2.5, z: -1.1 },
    camOffset: { x: 1.55, y: 3.2, z: -3.0 },
  },
  {
    id: 'g-kitchen',
    code: 'P0.04',
    name: 'Kuchnia (Trakt wschodni / od ulicy)',
    floorKey: 'groundFloor',
    floorLabel: 'Parter (±0,00 = Y +1,60 m)',
    area1955: 5.80,
    area1966: 5.81,
    area2026: 6.30,
    dimsClear: '2,84 × 2,30 m (h = 2,80 m)',
    elevationY: 1.60,
    floorFinish: 'Posadzka z lastriko / ksylolitu (wg opisu 1955 r.), fartuch z glazury do 1,60 m',
    ceilingStruct: 'Strop Kleina (belki I NP 22/24)',
    description:
      'Widna kuchnia od strony ulicy frontowej (wschodniej) z oknem dwudzielnym 90 × 150 cm, podłączona do głównego trzonu kominowego i wentylacyjnego w ścianie południowej.',
    bounds: { xMin: 2.12, xMax: 5.12, yMin: 1.60, yMax: 4.35, zMin: -2.45, zMax: -0.45 },
    lookAt: { x: 3.6, y: 2.6, z: -1.4 },
    camOffset: { x: 2.2, y: 3.0, z: -2.1 },
  },
  {
    id: 'g-study',
    code: 'P0.05',
    name: 'Sypialnia / Gabinet frontowy',
    floorKey: 'groundFloor',
    floorLabel: 'Parter (±0,00 = Y +1,60 m)',
    area1955: 12.85,
    area1966: 12.32,
    area2026: 12.80,
    dimsClear: '4,00 × 3,13 m (h = 2,80 m)',
    elevationY: 1.60,
    floorFinish: 'Klepka dębowa w jodełkę na ślepej podłodze',
    ceilingStruct: 'Strop Kleina (belki I NP 22/24)',
    description:
      'Narożny pokój północno-wschodni (gabinet lub sypialnia gościnna) doświetlony z dwóch stron: dużym oknem od ulicy frontowej (wschód) oraz oknem od strony wejścia (północ).',
    bounds: { xMin: 1.12, xMax: 5.12, yMin: 1.60, yMax: 4.35, zMin: -5.70, zMax: -2.45 },
    lookAt: { x: 3.1, y: 2.6, z: -4.1 },
    camOffset: { x: 1.6, y: 3.0, z: -3.2 },
  },
  {
    id: 'g-salon',
    code: 'P0.06',
    name: 'Salon (Pokój dzienny ogrodowy)',
    floorKey: 'groundFloor',
    floorLabel: 'Parter (±0,00 = Y +1,60 m)',
    area1955: 22.00,
    area1966: 21.96,
    area2026: 21.80,
    dimsClear: '5,56 × 3,95 m (h = 2,80 m)',
    elevationY: 1.60,
    floorFinish: 'Klepka dębowa układana w klasyczną jodełkę na lepiku i ślepej podłodze',
    ceilingStruct: 'Strop Kleina (belki PN 24 w rozstawie co 1,25 m)',
    description:
      'Reprezentacyjny salon zajmujący całą szerokość traktu zachodniego korpusu głównego (5,56 m). Posiada szerokie dwuskrzydłowe drzwi przeszklone z korytarza, okno północne 150 × 155 cm oraz przeszklone przejście i wewnętrzne okno na słoneczną werandę ogrodową.',
    bounds: { xMin: -5.15, xMax: -1.20, yMin: 1.60, yMax: 4.35, zMin: -5.70, zMax: -0.45 },
    lookAt: { x: -3.2, y: 2.6, z: -3.0 },
    camOffset: { x: -1.4, y: 3.0, z: -4.6 },
  },
  {
    id: 'g-veranda',
    code: 'P0.07',
    name: 'Weranda / Jadalnia ogrodowa',
    floorKey: 'groundFloor',
    floorLabel: 'Parter (±0,00 = Y +1,60 m)',
    area1955: 8.17, // W 1955 r. otwarty taras ogrodowy 4.085 × 2.00 m
    area1966: 13.50,
    area2026: 14.20,
    dimsClear: '5,56 × 2,43 m (h = 2,75 m)',
    elevationY: 1.60,
    floorFinish: 'Wzorzysta mozaika / terakota ceramiczna wielobarwna',
    ceilingStruct: 'Strop Kleina (belki PN 24 co 1,20 m) pełniący funkcję płyty tarasu I piętra',
    description:
      'Dobudowana i zalegalizowana w operacie inwentaryzacyjnym z 7 marca 1966 r. przeszklona weranda (obecnie jadalnia letnia). Od zachodu i północy duże okna panoramiczne oplecione pnączami winorośli oraz wyjście po ceglano-terakotowych schodach do ogrodu.',
    bounds: { xMin: -7.95, xMax: -5.50, yMin: 1.60, yMax: 4.35, zMin: -5.75, zMax: -0.45 },
    lookAt: { x: -6.7, y: 2.6, z: -3.0 },
    camOffset: { x: -5.4, y: 3.0, z: -4.8 },
  },

  // ======================== PIĘTRO 1 (I PIĘTRO) ========================
  {
    id: 'f1-landing',
    code: 'P1.01',
    name: 'Półpiętro / Hol I piętra',
    floorKey: 'firstFloor',
    floorLabel: 'I Piętro (+3,10 m = Y +4,70 m)',
    area1955: 3.60,
    area1966: 3.85,
    area2026: 4.20,
    dimsClear: '2,82 × 1,50 m (h = 2,58 m)',
    elevationY: 4.70,
    floorFinish: 'Klepka dębowa / wykładzina dywanowa, boazeria drewniana klatki',
    ceilingStruct: 'Strop Kleina nad I piętrem (I NP 16 + wymian I NP 14)',
    description:
      'Hol komunikacyjny I piętra łączący obie sypialnie, łazienkę i osobne WC, z drewnianym biegiem schodów prowadzącym wyżej na poddasze użytkowe.',
    bounds: { xMin: -0.95, xMax: 2.05, yMin: 4.70, yMax: 7.25, zMin: -4.20, zMax: -0.45 },
    lookAt: { x: 0.4, y: 5.7, z: -2.5 },
    camOffset: { x: 0.4, y: 6.0, z: -4.0 },
  },
  {
    id: 'f1-wc',
    code: 'P1.02',
    name: 'Toaleta / WC I piętra',
    floorKey: 'firstFloor',
    floorLabel: 'I Piętro (+3,10 m = Y +4,70 m)',
    area1955: 0.94,
    area1966: 0.90,
    area2026: 0.90,
    dimsClear: '1,00 × 0,90 m (h = 2,58 m)',
    elevationY: 4.70,
    floorFinish: 'Mozaika ceramiczna',
    ceilingStruct: 'Strop Kleina (I NP 16)',
    description:
      'Wydzielone WC na I piętrze bezpośrednio nad toaletą parteru, w sąsiedztwie pionu kanalizacyjnego i wentylacyjnego.',
    bounds: { xMin: 1.00, xMax: 2.12, yMin: 4.70, yMax: 7.25, zMin: -1.75, zMax: -0.45 },
    lookAt: { x: 1.55, y: 5.7, z: -1.1 },
    camOffset: { x: 1.55, y: 6.2, z: -2.8 },
  },
  {
    id: 'f1-bathroom',
    code: 'P1.03',
    name: 'Łazienka (Trakt wschodni)',
    floorKey: 'firstFloor',
    floorLabel: 'I Piętro (+3,10 m = Y +4,70 m)',
    area1955: 4.38,
    area1966: 5.05,
    area2026: 5.40,
    dimsClear: '2,90 × 1,85 m (h = 2,58 m)',
    elevationY: 4.70,
    floorFinish: 'Drobna mozaika ceramiczna wielobarwna, glazura ścienna ze wzorem rozetowym',
    ceilingStruct: 'Strop Kleina (I NP 22, ocieplenie gliną z sieczką 10 cm)',
    description:
      'Widna łazienka z oknem wschodnim 90 × 155 cm, wyposażona w wannę w obudowie ceramicznej, umywalkę oraz gazowy piecyk kąpielowy włączony do przewodu spalinowego z nasadą nieruchomą.',
    bounds: { xMin: 2.12, xMax: 5.12, yMin: 4.70, yMax: 7.25, zMin: -2.35, zMax: -0.45 },
    lookAt: { x: 3.6, y: 5.7, z: -1.4 },
    camOffset: { x: 2.3, y: 6.0, z: -2.1 },
  },
  {
    id: 'f1-bed-front',
    code: 'P1.04',
    name: 'Sypialnia II (Wschodnia / od ulicy)',
    floorKey: 'firstFloor',
    floorLabel: 'I Piętro (+3,10 m = Y +4,70 m)',
    area1955: 16.85,
    area1966: 16.70,
    area2026: 16.90,
    dimsClear: '5,07 × 3,30 m w układzie L (h = 2,58 m)',
    elevationY: 4.70,
    floorFinish: 'Klepka dębowa w jodełkę',
    ceilingStruct: 'Strop Kleina (I NP 22 co 1,00–1,25 m)',
    description:
      'Przestronna sypialnia narożna od strony wschodniej i północnej (16,70 m² w inwent. 1966 r. / 16,9 m² wg Skan 3D), doświetlona dwoma dużymi oknami ze szprosami.',
    bounds: { xMin: 0.05, xMax: 5.12, yMin: 4.70, yMax: 7.25, zMin: -5.70, zMax: -2.35 },
    lookAt: { x: 2.8, y: 5.7, z: -4.1 },
    camOffset: { x: 1.0, y: 6.1, z: -3.2 },
  },
  {
    id: 'f1-bed-master',
    code: 'P1.05',
    name: 'Sypialnia Główna (Zachodnia z wyjściem na taras)',
    floorKey: 'firstFloor',
    floorLabel: 'I Piętro (+3,10 m = Y +4,70 m)',
    area1955: 24.74,
    area1966: 25.58,
    area2026: 24.40,
    dimsClear: '5,60 × 4,55 m (h = 2,58 m)',
    elevationY: 4.70,
    floorFinish: 'Klepka dębowa układana w jodełkę',
    ceilingStruct: 'Strop Kleina (belki PN 24, nadproża 2 × I NP 14 nad portfenetrem)',
    description:
      'Największa sypialnia w budynku (25,58 m² w operacie 1966 r. / 24,4 m² z szafą wnękową w pomiarze 2026 r.) z oknem północnym i dwuskrzydłowym portfenetrem balkonowym 150 × 200 cm prowadzącym na taras nad werandą.',
    bounds: { xMin: -5.15, xMax: -0.95, yMin: 4.70, yMax: 7.25, zMin: -5.70, zMax: -0.45 },
    lookAt: { x: -3.1, y: 5.7, z: -3.0 },
    camOffset: { x: -1.3, y: 6.1, z: -4.5 },
  },
  {
    id: 'f1-terrace',
    code: 'P1.06',
    name: 'Taras ogrodowy nad werandą',
    floorKey: 'firstFloor',
    floorLabel: 'I Piętro (+3,10 m = Y +4,70 m)',
    area1955: 8.17,
    area1966: 15.40,
    area2026: 15.90,
    dimsClear: '5,60 × 2,75 m (otwarty)',
    elevationY: 4.70,
    floorFinish: 'Płytki tarasowe mrozoodporne na izolacji z papy na lepiku, obróbki cynkowe',
    ceilingStruct: 'Przestrzeń otwarta z pergolą i balustradą stalową oplecioną winoroślą',
    description:
      'Słoneczny taras zachodni o powierzchni 15,9 m² zlokalizowany bezpośrednio nad werandą parteru, z widokiem na starodrzew ogrodu ogrodu i białym żeliwnym zestawem wypoczynkowym.',
    bounds: { xMin: -8.20, xMax: -5.50, yMin: 4.70, yMax: 6.80, zMin: -5.95, zMax: -0.25 },
    lookAt: { x: -6.8, y: 5.6, z: -3.0 },
    camOffset: { x: -8.8, y: 6.5, z: -5.2 },
  },

  // ======================== PIĘTRO 2 (PODDASZE / STRYCH) ========================
  {
    id: 'a-main',
    code: 'P2.01',
    name: 'Poddasze główne (Strych wschodni i południowy)',
    floorKey: 'atticWalls',
    floorLabel: 'Poddasze (+5,95 m = Y +7,55 m)',
    area1955: 35.00,
    area1966: 37.00,
    area2026: 37.00,
    dimsClear: 'Układ L pod więźbą stolcowo-kleszczową (h w kalenicy = 2,70 m)',
    elevationY: 7.55,
    floorFinish: 'Deski podłogowe sosnowe na ociepleniu z gliny z sieczką (10 cm) i polepie',
    ceilingStruct: 'Więźba stolcowo-kleszczowa (krokwie 8×16, płatwie 12×18, kleszcze 2×5×14 cm)',
    description:
      'Główna przestrzeń poddasza (37,0 m² pow. podłogi w pomiarze Skan 3D) doświetlona lukarną wschodnią (od ulicy frontowej) i północną, z wyeksponowanym otynkowanym („rapowanym”) trzonem kominowym.',
    bounds: { xMin: -5.00, xMax: 5.00, yMin: 7.55, yMax: 10.10, zMin: -5.50, zMax: -0.45 },
    lookAt: { x: 1.8, y: 8.5, z: -2.8 },
    camOffset: { x: 3.4, y: 8.8, z: -4.2 },
  },
  {
    id: 'a-room-west',
    code: 'P2.02',
    name: 'Pokój na poddaszu (Zachodni)',
    floorKey: 'atticWalls',
    floorLabel: 'Poddasze (+5,95 m = Y +7,55 m)',
    area1955: 12.50,
    area1966: 13.00,
    area2026: 13.00,
    dimsClear: '3,80 × 3,42 m (h = 2,50 m w kalenicy)',
    elevationY: 7.55,
    floorFinish: 'Deski drewniane na legarach',
    ceilingStruct: 'Więźba dachowa + lukarna zachodnia od strony ogrodu',
    description:
      'Wydzielony ściankami działowymi pokój poddaszowy od strony ogrodu (13,0 m² wg pomiaru Skan 3D), doświetlony lukarną pulpitową w połaci zachodniej.',
    bounds: { xMin: -5.00, xMax: -1.10, yMin: 7.55, yMax: 9.80, zMin: -5.50, zMax: -2.10 },
    lookAt: { x: -3.0, y: 8.5, z: -3.8 },
    camOffset: { x: -1.5, y: 8.8, z: -3.8 },
  },
];

/**
 * Choreografia waypointów dla Trybu Autopilota [P]:
 * Prowadzi awatara od ulicy frontowej, po schodach wejściowych, przez hol, salon, werandę,
 * po dębowych schodach zabiegowych na I piętro, sypialnię główną, taras i na poddasze!
 */
export const AUTOPILOT_WAYPOINTS = [
  { x: 12.2,  y: 0.00, z: -6.8,  label: 'Ulica frontowa – przedogródek i brama wejściowa' },
  { x: 6.2,   y: 0.00, z: -6.8,  label: 'Ścieżka przy wejściu północnym (+0.00 m)' },
  { x: 2.8,   y: 0.80, z: -6.7,  label: 'Schody wejściowe z lastriko (bieg zewnętrzny)' },
  { x: 0.45,  y: 1.60, z: -6.4,  label: 'Podest ganku wejściowego (±0.00 = +1.60 m)' },
  { x: 0.25,  y: 1.60, z: -4.2,  label: 'Korytarz parteru (boazeria i schody dębowe)' },
  { x: 2.9,   y: 1.60, z: -4.0,  label: 'Pokój frontowy / Gabinet (12,8 m²)' },
  { x: 0.1,   y: 1.60, z: -3.5,  label: 'Przejście przez dwuskrzydłowy portal do Salonu' },
  { x: -3.0,  y: 1.60, z: -3.2,  label: 'Salon ogrodowy (21,96 m², klepka w jodełkę)' },
  { x: -6.6,  y: 1.60, z: -3.2,  label: 'Weranda / Jadalnia ogrodowa z 1966 r. (14,2 m²)' },
  { x: -2.8,  y: 1.60, z: -3.2,  label: 'Powrót przez Salon do klatki schodowej' },
  { x: -0.46, y: 1.65, z: -2.85, label: 'Wejście na dolny bieg schodów zabiegowych (wzdłuż Salonu)' },
  { x: -0.46, y: 2.80, z: -1.35, label: 'Góra dolnego biegu przy słupie centralnym' },
  { x: 0.02,  y: 3.55, z: -0.78, label: 'Zabieg wachlarzowy 180° przy ścianie południowej' },
  { x: 0.50,  y: 4.25, z: -1.35, label: 'Wyjście z zabiegu wachlarzowego na Półpiętro' },
  { x: 0.50,  y: 4.70, z: -2.40, label: 'Półpiętro I piętra (+3.10 m = Y +4.70 m)' },
  { x: -3.0,  y: 4.70, z: -3.0,  label: 'Sypialnia główna I piętra (25,58 m²)' },
  { x: -6.7,  y: 4.70, z: -3.0,  label: 'Taras ogrodowy nad werandą (15,9 m²)' },
  { x: -2.5,  y: 4.70, z: -3.0,  label: 'Powrót z tarasu do holu I piętra' },
  { x: -0.46, y: 4.75, z: -2.85, label: 'Wejście na schody strychowe (wzdłuż ściany zachodniej)' },
  { x: 0.02,  y: 6.35, z: -0.78, label: 'Zabieg wachlarzowy 180° schodów na poddasze' },
  { x: 0.50,  y: 7.55, z: -2.40, label: 'Poddasze (+5.95 m = Y +7.55 m) – więźba stolcowo-kleszczowa' },
  { x: -2.8,  y: 7.55, z: -3.6,  label: 'Pokój na poddaszu przy lukarnie zachodniej (13 m²)' },
];
