-- 當出現「讀不到 id=default」或「更新 0 筆」：多半是 request.headers 在 RLS 無法使用。
-- 請在 Supabase → SQL Editor 貼上執行（勿含 # 標題）。
-- 請把 YOUR_STORE_KEY 改成與 Cloudflare「VITE_STORE_KEY」完全相同。

-- 1) 確保有 id=default 這一筆
insert into public.store_data (id, store_key, products, orders, categories, store_settings)
values ('default', 'YOUR_STORE_KEY', '[]', '[]', '[]', '{}')
on conflict (id) do update set store_key = excluded.store_key;

alter table public.store_data enable row level security;

-- 2) 移除舊的（含依賴 header 的 policy）
drop policy if exists "Allow all for store_data" on public.store_data;
drop policy if exists "store_data_read_with_key" on public.store_data;
drop policy if exists "store_data_write_with_key" on public.store_data;
drop policy if exists "store_data_update_with_key" on public.store_data;
drop policy if exists "store_data_anon_select" on public.store_data;
drop policy if exists "store_data_anon_insert" on public.store_data;
drop policy if exists "store_data_anon_update" on public.store_data;

-- 3) 匿名（瀏覽器用 anon key）只能讀寫 id=default 這一列
-- 說明：anon 金鑰本來就會出現在網頁；此作法與「用 header 驗證」相比，改為只鎖定單一列。
create policy "store_data_anon_select"
  on public.store_data for select
  to anon
  using (id = 'default');

create policy "store_data_anon_insert"
  on public.store_data for insert
  to anon
  with check (id = 'default');

create policy "store_data_anon_update"
  on public.store_data for update
  to anon
  using (id = 'default')
  with check (id = 'default');
