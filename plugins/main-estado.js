import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'


const execAsync = promisify(exec)

const handler = async (m, { conn }) => {
    
    await conn.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })

    const sentMsg = await m.reply('⸸ _...analizando la infraestructura del servidor._')

    
    const uptime = process.uptime()
    const dias = Math.floor(uptime / 86400)
    const horas = Math.floor((uptime % 86400) / 3600)
    const minutos = Math.floor((uptime % 3600) / 60)
    const segundos = Math.floor(uptime % 60)

    
    const opcionesHora = { 
        timeZone: 'America/Tijuana', 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        weekday: 'short', 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    }
    const horaTijuana = new Date().toLocaleString('es-MX', opcionesHora)

    
    const totalRAM = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2)
    const freeRAM = (os.freemem() / 1024 / 1024 / 1024).toFixed(2)
    const usedRAM = (totalRAM - freeRAM).toFixed(2)

    
    const cpus = os.cpus()
    const cpuModel = cpus[0] ? cpus[0].model.trim() : 'Procesador Desconocido'
    const cores = cpus.length

    
    let diskTotal = '?'
    let diskUsed = '?'
    let diskPercent = '?'
    
    try {
        const path = os.platform() === 'android' ? '/data' : '/'
        const { stdout } = await execAsync(`df -h ${path}`)
        const lineas = stdout.trim().split('\n')
        
        if (lineas.length > 1) {
            
            const partes = lineas[1].replace(/\s+/g, ' ').split(' ')
            diskTotal = partes[1]   // Tamaño total
            diskUsed = partes[2]    // Tamaño usado
            diskPercent = partes[4] // Porcentaje %
        }
    } catch (error) {
        diskTotal = 'No disponible'
        diskUsed = 'No disponible'
    }

    
    const osType = os.type()
    const osPlatform = os.platform() === 'android' ? 'Termux (Android Environment)' : 'Linux Server'
    const osArch = os.arch()

    
    const result = 
        `✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖊𝖗𝖛𝖊𝖗 𝕾𝖙𝖆𝖙𝖚𝖘 〕══ ✠\n\n` +
        `⏱️ *TIEMPO DEL SISTEMA*\n` +
        `⸸ *Hora Local:* ${horaTijuana}\n` +
        `⸸ *Bot Activo:* ${dias}d ${horas}h ${minutos}m ${segundos}s\n\n` +
        `🖥️ *HARDWARE Y SISTEMA*\n` +
        `⸸ *Plataforma:* ${osPlatform} (${osArch})\n` +
        `⸸ *OS Base:* ${osType}\n` +
        `⸸ *CPU:* ${cpuModel}\n` +
        `⸸ *Núcleos:* ${cores} Cores\n\n` +
        `📊 *RECURSOS RAM*\n` +
        `⸸ *Total:* ${totalRAM} GB\n` +
        `⸸ *Usada:* ${usedRAM} GB\n` +
        `⸸ *Libre:* ${freeRAM} GB\n\n` +
        `💾 *ALMACENAMIENTO*\n` +
        `⸸ *Total Disco:* ${diskTotal}\n` +
        `⸸ *Ocupado:* ${diskUsed} (${diskPercent})\n\n` +
        `_...todo operando dentro de los parámetros._ 🕷️`

    
    await conn.sendMessage(m.chat, { text: result, edit: sentMsg.key }, { quoted: m })
}

handler.help = ['estado']
handler.tags = ['main']
// Puedes invocarlo con .estado, .status o .server
handler.command = ['estado', 'status', 'server'] 

export default handler
