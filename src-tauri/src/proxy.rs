//! 代理支持模块
//! 提供 SOCKS5 和 HTTP 代理配置

#![allow(dead_code)]

use anyhow::{anyhow, Result};
use reqwest::{Client, Proxy};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// 代理类型
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProxyType {
    None,
    Socks5,
    Http,
}

impl Default for ProxyType {
    fn default() -> Self {
        ProxyType::None
    }
}

impl From<&str> for ProxyType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "socks5" => ProxyType::Socks5,
            "http" => ProxyType::Http,
            _ => ProxyType::None,
        }
    }
}

impl From<Option<String>> for ProxyType {
    fn from(s: Option<String>) -> Self {
        s.map(|s| ProxyType::from(s.as_str()))
            .unwrap_or(ProxyType::None)
    }
}

/// 代理配置
#[derive(Debug, Clone, Default)]
pub struct ProxyConfig {
    pub proxy_type: ProxyType,
    pub proxy_url: Option<String>,
}

impl ProxyConfig {
    /// 创建新的代理配置
    pub fn new(proxy_type: ProxyType, proxy_url: Option<String>) -> Self {
        Self {
            proxy_type,
            proxy_url,
        }
    }

    /// 从数据库字段创建
    pub fn from_db(proxy_type: Option<String>, proxy_url: Option<String>) -> Self {
        Self {
            proxy_type: ProxyType::from(proxy_type),
            proxy_url,
        }
    }

    /// 检查是否启用代理
    pub fn is_enabled(&self) -> bool {
        self.proxy_type != ProxyType::None && self.proxy_url.is_some()
    }
}

/// 创建带代理的 HTTP 客户端
pub fn create_http_client(config: &ProxyConfig, timeout_secs: u64) -> Result<Client> {
    let mut builder = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .connect_timeout(Duration::from_secs(30));

    if config.is_enabled() {
        let proxy_url = config
            .proxy_url
            .as_ref()
            .ok_or_else(|| anyhow!("代理 URL 未配置"))?;

        let proxy = match config.proxy_type {
            ProxyType::Socks5 => {
                // SOCKS5 代理格式: socks5://host:port 或 socks5://user:pass@host:port
                Proxy::all(proxy_url)?
            }
            ProxyType::Http => {
                // HTTP 代理格式: http://host:port 或 http://user:pass@host:port
                Proxy::all(proxy_url)?
            }
            ProxyType::None => {
                return Ok(builder.build()?);
            }
        };

        builder = builder.proxy(proxy);
    }

    Ok(builder.build()?)
}

/// 创建不带代理的默认 HTTP 客户端
pub fn create_default_client(timeout_secs: u64) -> Result<Client> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .connect_timeout(Duration::from_secs(30))
        .build()?;

    Ok(client)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proxy_type_from_str() {
        assert_eq!(ProxyType::from("socks5"), ProxyType::Socks5);
        assert_eq!(ProxyType::from("SOCKS5"), ProxyType::Socks5);
        assert_eq!(ProxyType::from("http"), ProxyType::Http);
        assert_eq!(ProxyType::from("HTTP"), ProxyType::Http);
        assert_eq!(ProxyType::from("none"), ProxyType::None);
        assert_eq!(ProxyType::from("invalid"), ProxyType::None);
    }

    #[test]
    fn test_proxy_config_is_enabled() {
        let config = ProxyConfig::new(ProxyType::None, None);
        assert!(!config.is_enabled());

        let config = ProxyConfig::new(
            ProxyType::Socks5,
            Some("socks5://127.0.0.1:1080".to_string()),
        );
        assert!(config.is_enabled());

        let config = ProxyConfig::new(ProxyType::Socks5, None);
        assert!(!config.is_enabled());
    }
}
