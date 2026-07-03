<div align="center">

# ⚡ JobControl

### Enterprise Distributed Job Scheduling Platform

Reliable • Scalable • Concurrent • Fault-Tolerant

A production-inspired distributed job scheduling platform built with **FastAPI**, **React**, **PostgreSQL**, and **ThreadPool Workers**. JobControl enables organizations to efficiently execute, monitor, and manage background jobs with real-time visibility, retry mechanisms, worker orchestration, and dead-letter queue support.

<p align="center">
<img src="https://img.shields.io/badge/Python-3.12-blue?logo=python"/>
<img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi"/>
<img src="https://img.shields.io/badge/React-18-61DAFB?logo=react"/>
<img src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql"/>
<img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript"/>
<img src="https://img.shields.io/badge/License-MIT-success"/>
</p>

### 🔗 Repository

**https://github.com/aadarshjaiswal640/Job-Scheduler**

</div>

---

# 🚀 Overview

JobControl is a production-inspired distributed task scheduling platform designed to manage asynchronous workloads reliably and efficiently. It provides enterprise-grade queue management, worker orchestration, retry mechanisms, dead-letter queue support, and real-time monitoring through a modern web dashboard.

The platform demonstrates scalable backend engineering principles including concurrent job execution, multi-worker processing, fault tolerance, and modular system architecture.

---

# ✨ Features

-  JWT Authentication
-  Organization Management
-  Multi-Tenant Architecture
-  Distributed Worker Fleet
-  Queue Management
-  Job Scheduling
-  Immediate Jobs
-  Scheduled Jobs
-  Recurring Jobs
-  Retry Policies
-  Dead Letter Queue
-  Worker Monitoring
-  Job Explorer
-  Dashboard Analytics
-  Activity Feed
-  REST APIs
-  WebSocket Live Updates
-  PostgreSQL Database
-  Modern React Dashboard

---

# 🏗️ System Architecture

```text
                React Dashboard
                      │
          REST API + WebSockets
                      │
              FastAPI Backend
                      │
        Authentication & Authorization
                      │
          Queue Management Service
                      │
              PostgreSQL Database
                      │
        Distributed Worker Engine
                      │
          Background Job Execution
```

---

# ⚙️ Technology Stack

| Layer | Technology |
|--------|------------|
| Backend | FastAPI |
| Frontend | React 18 |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Authentication | JWT |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Worker Engine | ThreadPoolExecutor |
| API | REST |
| Real-time | WebSockets |

---

# 🚀 Quick Demo

After starting the application, sign in using the administrator demo account.

| Field | Value |
|-------|-------|
| **Email** | `admin@demo.com` |
| **Password** | `password123` |

### Demo Access Includes

- 📊 Dashboard Analytics
- 📋 Job Explorer
- 👷 Worker Fleet
- 🏢 Organization Management
- ⚠️ Dead Letter Queue
- 📈 Execution Monitoring
- 🔄 Queue Management

> **Note:** These credentials are provided solely for evaluation and demonstration purposes.


# 📂 Project Structure

```text
Job-Scheduler
│
├── backend/
│
├── worker/
│
├── artifacts/
│
├── docs/
│
├── scripts/
│
├── lib/
│
├── README.md
│
└── package.json
```

---

# 🚀 Installation

Clone the repository

```bash
git clone https://github.com/aadarshjaiswal640/Job-Scheduler.git

cd Job-Scheduler
```

Install Backend Dependencies

```bash
pip install -r requirements.txt
```

Install Frontend Dependencies

```bash
npm install
```

Run Backend

```bash
uvicorn backend.app.main:app --reload
```

Run Frontend

```bash
npm run dev
```

---

# 🔑 Core Modules

- Authentication
- Organizations
- Projects
- Queue Management
- Scheduler Engine
- Worker Fleet
- Dashboard
- Job Explorer
- Dead Letter Queue
- Activity Feed
- Monitoring
- Analytics

---

# 📈 Highlights

- PostgreSQL Transaction Locking
- ThreadPool Worker Engine
- Distributed Processing
- Queue Prioritization
- Retry Policies
- Dead Letter Queue
- JWT Authentication
- REST APIs
- WebSocket Updates
- Enterprise Dashboard
- Modular Architecture

---

# 📚 Documentation

Detailed project documentation is available inside the **docs/** directory.

- 📄 Submission Report
- 🏗️ Architecture
- 🗄️ Database Design
- 🔗 ER Diagram
- 📡 API Documentation
- ⚙️ Design Decisions
- 🧪 Testing Guide

---

# 🛣️ Future Enhancements

- Docker Deployment
- Kubernetes Support
- Redis Queue Integration
- Horizontal Worker Scaling
- Cron Scheduler
- Prometheus Metrics
- Grafana Dashboard
- Distributed Locking
- CI/CD Pipeline
- AI-powered Failure Analysis

---

# 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push the branch
5. Open a Pull Request

---

# 📄 License

This project is intended for educational and internship evaluation purposes.

---

# 👨‍💻 Author

**Aadarsh Jaiswal**

B.Tech Computer Science Engineering  
SRM Institute of Science and Technology

### GitHub

https://github.com/aadarshjaiswal640

### Project Repository

https://github.com/aadarshjaiswal640/Job-Scheduler

---

<div align="center">

### ⭐ If you found this project interesting, consider giving it a Star!

Built with ❤️ by **Aadarsh Jaiswal**

</div>
