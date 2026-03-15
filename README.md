# TFT Advisor

云顶之弈助手 - 基于 DataTFT 大数据的装备和阵容推荐工具

## 功能

- 🎯 **英雄装备推荐** - 基于 DataTFT 全服大数据，推荐最优单件和出装组合
- 🏆 **羁绊统计** - 显示英雄相关羁绊的胜率和前四率
- 👥 **相关弈子** - 分析常一起出现的英雄组合
- 📊 **实时数据** - 连接 DataTFT API 获取最新统计数据

## 安装

下载 `TFT Advisor Setup 1.0.0.exe` 安装版，或 `TFT Advisor 1.0.0.exe` 便携版。

## 开发

```bash
# 安装依赖
npm install

# 运行开发版
npm start

# 打包 (使用国内镜像加速)
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/" npm run build
```

## 技术栈

- Electron - 桌面应用框架
- DataTFT API - 云顶大数据接口
- LCU API - LOL 客户端本地接口

## 数据来源

- [DataTFT](https://www.datatft.com/) - 云顶大数据平台

## License

ISC