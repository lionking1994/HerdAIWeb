-- Insert Skills into psa_skills table
INSERT INTO psa_skills (id, name, category, description, is_active, is_deleted, created_at, updated_at) VALUES
('1', 'React', 'Frontend', 'React.js framework', true, false, NOW(), NOW()),
('2', 'Node.js', 'Backend', 'Server-side JavaScript', true, false, NOW(), NOW()),
('3', 'PostgreSQL', 'Database', 'Relational database', true, false, NOW(), NOW()),
('4', 'AWS', 'Cloud', 'Amazon Web Services', true, false, NOW(), NOW()),
('5', 'Python', 'Backend', 'Python programming', true, false, NOW(), NOW()),
('6', 'Project Management', 'Management', 'Project coordination', true, false, NOW(), NOW()),
('7', 'Agile/Scrum', 'Methodology', 'Agile methodologies', true, false, NOW(), NOW()),
('8', 'Data Analysis', 'Analytics', 'Data analysis and reporting', true, false, NOW(), NOW());

-- Insert Certifications into psa_certifications table
INSERT INTO psa_certifications (id, name, issuing_organization, description, validity_period_months, is_active, is_deleted, created_at, updated_at) VALUES
('1', 'PMP', 'PMI', 'Project Management Professional', 36, true, false, NOW(), NOW()),
('2', 'AWS Solutions Architect', 'Amazon', 'AWS cloud architecture', 24, true, false, NOW(), NOW()),
('3', 'Certified Scrum Master', 'Scrum Alliance', 'Agile methodology', 24, true, false, NOW(), NOW()),
('4', 'React Developer', 'Meta', 'React framework expertise', 12, true, false, NOW(), NOW());
