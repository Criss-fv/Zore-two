import './settings.js'
import chalk from 'chalk'
import print from './lib/print.js'
import { smsg } from './lib/simple.js'
import { database } from './lib/database.js'
import { readdirSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { resolveWho } from './lib/who.js'

const toNum = v => (v + '').replace(/[^0-9]/g, '')
const localPart = v => (v + '').split('@')[0].split(':')[0].split('/')[0].split(',')[0]
const normalizeCore = v => toNum(localPart(v))

function pickOwners() {
    const arr = Array.isArray(global.owner) ? global.owner : []
    return arr.map(v => Array.isArray(v)
        ? { num: normalizeCore(v[0]), root: !!v[2] }
        : { num: normalizeCore(v), root: false }
    )
}

const isOwnerJid     = jid => pickOwners().some(o => o.num === normalizeCore(jid))
const isRootOwnerJid = jid => pickOwners().some(o => o.num === normalizeCore(jid) && o.root)

function isPremiumJid(jid) {
    const num = normalizeCore(jid)
    const prems = Array.isArray(global.prems) ? global.prems.map(normalizeCore) : []
    if (prems.includes(num)) return true
    return !!database.data?.users?.[jid]?.premium
}

const PREFIXES = ['#', '.', '/', '$']
const IGNORED_WORDS = ['hola', 'hey', 'ok', 'vale', 'sí', 'no', 'si', 'buenas', 'buenos', 'gracias', 'graciasbot']

const getPrefix = body => PREFIXES.find(p => body.startsWith(p)) || null

const similarity = (a, b) => {
    let matches = 0
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) matches++
    return Math.floor((matches / Math.max(a.length, b.length)) * 100)
}

// Construye mapa de comandos desde plugins
function buildCmdMap(plugins) {
    const map = new Map()
    for (const [, plugin] of plugins) {
        if (!plugin?.command) continue
        const cmds = Array.isArray(plugin.command)
            ? plugin.command
            : typeof plugin.command === 'string'
                ? [plugin.command]
                : []
        for (const c of cmds) {
            if (typeof c === 'string') map.set(c.toLowerCase(), plugin)
        }
    }
    return map
}

const eventsLoadedFor = new WeakSet()

export const loadEvents = async (conn) => {
    if (!conn?.ev?.on || eventsLoadedFor.has(conn)) return
    eventsLoadedFor.add(conn)
    const eventsPath = resolve('./events')
    let files = []
    try { files = readdirSync(eventsPath).filter(f => f.endsWith('.js')) } catch { return }
    for (const file of files) {
        try {
            const mod = await import(pathToFileURL(join(eventsPath, file)).href)
            if (!mod.event || !mod.run) continue
            conn.ev.on(mod.event, (data) => {
                const id = data?.id || data?.key?.remoteJid || null
                if (mod.enabled && id && !mod.enabled(id)) return
                mod.run(conn, data)
            })
        } catch {}
    }
}

export const handler = async (m, conn, plugins) => {
    try {
        if (!m) return

        await loadEvents(conn)
        m = await smsg(conn, m)

        // Botones
        const btn = m.message?.buttonsResponseMessage ||
            m.message?.templateButtonReplyMessage ||
            m.message?.listResponseMessage
        if (btn) {
            const btnCmd = btn.selectedButtonId || btn.singleSelectReply?.selectedRowId
            if (btnCmd?.trim()) {
                m.message = { conversation: btnCmd.trim() }
                m.text = btnCmd.trim()
                m.body = btnCmd.trim()
                const senderId = m.participant || m.key?.participant || m.key?.remoteJid || ''
                if (m.sender !== senderId)
                    Object.defineProperty(m, 'sender', { value: senderId, writable: true, configurable: true })
            }
        }

        // Silenciar usuarios
        if (m.isGroup) {
            const muted = database.data?.groups?.[m.chat]?.muted || []
            if (muted.includes(m.sender)) {
                await conn.sendMessage(m.chat, { delete: m.key })
                return
            }
        }

        await print(m, conn)
        if (!m.body) return

        // ── PARSEO DE COMANDO ────────────────────────────────────────────────
        const body       = m.body.trim()
        const cmdMap     = buildCmdMap(plugins)

        let commandName  = null
        let args         = []
        let usedPrefix   = '.'
        let withPrefix   = false

        const detectedPrefix = getPrefix(body)

        if (detectedPrefix) {
            // Con prefijo
            withPrefix = true
            usedPrefix = detectedPrefix
            const rest  = body.slice(detectedPrefix.length).trim()
            const parts = rest.split(/ +/)
            commandName = parts.shift()?.toLowerCase() || null
            args        = parts

        } else {
            // Sin prefijo
            const sinprefixEnabled = database.data?.settings?.sinprefix ?? true
            if (!sinprefixEnabled) return

            const parts     = body.split(/ +/)
            const firstWord = parts[0]?.toLowerCase()
            if (!firstWord || IGNORED_WORDS.includes(firstWord)) return

            // Solo continuar si es un comando real
            if (!cmdMap.has(firstWord)) return

            withPrefix  = false
            usedPrefix  = ''
            commandName = firstWord
            args        = parts.slice(1)
        }

        if (!commandName) return

        // ── BUSCAR PLUGIN ────────────────────────────────────────────────────
        let cmd = null

        if (detectedPrefix === '$') {
            for (const [, plugin] of plugins) {
                if (plugin.customPrefix?.includes('$')) {
                    cmd = plugin
                    args.unshift(commandName)
                    break
                }
            }
        } else {
            cmd = cmdMap.get(commandName) || null
        }

        // Comando no encontrado
        if (!cmd) {
            if (!withPrefix) return // sin prefijo: ignorar silencioso

            const allCmds = [...cmdMap.keys()]
            const similares = allCmds
                .map(c => ({ cmd: c, score: similarity(commandName, c) }))
                .filter(o => o.score >= 40)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)

            const p = usedPrefix || '.'
            const sugerencias = similares.length
                ? similares.map(s => `*${p}${s.cmd}* » ${s.score}%`).join('\n')
                : 'ninguno'

            return conn.sendMessage(m.chat, {
                text: `⸸ *${global.botName}*\n\nEl comando *${p}${commandName}* no existe.\nUsa *${p}menu* para ver los comandos.\n\n*Similares:*\n${sugerencias}`
            }, { quoted: m })
        }

        // ── PERMISOS ─────────────────────────────────────────────────────────
        const isROwner     = isRootOwnerJid(m.sender)
        const isOwner      = isROwner || isOwnerJid(m.sender)
        const isPremium    = isOwner || isPremiumJid(m.sender)
        const isRegistered = isOwner || !!database.data.users?.[m.sender]?.registered

        const isGroup = m.isGroup
        let isAdmin = false, isBotAdmin = false

        if (isGroup) {
            try {
                const groupMeta = await conn.groupMetadata(m.chat)
                const clean = v => (v || '').split('@')[0].split(':')[0]
                const senderNum = clean(m.sender)
                const botNum    = clean(conn.user.id)
                isAdmin    = !!groupMeta.participants.find(p => clean(p.jid || p.id) === senderNum)?.admin || isOwner
                isBotAdmin = !!groupMeta.participants.find(p => clean(p.jid || p.id) === botNum)?.admin
            } catch {}
        }

        // Inicializar BD
        if (!database.data.users)    database.data.users    = {}
        if (!database.data.groups)   database.data.groups   = {}
        if (!database.data.settings) database.data.settings = {}

        if (!database.data.users[m.sender]) {
            database.data.users[m.sender] = {
                registered: false, premium: false, banned: false,
                warning: 0, exp: 0, level: 1, limit: 20,
                lastclaim: 0, registered_time: 0,
                name: m.pushName || '', age: null
            }
            await database.save()
        }

        if (isGroup && !database.data.groups[m.chat]) {
            database.data.groups[m.chat] = { modoadmin: false, muted: [] }
            await database.save()
        }

        const who = await resolveWho(m, conn, args)

        // Verificaciones
        if (isGroup && database.data.groups[m.chat]?.modoadmin && !isAdmin && !isOwner)
            return m.reply(`✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕══ ✠\n\n🔒 *Modo Admin activo.*\n_Solo administradores pueden invocar comandos._`)

        if (database.data.users[m.sender]?.banned && !isOwner)
            return m.reply('⸸ ...estás baneado. no puedes usar el sistema.')

        if (cmd.rowner   && !isROwner)    return m.reply('⸸ ...solo el creador principal puede hacer eso.')
        if (cmd.owner    && !isOwner)     return m.reply('⸸ ...ese comando es solo para mis creadores.')
        if (cmd.premium  && !isPremium)   return m.reply('⸸ ...comando premium. no tienes acceso.')
        if (cmd.register && !isRegistered) return m.reply(`⸸ ...regístrate primero.\n📌 *${usedPrefix || '.'}reg nombre.edad*`)
        if (cmd.group    && !isGroup)     return m.reply('⸸ ...ese comando es solo para grupos.')
        if (cmd.admin    && !isAdmin)     return m.reply('⸸ ...necesitas ser admin del grupo.')
        if (cmd.botAdmin && !isBotAdmin)  return m.reply('⸸ ...necesito ser admin del grupo para eso.')
        if (cmd.private  && isGroup)      return m.reply('⸸ ...escríbeme al privado.')

        if (cmd.limit && !isPremium && !isOwner) {
            const lim = database.data.users[m.sender].limit || 0
            if (lim < 1) return m.reply('⸸ ...se agotaron tus límites diarios. regresa mañana.')
            database.data.users[m.sender].limit -= 1
            await database.save()
        }

        // ── EJECUTAR ─────────────────────────────────────────────────────────
        try {
            await cmd(m, {
                conn,
                args,
                text:       args.join(' '),
                usedPrefix: usedPrefix ?? '.',
                command:    commandName,
                isOwner, isROwner, isPremium, isRegistered,
                isAdmin, isBotAdmin, isGroup,
                who,
                db:      database.data,
                prefix:  usedPrefix ?? '.',
                plugins
            })
        } catch (e) {
            const msg   = e?.message || String(e)
            const lines = e?.stack?.split('\n') || []
            let file = '?', line = '?'
            for (const l of lines) {
                const match = l.match(/\((.*plugins.*):(\d+):(\d+)\)/)
                if (match) { file = match[1]; line = match[2]; break }
            }
            const debug = `⸸ *Error en comando*\n📌 ${usedPrefix || '.'}${commandName}\n🧾 ${msg.slice(0, 400)}\n📍 ${file}:${line}`
            console.log(chalk.red(debug))
            if (m?.reply) m.reply(debug)
        }

    } catch (e) {
        if (m?.reply) m.reply(`⸸ *Error global*\n🧾 ${(e?.message || String(e)).slice(0, 400)}`)
    }
}
