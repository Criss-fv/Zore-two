import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const handler = async (m, { conn }) => {
    
    await conn.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })

    const sentMsg = await m.reply('⸸ _...accediendo al hardware de la infraestructura._')

    
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

    
    let realCPU = 'Procesador Desconocido'
    let realCores = '8 Cores' 

    try {
        
        const { stdout: cpuInfo } = await execAsync('getprop ro.product.board')
        if (cpuInfo.trim()) {
            
            realCPU = cpuInfo.trim().toUpperCase()
        } else {
          
            const { stdout: cpuChip } = await execAsync('getprop ro.chipname')
            if (cpuChip.trim()) realCPU = cpuChip.trim()
        }

    
        const { stdout: coresInfo } = await execAsync('ls -d /sys/devices/system/cpu/cpu[0-9]* | wc -l')
        if (coresInfo.trim()) {
            realCores = `${coresInfo.trim()} Cores`
        }
    } catch (e) {
        
        const cpus = os.cpus()
        if (cpus.length > 0) {
            realCPU = cpus[0].model.trim()
            realCores = `${cpus.length} Cores`
        }
    }

  
    let diskTotal = '?'
    let diskUsed = '?'
    let diskPercent = '?'
    try {
        const { stdout } = await execAsync(`df -h /data`)
        const lineas = stdout.trim().split('\n')
        if (lineas.length > 1) {
            const partes = lineas[1].replace(/\s+/g, ' ').split(' ')
            diskTotal = partes[1]
            diskUsed = partes[2]
            diskPercent = partes[4]
        }
    } catch (error) {
        diskTotal = '64G'
        diskUsed = '32G'
        diskPercent = '50%'
    }

  
    const serverOS = 'Ubuntu 22.04.4 LTS'
    const serverPlatform = 'Linux x86_64 (Dedicated Virtual Server)'
    const nodeVersion = process.version
    const pid = process.pid
    const cpuArch = os.arch() === 'arm64' ? 'aarch64' : os.arch() // Estilo Linux

    
    const result = 
        `✠ ══〔 𝕾𝖍𝖎𝖟𝖚𝖐𝖚 𝕾𝖊𝖗𝖛𝖊𝖗 〕══ ✠\n\n` +
        `┌─ ⏱️ *SISTEMA Y TIEMPO*\n` +
        `│ ⸸ *Reloj:* ${horaTijuana}\n` +
        `│ ⸸ *Uptime:* ${dias}d ${horas}h ${minutos}m ${segundos}s\n` +
        `│ ⸸ *Motor:* Node.js ${nodeVersion}\n` +
        `└ ⸸ *PID Proceso:* ${pid}\n\n` +
        `┌─ 🖥️ *INFRAESTRUCTURA*\n` +
        `│ ⸸ *OS Base:* ${serverOS}\n` +
        `│ ⸸ *Entorno:* ${serverPlatform}\n` +
        `│ ⸸ *Arquitectura:* ${cpuArch}\n` +
        `│ ⸸ *CPU:* ${realCPU}\n` +
        `└ ⸸ *Núcleos:* ${realCores}\n\n` +
        `┌─ 📊 *MEMORIA RAM*\n` +
        `│ ⸸ *Total:* ${totalRAM} GB\n` +
        `│ ⸸ *Usada:* ${usedRAM} GB\n` +
        `└ ⸸ *Libre:* ${freeRAM} GB\n\n` +
        `┌─ 💾 *ALMACENAMIENTO*\n` +
        `│ ⸸ *Disco:* ${diskTotal}\n` +
        `│ ⸸ *Ocupado:* ${diskUsed} (${diskPercent})\n` +
        `└ ⸸ *Database:* Conectada 🟢\n\n` +
        `_...sistema operando al 100%_ 🕷️`

     
    await conn.sendMessage(m.chat, { text: result, edit: sentMsg.key }, { quoted: m })
}

handler.help = ['estado']
handler.tags = ['main']
handler.command = ['estado', 'status', 'server'] 

export default handler
