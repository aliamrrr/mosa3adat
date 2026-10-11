import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const AUTH_DIR = path.join(DIR, 'auth')
const DATA_DIR = path.join(DIR, 'data')
const SENT_FILE = path.join(DATA_DIR, 'sent.json')
const CHECK_MODE = process.argv.includes('--check')
const CHECK_EVERY_MS = 5 * 60 * 1000

const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'))

fs.mkdirSync(DATA_DIR, { recursive: true })

const log = (...a) => console.log(new Date().toISOString(), ...a)

// ---------- Dates (dans le fuseau configuré) ----------
function nowInTz() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t) => Number(parts.find((p) => p.type === t).value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

// ---------- Journal des envois (évite les doublons) ----------
function loadSent() {
  try {
    return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'))
  } catch {
    return {}
  }
}
function markSent(id) {
  const sent = loadSent()
  sent[id] = new Date().toISOString()
  fs.writeFileSync(SENT_FILE, JSON.stringify(sent, null, 2))
}

// ---------- Logique d'envoi ----------
let currentSock = null
let groupId = null
let sending = false

async function findGroup(sock) {
  if (groupId) return groupId
  const groups = await sock.groupFetchAllParticipating()
  const wanted = config.groupName.trim().toLowerCase()
  const g = Object.values(groups).find(
    (x) => (x.subject || '').trim().toLowerCase() === wanted,
  )
  if (!g) return null
  groupId = g.id
  return groupId
}

async function checkAndSend() {
  if (!currentSock || sending) return
  sending = true
  try {
    const now = nowInTz()
    const sent = loadSent()
    const afterTime =
      now.hour > config.sendHour ||
      (now.hour === config.sendHour && now.minute >= config.sendMinute)

    for (const msg of config.messages) {
      const id = `${now.year}-${String(now.month).padStart(2, '0')}-${msg.key}`
      if (msg.day !== now.day || !afterTime || sent[id]) continue

      const gid = await findGroup(currentSock)
      if (!gid) {
        log(`ERREUR: groupe "${config.groupName}" introuvable. Nouvel essai au prochain passage.`)
        continue
      }
      await currentSock.sendMessage(gid, { text: msg.text })
      markSent(id)
      log(`Message "${msg.key}" envoyé dans "${config.groupName}" (${id}).`)
    }
  } catch (err) {
    log('ERREUR pendant l\'envoi (nouvel essai au prochain passage):', err?.message || err)
  } finally {
    sending = false
  }
}

// ---------- Mode --check : vérifie la connexion et le nom du groupe ----------
async function runCheck(sock) {
  const groups = await sock.groupFetchAllParticipating()
  const names = Object.values(groups).map((g) => g.subject)
  console.log('\nVos groupes :')
  names.forEach((n) => console.log(' -', n))
  const found = await findGroup(sock)
  console.log(
    found
      ? `\n✅ Groupe "${config.groupName}" trouvé. Tout est prêt.`
      : `\n❌ Groupe "${config.groupName}" introuvable. Corrigez "groupName" dans config.json.`,
  )
  process.exit(found ? 0 : 1)
}

// ---------- Connexion WhatsApp ----------
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Rappels Mosa3adat', 'Chrome', '1.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
  })
  currentSock = sock

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log(
        '\nScannez ce QR code : WhatsApp > Réglages > Appareils connectés > Connecter un appareil\n',
      )
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      log('Connecté à WhatsApp.')
      if (CHECK_MODE) return runCheck(sock)
      await checkAndSend() // rattrapage si le programme a démarré après l'heure prévue
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        log('Session déconnectée depuis le téléphone. Supprimez le dossier "auth" puis relancez pour rescanner le QR code.')
        process.exit(1)
      }
      log(`Connexion fermée (code ${code ?? 'inconnu'}), reconnexion dans 5 s...`)
      setTimeout(() => start().catch((e) => log('Echec reconnexion:', e?.message || e)), 5000)
    }
  })
}

if (!CHECK_MODE) setInterval(checkAndSend, CHECK_EVERY_MS)
start().catch((e) => {
  console.error(e)
  process.exit(1)
})
