import Link from "next/link";
import Card from "@/components/Card";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import type {
  AssignmentItem,
  ClassItem,
  TeacherJoinMode,
  TeacherJoinRequest
} from "../types";

type TeacherClassListCardProps = {
  classes: ClassItem[];
  onRegenerateCode: (classId: string) => void | Promise<void>;
  onUpdateJoinMode: (classId: string, joinMode: TeacherJoinMode) => void | Promise<void>;
};

export function TeacherClassListCard({ classes, onRegenerateCode, onUpdateJoinMode }: TeacherClassListCardProps) {
  return (
    <Card title="班级列表">
      {classes.length === 0 ? (
        <p>暂无班级，请先创建班级。</p>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {classes.map((item) => (
            <div className="card" key={item.id}>
              <div className="section-title">{item.name}</div>
              <p>
                {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
              </p>
              <p>学生：{item.studentCount} 人</p>
              <p>作业：{item.assignmentCount} 份</p>
              <p>邀请码：{item.joinCode ?? "-"}</p>
              <div className="grid grid-2" style={{ marginTop: 8 }}>
                <button className="button secondary" type="button" onClick={() => onRegenerateCode(item.id)}>
                  重新生成邀请码
                </button>
                <select
                  value={item.joinMode ?? "approval"}
                  onChange={(event) => onUpdateJoinMode(item.id, event.target.value as TeacherJoinMode)}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  <option value="approval">需要审核</option>
                  <option value="auto">自动加入</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

type TeacherJoinRequestsCardProps = {
  joinRequests: TeacherJoinRequest[];
  onApprove: (requestId: string) => void | Promise<void>;
  onReject: (requestId: string) => void | Promise<void>;
};

export function TeacherJoinRequestsCard({ joinRequests, onApprove, onReject }: TeacherJoinRequestsCardProps) {
  const pendingRequests = joinRequests.filter((item) => item.status === "pending");

  return (
    <Card title="加入班级申请">
      {pendingRequests.length === 0 ? (
        <p>暂无待审核申请。</p>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {pendingRequests.map((item) => (
            <div className="card" key={item.id}>
              <div className="section-title">{item.studentName}</div>
              <p>{item.studentEmail}</p>
              <p>
                班级：{item.className} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
              </p>
              <div className="cta-row">
                <button className="button primary" type="button" onClick={() => onApprove(item.id)}>
                  通过
                </button>
                <button className="button secondary" type="button" onClick={() => onReject(item.id)}>
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

type TeacherAssignmentsCardProps = {
  assignments: AssignmentItem[];
};

export function TeacherAssignmentsCard({ assignments }: TeacherAssignmentsCardProps) {
  return (
    <Card title="作业列表">
      {assignments.length === 0 ? (
        <p>暂无作业。</p>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {assignments.map((item) => (
            <div className="card" key={item.id}>
              <div className="section-title">{item.title}</div>
              <p>
                {item.className} · {SUBJECT_LABELS[item.classSubject] ?? item.classSubject} · {item.classGrade} 年级
              </p>
              {item.moduleTitle ? <p>关联模块：{item.moduleTitle}</p> : null}
              <p>截止日期：{new Date(item.dueDate).toLocaleDateString("zh-CN")}</p>
              <p>类型：{ASSIGNMENT_TYPE_LABELS[item.submissionType ?? "quiz"]}</p>
              <p>
                完成情况：{item.completed}/{item.total}
              </p>
              <div className="cta-row" style={{ marginTop: 8 }}>
                <Link className="button secondary" href={`/teacher/assignments/${item.id}`}>
                  查看详情
                </Link>
                <Link className="button ghost" href={`/teacher/assignments/${item.id}/stats`}>
                  作业统计
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
