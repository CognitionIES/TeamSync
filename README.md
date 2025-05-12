# Task Management System README

## Overview

This project is a **Task Management System** designed to facilitate task assignment, tracking, and management for various roles within an organization, specifically targeting engineering and project management workflows. The system allows users to manage tasks related to Piping and Instrumentation Diagrams (P&IDs), lines, and equipment, with role-based access control (RBAC) for Admins, Project Managers, Team Leads, and Team Members. The system supports assigning tasks (e.g., UPV, QC) to team members, associating tasks with specific projects, and tracking task progress, comments, and associated items.

The project was developed to address issues such as incorrect task filtering, invalid line assignments, and missing API endpoints, ensuring a robust and user-friendly experience for all roles.

---

## System Design

### Architecture

The Task Management System follows a **client-server architecture** with a React-based frontend and a Node.js/Express backend, connected to a PostgreSQL database for persistent storage.

- **Frontend**: A single-page application (SPA) built with React and TypeScript, utilizing Axios for API requests and React-Toastify for user notifications.
- **Backend**: A RESTful API built with Node.js and Express, handling authentication, role-based access, and CRUD operations for tasks, lines, P&IDs, and users.
- **Database**: PostgreSQL, used to store tasks, users, projects, P&IDs, lines, equipment, and related metadata.

### Data Flow

1. **User Authentication**: Users log in, and a JSON Web Token (JWT) is generated and stored in local storage for authentication.
2. **Role-Based Access**:
    - Admins can view and filter all tasks by project and team.
    - Project Managers oversee tasks for their teams.
    - Team Leads assign tasks to Team Members.
    - Team Members view and manage tasks assigned to them.
3. **Task Management**:
    - Team Leads create tasks (e.g., UPV, QC) and assign them to Team Members, associating tasks with lines, P&IDs, or equipment.
    - Tasks are stored in the database with metadata (e.g., project_id, assignee_id, status, items).
    - Team Members can view their assigned tasks and associated lines.
4. **Line Assignment**:
    - Lines are fetched based on project and assignment status (e.g., unassigned lines for Team Leads, assigned lines for Team Members).
    - Team Leads assign lines to Team Members by updating the assigned_to_id field.

### System Components

- **Frontend Components**:
    - TeamLeadDashboard.tsx: Interface for Team Leads to create tasks, assign lines/P&IDs/equipment, and manage team members.
    - TeamMemberDashboard.tsx: Interface for Team Members to view their assigned tasks and lines.
    - DataEntryDashboard.tsx: Interface for data entry users (not fully detailed in the conversation).
- **Backend Routes**:
    - tasks.routes.js: Handles task creation, retrieval, and updates.
    - pids.routes.js: Manages P&ID data, including filtering by project.
    - lines.routes.js: Manages line data, including assignment and retrieval of assigned/unassigned lines.
    - users.routes.js: Handles user data and team member retrieval.
- **Database Tables**:
    - users: Stores user information (e.g., id, name, role).
    - tasks: Stores task data (e.g., id, type, assignee_id, project_id, status, items).
    - task_items: Links tasks to items (e.g., lines, P&IDs) with fields like task_id, item_id, item_type.
    - task_comments: Stores comments on tasks.
    - lines: Stores line data (e.g., id, line_number, project_id, assigned_to_id).
    - pids: Stores P&ID data (e.g., id, pid_number, project_id).
    - projects: Stores project data (e.g., id, name).
    - team_members: Links team members to their leads (e.g., lead_id, member_id).

---

## Diagramming and Modeling

### Entity-Relationship Diagram (ERD)

The database schema is modeled using the following relationships:

- **Users** ↔ **Tasks** (One-to-Many): A user can be assigned multiple tasks (assignee_id in tasks references users.id).
- **Tasks** ↔ **Task Items** (One-to-Many): A task can have multiple items (task_id in task_items references tasks.id).
- **Task Items** ↔ **Lines/P&IDs/Equipment** (Many-to-One): A task item references a line, P&ID, or equipment (item_id and item_type in task_items).
- **Tasks** ↔ **Task Comments** (One-to-Many): A task can have multiple comments (task_id in task_comments references tasks.id).
- **Projects** ↔ **Tasks** (One-to-Many): A project can have multiple tasks (project_id in tasks references projects.id).
- **Projects** ↔ **P&IDs** ↔ **Lines** (One-to-Many): A project has multiple P&IDs, and each P&ID has multiple lines (project_id in pids and lines).
- **Users** ↔ **Lines** (One-to-Many): A user can be assigned multiple lines (assigned_to_id in lines references users.id).
- **Team Members** ↔ **Users** (Many-to-Many): Team members are linked to their leads via the team_members table (lead_id and member_id reference users.id).

**Simplified ERD Representation**:

- Entities: users, tasks, task_items, task_comments, projects, pids, lines, equipment, team_members.
- Relationships:
    - users (id) → tasks (assignee_id)
    - tasks (id) → task_items (task_id)
    - task_items (item_id, item_type) → lines/pids/equipment (id)
    - projects (id) → tasks/pids/lines (project_id)
    - users (id) → team_members (lead_id, member_id)

### API Endpoints Diagram

The backend exposes RESTful API endpoints for various operations:

- **Tasks**:
    - GET /api/tasks: Retrieves tasks based on user role (Admin, Project Manager, Team Lead, Team Member).
    - POST /api/tasks: Creates a new task with associated items.
- **P&IDs**:
    - GET /api/pids?projectId=<id>: Retrieves P&IDs for a specific project.
- **Lines**:
    - GET /api/lines/unassigned/:projectId: Retrieves unassigned lines for a project (used by Team Leads).
    - GET /api/lines/assigned: Retrieves lines assigned to the logged-in Team Member.
    - PUT /api/lines/:id/assign: Assigns a line to a user.
- **Users**:
    - GET /api/users/team-members: Retrieves team members under the current Team Lead.

**Simplified API Flow**:

- Team Lead → GET /api/lines/unassigned/:projectId → Select lines → POST /api/tasks → PUT /api/lines/:id/assign.
- Team Member → GET /api/lines/assigned → View assigned lines.

---

## Technical Information

### Tech Stack

- **Frontend**:
    - React (JavaScript library for building user interfaces).
    - TypeScript (for type safety and better development experience).
    - Axios (for making HTTP requests to the backend API).
    - React-Toastify (for user notifications and alerts).
    - Tailwind CSS (optional, for styling, if used).
- **Backend**:
    - Node.js (JavaScript runtime for server-side logic).
    - Express (web framework for building the REST API).
    - PostgreSQL (relational database for data storage).
    - pg (Node.js library for PostgreSQL interaction).
    - JSON Web Tokens (JWT) for authentication.
- **Database**:
    - PostgreSQL (version not specified, assumed 13+ for JSON aggregation support).
- **Development Tools**:
    - Visual Studio Code (recommended IDE).
    - Postman (for API testing).
    - pgAdmin or DBeaver (for database management and querying).

### Authentication

- **JWT-Based Authentication**:
    - Users log in, and a JWT is generated and stored in the client’s local storage.
    - The token is sent in the Authorization header (Bearer <token>) for authenticated requests.
    - The protect middleware verifies the token and attaches the user object (req.user) to the request.
- **Role-Based Access Control (RBAC)**:
    - Roles: Admin, Project Manager, Team Lead, Team Member.
    - Each role has specific permissions (e.g., Team Members can only view their own tasks, Team Leads can assign tasks).

### Error Handling

- **Frontend**:
    - Errors are caught using try-catch blocks in async functions (e.g., fetchTasks, fetchLines).
    - Axios errors are typed as AxiosError and displayed to the user via toast notifications.
    - Example: 404 Not Found errors are shown as "Failed to fetch lines".
- **Backend**:
    - Errors are caught in try-catch blocks and logged to the console.
    - Appropriate HTTP status codes are returned:
        - 400 Bad Request: Invalid input (e.g., invalid line ID or team member ID).
        - 403 Forbidden: Unauthorized access (e.g., user not a team member under the lead).
        - 404 Not Found: Resource not found (e.g., line or user not found).
        - 500 Internal Server Error: Unexpected server errors.

---

## Development Process

### Issues Addressed

1. **Incorrect Task Filtering for Admins**:
    - Issue: Admins couldn’t filter tasks by project due to a missing project_name column in the tasks table.
    - Fix: Updated the GET /api/tasks endpoint to use project_id and join with the projects table to filter by project name.
2. **Invalid Line Assignments**:
    - Issue: Team Leads received "Invalid line ID or team member ID" errors when assigning lines.
    - Fix: Added PUT /api/lines/:id/assign endpoint with proper validation, ensuring lines and team members exist and are associated correctly.
3. **Incorrect P&ID Filtering**:
    - Issue: GET /api/pids returned all P&IDs instead of filtering by projectId.
    - Fix: Updated the endpoint to filter P&IDs by projectId query parameter.
4. **Missing Endpoint for Team Members**:
    - Issue: TeamMemberDashboard.tsx failed to fetch lines due to a missing GET /api/lines endpoint.
    - Fix: Added GET /api/lines/assigned to fetch lines assigned to the logged-in Team Member.
5. **Existing Tasks with** project_id = NULL:
    - Issue: Existing tasks had project_id = NULL, causing filtering issues.
    - Fix: Populated project_id using task_items data or defaulted to a specific project (e.g., Garryville).

### Database Migrations

- Added project_id column to tasks table to associate tasks with projects.
- Added assigned_to_id column to lines table to track line assignments.
- Ensured foreign key constraints (e.g., assigned_to_id references users.id).

### Testing

- **Frontend Testing**:
    - Tested TeamLeadDashboard.tsx by assigning tasks and lines to team members.
    - Tested TeamMemberDashboard.tsx to ensure assigned lines are displayed correctly.
- **Backend Testing**:
    - Used Postman to test API endpoints (e.g., GET /api/tasks, PUT /api/lines/:id/assign).
    - Verified database queries using pgAdmin to ensure correct data retrieval and updates.
- **Debugging**:
    - Added console logs in both frontend and backend to trace data flow (e.g., logging assigneeId in handleAssign).
    - Queried database tables to verify data consistency (e.g., SELECT * FROM lines WHERE id = 210).

---

## Tools Used

### Development Tools

- **Visual Studio Code**: IDE for writing and debugging code.
- **Git**: Version control system for tracking changes.
- **Postman**: API testing tool for verifying endpoints.
- **pgAdmin/DBeaver**: Database management tools for querying and managing PostgreSQL.

### Libraries and Frameworks

- **Frontend**:
    - React: UI library.
    - TypeScript: Type safety.
    - Axios: HTTP client.
    - React-Toastify: Notifications.
- **Backend**:
    - Node.js: Server runtime.
    - Express: API framework.
    - pg: PostgreSQL client for Node.js.
    - jsonwebtoken: JWT authentication.
- **Database**:
    - PostgreSQL: Relational database.

### Deployment (Assumed)

- **Backend**: Hosted on a Node.js server (e.g., Heroku, AWS EC2).
- **Frontend**: Deployed as a static site (e.g., Netlify, Vercel).
- **Database**: Hosted on a managed PostgreSQL service (e.g., AWS RDS, Heroku Postgres).

---

## Setup Instructions

### Prerequisites

- Node.js (v16+ recommended)
- PostgreSQL (v13+ recommended)
- Git
- npm or Yarn

### Installation

1. **Clone the Repository**:
    - git clone <repository-url>
    - cd task-management-system
2. **Backend Setup**:
    - Navigate to the backend directory: cd backend.
    - Install dependencies: npm install.
    - Set up environment variables in a .env file:
        - DATABASE_URL: PostgreSQL connection string.
        - JWT_SECRET: Secret key for JWT authentication.
    - Initialize the database:
        - Create the database using PostgreSQL.
        - Run migrations to set up tables (e.g., users, tasks, lines).
    - Start the server: npm start.
3. **Frontend Setup**:
    - Navigate to the frontend directory: cd frontend.
    - Install dependencies: npm install.
    - Set up environment variables in a .env file:
        - REACT_APP_API_URL: Backend API URL (e.g., http://localhost:3000/api).
    - Start the development server: npm start.
4. **Database Setup**:
    - Use pgAdmin or DBeaver to create the database.
    - Run the following SQL commands to set up tables (migrations should be automated in a production setup):
        - Create users, tasks, task_items, task_comments, projects, pids, lines, team_members tables.
        - Add foreign key constraints (e.g., tasks.assignee_id references users.id).

### Running the Application

- **Backend**: Run npm start in the backend directory (default port: 3000).
- **Frontend**: Run npm start in the frontend directory (default port: 3000, but React will use a different port if 3000 is occupied).
- Access the application at http://localhost:3000 (or the port specified by React).

---

## Usage

### Roles and Features

- **Admin**:
    - View all tasks, filter by project and team.
    - Access: GET /api/tasks?project=<projectName>&team=<teamName>.
- **Project Manager**:
    - View tasks for their teams.
    - Access: GET /api/tasks.
- **Team Lead**:
    - Create tasks (e.g., UPV, QC) and assign them to team members.
    - Assign lines, P&IDs, or equipment to tasks.
    - Access: POST /api/tasks, PUT /api/lines/:id/assign.
- **Team Member**:
    - View tasks and lines assigned to them.
    - Access: GET /api/tasks, GET /api/lines/assigned.

### Example Workflow

1. **Team Lead Assigns a Task**:
    - Log in as a Team Lead.
    - Navigate to the Team Lead Dashboard.
    - Select a project (e.g., "Garryville").
    - Choose a task type (e.g., "UPV") and assignment type (e.g., "Line").
    - Select unassigned lines and a team member.
    - Click "Assign Task" to create the task and assign the lines.
2. **Team Member Views Assigned Lines**:
    - Log in as a Team Member.
    - Navigate to the Team Member Dashboard.
    - View the list of assigned lines and associated tasks.

---

## Future Improvements

1. **Input Validation**:
    - Add stricter input validation on the frontend (e.g., ensure assigneeId is valid before making API calls).
    - Use a validation library like Joi on the backend for request payloads.
2. **Pagination**:
    - Implement pagination for API endpoints (e.g., GET /api/tasks, GET /api/lines/assigned) to handle large datasets.
3. **Audit Logging**:
    - Enhance audit logging to track all task and line assignments for accountability.
4. **UI/UX Enhancements**:
    - Add loading spinners for API requests.
    - Improve error messages to be more user-friendly.
5. **Testing**:
    - Add unit tests for backend routes using Jest.
    - Add end-to-end tests for frontend workflows using Cypress.
6. **Performance**:
    - Optimize database queries (e.g., add indexes on frequently queried columns like tasks.project_id).
    - Cache frequently accessed data (e.g., using Redis).

---

## Troubleshooting

### Common Issues

1. **"Invalid line ID or team member ID" Error**:
    - **Cause**: The line ID or team member ID does not exist in the database, or the team member is not under the current Team Lead.
    - **Solution**:
        - Verify the line ID exists: SELECT * FROM lines WHERE id = <lineId>;.
        - Verify the team member exists and is under the Team Lead: SELECT * FROM team_members WHERE member_id = <userId> AND lead_id = <teamLeadId>;.
        - Ensure the GET /api/users/team-members endpoint filters by lead_id.
2. **"Failed to fetch lines" (404 Error)**:
    - **Cause**: The API endpoint does not exist (e.g., GET /api/lines).
    - **Solution**:
        - Ensure the correct endpoint is called (e.g., GET /api/lines/assigned for Team Members).
        - Add the missing endpoint in lines.routes.js if needed.
3. **Tasks Not Filtering by Project**:
    - **Cause**: Existing tasks have project_id = NULL.
    - **Solution**:
        - Populate project_id using task_items or assign a default project: UPDATE tasks SET project_id = 5 WHERE project_id IS NULL;.

### Debugging Tips

- **Frontend**:
    - Add console logs in functions like fetchLines, fetchTasks, and handleAssign to trace data flow.
    - Check the browser’s Network tab for API request details and responses.
- **Backend**:
    - Add console logs in API routes to log incoming requests and query results.
    - Check the server logs for errors (e.g., database connection issues).
- **Database**:
    - Use pgAdmin or DBeaver to run queries and verify data (e.g., SELECT * FROM lines WHERE assigned_to_id = <userId>;).

---

## Contributors

- **Developer**: [Your Name] (responsible for system design, implementation, and debugging).
- **Stakeholders**: Engineering team, project managers, and team leads who provided requirements and feedback.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---