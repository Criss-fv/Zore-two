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
const localPart = v => (v + '').split('@')[0].split(':')[0].split('/')[0].split(',')[0].split(':')[0]
const normalizeCore = v => toNum(localPart(v))

function pickOwners() {
    const arr = Array.isArray(global.owner) ? global.owner : []
    const flat = []
    for (const v of arr) {
        if (Array.isArray(v)) flat.push({ num: normalizeCore(v[0]), root: !!v[2] })
        else flat.push({ num: normalizeCore(v), root: false })
    }
    return flat
}

function isOwnerJid(jid) {
    const num = normalizeCore(jid)
    return pickOwners().some(o => o.num === num)
}

function isRootOwnerJid(jid) {
    const num = normalizeCore(jid)
    return pickOwners().some(o => o.num === num && o.root)
}

function isPremiumJid(jid) {
    const num = normalizeCore(jid)
    const prems = Array.isArray(global.prems) ? global.prems.map(normalizeCore) : []
    if (prems.includes(num)) return true
    const u = database.data?.users?.[jid]
    return !!u?.premium
}

const PREFIXES = ['#', '.', '/', '$']

function getPrefix(body) {
    for (const p of PREFIXES) {
        if (body.startsWith(p)) return p
    }
    return null
}

const similarity = (a, b) => {
    let matches = 0
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i]) matches++
    }
    return Math.floor((matches / Math.max(a.length, b.length)) * 100)
}

const IGNORED_WORDS = ['hola', 'hey', 'ok', 'vale', 'sí', 'no', 'si', 'buenas', 'buenos', 'gracias', 'graciasbot']

const eventsLoadedFor = new WeakSet()

export const loadEvents = async (conn) => {
    if (!conn?.ev?.on) return
    if (eventsLoadedFor.has(conn)) return
    eventsLoadedFor.add(conn)

    const eventsPath = resolve('./events')
    let files = []

    try {
        files = readdirSync(eventsPath).filter(f => f.endsWith('.js'))
    } catch {
        return
    }

    for (const file of files) {
        try {
            const url = pathToFileURL(join(eventsPath, file)).href
            const mod = await import(url)
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

        const btn =
            m.message?.buttonsResponseMessage ||
            m.message?.templateButtonReplyMessage ||
            m.message?.listResponseMessage

        if (btn) {
            const cmd =
                btn.selectedButtonId ||
                btn.singleSelectReply?.selectedRowId

            if (cmd && typeof cmd === 'string') {
                const clean = cmd.trim()
                if (clean) {
                    m.message = { conversation: clean }
                    m.text = clean
                    m.body = clean
                    const senderId = m.participant || m.key?.participant || m.key?.remoteJid || ''
                    if (m.sender !== senderId) {
                        Object.defineProperty(m, 'sender', { value: senderId, writable: true, configurable: true })
                    }
                }
            }
        }

        if (m.isGroup) {
            const muted = database.data?.groups?.[m.chat]?.muted || []
            if (muted.includes(m.sender)) {
                await conn.sendMessage(m.chat, { delete: m.key })
                return
            }
        }

        await print(m, conn)

        if (!m.body) return

        let prefix = null
        let commandName = null
        let args = []
        let usedPrefix = null

        // ── OPCIÓN 1: Con prefijo (#, ., /, $) ──────────────────────────────
        const detectedPrefix = getPrefix(m.body)
        if (detectedPrefix) {
            usedPrefix = detectedPrefix
            const body = m.body.slice(detectedPrefix.length).trim()
            const parts = body.split(/ +/)
            commandName = parts.shift().toLowerCase()
            args = parts
            prefix = detectedPrefix
        }

        // ── OPCIÓN 2: Sin prefijo ────────────────────────────────────────────
        if (!prefix) {
            const sinprefixEnabled = database.data?.settings?.sinprefix ?? true
            if (!sinprefixEnabled) return

            const parts = m.body.trim().split(/ +/)
            const firstWord = parts[0]?.toLowerCase()
            if (!firstWord) return
            if (IGNORED_WORDS.includes(firstWord)) return

            // Construir set de todos los comandos disponibles
            const allCmds = new Map() // cmd → plugin
            for (const [, plugin] of plugins) {
                if (!plugin?.command) continue
                let cmds = []
                if (Array.isArray(plugin.command)) cmds = plugin.command
                else if (typeof plugin.command === 'string') cmds = [plugin.command]
                else if (plugin.command instanceof RegExp) continue
                for (const c of cmds) {
                    if (typeof c === 'string') allCmds.set(c.toLowerCase(), plugin)
                }
            }

            if (!allCmds.has(firstWord)) return // no es comando, ignorar silencioso

            commandName = firstWord
            args = parts.slice(1)
            prefix = ''
            usedPrefix = ''
        }

        if (!commandName) return

        let cmd = null

        if (prefix === '$') {
            for (const [, plugin] of plugins) {
                if (plugin.customPrefix?.includes('$')) {
                    cmd = plugin
                    args.unshift(commandName)
                    break
                }
            }
        } else {
            for (const [, plugin] of plugins) {
                if (!plugin.command) continue
                const cmds = Array.isArray(plugin.command)
                    ? plugin.command
                    : plugin.command instanceof RegExp
                        ? []
                        : [plugin.command]
                if (cmds.map(c => c.toLowerCase()).includes(commandName)) {
                    cmd = plugin
                    break
                }
            }
        }

        if (!cmd) {
            const allCommands = []
            for (const [, plugin] of plugins) {
                if (!plugin.command) continue
                const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command]
                for (const c of cmds) {
                    if (typeof c === 'string') allCommands.push(c)
                }
            }

            const similares = allCommands
                .map(c => ({ cmd: c, score: similarity(commandName, c) }))
                .filter(o => o.score >= 40)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)

            const defaultPrefix = usedPrefix || '.'
            const sugerencias = similares.length
                ? similares.map(s => `*${defaultPrefix}${s.cmd}* » *${s.score}%*`).join('\n')
                : 'Sin resultados'

            // Solo mostrar "comando no existe" si se usó prefijo
            // Sin prefijo simplemente ignorar para no spamear
            if (!usedPrefix && usedPrefix !== '') return

            return conn.sendMessage(m.chat, {
                text: `⸸ *${global.botName}*\n\nEl comando *(${defaultPrefix}${commandName})* no existe.\n- Usa *${defaultPrefix}menu* para ver los comandos.\n\n*Similares:*\n${sugerencias}`
            }, { quoted: m })
        }

        const isROwner = isRootOwnerJid(m.sender)
        const isOwner = isROwner || isOwnerJid(m.sender)
        const isPremium = isOwner || isPremiumJid(m.sender)
        const isRegistered = isOwner || database.data.users?.[m.sender]?.registered || false

        const isGroup = m.isGroup
        let isAdmin = false
        let isBotAdmin = false

        if (isGroup) {
            try {
                const groupMeta = await conn.groupMetadata(m.chat)
                const clean = v => (v || '').split('@')[0].split(':')[0]
                const senderNum = clean(m.sender)
                const botNum = clean(conn.user.id)
                const participant = groupMeta.participants.find(p => clean(p.jid || p.id) === senderNum)
                isAdmin = !!participant?.admin || isOwner
                const botParticipant = groupMeta.participants.find(p => clean(p.jid || p.id) === botNum)
                isBotAdmin = !!botParticipant?.admin
            } catch {}
        }

        if (!database.data.users) database.data.users = {}
        if (!database.data.groups) database.data.groups = {}
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

        if (isGroup && database.data.groups[m.chat]?.modoadmin && !isAdmin && !isOwner) {
            return m.reply(
                `✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕══ ✠\n\n` +
                `🔒 *Modo Admin activo.*\n_Solo administradores pueden invocar comandos._`
            )
        }

        if (database.data.users[m.sender]?.banned && !isOwner) {
            return m.reply('⸸ ...estás baneado. no puedes usar el sistema.')
        }

        if (cmd.rowner && !isROwner) {
            return m.reply('⸸ ...acceso denegado. solo el creador principal puede hacer eso.')
        }

        if (cmd.owner && !isOwner) {
            return m.reply('⸸ ...ese comando no es para ti. solo mis creadores.')
        }

        if (cmd.premium && !isPremium) {
            return m.reply('⸸ ...comando premium. no tienes acceso.')
        }

        if (cmd.register && !isRegistered) {
            return m.reply(
                `⸸ ...necesitas registrarte primero.\n\n` +
                `📌 Usa: *${usedPrefix || '.'}reg nombre.edad*\n` +
                `Ejemplo: *${usedPrefix || '.'}reg Kurapika.17*`
            )
        }

        if (cmd.group && !isGroup) {
            return m.reply('⸸ ...ese comando es solo para grupos.')
        }

        if (cmd.admin && !isAdmin) {
            return m.reply('⸸ ...necesitas ser admin del grupo para eso.')
        }

        if (cmd.botAdmin && !isBotAdmin) {
            return m.reply('⸸ ...necesito ser admin del grupo para ejecutar eso.')
        }

        if (cmd.private && isGroup) {
            return m.reply('⸸ ...escríbeme al privado para usar ese comando.')
        }

        if (cmd.limit && !isPremium && !isOwner) {
            const userLimit = database.data.users[m.sender].limit || 0
            if (userLimit < 1) {
                return m.reply('⸸ ...se agotaron tus límites diarios. regresa mañana.')
            }
            database.data.users[m.sender].limit -= 1
            await database.save()
        }

        try {
            await cmd(m, {
                conn,
                args,
                text: args.join(' '),   // ← los plugins que usen `text` también funcionan
                usedPrefix: usedPrefix ?? '.',
                command: commandName,
                isOwner, isROwner, isPremium, isRegistered,
                isAdmin, isBotAdmin, isGroup,
                who,
                db: database.data,
                prefix: usedPrefix ?? '.',
                plugins
            })
        } catch (e) {
            const message = e?.message || String(e)
            const stackLines = e?.stack?.split('\n') || []
            let file = null, line = null
            for (const l of stackLines) {
                const match = l.match(/\((.*plugins.*):(\d+):(\d+)\)/)
                if (match) { file = match[1]; line = match[2]; break }
            }
            const debug =
                `⸸ *Error en comando*\n\n` +
                `📌 Comando: ${usedPrefix || '.'}${commandName}\n` +
                `🧾 ${message.slice(0, 500)}\n` +
                `📍 ${file || 'desconocido'}:${line || '?'}`
            console.log(chalk.red(debug))
            if (m?.reply) m.reply(debug)
        }

    } catch (e) {
        if (m?.reply) m.reply(`⸸ *Error global*\n\n🧾 ${(e?.message || String(e)).slice(0, 400)}`)
    }
}
