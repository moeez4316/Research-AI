export interface ReportContent {
  summary: string;
  findings: Finding[];
  sources: Source[];
  confidence_notes: string[];
}

export interface Finding {
  sub_question: string;
  points: string[];
  citations: number[];
}

export interface Source {
  title: string;
  url: string;
  note: string;
}

export interface StepDetail {
  /** break_down step */
  sub_questions?: string[];

  /** gather step */
  answers?: SubQuestionAnswer[];
  source_count?: number;

  /** cross_check step */
  confidence_notes?: string[];

  /** write step / error detail */
  message?: string;
}

export interface SubQuestionAnswer {
  sub_question: string;
  answer: string;
  citations: {
    title: string;
    url: string;
    content: string;
  }[];
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}