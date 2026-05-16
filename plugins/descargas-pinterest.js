import fetch from 'node-fetch';
import baileys from '@whiskeysockets/baileys';

async function sendAlbumMessage(conn, jid, medias, options = {}) {
    if (typeof jid !== "string") throw new TypeError(`jid must be string, received: ${jid}`);
    if (medias.length < 2) throw new RangeError("Se necesitan al menos 2 imágenes para un álbum");
    const caption = options.text || options.caption || "";
    const delay = !isNaN(options.delay) ? options.delay : 500;
    const quoted = options.quoted || null;
    delete options.text;
    delete options.caption;
    delete options.delay;
    delete options.quoted;
    const album = baileys.generateWAMessageFromContent(
        jid,
        { messageContextInfo: {}, albumMessage: { expectedImageCount: medias.length } },
        quoted ? { quoted } : {}
    );
    await conn.relayMessage(album.key.remoteJid, album.message, { messageId: album.key.id });
    for (let i = 0; i < medias.length; i++) {
        const { type, data } = medias[i];
        const img = await baileys.generateWAMessage(
            album.key.remoteJid,
            { [type]: data, ...(i === 0 ? { caption } : {}) },
            { upload: conn.waUploadToServer }
        );
        img.message.messageContextInfo = {
            messageAssociation: { associationType: 1, parentMessageKey: album.key },
        };
        await conn.relayMessage(img.key.remoteJid, img.message, { messageId: img.key.id });
        await baileys.delay(delay);
    }
    return album;
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) return m.reply(
        `⸸ *${global.botName}* · Buscador\n\n` +
        `...necesito saber qué buscar.\n` +
        `📌 Uso: *${usedPrefix + command} <búsqueda>*\n` +
        `Ejemplo: *${usedPrefix + command} Shizuku HxH*`
    );

    await m.react('⏳');

    try {
        const res = await fetch(
            `https://api.alyacore.xyz/search/pinterest?query=${encodeURIComponent(text)}&key=Duarte-zz12`
        );

        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const data = await res.json();

        if (!data.status || data.status !== true || !Array.isArray(data.data) || data.data.length < 2) {
            await m.react('❌');
            return m.reply('⸸ ...no encontré suficientes imágenes. intenta con otra búsqueda.');
        }

        const images = data.data.slice(0, 10).map(img => ({
            type: 'image',
            data: { url: img.hd }
        }));

        const caption =
            `✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖞𝖘𝖙𝖊𝖒 〕══ ✠\n\n` +
            `⸸ *Búsqueda:* ${text}\n` +
            `⸸ *Resultados:* ${images.length} imágenes\n\n` +
            `_...blinky las recolectó. de nada._ 🕷️`;

        await sendAlbumMessage(conn, m.chat, images, { caption, quoted: m });
        await m.react('✅');

    } catch (e) {
        console.error('Error pinterest:', e);
        await m.react('❌');
        m.reply(`⸸ ...algo falló. blinky tampoco pudo (${e.message})`);
    }
};

handler.help = ['pinterest <búsqueda>'];
handler.tags = ['buscador'];
handler.command = ['pinterest', 'pin'];
handler.register = true;

export default handler;
