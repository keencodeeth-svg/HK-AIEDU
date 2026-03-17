import type {
  CapabilityBlock,
  Differentiator,
  FirstDayFlow,
  FirstLookItem,
  ProductStatusMetric,
  RoleLaunchCard
} from "./home.types";

export const HERO_PILLS = ["学生课表联动", "拍题即问", "教师默认下一步", "家长回执闭环", "学校 AI 一键排课"];

export const PRODUCT_STATUS_METRICS: ProductStatusMetric[] = [
  { label: "学生端", value: "主场化", helper: "课表、任务、拍题已收口" },
  { label: "教师端", value: "执行台", helper: "默认下一步已上线" },
  { label: "家长端", value: "行动台", helper: "今晚先做什么已上线" },
  { label: "学校端", value: "治理化", helper: "排课预演、回滚、规则齐备" }
];

export const FIRST_LOOK_ITEMS: FirstLookItem[] = [
  { title: "学生", description: "今日执行摘要、下一步动作、课表窗口与拍题入口。" },
  { title: "教师 / 家长", description: "先推最该做的一步，再展开分析、作业、回执与跟进。" },
  { title: "学校 / 平台", description: "先看风险和治理动作，再进入规则配置、排课、恢复和运营。" }
];

export const ROLE_LAUNCH_CARDS: RoleLaunchCard[] = [
  {
    id: "student",
    title: "学生",
    subtitle: "课表联动、今日任务、拍题即问、统一学习队列。",
    tag: "学习主场",
    primaryLabel: "进入学生端",
    primaryHref: "/login?role=student&entry=landing",
    secondaryLabel: "学生注册",
    secondaryHref: "/register?role=student&entry=landing",
    highlights: ["先看今天该做什么", "卡住就拍题", "围绕课表推进"]
  },
  {
    id: "teacher",
    title: "教师",
    subtitle: "默认下一步、作业发布、学情预警、学期排座与 AI 教学工具。",
    tag: "教学执行",
    primaryLabel: "进入教师端",
    primaryHref: "/login?role=teacher&entry=landing",
    secondaryLabel: "教师注册",
    secondaryHref: "/teacher/register?entry=landing",
    highlights: ["先处理阻塞项", "再发作业和看分析", "按学期排座微调"]
  },
  {
    id: "parent",
    title: "家长",
    subtitle: "今晚先做什么、周报行动卡、作业回执、订正跟进。",
    tag: "陪伴闭环",
    primaryLabel: "进入家长端",
    primaryHref: "/login?role=parent&entry=landing",
    secondaryLabel: "家长注册",
    secondaryHref: "/register?role=parent&entry=landing",
    highlights: ["今晚优先动作", "回执闭环", "不再只看报告"]
  },
  {
    id: "school",
    title: "学校",
    subtitle: "学校治理驾驶舱、AI 一键排课、模板约束、风险班级治理。",
    tag: "学校治理",
    primaryLabel: "进入学校端",
    primaryHref: "/login?role=school_admin&entry=landing",
    secondaryLabel: "学校管理员注册",
    secondaryHref: "/school/register?entry=landing",
    highlights: ["排前检查", "先预演再写入", "课表问题可回滚"]
  },
  {
    id: "admin",
    title: "平台管理",
    subtitle: "题库、知识点树、恢复工单、实验灰度、模型路由与可观测性。",
    tag: "平台运营",
    primaryLabel: "进入管理端",
    primaryHref: "/login?role=admin&entry=landing",
    secondaryLabel: "管理员注册",
    secondaryHref: "/admin/register?entry=landing",
    highlights: ["处理异常与恢复", "看实验与发布", "管理 AI 路由"]
  }
];

export const FIRST_DAY_FLOWS: FirstDayFlow[] = [
  {
    id: "student",
    roleLabel: "学生首日",
    tag: "1 天上手",
    href: "/student",
    steps: [
      { title: "打开学习控制台", description: "系统先把课表、任务和下一步动作排好，不需要自己猜。" },
      { title: "按课表窗口推进", description: "临近上课先看课前准备，卡题直接拍题，不再来回切页面。" },
      { title: "收口今日任务", description: "统一任务队列会自动区分今天必须先清和适合课后做的任务。" }
    ]
  },
  {
    id: "teacher",
    roleLabel: "教师首日",
    tag: "1 天起跑",
    href: "/teacher",
    steps: [
      { title: "先看默认下一步", description: "优先处理入班申请、学情预警和未形成闭环的班级。" },
      { title: "快速发出第一份作业", description: "班级一旦有任务，成绩册、分析和家校协同都会跟着启动。" },
      { title: "必要时进入学期排座", description: "用 AI 先出预览，再微调，避免全学期反复重排。" }
    ]
  },
  {
    id: "parent",
    roleLabel: "家长首日",
    tag: "今晚可用",
    href: "/parent",
    steps: [
      { title: "先看今晚先做什么", description: "系统先推最影响今晚学习节奏的一步，而不是让家长自己判断。" },
      { title: "按行动卡回执", description: "周报行动卡和作业行动卡都能打卡或说明跳过原因。" },
      { title: "围绕薄弱点做短陪伴", description: "少说泛泛提醒，多做 10-15 分钟的针对性陪练。" }
    ]
  },
  {
    id: "school",
    roleLabel: "学校首日",
    tag: "本周可落地",
    href: "/school/schedules",
    steps: [
      { title: "先看治理总览", description: "学校控制台先告诉你哪些班级、教师或课表环节最值得优先修。" },
      { title: "补模板和约束", description: "先补教师禁排、教师规则、同年级同学科模板，再开 AI 预演。" },
      { title: "AI 预演后再写入", description: "写入前能看结果、写入后可回滚，避免误操作覆盖全校课表。" }
    ]
  }
];

export const DIFFERENTIATORS: Differentiator[] = [
  { title: "不是只给功能，而是先给默认下一步", description: "学生、教师、家长都逐步被改造成“先告诉你该做什么”，而不是自己拼入口。" },
  { title: "不是只给 AI，而是先做可执行治理", description: "学校排课、教师排座都强调预演、约束、微调、回滚，适配真实场景。" },
  { title: "不是只看数据，而是推进回执闭环", description: "家长端、教师端都围绕“看见问题 → 立刻行动 → 留下回执”构建主路径。" }
];

export const CAPABILITY_BLOCKS: CapabilityBlock[] = [
  {
    title: "学生不再犹豫下一步",
    description: "把课表、今日执行摘要、快问快答和统一任务队列收敛到一个学习主场。",
    icon: "rocket",
    href: "/student"
  },
  {
    title: "教师先处理真正阻塞项",
    description: "从首页就能看到入班申请、活跃预警、临近截止作业和班级风险趋势。",
    icon: "chart",
    href: "/teacher"
  },
  {
    title: "家长端是行动台，不只是周报页",
    description: "先推今晚先做什么，再看作业、订正、薄弱点和收藏题复盘。",
    icon: "board",
    href: "/parent"
  },
  {
    title: "学校排课可预演、可回滚、可治理",
    description: "从模板、规则、禁排时段到 AI 一键排课，全都围绕真实管理体验。",
    icon: "brain",
    href: "/school/schedules"
  }
];
