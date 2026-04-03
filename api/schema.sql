-- Joblynk Database Schema
-- Run this in HeidiSQL or phpMyAdmin to create the database and tables.

CREATE DATABASE IF NOT EXISTS `joblynk` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `joblynk`;

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `company_id` INT NULL,
    `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
    `role` ENUM('job_seeker', 'recruiter', 'admin') NOT NULL DEFAULT 'job_seeker',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Email verifications & password reset tokens
CREATE TABLE IF NOT EXISTS `email_verifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `token` VARCHAR(64) NOT NULL UNIQUE,
    `type` ENUM('verification', 'password_reset') NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Companies table
CREATE TABLE IF NOT EXISTS `companies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `industry` VARCHAR(100),
    `size` VARCHAR(50),
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Add foreign key to users for company
ALTER TABLE `users`
ADD CONSTRAINT `fk_company`
FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL;

-- Payments/Subscriptions table
CREATE TABLE IF NOT EXISTS `payments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `payfast_payment_id` VARCHAR(255) NOT NULL UNIQUE,
    `amount` DECIMAL(10,2) NOT NULL,
    `package_id` VARCHAR(50) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'success',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Documents (CVs & Cover Letters)
CREATE TABLE IF NOT EXISTS `documents` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `doc_type` ENUM('cv', 'cl') NOT NULL,
    `name` VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    `accent_color` VARCHAR(20) DEFAULT '#3B4BA6',
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Jobs
CREATE TABLE IF NOT EXISTS `jobs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL COMMENT 'Recruiter who posted',
    `title` VARCHAR(255) NOT NULL,
    `company` VARCHAR(255) NOT NULL,
    `location` VARCHAR(255) DEFAULT '',
    `type` VARCHAR(50) DEFAULT 'Full-time',
    `description` TEXT,
    `requirements` TEXT,
    `skills` VARCHAR(500) DEFAULT '',
    `salary_from` VARCHAR(50) DEFAULT '',
    `salary_to` VARCHAR(50) DEFAULT '',
    `salary_period` VARCHAR(50) DEFAULT 'Per Month',
    `benefits` JSON NULL,
    `closing_date` DATE NULL,
    `custom_fields` TEXT NULL,
    `status` ENUM('active', 'closed', 'draft') NOT NULL DEFAULT 'active',
    `color` VARCHAR(20) DEFAULT '#3B4BA6',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Applications
CREATE TABLE IF NOT EXISTS `applications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `job_id` INT NOT NULL,
    `user_id` INT NOT NULL COMMENT 'Job seeker who applied',
    `cv_id` INT NULL,
    `cl_id` INT NULL,
    `applicant_name` VARCHAR(255) DEFAULT '',
    `note` TEXT,
    `form_responses` TEXT NULL,
    `status` ENUM('submitted', 'reviewed', 'shortlisted', 'rejected') NOT NULL DEFAULT 'submitted',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`cv_id`) REFERENCES `documents`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`cl_id`) REFERENCES `documents`(`id`) ON DELETE SET NULL,
    UNIQUE KEY `unique_application` (`job_id`, `user_id`)
) ENGINE=InnoDB;

-- Job Credits (activated after PayFast payment)
CREATE TABLE IF NOT EXISTS `job_credits` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `payment_id` INT NULL,
    `package_id` VARCHAR(50) NOT NULL,
    `total_credits` INT NOT NULL DEFAULT 1,
    `used_credits` INT NOT NULL DEFAULT 0,
    `purchased_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;
