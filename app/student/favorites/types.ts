export type FavoriteItem = {
  id: string;
  questionId: string;
  tags: string[];
  note?: string;
  updatedAt: string;
  question?: {
    id: string;
    stem: string;
    subject: string;
    grade: string;
    knowledgePointTitle: string;
  } | null;
};

export type FavoritesResponse = {
  data?: FavoriteItem[];
};

export type StudentFavoritesStageCopy = {
  title: string;
  description: string;
};
