import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

const SHOWCASE_PREFIX = "showcase";
const SCHOOL_ID = "showcase-school-haizhou";
const SCHOOL_CODE = "HZSY";
const SCHOOL_NAME = "海州实验学校";

const TEACHER_PASSWORD = "EduAI-Teacher-2026";
const STUDENT_PASSWORD = "EduAI-Student-2026";
const PARENT_PASSWORD = "EduAI-Parent-2026";
const SCHOOL_ADMIN_PASSWORD = "EduAI-School-2026";
const ADMIN_PASSWORD = "EduAI-Admin-2026";

const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");

const OPTION_KEYS = ["A", "B", "C", "D"];
const MAIN_CAMPUS = "主校区";
const EAST_CAMPUS = "东校区";
const WEST_CAMPUS = "西校区";

const USER_IDS = {
  platformAdmin: "showcase-user-admin-songzewei",
  schoolAdmin: "showcase-user-schooladmin-zhoulan",
  teacherLiqing: "showcase-user-teacher-liqing",
  teacherWangnan: "showcase-user-teacher-wangnan",
  teacherChenrui: "showcase-user-teacher-chenrui",
  teacherSunya: "showcase-user-teacher-sunya",
  teacherXuzhe: "showcase-user-teacher-xuzhe",
  teacherHeyan: "showcase-user-teacher-heyan",
  studentLinZhiyuan: "showcase-user-student-linzhiyuan",
  studentSuYutong: "showcase-user-student-suyutong",
  studentChenYichen: "showcase-user-student-chenyichen",
  studentXuMuqing: "showcase-user-student-xumuqing",
  studentZhaoYuhang: "showcase-user-student-zhaoyuhang",
  studentHeJianing: "showcase-user-student-hejianing",
  studentJiangHaochen: "showcase-user-student-jianghaochen",
  studentShenZhiruo: "showcase-user-student-shenzhiruo",
  studentZhouJingxing: "showcase-user-student-zhoujingxing",
  studentGuYuanan: "showcase-user-student-guyuanan",
  studentTangYifan: "showcase-user-student-tangyifan",
  studentSongKexin: "showcase-user-student-songkexin",
  parentLinZhihong: "showcase-user-parent-linzhihong",
  parentSuWenjing: "showcase-user-parent-suwenjing",
  parentChenXiaolan: "showcase-user-parent-chenxiaolan",
  parentXuRuining: "showcase-user-parent-xuruining",
  parentZhaoMin: "showcase-user-parent-zhaomin",
  parentHeDonglai: "showcase-user-parent-hedonglai",
  parentJiangXuemei: "showcase-user-parent-jiangxuemei",
  parentShenZhuoran: "showcase-user-parent-shenzhuoran",
  parentZhouYajun: "showcase-user-parent-zhouyajun",
  parentGuMingze: "showcase-user-parent-gumingze",
  parentTangHui: "showcase-user-parent-tanghui",
  parentSongYan: "showcase-user-parent-songyan"
};

const CLASS_IDS = {
  g4Math: "showcase-class-g4-1-math",
  g4Chinese: "showcase-class-g4-1-chinese",
  g4English: "showcase-class-g4-1-english",
  g7Math: "showcase-class-g7-2-math",
  g7Chinese: "showcase-class-g7-2-chinese",
  g7English: "showcase-class-g7-2-english",
  g7MathAdvanced: "showcase-class-g7-2-math-advanced"
};

const MODULE_IDS = {
  g4MathCore: "showcase-module-g4-math-core",
  g4MathReview: "showcase-module-g4-math-review",
  g4ChineseReading: "showcase-module-g4-chinese-reading",
  g4ChineseWriting: "showcase-module-g4-chinese-writing",
  g4EnglishUnit: "showcase-module-g4-english-unit",
  g7MathCore: "showcase-module-g7-math-core",
  g7MathReview: "showcase-module-g7-math-review",
  g7ChineseReading: "showcase-module-g7-chinese-reading",
  g7ChineseWriting: "showcase-module-g7-chinese-writing",
  g7EnglishReading: "showcase-module-g7-english-reading",
  g7EnglishWriting: "showcase-module-g7-english-writing",
  g7AdvancedMath: "showcase-module-g7-advanced-math"
};

const KP_IDS = {
  math4MixedCalc: "showcase-kp-math-4-mixed-calc",
  math4Decimal: "showcase-kp-math-4-decimal",
  math4Area: "showcase-kp-math-4-area",
  chinese4Paragraph: "showcase-kp-chinese-4-paragraph-main",
  chinese4Character: "showcase-kp-chinese-4-character-writing",
  chinese4Rhetoric: "showcase-kp-chinese-4-rhetoric",
  english4ThereBe: "showcase-kp-english-4-there-be",
  english4Routine: "showcase-kp-english-4-routine",
  english4Weather: "showcase-kp-english-4-weather",
  math7Rational: "showcase-kp-math-7-rational",
  math7LinearEquation: "showcase-kp-math-7-linear-equation",
  math7Expression: "showcase-kp-math-7-expression",
  chinese7Narrative: "showcase-kp-chinese-7-narrative-clue",
  chinese7Classical: "showcase-kp-chinese-7-classical-word",
  chinese7Exposition: "showcase-kp-chinese-7-exposition-method",
  english7PastTense: "showcase-kp-english-7-past-tense",
  english7ReadingLocate: "showcase-kp-english-7-reading-locate",
  english7Writing: "showcase-kp-english-7-writing-structure"
};

function now() {
  return new Date();
}

function iso(value) {
  return new Date(value).toISOString();
}

function withDateOffset({ days = 0, hours = 0, minutes = 0, anchor = now(), atHour, atMinute = 0 }) {
  const date = new Date(anchor);
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  date.setMinutes(date.getMinutes() + minutes);
  if (typeof atHour === "number") {
    date.setHours(atHour, atMinute, 0, 0);
  }
  return date.toISOString();
}

function daysAgo(days, hour = 9, minute = 0) {
  return withDateOffset({ days: -days, atHour: hour, atMinute: minute });
}

function daysAhead(days, hour = 9, minute = 0) {
  return withDateOffset({ days, atHour: hour, atMinute: minute });
}

function hoursAgo(hours) {
  return withDateOffset({ hours: -hours });
}

function hoursAhead(hours) {
  return withDateOffset({ hours });
}

function minutesAgo(minutes) {
  return withDateOffset({ minutes: -minutes });
}

function base64Text(text) {
  return Buffer.from(text, "utf8").toString("base64");
}

function svgCardBase64(title, subtitle, footer) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
    <rect width="1200" height="1600" fill="#f7f3eb"/>
    <rect x="80" y="80" width="1040" height="1440" rx="36" fill="#fffdf8" stroke="#d7c9b3" stroke-width="6"/>
    <text x="120" y="220" font-size="56" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#1e2832">${title}</text>
    <text x="120" y="320" font-size="30" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#59636f">${subtitle}</text>
    <line x1="120" y1="380" x2="1080" y2="380" stroke="#d7c9b3" stroke-width="4"/>
    <text x="120" y="500" font-size="28" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#2d3a45">课堂留痕</text>
    <text x="120" y="560" font-size="24" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#5f6b76">1. 已完成主体内容书写与错因标注</text>
    <text x="120" y="620" font-size="24" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#5f6b76">2. 拍照上传前已核对题号、日期与姓名</text>
    <text x="120" y="680" font-size="24" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#5f6b76">3. 老师将根据批注继续安排复练</text>
    <rect x="120" y="820" width="960" height="360" rx="24" fill="#f1e8d7"/>
    <text x="160" y="910" font-size="26" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#725b36">教师关注</text>
    <text x="160" y="980" font-size="24" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#725b36">${footer}</text>
    <text x="120" y="1440" font-size="24" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="#8b7c68">EduAI · 海州实验学校展示数据</text>
  </svg>`;
  return Buffer.from(svg, "utf8").toString("base64");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stableNumber(seed) {
  return Array.from(String(seed)).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 17), 97);
}

function stableRatio(seed) {
  return (stableNumber(seed) % 1000) / 1000;
}

function choice(stem, options, answerIndex, explanation, difficulty = "medium", abilities = []) {
  return {
    stem,
    options,
    answer: options[answerIndex],
    explanation,
    difficulty,
    questionType: "choice",
    tags: [],
    abilities
  };
}

const teacherUsers = [
  {
    id: USER_IDS.teacherLiqing,
    email: "qing.li@hzsy.edu.cn",
    name: "李晴",
    role: "teacher",
    schoolId: SCHOOL_ID,
    password: `plain:${TEACHER_PASSWORD}`
  },
  {
    id: USER_IDS.teacherWangnan,
    email: "nan.wang@hzsy.edu.cn",
    name: "王楠",
    role: "teacher",
    schoolId: SCHOOL_ID,
    password: `plain:${TEACHER_PASSWORD}`
  },
  {
    id: USER_IDS.teacherChenrui,
    email: "rui.chen@hzsy.edu.cn",
    name: "陈睿",
    role: "teacher",
    schoolId: SCHOOL_ID,
    password: `plain:${TEACHER_PASSWORD}`
  },
  {
    id: USER_IDS.teacherSunya,
    email: "ya.sun@hzsy.edu.cn",
    name: "孙雅",
    role: "teacher",
    schoolId: SCHOOL_ID,
    password: `plain:${TEACHER_PASSWORD}`
  },
  {
    id: USER_IDS.teacherXuzhe,
    email: "zhe.xu@hzsy.edu.cn",
    name: "徐哲",
    role: "teacher",
    schoolId: SCHOOL_ID,
    password: `plain:${TEACHER_PASSWORD}`
  },
  {
    id: USER_IDS.teacherHeyan,
    email: "yan.he@hzsy.edu.cn",
    name: "何妍",
    role: "teacher",
    schoolId: SCHOOL_ID,
    password: `plain:${TEACHER_PASSWORD}`
  }
];

const studentProfilesInput = [
  {
    id: USER_IDS.studentLinZhiyuan,
    email: "zhiyuan.lin@s.hzsy.edu.cn",
    name: "林知远",
    grade: "4",
    proficiency: { math: 0.9, chinese: 0.82, english: 0.86 },
    preferredName: "知远",
    gender: "male",
    heightCm: 148,
    eyesightLevel: "normal",
    seatPreference: "middle",
    personality: "balanced",
    focusSupport: "self_driven",
    peerSupport: "can_support",
    strengths: "计算速度快，愿意主动复盘错题。",
    supportNotes: "适合承担小组讲解任务，避免重复性机械训练。"
  },
  {
    id: USER_IDS.studentSuYutong,
    email: "yutong.su@s.hzsy.edu.cn",
    name: "苏语桐",
    grade: "4",
    proficiency: { math: 0.76, chinese: 0.91, english: 0.82 },
    preferredName: "语桐",
    gender: "female",
    heightCm: 145,
    eyesightLevel: "front_preferred",
    seatPreference: "front",
    personality: "quiet",
    focusSupport: "balanced",
    peerSupport: "balanced",
    strengths: "阅读细致，作文素材积累稳定。",
    supportNotes: "前排更有利于保持参与度，数学题审题可再放慢。"
  },
  {
    id: USER_IDS.studentChenYichen,
    email: "yichen.chen@s.hzsy.edu.cn",
    name: "陈奕辰",
    grade: "4",
    proficiency: { math: 0.81, chinese: 0.72, english: 0.67 },
    preferredName: "奕辰",
    gender: "male",
    heightCm: 150,
    eyesightLevel: "normal",
    seatPreference: "back",
    personality: "active",
    focusSupport: "balanced",
    peerSupport: "can_support",
    strengths: "课堂互动积极，数学建模意识较好。",
    supportNotes: "英语口头表达欲望强，需加强书面细节与拼写规范。"
  },
  {
    id: USER_IDS.studentXuMuqing,
    email: "muqing.xu@s.hzsy.edu.cn",
    name: "许沐晴",
    grade: "4",
    proficiency: { math: 0.74, chinese: 0.79, english: 0.88 },
    preferredName: "沐晴",
    gender: "female",
    heightCm: 146,
    eyesightLevel: "normal",
    seatPreference: "middle",
    personality: "balanced",
    focusSupport: "self_driven",
    peerSupport: "balanced",
    strengths: "英语表达自然，作息类话题迁移快。",
    supportNotes: "数学遇到新题型会略保守，适合先给结构化提示。"
  },
  {
    id: USER_IDS.studentZhaoYuhang,
    email: "yuhang.zhao@s.hzsy.edu.cn",
    name: "赵宇航",
    grade: "4",
    proficiency: { math: 0.55, chinese: 0.63, english: 0.58 },
    preferredName: "宇航",
    gender: "male",
    heightCm: 151,
    eyesightLevel: "front_preferred",
    seatPreference: "front",
    personality: "active",
    focusSupport: "needs_focus",
    peerSupport: "needs_support",
    strengths: "口头表达直接，愿意接受即时反馈。",
    supportNotes: "作业容易拖后，建议把复练题拆小块并及时鼓励。"
  },
  {
    id: USER_IDS.studentHeJianing,
    email: "jianing.he@s.hzsy.edu.cn",
    name: "何嘉宁",
    grade: "4",
    proficiency: { math: 0.69, chinese: 0.76, english: 0.72 },
    preferredName: "嘉宁",
    gender: "female",
    heightCm: 144,
    eyesightLevel: "normal",
    seatPreference: "flexible",
    personality: "quiet",
    focusSupport: "balanced",
    peerSupport: "balanced",
    strengths: "书写工整，能按要求完成订正。",
    supportNotes: "需要通过课堂提问提升主动表达。"
  },
  {
    id: USER_IDS.studentJiangHaochen,
    email: "haochen.jiang@s.hzsy.edu.cn",
    name: "江昊辰",
    grade: "7",
    proficiency: { math: 0.42, chinese: 0.61, english: 0.54 },
    preferredName: "昊辰",
    gender: "male",
    heightCm: 166,
    eyesightLevel: "front_preferred",
    seatPreference: "front",
    personality: "active",
    focusSupport: "needs_focus",
    peerSupport: "needs_support",
    strengths: "愿意追问不会的地方，接受复练安排。",
    supportNotes: "数学建模薄弱，逾期作业集中，需要家长和老师共同盯进度。"
  },
  {
    id: USER_IDS.studentShenZhiruo,
    email: "zhiruo.shen@s.hzsy.edu.cn",
    name: "沈芷若",
    grade: "7",
    proficiency: { math: 0.93, chinese: 0.86, english: 0.91 },
    preferredName: "芷若",
    gender: "female",
    heightCm: 163,
    eyesightLevel: "normal",
    seatPreference: "middle",
    personality: "balanced",
    focusSupport: "self_driven",
    peerSupport: "can_support",
    strengths: "各学科稳定，能承担同伴互助角色。",
    supportNotes: "培优课可适当增加开放型任务。"
  },
  {
    id: USER_IDS.studentZhouJingxing,
    email: "jingxing.zhou@s.hzsy.edu.cn",
    name: "周景行",
    grade: "7",
    proficiency: { math: 0.71, chinese: 0.67, english: 0.64 },
    preferredName: "景行",
    gender: "male",
    heightCm: 170,
    eyesightLevel: "normal",
    seatPreference: "back",
    personality: "balanced",
    focusSupport: "balanced",
    peerSupport: "balanced",
    strengths: "课堂节奏跟得上，基础题稳定。",
    supportNotes: "英语阅读定位速度偏慢，建议练习关键词标记。"
  },
  {
    id: USER_IDS.studentGuYuanan,
    email: "yuanan.gu@s.hzsy.edu.cn",
    name: "顾语安",
    grade: "7",
    proficiency: { math: 0.84, chinese: 0.78, english: 0.89 },
    preferredName: "语安",
    gender: "female",
    heightCm: 161,
    eyesightLevel: "normal",
    seatPreference: "middle",
    personality: "quiet",
    focusSupport: "self_driven",
    peerSupport: "can_support",
    strengths: "英语写作框架清晰，数学推理耐心。",
    supportNotes: "适合承担培优班的小组记录工作。"
  },
  {
    id: USER_IDS.studentTangYifan,
    email: "yifan.tang@s.hzsy.edu.cn",
    name: "唐一凡",
    grade: "7",
    proficiency: { math: 0.58, chinese: 0.72, english: 0.61 },
    preferredName: "一凡",
    gender: "male",
    heightCm: 168,
    eyesightLevel: "normal",
    seatPreference: "flexible",
    personality: "active",
    focusSupport: "balanced",
    peerSupport: "balanced",
    strengths: "语文阅读感受力较强，能写出个人理解。",
    supportNotes: "数学和英语需要稳定完成日常训练，避免临时突击。"
  },
  {
    id: USER_IDS.studentSongKexin,
    email: "kexin.song@s.hzsy.edu.cn",
    name: "宋可欣",
    grade: "7",
    proficiency: { math: 0.77, chinese: 0.83, english: 0.74 },
    preferredName: "可欣",
    gender: "female",
    heightCm: 159,
    eyesightLevel: "normal",
    seatPreference: "middle",
    personality: "balanced",
    focusSupport: "balanced",
    peerSupport: "can_support",
    strengths: "语文与数学均衡，完成度稳定。",
    supportNotes: "可以承担班级讨论串中的答疑补充。"
  }
];

const parentUsers = [
  {
    id: USER_IDS.parentLinZhihong,
    email: "zhihong.lin@family.hzsy.edu.cn",
    name: "林志宏",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentLinZhiyuan,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentSuWenjing,
    email: "wenjing.su@family.hzsy.edu.cn",
    name: "苏文静",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentSuYutong,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentChenXiaolan,
    email: "xiaolan.chen@family.hzsy.edu.cn",
    name: "陈晓岚",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentChenYichen,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentXuRuining,
    email: "ruining.xu@family.hzsy.edu.cn",
    name: "许睿宁",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentXuMuqing,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentZhaoMin,
    email: "min.zhao@family.hzsy.edu.cn",
    name: "赵敏",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentZhaoYuhang,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentHeDonglai,
    email: "donglai.he@family.hzsy.edu.cn",
    name: "何东来",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentHeJianing,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentJiangXuemei,
    email: "xuemei.jiang@family.hzsy.edu.cn",
    name: "江雪梅",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentJiangHaochen,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentShenZhuoran,
    email: "zhuoran.shen@family.hzsy.edu.cn",
    name: "沈卓然",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentShenZhiruo,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentZhouYajun,
    email: "yajun.zhou@family.hzsy.edu.cn",
    name: "周雅君",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentZhouJingxing,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentGuMingze,
    email: "mingze.gu@family.hzsy.edu.cn",
    name: "顾明泽",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentGuYuanan,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentTangHui,
    email: "hui.tang@family.hzsy.edu.cn",
    name: "唐慧",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentTangYifan,
    password: `plain:${PARENT_PASSWORD}`
  },
  {
    id: USER_IDS.parentSongYan,
    email: "yan.song@family.hzsy.edu.cn",
    name: "宋燕",
    role: "parent",
    schoolId: SCHOOL_ID,
    studentId: USER_IDS.studentSongKexin,
    password: `plain:${PARENT_PASSWORD}`
  }
];

const systemUsers = [
  {
    id: USER_IDS.platformAdmin,
    email: "ops@eduai.net.cn",
    name: "宋泽维",
    role: "admin",
    password: `plain:${ADMIN_PASSWORD}`
  },
  {
    id: USER_IDS.schoolAdmin,
    email: "lan.zhou@hzsy.edu.cn",
    name: "周岚",
    role: "school_admin",
    schoolId: SCHOOL_ID,
    password: `plain:${SCHOOL_ADMIN_PASSWORD}`
  }
];

const studentUsers = studentProfilesInput.map((item) => ({
  id: item.id,
  email: item.email,
  name: item.name,
  role: "student",
  grade: item.grade,
  schoolId: SCHOOL_ID,
  password: `plain:${STUDENT_PASSWORD}`
}));

const allUsers = [...systemUsers, ...teacherUsers, ...studentUsers, ...parentUsers];

const cohortByGrade = {
  "4": studentProfilesInput.filter((item) => item.grade === "4").map((item) => item.id),
  "7": studentProfilesInput.filter((item) => item.grade === "7").map((item) => item.id)
};

const classList = [
  {
    id: CLASS_IDS.g4Math,
    name: "四年级（1）班·数学",
    subject: "math",
    grade: "4",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherLiqing,
    joinCode: "HZ4M1",
    joinMode: "auto"
  },
  {
    id: CLASS_IDS.g4Chinese,
    name: "四年级（1）班·语文",
    subject: "chinese",
    grade: "4",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherWangnan,
    joinCode: "HZ4C1",
    joinMode: "auto"
  },
  {
    id: CLASS_IDS.g4English,
    name: "四年级（1）班·英语",
    subject: "english",
    grade: "4",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherChenrui,
    joinCode: "HZ4E1",
    joinMode: "auto"
  },
  {
    id: CLASS_IDS.g7Math,
    name: "七年级（2）班·数学",
    subject: "math",
    grade: "7",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherSunya,
    joinCode: "HZ7M2",
    joinMode: "auto"
  },
  {
    id: CLASS_IDS.g7Chinese,
    name: "七年级（2）班·语文",
    subject: "chinese",
    grade: "7",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherXuzhe,
    joinCode: "HZ7C2",
    joinMode: "auto"
  },
  {
    id: CLASS_IDS.g7English,
    name: "七年级（2）班·英语",
    subject: "english",
    grade: "7",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherHeyan,
    joinCode: "HZ7E2",
    joinMode: "auto"
  },
  {
    id: CLASS_IDS.g7MathAdvanced,
    name: "七年级（2）班·数学培优",
    subject: "math",
    grade: "7",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherLiqing,
    joinCode: "HZ7MX",
    joinMode: "approval"
  }
].map((item, index) => ({
  ...item,
  createdAt: daysAgo(48 - index, 8, 30)
}));

const mainClassRoster = {
  [CLASS_IDS.g4Math]: cohortByGrade["4"],
  [CLASS_IDS.g4Chinese]: cohortByGrade["4"],
  [CLASS_IDS.g4English]: cohortByGrade["4"],
  [CLASS_IDS.g7Math]: cohortByGrade["7"],
  [CLASS_IDS.g7Chinese]: cohortByGrade["7"],
  [CLASS_IDS.g7English]: cohortByGrade["7"],
  [CLASS_IDS.g7MathAdvanced]: [USER_IDS.studentShenZhiruo, USER_IDS.studentGuYuanan]
};

const scheduleTemplateRows = [
  {
    id: "showcase-template-g4-math",
    schoolId: SCHOOL_ID,
    grade: "4",
    subject: "math",
    weeklyLessonsPerClass: 4,
    lessonDurationMinutes: 45,
    periodsPerDay: 7,
    weekdays: [1, 2, 4, 5],
    dayStartTime: "08:00",
    shortBreakMinutes: 10,
    lunchBreakAfterPeriod: 4,
    lunchBreakMinutes: 90,
    campus: MAIN_CAMPUS
  },
  {
    id: "showcase-template-g4-chinese",
    schoolId: SCHOOL_ID,
    grade: "4",
    subject: "chinese",
    weeklyLessonsPerClass: 5,
    lessonDurationMinutes: 45,
    periodsPerDay: 7,
    weekdays: [1, 2, 3, 4, 5],
    dayStartTime: "08:00",
    shortBreakMinutes: 10,
    lunchBreakAfterPeriod: 4,
    lunchBreakMinutes: 90,
    campus: MAIN_CAMPUS
  },
  {
    id: "showcase-template-g4-english",
    schoolId: SCHOOL_ID,
    grade: "4",
    subject: "english",
    weeklyLessonsPerClass: 3,
    lessonDurationMinutes: 45,
    periodsPerDay: 7,
    weekdays: [1, 3, 5],
    dayStartTime: "08:00",
    shortBreakMinutes: 10,
    lunchBreakAfterPeriod: 4,
    lunchBreakMinutes: 90,
    campus: MAIN_CAMPUS
  },
  {
    id: "showcase-template-g7-math",
    schoolId: SCHOOL_ID,
    grade: "7",
    subject: "math",
    weeklyLessonsPerClass: 5,
    lessonDurationMinutes: 45,
    periodsPerDay: 8,
    weekdays: [1, 2, 3, 4, 5],
    dayStartTime: "07:50",
    shortBreakMinutes: 10,
    lunchBreakAfterPeriod: 4,
    lunchBreakMinutes: 95,
    campus: EAST_CAMPUS
  },
  {
    id: "showcase-template-g7-chinese",
    schoolId: SCHOOL_ID,
    grade: "7",
    subject: "chinese",
    weeklyLessonsPerClass: 5,
    lessonDurationMinutes: 45,
    periodsPerDay: 8,
    weekdays: [1, 2, 3, 4, 5],
    dayStartTime: "07:50",
    shortBreakMinutes: 10,
    lunchBreakAfterPeriod: 4,
    lunchBreakMinutes: 95,
    campus: EAST_CAMPUS
  },
  {
    id: "showcase-template-g7-english",
    schoolId: SCHOOL_ID,
    grade: "7",
    subject: "english",
    weeklyLessonsPerClass: 4,
    lessonDurationMinutes: 45,
    periodsPerDay: 8,
    weekdays: [1, 2, 4, 5],
    dayStartTime: "07:50",
    shortBreakMinutes: 10,
    lunchBreakAfterPeriod: 4,
    lunchBreakMinutes: 95,
    campus: EAST_CAMPUS
  }
].map((item, index) => ({
  ...item,
  createdAt: daysAgo(22 - index, 10, 0),
  updatedAt: daysAgo(2 + (index % 3), 15, 0)
}));

const teacherRuleRows = [
  {
    id: "showcase-trule-liqing",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherLiqing,
    weeklyMaxLessons: 18,
    maxConsecutiveLessons: 3,
    minCampusGapMinutes: 25
  },
  {
    id: "showcase-trule-wangnan",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherWangnan,
    weeklyMaxLessons: 20,
    maxConsecutiveLessons: 3,
    minCampusGapMinutes: 15
  },
  {
    id: "showcase-trule-chenrui",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherChenrui,
    weeklyMaxLessons: 16,
    maxConsecutiveLessons: 2,
    minCampusGapMinutes: 15
  },
  {
    id: "showcase-trule-sunya",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherSunya,
    weeklyMaxLessons: 22,
    maxConsecutiveLessons: 3,
    minCampusGapMinutes: 20
  },
  {
    id: "showcase-trule-xuzhe",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherXuzhe,
    weeklyMaxLessons: 20,
    maxConsecutiveLessons: 3,
    minCampusGapMinutes: 15
  },
  {
    id: "showcase-trule-heyan",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherHeyan,
    weeklyMaxLessons: 18,
    maxConsecutiveLessons: 2,
    minCampusGapMinutes: 20
  }
].map((item, index) => ({
  ...item,
  createdAt: daysAgo(14 - index, 11, 0),
  updatedAt: daysAgo(1 + (index % 2), 18, 0)
}));

const teacherUnavailableRows = [
  {
    id: "showcase-tblock-liqing-jiaoyan",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherLiqing,
    weekday: 3,
    startTime: "13:30",
    endTime: "15:00",
    reason: "周三跨校区教研"
  },
  {
    id: "showcase-tblock-sunya-duty",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherSunya,
    weekday: 2,
    startTime: "15:20",
    endTime: "16:05",
    reason: "值周巡视"
  },
  {
    id: "showcase-tblock-heyan-parent",
    schoolId: SCHOOL_ID,
    teacherId: USER_IDS.teacherHeyan,
    weekday: 5,
    startTime: "16:20",
    endTime: "17:10",
    reason: "家校沟通时段"
  }
].map((item, index) => ({
  ...item,
  createdAt: daysAgo(10 - index, 9, 0),
  updatedAt: daysAgo(2 + index, 9, 30)
}));

const knowledgePointBlueprints = [
  {
    id: KP_IDS.math4MixedCalc,
    subject: "math",
    grade: "4",
    title: "四则混合运算与简便计算",
    chapter: "第一单元 数与运算",
    unit: "运算策略",
    questions: [
      choice(
        "计算 36 + 64 ÷ 8 的结果是（ ）。",
        ["44", "50", "100", "12"],
        0,
        "先算除法 64 ÷ 8 = 8，再算 36 + 8 = 44。",
        "easy",
        ["运算顺序"]
      ),
      choice(
        "下面哪道算式最适合用简便方法计算？",
        ["125 + 37 + 63", "48 - 19", "24 × 3", "72 ÷ 9"],
        0,
        "37 和 63 可以先凑成 100，再和 125 相加更方便。",
        "medium",
        ["简便运算"]
      )
    ]
  },
  {
    id: KP_IDS.math4Decimal,
    subject: "math",
    grade: "4",
    title: "理解小数的意义",
    chapter: "第二单元 小数初步认识",
    unit: "小数意义",
    questions: [
      choice(
        "把 1 米平均分成 10 份，其中 3 份是（ ）。",
        ["0.3 米", "0.03 米", "3 米", "30 米"],
        0,
        "1 米平均分成 10 份，每份是 0.1 米，3 份就是 0.3 米。",
        "easy",
        ["数感"]
      ),
      choice(
        "0.56 中的“6”表示（ ）。",
        ["6 个 1", "6 个 0.1", "6 个 0.01", "6 个 10"],
        2,
        "0.56 的 6 在百分位上，表示 6 个 0.01。",
        "medium",
        ["位值理解"]
      )
    ]
  },
  {
    id: KP_IDS.math4Area,
    subject: "math",
    grade: "4",
    title: "长方形与正方形的面积",
    chapter: "第三单元 图形与测量",
    unit: "面积应用",
    questions: [
      choice(
        "一个长方形长 8 厘米、宽 5 厘米，它的面积是（ ）。",
        ["13 平方厘米", "26 平方厘米", "40 平方厘米", "80 平方厘米"],
        2,
        "长方形面积 = 长 × 宽，8 × 5 = 40。",
        "easy",
        ["公式应用"]
      ),
      choice(
        "边长是 6 厘米的正方形，面积比周长多（ ）。",
        ["12", "24", "36", "无法比较"],
        0,
        "面积 36，周长 24，36 - 24 = 12。",
        "medium",
        ["综合比较"]
      )
    ]
  },
  {
    id: KP_IDS.chinese4Paragraph,
    subject: "chinese",
    grade: "4",
    title: "概括段落大意",
    chapter: "第一单元 阅读方法",
    unit: "段意概括",
    questions: [
      choice(
        "概括一段话的主要意思时，最先要关注的是（ ）。",
        ["段中的修辞手法", "关键人物和事件", "标点符号", "字词笔画"],
        1,
        "概括段意要抓住“谁做了什么”或“这段主要说明了什么”。",
        "easy",
        ["阅读概括"]
      ),
      choice(
        "如果一段文字围绕“秋游前的准备”展开，最合适的段意是（ ）。",
        ["同学们喜欢秋天", "大家在讨论零食", "秋游前的分工与准备", "老师讲了一个故事"],
        2,
        "要用能概括整段中心内容的话来表达。",
        "medium",
        ["中心句提炼"]
      )
    ]
  },
  {
    id: KP_IDS.chinese4Character,
    subject: "chinese",
    grade: "4",
    title: "人物描写中的动作与语言",
    chapter: "第二单元 习作表达",
    unit: "人物描写",
    questions: [
      choice(
        "为了写出人物特点，下面哪一句更具体？",
        ["妈妈很忙。", "妈妈一边接电话一边翻看作业本。", "妈妈在家里。", "妈妈看了我一眼。"],
        1,
        "动作和情景越具体，人物形象越清楚。",
        "easy",
        ["细节描写"]
      ),
      choice(
        "“他挠了挠头，小声说：‘我再试一次。’”主要表现人物（ ）。",
        ["骄傲自满", "有点紧张但不放弃", "十分生气", "毫不在意"],
        1,
        "动作“挠头”和语言“小声说”都体现了紧张但坚持。",
        "medium",
        ["人物理解"]
      )
    ]
  },
  {
    id: KP_IDS.chinese4Rhetoric,
    subject: "chinese",
    grade: "4",
    title: "修辞手法辨析",
    chapter: "第三单元 语言积累",
    unit: "修辞辨析",
    questions: [
      choice(
        "“月亮像一只小船挂在夜空。”运用了（ ）修辞。",
        ["夸张", "比喻", "拟人", "排比"],
        1,
        "把月亮比作小船，是典型比喻。",
        "easy",
        ["修辞识别"]
      ),
      choice(
        "“风儿轻轻拍着窗户，像在催我快点睡觉。”更接近（ ）。",
        ["拟人", "反问", "设问", "对偶"],
        0,
        "赋予风儿“拍”“催”的动作和情感，是拟人。",
        "medium",
        ["修辞识别"]
      )
    ]
  },
  {
    id: KP_IDS.english4ThereBe,
    subject: "english",
    grade: "4",
    title: "There be 句型表达",
    chapter: "Unit 2 My Classroom",
    unit: "Classroom Talk",
    questions: [
      choice(
        "There ___ a map on the wall.",
        ["am", "is", "are", "be"],
        1,
        "主语 a map 是单数，用 is。",
        "easy",
        ["句型应用"]
      ),
      choice(
        "There are two books and a pencil box on the desk. 句子中的主语最先看到的是（ ）。",
        ["two books", "a pencil box", "the desk", "on the desk"],
        0,
        "There be 句型遵循就近原则，先看到 two books。",
        "medium",
        ["语法意识"]
      )
    ]
  },
  {
    id: KP_IDS.english4Routine,
    subject: "english",
    grade: "4",
    title: "日常作息描述",
    chapter: "Unit 3 My Day",
    unit: "Daily Routine",
    questions: [
      choice(
        "I ___ up at 6:30 every day.",
        ["get", "gets", "getting", "am"],
        0,
        "主语是 I，用动词原形 get。",
        "easy",
        ["基础语法"]
      ),
      choice(
        "Which sentence is about after-school time?",
        ["I have math at 8:00.", "I go home and do my homework.", "I eat breakfast.", "I clean my desk in class."],
        1,
        "放学后的活动是回家并做作业。",
        "medium",
        ["情境理解"]
      )
    ]
  },
  {
    id: KP_IDS.english4Weather,
    subject: "english",
    grade: "4",
    title: "天气与着装表达",
    chapter: "Unit 4 Weather",
    unit: "Weather Talk",
    questions: [
      choice(
        "It is cold today. I should wear my ___.",
        ["T-shirt", "shorts", "coat", "cap only"],
        2,
        "天气冷，应该穿外套。",
        "easy",
        ["生活表达"]
      ),
      choice(
        "“It’s rainy outside.” What will you take?",
        ["A kite", "An umbrella", "A basketball", "A cake"],
        1,
        "下雨天要带雨伞。",
        "easy",
        ["情境理解"]
      )
    ]
  },
  {
    id: KP_IDS.math7Rational,
    subject: "math",
    grade: "7",
    title: "有理数加减乘除",
    chapter: "第一章 有理数",
    unit: "有理数运算",
    questions: [
      choice(
        "计算 -3 + 7 的结果是（ ）。",
        ["-10", "-4", "4", "10"],
        2,
        "异号两数相加，取绝对值较大数的符号，7-3=4。",
        "easy",
        ["运算能力"]
      ),
      choice(
        "(-2) × 5 ÷ (-1) 的结果是（ ）。",
        ["-10", "10", "-7", "7"],
        1,
        "先算 (-2)×5=-10，再除以 -1 得 10。",
        "medium",
        ["运算顺序"]
      )
    ]
  },
  {
    id: KP_IDS.math7LinearEquation,
    subject: "math",
    grade: "7",
    title: "一元一次方程建模",
    chapter: "第二章 整式与方程",
    unit: "方程建模",
    questions: [
      choice(
        "若 3x + 2 = 14，则 x =（ ）。",
        ["2", "3", "4", "6"],
        2,
        "先移项得 3x=12，再两边同时除以 3。",
        "easy",
        ["方程求解"]
      ),
      choice(
        "买 3 支同样的笔和 1 本本子共 17 元，本子 5 元。设每支笔 x 元，可列方程（ ）。",
        ["3x + 5 = 17", "3 + x = 17", "5x + 3 = 17", "17 - x = 5"],
        0,
        "3 支笔共 3x 元，再加本子 5 元。",
        "medium",
        ["数量关系"]
      )
    ]
  },
  {
    id: KP_IDS.math7Expression,
    subject: "math",
    grade: "7",
    title: "整式的加减",
    chapter: "第二章 整式与方程",
    unit: "整式运算",
    questions: [
      choice(
        "化简 3a + 2a 的结果是（ ）。",
        ["5a", "6a", "3a²", "2a²"],
        0,
        "同类项系数相加，字母和指数保持不变。",
        "easy",
        ["整式运算"]
      ),
      choice(
        "下列哪一组是同类项？",
        ["2x 和 2x²", "3ab 和 -5ab", "a 和 ab", "4y 和 4z"],
        1,
        "字母和每个字母的指数都相同才是同类项。",
        "medium",
        ["概念辨析"]
      )
    ]
  },
  {
    id: KP_IDS.chinese7Narrative,
    subject: "chinese",
    grade: "7",
    title: "记叙文线索梳理",
    chapter: "第一单元 现代文阅读",
    unit: "记叙文阅读",
    questions: [
      choice(
        "梳理记叙文线索时，最重要的是找到反复出现的（ ）。",
        ["修辞手法", "人物、物品或事件变化", "生字词", "标点符号"],
        1,
        "线索往往通过人物、物品或事件推进反复出现。",
        "easy",
        ["阅读理解"]
      ),
      choice(
        "如果文章多次写到“一把旧伞”，它最可能承担的作用是（ ）。",
        ["只用来交代天气", "作为贯穿全文的线索", "表现作者字写得好", "说明地点变化"],
        1,
        "反复出现的物品常常是线索。",
        "medium",
        ["线索判断"]
      )
    ]
  },
  {
    id: KP_IDS.chinese7Classical,
    subject: "chinese",
    grade: "7",
    title: "文言实词理解",
    chapter: "第二单元 文言启蒙",
    unit: "实词积累",
    questions: [
      choice(
        "“学而时习之”中的“时”最合适的解释是（ ）。",
        ["时间", "时常", "当时", "时机"],
        1,
        "这里表示经常、按时地复习。",
        "medium",
        ["文言积累"]
      ),
      choice(
        "“可以为师矣”中的“可以”与现代汉语相比，更接近（ ）。",
        ["可以做某事", "能够凭借它", "值得", "允许"],
        1,
        "文言中的“可以”常是“可以凭借”的意思。",
        "hard",
        ["词义迁移"]
      )
    ]
  },
  {
    id: KP_IDS.chinese7Exposition,
    subject: "chinese",
    grade: "7",
    title: "说明方法辨析",
    chapter: "第三单元 说明文阅读",
    unit: "说明文技巧",
    questions: [
      choice(
        "“鲸的心脏重约 170 千克。”这句话主要使用了（ ）。",
        ["打比方", "列数字", "作比较", "引用"],
        1,
        "出现具体数量，属于列数字。",
        "easy",
        ["说明方法"]
      ),
      choice(
        "“它像一座会移动的小山。”运用了（ ）。",
        ["分类别", "下定义", "打比方", "列图表"],
        2,
        "把对象比作“小山”，是打比方。",
        "easy",
        ["说明方法"]
      )
    ]
  },
  {
    id: KP_IDS.english7PastTense,
    subject: "english",
    grade: "7",
    title: "一般过去时表达",
    chapter: "Unit 5 School Trip",
    unit: "Past Events",
    questions: [
      choice(
        "Yesterday we ___ to the science museum.",
        ["go", "went", "goes", "going"],
        1,
        "yesterday 表示过去时间，要用 went。",
        "easy",
        ["时态应用"]
      ),
      choice(
        "Which sentence is correct?",
        ["She buyed a pen.", "She bought a pen.", "She buys a pen yesterday.", "She buying a pen."],
        1,
        "buy 的过去式是不规则变化 bought。",
        "medium",
        ["动词变化"]
      )
    ]
  },
  {
    id: KP_IDS.english7ReadingLocate,
    subject: "english",
    grade: "7",
    title: "阅读信息定位",
    chapter: "Unit 6 Reading",
    unit: "Reading Skills",
    questions: [
      choice(
        "To find the answer quickly in a reading text, you should first look for（ ）.",
        ["every new word", "keywords in the question", "the title only", "pictures only"],
        1,
        "先找问题中的关键词，再回文定位。",
        "easy",
        ["阅读策略"]
      ),
      choice(
        "If a question asks for the time of an event, the best strategy is to（ ）.",
        ["read from the last paragraph", "translate every sentence", "scan for numbers or time words", "guess from pictures"],
        2,
        "定位时间信息时，应快速扫描数字或时间词。",
        "medium",
        ["阅读策略"]
      )
    ]
  },
  {
    id: KP_IDS.english7Writing,
    subject: "english",
    grade: "7",
    title: "书面表达结构",
    chapter: "Unit 7 Writing",
    unit: "Writing Structure",
    questions: [
      choice(
        "A short email should usually begin with（ ）.",
        ["a clear greeting", "the ending first", "a random sentence", "a long dictionary note"],
        0,
        "写邮件或短文要先有称呼或开头。",
        "easy",
        ["写作结构"]
      ),
      choice(
        "Which sentence is the best ending for a note to your teacher?",
        ["I am hungry.", "See you and thank you for your help.", "My bike is blue.", "Tomorrow is Monday."],
        1,
        "感谢并礼貌结束更符合真实语境。",
        "medium",
        ["写作语境"]
      )
    ]
  }
];

function buildStudentUserProfileRows() {
  return studentProfilesInput.map((item, index) => ({
    id: `showcase-profile-${item.id}`,
    userId: item.id,
    grade: item.grade,
    subjects: ["math", "chinese", "english"],
    target: item.grade === "4" ? "建立稳定作业与复练节奏" : "提升单元诊断与自主复盘能力",
    school: SCHOOL_NAME,
    observerCode: `HZSY${item.grade}${String(index + 1).padStart(3, "0")}`,
    updatedAt: daysAgo(1 + (index % 4), 19, 0)
  }));
}

const usersById = new Map(allUsers.map((item) => [item.id, item]));
const studentMetaById = new Map(studentProfilesInput.map((item) => [item.id, item]));
const classById = new Map(classList.map((item) => [item.id, item]));
const classSubjectMap = new Map(classList.map((item) => [item.id, item.subject]));
const classGradeMap = new Map(classList.map((item) => [item.id, item.grade]));

function buildKnowledgePoints() {
  return knowledgePointBlueprints.map((item, index) => ({
    id: item.id,
    subject: item.subject,
    grade: item.grade,
    title: item.title,
    chapter: item.chapter,
    unit: item.unit,
    createdAt: daysAgo(120 - index, 9, 0),
    updatedAt: daysAgo(15 - (index % 7), 17, 30)
  }));
}

function buildQuestions() {
  const questions = [];
  knowledgePointBlueprints.forEach((item, kpIndex) => {
    item.questions.forEach((question, questionIndex) => {
      questions.push({
        id: `${item.id}-q${questionIndex + 1}`,
        subject: item.subject,
        grade: item.grade,
        knowledgePointId: item.id,
        stem: question.stem,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        difficulty: question.difficulty,
        questionType: question.questionType,
        tags: [item.unit],
        abilities: question.abilities,
        createdAt: daysAgo(90 - kpIndex, 15, questionIndex * 7),
        updatedAt: daysAgo(4 + ((kpIndex + questionIndex) % 9), 18, 0)
      });
    });
  });
  return questions;
}

function buildQuestionQualityMetrics(questions) {
  const lowQualityQuestionId = `${KP_IDS.english7Writing}-q2`;
  return questions.map((question, index) => {
    const baseScore = 84 + (stableNumber(question.id) % 12);
    const isLowQuality = question.id === lowQualityQuestionId;
    return {
      id: `showcase-qm-${question.id}`,
      questionId: question.id,
      qualityScore: isLowQuality ? 62 : clamp(baseScore, 72, 98),
      duplicateRisk: index % 11 === 0 ? "medium" : "low",
      ambiguityRisk: isLowQuality ? "high" : index % 9 === 0 ? "medium" : "low",
      answerConsistency: isLowQuality ? 55 : 88 + (index % 11),
      duplicateClusterId: index % 11 === 0 ? `cluster-${question.subject}-${question.grade}` : null,
      answerConflict: false,
      riskLevel: isLowQuality ? "high" : index % 11 === 0 ? "medium" : "low",
      isolated: isLowQuality,
      isolationReason: isLowQuality ? ["表述边界不清", "选项区分度不足"] : [],
      issues: isLowQuality ? ["题干泛化", "建议重写结尾选项"] : [],
      checkedAt: daysAgo(1 + (index % 4), 21, 0)
    };
  });
}

function buildClassStudents() {
  const rows = [];
  Object.entries(mainClassRoster).forEach(([classId, studentIds]) => {
    studentIds.forEach((studentId, index) => {
      rows.push({
        id: `showcase-class-student-${classId}-${studentId}`,
        classId,
        studentId,
        joinedAt: daysAgo(42 - (index % 6), 8, 20)
      });
    });
  });
  return rows;
}

function buildJoinRequests() {
  return [
    {
      id: "showcase-joinrequest-haochen-advanced-math",
      classId: CLASS_IDS.g7MathAdvanced,
      studentId: USER_IDS.studentJiangHaochen,
      status: "pending",
      createdAt: daysAgo(1, 20, 15),
      decidedAt: null
    }
  ];
}

function buildModulesAndResources() {
  const modules = [
    {
      id: MODULE_IDS.g4MathCore,
      classId: CLASS_IDS.g4Math,
      title: "小数意义与面积入门",
      description: "建立小数意义、面积公式与课堂口算之间的联系。",
      orderIndex: 1
    },
    {
      id: MODULE_IDS.g4MathReview,
      classId: CLASS_IDS.g4Math,
      title: "周复盘与错因整理",
      description: "通过订正单和口头复盘提升计算稳定性。",
      orderIndex: 2
    },
    {
      id: MODULE_IDS.g4ChineseReading,
      classId: CLASS_IDS.g4Chinese,
      title: "段意概括与阅读线索",
      description: "训练学生抓住人物、事件和中心句。",
      orderIndex: 1
    },
    {
      id: MODULE_IDS.g4ChineseWriting,
      classId: CLASS_IDS.g4Chinese,
      title: "人物描写片段练笔",
      description: "围绕动作、语言和情绪描写展开习作。",
      orderIndex: 2
    },
    {
      id: MODULE_IDS.g4EnglishUnit,
      classId: CLASS_IDS.g4English,
      title: "My Day 与天气表达",
      description: "连接作息、天气和校园场景表达。",
      orderIndex: 1
    },
    {
      id: MODULE_IDS.g7MathCore,
      classId: CLASS_IDS.g7Math,
      title: "有理数与方程建模",
      description: "以单元测与复盘讲评支撑基础模型建立。",
      orderIndex: 1
    },
    {
      id: MODULE_IDS.g7MathReview,
      classId: CLASS_IDS.g7Math,
      title: "方程错因复盘",
      description: "把审题、列式和检验拆成可复练动作。",
      orderIndex: 2
    },
    {
      id: MODULE_IDS.g7ChineseReading,
      classId: CLASS_IDS.g7Chinese,
      title: "记叙文线索与文言词义",
      description: "围绕线索梳理与实词迁移做阅读诊断。",
      orderIndex: 1
    },
    {
      id: MODULE_IDS.g7ChineseWriting,
      classId: CLASS_IDS.g7Chinese,
      title: "说明文方法与表达",
      description: "从说明方法切入，强化结构化表达。",
      orderIndex: 2
    },
    {
      id: MODULE_IDS.g7EnglishReading,
      classId: CLASS_IDS.g7English,
      title: "过去时与阅读定位",
      description: "提高时间线梳理和关键词定位效率。",
      orderIndex: 1
    },
    {
      id: MODULE_IDS.g7EnglishWriting,
      classId: CLASS_IDS.g7English,
      title: "邮件写作结构训练",
      description: "围绕 greeting-body-ending 建立写作框架。",
      orderIndex: 2
    },
    {
      id: MODULE_IDS.g7AdvancedMath,
      classId: CLASS_IDS.g7MathAdvanced,
      title: "列方程建模拓展",
      description: "聚焦多步骤建模与条件转译。",
      orderIndex: 1
    }
  ].map((item, index) => ({
    ...item,
    parentId: null,
    createdAt: daysAgo(35 - index, 10, 0)
  }));

  const resources = [
    {
      id: "showcase-resource-g4-math-link",
      moduleId: MODULE_IDS.g4MathCore,
      title: "课堂板书速记",
      resourceType: "link",
      linkUrl: "https://eduai.net.cn/library",
      createdAt: daysAgo(18, 21, 0)
    },
    {
      id: "showcase-resource-g4-math-file",
      moduleId: MODULE_IDS.g4MathReview,
      title: "面积应用题错因提示卡",
      resourceType: "file",
      fileName: "面积应用题错因提示卡.txt",
      mimeType: "text/plain",
      size: 220,
      contentBase64: base64Text("1. 先圈单位；2. 再列面积公式；3. 最后对照题意检查是否需要比较。"),
      createdAt: daysAgo(12, 20, 0)
    },
    {
      id: "showcase-resource-g4-chinese-file",
      moduleId: MODULE_IDS.g4ChineseReading,
      title: "段意概括句式支架",
      resourceType: "file",
      fileName: "段意概括句式支架.txt",
      mimeType: "text/plain",
      size: 240,
      contentBase64: base64Text("这段主要写了谁在什么情况下做了什么，表达了怎样的变化。"),
      createdAt: daysAgo(10, 19, 30)
    },
    {
      id: "showcase-resource-g7-math-link",
      moduleId: MODULE_IDS.g7MathCore,
      title: "单元讲评导航页",
      resourceType: "link",
      linkUrl: "https://eduai.net.cn/report",
      createdAt: daysAgo(6, 18, 30)
    },
    {
      id: "showcase-resource-g7-chinese-file",
      moduleId: MODULE_IDS.g7ChineseWriting,
      title: "说明文方法对照表",
      resourceType: "file",
      fileName: "说明文方法对照表.txt",
      mimeType: "text/plain",
      size: 260,
      contentBase64: base64Text("列数字：突出准确；作比较：体现差异；打比方：便于理解。"),
      createdAt: daysAgo(8, 20, 0)
    },
    {
      id: "showcase-resource-g7-english-file",
      moduleId: MODULE_IDS.g7EnglishWriting,
      title: "邮件写作三段式模板",
      resourceType: "file",
      fileName: "邮件写作三段式模板.txt",
      mimeType: "text/plain",
      size: 320,
      contentBase64: base64Text("Greeting -> Purpose -> Details -> Ending\nDear Ms. He,\nI am writing to ..."),
      createdAt: daysAgo(5, 19, 40)
    },
    {
      id: "showcase-resource-g7-advanced-math-file",
      moduleId: MODULE_IDS.g7AdvancedMath,
      title: "建模条件拆解卡",
      resourceType: "file",
      fileName: "建模条件拆解卡.txt",
      mimeType: "text/plain",
      size: 300,
      contentBase64: base64Text("先写已知条件，再写未知量，最后把关系翻译成等式。"),
      createdAt: daysAgo(4, 19, 0)
    }
  ];

  return { modules, resources };
}

function buildSyllabi() {
  return classList.map((klass, index) => ({
    id: `showcase-syllabus-${klass.id}`,
    classId: klass.id,
    summary:
      klass.subject === "math"
        ? "围绕基础计算、方程建模和复盘能力建立稳定学习闭环。"
        : klass.subject === "chinese"
          ? "兼顾阅读理解、表达训练与课堂反馈，强调结构化表达。"
          : "通过真实情境任务推动阅读、表达与书面写作同步进步。",
    objectives:
      klass.subject === "math"
        ? "1. 能稳定完成课内基础题；2. 能说清列式依据；3. 能完成至少一轮错因复盘。"
        : klass.subject === "chinese"
          ? "1. 提炼中心；2. 关注表达层次；3. 形成固定周复盘。"
          : "1. 建立关键词定位习惯；2. 强化句型迁移；3. 用模板支撑书面表达。",
    gradingPolicy: "平时作业 40%，课堂表现 20%，单元测 25%，复盘与订正 15%。",
    scheduleText:
      klass.id === CLASS_IDS.g7MathAdvanced
        ? "当前为培优班试运行阶段，暂未固定校内节次，采用审批制入班。"
        : "按周课表执行，周内完成课堂讲授、作业提交与一次错题整理。",
    updatedAt: daysAgo(2 + (index % 4), 18, 0)
  }));
}

function buildCourseFiles() {
  return [
    {
      id: "showcase-course-file-g4-math-sheet",
      classId: CLASS_IDS.g4Math,
      folder: "第3周",
      title: "面积订正提示单",
      resourceType: "file",
      fileName: "面积订正提示单.txt",
      mimeType: "text/plain",
      size: 280,
      contentBase64: base64Text("先判断已知量是长和宽，还是面积与一边长；列式后写上单位。"),
      linkUrl: null,
      createdAt: daysAgo(4, 20, 0),
      uploadedBy: USER_IDS.teacherLiqing
    },
    {
      id: "showcase-course-file-g7-chinese-note",
      classId: CLASS_IDS.g7Chinese,
      folder: "阅读诊断",
      title: "文言实词复盘表",
      resourceType: "file",
      fileName: "文言实词复盘表.txt",
      mimeType: "text/plain",
      size: 320,
      contentBase64: base64Text("时：按时、经常；可以：可以凭借；之：代词/结构助词。"),
      linkUrl: null,
      createdAt: daysAgo(3, 21, 0),
      uploadedBy: USER_IDS.teacherXuzhe
    },
    {
      id: "showcase-course-file-g7-english-link",
      classId: CLASS_IDS.g7English,
      folder: "写作支持",
      title: "课堂写作模板页",
      resourceType: "link",
      fileName: null,
      mimeType: null,
      size: null,
      contentBase64: null,
      linkUrl: "https://eduai.net.cn/teacher/ai-tools",
      createdAt: daysAgo(2, 19, 30),
      uploadedBy: USER_IDS.teacherHeyan
    }
  ];
}

function buildLibraryItems() {
  return [
    {
      id: "showcase-library-g4-math-worksheet",
      title: "四年级数学·面积应用题讲义",
      description: "围绕面积比较、单位换算与应用情境的课堂讲义。",
      contentType: "textbook",
      subject: "math",
      grade: "4",
      ownerRole: "teacher",
      ownerId: USER_IDS.teacherLiqing,
      classId: CLASS_IDS.g4Math,
      accessScope: "class",
      sourceType: "file",
      fileName: "面积应用题讲义.txt",
      mimeType: "text/plain",
      size: 360,
      contentBase64: base64Text("例题：比较两块长方形菜地面积，并说明列式依据。"),
      linkUrl: null,
      textContent: null,
      knowledgePointIds: [KP_IDS.math4Area, KP_IDS.math4MixedCalc],
      extractedKnowledgePoints: ["长方形与正方形的面积", "四则混合运算与简便计算"],
      generatedByAi: false,
      status: "published",
      shareToken: "hzsy-g4-math-area-pack",
      createdAt: daysAgo(16, 21, 0),
      updatedAt: daysAgo(2, 20, 0)
    },
    {
      id: "showcase-library-g7-english-writing",
      title: "七年级英语·邮件写作支架",
      description: "适合课堂和课后反复使用的 greeting-body-ending 模板。",
      contentType: "courseware",
      subject: "english",
      grade: "7",
      ownerRole: "admin",
      ownerId: USER_IDS.platformAdmin,
      classId: null,
      accessScope: "global",
      sourceType: "text",
      fileName: null,
      mimeType: null,
      size: null,
      contentBase64: null,
      linkUrl: null,
      textContent: "Greeting -> Purpose -> Details -> Ending。先交代写信目的，再补充细节和感谢语。",
      knowledgePointIds: [KP_IDS.english7Writing],
      extractedKnowledgePoints: ["书面表达结构"],
      generatedByAi: false,
      status: "published",
      shareToken: "hzsy-g7-english-email-template",
      createdAt: daysAgo(9, 20, 0),
      updatedAt: daysAgo(1, 19, 0)
    },
    {
      id: "showcase-library-g7-chinese-plan",
      title: "七年级语文·记叙文线索教案",
      description: "把线索梳理和课堂提问串成 40 分钟教学流程。",
      contentType: "lesson_plan",
      subject: "chinese",
      grade: "7",
      ownerRole: "teacher",
      ownerId: USER_IDS.teacherXuzhe,
      classId: CLASS_IDS.g7Chinese,
      accessScope: "class",
      sourceType: "text",
      fileName: null,
      mimeType: null,
      size: null,
      contentBase64: null,
      linkUrl: null,
      textContent: "先回到反复出现的物象，再追踪人物动作变化，最后串联情绪转折。",
      knowledgePointIds: [KP_IDS.chinese7Narrative],
      extractedKnowledgePoints: ["记叙文线索梳理"],
      generatedByAi: true,
      status: "published",
      shareToken: null,
      createdAt: daysAgo(7, 19, 30),
      updatedAt: daysAgo(1, 18, 0)
    },
    {
      id: "showcase-library-g7-advanced-math",
      title: "数学培优·列方程建模微专题",
      description: "从复杂条件拆解到列方程的多步支架。",
      contentType: "courseware",
      subject: "math",
      grade: "7",
      ownerRole: "teacher",
      ownerId: USER_IDS.teacherLiqing,
      classId: CLASS_IDS.g7MathAdvanced,
      accessScope: "class",
      sourceType: "file",
      fileName: "列方程建模微专题.txt",
      mimeType: "text/plain",
      size: 380,
      contentBase64: base64Text("复杂应用题先圈出总量、份数、差值，再决定设元方式。"),
      linkUrl: null,
      textContent: null,
      knowledgePointIds: [KP_IDS.math7LinearEquation],
      extractedKnowledgePoints: ["一元一次方程建模"],
      generatedByAi: false,
      status: "published",
      shareToken: null,
      createdAt: daysAgo(6, 21, 0),
      updatedAt: daysAgo(2, 19, 0)
    }
  ];
}

function buildLibraryAnnotations() {
  return [
    {
      id: "showcase-library-annotation-g4-math",
      itemId: "showcase-library-g4-math-worksheet",
      userId: USER_IDS.teacherLiqing,
      quote: "比较两块长方形菜地面积",
      startOffset: 3,
      endOffset: 14,
      color: "amber",
      note: "这道题适合课后继续出变式。",
      createdAt: daysAgo(5, 20, 0)
    },
    {
      id: "showcase-library-annotation-g7-english",
      itemId: "showcase-library-g7-english-writing",
      userId: USER_IDS.studentGuYuanan,
      quote: "先交代写信目的",
      startOffset: 14,
      endOffset: 22,
      color: "blue",
      note: "考试写作时先用这一句稳住开头。",
      createdAt: daysAgo(1, 21, 10)
    }
  ];
}

function buildSchedules() {
  const raw = [
    [CLASS_IDS.g4Math, 1, "08:00", "08:45", "第一节", "A201", MAIN_CAMPUS, "课前完成口算热身", "小数意义引入"],
    [CLASS_IDS.g4Math, 3, "13:30", "14:15", "第五节", "A201", MAIN_CAMPUS, "课堂完成分层练习", "面积比较与表达"],
    [CLASS_IDS.g4Math, 5, "10:00", "10:45", "第三节", "A201", MAIN_CAMPUS, "带上错题整理本", "周反馈与错题讲评"],
    [CLASS_IDS.g4Chinese, 2, "09:00", "09:45", "第二节", "B302", MAIN_CAMPUS, null, "段意概括与中心句"],
    [CLASS_IDS.g4Chinese, 4, "14:30", "15:15", "第六节", "B302", MAIN_CAMPUS, null, "人物描写片段练笔"],
    [CLASS_IDS.g4Chinese, 6, "13:30", "14:15", "周六工作坊", "阅览室", MAIN_CAMPUS, "周末阅读营", "共读与表达工作坊"],
    [CLASS_IDS.g4English, 1, "15:20", "16:05", "第七节", "C102", WEST_CAMPUS, null, "There be 句型操练"],
    [CLASS_IDS.g4English, 4, "08:00", "08:45", "第一节", "C102", WEST_CAMPUS, null, "天气与着装表达"],
    [CLASS_IDS.g7Math, 2, "10:00", "10:45", "第三节", "A105", EAST_CAMPUS, null, "有理数综合训练"],
    [CLASS_IDS.g7Math, 4, "13:30", "14:15", "第五节", "A105", EAST_CAMPUS, null, "方程建模讲评"],
    [CLASS_IDS.g7Math, 6, "09:00", "09:45", "周六复盘", "A105", EAST_CAMPUS, "周末补强", "错因复练与讲评"],
    [CLASS_IDS.g7Chinese, 1, "09:55", "10:40", "第三节", "B408", EAST_CAMPUS, null, "记叙文线索梳理"],
    [CLASS_IDS.g7Chinese, 3, "08:45", "09:30", "第二节", "B408", EAST_CAMPUS, null, "文言实词迁移"],
    [CLASS_IDS.g7Chinese, 5, "14:30", "15:15", "第六节", "B408", EAST_CAMPUS, null, "说明方法辨析"],
    [CLASS_IDS.g7English, 2, "13:30", "14:15", "第五节", "C305", EAST_CAMPUS, null, "过去时阅读定位"],
    [CLASS_IDS.g7English, 4, "15:20", "16:05", "第七节", "C305", EAST_CAMPUS, null, "邮件写作结构"],
    [CLASS_IDS.g7English, 5, "08:45", "09:30", "第二节", "C305", EAST_CAMPUS, null, "课堂听说与纠音"]
  ];

  return raw.map((item, index) => ({
    id: `showcase-schedule-${index + 1}`,
    schoolId: SCHOOL_ID,
    classId: item[0],
    weekday: item[1],
    startTime: item[2],
    endTime: item[3],
    slotLabel: item[4],
    room: item[5],
    campus: item[6],
    note: item[7] || undefined,
    focusSummary: item[8],
    locked: item[1] === 6,
    lockedAt: item[1] === 6 ? daysAgo(2, 18, 0) : undefined,
    createdAt: daysAgo(18 - (index % 6), 9, 0),
    updatedAt: daysAgo(index % 3, 17, 30)
  }));
}

function buildSeatPlans() {
  const seatPlans = [];
  const plans = [
    [CLASS_IDS.g4Math, USER_IDS.teacherLiqing, cohortByGrade["4"]],
    [CLASS_IDS.g4Chinese, USER_IDS.teacherWangnan, cohortByGrade["4"]],
    [CLASS_IDS.g4English, USER_IDS.teacherChenrui, cohortByGrade["4"]],
    [CLASS_IDS.g7Math, USER_IDS.teacherSunya, cohortByGrade["7"]],
    [CLASS_IDS.g7Chinese, USER_IDS.teacherXuzhe, cohortByGrade["7"]],
    [CLASS_IDS.g7English, USER_IDS.teacherHeyan, cohortByGrade["7"]],
    [CLASS_IDS.g7MathAdvanced, USER_IDS.teacherLiqing, mainClassRoster[CLASS_IDS.g7MathAdvanced]]
  ];

  plans.forEach(([classId, teacherId, studentIds], index) => {
    const rows = classId === CLASS_IDS.g7MathAdvanced ? 2 : 2;
    const columns = classId === CLASS_IDS.g7MathAdvanced ? 2 : 3;
    const seats = [];
    let pointer = 0;
    for (let row = 1; row <= rows; row += 1) {
      for (let column = 1; column <= columns; column += 1) {
        seats.push({
          seatId: `seat-${row}-${column}`,
          row,
          column,
          studentId: studentIds[pointer] ?? undefined
        });
        pointer += 1;
      }
    }
    seatPlans.push({
      id: `showcase-seatplan-${classId}`,
      classId,
      teacherId,
      rows,
      columns,
      seats,
      generatedBy: classId === CLASS_IDS.g7MathAdvanced ? "ai" : "manual",
      note:
        classId === CLASS_IDS.g7Math
          ? "昊辰与景行前排，便于追问与板演。"
          : classId === CLASS_IDS.g4Chinese
            ? "前排安排视力优先与表达需要提醒的学生。"
            : "按课堂互动与视线遮挡综合调整。",
      createdAt: daysAgo(12 - index, 19, 0),
      updatedAt: daysAgo(index % 3, 18, 0)
    });
  });
  return seatPlans;
}

function buildStudentPersonas() {
  return studentProfilesInput.map((item, index) => ({
    id: `showcase-persona-${item.id}`,
    userId: item.id,
    preferredName: item.preferredName,
    gender: item.gender,
    heightCm: item.heightCm,
    eyesightLevel: item.eyesightLevel,
    seatPreference: item.seatPreference,
    personality: item.personality,
    focusSupport: item.focusSupport,
    peerSupport: item.peerSupport,
    strengths: item.strengths,
    supportNotes: item.supportNotes,
    updatedAt: daysAgo(index % 5, 18, 40)
  }));
}

function subjectQuestionIds(subject, grade, preferredKnowledgePointIds = []) {
  const buckets = knowledgePointBlueprints
    .filter((item) => item.subject === subject && item.grade === grade)
    .sort((left, right) => preferredKnowledgePointIds.indexOf(left.id) - preferredKnowledgePointIds.indexOf(right.id))
    .flatMap((item) => item.questions.map((_, index) => `${item.id}-q${index + 1}`));
  return Array.from(new Set(buckets));
}

function getStudentProficiency(studentId, subject) {
  return studentMetaById.get(studentId)?.proficiency?.[subject] ?? 0.68;
}

function buildSubmissionText({ studentId, subject, assignmentTitle }) {
  const student = usersById.get(studentId);
  if (subject === "chinese") {
    return `${student?.name ?? "学生"}围绕《${assignmentTitle}》完成了片段练笔，先交代场景，再补充动作和语言描写。`;
  }
  if (subject === "english") {
    return `Dear teacher,\nI finished ${assignmentTitle} and checked my greeting, body and ending again.\nBest,\n${student?.name ?? "Student"}`;
  }
  return `${student?.name ?? "学生"}已按要求完成复盘，重新列出已知量、未知量，并补写了检验步骤。`;
}

function pickWrongOption(question, seed) {
  const candidates = question.options.filter((item) => item !== question.answer);
  return candidates[stableNumber(seed) % candidates.length] ?? question.options[0];
}

function buildRubricsForType(assignmentId, submissionType) {
  const base =
    submissionType === "essay"
      ? [
          ["结构与逻辑", "段落层次、开头结尾是否完整", 10],
          ["内容与观点", "是否切题、内容是否具体", 10],
          ["语言表达", "句子是否通顺，表达是否自然", 10]
        ]
      : [
          ["完成度", "关键步骤和标注是否齐全", 10],
          ["准确性", "思路和结果是否正确", 10],
          ["规范性", "书写、拍照和提交是否清晰", 10]
        ];

  return base.map(([title, description, maxScore], index) => ({
    id: `showcase-rubric-${assignmentId}-${index + 1}`,
    assignmentId,
    title,
    description,
    levels: [
      { label: "优秀", score: maxScore, description: "表现稳定，几乎没有明显问题" },
      { label: "达标", score: Math.max(0, maxScore - 2), description: "主体完成，但仍有少量可优化点" },
      { label: "待加强", score: Math.max(0, maxScore - 5), description: "关键要求未完全达到，需要补做或重写" }
    ],
    maxScore,
    weight: 1,
    createdAt: daysAgo(18, 19, 0)
  }));
}

function assignmentBlueprints() {
  return [
    {
      id: "showcase-assignment-g4-math-week3",
      classId: CLASS_IDS.g4Math,
      moduleId: MODULE_IDS.g4MathCore,
      title: "计算小站·第3周随堂巩固",
      description: "围绕小数意义与混合运算完成 4 题课内巩固，要求独立作答。",
      dueDate: daysAgo(5, 20, 0),
      submissionType: "quiz",
      questionIds: subjectQuestionIds("math", "4", [KP_IDS.math4MixedCalc, KP_IDS.math4Decimal]).slice(0, 4)
    },
    {
      id: "showcase-assignment-g4-math-fix",
      classId: CLASS_IDS.g4Math,
      moduleId: MODULE_IDS.g4MathReview,
      title: "面积应用题订正单",
      description: "把课堂错题重新列式，并上传订正留痕。",
      dueDate: daysAhead(1, 20, 0),
      submissionType: "upload",
      maxUploads: 2,
      gradingFocus: "列式依据与单位意识"
    },
    {
      id: "showcase-assignment-g4-chinese-writing",
      classId: CLASS_IDS.g4Chinese,
      moduleId: MODULE_IDS.g4ChineseWriting,
      title: "人物描写片段练笔",
      description: "以“放学路上”为情境写一个 150 字左右的片段，重点写动作和语言。",
      dueDate: daysAgo(2, 20, 30),
      submissionType: "essay",
      gradingFocus: "细节描写与段落完整度"
    },
    {
      id: "showcase-assignment-g4-chinese-read",
      classId: CLASS_IDS.g4Chinese,
      moduleId: MODULE_IDS.g4ChineseReading,
      title: "阅读理解晨读单",
      description: "完成两则短文的段意概括与修辞辨析。",
      dueDate: daysAhead(3, 8, 0),
      submissionType: "quiz",
      questionIds: subjectQuestionIds("chinese", "4", [KP_IDS.chinese4Paragraph, KP_IDS.chinese4Rhetoric]).slice(0, 4)
    },
    {
      id: "showcase-assignment-g7-math-unit",
      classId: CLASS_IDS.g7Math,
      moduleId: MODULE_IDS.g7MathCore,
      title: "有理数单元周测",
      description: "覆盖有理数运算与整式同类项辨析，作为单元诊断。",
      dueDate: daysAgo(4, 19, 30),
      submissionType: "quiz",
      questionIds: subjectQuestionIds("math", "7", [KP_IDS.math7Rational, KP_IDS.math7Expression]).slice(0, 4)
    },
    {
      id: "showcase-assignment-g7-math-reflect",
      classId: CLASS_IDS.g7Math,
      moduleId: MODULE_IDS.g7MathReview,
      title: "方程应用题错因复盘",
      description: "把错题中的数量关系重新翻译成等式，并写出检验步骤。",
      dueDate: daysAgo(1, 21, 0),
      submissionType: "essay",
      gradingFocus: "列式依据、检验与反思"
    },
    {
      id: "showcase-assignment-g7-chinese-diagnose",
      classId: CLASS_IDS.g7Chinese,
      moduleId: MODULE_IDS.g7ChineseReading,
      title: "记叙文线索诊断单",
      description: "完成课堂阅读中的线索定位与说明方法判断。",
      dueDate: daysAhead(4, 20, 0),
      submissionType: "quiz",
      questionIds: subjectQuestionIds("chinese", "7", [KP_IDS.chinese7Narrative, KP_IDS.chinese7Exposition]).slice(0, 4)
    },
    {
      id: "showcase-assignment-g7-english-writing",
      classId: CLASS_IDS.g7English,
      moduleId: MODULE_IDS.g7EnglishWriting,
      title: "Unit 5 阅读+写作双练",
      description: "先完成关键词定位，再写一封 80 词左右的邮件说明活动安排。",
      dueDate: daysAhead(3, 20, 30),
      submissionType: "essay",
      gradingFocus: "阅读定位与写作结构"
    },
    {
      id: "showcase-assignment-g7-english-grammar",
      classId: CLASS_IDS.g7English,
      moduleId: MODULE_IDS.g7EnglishReading,
      title: "过去时语法巩固",
      description: "聚焦一般过去时和阅读信息定位的基础巩固。",
      dueDate: daysAgo(6, 18, 30),
      submissionType: "quiz",
      questionIds: subjectQuestionIds("english", "7", [KP_IDS.english7PastTense, KP_IDS.english7ReadingLocate]).slice(0, 4)
    },
    {
      id: "showcase-assignment-g7-advanced-math",
      classId: CLASS_IDS.g7MathAdvanced,
      moduleId: MODULE_IDS.g7AdvancedMath,
      title: "培优拓展·列方程建模",
      description: "完成 4 题建模题，重点关注设元与条件转译。",
      dueDate: daysAhead(4, 20, 0),
      submissionType: "quiz",
      questionIds: subjectQuestionIds("math", "7", [KP_IDS.math7LinearEquation, KP_IDS.math7Expression]).slice(0, 4)
    }
  ].map((item, index) => ({
    ...item,
    createdAt: daysAgo(12 - index, 18, 0),
    maxUploads: item.maxUploads ?? 3,
    gradingFocus: item.gradingFocus ?? null
  }));
}

function assignmentStatusOverride(assignmentId, studentId) {
  const key = `${assignmentId}:${studentId}`;
  const overrides = {
    [`showcase-assignment-g7-math-reflect:${USER_IDS.studentJiangHaochen}`]: { status: "pending" },
    [`showcase-assignment-g7-math-reflect:${USER_IDS.studentTangYifan}`]: { status: "pending" },
    [`showcase-assignment-g4-chinese-writing:${USER_IDS.studentZhaoYuhang}`]: { status: "pending" },
    [`showcase-assignment-g4-math-fix:${USER_IDS.studentZhaoYuhang}`]: { status: "in_progress" },
    [`showcase-assignment-g7-english-writing:${USER_IDS.studentJiangHaochen}`]: { status: "pending" },
    [`showcase-assignment-g7-english-grammar:${USER_IDS.studentZhouJingxing}`]: { status: "pending" }
  };
  return overrides[key] ?? null;
}

function resolveAssignmentOutcome({ assignment, studentId, subject }) {
  const proficiency = getStudentProficiency(studentId, subject);
  const dueTs = new Date(assignment.dueDate).getTime();
  const nowTs = Date.now();
  const isPast = dueTs < nowTs;
  const isSoon = dueTs >= nowTs && dueTs - nowTs <= 2 * 24 * 60 * 60 * 1000;
  let completionChance = proficiency;
  if (assignment.submissionType !== "quiz") {
    completionChance -= 0.08;
  }
  if (isPast) {
    completionChance += 0.12;
  } else if (isSoon) {
    completionChance -= 0.02;
  } else {
    completionChance -= 0.16;
  }

  const override = assignmentStatusOverride(assignment.id, studentId);
  if (override?.status === "completed") {
    return { status: "completed", proficiency };
  }
  if (override?.status === "pending") {
    return { status: "pending", proficiency };
  }
  if (override?.status === "in_progress") {
    return { status: "in_progress", proficiency };
  }

  const ratio = stableRatio(`${assignment.id}:${studentId}`);
  if (ratio <= clamp(completionChance, 0.15, 0.98)) {
    return { status: "completed", proficiency };
  }
  if (!isPast && ratio <= clamp(completionChance + 0.14, 0.2, 0.99)) {
    return { status: "in_progress", proficiency };
  }
  return { status: "pending", proficiency };
}

function createAssignmentReviewSummary({ studentId, score, total, submissionType }) {
  const student = usersById.get(studentId);
  const ratio = total > 0 ? score / total : 0;
  if (submissionType === "essay") {
    return ratio >= 0.85
      ? `${student?.name ?? "学生"}结构清楚，细节描写具体，建议继续加强开头与结尾照应。`
      : `${student?.name ?? "学生"}能完成基本表达，但细节展开还不够充分，建议先补充关键动作和语言。`;
  }
  if (submissionType === "upload") {
    return ratio >= 0.8
      ? `${student?.name ?? "学生"}订正步骤完整，单位意识明显提升。`
      : `${student?.name ?? "学生"}已完成重做，但列式依据仍需用完整句说明。`;
  }
  return ratio >= 0.75
    ? `${student?.name ?? "学生"}基础较稳，建议继续追问错因而不是只改答案。`
    : `${student?.name ?? "学生"}易在审题与运算顺序上丢分，建议按题号逐题复盘。`;
}

function buildAssignmentsBundle(questionsById) {
  const assignments = assignmentBlueprints();
  const assignmentItems = [];
  const assignmentProgress = [];
  const assignmentSubmissions = [];
  const assignmentUploads = [];
  const assignmentRubrics = [];
  const assignmentReviews = [];
  const assignmentReviewItems = [];
  const assignmentReviewRubrics = [];
  const assignmentAiReviews = [];

  assignments.forEach((assignment) => {
    const klass = classById.get(assignment.classId);
    const roster = mainClassRoster[assignment.classId] ?? [];
    const questionIds = assignment.questionIds ?? [];
    const reviewRubrics = assignment.submissionType === "quiz" ? [] : buildRubricsForType(assignment.id, assignment.submissionType);
    assignmentRubrics.push(...reviewRubrics);
    questionIds.forEach((questionId, index) => {
      assignmentItems.push({
        id: `showcase-assign-item-${assignment.id}-${index + 1}`,
        assignmentId: assignment.id,
        questionId
      });
    });

    roster.forEach((studentId, index) => {
      const { status, proficiency } = resolveAssignmentOutcome({
        assignment,
        studentId,
        subject: klass.subject
      });
      const progressId = `showcase-assign-progress-${assignment.id}-${studentId}`;
      const submittedAt =
        status === "completed"
          ? iso(new Date(new Date(assignment.dueDate).getTime() - (index % 4) * 60 * 60 * 1000))
          : null;
      let score = null;
      let total = null;

      if (status === "completed" && assignment.submissionType === "quiz") {
        const answers = {};
        let correctCount = 0;
        questionIds.forEach((questionId, questionIndex) => {
          const question = questionsById.get(questionId);
          const difficultyPenalty = question?.difficulty === "hard" ? 0.1 : question?.difficulty === "easy" ? -0.04 : 0;
          const correctChance = clamp(proficiency - difficultyPenalty, 0.18, 0.96);
          const isCorrect = stableRatio(`${assignment.id}:${studentId}:${questionId}`) <= correctChance;
          answers[questionId] = isCorrect ? question.answer : pickWrongOption(question, `${studentId}:${questionId}`);
          if (isCorrect) {
            correctCount += 1;
          }
          if (!isCorrect && correctCount <= 1) {
            assignmentReviewItems.push({
              id: `showcase-reviewitem-${assignment.id}-${studentId}-${questionIndex + 1}`,
              reviewId: `showcase-review-${assignment.id}-${studentId}`,
              questionId,
              wrongTag:
                klass.subject === "math"
                  ? "列式不稳"
                  : klass.subject === "chinese"
                    ? "信息抓取不准"
                    : "关键词定位偏差",
              comment:
                klass.subject === "math"
                  ? "建议先写出数量关系，再决定是否需要移项。"
                  : klass.subject === "chinese"
                    ? "先回到原文定位，再概括，不要凭印象选。"
                    : "先圈题干关键词，再回文定位对应句。"
            });
          }
        });
        score = correctCount;
        total = questionIds.length;
        assignmentSubmissions.push({
          id: `showcase-assign-submission-${assignment.id}-${studentId}`,
          assignmentId: assignment.id,
          studentId,
          answers,
          score,
          total,
          submittedAt
        });
      }

      if (status === "completed" && assignment.submissionType !== "quiz") {
        const rubrics = reviewRubrics;
        let running = 0;
        let rubricTotal = 0;
        rubrics.forEach((rubric, rubricIndex) => {
          const rubricScore = clamp(
            Math.round(rubric.maxScore * (proficiency + 0.08 - stableRatio(`${assignment.id}:${studentId}:rubric:${rubricIndex}`) * 0.18)),
            Math.max(4, rubric.maxScore - 6),
            rubric.maxScore
          );
          rubricTotal += rubric.maxScore;
          running += rubricScore;
          assignmentReviewRubrics.push({
            id: `showcase-review-rubric-${assignment.id}-${studentId}-${rubric.id}`,
            reviewId: `showcase-review-${assignment.id}-${studentId}`,
            rubricId: rubric.id,
            score: rubricScore,
            comment:
              rubricScore >= rubric.maxScore - 1
                ? "本项完成比较稳。"
                : "还有提升空间，建议下次先按要求列出结构或步骤。"
          });
        });
        score = running;
        total = rubricTotal;
        const submissionText = buildSubmissionText({
          studentId,
          subject: klass.subject,
          assignmentTitle: assignment.title
        });
        assignmentSubmissions.push({
          id: `showcase-assign-submission-${assignment.id}-${studentId}`,
          assignmentId: assignment.id,
          studentId,
          answers: {},
          score,
          total,
          submittedAt,
          submissionText
        });
        if (assignment.submissionType === "upload") {
          assignmentUploads.push({
            id: `showcase-upload-${assignment.id}-${studentId}`,
            assignmentId: assignment.id,
            studentId,
            fileName: `${assignment.title}-${usersById.get(studentId)?.name}.svg`,
            mimeType: "image/svg+xml",
            size: 1200,
            contentBase64: svgCardBase64(
              assignment.title,
              `${usersById.get(studentId)?.name} · ${klass.name}`,
              assignment.gradingFocus ?? "关注列式依据与清晰表达"
            ),
            contentStorageProvider: null,
            contentStorageKey: null,
            createdAt: submittedAt
          });
        }
        assignmentAiReviews.push({
          id: `showcase-ai-review-${assignment.id}-${studentId}`,
          assignmentId: assignment.id,
          studentId,
          provider: "deepseek",
          result: {
            score,
            summary:
              assignment.submissionType === "essay"
                ? "AI 判断整体结构完整，细节描写还可以更具体。"
                : "AI 判断订正步骤比较完整，但检验说明还可以更明确。",
            strengths:
              assignment.submissionType === "essay"
                ? ["基本完成三段结构", "语言较自然"]
                : ["步骤书写完整", "结果回写清楚"],
            issues:
              assignment.submissionType === "essay"
                ? ["细节展开不足", "结尾呼应略弱"]
                : ["个别步骤缺少理由", "检验语句不完整"],
            suggestions:
              assignment.submissionType === "essay"
                ? ["补充一个动作细节", "结尾增加一句情绪变化"]
                : ["在每一步旁边写出依据", "提交前检查单位和结果是否匹配"],
            writing:
              assignment.submissionType === "essay"
                ? {
                    scores: {
                      structure: Math.min(10, Math.max(6, Math.round(score / 3))),
                      grammar: 9,
                      vocab: 8
                    },
                    summary: "结构到位，建议继续扩展细节。",
                    strengths: ["起承转合清楚", "句子通顺"],
                    improvements: ["细节可再具体", "情绪变化可以更自然"],
                    corrected: "I was a little nervous at first, but I still walked to the front and finished my sharing."
                  }
                : undefined
          },
          createdAt: submittedAt,
          updatedAt: submittedAt
        });
      }

      if (status === "completed") {
        assignmentReviews.push({
          id: `showcase-review-${assignment.id}-${studentId}`,
          assignmentId: assignment.id,
          studentId,
          overallComment: createAssignmentReviewSummary({
            studentId,
            score: score ?? 0,
            total: total ?? 0,
            submissionType: assignment.submissionType
          }),
          createdAt: iso(new Date(new Date(submittedAt).getTime() + 15 * 60 * 1000)),
          updatedAt: iso(new Date(new Date(submittedAt).getTime() + 45 * 60 * 1000))
        });
      }

      assignmentProgress.push({
        id: progressId,
        assignmentId: assignment.id,
        studentId,
        status,
        completedAt: status === "completed" ? submittedAt : null,
        score,
        total
      });
    });
  });

  return {
    assignments,
    assignmentItems,
    assignmentProgress,
    assignmentSubmissions,
    assignmentUploads,
    assignmentRubrics,
    assignmentReviews,
    assignmentReviewItems,
    assignmentReviewRubrics,
    assignmentAiReviews
  };
}

function buildExamBlueprints() {
  return [
    {
      id: "showcase-paper-g4-math-unit",
      classId: CLASS_IDS.g4Math,
      title: "四年级数学·单元诊断 A",
      description: "覆盖小数意义、面积应用与混合运算的单元诊断。",
      publishMode: "teacher_assigned",
      antiCheatLevel: "basic",
      startAt: daysAgo(7, 9, 0),
      endAt: daysAgo(7, 9, 50),
      durationMinutes: 45,
      status: "closed",
      createdBy: USER_IDS.teacherLiqing,
      questionIds: subjectQuestionIds("math", "4", [KP_IDS.math4MixedCalc, KP_IDS.math4Decimal, KP_IDS.math4Area]).slice(0, 5)
    },
    {
      id: "showcase-paper-g7-math-unit",
      classId: CLASS_IDS.g7Math,
      title: "七年级数学·方程与运算周测",
      description: "覆盖有理数、一元一次方程与整式运算。",
      publishMode: "teacher_assigned",
      antiCheatLevel: "basic",
      startAt: daysAgo(3, 9, 0),
      endAt: daysAgo(3, 10, 0),
      durationMinutes: 50,
      status: "closed",
      createdBy: USER_IDS.teacherSunya,
      questionIds: subjectQuestionIds("math", "7", [KP_IDS.math7Rational, KP_IDS.math7LinearEquation, KP_IDS.math7Expression]).slice(0, 5)
    },
    {
      id: "showcase-paper-g7-english-upcoming",
      classId: CLASS_IDS.g7English,
      title: "七年级英语·Week 5 阅读测",
      description: "下周课堂测，重点看关键词定位和过去时理解。",
      publishMode: "teacher_assigned",
      antiCheatLevel: "basic",
      startAt: daysAhead(2, 19, 0),
      endAt: daysAhead(2, 19, 50),
      durationMinutes: 45,
      status: "published",
      createdBy: USER_IDS.teacherHeyan,
      questionIds: subjectQuestionIds("english", "7", [KP_IDS.english7PastTense, KP_IDS.english7ReadingLocate]).slice(0, 5)
    },
    {
      id: "showcase-paper-g7-math-live",
      classId: CLASS_IDS.g7Math,
      title: "七年级数学·课堂即时测",
      description: "课堂即时测，用于观察方程建模是否真正掌握。",
      publishMode: "teacher_assigned",
      antiCheatLevel: "basic",
      startAt: hoursAgo(1.5),
      endAt: hoursAhead(1),
      durationMinutes: 35,
      status: "published",
      createdBy: USER_IDS.teacherSunya,
      questionIds: subjectQuestionIds("math", "7", [KP_IDS.math7LinearEquation, KP_IDS.math7Expression]).slice(0, 4)
    }
  ].map((item, index) => ({
    ...item,
    createdAt: daysAgo(10 - index, 18, 0),
    updatedAt: daysAgo(index % 2, 18, 40)
  }));
}

function buildExamReviewPackData({ paperId, studentId, answers, questionIds, questionsById }) {
  const wrongQuestions = questionIds
    .map((questionId) => {
      const question = questionsById.get(questionId);
      const answer = answers[questionId] ?? "";
      const correct = answer === question.answer;
      return {
        questionId,
        stem: question.stem,
        knowledgePointId: question.knowledgePointId,
        knowledgePointTitle: knowledgePointBlueprints.find((item) => item.id === question.knowledgePointId)?.title ?? "",
        difficulty: question.difficulty,
        questionType: question.questionType,
        yourAnswer: answer,
        correctAnswer: question.answer,
        score: correct ? 1 : 0,
        correct
      };
    })
    .filter((item) => !item.correct);

  const kpCounter = new Map();
  const difficultyCounter = new Map();
  const typeCounter = new Map();
  wrongQuestions.forEach((item) => {
    kpCounter.set(item.knowledgePointId, (kpCounter.get(item.knowledgePointId) ?? 0) + 1);
    difficultyCounter.set(item.difficulty, (difficultyCounter.get(item.difficulty) ?? 0) + 1);
    typeCounter.set(item.questionType, (typeCounter.get(item.questionType) ?? 0) + 1);
  });

  const topWeakKnowledgePoints = Array.from(kpCounter.entries())
    .map(([knowledgePointId, wrongCount]) => ({
      knowledgePointId,
      title: knowledgePointBlueprints.find((item) => item.id === knowledgePointId)?.title ?? knowledgePointId,
      wrongCount
    }))
    .sort((left, right) => right.wrongCount - left.wrongCount)
    .slice(0, 3);

  return {
    wrongCount: wrongQuestions.length,
    generatedAt: minutesAgo(10),
    summary: {
      topWeakKnowledgePoints,
      wrongByDifficulty: Array.from(difficultyCounter.entries()).map(([difficulty, count]) => ({ difficulty, count })),
      wrongByType: Array.from(typeCounter.entries()).map(([questionType, count]) => ({ questionType, count })),
      estimatedMinutes: Math.max(12, wrongQuestions.length * 7)
    },
    rootCauses:
      wrongQuestions.length > 0
        ? ["错题集中在同一薄弱点，建议先做 24 小时复练。", "应用题中容易跳过列式依据，审题与转译仍需强化。"]
        : ["本次答题稳定，可把复盘重点放在方法总结上。"],
    actionItems: [
      {
        id: `review-pack-${paperId}-${studentId}-kp`,
        title: "先修复最高频薄弱点",
        description: topWeakKnowledgePoints[0]
          ? `先补练「${topWeakKnowledgePoints[0].title}」相关题目 4 题。`
          : "保持当前复盘节奏即可。",
        estimatedMinutes: 15,
        knowledgePointIds: topWeakKnowledgePoints.map((item) => item.knowledgePointId)
      },
      {
        id: `review-pack-${paperId}-${studentId}-wrongbook`,
        title: "纳入今日错题复练",
        description: "把本次错题加入今日复练队列，优先完成 24 小时内复练。",
        estimatedMinutes: 12,
        knowledgePointIds: topWeakKnowledgePoints.map((item) => item.knowledgePointId)
      }
    ],
    sevenDayPlan: [
      { day: 1, title: "D1 错因复盘", focus: "逐题写出错因与改正", estimatedMinutes: 18 },
      { day: 2, title: "D2 24h 复练", focus: "完成同知识点 3 题复练", estimatedMinutes: 15 },
      { day: 4, title: "D4 变式训练", focus: "做 2 题变式题检验迁移", estimatedMinutes: 15 },
      { day: 7, title: "D7 回看总结", focus: "确认本周是否稳定掌握", estimatedMinutes: 10 }
    ],
    wrongQuestions: wrongQuestions.map((item) => ({
      questionId: item.questionId,
      stem: item.stem,
      knowledgePointId: item.knowledgePointId,
      knowledgePointTitle: item.knowledgePointTitle,
      difficulty: item.difficulty,
      questionType: item.questionType,
      yourAnswer: item.yourAnswer,
      correctAnswer: item.correctAnswer,
      score: item.score
    }))
  };
}

function buildExamsBundle(questionsById) {
  const papers = buildExamBlueprints();
  const paperItems = [];
  const examAssignments = [];
  const examAnswers = [];
  const examSubmissions = [];
  const examReviewPackages = [];
  const examEvents = [];

  papers.forEach((paper) => {
    const roster = mainClassRoster[paper.classId] ?? [];
    const subject = classSubjectMap.get(paper.classId);
    paper.questionIds.forEach((questionId, index) => {
      paperItems.push({
        id: `showcase-paper-item-${paper.id}-${index + 1}`,
        paperId: paper.id,
        questionId,
        score: 1,
        orderIndex: index
      });
    });

    roster.forEach((studentId, index) => {
      const proficiency = getStudentProficiency(studentId, subject);
      let status = "pending";
      if (paper.id === "showcase-paper-g7-math-live" && studentId === USER_IDS.studentJiangHaochen) {
        status = "in_progress";
      } else if (paper.status === "closed") {
        status = stableRatio(`${paper.id}:${studentId}`) <= clamp(proficiency + 0.2, 0.45, 0.98) ? "submitted" : "pending";
      }

      const assignmentRow = {
        id: `showcase-exam-assignment-${paper.id}-${studentId}`,
        paperId: paper.id,
        studentId,
        status,
        assignedAt: iso(new Date(new Date(paper.startAt).getTime() - 12 * 60 * 60 * 1000)),
        startedAt: status === "submitted" ? iso(new Date(new Date(paper.startAt).getTime() + index * 60 * 1000)) : status === "in_progress" ? hoursAgo(1.1) : null,
        autoSavedAt: status === "in_progress" ? minutesAgo(12) : null,
        submittedAt: status === "submitted" ? iso(new Date(new Date(paper.endAt).getTime() - (index % 3) * 60 * 1000)) : null,
        score: null,
        total: null
      };

      if (status === "submitted") {
        const answers = {};
        let score = 0;
        paper.questionIds.forEach((questionId) => {
          const question = questionsById.get(questionId);
          const correctChance = clamp(proficiency - (question.difficulty === "hard" ? 0.12 : 0), 0.15, 0.97);
          const correct = stableRatio(`exam:${paper.id}:${studentId}:${questionId}`) <= correctChance;
          answers[questionId] = correct ? question.answer : pickWrongOption(question, `exam-wrong:${studentId}:${questionId}`);
          if (correct) {
            score += 1;
          }
        });
        assignmentRow.score = score;
        assignmentRow.total = paper.questionIds.length;
        examSubmissions.push({
          id: `showcase-exam-submission-${paper.id}-${studentId}`,
          paperId: paper.id,
          studentId,
          answers,
          score,
          total: paper.questionIds.length,
          submittedAt: assignmentRow.submittedAt
        });
        examReviewPackages.push({
          id: `showcase-exam-reviewpack-${paper.id}-${studentId}`,
          paperId: paper.id,
          studentId,
          data: buildExamReviewPackData({
            paperId: paper.id,
            studentId,
            answers,
            questionIds: paper.questionIds,
            questionsById
          }),
          generatedAt: iso(new Date(new Date(assignmentRow.submittedAt).getTime() + 30 * 60 * 1000))
        });
        if (paper.id === "showcase-paper-g7-math-unit" && studentId === USER_IDS.studentJiangHaochen) {
          examEvents.push({
            id: `showcase-exam-event-${paper.id}-${studentId}`,
            paperId: paper.id,
            studentId,
            blurCount: 2,
            visibilityHiddenCount: 1,
            lastEventAt: assignmentRow.submittedAt,
            updatedAt: assignmentRow.submittedAt
          });
        }
      }

      if (status === "in_progress") {
        const partialAnswers = {};
        paper.questionIds.forEach((questionId, questionIndex) => {
          const question = questionsById.get(questionId);
          if (questionIndex < 2) {
            partialAnswers[questionId] =
              questionIndex === 0 ? pickWrongOption(question, `partial:${studentId}:${questionId}`) : question.answer;
          }
        });
        examAnswers.push({
          id: `showcase-exam-answer-${paper.id}-${studentId}`,
          paperId: paper.id,
          studentId,
          answers: partialAnswers,
          updatedAt: minutesAgo(8)
        });
        examEvents.push({
          id: `showcase-exam-event-${paper.id}-${studentId}`,
          paperId: paper.id,
          studentId,
          blurCount: 1,
          visibilityHiddenCount: 1,
          lastEventAt: minutesAgo(6),
          updatedAt: minutesAgo(6)
        });
      }

      examAssignments.push(assignmentRow);
    });
  });

  return {
    papers,
    paperItems,
    examAssignments,
    examAnswers,
    examSubmissions,
    examReviewPackages,
    examEvents
  };
}

function buildQuestionAttempts({ assignmentsBundle, examsBundle, questionsById }) {
  const attempts = [];
  const pushAttempt = ({ userId, questionId, subject, answer, createdAt, reason }) => {
    const question = questionsById.get(questionId);
    attempts.push({
      id: `showcase-attempt-${attempts.length + 1}`,
      userId,
      questionId,
      subject,
      knowledgePointId: question.knowledgePointId,
      correct: answer === question.answer,
      answer,
      reason,
      createdAt
    });
  };

  assignmentsBundle.assignmentSubmissions.forEach((submission) => {
    const assignment = assignmentsBundle.assignments.find((item) => item.id === submission.assignmentId);
    if (!assignment || assignment.submissionType !== "quiz") return;
    const subject = classSubjectMap.get(assignment.classId);
    Object.entries(submission.answers).forEach(([questionId, answer]) => {
      pushAttempt({
        userId: submission.studentId,
        questionId,
        subject,
        answer,
        createdAt: submission.submittedAt,
        reason: `assignment:${assignment.id}`
      });
    });
  });

  examsBundle.examSubmissions.forEach((submission) => {
    const paper = examsBundle.papers.find((item) => item.id === submission.paperId);
    if (!paper) return;
    const subject = classSubjectMap.get(paper.classId);
    Object.entries(submission.answers).forEach(([questionId, answer]) => {
      pushAttempt({
        userId: submission.studentId,
        questionId,
        subject,
        answer,
        createdAt: submission.submittedAt,
        reason: `exam:${paper.id}`
      });
    });
  });

  [
    [USER_IDS.studentJiangHaochen, `${KP_IDS.math7LinearEquation}-q1`, "math", pickWrongOption(questionsById.get(`${KP_IDS.math7LinearEquation}-q1`), "haochen-1"), hoursAgo(12)],
    [USER_IDS.studentJiangHaochen, `${KP_IDS.math7LinearEquation}-q2`, "math", questionsById.get(`${KP_IDS.math7LinearEquation}-q2`).answer, hoursAgo(10)],
    [USER_IDS.studentJiangHaochen, `${KP_IDS.math7LinearEquation}-q2`, "math", pickWrongOption(questionsById.get(`${KP_IDS.math7LinearEquation}-q2`), "haochen-2"), hoursAgo(7)],
    [USER_IDS.studentZhaoYuhang, `${KP_IDS.chinese4Paragraph}-q2`, "chinese", pickWrongOption(questionsById.get(`${KP_IDS.chinese4Paragraph}-q2`), "yuhang-1"), hoursAgo(16)],
    [USER_IDS.studentZhaoYuhang, `${KP_IDS.chinese4Paragraph}-q1`, "chinese", questionsById.get(`${KP_IDS.chinese4Paragraph}-q1`).answer, hoursAgo(9)]
  ].forEach(([userId, questionId, subject, answer, createdAt]) => {
    pushAttempt({
      userId,
      questionId,
      subject,
      answer,
      createdAt,
      reason: "study-variant"
    });
  });

  return attempts;
}

function buildMasteryRecords(attempts, questionsById) {
  const records = [];
  const grouped = new Map();
  attempts.forEach((attempt) => {
    const question = questionsById.get(attempt.questionId);
    const key = `${attempt.userId}:${attempt.knowledgePointId}`;
    const current =
      grouped.get(key) ?? {
        userId: attempt.userId,
        knowledgePointId: attempt.knowledgePointId,
        subject: question.subject,
        correct: 0,
        total: 0,
        recentCorrect: 0,
        recentTotal: 0,
        previousCorrect: 0,
        previousTotal: 0,
        lastAttemptAt: null
      };
    current.total += 1;
    current.correct += attempt.correct ? 1 : 0;
    const attemptTs = new Date(attempt.createdAt).getTime();
    const nowTs = Date.now();
    if (attemptTs >= nowTs - 7 * 24 * 60 * 60 * 1000) {
      current.recentTotal += 1;
      current.recentCorrect += attempt.correct ? 1 : 0;
    } else if (attemptTs >= nowTs - 14 * 24 * 60 * 60 * 1000) {
      current.previousTotal += 1;
      current.previousCorrect += attempt.correct ? 1 : 0;
    }
    if (!current.lastAttemptAt || attempt.createdAt > current.lastAttemptAt) {
      current.lastAttemptAt = attempt.createdAt;
    }
    grouped.set(key, current);
  });

  Array.from(grouped.values()).forEach((item, index) => {
    const masteryScore = clamp(Math.round(((item.correct + 1) / (item.total + 2)) * 100), 0, 100);
    const confidenceScore = clamp(Math.round((1 - Math.exp(-item.total / 6)) * 100), 0, 100);
    const recencyWeight = clamp(
      item.lastAttemptAt ? 100 - Math.round((Date.now() - new Date(item.lastAttemptAt).getTime()) / (24 * 60 * 60 * 1000)) * 4 : 0,
      35,
      100
    );
    const previousRatio = item.previousTotal > 0 ? item.previousCorrect / item.previousTotal : item.recentTotal > 0 ? item.recentCorrect / item.recentTotal : 0;
    const recentRatio = item.recentTotal > 0 ? item.recentCorrect / item.recentTotal : previousRatio;
    records.push({
      id: `showcase-mastery-${item.userId}-${item.knowledgePointId}`,
      userId: item.userId,
      subject: item.subject,
      knowledgePointId: item.knowledgePointId,
      correct: item.correct,
      total: item.total,
      masteryScore,
      confidenceScore,
      recencyWeight,
      masteryTrend7d: Math.round((recentRatio - previousRatio) * 100),
      lastAttemptAt: item.lastAttemptAt,
      updatedAt: daysAgo(index % 3, 22, 0)
    });
  });

  return records;
}

function buildStudyPlans(masteryRecords) {
  const plans = [];
  const planItems = [];
  const recordsByUserSubject = new Map();
  masteryRecords.forEach((record) => {
    const key = `${record.userId}:${record.subject}`;
    const list = recordsByUserSubject.get(key) ?? [];
    list.push(record);
    recordsByUserSubject.set(key, list);
  });

  studentUsers.forEach((student) => {
    ["math", "chinese", "english"].forEach((subject, subjectIndex) => {
      const key = `${student.id}:${subject}`;
      const weakest = [...(recordsByUserSubject.get(key) ?? [])]
        .sort((left, right) => left.masteryScore - right.masteryScore)
        .slice(0, 2);
      if (!weakest.length) return;
      const planId = `showcase-plan-${student.id}-${subject}`;
      plans.push({
        id: planId,
        userId: student.id,
        subject,
        createdAt: daysAgo(1 + subjectIndex, 21, 0)
      });
      weakest.forEach((record, index) => {
        planItems.push({
          id: `showcase-plan-item-${planId}-${index + 1}`,
          planId,
          knowledgePointId: record.knowledgePointId,
          targetCount: record.masteryScore < 60 ? 6 : 4,
          dueDate: daysAhead(index + 2, 21, 30)
        });
      });
    });
  });

  return { plans, planItems };
}

function buildCorrectionsAndReviews({ attempts, questionsById }) {
  const byUserWrong = new Map();
  attempts
    .filter((attempt) => !attempt.correct)
    .forEach((attempt) => {
      const list = byUserWrong.get(attempt.userId) ?? [];
      const seen = new Set(list.map((item) => item.questionId));
      if (!seen.has(attempt.questionId)) {
        list.push(attempt);
      }
      byUserWrong.set(attempt.userId, list);
    });

  const correctionTasks = [];
  const wrongReviewItems = [];
  const reviewTasks = [];
  const memoryReviews = [];
  const favorites = [];

  [USER_IDS.studentJiangHaochen, USER_IDS.studentZhaoYuhang, USER_IDS.studentZhouJingxing].forEach((studentId, userIndex) => {
    const wrongAttempts = (byUserWrong.get(studentId) ?? []).slice(0, 3);
    wrongAttempts.forEach((attempt, index) => {
      const question = questionsById.get(attempt.questionId);
      const dueAt = index === 0 ? daysAgo(1, 20, 0) : index === 1 ? daysAhead(0, 19, 0) : daysAhead(2, 20, 0);
      const originType = attempt.reason.startsWith("exam:") ? "exam" : "assignment";
      const originPaperId = attempt.reason.split(":")[1] ?? null;
      correctionTasks.push({
        id: `showcase-correction-${studentId}-${index + 1}`,
        userId: studentId,
        questionId: attempt.questionId,
        subject: attempt.subject,
        knowledgePointId: attempt.knowledgePointId,
        status: index === 2 && studentId === USER_IDS.studentZhaoYuhang ? "completed" : "pending",
        dueDate: dueAt,
        createdAt: daysAgo(2 + index, 18, 0),
        completedAt: index === 2 && studentId === USER_IDS.studentZhaoYuhang ? daysAgo(1, 19, 30) : null
      });
      wrongReviewItems.push({
        id: `showcase-wrong-review-${studentId}-${index + 1}`,
        userId: studentId,
        questionId: attempt.questionId,
        subject: attempt.subject,
        knowledgePointId: attempt.knowledgePointId,
        intervalLevel: index === 0 ? 1 : index === 1 ? 2 : 3,
        nextReviewAt: dueAt,
        lastReviewResult: index === 2 ? "correct" : "wrong",
        lastReviewAt: index === 2 ? daysAgo(1, 18, 30) : daysAgo(2, 19, 0),
        reviewCount: index + 1,
        status: "active",
        firstWrongAt: attempt.createdAt,
        createdAt: attempt.createdAt,
        updatedAt: daysAgo(index % 2, 20, 0),
        sourceType: originType,
        sourcePaperId: originPaperId,
        sourceSubmittedAt: attempt.createdAt
      });
      reviewTasks.push({
        id: `showcase-review-task-${studentId}-${index + 1}`,
        userId: studentId,
        questionId: attempt.questionId,
        sourceType: "wrong",
        subject: attempt.subject,
        knowledgePointId: attempt.knowledgePointId,
        status: "active",
        intervalLevel: index + 1,
        nextReviewAt: dueAt,
        completedAt: null,
        lastReviewResult: index === 2 ? "correct" : "wrong",
        lastReviewAt: index === 2 ? daysAgo(1, 18, 30) : daysAgo(2, 19, 0),
        reviewCount: index + 1,
        originType,
        originPaperId,
        originSubmittedAt: attempt.createdAt,
        payload: { grade: usersById.get(studentId)?.grade ?? null },
        createdAt: attempt.createdAt,
        updatedAt: daysAgo(index % 2, 21, 0)
      });
      if (index === 0) {
        favorites.push({
          id: `showcase-favorite-${studentId}-${index + 1}`,
          userId: studentId,
          questionId: attempt.questionId,
          tags: [attempt.subject === "math" ? "易错" : "回看"],
          note:
            attempt.subject === "math"
              ? "这道题总是卡在列式前，先把条件翻译成一句话。"
              : "回到原文定位后再做选择。",
          createdAt: daysAgo(2, 21, 0),
          updatedAt: daysAgo(userIndex % 2, 21, 20)
        });
      }
    });
  });

  [USER_IDS.studentLinZhiyuan, USER_IDS.studentShenZhiruo, USER_IDS.studentSongKexin].forEach((studentId, index) => {
    const correctAttempt = attempts.find((attempt) => attempt.userId === studentId && attempt.correct);
    if (!correctAttempt) return;
    memoryReviews.push({
      id: `showcase-memory-review-${studentId}`,
      userId: studentId,
      questionId: correctAttempt.questionId,
      stage: index + 1,
      nextReviewAt: daysAhead(index + 1, 20, 0),
      lastReviewedAt: daysAgo(1, 19, 0),
      createdAt: correctAttempt.createdAt,
      updatedAt: daysAgo(0, 20, 0)
    });
  });

  return { correctionTasks, wrongReviewItems, reviewTasks, memoryReviews, favorites };
}

function buildFocusSessions() {
  return [
    {
      id: "showcase-focus-haochen-1",
      userId: USER_IDS.studentJiangHaochen,
      mode: "review",
      durationMinutes: 20,
      startedAt: daysAgo(1, 19, 10),
      endedAt: daysAgo(1, 19, 30),
      createdAt: daysAgo(1, 19, 10)
    },
    {
      id: "showcase-focus-lin-1",
      userId: USER_IDS.studentLinZhiyuan,
      mode: "practice",
      durationMinutes: 25,
      startedAt: daysAgo(2, 20, 0),
      endedAt: daysAgo(2, 20, 25),
      createdAt: daysAgo(2, 20, 0)
    },
    {
      id: "showcase-focus-zhiruo-1",
      userId: USER_IDS.studentShenZhiruo,
      mode: "writing",
      durationMinutes: 30,
      startedAt: daysAgo(1, 21, 0),
      endedAt: daysAgo(1, 21, 30),
      createdAt: daysAgo(1, 21, 0)
    }
  ];
}

function buildAiHistory() {
  return [
    {
      id: "showcase-ai-history-haochen-1",
      userId: USER_IDS.studentJiangHaochen,
      question: "方程应用题总是列不出来，我该先看什么？",
      answer: "先把已知量、未知量和“总量/差值/倍数”分三列写出来，再决定设元方式。",
      favorite: true,
      tags: ["错题讲解", "math"],
      createdAt: daysAgo(1, 20, 20),
      meta: { provider: "deepseek", latencyMs: 820 }
    },
    {
      id: "showcase-ai-history-zhiruo-1",
      userId: USER_IDS.studentShenZhiruo,
      question: "英语邮件结尾如何更自然？",
      answer: "可先感谢老师或同学，再用 See you soon / Best wishes 自然结束。",
      favorite: false,
      tags: ["写作", "english"],
      createdAt: daysAgo(2, 21, 10),
      meta: { provider: "kimi", latencyMs: 640 }
    },
    {
      id: "showcase-ai-history-yuhang-1",
      userId: USER_IDS.studentZhaoYuhang,
      question: "怎么概括段落大意不丢分？",
      answer: "先找关键人物和事件，再用一句完整的话回答“这段主要写了什么”。",
      favorite: true,
      tags: ["阅读", "chinese"],
      createdAt: hoursAgo(15),
      meta: { provider: "deepseek", latencyMs: 730 }
    }
  ];
}

function buildWritingSubmissions() {
  return [
    {
      id: "showcase-writing-songkexin",
      userId: USER_IDS.studentSongKexin,
      subject: "english",
      grade: "7",
      title: "A note to my teacher",
      content: "Dear Ms. He, I want to tell you about our class reading activity next Friday...",
      feedback: {
        summary: "结构完整，细节安排清楚。",
        strengths: ["开头礼貌自然", "活动安排表达完整"],
        improvements: ["可增加一个时间连接词", "结尾再补一句感谢语"],
        corrected: "Dear Ms. He, I am writing to tell you about our class reading activity next Friday. Thank you for your support."
      },
      createdAt: daysAgo(4, 21, 0)
    }
  ];
}

function buildAnnouncements() {
  return [
    {
      id: "showcase-announcement-g4math",
      classId: CLASS_IDS.g4Math,
      authorId: USER_IDS.teacherLiqing,
      title: "周五带好错题整理本",
      content: "周五第三节将做面积应用题讲评，请同学们把本周订正单和铅笔都带齐。",
      createdAt: daysAgo(2, 18, 0)
    },
    {
      id: "showcase-announcement-g4chinese",
      classId: CLASS_IDS.g4Chinese,
      authorId: USER_IDS.teacherWangnan,
      title: "周六阅读工作坊安排",
      content: "本周六进行共读与表达工作坊，建议提前完成晨读单。",
      createdAt: daysAgo(1, 17, 30)
    },
    {
      id: "showcase-announcement-g7math",
      classId: CLASS_IDS.g7Math,
      authorId: USER_IDS.teacherSunya,
      title: "周测讲评与复练节奏",
      content: "单元周测将于本周课堂完成讲评，周末安排一轮复练，未完成错因复盘的同学请尽快补交。",
      createdAt: daysAgo(3, 18, 20)
    },
    {
      id: "showcase-announcement-g7english",
      classId: CLASS_IDS.g7English,
      authorId: USER_IDS.teacherHeyan,
      title: "阅读测准备提醒",
      content: "下周阅读测重点看关键词定位和过去时，晚自习可先复看模板页。",
      createdAt: daysAgo(1, 19, 0)
    }
  ];
}

function buildDiscussions() {
  return [
    {
      id: "showcase-discussion-g7english-reading",
      classId: CLASS_IDS.g7English,
      authorId: USER_IDS.teacherHeyan,
      title: "阅读定位时先看题干还是先看全文？",
      content: "这周很多同学在阅读测预演里还是先从头读到尾，想听听大家自己的定位习惯。",
      pinned: true,
      createdAt: daysAgo(2, 20, 0),
      updatedAt: daysAgo(1, 21, 0)
    },
    {
      id: "showcase-discussion-g4math-area",
      classId: CLASS_IDS.g4Math,
      authorId: USER_IDS.teacherLiqing,
      title: "面积题为什么总会忘记写单位？",
      content: "可以分享一下你自己防止漏单位的小方法，我们下节课挑几个好方法上墙。",
      pinned: false,
      createdAt: daysAgo(3, 19, 30),
      updatedAt: daysAgo(2, 20, 0)
    },
    {
      id: "showcase-discussion-g7chinese-clue",
      classId: CLASS_IDS.g7Chinese,
      authorId: USER_IDS.studentSongKexin,
      title: "线索题能不能先画出时间顺序？",
      content: "我发现先画时间顺序会更清楚，但有时候文章不是按时间写的，大家会怎么做？",
      pinned: false,
      createdAt: daysAgo(1, 20, 30),
      updatedAt: daysAgo(0, 19, 40)
    }
  ];
}

function buildDiscussionReplies() {
  return [
    {
      id: "showcase-reply-1",
      discussionId: "showcase-discussion-g7english-reading",
      authorId: USER_IDS.studentGuYuanan,
      parentId: null,
      content: "我会先看题干圈关键词，再回文定位，尤其是时间和人物题会快很多。",
      createdAt: daysAgo(1, 20, 40)
    },
    {
      id: "showcase-reply-2",
      discussionId: "showcase-discussion-g4math-area",
      authorId: USER_IDS.studentLinZhiyuan,
      parentId: null,
      content: "我现在会在算式最后空一格，专门提醒自己补上单位。",
      createdAt: daysAgo(2, 20, 20)
    },
    {
      id: "showcase-reply-3",
      discussionId: "showcase-discussion-g7chinese-clue",
      authorId: USER_IDS.teacherXuzhe,
      parentId: null,
      content: "如果不是按时间写，可以改成“物品/情绪/事件变化”三列来梳理。",
      createdAt: daysAgo(0, 18, 20)
    }
  ];
}

function buildInbox() {
  const threads = [
    {
      id: "showcase-thread-parent-math",
      subject: "关于江昊辰方程复盘的跟进",
      createdAt: daysAgo(2, 18, 0),
      updatedAt: daysAgo(1, 21, 0),
      participants: [USER_IDS.teacherSunya, USER_IDS.parentJiangXuemei],
      messages: [
        [USER_IDS.teacherSunya, "这周昊辰的错因复盘还没交齐，我把关键问题整理给您，方便今晚一起看。", daysAgo(2, 18, 0)],
        [USER_IDS.parentJiangXuemei, "收到，我今晚先盯他把列式依据写出来，完成后再回传。", daysAgo(1, 20, 10)]
      ]
    },
    {
      id: "showcase-thread-school-schedule",
      subject: "下周英语阅读测与场地调整",
      createdAt: daysAgo(3, 17, 0),
      updatedAt: daysAgo(2, 18, 0),
      participants: [USER_IDS.schoolAdmin, USER_IDS.teacherHeyan],
      messages: [
        [USER_IDS.schoolAdmin, "周二下午多媒体教室有家长开放日，占用时间请提前确认阅读测场地。", daysAgo(3, 17, 0)],
        [USER_IDS.teacherHeyan, "已调整到 C305，并同步更新给学生和家长。", daysAgo(2, 18, 0)]
      ]
    },
    {
      id: "showcase-thread-student-makeup",
      subject: "关于周测补做安排",
      createdAt: daysAgo(4, 19, 0),
      updatedAt: daysAgo(3, 19, 10),
      participants: [USER_IDS.teacherLiqing, USER_IDS.studentZhaoYuhang],
      messages: [
        [USER_IDS.teacherLiqing, "宇航，面积订正单如果今天补齐，周五可以参加小组讲评。", daysAgo(4, 19, 0)],
        [USER_IDS.studentZhaoYuhang, "老师我今天晚自习会补齐并重新拍照上传。", daysAgo(3, 19, 10)]
      ]
    }
  ];

  const inboxThreads = threads.map((item) => ({
    id: item.id,
    subject: item.subject,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));
  const inboxParticipants = [];
  const inboxMessages = [];
  threads.forEach((thread) => {
    thread.participants.forEach((userId, index) => {
      inboxParticipants.push({
        id: `showcase-participant-${thread.id}-${userId}`,
        threadId: thread.id,
        userId,
        lastReadAt: index === 0 ? thread.updatedAt : daysAgo(1, 22, 0)
      });
    });
    thread.messages.forEach(([senderId, content, createdAt], index) => {
      inboxMessages.push({
        id: `showcase-message-${thread.id}-${index + 1}`,
        threadId: thread.id,
        senderId,
        content,
        createdAt
      });
    });
  });
  return { inboxThreads, inboxParticipants, inboxMessages };
}

function buildNotifications() {
  return [
    {
      id: "showcase-notice-haochen-review",
      userId: USER_IDS.studentJiangHaochen,
      title: "今晚先完成方程错因复盘",
      content: "你还有 1 份逾期数学复盘任务，建议先写“已知量/未知量/等式”三栏。",
      type: "review",
      createdAt: hoursAgo(6),
      readAt: null
    },
    {
      id: "showcase-notice-parent-haochen",
      userId: USER_IDS.parentJiangXuemei,
      title: "需要家长跟进：方程复盘未完成",
      content: "昊辰的方程错因复盘仍未提交，建议今晚先完成第 1 题的列式依据。",
      type: "parent_action",
      createdAt: hoursAgo(5),
      readAt: null
    },
    {
      id: "showcase-notice-zhiruo-exam",
      userId: USER_IDS.studentShenZhiruo,
      title: "阅读测已发布",
      content: "七年级英语 Week 5 阅读测已发布，建议先复看关键词定位模板页。",
      type: "exam",
      createdAt: daysAgo(1, 18, 10),
      readAt: daysAgo(1, 20, 0)
    },
    {
      id: "showcase-notice-school-admin",
      userId: USER_IDS.schoolAdmin,
      title: "1 个班级尚未配置固定课程表",
      content: "七年级（2）班·数学培优仍未固化节次，学校端会显示为待处理。",
      type: "school_overview",
      createdAt: daysAgo(1, 9, 0),
      readAt: null
    },
    {
      id: "showcase-notice-liqing",
      userId: USER_IDS.teacherLiqing,
      title: "2 名学生待完成数学复盘",
      content: "江昊辰、唐一凡的《方程应用题错因复盘》仍未提交，建议优先催交。",
      type: "teacher_alert",
      createdAt: daysAgo(0, 15, 0),
      readAt: null
    }
  ];
}

function buildParentActionReceipts() {
  return [
    {
      id: "showcase-parent-receipt-haochen-weekly-1",
      parentId: USER_IDS.parentJiangXuemei,
      studentId: USER_IDS.studentJiangHaochen,
      source: "weekly_report",
      actionItemId: "daily-practice",
      status: "done",
      note: "固定在晚饭后 20 分钟完成基础练习。",
      estimatedMinutes: 18,
      effectScore: 8,
      completedAt: daysAgo(1, 20, 40),
      createdAt: daysAgo(1, 20, 40),
      updatedAt: daysAgo(1, 20, 40)
    },
    {
      id: "showcase-parent-receipt-haochen-weekly-2",
      parentId: USER_IDS.parentJiangXuemei,
      studentId: USER_IDS.studentJiangHaochen,
      source: "weekly_report",
      actionItemId: `weak-${KP_IDS.math7LinearEquation}`,
      status: "done",
      note: "先盯他把条件翻译成一句话，再让他自己列方程。",
      estimatedMinutes: 20,
      effectScore: 12,
      completedAt: daysAgo(1, 21, 10),
      createdAt: daysAgo(1, 21, 10),
      updatedAt: daysAgo(1, 21, 10)
    },
    {
      id: "showcase-parent-receipt-haochen-weekly-3",
      parentId: USER_IDS.parentJiangXuemei,
      studentId: USER_IDS.studentJiangHaochen,
      source: "weekly_report",
      actionItemId: "wrong-review",
      status: "skipped",
      note: "昨晚补完学校任务太晚，今天改为先完成逾期作业。",
      estimatedMinutes: 10,
      effectScore: -4,
      completedAt: hoursAgo(9),
      createdAt: hoursAgo(9),
      updatedAt: hoursAgo(9)
    },
    {
      id: "showcase-parent-receipt-haochen-assignment-1",
      parentId: USER_IDS.parentJiangXuemei,
      studentId: USER_IDS.studentJiangHaochen,
      source: "assignment_plan",
      actionItemId: "clear-overdue",
      status: "done",
      note: "先把数学复盘的第 1 题重写完再休息。",
      estimatedMinutes: 25,
      effectScore: 10,
      completedAt: hoursAgo(7),
      createdAt: hoursAgo(7),
      updatedAt: hoursAgo(7)
    },
    {
      id: "showcase-parent-receipt-haochen-assignment-2",
      parentId: USER_IDS.parentJiangXuemei,
      studentId: USER_IDS.studentJiangHaochen,
      source: "assignment_plan",
      actionItemId: "daily-checklist",
      status: "done",
      note: "改为先核对上传、再让孩子自己提交。",
      estimatedMinutes: 15,
      effectScore: 6,
      completedAt: hoursAgo(6),
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6)
    },
    {
      id: "showcase-parent-receipt-haochen-assignment-3",
      parentId: USER_IDS.parentJiangXuemei,
      studentId: USER_IDS.studentJiangHaochen,
      source: "assignment_plan",
      actionItemId: "review-today",
      status: "done",
      note: "先做两题复练，再回看老师批注。",
      estimatedMinutes: 15,
      effectScore: 7,
      completedAt: hoursAgo(5),
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(5)
    },
    {
      id: "showcase-parent-receipt-yuhang-weekly-1",
      parentId: USER_IDS.parentZhaoMin,
      studentId: USER_IDS.studentZhaoYuhang,
      source: "weekly_report",
      actionItemId: "daily-practice",
      status: "done",
      note: "把每日练习拆成 6 题一组，完成后立即口头复盘。",
      estimatedMinutes: 15,
      effectScore: 5,
      completedAt: daysAgo(2, 20, 30),
      createdAt: daysAgo(2, 20, 30),
      updatedAt: daysAgo(2, 20, 30)
    }
  ];
}

function buildExperimentFlags() {
  return [
    {
      id: "showcase-exp-parent-loop",
      key: "parent_action_center_v2",
      name: "家长执行中心二期",
      description: "展示回执、执行率与效果分数。",
      enabled: true,
      rollout: 100,
      updatedAt: daysAgo(1, 10, 0)
    },
    {
      id: "showcase-exp-schedule-ai",
      key: "school_schedule_ai_preview",
      name: "学校排课 AI 预览",
      description: "学校端支持 AI 排课预览与回滚。",
      enabled: true,
      rollout: 100,
      updatedAt: daysAgo(2, 9, 0)
    }
  ];
}

function buildAdminLogs() {
  return [
    {
      id: "showcase-adminlog-1",
      adminId: USER_IDS.platformAdmin,
      action: "publish_library_item",
      entityType: "library_item",
      entityId: "showcase-library-g7-english-writing",
      detail: "发布《七年级英语·邮件写作支架》，用于学校展示环境。",
      createdAt: daysAgo(7, 18, 0)
    },
    {
      id: "showcase-adminlog-2",
      adminId: USER_IDS.platformAdmin,
      action: "update_ai_policy",
      entityType: "ai_task_policy",
      entityId: "homework_review",
      detail: "将作业批改任务主链调整为 deepseek -> kimi，并提高最小质量阈值。",
      createdAt: daysAgo(5, 20, 20)
    },
    {
      id: "showcase-adminlog-3",
      adminId: USER_IDS.platformAdmin,
      action: "review_recovery_request",
      entityType: "recovery_request",
      entityId: "recovery-demo-001",
      detail: "演示环境补录 1 条账号恢复工单处理记录。",
      createdAt: daysAgo(4, 17, 30)
    },
    {
      id: "showcase-adminlog-4",
      adminId: USER_IDS.schoolAdmin,
      action: "school_schedule_followup",
      entityType: "school_schedule",
      entityId: CLASS_IDS.g7MathAdvanced,
      detail: "标记培优班固定节次待确认。",
      createdAt: daysAgo(1, 9, 10)
    }
  ];
}

function buildAnalyticsEvents() {
  const events = [];
  const addEvent = ({ userId, role, eventName, subject = null, grade = null, page = null, days = 0, hour = 20, sessionId, entityId = null }) => {
    events.push({
      id: `showcase-event-${events.length + 1}`,
      eventName,
      eventTime: daysAgo(days, hour, 0),
      receivedAt: daysAgo(days, hour, 1),
      userId,
      role,
      subject,
      grade,
      page,
      sessionId,
      traceId: `trace-${stableNumber(`${eventName}:${userId}:${sessionId}`)}`,
      entityId,
      props: { source: "showcase-seed" },
      propsTruncated: false,
      userAgent: "Mozilla/5.0 Showcase Browser",
      ip: "203.0.113.10"
    });
  };

  [
    USER_IDS.studentLinZhiyuan,
    USER_IDS.studentZhaoYuhang,
    USER_IDS.studentJiangHaochen,
    USER_IDS.studentShenZhiruo,
    USER_IDS.studentSongKexin,
    USER_IDS.studentGuYuanan
  ].forEach((studentId, index) => {
    const student = usersById.get(studentId);
    const sessionId = `session-student-${index + 1}`;
    addEvent({ userId: studentId, role: "student", eventName: "login_page_view", grade: student.grade, page: "/login", days: 6 - index, hour: 19, sessionId });
    addEvent({ userId: studentId, role: "student", eventName: "login_success", grade: student.grade, page: "/student", days: 6 - index, hour: 19, sessionId });
    addEvent({ userId: studentId, role: "student", eventName: "practice_page_view", subject: "math", grade: student.grade, page: "/practice", days: 5 - index, hour: 20, sessionId });
    addEvent({ userId: studentId, role: "student", eventName: "practice_submit_success", subject: "math", grade: student.grade, page: "/practice", days: 5 - index, hour: 20, sessionId, entityId: `${KP_IDS.math7LinearEquation}-q1` });
  });

  [
    USER_IDS.parentJiangXuemei,
    USER_IDS.parentZhaoMin,
    USER_IDS.parentLinZhihong
  ].forEach((parentId, index) => {
    const studentId = parentUsers.find((item) => item.id === parentId)?.studentId;
    const grade = usersById.get(studentId)?.grade ?? null;
    addEvent({
      userId: parentId,
      role: "parent",
      eventName: "report_weekly_view",
      grade,
      page: "/parent",
      days: 2 - index,
      hour: 21,
      sessionId: `session-parent-${index + 1}`
    });
  });

  return events;
}

function buildApiRouteLogs() {
  const logs = [];
  const pushLogs = ({ method, path: routePath, count, baseDuration, statusFactory, dayOffset = 0 }) => {
    for (let index = 0; index < count; index += 1) {
      const status = typeof statusFactory === "function" ? statusFactory(index) : statusFactory;
      logs.push({
        id: `showcase-api-log-${logs.length + 1}`,
        method,
        path: routePath,
        status,
        durationMs: Math.max(60, baseDuration + (index % 7) * 45),
        traceId: `trace-api-${logs.length + 1}`,
        createdAt: daysAgo(dayOffset, 8 + (index % 12), (index * 7) % 60)
      });
    }
  };

  pushLogs({
    method: "POST",
    path: "/api/auth/login",
    count: 18,
    baseDuration: 180,
    statusFactory: (index) => (index === 7 ? 403 : 200),
    dayOffset: 0
  });
  pushLogs({
    method: "GET",
    path: "/api/student/today-tasks",
    count: 14,
    baseDuration: 620,
    statusFactory: 200,
    dayOffset: 0
  });
  pushLogs({
    method: "GET",
    path: "/api/teacher/insights",
    count: 10,
    baseDuration: 760,
    statusFactory: 200,
    dayOffset: 0
  });
  pushLogs({
    method: "GET",
    path: "/api/school/overview",
    count: 8,
    baseDuration: 520,
    statusFactory: (index) => (index === 2 ? 500 : 200),
    dayOffset: 0
  });
  pushLogs({
    method: "GET",
    path: "/api/admin/observability/metrics",
    count: 6,
    baseDuration: 410,
    statusFactory: 200,
    dayOffset: 1
  });
  return logs;
}

function buildAiRuntimeConfig() {
  return {
    providerConfigs: [
      {
        id: "showcase-ai-provider-deepseek",
        provider: "deepseek",
        enabled: true,
        model: "deepseek-chat",
        baseUrl: "https://api.deepseek.com",
        apiKeyRef: "DEEPSEEK_API_KEY",
        weight: 50,
        timeoutMs: 10000,
        maxRetries: 2,
        extra: { capability: ["chat", "review"] },
        updatedAt: daysAgo(2, 10, 0)
      },
      {
        id: "showcase-ai-provider-kimi",
        provider: "kimi",
        enabled: true,
        model: "moonshot-v1-8k",
        baseUrl: "https://api.moonshot.cn",
        apiKeyRef: "KIMI_API_KEY",
        weight: 35,
        timeoutMs: 12000,
        maxRetries: 2,
        extra: { capability: ["chat", "writing"] },
        updatedAt: daysAgo(2, 10, 10)
      },
      {
        id: "showcase-ai-provider-zhipu",
        provider: "zhipu",
        enabled: false,
        model: "glm-4-flash",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
        apiKeyRef: "ZHIPU_API_KEY",
        weight: 15,
        timeoutMs: 9000,
        maxRetries: 1,
        extra: { capability: ["fallback"] },
        updatedAt: daysAgo(3, 9, 50)
      }
    ],
    providerRuntimeConfig: {
      id: "showcase-ai-runtime",
      providerChain: ["deepseek", "kimi", "zhipu"],
      updatedAt: daysAgo(1, 10, 20),
      updatedBy: USER_IDS.platformAdmin
    },
    taskPolicies: [
      {
        taskType: "assist",
        providerChain: ["deepseek", "kimi"],
        timeoutMs: 8000,
        maxRetries: 1,
        budgetLimit: 1800,
        minQualityScore: 70,
        updatedAt: daysAgo(2, 11, 0),
        updatedBy: USER_IDS.platformAdmin
      },
      {
        taskType: "homework_review",
        providerChain: ["deepseek", "kimi"],
        timeoutMs: 12000,
        maxRetries: 1,
        budgetLimit: 3000,
        minQualityScore: 75,
        updatedAt: daysAgo(2, 11, 10),
        updatedBy: USER_IDS.platformAdmin
      },
      {
        taskType: "lesson_outline",
        providerChain: ["kimi", "deepseek"],
        timeoutMs: 10000,
        maxRetries: 1,
        budgetLimit: 2600,
        minQualityScore: 72,
        updatedAt: daysAgo(2, 11, 20),
        updatedBy: USER_IDS.platformAdmin
      }
    ],
    taskPoliciesRuntime: [
      {
        id: "showcase-ai-policy-runtime-assist",
        taskType: "assist",
        primaryProvider: "deepseek",
        fallbackChain: ["kimi"],
        temperature: 0.4,
        maxTokens: 1200,
        confidenceThreshold: 70,
        humanReviewRequired: false,
        updatedAt: daysAgo(1, 11, 0)
      },
      {
        id: "showcase-ai-policy-runtime-homework",
        taskType: "homework_review",
        primaryProvider: "deepseek",
        fallbackChain: ["kimi"],
        temperature: 0.2,
        maxTokens: 1800,
        confidenceThreshold: 75,
        humanReviewRequired: true,
        updatedAt: daysAgo(1, 11, 10)
      }
    ]
  };
}

function buildAiCallLogs() {
  const rows = [];
  const templates = [
    ["assist", "deepseek", "success", 820, { capability: "chat", requestChars: 320, responseChars: 540, qualityScore: 88 }],
    ["assist", "kimi", "success", 900, { capability: "chat", fallbackCount: 1, requestChars: 300, responseChars: 500, qualityScore: 84 }],
    ["homework_review", "deepseek", "success", 1320, { capability: "vision", requestChars: 680, responseChars: 940, qualityScore: 81 }],
    ["homework_review", "deepseek", "failed", 3000, { capability: "vision", timeout: true, requestChars: 720, responseChars: 0 }],
    ["lesson_outline", "kimi", "success", 980, { capability: "chat", requestChars: 420, responseChars: 780, qualityScore: 86 }],
    ["question_check", "deepseek", "failed", 640, { capability: "chat", policyHit: "quality_threshold", policyDetail: "quality<70", requestChars: 260, responseChars: 180, qualityScore: 66 }],
    ["assist", "deepseek", "failed", 420, { capability: "chat", policyHit: "budget_limit", policyDetail: "budget>1800", requestChars: 980, responseChars: 0 }]
  ];

  for (let round = 0; round < 4; round += 1) {
    templates.forEach(([taskType, provider, status, latencyMs, meta], index) => {
      rows.push({
        id: `showcase-ai-call-${rows.length + 1}`,
        taskType,
        provider,
        model: provider === "kimi" ? "moonshot-v1-8k" : provider === "zhipu" ? "glm-4-flash" : "deepseek-chat",
        userId: round % 2 === 0 ? USER_IDS.studentJiangHaochen : USER_IDS.teacherLiqing,
        requestId: `showcase-ai-request-${round}-${index}`,
        promptTokens: 180 + round * 10,
        completionTokens: status === "success" ? 260 + round * 12 : 0,
        totalTokens: status === "success" ? 440 + round * 22 : 180 + round * 10,
        latencyMs,
        status,
        errorCode: meta.timeout ? "timeout" : meta.policyHit === "budget_limit" ? "budget_limit" : meta.policyHit === "quality_threshold" ? "quality_threshold" : null,
        errorMessage: meta.timeout ? "provider timeout" : meta.policyHit ? meta.policyDetail : null,
        traceId: `showcase-ai-trace-${round}-${index}`,
        meta,
        createdAt: daysAgo(round, 10 + index, 0)
      });
    });
  }

  return rows;
}

function readJsonIfExists(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readRuntimeStore(fileName) {
  const runtimePath = path.join(runtimeDir, fileName);
  const seedPath = path.join(seedDir, fileName);
  if (fs.existsSync(runtimePath)) return readJsonIfExists(runtimePath, []);
  if (fs.existsSync(seedPath)) return readJsonIfExists(seedPath, []);
  return [];
}

function writeRuntimeStore(fileName, items) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, fileName), JSON.stringify(items, null, 2));
}

function toJson(value) {
  return value == null ? null : JSON.stringify(value);
}

function mergeRuntimeStore(fileName, nextItems, matcher) {
  const existing = readRuntimeStore(fileName);
  const filtered = existing.filter((item) => !matcher(item));
  writeRuntimeStore(fileName, [...filtered, ...nextItems]);
}

async function upsertRows(client, table, rows, options = {}) {
  if (!rows.length) return;
  const columns = options.columns ?? Object.keys(rows[0]);
  const conflict = options.conflict ?? ["id"];
  const updateColumns = options.updateColumns ?? columns.filter((column) => !conflict.includes(column));
  const chunkSize = options.chunkSize ?? 80;

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const batch = rows.slice(offset, offset + chunkSize);
    const values = [];
    const params = [];

    batch.forEach((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        params.push(row[column]);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      values.push(`(${placeholders.join(", ")})`);
    });

    const updateClause = updateColumns.length
      ? `DO UPDATE SET ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(", ")}`
      : "DO NOTHING";

    await client.query(
      `INSERT INTO ${table} (${columns.join(", ")})
       VALUES ${values.join(", ")}
       ON CONFLICT (${conflict.join(", ")}) ${updateClause}`,
      params
    );
  }
}

async function seedDatabase(data) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await upsertRows(client, "schools", [data.school], {
      columns: ["id", "name", "code", "status", "created_at", "updated_at"]
    });
    await upsertRows(client, "users", data.users, {
      columns: ["id", "email", "name", "role", "password", "grade", "school_id", "student_id", "created_at"]
    });
    await upsertRows(client, "student_profiles", data.studentProfiles, {
      columns: ["id", "user_id", "grade", "subjects", "target", "school", "observer_code", "updated_at"]
    });
    await upsertRows(client, "knowledge_points", data.knowledgePoints, {
      columns: ["id", "subject", "grade", "title", "chapter", "unit", "created_at", "updated_at"]
    });
    await upsertRows(client, "questions", data.questions, {
      columns: ["id", "subject", "grade", "knowledge_point_id", "stem", "options", "answer", "explanation", "difficulty", "question_type", "tags", "abilities", "created_at", "updated_at"]
    });
    await upsertRows(client, "question_quality_metrics", data.questionQualityMetrics, {
      columns: ["id", "question_id", "quality_score", "duplicate_risk", "ambiguity_risk", "answer_consistency", "duplicate_cluster_id", "answer_conflict", "risk_level", "isolated", "isolation_reason", "issues", "checked_at"]
    });
    await upsertRows(client, "classes", data.classes, {
      columns: ["id", "name", "subject", "grade", "school_id", "teacher_id", "created_at", "join_code", "join_mode"]
    });
    await upsertRows(client, "class_students", data.classStudents, {
      columns: ["id", "class_id", "student_id", "joined_at"]
    });
    await upsertRows(client, "class_join_requests", data.joinRequests, {
      columns: ["id", "class_id", "student_id", "status", "created_at", "decided_at"]
    });
    await upsertRows(client, "course_modules", data.modules, {
      columns: ["id", "class_id", "parent_id", "title", "description", "order_index", "created_at"]
    });
    await upsertRows(client, "module_resources", data.moduleResources, {
      columns: ["id", "module_id", "title", "resource_type", "file_name", "mime_type", "size", "content_base64", "content_storage_provider", "content_storage_key", "link_url", "created_at"]
    });
    await upsertRows(client, "course_syllabi", data.syllabi, {
      columns: ["id", "class_id", "summary", "objectives", "grading_policy", "schedule_text", "updated_at"]
    });
    await upsertRows(client, "course_files", data.courseFiles, {
      columns: ["id", "class_id", "folder", "title", "resource_type", "file_name", "mime_type", "size", "content_base64", "content_storage_provider", "content_storage_key", "link_url", "created_at", "uploaded_by"]
    });
    await upsertRows(client, "learning_library_items", data.libraryItems, {
      columns: ["id", "title", "description", "content_type", "subject", "grade", "owner_role", "owner_id", "class_id", "access_scope", "source_type", "file_name", "mime_type", "size", "content_base64", "content_storage_provider", "content_storage_key", "link_url", "text_content", "knowledge_point_ids", "extracted_knowledge_points", "generated_by_ai", "status", "share_token", "created_at", "updated_at"]
    });
    await upsertRows(client, "learning_library_annotations", data.libraryAnnotations, {
      columns: ["id", "item_id", "user_id", "quote", "start_offset", "end_offset", "color", "note", "created_at"]
    });
    await upsertRows(client, "assignments", data.assignments, {
      columns: ["id", "class_id", "module_id", "title", "description", "due_date", "created_at", "submission_type", "max_uploads", "grading_focus"]
    });
    await upsertRows(client, "assignment_items", data.assignmentItems, {
      columns: ["id", "assignment_id", "question_id"]
    });
    await upsertRows(client, "assignment_progress", data.assignmentProgress, {
      columns: ["id", "assignment_id", "student_id", "status", "completed_at", "score", "total"]
    });
    await upsertRows(client, "assignment_submissions", data.assignmentSubmissions, {
      columns: ["id", "assignment_id", "student_id", "answers", "score", "total", "submitted_at", "submission_text"]
    });
    await upsertRows(client, "assignment_uploads", data.assignmentUploads, {
      columns: ["id", "assignment_id", "student_id", "file_name", "mime_type", "size", "content_base64", "content_storage_provider", "content_storage_key", "created_at"]
    });
    await upsertRows(client, "assignment_rubrics", data.assignmentRubrics, {
      columns: ["id", "assignment_id", "title", "description", "levels", "max_score", "weight", "created_at"]
    });
    await upsertRows(client, "assignment_reviews", data.assignmentReviews, {
      columns: ["id", "assignment_id", "student_id", "overall_comment", "created_at", "updated_at"]
    });
    await upsertRows(client, "assignment_review_items", data.assignmentReviewItems, {
      columns: ["id", "review_id", "question_id", "wrong_tag", "comment"]
    });
    await upsertRows(client, "assignment_review_rubrics", data.assignmentReviewRubrics, {
      columns: ["id", "review_id", "rubric_id", "score", "comment"]
    });
    await upsertRows(client, "assignment_ai_reviews", data.assignmentAiReviews, {
      columns: ["id", "assignment_id", "student_id", "provider", "result", "created_at", "updated_at"]
    });
    await upsertRows(client, "notification_rules", data.notificationRules, {
      columns: ["id", "class_id", "enabled", "due_days", "overdue_days", "include_parents", "created_at", "updated_at"]
    });
    await upsertRows(client, "announcements", data.announcements, {
      columns: ["id", "class_id", "author_id", "title", "content", "created_at"]
    });
    await upsertRows(client, "notifications", data.notifications, {
      columns: ["id", "user_id", "title", "content", "type", "created_at", "read_at"]
    });
    await upsertRows(client, "discussions", data.discussions, {
      columns: ["id", "class_id", "author_id", "title", "content", "pinned", "created_at", "updated_at"]
    });
    await upsertRows(client, "discussion_replies", data.discussionReplies, {
      columns: ["id", "discussion_id", "author_id", "parent_id", "content", "created_at"]
    });
    await upsertRows(client, "inbox_threads", data.inboxThreads, {
      columns: ["id", "subject", "created_at", "updated_at"]
    });
    await upsertRows(client, "inbox_participants", data.inboxParticipants, {
      columns: ["id", "thread_id", "user_id", "last_read_at"]
    });
    await upsertRows(client, "inbox_messages", data.inboxMessages, {
      columns: ["id", "thread_id", "sender_id", "content", "created_at"]
    });
    await upsertRows(client, "exam_papers", data.examPapers, {
      columns: ["id", "class_id", "title", "description", "publish_mode", "anti_cheat_level", "start_at", "end_at", "duration_minutes", "status", "created_by", "created_at", "updated_at"]
    });
    await upsertRows(client, "exam_paper_items", data.examPaperItems, {
      columns: ["id", "paper_id", "question_id", "score", "order_index"]
    });
    await upsertRows(client, "exam_assignments", data.examAssignments, {
      columns: ["id", "paper_id", "student_id", "status", "assigned_at", "started_at", "auto_saved_at", "submitted_at", "score", "total"]
    });
    await upsertRows(client, "exam_answers", data.examAnswers, {
      columns: ["id", "paper_id", "student_id", "answers", "updated_at"]
    });
    await upsertRows(client, "exam_submissions", data.examSubmissions, {
      columns: ["id", "paper_id", "student_id", "answers", "score", "total", "submitted_at"]
    });
    await upsertRows(client, "exam_review_packages", data.examReviewPackages, {
      columns: ["id", "paper_id", "student_id", "data", "generated_at"]
    });
    await upsertRows(client, "exam_events", data.examEvents, {
      columns: ["id", "paper_id", "student_id", "blur_count", "visibility_hidden_count", "last_event_at", "updated_at"]
    });
    await upsertRows(client, "question_attempts", data.questionAttempts, {
      columns: ["id", "user_id", "question_id", "subject", "knowledge_point_id", "correct", "answer", "reason", "created_at"]
    });
    await upsertRows(client, "mastery_records", data.masteryRecords, {
      columns: ["id", "user_id", "subject", "knowledge_point_id", "correct_count", "total_count", "mastery_score", "confidence_score", "recency_weight", "mastery_trend_7d", "last_attempt_at", "updated_at"]
    });
    await upsertRows(client, "study_plans", data.studyPlans, {
      columns: ["id", "user_id", "subject", "created_at"]
    });
    await upsertRows(client, "study_plan_items", data.studyPlanItems, {
      columns: ["id", "plan_id", "knowledge_point_id", "target_count", "due_date"]
    });
    await upsertRows(client, "ai_history", data.aiHistory, {
      columns: ["id", "user_id", "question", "answer", "favorite", "tags", "created_at", "meta"]
    });
    await upsertRows(client, "correction_tasks", data.correctionTasks, {
      columns: ["id", "user_id", "question_id", "subject", "knowledge_point_id", "status", "due_date", "created_at", "completed_at"]
    });
    await upsertRows(client, "wrong_review_items", data.wrongReviewItems, {
      columns: ["id", "user_id", "question_id", "subject", "knowledge_point_id", "interval_level", "next_review_at", "last_review_result", "last_review_at", "review_count", "status", "first_wrong_at", "created_at", "updated_at", "source_type", "source_paper_id", "source_submitted_at"]
    });
    await upsertRows(client, "review_tasks", data.reviewTasks, {
      columns: ["id", "user_id", "question_id", "source_type", "subject", "knowledge_point_id", "status", "interval_level", "due_at", "completed_at", "last_review_result", "last_review_at", "review_count", "origin_type", "origin_paper_id", "origin_submitted_at", "payload", "created_at", "updated_at"]
    });
    await upsertRows(client, "memory_reviews", data.memoryReviews, {
      columns: ["id", "user_id", "question_id", "stage", "next_review_at", "last_reviewed_at", "created_at", "updated_at"]
    });
    await upsertRows(client, "focus_sessions", data.focusSessions, {
      columns: ["id", "user_id", "mode", "duration_minutes", "started_at", "ended_at", "created_at"]
    });
    await upsertRows(client, "question_favorites", data.favorites, {
      columns: ["id", "user_id", "question_id", "tags", "note", "created_at", "updated_at"]
    });
    await upsertRows(client, "parent_action_receipts", data.parentActionReceipts, {
      columns: ["id", "parent_id", "student_id", "source", "action_item_id", "status", "note", "estimated_minutes", "effect_score", "completed_at", "created_at", "updated_at"]
    });
    await upsertRows(client, "writing_submissions", data.writingSubmissions, {
      columns: ["id", "user_id", "subject", "grade", "title", "content", "feedback", "created_at"]
    });
    await upsertRows(client, "experiment_flags", data.experimentFlags, {
      columns: ["id", "key", "name", "description", "enabled", "rollout", "updated_at"],
      conflict: ["key"]
    });
    await upsertRows(client, "analytics_events", data.analyticsEvents, {
      columns: ["id", "event_name", "event_time", "received_at", "user_id", "role", "subject", "grade", "page", "session_id", "trace_id", "entity_id", "props", "props_truncated", "user_agent", "ip"]
    });
    await upsertRows(client, "api_route_logs", data.apiRouteLogs, {
      columns: ["id", "method", "path", "status", "duration_ms", "trace_id", "created_at"]
    });
    await upsertRows(client, "ai_provider_configs", data.aiProviderConfigs, {
      columns: ["id", "provider", "enabled", "model", "base_url", "api_key_ref", "weight", "timeout_ms", "max_retries", "extra", "updated_at"],
      conflict: ["provider"]
    });
    await upsertRows(client, "ai_provider_runtime_config", [data.aiProviderRuntimeConfig], {
      columns: ["id", "provider_chain", "updated_at", "updated_by"]
    });
    await upsertRows(client, "ai_task_policies", data.aiTaskPolicies, {
      columns: ["task_type", "provider_chain", "timeout_ms", "max_retries", "budget_limit", "min_quality_score", "updated_at", "updated_by"],
      conflict: ["task_type"],
      updateColumns: ["provider_chain", "timeout_ms", "max_retries", "budget_limit", "min_quality_score", "updated_at", "updated_by"]
    });
    await upsertRows(client, "ai_task_policies_runtime", data.aiTaskPoliciesRuntime, {
      columns: ["id", "task_type", "primary_provider", "fallback_chain", "temperature", "max_tokens", "confidence_threshold", "human_review_required", "updated_at"],
      conflict: ["task_type"],
      updateColumns: ["primary_provider", "fallback_chain", "temperature", "max_tokens", "confidence_threshold", "human_review_required", "updated_at"]
    });
    await upsertRows(client, "ai_call_logs", data.aiCallLogs, {
      columns: ["id", "task_type", "provider", "model", "user_id", "request_id", "prompt_tokens", "completion_tokens", "total_tokens", "latency_ms", "status", "error_code", "error_message", "trace_id", "meta", "created_at"]
    });
    await upsertRows(client, "admin_logs", data.adminLogs, {
      columns: ["id", "admin_id", "action", "entity_type", "entity_id", "detail", "created_at"]
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function writeRuntimeFiles(data) {
  const classIdSet = new Set(data.classes.map((item) => item.id));
  const teacherIdSet = new Set(teacherUsers.map((item) => item.id));
  const userIdSet = new Set(allUsers.map((item) => item.id));

  mergeRuntimeStore("school-schedule-templates.json", data.scheduleTemplates, (item) => item.schoolId === SCHOOL_ID || String(item.id ?? "").startsWith(SHOWCASE_PREFIX));
  mergeRuntimeStore("class-schedules.json", data.scheduleSessions, (item) => item.schoolId === SCHOOL_ID || classIdSet.has(item.classId));
  mergeRuntimeStore("teacher-schedule-rules.json", data.teacherRules, (item) => item.schoolId === SCHOOL_ID || teacherIdSet.has(item.teacherId));
  mergeRuntimeStore("teacher-unavailability.json", data.teacherUnavailable, (item) => item.schoolId === SCHOOL_ID || teacherIdSet.has(item.teacherId));
  mergeRuntimeStore("class-seat-plans.json", data.seatPlans, (item) => classIdSet.has(item.classId) || String(item.id ?? "").startsWith(SHOWCASE_PREFIX));
  mergeRuntimeStore("student-personas.json", data.studentPersonas, (item) => userIdSet.has(item.userId) || String(item.id ?? "").startsWith(SHOWCASE_PREFIX));
}

function buildSeedData() {
  const school = {
    id: SCHOOL_ID,
    name: SCHOOL_NAME,
    code: SCHOOL_CODE,
    status: "active",
    createdAt: daysAgo(60, 9, 0),
    updatedAt: daysAgo(1, 9, 0)
  };

  const studentProfiles = buildStudentUserProfileRows();
  const knowledgePoints = buildKnowledgePoints();
  const questions = buildQuestions();
  const questionsById = new Map(questions.map((item) => [item.id, item]));
  const questionQualityMetrics = buildQuestionQualityMetrics(questions);
  const classStudents = buildClassStudents();
  const joinRequests = buildJoinRequests();
  const { modules, resources: moduleResources } = buildModulesAndResources();
  const syllabi = buildSyllabi();
  const courseFiles = buildCourseFiles();
  const libraryItems = buildLibraryItems();
  const libraryAnnotations = buildLibraryAnnotations();
  const scheduleSessions = buildSchedules();
  const seatPlans = buildSeatPlans();
  const studentPersonas = buildStudentPersonas();
  const assignmentsBundle = buildAssignmentsBundle(questionsById);
  const examsBundle = buildExamsBundle(questionsById);
  const questionAttempts = buildQuestionAttempts({
    assignmentsBundle,
    examsBundle,
    questionsById
  });
  const masteryRecords = buildMasteryRecords(questionAttempts, questionsById);
  const { plans: studyPlans, planItems: studyPlanItems } = buildStudyPlans(masteryRecords);
  const { correctionTasks, wrongReviewItems, reviewTasks, memoryReviews, favorites } = buildCorrectionsAndReviews({
    attempts: questionAttempts,
    questionsById
  });
  const { inboxThreads, inboxParticipants, inboxMessages } = buildInbox();
  const aiRuntime = buildAiRuntimeConfig();

  return {
    school,
    users: allUsers.map((item) => ({
      id: item.id,
      email: item.email,
      name: item.name,
      role: item.role,
      password: item.password,
      grade: item.grade ?? null,
      schoolId: item.schoolId ?? null,
      studentId: item.studentId ?? null,
      createdAt: daysAgo(40 - (stableNumber(item.id) % 12), 8, 0)
    })),
    studentProfiles,
    knowledgePoints,
    questions,
    questionQualityMetrics,
    classes: classList,
    classStudents,
    joinRequests,
    modules,
    moduleResources,
    syllabi,
    courseFiles,
    libraryItems,
    libraryAnnotations,
    assignments: assignmentsBundle.assignments,
    assignmentItems: assignmentsBundle.assignmentItems,
    assignmentProgress: assignmentsBundle.assignmentProgress,
    assignmentSubmissions: assignmentsBundle.assignmentSubmissions,
    assignmentUploads: assignmentsBundle.assignmentUploads,
    assignmentRubrics: assignmentsBundle.assignmentRubrics,
    assignmentReviews: assignmentsBundle.assignmentReviews,
    assignmentReviewItems: assignmentsBundle.assignmentReviewItems,
    assignmentReviewRubrics: assignmentsBundle.assignmentReviewRubrics,
    assignmentAiReviews: assignmentsBundle.assignmentAiReviews,
    notificationRules: classList.map((item, index) => ({
      id: `showcase-notification-rule-${item.id}`,
      classId: item.id,
      enabled: true,
      dueDays: item.id === CLASS_IDS.g7Math ? 1 : 2,
      overdueDays: 0,
      includeParents: index % 2 === 0,
      createdAt: daysAgo(15, 10, 0),
      updatedAt: daysAgo(2, 9, 30)
    })),
    announcements: buildAnnouncements(),
    notifications: buildNotifications(),
    discussions: buildDiscussions(),
    discussionReplies: buildDiscussionReplies(),
    inboxThreads,
    inboxParticipants,
    inboxMessages,
    examPapers: examsBundle.papers.map(({ questionIds: _questionIds, ...paper }) => paper),
    examPaperItems: examsBundle.paperItems,
    examAssignments: examsBundle.examAssignments,
    examAnswers: examsBundle.examAnswers,
    examSubmissions: examsBundle.examSubmissions,
    examReviewPackages: examsBundle.examReviewPackages,
    examEvents: examsBundle.examEvents,
    questionAttempts,
    masteryRecords,
    studyPlans,
    studyPlanItems,
    aiHistory: buildAiHistory(),
    correctionTasks,
    wrongReviewItems,
    reviewTasks,
    memoryReviews,
    focusSessions: buildFocusSessions(),
    favorites,
    parentActionReceipts: buildParentActionReceipts(),
    writingSubmissions: buildWritingSubmissions(),
    experimentFlags: buildExperimentFlags(),
    analyticsEvents: buildAnalyticsEvents(),
    apiRouteLogs: buildApiRouteLogs(),
    aiProviderConfigs: aiRuntime.providerConfigs,
    aiProviderRuntimeConfig: aiRuntime.providerRuntimeConfig,
    aiTaskPolicies: aiRuntime.taskPolicies,
    aiTaskPoliciesRuntime: aiRuntime.taskPoliciesRuntime,
    aiCallLogs: buildAiCallLogs(),
    adminLogs: buildAdminLogs(),
    scheduleTemplates: scheduleTemplateRows,
    scheduleSessions,
    teacherRules: teacherRuleRows,
    teacherUnavailable: teacherUnavailableRows,
    seatPlans,
    studentPersonas
  };
}

function toDbRows(data) {
  return {
    school: {
      id: data.school.id,
      name: data.school.name,
      code: data.school.code,
      status: data.school.status,
      created_at: data.school.createdAt,
      updated_at: data.school.updatedAt
    },
    users: data.users.map((item) => ({
      id: item.id,
      email: item.email,
      name: item.name,
      role: item.role,
      password: item.password,
      grade: item.grade,
      school_id: item.schoolId,
      student_id: item.studentId,
      created_at: item.createdAt
    })),
    studentProfiles: data.studentProfiles.map((item) => ({
      id: item.id,
      user_id: item.userId,
      grade: item.grade,
      subjects: item.subjects,
      target: item.target,
      school: item.school,
      observer_code: item.observerCode,
      updated_at: item.updatedAt
    })),
    knowledgePoints: data.knowledgePoints.map((item) => ({
      id: item.id,
      subject: item.subject,
      grade: item.grade,
      title: item.title,
      chapter: item.chapter,
      unit: item.unit,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    questions: data.questions.map((item) => ({
      id: item.id,
      subject: item.subject,
      grade: item.grade,
      knowledge_point_id: item.knowledgePointId,
      stem: item.stem,
      options: item.options,
      answer: item.answer,
      explanation: item.explanation,
      difficulty: item.difficulty,
      question_type: item.questionType,
      tags: item.tags,
      abilities: item.abilities,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    questionQualityMetrics: data.questionQualityMetrics.map((item) => ({
      id: item.id,
      question_id: item.questionId,
      quality_score: item.qualityScore,
      duplicate_risk: item.duplicateRisk,
      ambiguity_risk: item.ambiguityRisk,
      answer_consistency: item.answerConsistency,
      duplicate_cluster_id: item.duplicateClusterId,
      answer_conflict: item.answerConflict,
      risk_level: item.riskLevel,
      isolated: item.isolated,
      isolation_reason: item.isolationReason,
      issues: item.issues,
      checked_at: item.checkedAt
    })),
    classes: data.classes.map((item) => ({
      id: item.id,
      name: item.name,
      subject: item.subject,
      grade: item.grade,
      school_id: item.schoolId,
      teacher_id: item.teacherId,
      created_at: item.createdAt,
      join_code: item.joinCode,
      join_mode: item.joinMode
    })),
    classStudents: data.classStudents.map((item) => ({
      id: item.id,
      class_id: item.classId,
      student_id: item.studentId,
      joined_at: item.joinedAt
    })),
    joinRequests: data.joinRequests.map((item) => ({
      id: item.id,
      class_id: item.classId,
      student_id: item.studentId,
      status: item.status,
      created_at: item.createdAt,
      decided_at: item.decidedAt
    })),
    modules: data.modules.map((item) => ({
      id: item.id,
      class_id: item.classId,
      parent_id: item.parentId,
      title: item.title,
      description: item.description,
      order_index: item.orderIndex,
      created_at: item.createdAt
    })),
    moduleResources: data.moduleResources.map((item) => ({
      id: item.id,
      module_id: item.moduleId,
      title: item.title,
      resource_type: item.resourceType,
      file_name: item.fileName ?? null,
      mime_type: item.mimeType ?? null,
      size: item.size ?? null,
      content_base64: item.contentBase64 ?? null,
      content_storage_provider: item.contentStorageProvider ?? null,
      content_storage_key: item.contentStorageKey ?? null,
      link_url: item.linkUrl ?? null,
      created_at: item.createdAt
    })),
    syllabi: data.syllabi.map((item) => ({
      id: item.id,
      class_id: item.classId,
      summary: item.summary,
      objectives: item.objectives,
      grading_policy: item.gradingPolicy,
      schedule_text: item.scheduleText,
      updated_at: item.updatedAt
    })),
    courseFiles: data.courseFiles.map((item) => ({
      id: item.id,
      class_id: item.classId,
      folder: item.folder ?? null,
      title: item.title,
      resource_type: item.resourceType,
      file_name: item.fileName ?? null,
      mime_type: item.mimeType ?? null,
      size: item.size ?? null,
      content_base64: item.contentBase64 ?? null,
      content_storage_provider: item.contentStorageProvider ?? null,
      content_storage_key: item.contentStorageKey ?? null,
      link_url: item.linkUrl ?? null,
      created_at: item.createdAt,
      uploaded_by: item.uploadedBy ?? null
    })),
    libraryItems: data.libraryItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? null,
      content_type: item.contentType,
      subject: item.subject,
      grade: item.grade,
      owner_role: item.ownerRole,
      owner_id: item.ownerId,
      class_id: item.classId ?? null,
      access_scope: item.accessScope,
      source_type: item.sourceType,
      file_name: item.fileName ?? null,
      mime_type: item.mimeType ?? null,
      size: item.size ?? null,
      content_base64: item.contentBase64 ?? null,
      content_storage_provider: item.contentStorageProvider ?? null,
      content_storage_key: item.contentStorageKey ?? null,
      link_url: item.linkUrl ?? null,
      text_content: item.textContent ?? null,
      knowledge_point_ids: item.knowledgePointIds,
      extracted_knowledge_points: item.extractedKnowledgePoints,
      generated_by_ai: item.generatedByAi,
      status: item.status,
      share_token: item.shareToken ?? null,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    libraryAnnotations: data.libraryAnnotations.map((item) => ({
      id: item.id,
      item_id: item.itemId,
      user_id: item.userId,
      quote: item.quote,
      start_offset: item.startOffset ?? null,
      end_offset: item.endOffset ?? null,
      color: item.color ?? null,
      note: item.note ?? null,
      created_at: item.createdAt
    })),
    assignments: data.assignments.map((item) => ({
      id: item.id,
      class_id: item.classId,
      module_id: item.moduleId ?? null,
      title: item.title,
      description: item.description,
      due_date: item.dueDate,
      created_at: item.createdAt,
      submission_type: item.submissionType,
      max_uploads: item.maxUploads,
      grading_focus: item.gradingFocus ?? null
    })),
    assignmentItems: data.assignmentItems.map((item) => ({
      id: item.id,
      assignment_id: item.assignmentId,
      question_id: item.questionId
    })),
    assignmentProgress: data.assignmentProgress.map((item) => ({
      id: item.id,
      assignment_id: item.assignmentId,
      student_id: item.studentId,
      status: item.status,
      completed_at: item.completedAt ?? null,
      score: item.score ?? null,
      total: item.total ?? null
    })),
    assignmentSubmissions: data.assignmentSubmissions.map((item) => ({
      id: item.id,
      assignment_id: item.assignmentId,
      student_id: item.studentId,
      answers: toJson(item.answers),
      score: item.score,
      total: item.total,
      submitted_at: item.submittedAt,
      submission_text: item.submissionText ?? null
    })),
    assignmentUploads: data.assignmentUploads.map((item) => ({
      id: item.id,
      assignment_id: item.assignmentId,
      student_id: item.studentId,
      file_name: item.fileName,
      mime_type: item.mimeType,
      size: item.size,
      content_base64: item.contentBase64 ?? null,
      content_storage_provider: item.contentStorageProvider ?? null,
      content_storage_key: item.contentStorageKey ?? null,
      created_at: item.createdAt
    })),
    assignmentRubrics: data.assignmentRubrics.map((item) => ({
      id: item.id,
      assignment_id: item.assignmentId,
      title: item.title,
      description: item.description,
      levels: toJson(item.levels),
      max_score: item.maxScore,
      weight: item.weight,
      created_at: item.createdAt
    })),
    assignmentReviews: data.assignmentReviews.map((item) => ({
      id: item.id,
      assignment_id: item.assignmentId,
      student_id: item.studentId,
      overall_comment: item.overallComment ?? null,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    assignmentReviewItems: data.assignmentReviewItems.map((item) => ({
      id: item.id,
      review_id: item.reviewId,
      question_id: item.questionId,
      wrong_tag: item.wrongTag ?? null,
      comment: item.comment ?? null
    })),
    assignmentReviewRubrics: data.assignmentReviewRubrics.map((item) => ({
      id: item.id,
      review_id: item.reviewId,
      rubric_id: item.rubricId,
      score: item.score,
      comment: item.comment ?? null
    })),
    assignmentAiReviews: data.assignmentAiReviews.map((item) => ({
      id: item.id,
      assignment_id: item.assignmentId,
      student_id: item.studentId,
      provider: item.provider,
      result: toJson(item.result),
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    notificationRules: data.notificationRules.map((item) => ({
      id: item.id,
      class_id: item.classId,
      enabled: item.enabled,
      due_days: item.dueDays,
      overdue_days: item.overdueDays,
      include_parents: item.includeParents,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    announcements: data.announcements.map((item) => ({
      id: item.id,
      class_id: item.classId,
      author_id: item.authorId,
      title: item.title,
      content: item.content,
      created_at: item.createdAt
    })),
    notifications: data.notifications.map((item) => ({
      id: item.id,
      user_id: item.userId,
      title: item.title,
      content: item.content,
      type: item.type,
      created_at: item.createdAt,
      read_at: item.readAt ?? null
    })),
    discussions: data.discussions.map((item) => ({
      id: item.id,
      class_id: item.classId,
      author_id: item.authorId,
      title: item.title,
      content: item.content,
      pinned: item.pinned,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    discussionReplies: data.discussionReplies.map((item) => ({
      id: item.id,
      discussion_id: item.discussionId,
      author_id: item.authorId,
      parent_id: item.parentId ?? null,
      content: item.content,
      created_at: item.createdAt
    })),
    inboxThreads: data.inboxThreads.map((item) => ({
      id: item.id,
      subject: item.subject,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    inboxParticipants: data.inboxParticipants.map((item) => ({
      id: item.id,
      thread_id: item.threadId,
      user_id: item.userId,
      last_read_at: item.lastReadAt ?? null
    })),
    inboxMessages: data.inboxMessages.map((item) => ({
      id: item.id,
      thread_id: item.threadId,
      sender_id: item.senderId,
      content: item.content,
      created_at: item.createdAt
    })),
    examPapers: data.examPapers.map((item) => ({
      id: item.id,
      class_id: item.classId,
      title: item.title,
      description: item.description,
      publish_mode: item.publishMode,
      anti_cheat_level: item.antiCheatLevel,
      start_at: item.startAt ?? null,
      end_at: item.endAt,
      duration_minutes: item.durationMinutes ?? null,
      status: item.status,
      created_by: item.createdBy,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    examPaperItems: data.examPaperItems.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      question_id: item.questionId,
      score: item.score,
      order_index: item.orderIndex
    })),
    examAssignments: data.examAssignments.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      status: item.status,
      assigned_at: item.assignedAt,
      started_at: item.startedAt ?? null,
      auto_saved_at: item.autoSavedAt ?? null,
      submitted_at: item.submittedAt ?? null,
      score: item.score ?? null,
      total: item.total ?? null
    })),
    examAnswers: data.examAnswers.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      answers: toJson(item.answers),
      updated_at: item.updatedAt
    })),
    examSubmissions: data.examSubmissions.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      answers: toJson(item.answers),
      score: item.score,
      total: item.total,
      submitted_at: item.submittedAt
    })),
    examReviewPackages: data.examReviewPackages.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      data: toJson(item.data),
      generated_at: item.generatedAt
    })),
    examEvents: data.examEvents.map((item) => ({
      id: item.id,
      paper_id: item.paperId,
      student_id: item.studentId,
      blur_count: item.blurCount,
      visibility_hidden_count: item.visibilityHiddenCount,
      last_event_at: item.lastEventAt ?? null,
      updated_at: item.updatedAt
    })),
    questionAttempts: data.questionAttempts.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      subject: item.subject,
      knowledge_point_id: item.knowledgePointId,
      correct: item.correct,
      answer: item.answer,
      reason: item.reason ?? null,
      created_at: item.createdAt
    })),
    masteryRecords: data.masteryRecords.map((item) => ({
      id: item.id,
      user_id: item.userId,
      subject: item.subject,
      knowledge_point_id: item.knowledgePointId,
      correct_count: item.correct,
      total_count: item.total,
      mastery_score: item.masteryScore,
      confidence_score: item.confidenceScore,
      recency_weight: item.recencyWeight,
      mastery_trend_7d: item.masteryTrend7d,
      last_attempt_at: item.lastAttemptAt ?? null,
      updated_at: item.updatedAt
    })),
    studyPlans: data.studyPlans.map((item) => ({
      id: item.id,
      user_id: item.userId,
      subject: item.subject,
      created_at: item.createdAt
    })),
    studyPlanItems: data.studyPlanItems.map((item) => ({
      id: item.id,
      plan_id: item.planId,
      knowledge_point_id: item.knowledgePointId,
      target_count: item.targetCount,
      due_date: item.dueDate
    })),
    aiHistory: data.aiHistory.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question: item.question,
      answer: item.answer,
      favorite: item.favorite,
      tags: item.tags,
      created_at: item.createdAt,
      meta: toJson(item.meta)
    })),
    correctionTasks: data.correctionTasks.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      subject: item.subject,
      knowledge_point_id: item.knowledgePointId,
      status: item.status,
      due_date: item.dueDate,
      created_at: item.createdAt,
      completed_at: item.completedAt ?? null
    })),
    wrongReviewItems: data.wrongReviewItems.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      subject: item.subject,
      knowledge_point_id: item.knowledgePointId,
      interval_level: item.intervalLevel,
      next_review_at: item.nextReviewAt ?? null,
      last_review_result: item.lastReviewResult ?? null,
      last_review_at: item.lastReviewAt ?? null,
      review_count: item.reviewCount,
      status: item.status,
      first_wrong_at: item.firstWrongAt,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      source_type: item.sourceType,
      source_paper_id: item.sourcePaperId ?? null,
      source_submitted_at: item.sourceSubmittedAt ?? null
    })),
    reviewTasks: data.reviewTasks.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      source_type: item.sourceType,
      subject: item.subject,
      knowledge_point_id: item.knowledgePointId,
      status: item.status,
      interval_level: item.intervalLevel,
      due_at: item.nextReviewAt,
      completed_at: item.completedAt ?? null,
      last_review_result: item.lastReviewResult ?? null,
      last_review_at: item.lastReviewAt ?? null,
      review_count: item.reviewCount,
      origin_type: item.originType ?? null,
      origin_paper_id: item.originPaperId ?? null,
      origin_submitted_at: item.originSubmittedAt ?? null,
      payload: toJson(item.payload),
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    memoryReviews: data.memoryReviews.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      stage: item.stage,
      next_review_at: item.nextReviewAt,
      last_reviewed_at: item.lastReviewedAt ?? null,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    focusSessions: data.focusSessions.map((item) => ({
      id: item.id,
      user_id: item.userId,
      mode: item.mode,
      duration_minutes: item.durationMinutes,
      started_at: item.startedAt ?? null,
      ended_at: item.endedAt ?? null,
      created_at: item.createdAt
    })),
    favorites: data.favorites.map((item) => ({
      id: item.id,
      user_id: item.userId,
      question_id: item.questionId,
      tags: item.tags,
      note: item.note ?? null,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    parentActionReceipts: data.parentActionReceipts.map((item) => ({
      id: item.id,
      parent_id: item.parentId,
      student_id: item.studentId,
      source: item.source,
      action_item_id: item.actionItemId,
      status: item.status,
      note: item.note ?? null,
      estimated_minutes: item.estimatedMinutes,
      effect_score: item.effectScore,
      completed_at: item.completedAt,
      created_at: item.createdAt,
      updated_at: item.updatedAt
    })),
    writingSubmissions: data.writingSubmissions.map((item) => ({
      id: item.id,
      user_id: item.userId,
      subject: item.subject,
      grade: item.grade,
      title: item.title ?? null,
      content: item.content,
      feedback: toJson(item.feedback),
      created_at: item.createdAt
    })),
    experimentFlags: data.experimentFlags.map((item) => ({
      id: item.id,
      key: item.key,
      name: item.name,
      description: item.description,
      enabled: item.enabled,
      rollout: item.rollout,
      updated_at: item.updatedAt
    })),
    analyticsEvents: data.analyticsEvents.map((item) => ({
      id: item.id,
      event_name: item.eventName,
      event_time: item.eventTime,
      received_at: item.receivedAt,
      user_id: item.userId,
      role: item.role,
      subject: item.subject,
      grade: item.grade,
      page: item.page,
      session_id: item.sessionId,
      trace_id: item.traceId,
      entity_id: item.entityId,
      props: toJson(item.props),
      props_truncated: item.propsTruncated,
      user_agent: item.userAgent,
      ip: item.ip
    })),
    apiRouteLogs: data.apiRouteLogs.map((item) => ({
      id: item.id,
      method: item.method,
      path: item.path,
      status: item.status,
      duration_ms: item.durationMs,
      trace_id: item.traceId ?? null,
      created_at: item.createdAt
    })),
    aiProviderConfigs: data.aiProviderConfigs.map((item) => ({
      id: item.id,
      provider: item.provider,
      enabled: item.enabled,
      model: item.model,
      base_url: item.baseUrl,
      api_key_ref: item.apiKeyRef,
      weight: item.weight,
      timeout_ms: item.timeoutMs,
      max_retries: item.maxRetries,
      extra: toJson(item.extra),
      updated_at: item.updatedAt
    })),
    aiProviderRuntimeConfig: {
      id: data.aiProviderRuntimeConfig.id,
      provider_chain: data.aiProviderRuntimeConfig.providerChain,
      updated_at: data.aiProviderRuntimeConfig.updatedAt,
      updated_by: data.aiProviderRuntimeConfig.updatedBy
    },
    aiTaskPolicies: data.aiTaskPolicies.map((item) => ({
      task_type: item.taskType,
      provider_chain: item.providerChain,
      timeout_ms: item.timeoutMs,
      max_retries: item.maxRetries,
      budget_limit: item.budgetLimit,
      min_quality_score: item.minQualityScore,
      updated_at: item.updatedAt,
      updated_by: item.updatedBy
    })),
    aiTaskPoliciesRuntime: data.aiTaskPoliciesRuntime.map((item) => ({
      id: item.id,
      task_type: item.taskType,
      primary_provider: item.primaryProvider,
      fallback_chain: item.fallbackChain,
      temperature: item.temperature,
      max_tokens: item.maxTokens,
      confidence_threshold: item.confidenceThreshold,
      human_review_required: item.humanReviewRequired,
      updated_at: item.updatedAt
    })),
    aiCallLogs: data.aiCallLogs.map((item) => ({
      id: item.id,
      task_type: item.taskType,
      provider: item.provider,
      model: item.model,
      user_id: item.userId ?? null,
      request_id: item.requestId ?? null,
      prompt_tokens: item.promptTokens ?? null,
      completion_tokens: item.completionTokens ?? null,
      total_tokens: item.totalTokens ?? null,
      latency_ms: item.latencyMs ?? null,
      status: item.status,
      error_code: item.errorCode ?? null,
      error_message: item.errorMessage ?? null,
      trace_id: item.traceId ?? null,
      meta: toJson(item.meta),
      created_at: item.createdAt
    })),
    adminLogs: data.adminLogs.map((item) => ({
      id: item.id,
      admin_id: item.adminId ?? null,
      action: item.action,
      entity_type: item.entityType,
      entity_id: item.entityId ?? null,
      detail: item.detail ?? null,
      created_at: item.createdAt
    }))
  };
}

function printAccounts() {
  console.log("Showcase accounts");
  console.log(`Platform admin: ops@eduai.net.cn / ${ADMIN_PASSWORD}`);
  console.log(`School admin: lan.zhou@hzsy.edu.cn / ${SCHOOL_ADMIN_PASSWORD}`);
  console.log(`Teacher sample: ya.sun@hzsy.edu.cn / ${TEACHER_PASSWORD}`);
  console.log(`Student sample: haochen.jiang@s.hzsy.edu.cn / ${STUDENT_PASSWORD}`);
  console.log(`Parent sample: xuemei.jiang@family.hzsy.edu.cn / ${PARENT_PASSWORD}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const showcase = buildSeedData();
  const dbRows = toDbRows(showcase);
  await seedDatabase(dbRows);
  writeRuntimeFiles(showcase);

  console.log(`Seeded showcase school: ${SCHOOL_NAME} (${SCHOOL_ID})`);
  console.log(`Users: ${showcase.users.length}`);
  console.log(`Classes: ${showcase.classes.length}`);
  console.log(`Assignments: ${showcase.assignments.length}`);
  console.log(`Exam papers: ${showcase.examPapers.length}`);
  console.log(`Question attempts: ${showcase.questionAttempts.length}`);
  printAccounts();
}

main().catch((error) => {
  console.error(error?.stack ?? error?.message ?? error);
  process.exit(1);
});
