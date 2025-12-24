#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sqlite3
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('db-updater')

def update_database():
    """更新数据库结构，确保emails表包含user_id列"""
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'huohuo_email.db')
    
    if not os.path.exists(db_path):
        logger.error(f"数据库文件不存在: {db_path}")
        return False
    
    conn = None
    try:
        logger.info(f"连接数据库: {db_path}")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        
        # 检查emails表是否存在
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='emails'")
        if not cursor.fetchone():
            logger.error("emails表不存在")
            return False
        
        # 检查emails表是否有user_id列
        cursor = conn.execute("PRAGMA table_info(emails)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'user_id' not in columns:
            logger.info("添加user_id列到emails表")
            conn.execute("ALTER TABLE emails ADD COLUMN user_id INTEGER")
            
            # 默认将所有邮箱关联到管理员用户(ID=1)
            cursor = conn.execute("SELECT id FROM users WHERE is_admin=1 LIMIT 1")
            admin_user = cursor.fetchone()
            admin_id = admin_user['id'] if admin_user else 1
            
            logger.info(f"将现有邮箱关联到管理员用户 ID: {admin_id}")
            conn.execute(f"UPDATE emails SET user_id = {admin_id}")
            conn.commit()
            
            logger.info("数据库结构更新成功")
        else:
            logger.info("user_id列已存在，不需要更新")
        
        # 检查emails表中user_id为NULL的记录
        cursor = conn.execute("SELECT COUNT(*) FROM emails WHERE user_id IS NULL")
        null_count = cursor.fetchone()[0]
        
        if null_count > 0:
            # 默认将user_id为NULL的邮箱关联到管理员用户(ID=1)
            cursor = conn.execute("SELECT id FROM users WHERE is_admin=1 LIMIT 1")
            admin_user = cursor.fetchone()
            admin_id = admin_user['id'] if admin_user else 1
            
            logger.info(f"将 {null_count} 个没有关联用户的邮箱关联到管理员用户 ID: {admin_id}")
            conn.execute(f"UPDATE emails SET user_id = {admin_id} WHERE user_id IS NULL")
            conn.commit()
        
        return True
    except Exception as e:
        logger.error(f"更新数据库时出错: {str(e)}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    if update_database():
        logger.info("数据库更新完成")
    else:
        logger.error("数据库更新失败") 