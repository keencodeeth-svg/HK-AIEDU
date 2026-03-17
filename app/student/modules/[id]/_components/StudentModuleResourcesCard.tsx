"use client";

import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import type { StudentModuleResource } from "../types";
import { formatStudentModuleFileSize, getStudentModuleResourceTypeLabel } from "../utils";

type Props = {
  resources: StudentModuleResource[];
};

export default function StudentModuleResourcesCard({ resources }: Props) {
  return (
    <Card title="资源列表" tag="课件">
      <div id="student-module-resources" className="feature-card">
        <EduIcon name="board" />
        <p>这里集中放当前模块的课件、参考资料和拓展链接，适合先看资料再完成作业。</p>
      </div>

      {resources.length ? (
        <div className="grid" style={{ gap: 10, marginTop: 12 }}>
          {resources.map((resource) => (
            <div className="card student-module-resource-card" key={resource.id}>
              <div className="section-title">{resource.title}</div>
              <div className="workflow-card-meta">
                <span className="pill">{getStudentModuleResourceTypeLabel(resource.resourceType)}</span>
                {resource.fileName ? <span className="pill">{resource.fileName}</span> : null}
                <span className="pill">{formatStudentModuleFileSize(resource.size)}</span>
                <span className="pill">上传于 {formatLoadedTime(resource.createdAt)}</span>
              </div>
              <div className="student-module-resource-meta">
                {resource.resourceType === "link"
                  ? "推荐先打开原始资料链接查看，再回到当前页继续完成模块任务。"
                  : "可直接下载老师上传的资料文件，离线复习也更方便。"}
              </div>
              <div className="cta-row student-module-next-actions">
                {resource.resourceType === "link" && resource.linkUrl ? (
                  <a className="button secondary" href={resource.linkUrl} target="_blank" rel="noreferrer">
                    打开链接
                  </a>
                ) : resource.contentBase64 ? (
                  <a
                    className="button secondary"
                    href={`data:${resource.mimeType};base64,${resource.contentBase64}`}
                    download={resource.fileName}
                  >
                    下载资料
                  </a>
                ) : (
                  <span className="status-note info">当前资料暂不支持直接下载</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <StatePanel
            compact
            tone="empty"
            title="当前模块还没有学习资料"
            description="老师补充资料后，这里会自动更新；你也可以先去查看模块作业。"
            action={
              <a className="button secondary" href="#student-module-assignments">
                去看模块作业
              </a>
            }
          />
        </div>
      )}
    </Card>
  );
}
