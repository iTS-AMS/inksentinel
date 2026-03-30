# 🖋️ InkSentinel: Centralized Digital Examination System

**InkSentinel** is a next-generation Centralized Digital Examination System integrating smart pen control, AI-based monitoring, and a real-time invigilator dashboard. It bridges the gap between traditional handwriting and digital security, providing educational institutions with a foolproof, automated, and seamless examination ecosystem.

**ExamNexus**, the frontend portal of InkSentinel, empowers proctors with live surveillance, automated anomaly flagging, and hardware gateway management.

**Developed for CSE299 | North South University (NSU)**

---

## 👥 Team AAAF (The Core Pillars)

| Name                        | Student ID | Domain / Role                                                         |
| :-------------------------- | :--------- | :-------------------------------------------------------------------- |
| **Shams Akbar Aalok**       | 2232201642 | ⚙️ **Hardware Interface:** Smart pen control & Gateway integration    |
| **Farhan Ahmed Fahim**      | 2232581642 | 🤖 **AI & ML:** AI-based monitoring, vision & audio anomaly detection |
| **Ashfaq Mahee Siddiky**    | 2231903042 | 🎨 **Frontend & UI/UX:** ExamNexus real-time invigilator dashboard    |
| **Md Abidur Rahman Shihab** | 2232718642 | 🔗 **Backend System:** Centralized API & database architecture        |

---

## ✨ Core Features

### 1. 🖋️ Smart Pen Integration & Hardware Control

- Seamless device pairing with Smart Pens and student tablets/terminals.
- Digitized handwriting synchronization for essay and written exams.
- Hardware gateway tracking and latency monitoring.

### 2. 🤖 AI-Based Monitoring (Real-Time)

- **Vision AI:** Detects unauthorized devices (e.g., smartphones), looking away/gaze tracking, and multiple persons in the camera frame.
- **Audio AI:** Monitors ambient noise and detects unauthorized conversations or multiple voices.
- Automated confidence scoring (e.g., 94% Probability) for accurate flagging.

### 3. 🖥️ ExamNexus: Invigilator Dashboard

- **Live Grid:** Monitor all active students, connection status, and live camera feeds in one centralized view.
- **AI Alerts Feed:** Real-time push notifications and a dedicated feed for AI-flagged events categorized by High/Medium/Low severity.
- **Audit Log:** A comprehensive, filterable historical record of all anomalies, timestamps, and invigilator actions taken.
- **Exam Setup:** Define exam parameters, durations, scheduled breaks, and safety controls (Lockdown Browser).

### 4. 🔗 Centralized Backend & Security

- Unified state management across the examination hall.
- Instant action execution (Issue Warnings, Suspend, or Expel students).
- Secure, role-based access for Invigilators and Senior Proctors.

---

## 💻 Tech Stack Highlights

- **Frontend (ExamNexus):** HTML5, Tailwind CSS, Vanilla JavaScript (Component-based architecture)
- **AI Engine:** Computer Vision & Audio Processing pipelines
- **Hardware:** Custom IoT Gateways & Smart Pen protocols
- **Backend:** RESTful APIs, Centralized Database Management

---

## 📂 Project Structure (Frontend)

```text
InkSentinel/
│
├── components/
│   ├── header.html             # Reusable global header
│   └── sidebar.html            # Reusable navigation sidebar
│
├── pages/
│   ├── login-page.html         # Portal entry point (ID: 123, Pass: 123)
│   ├── dashboard-page.html     # Live monitoring grid
│   ├── exam-setup-page.html    # Configuration & safety rules
│   ├── alert-monitor-page.html # Live AI anomaly feed
│   ├── student-list-page.html  # Enrolled students & device pairing
│   ├── audit-log-page.html     # Historical data & resolution tracking
│   └── settings-page.html      # UI, System, & AI Sensitivity configurations
│
└── scripts/
    └── component-loader.js     # Dynamically loads components & handles active states
```
