CREATE DATABASE bikini DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;

use bikini;

CREATE TABLE IF NOT EXISTS category (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  status tinyint DEFAULT '1' COMMENT 'Trạng thái o là ẩn, 1 là hiện',
  delete_at date null,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS brand (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  status tinyint DEFAULT '1' COMMENT 'Trạng thái o là ẩn, 1 là hiện',
  logo varchar(200) null,
  delete_at date null,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS product (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  image VARCHAR(200) NULL,
  price float NOT NULL,
  sale_price float DEFAULT '0',
  image_list text NULL,
  status tinyint DEFAULT '1' COMMENT 'Trạng thái o là ẩn, 1 là hiện',
  category_id int NOT NULL,
  brand_id int NOT NULL,
  delete_at date null,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  FOREIGN KEY (category_id) REFERENCES category(id),
  FOREIGN KEY (brand_id) REFERENCES brand(id)
) ENGINE = InnoDB;

INSERT INTO category SET name = 'Áo nam', status = 1;
INSERT INTO category SET name = 'Áo bả', status = 0;
INSERT INTO category SET name = 'Áo em', status = 1;
INSERT INTO category SET name = 'Áo bố', status = 1;
INSERT INTO category SET name = 'Áo mẹ', status = 1;
INSERT INTO category SET name = 'Áo ông', status = 1;
INSERT INTO category SET name = 'Áo cháu', status = 1;
