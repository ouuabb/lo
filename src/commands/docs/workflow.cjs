const chalk = require('chalk');

module.exports = function() {
    console.log(chalk.bold.cyan('\n  工作流引擎（Phase 6.3）'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));

    console.log(chalk.bold.yellow('\n  一、概述'));
    console.log(`
  lo 工作流引擎提供步骤模型和条件驱动的执行引擎，允许用户
  定义和执行复杂的自动化流程。

  核心组件：
    - WorkflowEngine   — 工作流执行引擎
    - StepModel        — 步骤定义模型
    - ConditionEngine  — 条件评估引擎
    - Scheduler        — 定时调度器
    - ExecutionHistory — 执行记录`);

    console.log(chalk.bold.yellow('\n  二、步骤模型'));
    console.log(`
  每个工作流由一系列步骤组成，每个步骤有明确的输入/输出：

  步骤类型           说明
  ────────────────  ──────────────────────────────────
  action            执行具体操作（创建/更新/删除资源）
  condition         条件分支（if/else/switch）
  loop              循环（遍历资源列表）
  parallel          并行执行多个子步骤
  wait              等待指定时间或外部事件
  script            执行自定义脚本

  步骤定义示例：
    {
      id: "analyze",
      type: "action",
      action: "knowledge.analyze",
      input: { scope: "all" },
      onSuccess: "report-pass",
      onError: "report-fail"
    }`);

    console.log(chalk.bold.yellow('\n  三、条件引擎'));
    console.log(`
  条件引擎在工作流执行期间评估条件表达式：

  支持的条件类型：
    - 资源属性比较（hash、type、size、tags）
    - 时间条件（before、after、between）
    - 逻辑组合（and、or、not）
    - 自定义函数（通过插件扩展）`);

    console.log(chalk.bold.yellow('\n  四、调度器'));
    console.log(`
  调度器支持定时和事件驱动的工作流触发：

    触发方式          说明
    ────────────────  ──────────────────────────────────
    manual            手动执行（lo workflow run）
    scheduled         定时执行（cron 表达式）
    event-driven      事件触发（如 resource:created）
    chain             工作流链式调用`);

    console.log(chalk.gray('\n  相关命令：'));
    console.log(chalk.gray('    lo workflow list/run/status/history'));
    console.log(chalk.gray('    lo automation run  — 运行自动化管线'));
    console.log(chalk.gray('    lo manual workflow'));
    console.log('');
};
