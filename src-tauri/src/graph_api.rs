//! Microsoft Graph API 模块
//! 通过 Graph API 获取邮件（相比 IMAP 更稳定）

#![allow(dead_code)]

use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::Deserialize;

use crate::proxy::{create_http_client, ProxyConfig};

/// Graph API Token 响应
#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    expires_in: Option<i64>,
    error: Option<String>,
    error_description: Option<String>,
}

/// Graph API 邮件响应
#[derive(Debug, Deserialize)]
struct MailListResponse {
    value: Vec<GraphMail>,
    #[serde(rename = "@odata.nextLink")]
    next_link: Option<String>,
}

/// Graph API 邮件对象
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphMail {
    id: String,
    subject: Option<String>,
    body_preview: Option<String>,
    body: Option<MailBody>,
    from: Option<MailAddress>,
    created_date_time: Option<String>,
    received_date_time: Option<String>,
    has_attachments: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MailBody {
    content_type: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MailAddress {
    email_address: Option<EmailAddress>,
}

#[derive(Debug, Deserialize)]
struct EmailAddress {
    name: Option<String>,
    address: Option<String>,
}

/// Graph API 附件响应
#[derive(Debug, Deserialize)]
struct AttachmentListResponse {
    value: Vec<GraphAttachment>,
}

/// Graph API 附件对象
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphAttachment {
    id: String,
    name: Option<String>,
    content_type: Option<String>,
    size: Option<i64>,
    content_bytes: Option<String>,
}

/// 抓取到的邮件记录（与 IMAP 模块共用）
#[derive(Debug)]
pub struct GraphMailRecord {
    pub subject: Option<String>,
    pub sender: Option<String>,
    pub received_time: Option<String>,
    pub content: String,
    pub folder: String,
    pub attachments: Vec<GraphAttachmentData>,
}

/// 附件数据
#[derive(Debug)]
pub struct GraphAttachmentData {
    pub filename: String,
    pub content_type: String,
    pub content: Vec<u8>,
}

/// Graph API Token 结果
pub struct GraphTokenResult {
    pub access_token: String,
    pub expires_in: i64,
}

/// 刷新 Graph API Token
pub async fn refresh_graph_token(
    client_id: &str,
    refresh_token: &str,
    proxy_config: &ProxyConfig,
) -> Result<GraphTokenResult> {
    let client = create_http_client(proxy_config, 30)?;

    let response: TokenResponse = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("client_id", client_id),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("scope", "https://graph.microsoft.com/.default"),
        ])
        .send()
        .await?
        .json()
        .await?;

    if let Some(token) = response.access_token {
        let expires_in = response.expires_in.unwrap_or(3600);
        return Ok(GraphTokenResult {
            access_token: token,
            expires_in,
        });
    }

    let error = response.error.unwrap_or_else(|| "未知错误".to_string());
    let description = response
        .error_description
        .unwrap_or_else(|| "未知错误描述".to_string());
    Err(anyhow!(
        "Graph API Token 刷新失败: {} - {}",
        error,
        description
    ))
}

/// 转换文件夹名称为 Graph API 格式
fn normalize_folder_name(folder: &str) -> &str {
    match folder.to_lowercase().as_str() {
        "inbox" => "inbox",
        "junk" | "spam" | "junkemail" => "junkemail",
        "sent" | "sentitems" => "sentitems",
        "drafts" => "drafts",
        "deleted" | "deleteditems" | "trash" => "deleteditems",
        "archive" => "archive",
        _ => "inbox",
    }
}

/// 通过 Graph API 获取邮件
pub async fn fetch_via_graph(
    access_token: &str,
    folder: &str,
    top: usize,
    proxy_config: &ProxyConfig,
) -> Result<Vec<GraphMailRecord>> {
    let client = create_http_client(proxy_config, 60)?;
    let folder_name = normalize_folder_name(folder);

    let url = format!(
        "https://graph.microsoft.com/v1.0/me/mailFolders/{}/messages?$top={}&$orderby=receivedDateTime desc",
        folder_name, top
    );

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Graph API 请求失败: {} - {}", status, error_text));
    }

    let mail_list: MailListResponse = response.json().await?;

    let mut records = Vec::new();
    for mail in mail_list.value {
        // 提取发件人
        let sender = mail
            .from
            .and_then(|f| f.email_address)
            .map(|e| match (e.name, e.address) {
                (Some(name), Some(addr)) => format!("{} <{}>", name, addr),
                (None, Some(addr)) => addr,
                (Some(name), None) => name,
                (None, None) => String::new(),
            });

        // 提取内容（优先 body，fallback 到 bodyPreview）
        let content = mail
            .body
            .and_then(|b| b.content)
            .unwrap_or_else(|| mail.body_preview.unwrap_or_default());

        // 解析接收时间
        let received_time = mail.received_date_time.or(mail.created_date_time);

        // 获取附件（如果有）
        let mut attachments = Vec::new();
        if mail.has_attachments.unwrap_or(false) {
            if let Ok(att_list) = fetch_attachments(&client, access_token, &mail.id).await {
                attachments = att_list;
            }
        }

        records.push(GraphMailRecord {
            subject: mail.subject,
            sender,
            received_time,
            content,
            folder: folder.to_string(),
            attachments,
        });
    }

    Ok(records)
}

/// 获取邮件附件
async fn fetch_attachments(
    client: &Client,
    access_token: &str,
    message_id: &str,
) -> Result<Vec<GraphAttachmentData>> {
    let url = format!(
        "https://graph.microsoft.com/v1.0/me/messages/{}/attachments",
        message_id
    );

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await?;

    if !response.status().is_success() {
        return Ok(Vec::new());
    }

    let att_list: AttachmentListResponse = response.json().await?;

    let mut attachments = Vec::new();
    for att in att_list.value {
        if let Some(content_b64) = att.content_bytes {
            if let Ok(content) =
                base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &content_b64)
            {
                attachments.push(GraphAttachmentData {
                    filename: att.name.unwrap_or_else(|| "attachment".to_string()),
                    content_type: att
                        .content_type
                        .unwrap_or_else(|| "application/octet-stream".to_string()),
                    content,
                });
            }
        }
    }

    Ok(attachments)
}

/// 获取文件夹列表
pub async fn get_mail_folders(
    access_token: &str,
    proxy_config: &ProxyConfig,
) -> Result<Vec<String>> {
    let client = create_http_client(proxy_config, 30)?;

    let url = "https://graph.microsoft.com/v1.0/me/mailFolders";

    let response = client
        .get(url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await?;

    if !response.status().is_success() {
        return Ok(vec!["INBOX".to_string()]);
    }

    #[derive(Deserialize)]
    struct FolderResponse {
        value: Vec<Folder>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Folder {
        display_name: Option<String>,
    }

    let folders: FolderResponse = response.json().await?;

    Ok(folders
        .value
        .into_iter()
        .filter_map(|f| f.display_name)
        .collect())
}
