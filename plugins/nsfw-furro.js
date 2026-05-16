import axios from 'axios'

let handler = async (m, { conn, usedPrefix, command }) => {
    // 1. Verificar si el grupo tiene el modo NSFW activado (si tu bot maneja esa configuración)
    if (m.isGroup && !global.db.data.chats[m.chat].nsfw) {
        return m.reply(`[⚠️] El contenido **NSFW** está desactivado en este grupo.\nSi eres administrador, actívalo con: *${usedPrefix}enable nsfw*`)
    }

    // Mensaje de espera
    m.reply('⏳ Enviando contenido... subiendo la temperatura.')

    try {
        // 2. Hacer la petición a tu API
        let response = await axios.get('https://api.evogb.org/nsfw/random/furro?&key=Criss-fv')
        let res = response.data

        // 3. Validar si la API respondió correctamente
        if (res.status && res.data && res.data.url) {
            let imgUrl = res.data.url
            let caption = `🔥 *Zore-Two NSFW* 🔥\n\n*Tipo:* ${res.data.type || 'Furro'}\n*Creador:* ${res.creator || 'GataDios'}`

            // 4. Enviar la imagen al chat de WhatsApp
            await conn.sendMessage(m.chat, { image: { url: imgUrl }, caption: caption }, { quoted: m })
        } else {
            throw new Error('La API no devolvió una URL válida.')
        }

    } catch (e) {
        console.error(e)
        m.reply('[❌] Hubo un error al conectar con la API o el servidor está caído. Inténtalo de nuevo más tarde.')
    }
}

// Los comandos/disparadores que activarán el plugin
handler.command = ['furro', 'nsfwfurro']
handler.tags = ['nsfw']
handler.help = ['furro']

export default handler
