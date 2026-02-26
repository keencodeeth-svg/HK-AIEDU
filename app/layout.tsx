import "./globals.css";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import UserMenu from "@/components/UserMenu";
import DensityToggle from "@/components/DensityToggle";

export const metadata = {
  title: "航科AI教育",
  description: "K12 AI 教育 MVP"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const navByRole: Record<
    "student" | "teacher" | "parent" | "admin",
    Array<{ href: string; label: string }>
  > = {
    student: [
      { href: "/dashboard", label: "学习看板" },
      { href: "/student", label: "学生端" },
      { href: "/course", label: "课程主页" },
      { href: "/student/assignments", label: "作业中心" },
      { href: "/student/exams", label: "在线考试" },
      { href: "/student/modules", label: "课程模块" },
      { href: "/discussions", label: "讨论区" },
      { href: "/files", label: "文件中心" },
      { href: "/inbox", label: "收件箱" },
      { href: "/diagnostic", label: "诊断测评" },
      { href: "/plan", label: "学习计划" },
      { href: "/practice", label: "练习" },
      { href: "/wrong-book", label: "错题本" },
      { href: "/coach", label: "学习陪练" },
      { href: "/tutor", label: "AI 辅导" },
      { href: "/reading", label: "朗读评分" },
      { href: "/writing", label: "写作批改" },
      { href: "/challenge", label: "挑战任务" },
      { href: "/focus", label: "专注计时" },
      { href: "/report", label: "学习报告" },
      { href: "/calendar", label: "学习日程" },
      { href: "/announcements", label: "班级公告" },
      { href: "/notifications", label: "通知中心" }
    ],
    teacher: [
      { href: "/dashboard", label: "教学看板" },
      { href: "/teacher", label: "教师端" },
      { href: "/course", label: "课程主页" },
      { href: "/teacher/gradebook", label: "成绩册" },
      { href: "/teacher/exams", label: "在线考试" },
      { href: "/teacher/modules", label: "课程模块" },
      { href: "/teacher/analysis", label: "学情分析" },
      { href: "/teacher/ai-tools", label: "教师 AI 工具" },
      { href: "/teacher/submissions", label: "提交箱" },
      { href: "/teacher/notifications", label: "通知规则" },
      { href: "/discussions", label: "讨论区" },
      { href: "/files", label: "文件中心" },
      { href: "/inbox", label: "收件箱" },
      { href: "/calendar", label: "教学日程" },
      { href: "/announcements", label: "班级公告" }
    ],
    parent: [
      { href: "/dashboard", label: "家长看板" },
      { href: "/parent", label: "家长端" },
      { href: "/course", label: "课程主页" },
      { href: "/discussions", label: "讨论区" },
      { href: "/files", label: "文件中心" },
      { href: "/inbox", label: "收件箱" },
      { href: "/calendar", label: "学习日程" },
      { href: "/announcements", label: "班级公告" },
      { href: "/notifications", label: "通知中心" }
    ],
    admin: [
      { href: "/admin", label: "管理端" },
      { href: "/admin/knowledge-points", label: "知识点管理" },
      { href: "/admin/knowledge-tree", label: "知识点树" },
      { href: "/admin/questions", label: "题库管理" },
      { href: "/admin/logs", label: "操作日志" }
    ]
  };

  const navLinks = user
    ? navByRole[user.role as "student" | "teacher" | "parent" | "admin"] ?? []
    : [
        { href: "/", label: "首页" },
        { href: "/login", label: "登录" },
        { href: "/register", label: "学生/家长注册" },
        { href: "/teacher/register", label: "教师注册" },
        { href: "/admin/register", label: "管理员注册" }
      ];
  const role = user?.role as "student" | "teacher" | "parent" | "admin" | undefined;
  const primaryCount =
    role === "student" ? 8 : role === "teacher" ? 7 : role === "parent" ? 6 : role === "admin" ? 5 : 5;
  const primaryLinks = navLinks.slice(0, primaryCount);
  const secondaryLinks = navLinks.slice(primaryCount);

  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">
          <header className="site-header">
            <div className="brand">航科AI教育</div>
            <nav className="nav-links">
              {primaryLinks.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
              {secondaryLinks.length ? (
                <details className="nav-more">
                  <summary>更多</summary>
                  <div className="nav-more-menu">
                    {secondaryLinks.map((item) => (
                      <Link key={item.href} href={item.href}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </details>
              ) : null}
            </nav>
            <div className="header-actions">
              {user ? <DensityToggle /> : null}
              <UserMenu user={user} />
            </div>
          </header>
          <main className="main">{children}</main>
          <footer className="site-footer">© 2026 航科AI教育 K12 学习辅导 MVP</footer>
        </div>
      </body>
    </html>
  );
}
