/**
 * 💗 COMANDO: sinprefix
 * Permite encender/apagar los comandos sin prefijo
 * Solo disponible para OWNER/ROWNER
 */

export default async (m, { conn, args, isOwner, isROwner, prefix, db }) => {
    // 🔐 Solo owner/rowner
    if (!isROwner && !isOwner) {
        return m.reply('👑 *ACCESO DENEGADO*\nSolo el creador puede usar este comando.')
    }

    const action = args[0]?.toLowerCase()

    // Inicializar settings si no existe
    if (!db.settings) db.settings = {}

    if (!action || !['on', 'off'].includes(action)) {
        const estado = db.settings.sinprefix !== false ? '✅ ACTIVADO' : '❌ DESACTIVADO'
        return m.reply(
            `💗 *SISTEMA SIN PREFIJO* 💗\n\n` +
            `Estado actual: ${estado}\n\n` +
            `Uso:\n` +
            `${prefix}sinprefix on - Activar comandos sin prefijo\n` +
            `${prefix}sinprefix off - Desactivar comandos sin prefijo\n\n` +
            `📝 Con esto activado, puedes usar comandos escribiendo solo el nombre:\n` +
            `Ejemplo: menu, ping, help (sin necesidad de . # / o /)`
        )
    }

    if (action === 'on') {
        db.settings.sinprefix = true
        await conn.sendMessage(m.chat, {
            text: '✅ *SISTEMA SIN PREFIJO ACTIVADO*\n\n💗 Ahora puedes usar los comandos escribiendo solo su nombre:\n\n' +
                'Ejemplo:\n' +
                '.menu ← Con prefijo\n' +
                'menu ← Sin prefijo (NUEVO!)\n\n' +
                '📝 Palabras ignoradas para no causar conflictos:\n' +
                '_hola, hey, ok, vale, sí, no, buenas, gracias_'
        }, { quoted: m })
    } else if (action === 'off') {
        db.settings.sinprefix = false
        await conn.sendMessage(m.chat, {
            text: '❌ *SISTEMA SIN PREFIJO DESACTIVADO*\n\n' +
                'Ahora solo funcionan los comandos con prefijo:\n' +
                '.menu\n' +
                '#ping\n' +
                '/help'
        }, { quoted: m })
    }
}

// 📋 METADATOS DEL COMANDO
export default.command = 'sinprefix'
export default.alias = ['noprefix', 'prefixoff']
export default.desc = 'Activa/desactiva comandos sin prefijo (solo owner)'
export default.owner = true
export default.rowner = false
export default.admin = false
export default.group = false
export default.private = false
export default.premium = false
export default.register = false
export default.limit = false
