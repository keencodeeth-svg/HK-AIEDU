export type RegisterRole = "student" | "parent";

export type StudentRegisterPayload = {
  role: "student";
  name: string;
  email: string;
  password: string;
  grade: string;
  schoolCode?: string;
};

export type ParentRegisterPayload = {
  role: "parent";
  name: string;
  email: string;
  password: string;
  observerCode: string;
};

export type RegisterPayload = StudentRegisterPayload | ParentRegisterPayload;

export type RegisterResponse = {
  error?: string;
  message?: string;
};
