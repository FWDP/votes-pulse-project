import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface RawPsgcNode {
  name: string
  type: string
  psgc_id: string
  parent_psgc_id: string
}

interface District {
  id: string
  electionYear: number
  status: string
  jurisdiction: { code: string | null } | null
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../..')
const outputPath = resolve(
  repositoryRoot,
  'backend/src/data/normalized/legislative-district-subdivisions-2025.json',
)
const districtPath = resolve(
  repositoryRoot,
  'backend/src/data/normalized/legislative-districts-2025.json',
)

const PINNED_PSGC_ARCHIVE_URL =
  'https://files.pythonhosted.org/packages/1d/28/a67fa13061700f7a3c3f24012b0e15c229a6fc2141006355465e74ad968f/barangay-2025.7.31.1.tar.gz'
const PINNED_PSGC_ARCHIVE_SHA256 =
  'aa0b0a18b1ce114cca4a32374c885a115879b6abd4b6b99b57ab7df7d384543f'
const PINNED_PSGC_ARCHIVE_ENTRY =
  'barangay-2025.7.31.1/barangay/data/2025-07-08/barangay_flat.json'
const cachedPsgcPath = resolve(
  repositoryRoot,
  'data/cache/psgc-2025-07-08/barangay_flat.json',
)

const fetchPinnedPsgcReference = async () => {
  const response = await fetch(PINNED_PSGC_ARCHIVE_URL, {
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    throw new Error(
      `Unable to download pinned PSGC reference: HTTP ${response.status}. ` +
      'Pass --psgc /path/to/barangay_flat.json to use a local copy.',
    )
  }

  const archive = Buffer.from(await response.arrayBuffer())
  const checksum = createHash('sha256').update(archive).digest('hex')

  if (checksum !== PINNED_PSGC_ARCHIVE_SHA256) {
    throw new Error(
      `Pinned PSGC archive checksum mismatch: expected ${PINNED_PSGC_ARCHIVE_SHA256}, received ${checksum}.`,
    )
  }

  const archivePath = resolve(
    tmpdir(),
    `votes-pulse-barangay-2025.7.31.1-${process.pid}.tar.gz`,
  )

  writeFileSync(archivePath, archive)

  try {
    const extracted = spawnSync(
      'tar',
      ['-xOzf', archivePath, PINNED_PSGC_ARCHIVE_ENTRY],
      {
        encoding: null,
        maxBuffer: 16 * 1024 * 1024,
      },
    )

    if (extracted.error || extracted.status !== 0 || !extracted.stdout?.length) {
      const reason = extracted.error?.message ??
        extracted.stderr?.toString('utf8').trim() ??
        `tar exited with status ${extracted.status}`
      throw new Error(`Unable to extract pinned PSGC reference: ${reason}`)
    }

    mkdirSync(dirname(cachedPsgcPath), { recursive: true })
    writeFileSync(cachedPsgcPath, extracted.stdout)
  } finally {
    rmSync(archivePath, { force: true })
  }

  console.log(`Cached pinned PSGC reference at ${cachedPsgcPath}`)
}

const psgcArgumentIndex = process.argv.indexOf('--psgc')
let psgcPath = psgcArgumentIndex >= 0
  ? process.argv[psgcArgumentIndex + 1]
  : process.env.PSGC_BARANGAY_FLAT_PATH || cachedPsgcPath

if (!psgcPath) {
  throw new Error(
    'Pass --psgc with the barangay_flat.json file from barangay 2025.7.31.1.',
  )
}

if (!existsSync(resolve(psgcPath))) {
  if (psgcArgumentIndex >= 0 || process.env.PSGC_BARANGAY_FLAT_PATH) {
    throw new Error(`PSGC reference file does not exist: ${resolve(psgcPath)}`)
  }

  await fetchPinnedPsgcReference()
  psgcPath = cachedPsgcPath
}

const QUEZON_CITY_CODE = '1381300000'
const QUEZON_CITY_DISTRICTS: Record<string, string[]> = {
  'ld-2025-1381300000-1': [
    'Alicia', 'Bagong Pag-asa', 'Bahay Toro', 'Balingasa', 'Bungad', 'Damar',
    'Damayan', 'Del Monte', 'Katipunan', 'Lourdes', 'Maharlika', 'Manresa',
    'Mariblo', 'Masambong', 'N.S. Amoranto', 'Nayong Kanluran', 'Paang Bundok',
    'Pag-ibig sa Nayon', 'Paltok', 'Paraiso', 'Phil-am', 'Project 6',
    'Ramon Magsaysay', 'Salvacion', 'San Antonio', 'San Isidro Labrador',
    'San Jose', 'Siena', 'St. Peter', 'Sta. Cruz', 'Sta. Teresita',
    'Sto. Cristo', 'Sto. Domingo', 'Talayan', 'Vasra', 'Veterans Village',
    'West Triangle',
  ],
  'ld-2025-1381300000-2': [
    'Bagong Silangan', 'Batasan Hills', 'Commonwealth', 'Holy Spirit', 'Payatas',
  ],
  'ld-2025-1381300000-3': [
    'Amihan', 'Bagumbayan', 'Bagumbuhay', 'Bayanihan', 'Blue Ridge A',
    'Blue Ridge B', 'Camp Aguinaldo', 'Dioquino Zobel', 'Duyan-Duyan',
    'E. Rodriguez', 'East Kamias', 'Escopa I', 'Escopa II', 'Escopa III',
    'Escopa IV', 'Libis', 'Loyola Heights', 'Mangga', 'Marilag', 'Masagana',
    'Matandang Balara', 'Milagrosa', 'Pansol', 'Quirino 2-A', 'Quirino 2-B',
    'Quirino 2-C', 'Quirino 3-A', 'Quirino 3-B (Claro)', 'San Roque',
    'Silangan', 'Socorro', 'St. Ignatius', 'Tagumpay', 'Ugong Norte',
    'Villa Maria Clara', 'West Kamias', 'White Plains',
  ],
  'ld-2025-1381300000-4': [
    'Bagong Lipunan ng Crame', 'Botocan', 'Central', 'Damayang Lagi',
    'Don Manuel', 'Doña Aurora', 'Doña Imelda', 'Doña Josefa', 'Horseshoe',
    'Immaculate Concepcion', 'Kalusugan', 'Kamuning', 'Kaunlaran',
    'Kristong Hari', 'Krus na Ligas', 'Laging Handa', 'Malaya', 'Mariana',
    'Obrero', 'Old Capitol Site', 'Paligsahan', 'Pinagkaisahan', 'Pinyahan',
    'Roxas', 'Sacred Heart', 'San Isidro Galas', 'San Martin de Porres',
    'San Vicente', 'Santol', 'Sikatuna Village', 'South Triangle', 'Sto. Niño',
    'Tatalon', 'Teachers’ Village East', 'Teachers’ Village West', 'UP Campus',
    'UP Village', 'Valencia',
  ],
  'ld-2025-1381300000-5': [
    'Bagbag', 'Capri', 'Fairview', 'Greater Lagro', 'Gulod', 'Kaligayahan',
    'Nagkaisang Nayon', 'North Fairview', 'Novaliches Proper',
    'Pasong Putik Proper', 'San Agustin', 'San Bartolome', 'Sta. Lucia',
    'Sta. Monica',
  ],
  'ld-2025-1381300000-6': [
    'Apolonio Samson', 'Baesa', 'Balon Bato', 'Culiat', 'New Era',
    'Pasong Tamo', 'Sangandaan', 'Sauyo', 'Talipapa', 'Tandang Sora',
    'Unang Sigaw',
  ],
}

const NAMED_DISTRICTS: Record<string, { localityCode: string; names: string[] }> = {
  ...Object.fromEntries(Object.entries(QUEZON_CITY_DISTRICTS).map(
    ([id, names]) => [id, { localityCode: QUEZON_CITY_CODE, names }],
  )),
  'ld-2025-1380300000-1': {
    localityCode: '1380300000',
    names: [
      'Bangkal', 'Bel-Air', 'Carmona', 'Dasmariñas', 'Forbes Park', 'Kasilawan',
      'La Paz', 'Magallanes', 'Olympia', 'Palanan', 'Pio del Pilar', 'Poblacion',
      'San Antonio', 'San Isidro', 'San Lorenzo', 'Santa Cruz', 'Singkamas',
      'Tejeros', 'Urdaneta', 'Valenzuela',
    ],
  },
  'ld-2025-1380300000-2': {
    localityCode: '1380300000',
    names: ['Guadalupe Nuevo', 'Guadalupe Viejo', 'Pinagkaisahan'],
  },
  'ld-2025-1381000000-1': {
    localityCode: '1381000000',
    names: [
      'Baclaran', 'Tambo', 'Vitalez', 'Santo Niño', 'Don Galo', 'La Huerta',
      'San Dionisio', 'San Isidro',
    ],
  },
  'ld-2025-1381000000-2': {
    localityCode: '1381000000',
    names: [
      'BF Homes', 'San Antonio', 'Sun Valley', 'San Martin de Porres',
      'Don Bosco', 'Merville', 'Marcelo Green Village', 'Moonwalk',
    ],
  },
  'ld-2025-1381600000-1': {
    localityCode: '1381600000',
    names: [
      'Arkong Bato', 'Balangkas', 'Bignay', 'Bisig', 'Canumay East',
      'Canumay West', 'Coloong', 'Dalandanan', 'Isla', 'Lawang Bato',
      'Lingunan', 'Mabolo', 'Malanday', 'Malinta', 'Palasan',
      'Pariancillo Villa', 'Pasolo', 'Poblacion', 'Polo', 'Punturin', 'Rincon',
      'Tagalag', 'Veinte Reales', 'Wawang Pulo',
    ],
  },
  'ld-2025-1381600000-2': {
    localityCode: '1381600000',
    names: [
      'Bagbaguin', 'General T. De Leon', 'Karuhatan', 'Mapulang Lupa',
      'Marulas', 'Maysan', 'Parada', 'Paso de Blas', 'Ugong',
    ],
  },
  'ld-2025-1380700000-1': {
    localityCode: '1380700000',
    names: [
      'Santo Niño', 'Malanday', 'Santa Elena', 'San Roque', 'Calumpang',
      'Tañong', 'Barangka', 'Industrial Valley', 'Jesus de la Peña',
    ],
  },
  'ld-2025-1380700000-2': {
    localityCode: '1380700000',
    names: [
      'Nangka', 'Parang', 'Concepcion Uno', 'Concepcion Dos',
      'Marikina Heights', 'Fortune', 'Tumana',
    ],
  },
  'ld-2025-taguig-pateros-lone': {
    localityCode: '1381500000',
    names: [
      'Bagumbayan', 'Bambang', 'Calzada', 'Hagonoy', 'Ibayo-Tipas',
      'Ligid-Tipas', 'Lower Bicutan', 'New Lower Bicutan', 'Napindan',
      'Palingon', 'San Miguel', 'Santa Ana', 'Tuktukan', 'Ususan', 'Wawa',
      'Comembo', 'Pembo', 'Rizal',
    ],
  },
  'ld-2025-1381500000-lone': {
    localityCode: '1381500000',
    names: [
      'Central Bicutan', 'Central Signal Village', 'Fort Bonifacio', 'Katuparan',
      'Maharlika Village', 'North Daang Hari', 'North Signal Village',
      'Pinagsama', 'South Daang Hari', 'South Signal Village', 'Tanyag',
      'Upper Bicutan', 'Western Bicutan', 'Cembo', 'East Rembo', 'Pitogo',
      'Post Proper Northside', 'Post Proper Southside', 'South Cembo',
      'West Rembo',
    ],
  },
  'ld-2025-0405802000-1': {
    localityCode: '0405802000',
    names: [
      'Bagong Nayon', 'Beverly Hills', 'Dela Paz', 'Mambugan', 'Mayamot',
      'Muntingdilaw', 'San Isidro', 'Santa Cruz',
    ],
  },
  'ld-2025-0405802000-2': {
    localityCode: '0405802000',
    names: ['Calawis', 'Cupang', 'Dalig', 'Inarawan', 'San Jose', 'San Juan', 'San Luis', 'San Roque'],
  },
  'ld-2025-0730600000-1': {
    localityCode: '0730600000',
    names: [
      'Adlaon', 'Agsungot', 'Apas', 'Bacayan', 'Banilad', 'Binaliw', 'Budlaan',
      'Busay', 'Cambinocot', 'Capitol Site', 'Carreta', 'Cogon Ramos', 'Day-as',
      'Ermita', 'Guba', 'Hipodromo', 'Kalubihan', 'Kamagayan', 'Camputhaw',
      'Kasambagan', 'Lahug', 'Lorega-San Miguel', 'Lusaran', 'Luz', 'Mabini',
      'Mabolo', 'Malubog', 'Pahina Central', 'Pari-an', 'Paril', 'Pit-os',
      'Pulangbato', 'Sambag I', 'Sambag II', 'San Antonio', 'San Jose',
      'San Roque', 'Santa Cruz', 'Central', 'Sirao', 'T. Padilla', 'Talamban',
      'Taptap', 'Tejero', 'Tinago', 'Zapatera',
    ],
  },
  'ld-2025-0730600000-2': {
    localityCode: '0730600000',
    names: [
      'Babag', 'Basak Pardo', 'Basak San Nicolas', 'Bonbon', 'Buhisan',
      'Bulacao', 'Buot-Taup', 'Calamba', 'Cogon Pardo', 'Duljo', 'Guadalupe',
      'Inayawan', 'Kalunasan', 'Kinasang-an Pardo', 'Labangon', 'Mambaling',
      'Pahina San Nicolas', 'Pamutan', 'Pasil', 'Poblacion Pardo',
      'Pung-ol-Sibugay', 'Punta Princesa', 'Quiot Pardo', 'San Nicolas Proper',
      'Sapangdaku', 'Sawang Calero', 'Sinsin', 'Suba', 'Sudlon I', 'Sudlon II',
      'Tabunan', 'Tagbao', 'Tisa', 'To-ong',
    ],
  },
  'ld-2025-0931700000-1': {
    localityCode: '0931700000',
    names: [
      'Ayala', 'Baliwasan', 'Baluno', 'Cabatangan', 'Camino Nuevo',
      'Campo Islam', 'Canelar', 'Capisan', 'Cawit', 'Dulian (Upper Pasonanca)',
      'La Paz', 'Labuan', 'Limpapa', 'Maasin', 'Malagutay', 'Mariki',
      'Pamucutan', 'Pasonanca', 'Patalon', 'Recodo', 'Rio Hondo',
      'San Jose Cawa-Cawa', 'San Jose Gusu', 'San Roque', 'Santa Barbara',
      'Santa Maria', 'Santo Niño', 'Sinubung', 'Sinunuc', 'Talisayan',
      'Tulungatung', 'Tumaga', 'Zone I', 'Zone II', 'Zone III', 'Zone IV',
      'Bagong Calarian',
    ],
  },
  'ld-2025-1030500000-1': {
    localityCode: '1030500000',
    names: [
      'Bonbon', 'Bayabas', 'Kauswagan', 'Carmen', 'Patag', 'Bulua', 'Iponan',
      'Baikingon', 'San Simon', 'Pagatpat', 'Canitoan', 'Balulang', 'Lumbia',
      'Pagalungan', 'Tagpangi', 'Taglimao', 'Tuburan', 'Pigsag-an', 'Tumpagon',
      'Bayanga', 'Mambuaya', 'Dansolihon', 'Tignapoloan', 'Besigan',
    ],
  },
  'ld-2025-1130700000-2': {
    localityCode: '1130700000',
    names: [
      'Acacia', 'Agdao Proper', 'Alejandra Navarro', 'Alfonso Angliongto Sr.',
      'Buhangin Proper', 'Bunawan Proper', 'Cabantian', 'Callawa', 'Centro',
      'Colosas', 'Communal', 'Gatungan', 'Fatima', 'Gov. Paciano Bangoy',
      'Gov. Vicente Duterte', 'Ilang', 'Indangan', 'Kap. Tomas Monteverde Sr.',
      'Lapu-Lapu', 'Leon Garcia', 'Lumiad', 'Mabuhay', 'Mahayag', 'Malabog',
      'Mandug', 'Mapula', 'Mudiang', 'Pampanga', 'Panacan', 'Panalum',
      'Pandaitan', 'Paquibato Proper', 'Paradise Embak', 'Rafael Castillo',
      'Salapawan', 'San Antonio', 'San Isidro', 'Sasa', 'Sumimao', 'Tapak',
      'Tibungco', 'Tigatto', 'Ubalde', 'Vicente Hizon Sr.', 'Waan',
      'Wilfredo Aquino',
    ],
  },
  'ld-2025-1130700000-3': {
    localityCode: '1130700000',
    names: [
      'Baguio Proper', 'Cadalian', 'Carmen', 'Gumalang', 'Malagos', 'Tambobong',
      'Tawan-Tawan', 'Wines', 'Biao Joaquin', 'Calinan Proper', 'Cawayan',
      'Dacudao', 'Dalagdag', 'Dominga', 'Inayangan', 'Lacson', 'Lamanan',
      'Lampianao', 'Megcawayan', 'Pangyan', 'Riverside', 'Saloy', 'Sirib',
      'Subasta', 'Talomo River', 'Tamayong', 'Wangan', 'Baganihan', 'Bantol',
      'Buda', 'Dalag', 'Datu Salumay', 'Gumitan', 'Magsaysay', 'Malamba',
      'Marilog Proper', 'Salaysay', 'Suawan', 'Tamugan', 'Alambre', 'Atan-Awe',
      'Bangkas Heights', 'Baracatan', 'Bato', 'Bayabas', 'Binugao', 'Camansi',
      'Catigan', 'Crossing Bayabas', 'Daliao', 'Daliaon Plantation', 'Eden',
      'Kilate', 'Lizada', 'Lubogan', 'Marapangi', 'Mulig', 'Sibulan', 'Sirawan',
      'Tagluno', 'Tagurano', 'Tibuloy', 'Toril Proper', 'Tungkalan', 'Angalan',
      'Bago Oshiro', 'Balengaeng', 'Biao Escuela', 'Biao Guianga', 'Los Amigos',
      'Manambulan', 'Manuel Guianga', 'Matina Biao', 'Mintal', 'New Carmen',
      'New Valencia', 'Santo Niño', 'Tacunan', 'Tagakpan', 'Talandang',
      'Tugbok Proper', 'Ula',
    ],
  },
}

const COMPLEMENT_DISTRICTS: Record<string, string> = {
  'ld-2025-0931700000-2': '0931700000',
  'ld-2025-1030500000-2': '1030500000',
  'ld-2025-1130700000-1': '1130700000',
}

const ASSIGNMENT_SOURCES: Record<string, { name: string; url: string }> = {
  '1380600000': {
    name: '1987 Constitution — Ordinance apportioning House seats',
    url: 'https://lawphil.net/consti/cons1987.html',
  },
  '1381300000': {
    name: 'Quezon City Government — Barangay Officials',
    url: 'https://quezoncity.gov.ph/quezon-city-barangay-officials/',
  },
  '1380100000': {
    name: 'Republic Act No. 11545',
    url: 'https://lawphil.net/statutes/repacts/ra2021/ra_11545_2021.html',
  },
  '1380300000': {
    name: 'Republic Act No. 7854 and COMELEC Resolution No. 11069',
    url: 'https://lawphil.net/administ/comelec/comres2024/comres_11069_2024.pdf',
  },
  '1381000000': {
    name: 'Republic Act No. 9229',
    url: 'https://lawphil.net/statutes/repacts/ra2003/ra_9229_2003.html',
  },
  '1381600000': {
    name: 'Valenzuela City Government — 3S Centers and Barangays',
    url: 'https://valenzuela.gov.ph/3s-centers-barangays/',
  },
  '1380700000': {
    name: 'City Government of Marikina — Our City',
    url: 'https://marikina.gov.ph/our-city',
  },
  '1381500000': {
    name: 'COMELEC Resolution No. 11069',
    url: 'https://lawphil.net/administ/comelec/comres2024/comres_11069_2024.pdf',
  },
  '0405802000': {
    name: 'Republic Act No. 9232',
    url: 'https://lawphil.net/statutes/repacts/ra2003/ra_9232_2003.html',
  },
  '0730600000': {
    name: 'COMELEC 2025 final testing and sealing list — Cebu',
    url: 'https://www.comelec.gov.ph/php-tpls-attachments/2025NLE/2025NLE_FTSLOCAL/REG7/CEBU.pdf',
  },
  '0931700000': {
    name: 'Republic Act No. 9269',
    url: 'https://lawphil.net/statutes/repacts/ra2004/ra_9269_2004.html',
  },
  '1030500000': {
    name: 'Republic Act No. 9371',
    url: 'https://lawphil.net/statutes/repacts/ra2007/ra_9371_2007.html',
  },
  '1130700000': {
    name: 'City Government of Davao — Updated Barangay Directory',
    url: 'https://davaocity.gov.ph/wp-content/uploads/2025/02/Updated-Barangay-Directory.pdf',
  },
}

const NAME_ALIASES: Record<string, string> = {
  'bagong calarian': 'calarian',
  'agdao proper': 'agdao',
  'baguio proper': 'baguio',
  'balon bato': 'balong bato',
  'bf homes': 'b f homes',
  'budlaan': 'budla an',
  'buot taup': 'buot taup pardo',
  'buhangin proper': 'buhangin',
  'bunawan proper': 'bunawan',
  'calinan proper': 'calinan',
  'canitoan': 'canito an',
  'dona aurora': 'aurora',
  'general t de leon': 'gen t de leon',
  'hipodromo': 'hippodromo',
  'leon garcia': 'leon garcia sr',
  'lorega san miguel': 'lorega',
  'marilog proper': 'marilog',
  'megcawayan': 'megkawayan',
  'paquibato proper': 'paquibato',
  'poblacion pardo': 'pardo',
  'polo': 'pulo',
  'quirino 3 b claro': 'claro',
  'san isidro galas': 'san isidro',
  'san nicolas proper': 'san nicolas central',
  'siena': 'sienna',
  'sinunuc': 'sinunoc',
  'st ignatius': 'saint ignatius',
  'st peter': 'saint peter',
  'suba': 'suba pob',
  'to ong': 'to ong pardo',
  'toril proper': 'toril',
  'tugbok proper': 'tugbok',
  'tungkalan': 'tungakalan',
  'up campus': 'u p campus',
  'up village': 'u p village',
  'veinte reales': 'viente reales',
  'zone i': 'barangay zone i',
  'zone ii': 'barangay zone ii',
  'zone iii': 'barangay zone iii',
  'zone iv': 'barangay zone iv',
}

const normalizeName = (value: string) => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
    .replace(/^sta\b/, 'santa')
    .replace(/^sto\b/, 'santo')
    .replace(/^st\b/, 'saint')

  return NAME_ALIASES[normalized] ?? normalized
}

const psgcNodes = JSON.parse(readFileSync(resolve(psgcPath), 'utf8')) as RawPsgcNode[]
const psgcByCode = new Map(psgcNodes.map(node => [node.psgc_id, node]))
const districts = (JSON.parse(readFileSync(districtPath, 'utf8')) as {
  data: District[]
}).data.filter(district => district.status === 'partial-boundary')

const isWithin = (node: RawPsgcNode, ancestorCode: string) => {
  let parentCode = node.parent_psgc_id
  const visited = new Set<string>()

  while (parentCode && !visited.has(parentCode)) {
    if (parentCode === ancestorCode) return true
    visited.add(parentCode)
    parentCode = psgcByCode.get(parentCode)?.parent_psgc_id ?? ''
  }

  return false
}

const barangaysByLocality = new Map<string, RawPsgcNode[]>()
const getBarangays = (localityCode: string) => {
  const cached = barangaysByLocality.get(localityCode)
  if (cached) return cached

  const barangays = psgcNodes.filter(node =>
    node.type === 'barangay' && isWithin(node, localityCode),
  )
  barangaysByLocality.set(localityCode, barangays)
  return barangays
}

const resolveNames = (localityCode: string, names: string[]) => {
  const barangayByName = new Map(
    getBarangays(localityCode).map(node => [normalizeName(node.name), node]),
  )

  return names.map(name => {
    const node = barangayByName.get(normalizeName(name))
    if (!node) {
      throw new Error(`Unable to resolve barangay in ${localityCode}: ${name}`)
    }
    return node
  })
}

const namedCodesByLocality = new Map<string, Set<string>>()
for (const definition of Object.values(NAMED_DISTRICTS)) {
  const codes = namedCodesByLocality.get(definition.localityCode) ?? new Set<string>()
  for (const node of resolveNames(definition.localityCode, definition.names)) {
    if (codes.has(node.psgc_id)) {
      throw new Error(`${node.name} is named in multiple districts for ${definition.localityCode}.`)
    }
    codes.add(node.psgc_id)
  }
  namedCodesByLocality.set(definition.localityCode, codes)
}

const barangayNumber = (node: RawPsgcNode) => {
  const match = node.name.match(/^Barangay\s+(\d+)(?:-[A-Z])?$/i)
  return match ? Number(match[1]) : undefined
}

const resolveSpecialDistrict = (districtId: string): {
  localityCode: string
  units: RawPsgcNode[]
} | undefined => {
  const manilaMatch = districtId.match(/^ld-2025-1380600000-([1-6])$/)
  if (manilaMatch) {
    const ordinal = Number(manilaMatch[1])
    return {
      localityCode: '1380600000',
      units: getBarangays('1380600000').filter(node => {
        const number = barangayNumber(node)
        if (number === undefined) return false
        if (ordinal === 1) return number >= 1 && number <= 146
        if (ordinal === 2) return number >= 147 && number <= 267
        if (ordinal === 3) return number >= 268 && number <= 394
        if (ordinal === 4) return number >= 395 && number <= 586
        if (ordinal === 5) return number >= 649 && number <= 828
        return (number >= 587 && number <= 648) ||
          (number >= 829 && number <= 905)
      }),
    }
  }

  const caloocanMatch = districtId.match(/^ld-2025-1380100000-([1-3])$/)
  if (caloocanMatch) {
    const ordinal = Number(caloocanMatch[1])
    return {
      localityCode: '1380100000',
      units: getBarangays('1380100000').filter(node => {
        const number = barangayNumber(node)
        if (number === undefined) return false
        if (ordinal === 1) {
          return (number >= 1 && number <= 4) ||
            (number >= 77 && number <= 85) ||
            (number >= 132 && number <= 177)
        }
        if (ordinal === 2) {
          return (number >= 5 && number <= 76) ||
            (number >= 86 && number <= 131)
        }
        return number >= 178 && number <= 188
      }),
    }
  }

  return undefined
}

const claimedCodes = new Set<string>()
const data = districts.map(district => {
  const named = NAMED_DISTRICTS[district.id]
  const complementLocalityCode = COMPLEMENT_DISTRICTS[district.id]
  const special = resolveSpecialDistrict(district.id)
  const localityCode = named?.localityCode ?? complementLocalityCode ?? special?.localityCode
  const resolvedUnits = named
    ? resolveNames(named.localityCode, named.names)
    : complementLocalityCode
      ? getBarangays(complementLocalityCode).filter(node =>
          !namedCodesByLocality.get(complementLocalityCode)?.has(node.psgc_id)
        )
      : special?.units

  if (!localityCode || !resolvedUnits || resolvedUnits.length === 0) {
    throw new Error(`No subdivision assignment configured for ${district.id}.`)
  }

  const units = resolvedUnits.map(node => {
    if (claimedCodes.has(node.psgc_id)) {
      throw new Error(`Barangay ${node.name} (${node.psgc_id}) is assigned twice.`)
    }
    claimedCodes.add(node.psgc_id)

    return {
      code: node.psgc_id,
      name: node.name,
      type: 'barangay',
      parentCode: node.parent_psgc_id,
    }
  }).sort((left, right) => left.name.localeCompare(right.name))

  return {
    legislativeDistrictId: district.id,
    electionYear: district.electionYear,
    membershipStatus: 'verified',
    units,
    sources: [
      {
        ...ASSIGNMENT_SOURCES[localityCode],
        role: 'legislative-district-assignment',
      },
      {
        name: 'PSGC Q2 2025 snapshot packaged by barangay 2025.7.31.1',
        url: 'https://pypi.org/project/barangay/2025.7.31.1/',
        role: 'unit-identity-and-hierarchy',
      },
    ],
  }
})

// A PSGC submunicipality is useful as a district-level unit only when all of
// its child barangays belong to the same legislative district. Manila's
// Tondo I/II, Sampaloc, Paco, and Santa Ana groupings cross district lines, so
// those remain represented by their individual barangays.
const districtByBarangayCode = new Map(
  data.flatMap(membership => membership.units.map(unit => [
    unit.code,
    membership,
  ] as const)),
)
for (const node of psgcNodes.filter(item => item.type === 'submunicipality')) {
  const childBarangays = psgcNodes.filter(item =>
    item.type === 'barangay' && item.parent_psgc_id === node.psgc_id,
  )
  const owners = new Set(
    childBarangays.map(item => districtByBarangayCode.get(item.psgc_id)),
  )

  if (childBarangays.length === 0 || owners.size !== 1) continue
  const [membership] = owners
  if (!membership) continue

  membership.units.push({
    code: node.psgc_id,
    name: node.name,
    type: 'submunicipality',
    parentCode: node.parent_psgc_id,
  })
  membership.units.sort((left, right) => left.name.localeCompare(right.name))
}

const splitLocalityCodes = new Set(
  districts.flatMap(district => district.jurisdiction?.code ? [district.jurisdiction.code] : [])
    .concat(['1381500000']),
)
const expectedBarangays = [...splitLocalityCodes].flatMap(getBarangays)
if (claimedCodes.size !== expectedBarangays.length) {
  const missing = expectedBarangays.filter(node => !claimedCodes.has(node.psgc_id))
  throw new Error(
    `Split-city coverage is incomplete: ${claimedCodes.size}/${expectedBarangays.length}; missing ${missing.map(node => `${node.parent_psgc_id}:${node.name}`).join(', ')}`,
  )
}

const dataset = {
  metadata: {
    datasetId: 'legislative-district-subdivisions-2025',
    electionYear: 2025,
    psgcReferenceDate: '2025-07-08',
    description:
      'Barangay and submunicipality membership for cities split across legislative districts.',
    notes: [
      'PSGC establishes unit identity and hierarchy; district assignment requires a separate official source.',
      'Every barangay in a city split across legislative districts is assigned exactly once.',
      'A submunicipality is assigned only when all of its child barangays are in the same district; cross-district groupings remain represented by barangays.',
    ],
  },
  data,
}

writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  output: outputPath,
  districts: data.length,
  verifiedDistricts: data.filter(item => item.membershipStatus === 'verified').length,
  subdivisionUnits: data.reduce((total, item) => total + item.units.length, 0),
}, null, 2))
