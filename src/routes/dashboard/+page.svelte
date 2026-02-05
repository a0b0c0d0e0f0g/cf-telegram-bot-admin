<script lang="ts">
  import { onMount } from "svelte";

  let me: any = null;
  let bots: any[] = [];
  let profiles: any[] = [];
  let error = "";

  async function load() {
    error = "";
    const [meR, bR, pR] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/bots"),
      fetch("/api/profiles")
    ]);
    me = (await meR.json()).admin;
    bots = await bR.json();
    profiles = await pR.json();
  }

  async function logout() {
    await fetch("/logout", { method: "POST" });
    location.href = "/login";
  }

  onMount(load);
</script>

<div class="min-h-screen p-4 pb-20 max-w-3xl mx-auto">
  <header class="flex items-center justify-between gap-3">
    <div>
      <h1 class="text-xl font-semibold">Telegram 机器人后台</h1>
      {#if me}<p class="text-sm text-slate-500">{me.email} · {me.role}</p>{/if}
    </div>
    <button class="rounded-xl border px-3 py-2 text-sm" on:click={logout}>退出</button>
  </header>

  {#if error}<p class="mt-3 text-sm text-red-600">{error}</p>{/if}

  <section class="mt-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">机器人</h2>
      <a class="text-sm underline" href="/dashboard/bots/new">新增机器人</a>
    </div>

    <div class="mt-3 space-y-3">
      {#each bots as b}
        <a class="block rounded-2xl border p-4 hover:bg-slate-50" href={`/dashboard/bots/${b.id}`}>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{b.name}</p>
              <p class="text-sm text-slate-500">{b.username ?? ""}</p>
            </div>
            <span class="text-xs rounded-full border px-2 py-1">{b.is_enabled ? "启用" : "禁用"}</span>
          </div>
          <p class="mt-2 text-xs text-slate-500">Profile: {b.config_profile_id}</p>
        </a>
      {/each}
      {#if bots.length === 0}
        <p class="text-sm text-slate-500">暂无机器人</p>
      {/if}
    </div>
  </section>

  <section class="mt-8">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">配置模板</h2>
      <a class="text-sm underline" href="/dashboard/profiles/new">新增模板</a>
    </div>

    <div class="mt-3 space-y-3">
      {#each profiles as p}
        <a class="block rounded-2xl border p-4 hover:bg-slate-50" href={`/dashboard/profiles/${p.id}`}>
          <p class="font-medium">{p.name}</p>
          <p class="text-sm text-slate-500">{p.description ?? ""}</p>
          {#if p.parent_profile_id}<p class="text-xs text-slate-500 mt-1">继承: {p.parent_profile_id}</p>{/if}
        </a>
      {/each}
      {#if profiles.length === 0}
        <p class="text-sm text-slate-500">暂无模板</p>
      {/if}
    </div>
  </section>
</div>
