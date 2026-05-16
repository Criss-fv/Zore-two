import fs from 'fs'
import fetch from 'node-fetch'
import { database } from '../lib/database.js'

const handler = async (m, { conn }) => {
    try {
        const botname = global.botname || global.botName || 'Shizuku'

        const pluginFiles = fs.readdirSync('./plugins').filter(file => file.endsWith('.js'))
        const grouped = {}
        for (const file of pluginFiles) {
            try {
                const plugin = (await import(`../plugins/${file}`)).default
                const tags = plugin?.tags || ['misc']
                const cmd = plugin?.command?.[0] || file.replace('.js', '')
                for (const tag of tags) {
                    if (!grouped[tag]) grouped[tag] = []
                    grouped[tag].push(cmd)
                }
            } catch {
                const cmd = file.replace('.js', '')
                if (!grouped['misc']) grouped['misc'] = []
                grouped['misc'].push(cmd)
            }
        }

        const totalCmds = Object.values(grouped).flat().length
        const totalUsers = Object.keys(database.data.users || {}).length
        const registeredUsers = Object.values(database.data.users || {}).filter(u => u.registered).length

        const zonaHoraria = 'America/Bogota'
        const ahora = new Date()
        const hora = parseInt(ahora.toLocaleTimeString('es-CO', { timeZone: zonaHoraria, hour: '2-digit', hour12: false }))
        let saludo, carita
        if (hora >= 5 && hora < 12) {
            saludo = 'buenos días'
            carita = '✦ ☀️'
        } else if (hora >= 12 && hora < 18) {
            saludo = 'buenas tardes'
            carita = '✦ 🌸'
        } else {
            saludo = 'buenas noches'
            carita = '✦ 🌙'
        }

        let seccionesTexto = Object.entries(grouped).map(([tag, cmds]) =>
`꧁ 𝕾𝖎𝖘𝖙𝖊𝖒𝖆 · ${tag.toUpperCase()} ꧂
${cmds.map(c => `  ⸸ ${c}`).join('\n')}
`
        ).join('\n')

        const menuTexto = `
✠ ═══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕═══ ✠

❝ ${saludo}, *${m.pushName}* ${carita}
   el sistema ha sido invocado... ❞

⸸ *Módulos:* ${totalCmds} activos
⸸ *Almas registradas:* ${registeredUsers}
⸸ *Entidades detectadas:* ${totalUsers}

✠ ─────────────────── ✠

${seccionesTexto}
✠ ─────────────────── ✠
_𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 · el oscuro velo te guía_ 🖤`.trim()

        const response = await fetch('https://causas-files.vercel.app/fl/9vs2.jpg')
        const buffer = await response.buffer()

        await conn.sendMessage(m.chat, {
            image: buffer,
            caption: menuTexto,
            mentions: [m.sender],
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363404822730259@newsletter',
                    newsletterName: '𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒',
                    serverMessageId: -1
                }
            }
        }, { quoted: m })

    } catch (e) {
        console.error(e)
        m.reply('⸸ El sistema ha fallado... intenta de nuevo.')
    }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = ['menu', 'help', 'ayuda']
export default handler
