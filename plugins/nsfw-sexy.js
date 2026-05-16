import { database } from '../lib/database.js'
import axios from 'axios'

let handler = async (m, { conn }) => {
    // 1. Validación de restricción (por seguridad, usamos la misma de tu bot)
    if (!database.data.groups?.[m.chat]?.nsfw) {
        return m.reply('🚫 Este comando requiere que el modo NSFW/Sexy esté activado en el grupo.\n\nUn admin puede activarlo con *#nable nsfw on*')
    }

    try {
        // 2. Hacemos la consulta a la nueva API
        let response = await axios.get('https://api.evogb.org/sfw/girls?type=sexy&key=Criss-fv')
        let res = response.data

        // 3. Verificamos la estructura (aquí usamos res.result)
        if (res && res.status && res.result) {
            let img = res.result // <-- Aquí cambia con respecto al comando anterior
            let text = `✨ *SHIRUKU SEXY GIRLS* ✨\n\n📝 _${res.description || 'Imágenes sexy/love de Mujeres.'}_\n👤 *Creador:* ${res.creator || 'GataDios'}`

            // 4. Enviamos la imagen a WhatsApp
            await conn.sendMessage(m.chat, {
                image: { url: img },
                caption: text
            }, { quoted: m })
        } else {
            m.reply('⚠️ La API no devolvió un resultado válido en este momento.')
        }

    } catch (error) {
        console.error(error)
        m.reply('❌ Hubo un error al conectar con el servidor de Evogb.')
    }
}

handler.help = ['girls', 'sexy']
handler.tags = ['nsfw'] // O lo puedes cambiar a ['tools'] si prefieres cambiar de categoría
handler.command = ['girls', 'sexy']
handler.group = true

export default handler
