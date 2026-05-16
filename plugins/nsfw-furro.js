import axios from 'axios'

let handler = async (m, { conn, usedPrefix, command }) => {
    // 1. Verificar si el grupo tiene el modo NSFW activado
    if (m.isGroup && global.db && global.db.data && global.db.data.chats && global.db.data.chats[m.chat] && !global.db.data.chats[m.chat].nsfw) {
        return m.reply(`[⚠️] El contenido **NSFW** está desactivado en este grupo.\nSi eres administrador, actívalo con: *${usedPrefix}enable nsfw*`)
    }

    // Mensaje de espera rápido
    m.reply('⏳ Buscando en la galería... Un momento.')

    try {
        // 2. Hacer la petición con un timeout por si la API tarda en responder
        let response = await axios.get('https://api.evogb.org/nsfw/random/furro?&key=Criss-fv', { timeout: 10000 })
        
        // Validar si axios realmente recibió respuesta del servidor
        if (!response || !response.data) {
            throw new Error('El servidor de la API no envió datos.')
        }

        let res = response.data

        // 3. Validar la estructura interna de tu API (status y data.url)
        if (res.status && res.data && res.data.url) {
            let imgUrl = res.data.url
            let caption = `🔥 *Zore-Two NSFW* 🔥\n\n*Tipo:* ${res.data.type || 'Furro'}\n*Creador:* ${res.creator || 'GataDios'}`

            // 4. Enviar la imagen
            await conn.sendMessage(m.chat, { image: { url: imgUrl }, caption: caption }, { quoted: m })
        } else {
            m.reply('[⚠️] La API respondió, pero no encontró ninguna imagen en este momento.')
        }

    } catch (e) {
        console.error(e)
        // Un mensaje amigable para el usuario si la API se cae o la Key falla
        m.reply('[❌] La API de evogb tuvo un problema o tu Key está inactiva. Inténtalo de nuevo.')
    }
}

handler.command = ['furro', 'nsfwfurro']
handler.tags = ['nsfw']
handler.help = ['furro']

export default handler
