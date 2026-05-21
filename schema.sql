-- mysql -u USER -p < schema.sql
--
-- Tables ↔ src/config/env.js (API_PATHS):
--   users          → LOGIN, USER_ME, USERS_LIST, DASHBOARD_USERS, SUPERADMIN_DASHBOARD,
--                    userDetail, allUserDetail, ADD_USERS, updateUser, updateUserRole, deleteUser
--   projects       → PROJECTS_LIST, projectDetail, ADD_PROJECT, updateProject, deleteProject,
--                    PROJECTS_PUBLIC_LIST (/api/projectdashboard, /api/project_public_dashboard)
--                    fields: project_name, api_dashboard, public_api (+ project_link, details, …)
--   team_members   → teammemberdashboard, teammember_public_dashboard, teammemberall/:id,
--                    add_teammember, update_teammember/:id, delete_teammember/:id (+ mem_photo)
--   blogs          → BLOGS_LIST, blogDetail, ADD_BLOG, updateBlog, deleteBlog
--   contacts       → SAVE_CONTACTS, CONTACTS_LIST, deleteContact
--   invoices       → INVOICES_LIST, invoiceDetail, invoiceGenerate, ADD_INVOICE,
--                    updateInvoice, deleteInvoice
--   companyinfo    → COMPANYINFO_LIST, companyinfoDetail, ADD_COMPANYINFO,
--                    updateCompanyInfo, deleteCompanyInfo
--   clients        → clientdashboard, client_public_dashboard, clientall/:id,
--                    add_client / addclient, update_client / updateclient, delete_client / deleteclient
--   (filesystem)   → UPLOAD (JWT required; files under uploads/, URL /uploads/…)

CREATE DATABASE IF NOT EXISTS urbanx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE urbanx;

CREATE TABLE IF NOT EXISTS users (
  user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(190) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(32) NOT NULL DEFAULT 'admin',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  project_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_name VARCHAR(255) NOT NULL DEFAULT '',
  date DATE NULL,
  project_details TEXT,
  project_link VARCHAR(1024) NOT NULL DEFAULT '',
  api_dashboard VARCHAR(2048) NOT NULL DEFAULT '',
  public_api VARCHAR(2048) NOT NULL DEFAULT '',
  img_url VARCHAR(2048) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'incoming',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_members (
  member_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_name VARCHAR(255) NOT NULL DEFAULT '',
  mem_phone VARCHAR(64) NOT NULL DEFAULT '',
  mem_designation VARCHAR(255) NOT NULL DEFAULT '',
  mem_description TEXT,
  mem_mail VARCHAR(190) NOT NULL DEFAULT '',
  details TEXT,
  mem_photo VARCHAR(2048) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id),
  KEY idx_team_members_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blogs (
  blog_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  blog_title VARCHAR(255) NOT NULL DEFAULT '',
  date DATE NULL,
  blog_content TEXT,
  blog_link VARCHAR(1024) NOT NULL DEFAULT '',
  img_url VARCHAR(2048) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'incoming',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blog_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  contact_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contact_id),
  KEY idx_contacts_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  client_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  phone VARCHAR(64) NOT NULL DEFAULT '',
  company VARCHAR(255) NOT NULL DEFAULT '',
  address TEXT,
  notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id),
  KEY idx_clients_created (created_at),
  KEY idx_clients_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_no VARCHAR(64) NULL,
  own_com_name VARCHAR(255) NOT NULL DEFAULT '',
  own_com_title VARCHAR(255) NOT NULL DEFAULT '',
  own_com_logo VARCHAR(2048) NOT NULL DEFAULT '',
  client_name VARCHAR(255) NOT NULL DEFAULT '',
  client_id VARCHAR(128) NOT NULL DEFAULT '',
  client_company VARCHAR(255) NOT NULL DEFAULT '',
  client_phone VARCHAR(64) NOT NULL DEFAULT '',
  client_address TEXT,
  unit_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
  billing_description TEXT,
  invoice_date DATE NULL,
  subtotal DECIMAL(14, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(8, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (invoice_id),
  UNIQUE KEY uk_invoices_invoice_no (invoice_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS companyinfo (
  com_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  own_com_name VARCHAR(255) NOT NULL DEFAULT '',
  own_com_title VARCHAR(255) NOT NULL DEFAULT '',
  own_com_logo VARCHAR(2048) NOT NULL DEFAULT '',
  address VARCHAR(512) NOT NULL DEFAULT '',
  phone VARCHAR(64) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (com_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
