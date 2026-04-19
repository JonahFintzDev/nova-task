// node_modules
import { defineStore } from 'pinia';
import { ref } from 'vue';

// classes
import { appWs, authApi, getStoredToken, setStoredToken } from '@/classes/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getStoredToken());
  const username = ref<string | null>(null);
  const userId = ref<string | null>(null);
  const isAdmin = ref(false);
  const validated = ref(false);

  async function login(user: string, password: string): Promise<void> {
    const response = await authApi.login(user, password);
    token.value = response.token;
    setStoredToken(response.token);
    username.value = user;
    await validate();
  }

  async function register(user: string, password: string): Promise<void> {
    const response = await authApi.register(user, password);
    token.value = response.token;
    setStoredToken(response.token);
    username.value = user;
    await validate();
  }

  function logout(): void {
    token.value = null;
    username.value = null;
    userId.value = null;
    isAdmin.value = false;
    validated.value = false;
    setStoredToken(null);
    appWs.disconnect();
  }

  async function validate(): Promise<boolean> {
    if (!token.value) {
      validated.value = false;
      return false;
    }
    const response = await authApi.validate();
    if (!response.valid || !response.username) {
      logout();
      return false;
    }
    username.value = response.username;
    userId.value = response.userId ?? null;
    isAdmin.value = response.isAdmin;
    validated.value = true;
    appWs.connect();
    return true;
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await authApi.changePassword(currentPassword, newPassword);
  }

  return {
    token,
    username,
    userId,
    isAdmin,
    validated,
    login,
    register,
    logout,
    validate,
    changePassword,
  };
});
