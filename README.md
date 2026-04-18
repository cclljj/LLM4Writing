# llm4rwiting

[![Java](https://img.shields.io/badge/Java-17-blue)](https://adoptium.net/)
[![Maven](https://img.shields.io/badge/Build-Maven-C71A36)](https://maven.apache.org/)
[![Framework](https://img.shields.io/badge/Web-Apache%20Wicket-6A1B9A)](https://wicket.apache.org/)
[![Status](https://img.shields.io/badge/Status-Active%20Development-orange)](https://github.com/cclljj/llm4writing_fork)

AI-assisted writing learning platform built with Java + Wicket.  
這是一個以 Java + Wicket 實作的 AI 輔助寫作學習平台。

## Overview | 專案概覽

- Student side: staged AI-assisted writing workflow  
  學生端：分階段寫作學習流程（含 AI 對話）
- Teacher side: topic/class/group management  
  教師端：題目、開課、分組管理
- Infra: MySQL + MongoDB + OpenAI API  
  基礎設施：MySQL + MongoDB + OpenAI API

## Current Status | 目前狀態

This repository is a partially implemented production-style system.
目前為「部分落地」版本，核心功能可運作，但尚未完整對齊 10 步驟目標規格。

Implemented now | 目前已完成：

- Student flow up to `Phase1 ~ Phase5`
- Teacher course management (topic/class/group)
- Realtime chat updates via WebSocket

Not fully implemented yet | 尚未完整落地：

- Full `Phase6 ~ Phase10` pages
- Teacher classroom monitoring/control pages
- Complete Prompt/Question Bank UI flow

## Documentation | 文件

- Product spec: [SPEC.md](./SPEC.md)
- AI-generated system understanding: [SPEC_generated_by_AI.md](./SPEC_generated_by_AI.md)
- Spec gap report: [SPEC_diff.md](./SPEC_diff.md)

## Tech Stack | 技術棧

- Java 17
- Apache Wicket
- Jakarta EE / CDI / JPA
- MySQL
- MongoDB
- OpenAI API (Responses / Audio Transcription)
- Maven

## Repository Structure | 目錄結構

```text
.
├── libs/                 # domain/services/repositories/OpenAI integration
├── llm4class-web/        # Wicket web application (pages/panels/modals/assets)
├── database/
│   ├── mysql/            # MySQL schema/dump
│   └── mongodb/          # Mongo init script
├── SPEC.md
├── SPEC_generated_by_AI.md
└── SPEC_diff.md
```

## Quick Start | 快速開始

> Note: there is no root aggregator `pom.xml` in this repo currently.  
> 注意：目前 repo 根目錄沒有 aggregator `pom.xml`，請分模組建置。

### 1) Build shared library module

```bash
mvn -f libs/pom.xml clean package
```

### 2) Build web module

```bash
mvn -f llm4class-web/pom.xml clean package
```

## Runtime Requirements | 執行需求

- JDK 17+
- Maven 3.8+
- MySQL
- MongoDB
- OpenAI API key and environment configuration
- Jakarta-compatible servlet/app server for WAR deployment

## Release / Tag Notes | 版本註記

- `1.0`: baseline version without `SPEC*.md` files  
  message: `Fork from https://github.com/Shengche/llm4rwiting`

## Roadmap (Suggested) | 建議開發路線

1. Implement `Phase6 ~ Phase10` + mode-specific UI/behavior
2. Finish teacher monitoring/progress control pages
3. Fully wire Prompt & Question Bank admin workflow
4. Add end-to-end validations for group isolation and stage control

## Contributing | 貢獻

Pull requests and issue reports are welcome.  
歡迎提出 Issue 與 PR。
