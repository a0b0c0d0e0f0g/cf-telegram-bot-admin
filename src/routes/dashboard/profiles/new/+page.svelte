<script lang="ts">
  import { onMount } from "svelte";
  let name = "";
  let description = "";
  let profiles: any[] = [];
  let copyFromProfileId = "";
  let error = "";
  let ok = "";

  onMount(async () => {
    profiles = await (await fetch("/api/profiles")).json();
  });

  async function create() {
    error = "";
    ok = "";
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, description, copyFromProfileId: copyFromProfileId || undefined })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { error = j?.error ?? "创建失败"; return; }
    ok = "创建成功";
    location.href = `/dashboard/profiles/${j.id}`;
  }
</script>

<div class="min-h-screen p-4 max-w-2xl mx-auto">
  <a class="text-sm underline" href="/dashboard">← 返回</a>
  <h1 class="mt-3 text-xl font-semibold">新增配置模板</h1>

  <div class="mt-4 space-y-3">
    <div>
      <label class="text-sm text-slate-600" for="profile-name">名称</label>
      <input id="profile-name" class="w-full rounded-xl border p-3" bind:value={name} />
    </div>

    <div>
      <label class="text-sm text-slate-600" for="profile-description">描述</label>
      <input id="profile-description" class="w-full rounded-xl border p-3" bind:value={description} />
    </div>

    <div>
      <label class="text-sm text-slate-600" for="profile-copy">从现有模板复制（可选）</label>
      <select id="profile-copy" class="w-full rounded-xl border p-3" bind:value={copyFromProfileId}>
        <option value="">不复制（使用默认）</option>
        {#each profiles as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </div>

    {#if error}<p class="text-sm text-red-600">{error}</p>{/if}

    <button class="w-full rounded-xl border p-3" on:click={create}>创建</button>
  </div>
</div>
