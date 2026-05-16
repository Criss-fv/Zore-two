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

        let seccionesTexto = Object.entries(grouped).map(([tag, cmds]) =>
`꧁ · ${tag.toUpperCase()} · ꧂
${cmds.map(c => `  ⸸ ${c}`).join('\n')}
`
        ).join('\n')

        const menuTexto = `
✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕══ ✠

_${saludo}_
*${m.pushName}*... ${frase}

⸸ *Comandos activos:* ${totalCmds}
⸸ *Usuarios registrados:* ${registeredUsers}
⸸ *Entidades conocidas:* ${totalUsers}

✠ ───────────────── ✠

${seccionesTexto}
✠ ───────────────── ✠
_— ${botname} · Araña Nº8 · no me molestes si no es urgente_ 🕷️`.trim()

        const response = await fetch('https://causas-files.vercel.app/fl/9vs2.jpg')
        const buffer = await response.buffer()

        // Documento falso con imagen como thumbnail (efecto igual al screenshot)
        await conn.sendMessage(m.chat, {
            document: buffer,
            mimetype: 'image/jpeg',
            fileName: `𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒`,
            fileLength: 1099511627776, // 1.0 TB falso
            caption: menuTexto,
            mentions: [m.sender],
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: global.newsletterJid || '120363401404146384@newsletter',
                    newsletterName: global.newsletterName || '🕷️ 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 🕷️',
                    serverMessageId: -1
                }
            }
        }, { quoted: m })

    } catch (e) {
        console.error(e)
        m.reply('...algo falló. blinky tampoco lo entendió.')
    }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = ['menu', 'help', 'ayuda']
export default handler
