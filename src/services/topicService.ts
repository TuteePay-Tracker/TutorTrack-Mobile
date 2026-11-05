import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface Topic {
  id: string;
  subject: string;
  name: string;
  description?: string;
  createdAt?: any;
}

export interface StudentTopicProgress {
  id: string;
  tuteeId: string;
  topicId: string;
  topicName: string;
  subject: string;
  score: number;
  performanceLevel: 'mastered' | 'in-progress' | 'needs-improvement' | 'not-started';
  strengths?: string;
  areasForImprovement?: string;
  notes?: string;
  schoolYear?: string;
  updatedAt?: any;
}

export type PerformanceLevel = StudentTopicProgress['performanceLevel'];

export interface LevelConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  barColor: string;
}

export const LEVEL_CONFIG: Record<PerformanceLevel, LevelConfig> = {
  mastered: {
    label: 'Mastered',
    color: '#15803d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    barColor: '#22c55e',
  },
  'in-progress': {
    label: 'In Progress',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    barColor: '#3b82f6',
  },
  'needs-improvement': {
    label: 'Needs Improvement',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    barColor: '#f59e0b',
  },
  'not-started': {
    label: 'Not Started',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#e5e7eb',
    barColor: '#d1d5db',
  },
};

export const topicService = {
  subscribeTopics(
    tutorId: string,
    callback: (topics: Topic[]) => void
  ): () => void {
    const ref = collection(db, 'users', tutorId, 'topics');
    return onSnapshot(ref, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Topic[];
      data.sort((a, b) => a.name.localeCompare(b.name));
      callback(data);
    });
  },

  subscribeTopicProgress(
    tutorId: string,
    callback: (progress: StudentTopicProgress[]) => void
  ): () => void {
    const ref = collection(db, 'users', tutorId, 'topicProgress');
    return onSnapshot(ref, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as StudentTopicProgress[];
      callback(data);
    });
  },
};

