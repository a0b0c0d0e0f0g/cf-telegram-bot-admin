<script lang="ts">
  import { onMount } from "svelte";

  let name = "";
  let username = "";
  let token = "";
  let profiles: any[] = [];
  let configProfileId = "";
  let error = "";
  let ok = "";

  onMount(async () => {
    profiles = await (await fetch("/api/profiles")).json();
    configProfileId = profiles[0]?.id ?? "";
  });

  async function create() {
    error = "";
    ok = "";
    const res = await fetch("/api/bots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, username: username || undefined, token, configProfileId })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      error = j?.error ?? "创建失败";
      return;
    }
    ok = `创建成功，Webhook: ${j.webhook}`;
    token = "";
  }
</script>

<div class="min-h-screen p-4 max-w-2xl mx-auto">
  <a class="text-sm underline" href="/dashboard">← 返回</a>
  <h1 class="mt-3 text-xl font-semibold">新增机器人</h1>

  <div class="mt-4 space-y-3">
    <div>
      <label class="text-sm text-slate-600">名称</label>
      <input class="w-full rounded-xl border p-3" bind:value={name} placeholder="客服机器人" />
    </div>

    <div>
      <label class="text-sm text-slate-600">用户名（可选）</label>
      <input class="w-full rounded-xl border p-3" bind:value={username} placeholder="@your_bot" />
    </div>

    <div>
      <label class="text-sm text-slate-600">Bot Token</label>
      <input class="w-full rounded-xl border p-3" bind:value={token} placeholder="123456:ABC..." />
      <p class="text-xs text-slate-500 mt-1">Token 会用 AES-GCM 加密后写入 D1。</p>
    </div>

    <div>
      <label class="text-sm text-slate-600">绑定配置模板</label>
      <select class="w-full rounded-xl border p-3" bind:value={configProfileId}>
        {#each profiles as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
      <p class="text-xs text-slate-500 mt-1">多个机器人可以共享同一个模板。</p>
    </div>

    {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
    {#if ok}<p class="text-sm text-green-700 break-words">{ok}</p>{/if}

    <button class="w-full rounded-xl border p-3" on:click={create}>创建并自动绑定 Webhook</button>
  </div>
</div>
