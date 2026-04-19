# @chromium-style-qrcode/mcp

[English](README.md)

一个用于生成 Chromium 风格二维码的 MCP（Model Context Protocol）服务，支持圆形模块、圆角定位器，以及可选的中心图片（Dino 恐龙或自定义图片）。

## 特性

- **Chromium 风格渲染** — 使用圆形点阵模块和圆角定位器，与 Google Chrome 生成的二维码完全一致
- **Dino 恐龙 Logo** — 默认在二维码中心绘制经典的 Chrome 小恐龙
- **自定义中心图片** — 传入 Base64 编码的图片以替换 Dino
- **切换中心图片** — 设置 `showLogo: false` 可以生成纯净的二维码
- **MCP 原生支持** — 通过 stdio 通信，兼容任何 MCP 客户端

## 安装

> **说明：** 不需要指定 `type: "stdio"` 字段 — 它是通过 `command` 和 `args` 配置的 MCP 服务的默认传输方式。

### 使用 npx（推荐）

无需安装：

```jsonc
{
  "mcpServers": {
    "io.github.chromium-style-qrcode/mcp": {
      "command": "npx",
      "args": ["-y", "@chromium-style-qrcode/mcp"]
    }
  }
}
```

### 使用 bunx

```jsonc
{
  "mcpServers": {
    "io.github.chromium-style-qrcode/mcp": {
      "command": "bunx",
      "args": ["@chromium-style-qrcode/mcp"]
    }
  }
}
```

### 全局安装

```bash
npm install -g @chromium-style-qrcode/mcp
```

然后配置 MCP 客户端：

```jsonc
{
  "mcpServers": {
    "io.github.chromium-style-qrcode/mcp": {
      "command": "chromium-style-qrcode-mcp"
    }
  }
}
```

## 工具

### `generate_qr_code`

生成 Chromium 风格的二维码，返回 PNG 图片。

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `text` | `string` | 是 | — | 要编码的文本或 URL |
| `showLogo` | `boolean` | 否 | `true` | 是否在中心显示 Logo |
| `customLogo` | `string` | 否 | — | Base64 编码的图片，用于替换默认的 Dino 恐龙 |

#### 示例

**带 Dino Logo 的标准二维码：**

```json
{
  "text": "https://example.com"
}
```

**纯净二维码（无中心图片）：**

```json
{
  "text": "https://example.com",
  "showLogo": false
}
```

**自定义中心图片的二维码：**

```json
{
  "text": "https://example.com",
  "customLogo": "<base64 编码的图片数据>"
}
```

## 开发

```bash
# 安装依赖
bun install

# 开发运行
bun run start

# 构建
bun run build

# 代码检查与格式化
bun run lint
bun run format
```

## 系统要求

- Node.js >= 22.14.0

## 许可证

[MIT](LICENSE)
