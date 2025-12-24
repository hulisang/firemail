//! Token 缓存模块
//! 提供 access_token 的内存缓存和数据库持久化功能

#![allow(dead_code)]

use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use sqlx::{Pool, Sqlite};
use std::collections::HashMap;
use std::sync::RwLock;

/// 内存缓存结构
static TOKEN_CACHE: RwLock<Option<HashMap<i64, CachedToken>>> = RwLock::new(None);

/// 缓存的 Token 信息
#[derive(Clone, Debug)]
pub struct CachedToken {
    pub access_token: String,
    pub expires_at: DateTime<Utc>,
}

impl CachedToken {
    /// 检查 Token 是否已过期
    pub fn is_expired(&self) -> bool {
        // 提前 60 秒认为过期，留出刷新缓冲时间
        Utc::now() + Duration::seconds(60) >= self.expires_at
    }
}

/// 初始化缓存
fn init_cache() {
    let mut cache = TOKEN_CACHE.write().unwrap();
    if cache.is_none() {
        *cache = Some(HashMap::new());
    }
}

/// 从内存缓存获取 Token
pub fn get_cached_token_memory(email_id: i64) -> Option<CachedToken> {
    init_cache();
    let cache = TOKEN_CACHE.read().unwrap();
    if let Some(ref map) = *cache {
        if let Some(token) = map.get(&email_id) {
            if !token.is_expired() {
                return Some(token.clone());
            }
        }
    }
    None
}

/// 设置内存缓存 Token
pub fn set_cached_token_memory(email_id: i64, access_token: String, expires_in_secs: i64) {
    init_cache();
    let mut cache = TOKEN_CACHE.write().unwrap();
    if let Some(ref mut map) = *cache {
        let expires_at = Utc::now() + Duration::seconds(expires_in_secs);
        map.insert(
            email_id,
            CachedToken {
                access_token,
                expires_at,
            },
        );
    }
}

/// 从数据库获取缓存的 Token
pub async fn get_cached_token_db(
    pool: &Pool<Sqlite>,
    email_id: i64,
) -> Result<Option<CachedToken>> {
    let row = sqlx::query_as::<_, (Option<String>, Option<String>)>(
        "SELECT cached_token, token_expires_at FROM emails WHERE id = ?",
    )
    .bind(email_id)
    .fetch_one(pool)
    .await?;

    if let (Some(token), Some(expires_str)) = row {
        if let Ok(expires_at) = DateTime::parse_from_rfc3339(&expires_str) {
            let cached = CachedToken {
                access_token: token,
                expires_at: expires_at.with_timezone(&Utc),
            };
            if !cached.is_expired() {
                return Ok(Some(cached));
            }
        }
    }

    Ok(None)
}

/// 保存 Token 到数据库
pub async fn set_cached_token_db(
    pool: &Pool<Sqlite>,
    email_id: i64,
    access_token: &str,
    expires_in_secs: i64,
) -> Result<()> {
    let expires_at = Utc::now() + Duration::seconds(expires_in_secs);
    let expires_str = expires_at.to_rfc3339();

    sqlx::query(
        "UPDATE emails SET cached_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(access_token)
    .bind(&expires_str)
    .bind(email_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// 获取有效的 Token（优先内存缓存，其次数据库，都无效则返回 None）
pub async fn get_valid_token(pool: &Pool<Sqlite>, email_id: i64) -> Result<Option<String>> {
    // 1. 优先从内存缓存获取
    if let Some(cached) = get_cached_token_memory(email_id) {
        return Ok(Some(cached.access_token));
    }

    // 2. 从数据库获取
    if let Some(cached) = get_cached_token_db(pool, email_id).await? {
        // 同步到内存缓存
        let remaining_secs = (cached.expires_at - Utc::now()).num_seconds();
        if remaining_secs > 0 {
            set_cached_token_memory(email_id, cached.access_token.clone(), remaining_secs);
        }
        return Ok(Some(cached.access_token));
    }

    Ok(None)
}

/// 缓存新 Token（同时写入内存和数据库）
pub async fn cache_token(
    pool: &Pool<Sqlite>,
    email_id: i64,
    access_token: &str,
    expires_in_secs: i64,
) -> Result<()> {
    // 写入内存缓存
    set_cached_token_memory(email_id, access_token.to_string(), expires_in_secs);

    // 写入数据库
    set_cached_token_db(pool, email_id, access_token, expires_in_secs).await?;

    Ok(())
}

/// 清除指定邮箱的 Token 缓存
pub fn clear_token_cache(email_id: i64) {
    init_cache();
    let mut cache = TOKEN_CACHE.write().unwrap();
    if let Some(ref mut map) = *cache {
        map.remove(&email_id);
    }
}
