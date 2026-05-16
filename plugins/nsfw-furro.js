import { database } from '../lib/database.js'
import axios from 'axios'

let handler = async (m, { conn }) => {
    // 1. Validación de NSFW exacta a tu bot
    if (!database.data.groups?.[m.chat]?.nsfw) {
        return m.reply('🚫 El contenido NSFW está desactivado en este grupo.\n\nUn admin puede activarlo con *#nable nsfw on*')
    }

    try {
        // 2. Hacemos la consulta a tu API para obtener el enlace aleatorio
        let response = await axios.get('https://api.evogb.org/nsfw/random/furro?&key=Criss-fv')
        let res = response.data

        // 3. Verificamos que la API devuelva la URL correctamente
        if (res && res.status && res.data?.url) {
            let img = res.data.url
            let text = `🔥 *FURRO* 🔥\n\n*Creador:* ${res.creator || 'GataDios'}`

            // 4. Enviamos el mensaje
            await conn.sendMessage(m.chat, {
                image: { url: img },
                caption: text
            }, { quoted: m })
        } else {
            m.reply('⚠️ La API no devolvió una imagen válida en este momento.')
        }

    } catch (error) {
        console.error(error)
        m.reply('❌ Hubo un error al conectar con la API de Evogb.')
    }
}

handler.help = ['furro']
handler.tags = ['nsfw']
handler.command = ['furro']
handler.group = true

export default handler
