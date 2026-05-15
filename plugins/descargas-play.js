import fetch from 'node-fetch'
import yts from 'yt-search'

const API_KEY = 'zyzz-1234'

const handler = async (msg, { conn, args, usedPrefix, command }) => {
    const query = args.join(' ').trim()

    if (!query) {
        return conn.sendMessage(msg.chat, {
            text: `✳️ *Uso del comando:*\n\n` +
                  `\( {usedPrefix} \){command} <nombre de la canción o video>\n\n` +
                  `Ejemplo: \( {usedPrefix} \){command} bad bunny tití me preguntó`
        }, { quoted: msg })
    }

    // Mensaje de búsqueda
    await conn.sendMessage(msg.chat, {
        text: '🎧 *Buscando audio...*'
    }, { quoted: msg })

    try {
        // Buscar en YouTube
        const search = await yts(query)
        if (!search.videos?.length) {
            throw new Error('No se encontraron resultados en YouTube.')
        }

        const video = search.videos[0]

        // Usar la API que proporcionaste
        const apiUrl = `https://rest.apicausas.xyz/api/v1/descargas/youtube?url=\( {encodeURIComponent(video.url)}&type=audio&apikey= \){API_KEY}`

        const res = await fetch(apiUrl)
        const data = await res.json()

        // Validar respuesta de la API
        if (!data?.data?.download?.url) {
            throw new Error('La API no devolvió un enlace de descarga válido.')
        }

        const title = data.data.info?.title || video.title || 'Audio desconocido'
        const thumbnail = data.data.info?.thumbnail || video.thumbnail
        const author = video.author?.name || 'Desconocido'

        // Información del audio
        const info = `🎵 *${title}*\n\n` +
                     `👤 *Canal:* ${author}\n` +
                     `⏱️ *Duración:* ${video.timestamp || 'N/A'}\n` +
                     `👀 *Vistas:* ${video.views?.toLocaleString() || 'N/A'}\n` +
                     `🔗 ${video.url}`

        // Enviar imagen + información
        if (thumbnail) {
            await conn.sendMessage(msg.chat, {
                image: { url: thumbnail },
                caption: info
            }, { quoted: msg })
        } else {
            await conn.sendMessage(msg.chat, { text: info }, { quoted: msg })
        }

        // Enviar el audio
        await conn.sendMessage(msg.chat, {
            audio: { url: data.data.download.url },
            mimetype: 'audio/mpeg',
            fileName: `${sanitizeFilename(title)}.mp3`
        }, { quoted: msg })

    } catch (error) {
        console.error('Error en comando play:', error)
        await conn.sendMessage(msg.chat, {
            text: `❌ *Error:* ${error.message || 'Ocurrió un problema al descargar el audio.'}`
        }, { quoted: msg })
    }
}

// Registrar comandos
handler.help = ['play <título>', 'ytmp3 <título>']
handler.tags = ['download']
handler.command = ['play', 'ytmp3']

export default handler

// Función para limpiar nombres de archivo
function sanitizeFilename(name = 'audio') {
    return name
        .replace(/[\\/:*?"<>|]/g, '')  // Eliminar caracteres inválidos
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100)
}