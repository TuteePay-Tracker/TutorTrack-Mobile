# Tutor Track - Mobile

A **parent portal** mobile app for the Tutor Track tutoring management system. Built with Expo and React Native, it allows parents/guardians to monitor their children's tutoring sessions, payments, attendance, assessments, and communicate with the tutor — all in real time.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React Native via Expo SDK 57 |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| Backend | Firebase (Auth + Cloud Firestore) |
| UI | React Native Paper (Material Design) |
| Icons | MaterialCommunityIcons |
| Notifications | Expo Notifications |

## Features

- **Dashboard** — KPI overview, monthly score charts, subject averages, upcoming sessions
- **My Children** — View linked children with attendance, scores, and payment status
- **Child Details** — Schedule, payments, and assessments per child
- **Payments** — Full payment history, per-child breakdown, outstanding balances
- **Assessments** — Test scores, topics, and remarks across all children
- **Attendance** — Per-child and overall attendance tracking
- **Announcements** — Tutor-posted announcements with priority levels
- **Chat** — Real-time messaging with the tutor
- **Schedule** — Upcoming tutoring sessions for the next 4 weeks
- **Settings** — Account info, notification preferences, logout

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the development server**
   ```bash
   npx expo start
   ```

3. **Run on a device or emulator**
   - Scan the QR code with **Expo Go** on your phone
   - Press `a` for Android emulator or `i` for iOS simulator

## Project Structure

```
mobile/
├── app/                    # Expo Router file-based routes
│   ├── (auth)/             # Login, forgot password, change password
│   └── (main)/             # Dashboard, children, payments, chat, etc.
├── src/
│   ├── components/         # Reusable UI components
│   ├── contexts/           # Auth context
│   ├── hooks/              # Custom hooks (useAuth, useTutees, etc.)
│   ├── services/           # Firebase/Firestore service layer
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Formatting utilities
└── assets/                 # Icons and splash screen images
```

## License

MIT
