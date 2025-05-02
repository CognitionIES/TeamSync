
-- Create test users with bcrypted passwords (actual password is 'password')
INSERT INTO users (name, password, role) VALUES
-- Data Entry users
('Alice', '$2a$10$xVrIr4AfXEDMWOiGx6hrK.8e6E8X5aGZiVn.dY4KS62iUj2YF5vKa', 'Data Entry'),
('Bob', '$2a$10$xVrIr4AfXEDMWOiGx6hrK.8e6E8X5aGZiVn.dY4KS62iUj2YF5vKa', 'Data Entry'),

-- Team Members
('Charlie', '$2a$10$xVrIr4AfXEDMWOiGx6hrK.8e6E8X5aGZiVn.dY4KS62iUj2YF5vKa', 'Team Member'),
('David', '$2a$10$xVrIr4AfXEDMWOiGx6hrK.8e6E8X5aGZiVn.dY4KS62iUj2YF5vKa', 'Team Member'),
('Eve', '$2a$10$xVrIr4AfXEDMWOiGx6hrK.8e6E8X5aGZiVn.dY4KS62iUj2YF5vKa', 'Team Member'),

-- Team Leads
('Frank', '$2a$10$xVrIr4AfXEDMWOiGx6hrK.8e6E8X5aGZiVn.dY4KS62iUj2YF5vKa', 'Team Lead'),
('Grace', '$2a$10$xVrIr4AfXEDMWOiGx6hrK.8e6E8X5aGZiVn.dY4KS62iUj2YF5vKa', 'Team Lead'),

-- Project Managers
('Hannah', '$2a$10$xVrIr4AfXEDMWOiGx6hrK.8e6E8X5aGZiVn.dY4KS62iUj2YF5vKa', 'Project Manager'),

-- Admin
('Ian', '$2a$10$xVrIr4AfXEDMWOiGx6hrK.8e6E8X5aGZiVn.dY4KS62iUj2YF5vKa', 'Admin');

-- Create sample projects
INSERT INTO projects (name) VALUES
('North Sea Platform'),
('Gulf Refinery Expansion'),
('Arctic Processing Facility');

-- Create sample areas for Project 1
INSERT INTO areas (name, project_id) VALUES
('Process Unit A', 1),
('Storage Area B', 1),
('Utility Unit C', 1);

-- Create sample PIDs for Area 1
INSERT INTO pids (name, area_id) VALUES
('P-101', 1),
('P-102', 1);

-- Create sample lines for PID 1
INSERT INTO lines (name, pid_id, status) VALUES
('L-101-A', 1, 'Assigned'),
('L-101-B', 1, 'In Progress'),
('L-101-C', 1, 'Completed');

-- Create sample lines for PID 2
INSERT INTO lines (name, pid_id, status) VALUES
('L-102-A', 2, 'Assigned'),
('L-102-B', 2, 'Assigned');

-- Create sample equipment for Area 1
INSERT INTO equipment (name, area_id, status) VALUES
('Pump P-001', 1, 'Assigned'),
('Tank T-001', 1, 'In Progress'),
('Vessel V-001', 1, 'Completed');

-- Set up team member relationships
INSERT INTO team_members (lead_id, member_id) VALUES
(6, 3), -- Frank manages Charlie
(6, 4), -- Frank manages David
(7, 5); -- Grace manages Eve

-- Create sample tasks
INSERT INTO tasks (type, assignee_id, status, is_complex, created_at, updated_at, completed_at, progress) VALUES
-- Charlie's tasks
('Redline', 3, 'Assigned', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 0),
('UPV', 3, 'In Progress', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 50),

-- David's tasks
('Redline', 4, 'In Progress', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 25),
('QC', 4, 'Completed', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 100),

-- Eve's tasks
('UPV', 5, 'Assigned', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 0),
('QC', 5, 'In Progress', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 75);

-- Create sample task items for the above tasks
INSERT INTO task_items (task_id, name, type, completed) VALUES
-- Task 1 items (Charlie's Redline)
(1, 'P-101', 'PID', false),

-- Task 2 items (Charlie's UPV)
(2, 'L-101-A', 'Line', true),
(2, 'L-101-B', 'Line', true),
(2, 'L-101-C', 'Line', false),

-- Task 3 items (David's Redline)
(3, 'P-102', 'PID', false),

-- Task 4 items (David's QC)
(4, 'Pump P-001', 'Equipment', true),
(4, 'Tank T-001', 'Equipment', true),

-- Task 5 items (Eve's UPV)
(5, 'L-102-A', 'Line', false),
(5, 'L-102-B', 'Line', false),

-- Task 6 items (Eve's QC)
(6, 'Vessel V-001', 'Equipment', true),
(6, 'L-101-C', 'Line', true),
(6, 'L-102-A', 'Line', false);
