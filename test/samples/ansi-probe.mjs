// ANSI 探针：输出带颜色的若干行，用来验证日志视图保留颜色（以及后端是否把 ESC 原样透传）。
const R = '\u001b[0m'
const red = (s) => `\u001b[31m${s}${R}`
const green = (s) => `\u001b[32m${s}${R}`
const yellow = (s) => `\u001b[33m${s}${R}`
const bold = (s) => `\u001b[1m${s}${R}`
const bg = (s) => `\u001b[41;97m${s}${R}`

console.log(`${green('[INFO]')} 启动成功 ${bold('Grape-Service')}`)
console.log(`${yellow('[WARN]')} 连接池未配置，使用默认值`)
console.log(`${red('[ERROR]')} 连接 Nacos 失败 ${bg(' FATAL ')}`)
console.log('plain line without color')
setTimeout(() => {}, 1500)
