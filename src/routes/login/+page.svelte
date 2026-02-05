<script lang="ts">
  import { onMount } from "svelte";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;
  let hasAdmin = true;

  onMount(async () => {
    const res = await fetch("/api/auth/status");
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data && typeof data.hasAdmin === "boolean") {
      hasAdmin = data.hasAdmin;
    }
  });

  async function submit() {
    error = "";
    loading = true;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        error = j?.error ?? "登录失败";
        return;
      }
      location.href = "/dashboard";
    } catch (err) {
      error = err instanceof Error ? err.message : "网络错误";
    } finally {
      loading = false;
    }
  }

  async function register() {
    error = "";
    loading = true;
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        error = j?.error ?? "注册失败";
        return;
      }
      location.href = "/dashboard";
    } catch (err) {
      error = err instanceof Error ? err.message : "网络错误";
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm rounded-2xl shadow-sm border p-6 space-y-4 bg-white">
    <h1 class="text-xl font-semibold">管理后台登录</h1>

    <div class="space-y-2">
      <label class="text-sm text-slate-600" for="login-account">账号</label>
      <input id="login-account" class="w-full rounded-xl border p-3" placeholder="admin" bind:value={email} />
    </div>

    <div class="space-y-2">
      <label class="text-sm text-slate-600" for="login-password">密码</label>
      <input id="login-password" class="w-full rounded-xl border p-3" placeholder="••••••••" type="password" bind:value={password} />
    </div>

    {#if error}<p class="text-sm text-red-600">{error}</p>{/if}

    <button
      class="w-full rounded-xl border p-3 active:scale-[0.99]"
      disabled={loading}
      on:click={hasAdmin ? submit : register}
    >
      {loading ? "处理中..." : hasAdmin ? "登录" : "注册并登录"}
    </button>

    <p class="text-xs text-slate-500">
      系统会自动初始化数据库并创建管理员（默认账号 admin / 密码 rjkk..）。
    </p>
  </div>
</div>
