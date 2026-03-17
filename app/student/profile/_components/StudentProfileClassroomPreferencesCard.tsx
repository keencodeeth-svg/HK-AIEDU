import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import {
  STUDENT_EYESIGHT_LEVEL_LABELS,
  STUDENT_EYESIGHT_LEVEL_VALUES,
  STUDENT_FOCUS_SUPPORT_LABELS,
  STUDENT_FOCUS_SUPPORT_VALUES,
  STUDENT_GENDER_LABELS,
  STUDENT_GENDER_VALUES,
  STUDENT_PERSONALITY_LABELS,
  STUDENT_PERSONALITY_VALUES,
  STUDENT_PEER_SUPPORT_LABELS,
  STUDENT_PEER_SUPPORT_VALUES,
  STUDENT_SEAT_PREFERENCE_LABELS,
  STUDENT_SEAT_PREFERENCE_VALUES
} from "@/lib/student-persona-options";
import type { StudentProfileFormState } from "../types";
import { studentProfileInputStyle } from "../utils";

type StudentProfileClassroomPreferencesCardProps = {
  form: StudentProfileFormState;
  onPreferredNameChange: (value: string) => void;
  onHeightCmChange: (value: string) => void;
  onGenderChange: (value: StudentProfileFormState["gender"]) => void;
  onEyesightLevelChange: (value: StudentProfileFormState["eyesightLevel"]) => void;
  onSeatPreferenceChange: (value: StudentProfileFormState["seatPreference"]) => void;
  onPersonalityChange: (value: StudentProfileFormState["personality"]) => void;
  onFocusSupportChange: (value: StudentProfileFormState["focusSupport"]) => void;
  onPeerSupportChange: (value: StudentProfileFormState["peerSupport"]) => void;
};

export default function StudentProfileClassroomPreferencesCard({
  form,
  onPreferredNameChange,
  onHeightCmChange,
  onGenderChange,
  onEyesightLevelChange,
  onSeatPreferenceChange,
  onPersonalityChange,
  onFocusSupportChange,
  onPeerSupportChange
}: StudentProfileClassroomPreferencesCardProps) {
  return (
    <Card title="课堂与学期座位偏好" tag="学期排座">
      <div className="feature-card">
        <EduIcon name="board" />
        <p>这些信息会进入老师端学期排座配置，综合考虑成绩互补、性别、身高、前排需求、专注支持与同桌协作。</p>
      </div>
      <div className="grid grid-2" style={{ gap: 12, marginTop: 12 }}>
        <label>
          <div className="section-title">常用称呼</div>
          <input
            value={form.preferredName}
            onChange={(event) => onPreferredNameChange(event.target.value)}
            placeholder="例如：小宇 / 英文名"
            style={studentProfileInputStyle}
          />
        </label>
        <label>
          <div className="section-title">身高（cm）</div>
          <input
            value={form.heightCm}
            onChange={(event) => onHeightCmChange(event.target.value)}
            placeholder="例如：146"
            inputMode="numeric"
            style={studentProfileInputStyle}
          />
        </label>
        <label>
          <div className="section-title">性别信息</div>
          <select
            value={form.gender}
            onChange={(event) => onGenderChange(event.target.value as StudentProfileFormState["gender"])}
            style={studentProfileInputStyle}
          >
            <option value="">请选择</option>
            {STUDENT_GENDER_VALUES.map((item) => (
              <option key={item} value={item}>
                {STUDENT_GENDER_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">视力 / 前排需求</div>
          <select
            value={form.eyesightLevel}
            onChange={(event) => onEyesightLevelChange(event.target.value as StudentProfileFormState["eyesightLevel"])}
            style={studentProfileInputStyle}
          >
            <option value="">请选择</option>
            {STUDENT_EYESIGHT_LEVEL_VALUES.map((item) => (
              <option key={item} value={item}>
                {STUDENT_EYESIGHT_LEVEL_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">座位偏好</div>
          <select
            value={form.seatPreference}
            onChange={(event) => onSeatPreferenceChange(event.target.value as StudentProfileFormState["seatPreference"])}
            style={studentProfileInputStyle}
          >
            <option value="">请选择</option>
            {STUDENT_SEAT_PREFERENCE_VALUES.map((item) => (
              <option key={item} value={item}>
                {STUDENT_SEAT_PREFERENCE_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">课堂性格</div>
          <select
            value={form.personality}
            onChange={(event) => onPersonalityChange(event.target.value as StudentProfileFormState["personality"])}
            style={studentProfileInputStyle}
          >
            <option value="">请选择</option>
            {STUDENT_PERSONALITY_VALUES.map((item) => (
              <option key={item} value={item}>
                {STUDENT_PERSONALITY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">专注支持</div>
          <select
            value={form.focusSupport}
            onChange={(event) => onFocusSupportChange(event.target.value as StudentProfileFormState["focusSupport"])}
            style={studentProfileInputStyle}
          >
            <option value="">请选择</option>
            {STUDENT_FOCUS_SUPPORT_VALUES.map((item) => (
              <option key={item} value={item}>
                {STUDENT_FOCUS_SUPPORT_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="section-title">同桌协作</div>
          <select
            value={form.peerSupport}
            onChange={(event) => onPeerSupportChange(event.target.value as StudentProfileFormState["peerSupport"])}
            style={studentProfileInputStyle}
          >
            <option value="">请选择</option>
            {STUDENT_PEER_SUPPORT_VALUES.map((item) => (
              <option key={item} value={item}>
                {STUDENT_PEER_SUPPORT_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Card>
  );
}
