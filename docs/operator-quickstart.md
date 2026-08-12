# operator quickstart

この repo は「動いているサービス」ではなく**凍結コピー**なので、最初にやることは
起動ではなく **「何が今日も動き、何が死んでいるか」を自分の手で確かめること**。
所要 5 分（依存の取得を除く）。**Cloudflare アカウントも API token も secret も要らない。**

ここに書いてある手順は **2026-08-12 に実際に踏んで、貼ってある出力はその実測値**。
踏めなかった手順は step 7 に「踏めない」と、理由つきで書いてある。

## 0. 前提

Node だけ。実測した版:

```bash
node --version   # v26.3.0
npm --version    # 11.16.0
```

作業ディレクトリは svelte アプリの中（**step 4-b だけ 1 つ上に出る** —— そこだけ
`wrangler.jsonc` の隣で動かす必要がある）:

```bash
cd appview/contentengine-cten0001/svelte
```

**重い build は 1 本に制限されている**（workspace 規約）。step 2 は必ず
resource guard 経由で回すこと。空いているかは先に見られる:

```bash
node /path/to/com-junkawasaki/scripts/resource-guard.mjs status
# {"build":{"active":false},"deploy":{"active":false}}
```

## 1. 依存を入れる

**`npm ci` は使えない。この repo に lockfile が無い。**

```bash
npm install --no-audit --no-fund
```

```
added 92 packages in 37s
npm warn allow-scripts 3 packages have install scripts not yet covered by allowScripts:
npm warn allow-scripts   esbuild@0.25.12 (postinstall: node install.js)
npm warn allow-scripts   esbuild@0.28.1 (postinstall: node install.js)
npm warn allow-scripts   workerd@1.20260804.1 (postinstall: node install.js)
```

**この allow-scripts 警告は無視してよい**（npm 11 の既定で postinstall が保留される）
—— esbuild も workerd も **step 2 と step 4 は警告を出したまま成功した**。

lockfile が無いので、`package.json` の caret 範囲から**毎回新しく解決される**。
2026-08-12 に解決された版（69 entry / `node_modules` 268 MB）:

| package | 解決された版 |
|---|---|
| `svelte` | 5.56.8 |
| `@sveltejs/kit` | 2.70.2 |
| `@sveltejs/adapter-cloudflare` | 7.2.9 |
| `@sveltejs/vite-plugin-svelte` | 5.1.1 |
| `vite` | 6.4.3 |
| `typescript` | 5.9.3 |
| `svelte-check` | 4.7.5 |
| `wrangler`（adapter 経由で入る） | 4.121.0 |
| `@cloudflare/workers-types` | 5.20260812.1 —— **`npm ls` が extraneous と言う** |

**`wrangler` は devDependencies に書かれていないが入る** —— step 4 はこれを使う。
別途インストールしなくてよい。

⚠ **`@cloudflare/workers-types` が extraneous なのは無害ではない。** `src/app.ts` は
`ExportedHandler<Env>`（workers-types のグローバル型）を使うのに、その型定義は
**どの `package.json` からも要求されていない**。つまり `src/app.ts` の型は
「たまたま入っているもの」に依存している —— もっとも step 3 のとおり、そもそも
このファイルは型検査もデプロイもされない。

`.gitignore` は 2026-08-12 に足した（それまで無く、この step が
`node_modules/` 268 MB を untracked で撒いていた）。

## 2. ビルドする（`wrangler.jsonc` が指す成果物を作る）

```bash
node /path/to/com-junkawasaki/scripts/resource-guard.mjs run build -- npm run build
```

```
✓ built in 1.81s        (client)
✓ built in 17.39s       (server)
> Using @sveltejs/adapter-cloudflare
  ✔ done
```

**これが作るものが、そのまま deploy 対象**。`wrangler.jsonc` の宣言と突き合わせる:

```bash
ls -la .svelte-kit/cloudflare/_worker.js     # main が指す先
ls .svelte-kit/cloudflare/client             # assets.directory が指す先
```

```
-rw-r--r--  1 ... 4335 ... .svelte-kit/cloudflare/_worker.js
_app
_headers
```

型も通る（build とは別の検査。resource guard は要らない）:

```bash
npm run check          # = svelte-kit sync && svelte-check
```

```
COMPLETED 142 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
```

⚠ **この 142 file に `src/app.ts` は入っていない。** 理由は自分で確かめられる ——
`.svelte-kit/tsconfig.json` の `include` は `../src/**/*.ts` までで、これは
`.svelte-kit/` から見て `svelte/src/` を指す。`src/app.ts` は `svelte/` の**外**、
1 つ上の階層に在るので届かない:

```bash
node -e "console.log(require('./.svelte-kit/tsconfig.json').include.filter(s=>s.includes('src')))"
# [ '../src/**/*.js', '../src/**/*.ts', '../src/**/*.svelte' ]
```

**この repo に `src/app.ts` を型検査するものは無い。** step 3 のとおりデプロイも
されないので、今日そこは誰にも見られていない。

## 3. `src/app.ts` がデプロイされないことを確かめる

README の主張を自分で検証する step。ビルド成果物に、`src/app.ts` だけが持つ
上流ホストが現れないことを見る:

```bash
grep -rl "dispatcher.etzhayyim.com" .svelte-kit/cloudflare/ ; echo "exit=$?"
```

```
exit=1
```

**1 件も無い**（exit 1 = マッチ 0）。一方、生きている側は成果物に入っている:

```bash
grep -rl "mcp.etzhayyim.com" .svelte-kit/output/server | head -1
```

```
.svelte-kit/output/server/entries/endpoints/xrpc/_...path_/_server.ts.js
```

step 4 の `/health` 404 が、これの実行時側の裏取りになる。

## 4. 実際に起動して叩く

2 通りある。**production に近いのは workerd 側（4-b）**なので、片方だけ踏むなら
そちらにすること。両方 2026-08-12 に踏んだ —— **結果はほぼ一致するが、1 行だけ違う**
（下の表）。

### 4-a. vite preview（Node で動く。速い）

```bash
npm run preview -- --port 4173
```

⚠ **`127.0.0.1` では繋がらない。`localhost`（IPv6 `::1`）を使う。**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4173/     # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/     # 000（接続失敗）
```

### 4-b. wrangler dev（workerd で動く。deploy と同じランタイム）

appview のルート（`wrangler.jsonc` のある場所）から:

```bash
cd ..                                  # appview/contentengine-cten0001
./svelte/node_modules/.bin/wrangler dev --local --port 8788 --ip 127.0.0.1
```

**Cloudflare へのログインを要求されない**（`--local`）。起動すると bindings が
表に出るので、`wrangler.jsonc` の `vars` 9 件がそのまま入っていることを目視できる:

```
env.ASSETS                                        Assets                  local
env.APP_CAPABILITIES ("["bpmn-dispatch","gener...) Environment Variable   local
env.APP_DESCRIPTION ("Personalized Content Eng...) Environment Variable   local
env.APP_DISPLAY_NAME ("etzhayyim Content Engine")  Environment Variable   local
env.APP_EMBED_URL ("https://cten0001.etzhayyim...) Environment Variable   local
env.APP_FRAMEWORK ("sveltekit-edge-bff")           Environment Variable   local
env.APP_NANOID ("cten0001")                        Environment Variable   local
env.APP_PERFORMER_TYPE ("service")                 Environment Variable   local
env.APP_UI_TYPE ("appview")                        Environment Variable   local
env.AGENTGATEWAY_MCP_ROUTER_URL ("https://mcp....) Environment Variable   local
...
[wrangler:info] ✨ Parsed 2 valid header rules.
[wrangler:info] Ready on http://127.0.0.1:8788
```

⚠ `Assets directory watcher hit a platform limit and has been disabled.` が出るが、
**macOS の file watcher 上限の話で、deploy には影響しない**（配信は正常）。

⚠ **`wrangler dev` の出力をパイプで受けるとこの表は見えない**（stdout がブロック
バッファされ、`| head` の先で詰まる）。ファイルへリダイレクトして読むこと:
`wrangler dev … > /tmp/wrangler.log 2>&1`。実測でここに数分溶かした。

### 叩いた結果

`$BASE` = `http://localhost:4173`（4-a）または `http://127.0.0.1:8788`（4-b）。
nsid は上流 lexicon に実在するものを使う:

```bash
NSID=com.etzhayyim.apps.contentengine.generateContent
curl -s -o /dev/null -w 'GET  /           → %{http_code}\n' "$BASE/"
curl -s -o /dev/null -w 'GET  /health     → %{http_code}\n' "$BASE/health"
curl -s -o /dev/null -w 'OPT  /xrpc/nsid  → %{http_code} %header{access-control-allow-methods}\n' \
  -X OPTIONS "$BASE/xrpc/$NSID"
curl -s -w '\nPOST /xrpc/nsid  → %{http_code}\n' -X POST -H 'content-type: application/json' \
  -d '{"cohortName":"early-adopters","contentType":"blog_post","topic":"content engine quickstart","maxWords":120}' \
  "$BASE/xrpc/$NSID"
```

| 経路 | vite preview | wrangler dev | 読み方 |
|---|---|---|---|
| `GET /` | **200** html 2,304B | **200** html 2,304B | ランディングは配信されている。`<title>contentengine-cten0001</title>` |
| `GET /health` | **404** | **404** | **`src/app.ts` は動いていない**（step 3 の実行時側の証拠） |
| `OPTIONS /xrpc/…` | **204** `POST,OPTIONS` | **204** `POST,OPTIONS` | CORS preflight だけは上流に触らないので通る |
| `GET /xrpc/…` | **405** | **405** | `+server.ts` に `GET` は無い |
| `POST /xrpc/…` | **500** `{"message":"Internal Error"}` | **500** 同じ body | **上流 `mcp.etzhayyim.com` が DNS に無い** |
| `POST /xrpc/`（nsid 無し） | **403** | **308** | ⚠ **ここだけ食い違う**（下記） |

⚠ **`POST /xrpc/`（末尾スラッシュ、nsid 無し）だけ 2 つの runtime で結果が違う。**
deploy されるのは workerd 側なので、**本番の挙動は 308**（末尾スラッシュのリダイレクト）
であって、`+server.ts` が持つ `400 Missing XRPC method` には**どちらでも到達しない**。
vite preview の 403 が何に由来するかはこの手順では特定していない —— **特定していない
ことをここに書いておく**（preview 固有の挙動なので、production の判断材料にしない）。

### この BFF が何も検証しないことを見る

同じ `$BASE` に、わざと壊した request を送る:

```bash
# lexicon の required（cohortName / contentType / topic）を全部欠いた body
curl -s -w '\n%{http_code}\n' -X POST -H 'content-type: application/json' \
  -d '{"bogus":1}' "$BASE/xrpc/$NSID"
# この actor が宣言していない capability
curl -s -w '\n%{http_code}\n' -X POST -H 'content-type: application/json' \
  -d '{}' "$BASE/xrpc/com.example.not.a.capability"
```

```
{"message":"Internal Error"}
500
{"message":"Internal Error"}
500
```

**どちらも 400 でも 404 でもなく 500** —— つまり edge は schema も capability も
見ておらず、`/xrpc/*` なら何でも上流へ投げようとする。`wrangler.jsonc` の
`APP_CAPABILITIES` 4 件は**宣言であって強制ではない**。

### 500 の中身は runtime で見え方が違う

```bash
# 4-b（workerd）のログ
Error: internal error; reference = 8aeh1vbbjr6b6n5s8o764c4m
    at async POST (.../entries/endpoints/xrpc/_...path_/_server.ts.js:24:20)

# 4-a（Node/undici）のログ
[500] POST /xrpc/com.etzhayyim.apps.contentengine.generateContent
TypeError: fetch failed
```

**production と同じ workerd では原因が読めない**（`internal error; reference=…`）。
DNS 失敗だと分かるのは Node 側だけ。**切り分けは 4-a でやること。**

`+server.ts` は上流 `fetch` を try で囲っていないので、名前解決の失敗が例外として
素通りし、ハンドラ内の 502 分岐（`MCP router request failed`）に到達しない。
上流が復活すればこの経路はそのまま動く。

## 5. 上流が本当に無いことを確かめる

step 4 の 500 を「自分の環境のせい」と誤読しないための裏取り:

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

## 6. 契約が上流に残っていることを確かめる

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

**そして、この repo の 13 ファイルは上流に原本が残っている**（抽出は move ではなく
copy だった）。同一であることは自分で確かめられる:

```bash
cd /path/to/this/repo
for f in $(git ls-files | grep -vE '^(README|migration)\.edn$'); do
  cmp -s "$R/60-apps/etzhayyim-project-contentengine/$f" "$f" \
    && echo "same  $f" || echo "DIFF  $f"
done
```

2026-08-12 実測: **13/13 とも `same`**。どちらを直すかを先に決めること
（片方を直しても他方には伝播しない）。

## 7. ここから先は踏めない（踏まずに書いていない）

以下は **2026-08-12 時点で実行していない**。理由つきで残す:

- **`wrangler deploy`** —— `wrangler.jsonc` の route 2 本のホスト名が DNS に無いので、
  deploy しても叩ける URL が生えない。**「動いた」を確認できない deploy はしない**
  （workspace 規約: 検証を省いた blind deploy をしない）。復活させるなら、先に
  `contentengine.etzhayyim.com` / `cten0001.etzhayyim.com` の DNS と、上流
  `mcp.etzhayyim.com` の両方を用意する側の判断が要る。
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

```
?? appview/contentengine-cten0001/svelte/package-lock.json
```

step 1〜4 が作るもののうち `node_modules/` `.svelte-kit/` `.wrangler/` は
`.gitignore` 済みなので出ない（`.wrangler/` は **`svelte/` の中と appview ルートの
2 箇所**に出るが、パターンは両方に当たる）。**残る 1 行は `package-lock.json` で、
これは意図的に無視していない** —— コミットすれば step 1 が `npm ci` になって再現可能に
なる（今は毎回解決し直している）。**そうするかどうかはこの repo に再現可能ビルドを
求めるかどうかの判断**なので、手順としては決めずに、見えるところに残してある。

消したい場合はこれだけ:

```bash
rm appview/contentengine-cten0001/svelte/package-lock.json
```
