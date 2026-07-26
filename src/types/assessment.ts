export interface AssessmentScore {
  name: string;
  score: number;
  totalScore: number;
}

export interface Assessment {
  id: string;
  tuteeId: string;
  tuteeName: string;
  subject: string;
  date: string;
  topic: string;
  assessmentScores: AssessmentScore[];
  totalScore?: number;
  topicsCovered: string;
  notes: string;
  recommendations?: string;
  score: number;
  remarks: 'Excellent' | 'Good' | 'Needs Improvement';
  createdAt: any;
  updatedAt: any;
}
