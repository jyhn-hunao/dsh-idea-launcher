// 配置类型的展示标签（纯函数，不依赖 React，便于单测）。
export function typeLabel(type: string): string {
  switch (type) {
    case 'spring-boot':
      return 'Spring Boot'
    case 'npm':
      return 'npm'
    case 'java-app':
      return 'Java'
    case 'compound':
      return 'Compound'
    default:
      return '未支持'
  }
}
