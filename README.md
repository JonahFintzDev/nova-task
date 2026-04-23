# Nova Task

A modern task management application with a Vue 3 dashboard and Fastify API backend.

## Features

- **Task Management**: Create, edit, delete, and organize tasks with rich metadata
- **Lists & Tags**: Organize tasks into lists and tag them for easy filtering
- **Calendar View**: Visualize tasks on a calendar with date-based navigation
- **Collaboration**: Share and collaborate on tasks with other users
- **AI Integration**: Leverage AI for task suggestions and intelligent assistance
- **Web Push Notifications**: Stay updated with real-time notifications
- **User Authentication**: Secure JWT-based authentication system
- **Responsive Design**: Beautiful, mobile-friendly interface built with TailwindCSS
- **Real-time Updates**: WebSocket support for live task updates
- **Search**: Full-text search across tasks and lists

## Tech Stack

### Backend (API)

- **Framework**: Fastify (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **API Documentation**: Swagger/OpenAPI
- **WebSocket**: @fastify/websocket
- **Push Notifications**: Web Push API

### Frontend (Dashboard)

- **Framework**: Vue 3
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Pinia
- **Routing**: Vue Router
- **Icons**: Lucide Vue
- **Internationalization**: Vue I18n
- **Drag & Drop**: Vue Draggable
- **Date Handling**: Day.js
- **Markdown**: Marked + DOMPurify

## Prerequisites

- Node.js 22+ (for dashboard)
- Node.js 24+ (for API)
- PostgreSQL 17
- Docker and Docker Compose (optional, for containerized deployment)
- npm or pnpm

## Installation

### Using Docker (Recommended)

1. Clone the repository:

```bash
git clone <repository-url>
cd app
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Edit `.env` with your configuration:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=nova_task
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
JWT_SECRET=your_long_random_secret_string
PORT=3000
```

4. Start the application:

```bash
docker-compose up -d
```

5. Access the dashboard at `http://localhost:3080`

### Local Development

#### Backend Setup

1. Navigate to the API directory:

```bash
cd api
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Generate Prisma client:

```bash
npx prisma generate
```

5. Run database migrations:

```bash
npx prisma migrate deploy
```

6. Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

#### Frontend Setup

1. Navigate to the dashboard directory:

```bash
cd dashboard
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`

## Environment Variables

| Variable            | Description                       | Default        |
| ------------------- | --------------------------------- | -------------- |
| `POSTGRES_USER`     | PostgreSQL username               | `postgres`     |
| `POSTGRES_PASSWORD` | PostgreSQL password               | `change_me`    |
| `POSTGRES_DB`       | PostgreSQL database name          | `nova_task`    |
| `POSTGRES_HOST`     | PostgreSQL host                   | `postgres`     |
| `POSTGRES_PORT`     | PostgreSQL port                   | `5432`         |
| `DATABASE_URL`      | Full PostgreSQL connection string | Auto-generated |
| `JWT_SECRET`        | Secret key for JWT token signing  | Required       |
| `PORT`              | API server port                   | `3000`         |

## Docker Images

This project uses GitHub Actions to automatically build and publish Docker images to GitHub Container Registry.

### Pull the Image

```bash
docker pull ghcr.io/<username>/nova-task:latest
```

### Run with Docker

```bash
docker run -p 3000:3000 \
  -e POSTGRES_HOST=your_postgres_host \
  -e POSTGRES_PASSWORD=your_password \
  -e JWT_SECRET=your_secret \
  ghcr.io/<username>/nova-task:latest
```

## Development

### API Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript type checking

### Dashboard Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Database Management

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Create a new migration
npx prisma migrate dev --name migration_name

# Open Prisma Studio
npx prisma studio
```

## API Documentation

When running the API, Swagger documentation is available at:

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs/json`

## Project Structure

```
app/
├── api/                 # Backend API
│   ├── prisma/         # Database schema and migrations
│   ├── src/            # Source code
│   │   ├── classes/    # Utility classes
│   │   ├── routes/     # API route handlers
│   │   └── index.ts    # Application entry point
│   └── package.json
├── dashboard/          # Frontend dashboard
│   ├── src/            # Vue components and logic
│   └── package.json
├── Dockerfile          # Multi-stage Docker build
├── docker-compose.yml  # Docker Compose configuration
└── .github/           # GitHub Actions workflows
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT — see the application [`LICENSE`](LICENSE) if present in this tree.
