module.exports = {
  extends: ['@commitlint/config-conventional'],

  plugins: [
    {
      rules: {
        // type 必须为英文
        'type-english': (parsed) => {
          const { type } = parsed;
          if (!type) return [true];
          if (/^[a-z]+$/.test(type)) {
            return [true];
          }
          return [false, 'type 必须为英文小写，如: feat, fix, docs, chore'];
        },
        // subject 必须包含中文
        'subject-chinese': (parsed) => {
          const { subject } = parsed;
          if (!subject) return [false, 'subject 不能为空'];
          if (/[\u4e00-\u9fa5]/.test(subject)) {
            return [true];
          }
          return [false, 'subject 必须包含中文'];
        },
      },
    },
  ],

  rules: {
    // 类型枚举
    'type-enum': [
      2,
      'always',
      [
        'feat',      // 新功能
        'fix',       // 修复bug
        'docs',      // 文档
        'style',     // 代码格式（不影响功能）
        'refactor',  // 重构
        'perf',      // 性能优化
        'test',      // 测试
        'build',     // 构建过程
        'ci',        // CI/CD
        'chore',     // 杂项
        'revert',    // 回滚
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],

    // scope 可选，英文小写
    'scope-case': [0],
    'scope-empty': [0],
    'scope-enum': [0],

    // subject 校验
    'subject-empty': [2, 'never'],
    'subject-full-stop': [0, 'never'],
    'subject-case': [0],

    // 自定义规则
    'type-english': [2, 'always'],
    'subject-chinese': [2, 'always'],

    // header 最大长度
    'header-max-length': [2, 'always', 72],
  },
};
