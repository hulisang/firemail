-- 创建邮箱表
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    mail_type TEXT DEFAULT 'outlook',
    server TEXT,
    port INTEGER,
    use_ssl INTEGER DEFAULT 1,
    client_id TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    api_mode TEXT DEFAULT 'imap',
    proxy_type TEXT DEFAULT 'none',
    proxy_url TEXT,
    cached_token TEXT,
    token_expires_at TIMESTAMP,
    default_folder TEXT DEFAULT 'INBOX',
    last_check_time TIMESTAMP,
    enable_realtime_check INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建邮件记录表
CREATE TABLE IF NOT EXISTS mail_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    subject TEXT,
    sender TEXT,
    received_time TIMESTAMP,
    content TEXT,
    folder TEXT,
    has_attachments INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
);

-- 创建附件表
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mail_id INTEGER NOT NULL,
    filename TEXT,
    content_type TEXT,
    size INTEGER,
    content BLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mail_id) REFERENCES mail_records (id) ON DELETE CASCADE
);

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
