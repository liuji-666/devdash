# PRD: 晨间处理流 (Morning Triage)

## 问题陈述

开发者每天早上需要花费 10-15 分钟在多个平台（GitHub、GitLab、Jira、Linear）之间切换，检查需要处理的事项。这个过程：
- 容易遗漏重要事项
- 上下文切换成本高
- 没有统一的优先级视图

## 解决方案

在 DevDash 中实现 **Morning Triage** 模式：
- 一键进入全屏处理视图
- 聚合所有待办事项（审查请求、分配的 Issue、通知）
- 按优先级自动排序
- 支持键盘快捷键快速处理

## 用户故事

1. 作为开发者，我每天早上打开 DevDash 时，想看到一个统一的待办列表，这样我可以快速知道今天需要处理什么。

2. 作为开发者，当我看到需要审查的 PR 时，我想一键批准或请求修改，这样我不需要打开浏览器。

3. 作为开发者，当我处理完一个事项后，想快速跳转到下一个，这样我可以保持心流状态。

4. 作为 Tech Lead，我想知道团队中最紧急的审查请求是什么，这样我可以优先处理阻塞他人的 PR。

5. 作为开发者，我想区分"需要我行动"和"只是通知我"的事项，这样我不会被无关信息干扰。

6. 作为开发者，当我跳过某个事项时，想设置提醒时间（如"2小时后提醒我"），这样我不会忘记处理。

7. 作为开发者，我想在处理完所有紧急事项后，看到一个"今日概览"总结，这样我有成就感。

8. 作为开发者，当我在 Triage 模式中时，想使用键盘导航（J/K 上下移动，Enter 处理），这样我不需要频繁使用鼠标。

9. 作为开发者，当我对某个 PR 有疑问时，想快速跳转到浏览器查看完整 diff，这样我可以做出更好的审查决策。

10. 作为开发者，当所有事项处理完毕后，想自动退出 Triage 模式回到正常 Dashboard，这样我可以继续其他工作。

## 实现决策

### 模块设计

1. **TriageEngine** (Rust)
   - 聚合所有数据源的待办事项
   - 计算优先级分数
   - 提供过滤和排序接口

2. **TriageQueue** (Rust)
   - 存储当前 Triage 会话的队列状态
   - 记录处理历史
   - 支持"稍后提醒"功能

3. **MorningTriageModal** (React)
   - 全屏覆盖式 UI
   - 显示待办队列
   - 处理用户操作

4. **TriageItem** (React)
   - 单个待办事项的展示
   - 根据类型显示不同操作按钮
   - 显示优先级和等待时间

### 数据源集成

- GitHub: `review-requested:@me`, `assignee:@me`, `/notifications`
- GitLab: `merge_requests?scope=assigned_to_me`
- Jira: `assignee = currentUser()`
- Linear: GraphQL `issues(filter: { assignee: { id: { eq: me } } })`

### 优先级算法

```
score = base_priority + time_factor + source_factor

base_priority:
  - review_requested: 100
  - assigned_issue: 80
  - notification: 20

time_factor:
  - waiting_hours * 2

source_factor:
  - ci_failure: +50
  - mentioned: +10
```

### 快捷操作映射

| 按键 | 操作 |
|------|------|
| J / ↓ | 下一个事项 |
| K / ↑ | 上一个事项 |
| Enter | 执行主操作（审查→批准，Issue→打开） |
| A | 批准 PR |
| R | 请求修改 |
| M | 合并 PR |
| C | 关闭 |
| S | 跳过 / 稍后提醒 |
| O | 在浏览器打开 |
| Esc | 退出 Triage 模式 |

## 测试决策

### 测试范围

1. **TriageEngine 单元测试**
   - 优先级排序逻辑
   - 去重逻辑（同一 PR 可能出现在多个查询中）
   - 过滤逻辑

2. **集成测试**
   - 端到端 Triage 流程
   - 键盘快捷键测试

3. **不测试**
   - 具体 API 响应（使用 mock）
   - UI 细节（使用快照测试）

### 测试示例

```rust
#[test]
fn test_priority_sorting() {
    let items = vec![
        create_item("review_requested", 24), // 等待 24h
        create_item("assigned_issue", 0),    // 新分配
        create_item("notification", 48),     // 等待 48h
    ];
    let sorted = TriageEngine::sort_by_priority(items);
    assert_eq!(sorted[0].kind, "review_requested"); // 最高优先级
    assert_eq!(sorted[1].kind, "assigned_issue");
    assert_eq!(sorted[2].kind, "notification");
}
```

## 不在范围内

1. **AI 自动审查**: 不实现 AI 自动批准或合并
2. **邮件集成**: 不集成邮件通知
3. **Slack 集成**: 不发送 Slack 提醒
4. **移动端支持**: 仅桌面端

## 进一步说明

### 性能考虑

- Triage 数据从本地 SQLite 读取，不直接调用 API
- 首次进入 Triage 时可能需要等待数据刷新
- 支持"离线模式"（使用缓存数据）

### 安全考虑

- 快捷操作需要确认（特别是合并和关闭）
- 支持撤销操作（在 5 秒内）
- 敏感操作（合并到 main）需要额外确认

### 未来扩展

1. **团队 Triage**: Tech Lead 可以查看整个团队的待办
2. **智能提醒**: 基于用户习惯推荐最佳处理时间
3. **统计报告**: 每周生成处理效率报告
