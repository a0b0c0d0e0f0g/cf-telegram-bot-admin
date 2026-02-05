<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";

  let bot: any = null;
  let profiles: any[] = [];
  let token = "";
  let status: any = null;
  let msg = "";
  let err = "";

  $: botId = $page.params.id;

  onMount(async () => {
    profiles = await (await fetch("/api/profiles")).json();
    await reload();
  });

  async function reload() {
    err = "";
    bot = await (await fetch(`/api/bots/${botId}`)).json();
  }

  async function refreshWebhook() {
    err = "";
    status = null;
    const r = await fetch(`/api/webhook-status?botId=${botId}`);
    status = await r.json();
  }

  async function save() {
    err = "";
    msg = "";
    const payload: any = {
      name: bot.name,
      username: bot.username,
      configProfileId: bot.config_profile_id,
      isEnabled: !!bot.is_enabled
    };
    if (token.trim()) payload.token = token.trim();

    const r = await fetch(`/api/bots/${botId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      err = j?.error ?? "保存失败";
      return;
    }
    msg = j.webhook ? `保存成功，Webhook 已更新：${j.webhook}` : "保存成功";
    token = "";
    await reload();
  }

  async function rebindWebhook() {
    err = "";
    msg = "";
    const r = await fetch(`/api/bots/${botId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rebindWebhook: true })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { err = j?.error ?? "失败"; return; }
    msg = `Webhook 已重绑：${j.webhook}`;
    await reload();
  }

  async function del() {
    if (!confirm("确认删除机器人？")) return;
    const r = await fetch(`/api/bots/${botId}`, { method: "DELETE" });
    if (!r.ok) { err = "删除失败（需要 owner 权限）"; return; }
    location.href = "/dashboard";
  }
</script>

<div class="min-h-screen p-4 max-w-2xl mx-auto">
  <a class="text-sm underline" href="/dashboard">← 返回</a>
  <h1 class="mt-3 text-xl font-semibold">机器人详情</h1>

  {#if !bot}
    <p class="mt-4 text-sm text-slate-500">加载中...</p>
  {:else}
    <div class="mt-4 space-y-3">
      <div>
        <label class="text-sm text-slate-600" for="bot-name">名称</label>
        <input id="bot-name" class="w-full rounded-xl border p-3" bind:value={bot.name} />
      </div>

      <div>
        <label class="text-sm text-slate-600" for="bot-username">用户名</label>
        <input id="bot-username" class="w-full rounded-xl border p-3" bind:value={bot.username} />
      </div>

      <div>
        <label class="text-sm text-slate-600" for="bot-profile">绑定模板</label>
        <select id="bot-profile" class="w-full rounded-xl border p-3" bind:value={bot.config_profile_id}>
          {#each profiles as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </div>

      <div class="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p class="text-sm font-medium">启用</p>
          <p class="text-xs text-slate-500">关闭后 webhook 仍会收到但会返回 404</p>
        </div>
        <input type="checkbox" bind:checked={bot.is_enabled} />
      </div>

      <div>
        <label class="text-sm text-slate-600" for="bot-token">更新 Token（可选）</label>
        <input id="bot-token" class="w-full rounded-xl border p-3" bind:value={token} placeholder="留空则不改" />
      </div>

      {#if err}<p class="text-sm text-red-600">{err}</p>{/if}
      {#if msg}<p class="text-sm text-green-700 break-words">{msg}</p>{/if}

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button class="rounded-xl border p-3" on:click={save}>保存</button>
        <button class="rounded-xl border p-3" on:click={rebindWebhook}>重绑 Webhook（旋转 secret）</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button class="rounded-xl border p-3" on:click={refreshWebhook}>查看 Webhook 状态</button>
        <button class="rounded-xl border p-3 text-red-600" on:click={del}>删除（owner）</button>
      </div>

      {#if status}
        <pre class="text-xs rounded-2xl border p-3 overflow-auto">{JSON.stringify(status, null, 2)}</pre>
      {/if}
    </div>
  {/if}
</div>
