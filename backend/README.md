
# TeamSync Backend API

This is the backend API for the TeamSync application, built with Node.js, Express, and PostgreSQL.

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and update the environment variables
4. Set up the PostgreSQL database:
   - Create a database named `teamsync`
   - Run the schema file: `psql -d teamsync -f src/db/schema.sql`
   - (Optional) Run the seeds file for test data: `psql -d teamsync -f src/db/seeds.sql`
5. Start the server:
   - Development mode: `npm run dev`
   - Production mode: `npm start`

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with role, name, and password
- `GET /api/auth/validate` - Validate JWT token

### Projects

- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get a specific project with its hierarchy
- `POST /api/projects` - Create a new project
- `POST /api/projects/:projectId/areas` - Create a new area
- `POST /api/projects/:projectId/areas/:areaId/pids` - Create a new PID
- `POST /api/projects/:projectId/areas/:areaId/pids/:pidId/lines` - Create a new line
- `POST /api/projects/:projectId/areas/:areaId/equipment` - Create new equipment

### Tasks

- `GET /api/tasks` - Get all tasks (filtered by user role)
- `GET /api/tasks/:id` - Get a specific task
- `POST /api/tasks` - Create a new task (Team Lead+)
- `POST /api/tasks/assign` - Assign a task (Team Lead+)
- `PUT /api/tasks/:id/status` - Update task status
- `PUT /api/tasks/:id/progress` - Update task progress and items

### Users

- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get a specific user
- `GET /api/users/role/:role` - Get users by role

## Authentication

All routes except `/api/auth/login` require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Role-Based Access Control

The API implements role-based access control with these roles:
- Data Entry
- Team Member
- Team Lead
- Project Manager
- Admin

Each role has specific permissions and access levels to various endpoints.
