# operator quickstart

この repo は「動いているサービス」ではなく**凍結コピー**なので、最初にやることは
起動ではなく **「何が今日も動き、何が死んでいるか」を自分の手で確かめること**。
所要 5 分（依存の取得を除く）。**Cloudflare アカウントも API token も secret も要らない。**

**2026-08-26 に、UI（ランディング画面）を SvelteKit から ClojureScript
（reagent + re-frame + `jp-go-dds`）へ移行した。** step 0〜4 はこの新しい
`cljs/` ビルドの手順に書き換えてあり、**2026-08-26 に実際に踏んで、貼ってある
出力はその実測値**。step 5〜6（DNS・upstream contract の裏取り）はフレームワークに
依存しないので 2026-08-12 の実測のまま。踏めなかった手順は step 7 に「踏めない」と、
理由つきで書いてある。

## 0. 前提

Node + Clojure CLI（`clojure`）。実測した版:

```bash
node --version       # v26.7.0
npm --version        # 11.19.0
clojure --version    # Clojure CLI version 1.12.5.1654
```

作業ディレクトリは cljs アプリの中:

```bash
cd appview/contentengine-cten0001/cljs
```

**重い build は 1 本に制限されている**（workspace 規約）。step 2 は必ず
resource guard 経由で回すこと。空いているかは先に見られる:

```bash
node /path/to/com-junkawasaki/scripts/resource-guard.mjs status
# {"build":{"active":false},"deploy":{"active":false}}
```

## 1. 依存を入れる

```bash
npm install --no-audit --no-fund
```

```
added 129 packages in 11s
```

`package.json` は `react` / `react-dom` ^18.2.0 と `shadow-cljs` 2.28.20 を持つ
（reagent が npm 側の React を要求するため——`jvm-new-surface-guard` により
reagent/re-frame 本体は `deps.edn` の `:cljs` alias 側で管理し、npm 側は React だけ）。
JVM 側の依存（`org.clojure/clojure` + `io.github.kotoba-lang/jp-go-digital-design-system`
とその推移的依存 `html` / `css` / `kotoba-kir`）は `deps.edn` に固定した git SHA で
`clojure` コマンドが解決する（`~/.gitlibs` にキャッシュされていれば追加のネットワーク
アクセスは要らない）。

## 2. ビルドする

**resource guard 経由で。** 2 本ある（`app` = ブラウザ向け、`test` = node-test）:

```bash
node /path/to/com-junkawasaki/scripts/resource-guard.mjs run build -- amu compile --target wasm32-browser app
```

```
[:app] Compiling ...
[:app] Build completed. (111 files, 110 compiled, 0 warnings, 39.36s)
```

```bash
node /path/to/com-junkawasaki/scripts/resource-guard.mjs run build -- amu compile --target wasm32-browser test
```

```
[:test] Compiling ...
[:test] Build completed. (112 files, 111 compiled, 0 warnings, 22.04s)
```

テストを実行:

```bash
node out/tests.js
```

```
Testing contentengine.app-test

Ran 6 tests containing 22 assertions.
0 failures, 0 errors.
```

**`public/js/app.js`** がブラウザ向け成果物（`shadow-cljs.edn` の
`:asset-path "js"` / `:output-dir "public/js"` の宣言どおり）。`.gitignore` 済みで、
コミットには入らない——deploy 対象を再現したいときはこの 2 コマンドを再度回す。

## 2b. `public/index.html` を生成する

`public/index.html` は手で書いた HTML ではなく、`jp-go-dds.page/->page` を実際に
呼んで DADS CSS を埋め込んだ静的シェル（mount point `<div id="app">` + `<script
src="js/app.js">` だけを持つ——中身は `contentengine.app` が実行時に re-frame の
状態から描画する）。ビルド後に**必ず**再生成すること（`gen-index.cljc` は
`:clj`-only、shadow-cljs のビルドグラフには入らないので step 2 では作られない）:

```bash
kbb -M -e "(require 'contentengine.gen-index) (contentengine.gen-index/-main)"
```

```
wrote public/index.html
```

決定論的（clock も randomness も network も無い）——再実行しても byte-identical。

## 3. `src/app.ts` がデプロイされないことを確かめる（前と変わらず、理由が強まった）

移行前から `src/app.ts` は死んだコードだった（README「`src/app.ts`
はデプロイされない」節、2026-08-12 実測: `wrangler.jsonc` の `main` が指していたのは
`svelte/.svelte-kit/cloudflare/_worker.js` であって `src/app.ts` ではなかった）。

**移行後は理由がもっと単純になった**——`wrangler.jsonc` に `main` 自体が無い
（assets-only の Worker）。`src/app.ts` を検査するには次で確認できる:

```bash
grep -n '"main":' ../wrangler.jsonc; echo "exit=$?"
```

```
exit=1
```

（`"main":` キーは 1 件もヒットしない = assets-only。`src/app.ts` を呼ぶコード経路は
この repo のどこにも無い。）

## 4. ローカルで見る

**`wrangler dev` / `wrangler deploy` はこの移行では実行していない**（下記 step 7）。
静的出力だけを見るなら:

```bash
cd public && python3 -m http.server 4173
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/     # 200 が期待値（未実測）
```

`wrangler dev --local`（workerd、production と同じ assets 配信ランタイム）を
appview のルート（`wrangler.jsonc` の隣）から試す場合:

```bash
cd ..                                  # appview/contentengine-cten0001
npx wrangler dev --local --port 8788 --ip 127.0.0.1
```

**この 2 つはどちらもこの移行では実行していない（UNVERIFIED）。** 実行するときは
workspace 規約（本 CLAUDE.md「本番デプロイは `origin/main` を包含した checkout
からのみ行う」節・「検証を省いた blind deploy をしない」節）に従うこと。

### 旧 BFF（`+server.ts`）はもう呼ばれない

旧 `svelte/src/routes/xrpc/[...path]/+server.ts`（MCP router への唯一の実処理）は
`appview/contentengine-cten0001/backend-frozen/routes/xrpc/[...path]/+server.ts`
へ provenance header 付きで凍結退避した——コードは残っているが、SvelteKit 前提
（`@sveltejs/kit` import・`./$types`）でそのままは動かず、**このリポジトリの
どこからも呼ばれていない**。2026-08-12 時点では上流 DNS が無いために
`POST /xrpc/…` は 500 だった（下記 step 5〜6 は今も有効な記録）。**今日は
届く前に終わる**——assets-only の Worker に `/xrpc/*` を処理するコードが無い。

## 5. 上流が本当に無いことを確かめる（2026-08-12 実測のまま——フレームワーク非依存）

```bash
for h in contentengine.etzhayyim.com cten0001.etzhayyim.com mcp.etzhayyim.com \
         dispatcher.etzhayyim.com ads.etzhayyim.com adsm4d5c.etzhayyim.com \
         news.etzhayyim.com narou.etzhayyim.com etzhayyim.com; do
  printf '%-30s ' "$h"; r=$(dig +short "$h" | head -1); echo "${r:-（応答なし）}"
done
```

```
contentengine.etzhayyim.com    （応答なし）
cten0001.etzhayyim.com         （応答なし）
mcp.etzhayyim.com              （応答なし）
dispatcher.etzhayyim.com       （応答なし）
ads.etzhayyim.com              （応答なし）
adsm4d5c.etzhayyim.com         （応答なし）
news.etzhayyim.com             （応答なし）
narou.etzhayyim.com            （応答なし）
etzhayyim.com                  172.67.179.128
```

（`etzhayyim.com` は Cloudflare の 2 IP `104.21.51.111` / `172.67.179.128` を
ラウンドロビンで返すので、最後の行はどちらかになる。**上の 8 つが空であること**が
見たいところ。）

**「この端末が外に出られないだけ」ではないことを、対照実験で潰す:**

```bash
curl -s -o /dev/null -w 'etzhayyim.com    → %{http_code}\n' https://etzhayyim.com/
curl -s -o /dev/null -w 'example.com      → %{http_code}\n' https://example.com/
curl -s -o /dev/null -w 'mcp.etzhayyim    → %{http_code} (%{errormsg})\n' https://mcp.etzhayyim.com/
```

```
etzhayyim.com    → 200
example.com      → 200
mcp.etzhayyim    → 000 (Could not resolve host: mcp.etzhayyim.com)
```

**zone は生きていて、この actor のホストだけが無い。**
`wrangler.jsonc` の route 2 本は、どちらも存在しないホスト名を指している。

## 6. 契約が上流に残っていることを確かめる（2026-08-12 実測のまま——フレームワーク非依存）

実装は消えているが、**wire contract は読める**。GitHub token は要らない ——
`etzhayyim/root` はこの workspace に checkout 済み（west 管理）:

```bash
R=~/github/com-junkawasaki/orgs/etzhayyim/root
ls "$R/00-contracts/bpmn/com/etzhayyim/contentengine/"
ls "$R/00-contracts/lexicons/com/etzhayyim/etzhayyim/apps/contentengine/"
```

```
generateContent.bpmn                                    # 2,865B、1 本だけ
generateContent.json  getContent.json  listContent.json  registerCohortProfile.json
```

BPMN は `CLAUDE.md` の Flow 図と一致する（`contentengine.run_content_agent` 180s
→ `SponsorGateway` → `contentengine.create_sponsor_slot` 30s → End、分岐条件は
`includeSponsorSlot`）。**runbook のこの部分は今日も正しい。**

**この repo が抽出時に取り込んだ 13 ファイルのうち、`svelte/` 配下の 7 ファイルは
2026-08-26 に削除済み**（cljs への移行、上記）。残る 6 ファイル
（`README.edn` を含む metadata・`src/app.ts`・`wrangler.jsonc`・`kotodama.jsonld`
等）については、上流 `etzhayyim/root` に原本が残っているかどうかを
2026-08-26 に再確認していない——2026-08-12 実測（13/13 `same`）を最新として
引用しないこと。

## 7. ここから先は踏めない（踏まずに書いていない）

以下は **2026-08-26 時点で実行していない**。理由つきで残す:

- **`wrangler dev` / `wrangler deploy`** —— この移行のタスク制約により実行しない
  （workspace 規約: 検証を省いた blind deploy をしない。build/test の緑を確認した
  上で、実際の deploy 確認は次の operator に委ねる）。加えて 2026-08-12 実測のとおり
  `wrangler.jsonc` の route 2 本のホスト名は DNS に無いので、deploy しても
  叩ける URL が生えない。復活させるなら、先に `contentengine.etzhayyim.com` /
  `cten0001.etzhayyim.com` の DNS と、上流 `mcp.etzhayyim.com` の両方を用意する側の
  判断が要る。
- **`python3 -m http.server` での静的プレビュー**（step 4）—— コマンドは書いたが、
  この移行では実行していない（UNVERIFIED と明記）。
- **LangGraph ループ（`load_cohort_profile` → … → `store_content`）** ——
  `CLAUDE.md` が指す `contentengine_worker_main.py` が**どの repo にも見つからない**
  （上流の `40-engine/kotoba/` はディレクトリごと消え、`kotoba-lang/kotodama-py` にも
  該当文字列 0 件）。`cd` する先が無いので runbook の
  `python -m kotodama.contentengine_worker_main` は踏めない。
- **`vertex_contentengine_cohort_profile` / `vertex_contentengine_content`** ——
  RisingWave 側の DDL がどこにも無い（上流で `vertex_contentengine` に当たるのは
  runbook 自身と `session-history.edn` の 2 件だけ）。`RW_URL` の実体も分からない。
- **sponsor 分岐（`ads.etzhayyim.com`）** —— BPMN の `includeSponsorSlot = true` 経路。
  ads 側のホストも DNS に無い（step 5）。

## 後片付け

```bash
git status --porcelain
```

`cljs/` 配下の `node_modules/` `.shadow-cljs/` `.cpcache/` `out/` `public/js/` は
`cljs/.gitignore` 済みなので出ない。コミットに入るのは
`deps.edn` / `shadow-cljs.edn` / `package.json` / `package-lock.json` /
`src/**` / `test/**` / `public/index.html` だけ。
