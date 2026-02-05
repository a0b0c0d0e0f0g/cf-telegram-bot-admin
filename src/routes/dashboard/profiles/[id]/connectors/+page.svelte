<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";

  $: profileId = $page.params.id;

  let connectors: any[] = [];
  let error = "";
  let msg = "";

  let name = "";
  let endpoint = "";
  let method = "GET";
  let authType = "none";
  let authSecretName = "";
  let headersJson = "{\n  \"content-type\": \"application/json\"\n}";
  let timeoutMs = 8000;

  async function load() {
    error = "";
    connectors = await (await fetch(`/api/connectors?profileId=${profileId}`)).json();
  }

  onMount(load);

  async function create() {
    error = "";
    msg = "";
    const r = await fetch("/api/connectors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId,
        name,
        endpoint,
        method,
        authType,
        authSecretName: authSecretName || undefined,
        headersJson,
        timeoutMs,
        retryJson: "{\"retries\":0}",
        responseMapJson: "{}"
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { error = j?.error ?? "创建失败"; return; }
    msg = "创建成功";
    name = ""; endpoint = "";
    await load();
  }

  async function del(id: string) {
    if (!confirm("删除 connector？")) return;
    const r = await fetch(`/api/connectors/${id}`, { method: "DELETE" });
    if (!r.ok) { error = "删除失败"; return; }
    await load();
  }
</script>

<div class="min-h-screen p-4 max-w-3xl mx-auto">
  <a class="text-sm underline" href={`/dashboard/profiles/${profileId}`}>← 返回模板</a>
  <h1 class="mt-3 text-xl font-semibold">Connectors（外部接口）</h1>

  <div class="mt-4 rounded-2xl border p-4 space-y-3">
    <h2 class="font-semibold">新增 connector</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div>
        <label class="text-xs text-slate-600" for="connector-name">名称</label>
        <input id="connector-name" class="w-full rounded-xl border p-2" bind:value={name} placeholder="crmSearch" />
      </div>
      <div>
        <label class="text-xs text-slate-600" for="connector-method">Method</label>
        <select id="connector-method" class="w-full rounded-xl border p-2" bind:value={method}>
          <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
        </select>
      </div>
    </div>

    <div>
      <label class="text-xs text-slate-600" for="connector-endpoint">Endpoint</label>
      <input id="connector-endpoint" class="w-full rounded-xl border p-2" bind:value={endpoint} placeholder="https://api.example.com/search" />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div>
        <label class="text-xs text-slate-600" for="connector-auth-type">Auth</label>
        <select id="connector-auth-type" class="w-full rounded-xl border p-2" bind:value={authType}>
          <option value="none">none</option>
          <option value="bearer">bearer</option>
        </select>
      </div>
      <div>
        <label class="text-xs text-slate-600" for="connector-auth-secret">Secret Name（bearer 时）</label>
        <input id="connector-auth-secret" class="w-full rounded-xl border p-2" bind:value={authSecretName} placeholder="CRM_API_KEY" />
      </div>
    </div>

    <div>
      <label class="text-xs text-slate-600" for="connector-headers">Headers JSON</label>
      <textarea id="connector-headers" class="w-full rounded-xl border p-2 min-h-[80px] font-mono text-xs" bind:value={headersJson}></textarea>
    </div>

    <div>
      <label class="text-xs text-slate-600" for="connector-timeout">Timeout (ms)</label>
      <input id="connector-timeout" class="w-full rounded-xl border p-2" type="number" bind:value={timeoutMs} />
    </div>

    {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
    {#if msg}<p class="text-sm text-green-700">{msg}</p>{/if}
    <button class="w-full rounded-xl border p-3" on:click={create}>创建</button>

    <p class="text-xs text-slate-500">
      密钥请用 <code class="px-1 rounded bg-slate-100">wrangler secret put &lt;SECRET_NAME&gt;</code> 存到 Cloudflare。
    </p>
  </div>

  <h2 class="mt-6 text-lg font-semibold">已有 connectors</h2>
  <div class="mt-3 space-y-3">
    {#each connectors as c}
      <div class="rounded-2xl border p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">{c.name}</p>
            <p class="text-sm text-slate-500 break-words">{c.method} {c.endpoint}</p>
          </div>
          <button class="text-sm text-red-600" on:click={() => del(c.id)}>删除</button>
        </div>
        <p class="text-xs text-slate-500 mt-2">auth: {c.auth_type} {c.auth_secret_name ?? ""} · timeout: {c.timeout_ms}ms</p>
      </div>
    {/each}
    {#if connectors.length === 0}<p class="text-sm text-slate-500">暂无 connectors</p>{/if}
  </div>
</div>
