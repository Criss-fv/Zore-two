import fetch from 'node-fetch'
import baileys from '@whiskeysockets/baileys'

// Función nativa para construir y enviar el álbum en paralelo
async function sendAlbumMessage(conn, chatId, mediaArray, options = {}) {
    const caption = options.caption || ''
    const quoted = options.quoted || null

    const albumStructure = {
        messageContextInfo: {},
        albumMessage: { expectedImageCount: mediaArray.length }
    }

    const preparedMaster = await baileys.generateWAMessage(chatId, albumStructure, quoted ? { quoted } : {})
    await conn.relayMessage(preparedMaster.key.remoteJid, preparedMaster.message, { messageId: preparedMaster.key.id })

    // Envío en paralelo supersónico
    await Promise.all(mediaArray.map(async (media, index) => {
        const messageContent = {
            [media.type]: media.data,
            ...(index === 0 ? { caption } : {})
        }

        const msg = await baileys.generateWAMessageContent(preparedMaster.key.id, messageContent, {
            upload: conn.waUploadToServer
        })

        msg.messageContextInfo = {
            broadcast: false,
            parentMessageKey: preparedMaster.key,
            albumMessageContextInfo: { expectedImageCount: 1 }
        }

        await conn.relayMessage(preparedMaster.key.remoteJid, msg, { messageId: preparedMaster.key.id })
    }))

    return preparedMaster
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const prefix = usedPrefix || global.prefix || '.'
    const currentCommand = command || 'pinterest'
    const searchQuery = args.join(' ').trim()

    if (!searchQuery) {
        return m.reply(
            `✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕══ ✠\n\n` +
            `⚠️ *Error de parámetros*\n` +
            `📌 Uso: *${prefix}${currentCommand} <búsqueda>*\n` +
            `💡 Ejemplo: *${prefix}${currentCommand} chika fujiwara*\n\n` +
            `_...ingresa un término válido._ 🕷️`
        )
    }

    await m.react('⏳')

    try {
        // 1. Construimos la URL nativa que nos pasaste
        const link = `https://id.pinterest.com/resource/BaseSearchResource/get/?source_url=%2Fsearch%2Fpins%2F%3Fq%3D${encodeURIComponent(searchQuery)}%26rs%3Dtyped&data=%7B%22options%22%3A%7B%22applied_unified_filters%22%3Anull%2C%22appliedProductFilters%22%3A%22---%22%2C%22article%22%3Anull%2C%22auto_correction_disabled%22%3Afalse%2C%22corpus%22%3Anull%2C%22customized_rerank_type%22%3Anull%2C%22domains%22%3Anull%2C%22dynamicPageSizeExpGroup%22%3A%22control%22%2C%22filters%22%3Anull%2C%22journey_depth%22%3Anull%2C%22page_size%22%3Anull%2C%22price_max%22%3Anull%2C%22price_min%22%3Anull%2C%22query_pin_sigs%22%3Anull%2C%22query%22%3A%22${encodeURIComponent(searchQuery)}%22%2C%22redux_normalize_feed%22%3Atrue%2C%22request_params%22%3Anull%2C%22rs%22%3A%22typed%22%2C%22scope%22%3A%22pins%22%2C%22selected_one_bar_modules%22%3Anull%2C%22seoDrawerEnabled%22%3Afalse%2C%22source_id%22%3Anull%2C%22source_module_id%22%3Anull%2C%22source_url%22%3A%22%2Fsearch%2Fpins%2F%3Fq%3D${encodeURIComponent(searchQuery)}%22%2C%22top_pin_id%22%3Anull%2C%22top_pin_ids%22%3Anull%7D%2C%22context%22%3A%7B%7D%7D`

        // Headers necesarios para simular que somos un navegador real y no nos bloquee
        const headers = {
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'x-requested-with': 'XMLHttpRequest'
        }

        const response = await fetch(link, { headers })
        const json = await response.json()

        // 2. Mapeo y filtrado del árbol interno de Pinterest
        const results = json?.resource_response?.data?.results || []
        
        // Buscamos dentro de cada objeto la imagen original en HD
        const validImages = results
            .map(pin => pin?.images?.orig?.url)
            .filter(url => url) // Elimina campos vacíos si los hay

        if (validImages.length === 0) {
            await m.react('❌')
            return m.reply('❌ No encontré ninguna imagen para esa búsqueda, darling~')
        }

        // Tomamos las primeras 5 imágenes de la respuesta nativa
        const mediaElements = validImages.slice(0, 5).map(url => ({
            type: 'image',
            data: { url }
        }))

        // Estética Shizuku para el mensaje final
        const captionText = 
            `✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕══ ✠\n\n` +
            `🌸 *Búsqueda:* ${searchQuery}\n` +
            `⸸ *Resultados directos:* ${mediaElements.length}\n\n` +
            `_...blinky extrajo los datos originales de Pinterest._ 🕷️`

        // Envío directo al chat
        await sendAlbumMessage(conn, m.chat, mediaElements, { caption: captionText, quoted: m })
        await m.react('✅')

    } catch (error) {
        console.error('Error usando endpoint nativo de Pinterest:', error)
        await m.react('❌')
        m.reply(`💔 Error en la conexión interna con los servidores de Pinterest.`)
    }
}

handler.help = ['pinterest <búsqueda>']
handler.tags = ['descargas']
handler.command = ['pinterest', 'pin']
handler.register = true

export default handler
