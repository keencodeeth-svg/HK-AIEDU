import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import UserMenu from "@/components/UserMenu";
import DensityToggle from "@/components/DensityToggle";
import RoleSidebarNav from "@/components/RoleSidebarNav";

export const metadata = {
  title: "航科AI教育",
  description: "K12 AI 教育 MVP"
};

type NavLink = { href: string; label: string };
type NavGroup = { title: string; links: NavLink[] };
type RoleNavConfig = {
  primary: NavLink[];
  groups: NavGroup[];
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const roleNavConfig: Record<"student" | "teacher" | "parent" | "admin", RoleNavConfig> = {
    student: {
      primary: [
        { href: "/dashboard", label: "学习看板" },
        { href: "/student", label: "学生端" },
        { href: "/practice", label: "练习" },
        { href: "/plan", label: "学习计划" },
        { href: "/student/exams", label: "在线考试" },
        { href: "/wrong-book", label: "错题本" },
        { href: "/coach", label: "学习陪练" }
      ],
      groups: [
        {
          title: "学习任务",
          links: [
            { href: "/student/assignments", label: "作业中心" },
            { href: "/student/modules", label: "课程模块" },
            { href: "/diagnostic", label: "诊断测评" },
            { href: "/tutor", label: "AI 辅导" },
            { href: "/reading", label: "朗读评分" },
            { href: "/writing", label: "写作批改" }
          ]
        },
        {
          title: "成长追踪",
          links: [
            { href: "/report", label: "学习报告" },
            { href: "/student/growth", label: "成长画像" },
            { href: "/challenge", label: "挑战任务" },
            { href: "/focus", label: "专注计时" }
          ]
        },
        {
          title: "资源协作",
          links: [
            { href: "/course", label: "课程主页" },
            { href: "/library", label: "教材课件" },
            { href: "/discussions", label: "讨论区" },
            { href: "/files", label: "文件中心" },
            { href: "/inbox", label: "收件箱" },
            { href: "/calendar", label: "学习日程" },
            { href: "/announcements", label: "班级公告" },
            { href: "/notifications", label: "通知中心" }
          ]
        }
      ]
    },
    teacher: {
      primary: [
        { href: "/dashboard", label: "教学看板" },
        { href: "/teacher", label: "教师端" },
        { href: "/teacher/exams", label: "在线考试" },
        { href: "/teacher/modules", label: "课程模块" },
        { href: "/teacher/gradebook", label: "成绩册" },
        { href: "/teacher/analysis", label: "学情分析" }
      ],
      groups: [
        {
          title: "教学执行",
          links: [
            { href: "/teacher/submissions", label: "提交箱" },
            { href: "/teacher/notifications", label: "通知规则" },
            { href: "/teacher/ai-tools", label: "教师 AI 工具" }
          ]
        },
        {
          title: "课程资源",
          links: [
            { href: "/course", label: "课程主页" },
            { href: "/library", label: "教材课件" },
            { href: "/files", label: "文件中心" },
            { href: "/calendar", label: "教学日程" },
            { href: "/announcements", label: "班级公告" }
          ]
        },
        {
          title: "班级协作",
          links: [
            { href: "/discussions", label: "讨论区" },
            { href: "/inbox", label: "收件箱" }
          ]
        }
      ]
    },
    parent: {
      primary: [
        { href: "/dashboard", label: "家长看板" },
        { href: "/parent", label: "家长端" },
        { href: "/calendar", label: "学习日程" },
        { href: "/notifications", label: "通知中心" }
      ],
      groups: [
        {
          title: "家校协同",
          links: [
            { href: "/course", label: "课程主页" },
            { href: "/discussions", label: "讨论区" },
            { href: "/files", label: "文件中心" },
            { href: "/inbox", label: "收件箱" },
            { href: "/announcements", label: "班级公告" }
          ]
        }
      ]
    },
    admin: {
      primary: [
        { href: "/admin", label: "管理端" },
        { href: "/library", label: "教材课件" },
        { href: "/admin/questions", label: "题库管理" },
        { href: "/admin/knowledge-points", label: "知识点管理" },
        { href: "/admin/knowledge-tree", label: "知识点树" },
        { href: "/admin/experiments", label: "实验中心" },
        { href: "/admin/ai-models", label: "AI模型中心" },
        { href: "/admin/logs", label: "操作日志" }
      ],
      groups: [
        {
          title: "内容治理",
          links: [
            { href: "/admin/questions", label: "题库管理" },
            { href: "/admin/knowledge-points", label: "知识点管理" },
            { href: "/admin/knowledge-tree", label: "知识点树" },
            { href: "/library", label: "教材课件" }
          ]
        },
        {
          title: "实验与模型",
          links: [
            { href: "/admin/experiments", label: "A/B与灰度" },
            { href: "/admin/ai-models", label: "模型路由策略" }
          ]
        },
        {
          title: "审计运维",
          links: [
            { href: "/admin/logs", label: "操作日志" },
            { href: "/admin", label: "控制台总览" }
          ]
        }
      ]
    }
  };

  const guestPrimaryLinks: NavLink[] = [
    { href: "/", label: "首页" },
    { href: "/login", label: "登录" },
    { href: "/register", label: "学生/家长注册" }
  ];
  const guestGroups: NavGroup[] = [
    {
      title: "注册入口",
      links: [
        { href: "/teacher/register", label: "教师注册" },
        { href: "/admin/register", label: "管理员注册" }
      ]
    }
  ];

  const role = user?.role as "student" | "teacher" | "parent" | "admin" | undefined;
  const navConfig = role ? roleNavConfig[role] : null;
  const primaryLinks = navConfig?.primary ?? guestPrimaryLinks;
  const navGroups = navConfig?.groups ?? guestGroups;
  const roleLabelMap: Record<"student" | "teacher" | "parent" | "admin", string> = {
    student: "学生空间",
    teacher: "教师空间",
    parent: "家长空间",
    admin: "管理空间"
  };

  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳转到主内容
        </a>
        <div className="app-shell with-side-nav">
          <aside className="app-sidebar">
            <div className="brand">航科AI教育</div>
            <RoleSidebarNav primaryLinks={primaryLinks} navGroups={navGroups} />
          </aside>

          <div className="app-main-shell">
            <header className="site-header compact-header">
              <div className="section-sub">{role ? roleLabelMap[role] : "访客模式"}</div>
              <div className="header-actions">
                {user ? <DensityToggle /> : null}
                <UserMenu user={user} />
              </div>
            </header>
            <main className="main" id="main-content">
              {children}
            </main>
            <footer className="site-footer">© 2026 航科AI教育 K12 学习辅导 MVP</footer>
          </div>
        </div>
      </body>
    </html>
  );
}
