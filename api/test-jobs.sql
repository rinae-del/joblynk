-- Optional JobLynk public jobs seed data.
-- Run after api/schema.sql when you want realistic listings for jobs.html testing.

USE `joblynk`;

INSERT INTO `companies` (`name`, `industry`, `size`, `city`, `province`, `country`)
SELECT 'JobLynk Test Talent', 'Recruitment', '10-50', 'Johannesburg', 'Gauteng', 'South Africa'
WHERE NOT EXISTS (SELECT 1 FROM `companies` WHERE `name` = 'JobLynk Test Talent');

SET @joblynk_test_company_id := (SELECT `id` FROM `companies` WHERE `name` = 'JobLynk Test Talent' ORDER BY `id` LIMIT 1);

INSERT INTO `users` (`first_name`, `last_name`, `email`, `phone`, `password_hash`, `role`, `company_id`, `email_verified`)
SELECT 'Sarah', 'Jenkins', 'testrecruiter@example.com', '+27 11 555 0199', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/wup6ASLPFfY/2O', 'recruiter', @joblynk_test_company_id, 1
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `email` = 'testrecruiter@example.com');

UPDATE `users`
SET `first_name` = 'Sarah',
    `last_name` = 'Jenkins',
    `role` = 'recruiter',
    `company_id` = @joblynk_test_company_id,
    `email_verified` = 1
WHERE `email` = 'testrecruiter@example.com';

SET @joblynk_test_recruiter_id := (SELECT `id` FROM `users` WHERE `email` = 'testrecruiter@example.com' LIMIT 1);

DELETE FROM `jobs` WHERE `user_id` = @joblynk_test_recruiter_id;
DELETE FROM `job_credits` WHERE `user_id` = @joblynk_test_recruiter_id;
DELETE FROM `payments` WHERE `user_id` = @joblynk_test_recruiter_id AND `payfast_payment_id` = 'sql_joblynk_seed';

INSERT INTO `payments` (`user_id`, `payfast_payment_id`, `amount`, `package_id`, `status`)
VALUES (@joblynk_test_recruiter_id, 'sql_joblynk_seed', 3900.00, '5job', 'success');

SET @joblynk_test_payment_id := LAST_INSERT_ID();

INSERT INTO `job_credits` (`user_id`, `payment_id`, `package_id`, `total_credits`, `used_credits`, `expires_at`)
VALUES (@joblynk_test_recruiter_id, @joblynk_test_payment_id, '5job', 25, 12, DATE_ADD(NOW(), INTERVAL 90 DAY));

INSERT INTO `jobs` (`user_id`, `title`, `company`, `location`, `type`, `description`, `requirements`, `skills`, `salary_from`, `salary_to`, `salary_period`, `benefits`, `closing_date`, `status`, `color`) VALUES
(@joblynk_test_recruiter_id, 'Junior Data Analyst', 'DataTech Solutions', 'Johannesburg, GP', 'Full-time', 'Clean weekly hiring data, prepare dashboards, and support managers with practical reports.', 'Advanced Excel, basic SQL, clear communication, and an eye for detail.', 'Excel, SQL, Reporting, Data Analysis', '18000', '24000', 'Per Month', '["Medical Aid","Hybrid Work","Training Budget"]', '2026-06-12', 'active', '#2563EB'),
(@joblynk_test_recruiter_id, 'Customer Support Consultant', 'BrightDesk SA', 'Cape Town, WC', 'Full-time', 'Support customers across email, chat, and phone while tracking service quality and common issues.', 'Customer service experience, strong written communication, and CRM confidence.', 'Customer Service, CRM, Email Management, Communication', '14000', '19000', 'Per Month', '["Transport Allowance","Performance Bonus"]', '2026-06-18', 'active', '#059669'),
(@joblynk_test_recruiter_id, 'Payroll Administrator', 'FinVault', 'Durban, KZN', 'Full-time', 'Process monthly payroll, maintain employee records, and support payroll reporting for finance.', 'Payroll experience, Excel confidence, and knowledge of South African payroll requirements.', 'Payroll, Excel, Accounting, Administration', '22000', '30000', 'Per Month', '["Medical Aid","Pension Fund"]', '2026-06-22', 'active', '#7C3AED'),
(@joblynk_test_recruiter_id, 'Warehouse Supervisor', 'GreenLeaf Logistics', 'Johannesburg, GP', 'Full-time', 'Lead receiving, picking, dispatch, and stock accuracy for a busy distribution operation.', 'Warehouse supervision experience, stock control, and health and safety awareness.', 'Stock Control, Warehousing, Supervision, Health and Safety', '20000', '28000', 'Per Month', '["Overtime Pay","Transport Allowance"]', '2026-06-25', 'active', '#16A34A'),
(@joblynk_test_recruiter_id, 'Procurement Coordinator', 'GreenLeaf Logistics', 'Pretoria, GP', 'Full-time', 'Coordinate supplier quotes, purchase orders, and delivery follow ups for operations teams.', 'Procurement administration experience and strong spreadsheet skills.', 'Procurement, Supplier Management, Excel, Administration', '24000', '34000', 'Per Month', '["Medical Aid","Annual Bonus"]', '2026-07-03', 'active', '#65A30D'),
(@joblynk_test_recruiter_id, 'Cloud Support Engineer', 'DataTech Solutions', 'Remote', 'Full-time', 'Resolve cloud platform tickets, document fixes, and support client infrastructure monitoring.', 'Linux basics, networking knowledge, and experience with AWS or Azure support.', 'Cloud Computing, Linux, Technical Support, Networking', '32000', '46000', 'Per Month', '["Remote Work","Learning Budget","Home Office Support"]', '2026-07-08', 'active', '#0891B2'),
(@joblynk_test_recruiter_id, 'Product Designer', 'Mzansi Media Group', 'Cape Town, WC', 'Contract', 'Design clean product journeys, prototypes, and handoff files for digital product teams.', 'Portfolio with mobile and web product work, Figma, and user research experience.', 'Figma, UI/UX Design, User Research, Prototyping', '280', '420', 'Per Hour', '["Remote Work","Flexible Hours"]', '2026-06-30', 'active', '#EC4899'),
(@joblynk_test_recruiter_id, 'Digital Campaign Manager', 'Mzansi Media Group', 'Remote', 'Full-time', 'Plan and optimise paid social, search, and email campaigns for South African brands.', 'Campaign management experience, analytics confidence, and strong client communication.', 'Digital Marketing, SEO, Google Ads, Analytics', '30000', '42000', 'Per Month', '["Remote Work","Creative Leave"]', '2026-07-15', 'active', '#F59E0B'),
(@joblynk_test_recruiter_id, 'Registered Nurse Theatre', 'HealthBridge SA', 'Pretoria, GP', 'Full-time', 'Join a theatre team supporting scheduled procedures, patient care, and clinical records.', 'SANC registration, theatre experience, and strong patient care standards.', 'Patient Care, Theatre Nursing, Clinical Records, Teamwork', '28000', '38000', 'Per Month', '["Medical Aid","Shift Allowance","Study Assistance"]', '2026-06-28', 'active', '#0D9488'),
(@joblynk_test_recruiter_id, 'Health Data Capturer', 'HealthBridge SA', 'Bloemfontein, FS', 'Full-time', 'Capture patient records, validate source documents, and support health reporting workflows.', 'Accurate typing, data capturing experience, and confidentiality awareness.', 'Data Capturing, Administration, Attention to Detail, Excel', '12000', '17000', 'Per Month', '["Medical Aid","Training Provided"]', '2026-07-01', 'active', '#14B8A6'),
(@joblynk_test_recruiter_id, 'Maintenance Electrician', 'UrbanWorks Facilities', 'Durban, KZN', 'Full-time', 'Maintain electrical systems, respond to breakdowns, and complete planned site inspections.', 'Trade test, maintenance experience, and valid drivers licence.', 'Electrical Maintenance, Inspection, Troubleshooting, Safety Compliance', '26000', '36000', 'Per Month', '["Travel Allowance","On-call Allowance"]', '2026-06-20', 'active', '#D97706'),
(@joblynk_test_recruiter_id, 'Recruitment Administrator', 'JobLynk Test Talent', 'Johannesburg, GP', 'Part-time', 'Coordinate interview bookings, update candidate records, and support recruiter communication.', 'Administration experience, calendar management, and professional communication.', 'Recruitment, Calendar Management, CRM, Email Management', '120', '180', 'Per Hour', '["Flexible Hours","Hybrid Work"]', '2026-07-10', 'active', '#6366F1');