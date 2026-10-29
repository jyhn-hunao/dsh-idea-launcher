// Client 半入口：两处注册。
//   1. 顶栏右侧工具区（list，session）：运行控件 [配置名 ▾][▶/■][⋯]；
//   2. 会话列内的日志窗口（conversation.input.dock，list/session）：整宽、独占一行。
// 为什么不用 shell.bottom：它是"所有栏下方"的整宽带，即便只对齐到会话列，
// 这一带的高度仍会占掉整个窗口底部（左栏底部会变白，实测被否）。
// 为什么不用 composer.dock：那是输入栏里的横排行（不换行），条目只能并排，撑不满整列。
import { LauncherPill } from './ui/LauncherPill.tsx'
import { LogDock } from './ui/LogDock.tsx'

interface ClientContextLike {
  slots: {
    inject(key: string, callback: () => () => void): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
}

export const inject = ['slots']

export function apply(ctx: ClientContextLike): void {
  // 1. 顶栏运行控件：右侧工具区最左（order -20）
  ctx.slots.inject('conversation.session.header.utilities', () =>
    ctx.slots.register(
      { name: 'conversation.session.header.utilities', id: 'idea-launcher', order: -20, label: '运行' },
      LauncherPill,
    ),
  )

  // 2. 日志窗口：注册在所有栏下方的整宽带（shell.bottom）。
  //    取舍：这一带会缩短左右栏底部（左栏底部出现空白），但位置稳定、不依赖测量；
  //    会话列内的 input.dock 虽然不影响侧边栏，但位置在输入框上方，用户不要。
  ctx.slots.inject('shell.bottom', () => ctx.slots.register({ name: 'shell.bottom' }, LogDock))
}
