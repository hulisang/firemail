<template>
  <div class="login-container">
    <div class="login-box">
      <h1 class="title">登录</h1>
      
      <div v-if="error" class="alert alert-danger">
        {{ error }}
      </div>
      
      <div v-if="successMessage" class="alert alert-success">
        {{ successMessage }}
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input 
            type="text" 
            id="username" 
            v-model="username" 
            class="form-control" 
            placeholder="请输入用户名" 
            required 
            autofocus
          />
        </div>
        
        <div class="form-group">
          <label for="password">密码</label>
          <input 
            type="password" 
            id="password" 
            v-model="password" 
            class="form-control" 
            placeholder="请输入密码" 
            required
          />
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            <span v-if="loading">登录中...</span>
            <span v-else>登录</span>
          </button>
        </div>
      </form>
      
      <div class="login-footer">
        <p>没有账号? <router-link :to="{ name: 'register' }">注册</router-link></p>
      </div>
    </div>
  </div>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  name: 'LoginView',
  data() {
    return {
      username: '',
      password: '',
      loading: false,
      error: '',
      successMessage: ''
    };
  },
  created() {
    // 检查是否从注册页面跳转过来
    if (this.$route.params.registrationSuccess) {
      this.successMessage = '注册成功！请登录您的新账户。';
      
      if (this.$route.params.loginAttemptFailed) {
        this.error = '自动登录失败，请手动登录';
      }
      
      // 如果有用户名和密码传递过来，自动填充
      if (this.$route.params.username) {
        this.username = this.$route.params.username;
      }
    }
  },
  methods: {
    ...mapActions('auth', ['login']),
    async handleLogin() {
      this.loading = true;
      this.error = '';
      this.successMessage = '';
      
      try {
        console.log('开始登录：', this.username);
        await this.login({
          username: this.username,
          password: this.password
        });
        
        console.log('登录成功');
        // 登录成功后，检查是否需要重定向
        const redirectPath = this.$route.query.redirect || '/';
        this.$router.push(redirectPath);
      } catch (error) {
        console.error('登录失败:', error);
        
        // 提取更有用的错误信息
        if (error.response?.data?.error) {
          this.error = error.response.data.error;
        } else if (error.message) {
          this.error = error.message;
        } else {
          this.error = '登录失败，请检查用户名和密码';
        }
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 80px);
  padding: 20px;
}

.login-box {
  width: 100%;
  max-width: 400px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  padding: 30px;
}

.title {
  text-align: center;
  margin-bottom: 24px;
  color: #333;
  font-weight: 600;
}

.login-form {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-control:focus {
  border-color: #42b983;
  outline: none;
}

.btn {
  display: inline-block;
  padding: 10px 20px;
  font-size: 16px;
  font-weight: 500;
  text-align: center;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s, opacity 0.3s;
  border: none;
}

.btn-primary {
  background-color: #42b983;
  color: white;
}

.btn-primary:hover {
  background-color: #3aa876;
}

.btn-block {
  display: block;
  width: 100%;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.form-actions {
  margin-top: 30px;
}

.login-footer {
  text-align: center;
  margin-top: 20px;
  color: #666;
}

.login-footer a {
  color: #42b983;
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}

.alert {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.alert-danger {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.alert-success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}
</style> 