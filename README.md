# TFT Advisor

云顶之弈助手 - 基于 DataTFT 大数据的装备和阵容推荐工具

## 版本

本项目提供两个版本：

| 版本 | 目录 | 安装包大小 | 说明 |
|------|------|-----------|------|
| Tauri | `tauri/` | ~2.9 MB | 推荐使用，基于 Rust + WebView |
| Electron | `electron/` | ~96 MB | 传统版本，基于 Electron |

## 功能

- 🎯 **英雄装备推荐** - 基于 DataTFT 全服大数据，推荐最优单件和出装组合
- 🏆 **羁绊统计** - 显示英雄相关羁绊的胜率和前四率
- 👥 **相关弈子** - 分析常一起出现的英雄组合
- 👤 **个人数据** - 查看召唤师信息、常用英雄、最近对局
- 📊 **实时数据** - 连接 DataTFT API 获取最新统计数据

## 安装

### Tauri 版本（推荐）

下载 `TFT Advisor_1.1.0_x64-setup.exe` 安装版，或 `TFT Advisor_1.1.0_x64_en-US.msi`。

### Electron 版本

下载 `TFT Advisor Setup 1.0.0.exe` 安装版，或 `TFT Advisor 1.0.0.exe` 便携版。

## 开发

### Tauri 版本

```bash
cd tauri
npm install
npm run tauri dev    # 开发
npm run build        # 打包
```

### Electron 版本

```bash
cd electron
npm install
npm start            # 开发

# 打包 (使用国内镜像加速)
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/" npm run build
```

## 技术栈

### Tauri 版本
- Tauri v2 - 桌面应用框架
- Rust - 后端
- WebView - 前端渲染

### Electron 版本
- Electron - 桌面应用框架

### 共同
- DataTFT API - 云顶大数据接口
- LCU API - LOL 客户端本地接口

## 数据来源

- [DataTFT](https://www.datatft.com/) - 云顶大数据平台

## License

ISC