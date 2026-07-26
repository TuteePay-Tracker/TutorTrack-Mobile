export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  tutorId: string;
  createdAt: any;
  updatedAt: any;
}
