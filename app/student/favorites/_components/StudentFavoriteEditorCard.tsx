import type { RefObject } from "react";

type StudentFavoriteEditorCardProps = {
  draftTags: string;
  draftNote: string;
  saving: boolean;
  editorRef: RefObject<HTMLTextAreaElement>;
  onDraftTagsChange: (value: string) => void;
  onDraftNoteChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export default function StudentFavoriteEditorCard({
  draftTags,
  draftNote,
  saving,
  editorRef,
  onDraftTagsChange,
  onDraftNoteChange,
  onSave,
  onCancel
}: StudentFavoriteEditorCardProps) {
  return (
    <div className="card favorites-editor-card" style={{ marginTop: 10 }}>
      <div className="section-title">编辑标签与备注</div>
      <label className="grid" style={{ gap: 6 }}>
        <div className="form-note">标签可用逗号或换行分隔，例如：易错、分数、应用题</div>
        <textarea
          value={draftTags}
          onChange={(event) => onDraftTagsChange(event.target.value)}
          rows={2}
          className="inbox-textarea"
          placeholder="输入标签"
        />
      </label>
      <label className="grid" style={{ gap: 6, marginTop: 10 }}>
        <div className="form-note">补一句复习备注，帮助未来快速回忆这题为什么重要。</div>
        <textarea
          ref={editorRef}
          value={draftNote}
          onChange={(event) => onDraftNoteChange(event.target.value)}
          rows={3}
          className="inbox-textarea"
          placeholder="例如：这题容易把单位换算漏掉；下次先列已知条件。"
        />
      </label>
      <div className="cta-row favorites-editor-actions">
        <button className="button primary" type="button" onClick={onSave} disabled={saving}>
          {saving ? "保存中..." : "保存信息"}
        </button>
        <button className="button ghost" type="button" onClick={onCancel} disabled={saving}>
          取消编辑
        </button>
      </div>
    </div>
  );
}
