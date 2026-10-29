// 配置类型图标：无外部资源、无网络字体，纯内联 SVG，按类型区分（对齐 IDEA 用图标区分运行配置的习惯）。
// 颜色只用于"区分类型"，容器与文字仍然继承宿主主题。
import React from 'react'

const SIZE = 14

export { typeLabel } from './config-type.ts'

export function ConfigIcon(props: { type: string; size?: number }): React.ReactElement {
  const size = props.size ?? SIZE
  switch (props.type) {
    // Spring Boot：叶子
    case 'spring-boot':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
          <path
            d="M13.6 2.2c.4 4.9-2.3 9.2-7.3 9.9-1.6.2-3-.2-4-1.1 2.6.4 4.6-.4 6-2.1 1.3-1.6 2-3.7 2.5-5.4.8.4 1.7.6 2.8.7z"
            fill="#6db33f"
          />
          <path d="M3.5 11.3c1.7 1.5 4.2 1.6 6.1.6-2.4-.1-4.3-.8-6.1-2.8z" fill="#4f8f2f" />
        </svg>
      )
    // npm：包裹箱
    case 'npm':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
          <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" fill="#cb3837" />
          <rect x="4" y="6" width="2" height="4" fill="#fff" opacity="0.92" />
          <rect x="7.5" y="6" width="2" height="4" fill="#fff" opacity="0.92" />
          <rect x="11" y="6" width="1.5" height="2.6" fill="#fff" opacity="0.92" />
        </svg>
      )
    // Java：咖啡杯
    case 'java-app':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M3.2 8.2h7.2v2.4a3.6 3.6 0 0 1-3.6 3.6H6.8a3.6 3.6 0 0 1-3.6-3.6z" fill="#e76f00" />
          <path d="M10.8 8.8h1.3a1.6 1.6 0 0 1 0 3.2h-1.3" fill="none" stroke="#e76f00" strokeWidth="1.2" />
          <path
            d="M6 2.2c.9.9-.6 1.6 0 2.6M9 2.2c.9.9-.6 1.6 0 2.6"
            fill="none"
            stroke="#c94f00"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      )
    // Compound：叠加的层
    case 'compound':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
          <rect x="2" y="3" width="8" height="6" rx="1.2" fill="#8b5cf6" opacity="0.55" />
          <rect x="6" y="7" width="8" height="6" rx="1.2" fill="#8b5cf6" />
        </svg>
      )
    // 其余（JUnit / Maven / 未识别）：虚线方框，表示"有，但当前不支持"
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
          <rect
            x="2.5"
            y="2.5"
            width="11"
            height="11"
            rx="2"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.2"
            strokeDasharray="2.4 1.8"
          />
        </svg>
      )
  }
}
