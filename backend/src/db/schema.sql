
-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Data Entry', 'Team Member', 'Team Lead', 'Project Manager', 'Admin'))
);

-- Create projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create areas table
CREATE TABLE areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE
);

-- Create PIDs table
CREATE TABLE pids (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE
);

-- Create lines table
CREATE TABLE lines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  pid_id INTEGER REFERENCES pids(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'Assigned' CHECK (status IN ('Assigned', 'In Progress', 'Completed'))
);

-- Create equipment table
CREATE TABLE equipment (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'Assigned' CHECK (status IN ('Assigned', 'In Progress', 'Completed'))
);

-- Create tasks table
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Redline', 'UPV', 'QC')),
  assignee_id INTEGER REFERENCES users(id),
  status VARCHAR(50) NOT NULL CHECK (status IN ('Assigned', 'In Progress', 'Completed')),
  is_complex BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  progress INTEGER NOT NULL DEFAULT 0
);

-- Create task items table
CREATE TABLE task_items (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('PID', 'Line', 'Equipment')),
  completed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create team_members junction table to associate leads with members
CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES users(id),
  member_id INTEGER REFERENCES users(id),
  UNIQUE(lead_id, member_id)
);

-- Create task comments table
CREATE TABLE task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_areas_project_id ON areas(project_id);
CREATE INDEX idx_pids_area_id ON pids(area_id);
CREATE INDEX idx_lines_pid_id ON lines(pid_id);
CREATE INDEX idx_equipment_area_id ON equipment(area_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_task_items_task_id ON task_items(task_id);
CREATE INDEX idx_team_members_lead_id ON team_members(lead_id);
CREATE INDEX idx_team_members_member_id ON team_members(member_id);
CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_user_id ON task_comments(user_id);
