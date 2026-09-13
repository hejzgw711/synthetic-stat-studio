# Synthetic Data Studio

> 本旧站暂时停用，入口显示“ny正在迭代牛逼功能，敬请期待”。Pages 仅发布 `maintenance/` 静态页面，不发布工具脚本；已有登录状态也不能进入旧工具。源码和历史完整保留，恢复需用户确认后还原本次维护提交。以下内容为停用前的归档使用说明。

独立的约束随机模拟数据网页，用于统计教学、图表演示、软件测试和方法验证。

所有输出都标记为 `SIMULATED / 合成模拟数据`，不代表真实实验观测。

## 在线使用

推送到 GitHub 的 `main` 分支后，GitHub Actions 会自动完成测试、构建并发布到 GitHub Pages。

在线版完全在浏览器本地计算，不会自动上传用户输入或生成的数据。

## 本机开发

Windows 用户可直接双击 `启动网页.bat`，网页会在系统默认浏览器打开：

```text
http://localhost:5174/
```

```powershell
pnpm install
pnpm dev
pnpm test
pnpm build
```
