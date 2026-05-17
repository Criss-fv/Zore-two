import fetch from 'node-fetch'
import baileys from '@whiskeysockets/baileys'

// Función nativa de tu código original para construir el álbum en Baileys
async function sendAlbumMessage(conn, chatId, mediaArray, options = {}) {
    const caption = options.caption || ''
    const delayTime = !isNaN(options.delay) ? options.delay : 500
    const quoted = options.quoted || null

    const albumStructure = {
        messageContextInfo: {},
        albumMessage: { expectedImageCount: mediaArray.length }
    }

    const preparedMaster = await baileys.generateWAMessage(chatId, albumStructure, quoted ? { quoted } : {})
    await conn.relayMessage(preparedMaster.key.remoteJid, preparedMaster.message, { messageId: preparedMaster.key.id })

    // Ejecución paralela ultra rápida de los mensajes del álbum
    await Promise.all(mediaArray.map(async (media, index) => {
        const messageContent = {
            [media.type]: media.data,
            ...(index === 0 ? { caption } : {})
        }

        const msg = await baileys.generateWAMessageContent(preparedMaster.key.id, messageContent, {
            upload: conn.waUploadToServer
        })

        const context = {
            broadcast: false,
            parentMessageKey: preparedMaster.key,
            messageContextInfo: {
                albumMessageContextInfo: { expectedImageCount: 1 }
            }
        }
        msg.messageContextInfo = context

        await conn.relayMessage(preparedMaster.key.remoteJid, msg, { messageId: preparedMaster.key.id })
    }))

    return preparedMaster
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const prefix = usedPrefix || global.prefix || '.'
    const currentCommand = typeof command === 'string' ? command : 'pinterest'
    const searchQuery = args.join(' ').trim()

    // Validación de entrada idéntica a tu código original
    if (!searchQuery) {
        return m.reply(
            `✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕══ ✠\n\n` +
            `⚠️ *Error de parámetros*\n` +
            `📌 Uso: *${prefix}${currentCommand} <búsqueda>*\n` +
            `💡 Ejemplo: *${prefix}${currentCommand} anime dark*\n\n` +
            `_...ingresa un término válido._ 🕷️`
        )
    }

    await m.react('⏳')

    try {
        // Tu endpoint específico solicitado
        const targetUrl = `https://apinagi.com/api/v1/buscadores/pinterest?apikey=apinagi2&query=${encodeURIComponent(searchQuery)}`
        
        const response = await fetch(targetUrl)
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`)

        const json = await response.json()
        
        // Verifica si la estructura trae resultados válidos
        if (!json.status || !Array.isArray(json.result) || json.result.length === 0) {
            await m.react('❌')
            return m.reply('❌ No se encontraron resultados que coincidan con tu búsqueda, darling~')
        }

        // Filtra los primeros 5 resultados y mapea al formato de álbum original
        const mediaElements = json.result.slice(0, 5).map(item => ({
            type: 'image',
            data: { url: item.hd || item.url } 
        }))

        // Caption original con la estética de Shizuku
        const captionText = 
            `✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕══ ✠\n\n` +
            `🌸 *Búsqueda:* ${searchQuery}\n` +
            `⸸ *Resultados enviados:* ${mediaElements.length}\n\n` +
            `_...blinky recolectó las imágenes con éxito._ 🕷️`

        // Envío optimizado
        await sendAlbumMessage(conn, m.chat, mediaElements, { caption: captionText, quoted: m })
        await m.react('✅')

    } catch (error) {
        console.error('Error en el módulo de Pinterest:', error)
        await m.react('❌')
        m.reply(`💔 Hubo un fallo interno en la infraestructura al procesar la red (${error.message})`)
    }
}

// Metadatos limpios, legibles y dinámicos para tu menú automático
handler.help = ['pinterest <búsqueda>']
handler.tags = ['descargas']
handler.command = ['pinterest', 'pin']
handler.register = true

export default handler
