<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";

  $: profileId = $page.params.id;

  let profile: any = null;
  let allProfiles: any[] = [];

  let mode: "form" | "json" = "form";
  let error = "";
  let msg = "";

  // editable objects
  let uiObj: any = {};
  let logicObj: any = {};

  // json strings
  let uiJson = "";
  let logicJson = "";

  onMount(async () => {
    allProfiles = await (await fetch("/api/profiles")).json();
    await reload();
  });

  async function reload() {
    error = "";
    profile = await (await fetch(`/api/profiles/${profileId}`)).json();
    uiJson = String(profile.ui_json ?? "{}");
    logicJson = String(profile.bot_logic_json ?? "{}");
    syncFromJson();
  }

  function syncFromJson() {
    try { uiObj = JSON.parse(uiJson); } catch { uiObj = {}; }
    try { logicObj = JSON.parse(logicJson); } catch { logicObj = {}; }
    if (!Array.isArray(logicObj.routes)) logicObj.routes = [];
  }

  function syncToJson() {
    uiJson = JSON.stringify(uiObj ?? {}, null, 2);
    logicJson = JSON.stringify(logicObj ?? {}, null, 2);
  }

  function addRoute() {
    logicObj.routes.push({ type: "command", match: "/hello", action: { type: "send_message", text: "hi" } });
    syncToJson();
  }

  function removeRoute(i: number) {
    logicObj.routes.splice(i, 1);
    syncToJson();
  }

  async function save() {
    error = "";
    msg = "";
    if (mode === "form") syncToJson();
    // validate json
    try { JSON.parse(uiJson); JSON.parse(logicJson); } catch { error = "JSON 格式错误"; return; }

    const r = await fetch(`/api/profiles/${profileId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: profile.name,
        description: profile.description ?? "",
        parentProfileId: profile.parent_profile_id ?? null,
        uiJson,
        botLogicJson: logicJson
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { error = j?.error ?? "保存失败"; return; }
    msg = "保存成功";
    await reload();
  }

  async function del() {
    if (!confirm("确认删除模板？（owner 权限）")) return;
    const r = await fetch(`/api/profiles/${profileId}`, { method: "DELETE" });
    if (!r.ok) { error = "删除失败（需要 owner 权限，且被机器人引用也会失败）"; return; }
    location.href = "/dashboard";
  }

  function setMode(m: "form" | "json") {
    mode = m;
    if (mode === "form") syncFromJson();
  }
</script>

<div class="min-h-screen p-4 pb-20 max-w-3xl mx-auto">
  <a class="text-sm underline" href="/dashboard">← 返回</a>
  <div class="mt-3 flex items-center justify-between gap-3">
  <h1 class="text-xl font-semibold">配置模板编辑</h1>
  <a class="text-sm underline" href={`/dashboard/profiles/${profileId}/connectors`}>Connectors</a>
</div>

  {#if !profile}
    <p class="mt-4 text-sm text-slate-500">加载中...</p>
  {:else}
    <div class="mt-4 space-y-3">
      <div>
        <label class="text-sm text-slate-600">名称</label>
        <input class="w-full rounded-xl border p-3" bind:value={profile.name} />
      </div>

      <div>
        <label class="text-sm text-slate-600">描述</label>
        <input class="w-full rounded-xl border p-3" bind:value={profile.description} />
      </div>

      <div>
        <label class="text-sm text-slate-600">继承父模板（可选）</label>
        <select class="w-full rounded-xl border p-3" bind:value={profile.parent_profile_id}>
          <option value={null}>无</option>
          {#each allProfiles as p}
            {#if p.id !== profileId}
              <option value={p.id}>{p.name}</option>
            {/if}
          {/each}
        </select>
        <p class="text-xs text-slate-500 mt-1">继承使用深度 merge；数组由子模板覆盖。</p>
      </div>

      <div class="flex gap-2">
        <button class={`rounded-xl border px-3 py-2 text-sm ${mode==='form'?'bg-slate-50':''}`} on:click={() => setMode("form")}>可视化表单</button>
        <button class={`rounded-xl border px-3 py-2 text-sm ${mode==='json'?'bg-slate-50':''}`} on:click={() => setMode("json")}>JSON</button>
      </div>

      {#if mode === "form"}
        <div class="rounded-2xl border p-4 space-y-4">
          <h2 class="font-semibold">路由规则（logic.routes）</h2>

          <div class="space-y-3">
            {#each logicObj.routes as r, i}
              <div class="rounded-2xl border p-3 space-y-2">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium">规则 #{i+1}</p>
                  <button class="text-sm text-red-600" on:click={() => removeRoute(i)}>删除</button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="text-xs text-slate-600">类型</label>
                    <select class="w-full rounded-xl border p-2" bind:value={r.type} on:change={syncToJson}>
                      <option value="command">command</option>
                      <option value="keyword">keyword</option>
                      <option value="regex">regex</option>
                      <option value="callback">callback</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-xs text-slate-600">匹配</label>
                    <input class="w-full rounded-xl border p-2" bind:value={r.match} on:input={syncToJson} />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="text-xs text-slate-600">动作类型</label>
                    <select class="w-full rounded-xl border p-2" bind:value={r.action.type} on:change={syncToJson}>
                      <option value="send_message">send_message</option>
                      <option value="call_connector">call_connector</option>
                      <option value="raw_telegram">raw_telegram</option>
                    </select>
                  </div>

                  {#if r.action.type === "call_connector"}
                    <div>
                      <label class="text-xs text-slate-600">Connector 名称</label>
                      <input class="w-full rounded-xl border p-2" bind:value={r.action.connectorName} on:input={syncToJson} placeholder="例如: crmSearch" />
                    </div>
                  {:else if r.action.type === "raw_telegram"}
                    <div>
                      <label class="text-xs text-slate-600">Telegram method</label>
                      <input class="w-full rounded-xl border p-2" bind:value={r.action.method} on:input={syncToJson} placeholder="sendMessage" />
                    </div>
                  {:else}
                    <div>
                      <label class="text-xs text-slate-600">文本</label>
                      <input class="w-full rounded-xl border p-2" bind:value={r.action.text} on:input={syncToJson} placeholder="回复内容" />
                    </div>
                  {/if}
                </div>

                {#if r.action.type === "call_connector"}
                  <div>
                    <label class="text-xs text-slate-600">输出模板（支持 {{text}}、{{data.xxx}}）</label>
                    <textarea class="w-full rounded-xl border p-2 min-h-[72px]" bind:value={r.action.outputTemplate} on:input={syncToJson}
                      placeholder="例如: 查询结果：{{data.result}}" />
                  </div>
                {/if}
              </div>
            {/each}

            <button class="w-full rounded-xl border p-3" on:click={addRoute}>新增规则</button>
          </div>

          <details class="rounded-xl border p-3">
            <summary class="text-sm font-medium">高级：UI 配置（ui_json）</summary>
            <div class="mt-2 space-y-2">
              <label class="text-xs text-slate-600">主题模式</label>
              <select class="w-full rounded-xl border p-2" bind:value={uiObj.theme.mode} on:change={syncToJson}>
                <option value="system">system</option>
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
              <label class="text-xs text-slate-600">品牌色（示意）</label>
              <input class="w-full rounded-xl border p-2" bind:value={uiObj.theme.brand} on:input={syncToJson} placeholder="indigo" />
            </div>
          </details>
        </div>
      {:else}
        <div class="space-y-3">
          <div class="rounded-2xl border p-4">
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">bot_logic_json</h2>
              <button class="text-sm underline" on:click={syncFromJson}>从 JSON 刷新表单</button>
            </div>
            <textarea class="mt-2 w-full rounded-xl border p-3 min-h-[260px] font-mono text-xs"
              bind:value={logicJson} on:input={() => { /* keep */ }} />
          </div>

          <div class="rounded-2xl border p-4">
            <h2 class="font-semibold">ui_json</h2>
            <textarea class="mt-2 w-full rounded-xl border p-3 min-h-[160px] font-mono text-xs"
              bind:value={uiJson} />
          </div>
        </div>
      {/if}

      {#if error}<p class="text-sm text-red-600">{error}</p>{/if}
      {#if msg}<p class="text-sm text-green-700">{msg}</p>{/if}

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button class="rounded-xl border p-3" on:click={save}>保存</button>
        <button class="rounded-xl border p-3 text-red-600" on:click={del}>删除（owner）</button>
      </div>
    </div>
  {/if}
</div>
