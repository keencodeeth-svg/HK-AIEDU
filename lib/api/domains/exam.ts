import { createDomainRoute } from "./route";

// Exam domain routes share the same auth/cache envelope and domain tagging.
export const createExamRoute = createDomainRoute("exam");
