import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import fetch from 'node-fetch'
import { database } from '../lib/database.js'

const handler = async (m, { conn }) => {
    try {
        const botname = global.botname || global.botName || 'Shizuku'

        const pluginDir = path.resolve('./plugins')
        const pluginFiles = fs
            .readdirSync(pluginDir)
            .filter(file => file.endsWith('.js'))

        const grouped = {}

        for (const file of pluginFiles) {
            try {
                const filePath = path.join(pluginDir, file)
                const plugin = (await import(`${pathToFileURL(filePath).href}?update=${Date.now()}`)).default

                const tags = plugin?.tags || ['misc']
                const commands = Array.isArray(plugin?.command)
                    ? plugin.command
                    : plugin?.command
                        ? [plugin.command]
                        : [file.replace('.js', '')]

                const cmd = commands[0]

                for (const tag of tags) {
                    if (!grouped[tag]) grouped[tag] = []
                    grouped[tag].push(cmd)
                }
            } catch {
                const cmd = file.replace('.js', '')

                if (!grouped.misc) grouped.misc = []
                grouped.misc.push(cmd)
            }
        }

        const totalCmds = Object.values(grouped).flat().length
        const users = database?.data?.users || {}
        const totalUsers = Object.keys(users).length
        const registeredUsers = Object.values(users).filter(u => u?.registered).length

        const zonaHoraria = 'America/Bogota'
        const ahora = new Date()
        const hora = parseInt(
            ahora.toLocaleTimeString('es-CO', {
                timeZone: zonaHoraria,
                hour: '2-digit',
                hour12: false
            })
        )

        let saludo

        if (hora >= 5 && hora < 12) saludo = '...buenos días, supongo.'
        else if (hora >= 12 && hora < 18) saludo = '...buenas tardes. o algo así.'
        else saludo = '...buenas noches. ¿por qué sigues despierto?'

        const frases = [
            'no recuerdo haberte invitado, pero aquí estás.',
            'blinky podría encargarse de esto, pero supongo que yo también.',
            'no sé quién eres, pero el sistema sí.',
            '...¿necesitas algo o solo viniste a curiosear?',
            'el nen no miente. los comandos tampoco.'
        ]

        const frase = frases[Math.floor(Math.random() * frases.length)]

        const seccionesTexto = Object.entries(grouped)
            .map(([tag, cmds]) => {
                return `꧁ · ${tag.toUpperCase()} · ꧂
${cmds.map(c => `  ⸸ ${c}`).join('\n')}`
            })
            .join('\n\n')

        const menuTexto = `
✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕══ ✠

_${saludo}_
*${m.pushName || 'Usuario'}*... ${frase}

⸸ *Comandos activos:* ${totalCmds}
⸸ *Usuarios registrados:* ${registeredUsers}
⸸ *Entidades conocidas:* ${totalUsers}

✠ ───────────────── ✠

${seccionesTexto}

✠ ───────────────── ✠
_— ${botname} · Araña Nº8 · no me molestes si no es urgente_ 🕷️
`.trim()

        const thumbUrl = 'https://causas-files.vercel.app/fl/9vs2.jpg'
        const thumbResponse = await fetch(thumbUrl)

        if (!thumbResponse.ok) {
            throw new Error(`No se pudo descargar la thumbnail: ${thumbResponse.status}`)
        }

        const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer())

        const fakeDocument = Buffer.from(menuTexto, 'utf-8')

        await conn.sendMessage(
            m.chat,
            {
                document: fakeDocument,
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                fileName: '🕷 Shizuku System.xlsx',
                fileLength: 1099511627776,
                jpegThumbnail: thumbBuffer,
                caption: menuTexto,
                mentions: [m.sender]
            },
            { quoted: m }
        )

    } catch (e) {
        console.error(e)
        await m.reply('...algo falló. blinky tampoco lo entendió.')
    }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = ['menu', 'help', 'ayuda']

export default handler