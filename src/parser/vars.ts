// IDEA 路径变量替换。
// 只替换「有确定来源」的变量：
//   $PROJECT_DIR$ = 项目根
//   $MODULE_DIR$  = 模块根（模块未解析出时视为未知，不拿项目根顶替）
//   $USER_HOME$   = 用户主目录
// 其余变量保留原文并登记为 unknown，由调用方转成诊断——不静默留空、不猜测。
export interface VarContext {
  projectRoot: string
  /** 模块根；undefined 表示当前配置没有可解析的模块 */
  moduleRoot?: string
  userHome?: string
}

export interface VarSubstitution {
  text: string
  /** 本次替换中遇到但无法解析的变量名（去重、保持出现顺序） */
  unknown: string[]
}

const VAR_PATTERN = /\$([A-Za-z0-9_]+)\$/g

export function substituteVars(input: string | undefined, ctx: VarContext): VarSubstitution {
  // 1. 空输入直接返回，避免把 undefined 拼进路径
  if (!input) return { text: '', unknown: [] }

  const userHome = ctx.userHome ?? process.env.USERPROFILE ?? process.env.HOME
  const known: Record<string, string | undefined> = {
    PROJECT_DIR: ctx.projectRoot,
    MODULE_DIR: ctx.moduleRoot,
    USER_HOME: userHome,
  }

  const unknown: string[] = []

  // 2. 单次扫描完成替换：命中已知变量就替换，否则原样保留并登记
  const text = input.replace(VAR_PATTERN, (whole, name: string) => {
    const value = known[name]
    if (value === undefined) {
      if (!unknown.includes(name)) unknown.push(name)
      return whole
    }
    return value
  })

  return { text, unknown }
}
